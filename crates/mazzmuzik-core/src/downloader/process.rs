use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Semaphore;
use tracing::{error, info};
use crate::error::CoreError;
use super::potoken::{PoTokenConfig, PoTokenProvider};

#[derive(Debug, Clone)]
pub struct DownloaderConfig {
    pub ytdlp_path: String,
    pub user_agent: String,
    pub preferred_format: String, // "flac", "opus", "mp3"
    pub rate_limit_bytes_per_sec: u64,
    pub cookies_path: Option<String>,
    pub max_concurrent_downloads: usize,
    pub potoken_config: PoTokenConfig,
}

impl Default for DownloaderConfig {
    fn default() -> Self {
        Self {
            ytdlp_path: "yt-dlp".to_string(),
            user_agent: "MazzMuZik/0.1".to_string(),
            preferred_format: "flac".to_string(),
            rate_limit_bytes_per_sec: 0,
            cookies_path: None,
            max_concurrent_downloads: 2,
            potoken_config: PoTokenConfig::default(),
        }
    }
}

pub struct YtDlpDownloader {
    config: DownloaderConfig,
    potoken_provider: PoTokenProvider,
    semaphore: Arc<Semaphore>,
}

impl YtDlpDownloader {
    pub fn new(config: DownloaderConfig) -> Self {
        let potoken_provider = PoTokenProvider::new(config.potoken_config.clone());
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent_downloads));
        Self {
            config,
            potoken_provider,
            semaphore,
        }
    }

    /// Télécharge une source audio vers un chemin de destination temporaire ou final
    pub async fn download(
        &self,
        source_url: &str,
        output_template: &Path,
    ) -> Result<PathBuf, CoreError> {
        // Acquisition d'un permis de téléchargement borné
        let _permit = self.semaphore.acquire().await.map_err(|e| {
            CoreError::Download(format!("Failed to acquire download slot: {}", e))
        })?;

        info!("Starting download for: {}", source_url);

        // Récupération optionnelle du PoToken
        let potoken = self.potoken_provider.get_token().await.unwrap_or(None);

        let mut cmd = Command::new(&self.config.ytdlp_path);

        // Arguments stricts sans injection shell
        cmd.arg("--no-playlist")
            .arg("--no-warnings")
            .arg("--no-colors")
            .arg("--user-agent")
            .arg(&self.config.user_agent)
            .arg("--extract-audio")
            .arg("--audio-format")
            .arg(&self.config.preferred_format)
            .arg("--audio-quality")
            .arg("0")
            .arg("-o")
            .arg(output_template.as_os_str());

        // Limite de débit si configurée
        if self.config.rate_limit_bytes_per_sec > 0 {
            cmd.arg("--limit-rate")
                .arg(format!("{}", self.config.rate_limit_bytes_per_sec));
        }

        // Arguments d'extraction PoToken
        for arg in self.potoken_provider.build_extractor_args(potoken.as_deref()) {
            cmd.arg(arg);
        }

        // Fichier de cookies optionnel
        if let Some(cookies) = &self.config.cookies_path {
            if !cookies.trim().is_empty() && Path::new(cookies).exists() {
                cmd.arg("--cookies").arg(cookies);
            }
        }

        // URL source
        cmd.arg(source_url);

        let output = cmd.output().await.map_err(|e| {
            CoreError::Download(format!("Failed to spawn yt-dlp process: {}", e))
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("yt-dlp failed with: {}", stderr);
            return Err(CoreError::Download(format!("yt-dlp exited with error: {}", stderr)));
        }

        let expected_ext = match self.config.preferred_format.as_str() {
            "opus" => "opus",
            "mp3" => "mp3",
            _ => "flac",
        };
        let final_path = output_template.with_extension(expected_ext);

        info!("Download completed successfully: {:?}", final_path);
        Ok(final_path)
    }
}
