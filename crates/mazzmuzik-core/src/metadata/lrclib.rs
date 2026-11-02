use reqwest::Client;
use serde_json::Value;
use tracing::{info, warn};
use crate::error::CoreError;

pub struct LrclibClient {
    client: Client,
}

impl Default for LrclibClient {
    fn default() -> Self {
        Self::new()
    }
}

impl LrclibClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("MazzMuZik/0.1 ( https://github.com/mazzmuzik/mazzmuzik )")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    /// Récupère les paroles synchronisées (.lrc) depuis LRCLIB
    pub async fn fetch_synced_lyrics(
        &self,
        artist: &str,
        title: &str,
        album: Option<&str>,
        duration_ms: Option<u64>,
    ) -> Result<Option<String>, CoreError> {
        let mut url = format!(
            "https://lrclib.net/api/get?artist_name={}&track_name={}",
            urlencoding::encode(artist),
            urlencoding::encode(title),
        );

        if let Some(alb) = album {
            url.push_str(&format!("&album_name={}", urlencoding::encode(alb)));
        }
        if let Some(dur) = duration_ms {
            let dur_secs = dur / 1000;
            url.push_str(&format!("&duration={}", dur_secs));
        }

        let resp = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                warn!("LRCLIB request error: {}", e);
                return Ok(None);
            }
        };

        if !resp.status().is_success() {
            return Ok(None);
        }

        let json: Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => return Ok(None),
        };

        if let Some(synced) = json.get("syncedLyrics").and_then(|s| s.as_str()) {
            if !synced.trim().is_empty() {
                info!("Found synced lyrics for '{}' by '{}'", title, artist);
                return Ok(Some(synced.to_string()));
            }
        }

        // Fallback sur les paroles brutes non synchronisées si les synchros n'existent pas
        if let Some(plain) = json.get("plainLyrics").and_then(|p| p.as_str()) {
            if !plain.trim().is_empty() {
                return Ok(Some(plain.to_string()));
            }
        }

        Ok(None)
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
