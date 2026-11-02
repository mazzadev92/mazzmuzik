use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tracing::{error, info};
use crate::downloader::YtDlpDownloader;
use crate::error::CoreError;
use crate::metadata::{LrclibClient, MusicBrainzClient};
use crate::models::{MatchCandidate, TrackMetadata, TrackQuery};
use crate::organizer::{Deduplicator, FileOrganizer};
use crate::resolver::{CascadeResolver, CascadeResult};
use crate::tagger::{AudioTagger, LyricsManager};

#[derive(Debug, Clone)]
pub struct ProcessedTrack {
    pub file_path: PathBuf,
    pub relative_path: PathBuf,
    pub file_size: u64,
    pub mime_type: String,
    pub duration_ms: u64,
    pub format: String,
    pub lrc_path: Option<PathBuf>,
    pub fingerprint: String,
    pub metadata: TrackMetadata,
    pub chosen_candidate: MatchCandidate,
}

#[derive(Debug, Clone)]
pub enum ProcessOutcome {
    Completed(ProcessedTrack),
    NeedsManualReview(Vec<MatchCandidate>),
    Failed(String),
}

pub struct QueueProcessor {
    resolver: Arc<CascadeResolver>,
    downloader: Arc<YtDlpDownloader>,
    musicbrainz: Arc<MusicBrainzClient>,
    lrclib: Arc<LrclibClient>,
}

impl QueueProcessor {
    pub fn new(
        resolver: Arc<CascadeResolver>,
        downloader: Arc<YtDlpDownloader>,
        musicbrainz: Arc<MusicBrainzClient>,
        lrclib: Arc<LrclibClient>,
    ) -> Self {
        Self {
            resolver,
            downloader,
            musicbrainz,
            lrclib,
        }
    }

    /// Exécute le traitement complet d'une demande :
    /// 1. Résolution cascade
    /// 2. Téléchargement yt-dlp supervisé
    /// 3. Enrichissement MusicBrainz & LRCLIB
    /// 4. Taggage ID3/Vorbis + cover + .lrc
    /// 5. Organisation sous Artiste/Album/TT - Titre.ext
    pub async fn process_job(
        &self,
        query: &TrackQuery,
        music_root: &Path,
        temp_dir: &Path,
    ) -> Result<ProcessOutcome, CoreError> {
        info!("Processing queue job for '{}' by '{}'", query.title, query.artist);

        // 1. Résolution en cascade
        let resolution = self.resolver.resolve(query).await?;
        let candidate = match resolution {
            CascadeResult::Resolved(cand) => cand,
            CascadeResult::NeedsReview(candidates) => {
                info!("Track requires manual review ({} candidates)", candidates.len());
                return Ok(ProcessOutcome::NeedsManualReview(candidates));
            }
            CascadeResult::NotFound => {
                return Ok(ProcessOutcome::Failed("No candidates found on any provider".to_string()));
            }
        };

        // 2. Préparation du répertoire temporaire
        if !temp_dir.exists() {
            fs::create_dir_all(temp_dir).await.map_err(CoreError::Io)?;
        }
        let temp_template = temp_dir.join(format!("download_{}", uuid::Uuid::new_v4()));

        // 3. Téléchargement via yt-dlp
        let downloaded_temp_path = self.downloader.download(&candidate.external_url, &temp_template).await?;

        // 4. Enrichissement métadonnées canoniques (MusicBrainz)
        let mb_meta = self.musicbrainz.fetch_canonical(&query.artist, &query.title).await.unwrap_or(None);

        let final_title = mb_meta.as_ref().map(|m| m.title.clone()).unwrap_or_else(|| query.title.clone());
        let final_artist = mb_meta.as_ref().map(|m| m.artist.clone()).unwrap_or_else(|| query.artist.clone());
        let final_album = mb_meta.as_ref().and_then(|m| m.album.clone()).or_else(|| query.album.clone());
        let final_year = mb_meta.as_ref().and_then(|m| m.release_year);
        let final_isrc = mb_meta.as_ref().and_then(|m| m.isrc.clone()).or_else(|| query.isrc.clone());
        let final_mbid = mb_meta.as_ref().and_then(|m| m.mbid.clone()).or_else(|| query.mbid.clone());
        let final_track_number = mb_meta.as_ref().and_then(|m| m.track_number).unwrap_or(1);
        let final_genres = mb_meta.map(|m| m.genres).unwrap_or_default();

        // 5. Paroles synchronisées (.lrc)
        let synced_lyrics = self.lrclib.fetch_synced_lyrics(
            &final_artist,
            &final_title,
            final_album.as_deref(),
            query.duration_ms,
        ).await.unwrap_or(None);

        let ext = downloaded_temp_path.extension().and_then(|s| s.to_str()).unwrap_or("flac");

        // 6. Rangement dans le dossier musique final : `Artiste/Album/TT - Titre.ext`
        let relative_path = FileOrganizer::build_relative_path(
            &final_artist,
            final_album.as_deref(),
            Some(final_track_number),
            &final_title,
            ext,
        );
        let final_audio_path = music_root.join(&relative_path);

        if let Some(parent) = final_audio_path.parent() {
            fs::create_dir_all(parent).await.map_err(CoreError::Io)?;
        }

        // Déplacement du fichier audio
        fs::rename(&downloaded_temp_path, &final_audio_path).await.map_err(CoreError::Io)?;

        // 7. Écriture des tags audio
        let metadata = TrackMetadata {
            title: final_title.clone(),
            artist: final_artist.clone(),
            album: final_album.clone(),
            track_number: Some(final_track_number),
            disc_number: Some(1),
            duration_ms: candidate.duration_ms,
            release_year: final_year,
            isrc: final_isrc,
            mbid: final_mbid,
            genres: final_genres,
            cover_image_bytes: None,
            cover_mime_type: None,
            synced_lyrics: synced_lyrics.clone(),
        };

        if let Err(e) = AudioTagger::write_tags(&final_audio_path, &metadata) {
            error!("Failed to write tags to {:?}: {}", final_audio_path, e);
        }

        // 8. Écriture du fichier .lrc compagnon si paroles trouvées
        let mut lrc_final_path = None;
        if let Some(lrc_text) = synced_lyrics {
            if let Ok(p) = LyricsManager::write_lrc_file(&final_audio_path, &lrc_text).await {
                lrc_final_path = Some(p);
            }
        }

        // 9. Calcul de l'empreinte et taille du fichier
        let file_meta = fs::metadata(&final_audio_path).await.map_err(CoreError::Io)?;
        let fingerprint = Deduplicator::compute_file_fingerprint(&final_audio_path).await?;

        let mime_type = match ext {
            "opus" => "audio/ogg".to_string(),
            "mp3" => "audio/mpeg".to_string(),
            _ => "audio/flac".to_string(),
        };

        info!("Job successfully completed! Saved at: {:?}", final_audio_path);

        Ok(ProcessOutcome::Completed(ProcessedTrack {
            file_path: final_audio_path,
            relative_path,
            file_size: file_meta.len(),
            mime_type,
            duration_ms: candidate.duration_ms,
            format: ext.to_string(),
            lrc_path: lrc_final_path,
            fingerprint,
            metadata,
            chosen_candidate: candidate,
        }))
    }
}
