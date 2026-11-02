use lofty::config::WriteOptions;
use lofty::file::AudioFile;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::{ItemKey, ItemValue, Tag, TagItem};
use std::path::Path;
use tracing::info;
use crate::error::CoreError;
use crate::models::TrackMetadata;

pub struct AudioTagger;

impl AudioTagger {
    /// Écrit l'ensemble des métadonnées (titre, artiste, album, numéro, année, ISRC, MBID)
    /// ainsi que la pochette d'illustration directement dans le fichier audio.
    pub fn write_tags(file_path: &Path, meta: &TrackMetadata) -> Result<(), CoreError> {
        let mut tagged_file = Probe::open(file_path)
            .map_err(|e| CoreError::Tagging(format!("Failed to probe audio file: {}", e)))?
            .read()
            .map_err(|e| CoreError::Tagging(format!("Failed to read audio file: {}", e)))?;

        // Récupérer le tag existant ou créer un nouveau tag approprié selon le type de conteneur
        let tag = match tagged_file.primary_tag_mut() {
            Some(primary) => primary,
            None => {
                let tag_type = tagged_file.file_type().primary_tag_type();
                tagged_file.insert_tag(Tag::new(tag_type));
                tagged_file.primary_tag_mut().ok_or_else(|| {
                    CoreError::Tagging("Unable to allocate tag for audio file".to_string())
                })?
            }
        };

        // Tags standards
        tag.set_title(meta.title.clone());
        tag.set_artist(meta.artist.clone());
        if let Some(album) = &meta.album {
            tag.set_album(album.clone());
        }
        if let Some(track_num) = meta.track_number {
            tag.set_track(track_num);
        }
        if let Some(year) = meta.release_year {
            tag.set_year(year as u32);
        }

        // Genre
        if !meta.genres.is_empty() {
            tag.set_genre(meta.genres.join(", "));
        }

        // Identifiants canoniques ISRC / MusicBrainz
        if let Some(isrc) = &meta.isrc {
            tag.insert(TagItem::new(ItemKey::Isrc, ItemValue::Text(isrc.clone())));
        }
        if let Some(mbid) = &meta.mbid {
            tag.insert(TagItem::new(ItemKey::MusicBrainzRecordingId, ItemValue::Text(mbid.clone())));
        }

        // Pochette d'album intégrée
        if let Some(cover_bytes) = &meta.cover_image_bytes {
            let mime = match meta.cover_mime_type.as_deref() {
                Some("image/png") => MimeType::Png,
                _ => MimeType::Jpeg,
            };

            let picture = Picture::new_unchecked(
                PictureType::CoverFront,
                Some(mime),
                None,
                cover_bytes.clone(),
            );
            tag.push_picture(picture);
        }

        // Sauvegarde sur disque
        tag.save_to_path(file_path, WriteOptions::default())
            .map_err(|e| CoreError::Tagging(format!("Failed to save audio tags: {}", e)))?;

        info!("Successfully tagged audio file: {:?}", file_path);
        Ok(())
    }

    /// Lit les métadonnées existantes d'un fichier audio
    pub fn read_tags(file_path: &Path) -> Result<TrackMetadata, CoreError> {
        let tagged_file = Probe::open(file_path)
            .map_err(|e| CoreError::Tagging(format!("Failed to probe audio file: {}", e)))?
            .read()
            .map_err(|e| CoreError::Tagging(format!("Failed to read audio file: {}", e)))?;

        let properties = tagged_file.properties();
        let duration_ms = properties.duration().as_millis() as u64;

        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

        let title = tag.and_then(|t| t.title().map(|s| s.to_string()))
            .unwrap_or_else(|| {
                file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown Title").to_string()
            });

        let artist = tag.and_then(|t| t.artist().map(|s| s.to_string()))
            .unwrap_or_else(|| "Unknown Artist".to_string());

        let album = tag.and_then(|t| t.album().map(|s| s.to_string()));
        let track_number = tag.and_then(|t| t.track());
        let release_year = tag.and_then(|t| t.year().map(|y| y as i32));

        let mut isrc = None;
        let mut mbid = None;
        let mut genres = Vec::new();

        if let Some(t) = tag {
            if let Some(isrc_item) = t.get(&ItemKey::Isrc) {
                if let ItemValue::Text(val) = isrc_item.value() {
                    isrc = Some(val.clone());
                }
            }
            if let Some(mbid_item) = t.get(&ItemKey::MusicBrainzRecordingId) {
                if let ItemValue::Text(val) = mbid_item.value() {
                    mbid = Some(val.clone());
                }
            }
            if let Some(genre) = t.genre() {
                genres = genre.split(&[',', ';'][..]).map(|s| s.trim().to_string()).collect();
            }
        }

        Ok(TrackMetadata {
            title,
            artist,
            album,
            track_number,
            disc_number: Some(1),
            duration_ms,
            release_year,
            isrc,
            mbid,
            genres,
            cover_image_bytes: None,
            cover_mime_type: None,
            synced_lyrics: None,
        })
    }
}
