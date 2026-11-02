use std::sync::Arc;
use mazzmuzik_core::{
    CascadeResolver, DownloaderConfig, LrclibClient, MusicBrainzClient, PoTokenConfig,
    QueueProcessor, UniversalPlaylistImporter, YtDlpDownloader,
};
use mazzmuzik_db::DbPool;
use crate::config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub config: AppConfig,
    pub processor: Arc<QueueProcessor>,
    pub importer: Arc<UniversalPlaylistImporter>,
    pub resolver: Arc<CascadeResolver>,
}

impl AppState {
    pub fn new(pool: DbPool, config: AppConfig) -> Self {
        let resolver = Arc::new(CascadeResolver::new(
            config.resolver.confidence_threshold,
            config.resolver.duration_tolerance_secs,
        ));

        let dl_config = DownloaderConfig {
            ytdlp_path: config.downloader.ytdlp_path.clone(),
            user_agent: config.downloader.user_agent.clone(),
            preferred_format: config.library.preferred_format.clone(),
            rate_limit_bytes_per_sec: config.downloader.rate_limit_bytes_per_sec,
            cookies_path: if config.downloader.cookies_path.is_empty() {
                None
            } else {
                Some(config.downloader.cookies_path.clone())
            },
            max_concurrent_downloads: config.downloader.max_concurrent_downloads,
            potoken_config: PoTokenConfig {
                enabled: config.downloader.potoken_bgutil_enabled,
                bgutil_url: config.downloader.potoken_bgutil_url.clone(),
            },
        };

        let downloader = Arc::new(YtDlpDownloader::new(dl_config));
        let musicbrainz = Arc::new(MusicBrainzClient::default());
        let lrclib = Arc::new(LrclibClient::default());

        let processor = Arc::new(QueueProcessor::new(
            resolver.clone(),
            downloader,
            musicbrainz,
            lrclib,
        ));

        let importer = Arc::new(UniversalPlaylistImporter::new());

        Self {
            pool,
            config,
            processor,
            importer,
            resolver,
        }
    }
}
