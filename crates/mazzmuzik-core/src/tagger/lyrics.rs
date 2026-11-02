use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::info;
use crate::error::CoreError;

pub struct LyricsManager;

impl LyricsManager {
    /// Écrit le fichier de paroles synchronisées .lrc à côté du fichier audio
    pub async fn write_lrc_file(audio_path: &Path, lrc_content: &str) -> Result<PathBuf, CoreError> {
        let lrc_path = audio_path.with_extension("lrc");
        fs::write(&lrc_path, lrc_content.trim().as_bytes())
            .await
            .map_err(|e| CoreError::Io(e))?;

        info!("Successfully written synced lyrics: {:?}", lrc_path);
        Ok(lrc_path)
    }

    /// Lit le fichier .lrc compagnon d'une piste audio s'il existe
    pub async fn read_lrc_file(audio_path: &Path) -> Result<Option<String>, CoreError> {
        let lrc_path = audio_path.with_extension("lrc");
        if lrc_path.exists() {
            let content = fs::read_to_string(&lrc_path).await.map_err(CoreError::Io)?;
            Ok(Some(content))
        } else {
            Ok(None)
        }
    }
}
