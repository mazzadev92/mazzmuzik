use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub base_url: String,
    pub secret_key: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 4040,
            base_url: "http://127.0.0.1:4040".to_string(),
            secret_key: "mazzmuzik-default-insecure-key".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub path: String,
    pub busy_timeout_secs: u64,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: "mazzmuzik.db".to_string(),
            busy_timeout_secs: 10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryConfig {
    pub music_dir: String,
    pub preferred_format: String,
    pub deduplicate: bool,
}

impl Default for LibraryConfig {
    fn default() -> Self {
        Self {
            music_dir: "music".to_string(),
            preferred_format: "flac".to_string(),
            deduplicate: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolverConfig {
    pub confidence_threshold: f64,
    pub duration_tolerance_secs: u64,
    pub cache_ttl_days: i64,
    pub provider_order: Vec<String>,
}

impl Default for ResolverConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.78,
            duration_tolerance_secs: 3,
            cache_ttl_days: 7,
            provider_order: vec![
                "ytmusic".to_string(),
                "youtube".to_string(),
                "deezer".to_string(),
                "soundcloud".to_string(),
                "bandcamp".to_string(),
                "audius".to_string(),
                "soulseek".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloaderSettings {
    pub max_concurrent_downloads: usize,
    pub rate_limit_bytes_per_sec: u64,
    pub ytdlp_path: String,
    pub user_agent: String,
    pub potoken_bgutil_enabled: bool,
    pub potoken_bgutil_url: String,
    pub cookies_path: String,
}

impl Default for DownloaderSettings {
    fn default() -> Self {
        Self {
            max_concurrent_downloads: 2,
            rate_limit_bytes_per_sec: 0,
            ytdlp_path: "yt-dlp".to_string(),
            user_agent: "MazzMuZik/0.1".to_string(),
            potoken_bgutil_enabled: true,
            potoken_bgutil_url: "http://127.0.0.1:4444".to_string(),
            cookies_path: "".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsonicSettings {
    pub server_name: String,
}

impl Default for SubsonicSettings {
    fn default() -> Self {
        Self {
            server_name: "Mazz MuZik".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub library: LibraryConfig,
    pub resolver: ResolverConfig,
    pub downloader: DownloaderSettings,
    pub subsonic: SubsonicSettings,
}

impl AppConfig {
    /// Charge la configuration depuis MAZZMUZIK_CONFIG_PATH, ~/.config/mazzmuzik/mazzmuzik.toml,
    /// config/mazzmuzik.example.toml, ou applique les valeurs par défaut
    pub fn load() -> Self {
        let mut config = Self::default();

        let candidates = [
            std::env::var("MAZZMUZIK_CONFIG_PATH").ok().map(PathBuf::from),
            dirs_path(),
            Some(PathBuf::from("config/mazzmuzik.toml")),
            Some(PathBuf::from("config/mazzmuzik.example.toml")),
        ];

        for candidate in candidates.into_iter().flatten() {
            if candidate.exists() {
                if let Ok(content) = std::fs::read_to_string(&candidate) {
                    if let Ok(parsed) = toml::from_str::<AppConfig>(&content) {
                        config = parsed;
                        break;
                    }
                }
            }
        }

        // Surcharges par variables d'environnement MAZZMUZIK_*
        if let Ok(port) = std::env::var("MAZZMUZIK_PORT") {
            if let Ok(p) = port.parse() {
                config.server.port = p;
            }
        }
        if let Ok(host) = std::env::var("MAZZMUZIK_HOST") {
            config.server.host = host;
        }
        if let Ok(db) = std::env::var("MAZZMUZIK_DATABASE_PATH") {
            config.database.path = db;
        }
        if let Ok(music) = std::env::var("MAZZMUZIK_MUSIC_DIR") {
            config.library.music_dir = music;
        }

        config
    }
}

fn dirs_path() -> Option<PathBuf> {
    std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok().map(|home| {
        Path::new(&home).join(".config").join("mazzmuzik").join("mazzmuzik.toml")
    })
}
