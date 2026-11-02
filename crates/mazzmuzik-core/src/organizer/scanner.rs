use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{info, warn};
use crate::error::CoreError;
use crate::models::TrackMetadata;
use crate::organizer::deduplicator::Deduplicator;
use crate::tagger::id3::AudioTagger;

#[derive(Debug, Clone)]
pub struct ScannedAudioFile {
    pub absolute_path: PathBuf,
    pub relative_path: PathBuf,
    pub file_size: u64,
    pub mime_type: String,
    pub format: String,
    pub metadata: TrackMetadata,
    pub lrc_path: Option<PathBuf>,
    pub fingerprint: String,
}

pub struct LibraryScanner;

impl LibraryScanner {
    /// Parcourt itérativement un répertoire pour découvrir et indexer tous les fichiers audio
    pub async fn scan_directory(root_dir: &Path) -> Result<Vec<ScannedAudioFile>, CoreError> {
        let mut results = Vec::new();
        if !root_dir.exists() {
            return Ok(results);
        }

        let mut queue = vec![root_dir.to_path_buf()];

        while let Some(current_dir) = queue.pop() {
            let mut entries = match fs::read_dir(&current_dir).await {
                Ok(e) => e,
                Err(e) => {
                    warn!("Cannot read directory {:?}: {}", current_dir, e);
                    continue;
                }
            };

            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.is_dir() {
                    queue.push(path);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) {
                        if matches!(ext.as_str(), "flac" | "opus" | "ogg" | "mp3" | "m4a") {
                            if let Ok(scanned) = Self::inspect_file(root_dir, &path, &ext).await {
                                results.push(scanned);
                            }
                        }
                    }
                }
            }
        }

        info!("Library scan completed: found {} audio tracks in {:?}", results.len(), root_dir);
        Ok(results)
    }

    async fn inspect_file(
        root_dir: &Path,
        file_path: &Path,
        format: &str,
    ) -> Result<ScannedAudioFile, CoreError> {
        let meta = fs::metadata(file_path).await.map_err(CoreError::Io)?;
        let tags = AudioTagger::read_tags(file_path)?;

        let relative_path = file_path.strip_prefix(root_dir).unwrap_or(file_path).to_path_buf();

        let lrc_candidate = file_path.with_extension("lrc");
        let lrc_path = if lrc_candidate.exists() {
            Some(lrc_candidate)
        } else {
            None
        };

        let fingerprint = Deduplicator::compute_file_fingerprint(file_path).await?;

        let mime_type = match format {
            "opus" | "ogg" => "audio/ogg".to_string(),
            "mp3" => "audio/mpeg".to_string(),
            "m4a" => "audio/mp4".to_string(),
            _ => "audio/flac".to_string(),
        };

        Ok(ScannedAudioFile {
            absolute_path: file_path.to_path_buf(),
            relative_path,
            file_size: meta.len(),
            mime_type,
            format: format.to_string(),
            metadata: tags,
            lrc_path,
            fingerprint,
        })
    }
}
