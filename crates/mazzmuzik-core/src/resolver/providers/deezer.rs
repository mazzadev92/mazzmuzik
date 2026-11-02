use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct DeezerProvider {
    client: Client,
}

impl Default for DeezerProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl DeezerProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("MazzMuZik/0.1")
            .build()
            .unwrap_or_default();
        Self { client }
    }
}

#[async_trait]
impl SourceProvider for DeezerProvider {
    fn name(&self) -> &'static str {
        "deezer"
    }

    fn priority(&self) -> u32 {
        3
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        let query_str = format!("artist:\"{}\" track:\"{}\"", query.artist, query.title);
        let url = format!("https://api.deezer.com/search?q={}&limit=5", urlencoding::encode(&query_str));

        let resp = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                return Err(CoreError::Provider {
                    provider: self.name().to_string(),
                    message: format!("Deezer request error: {}", e),
                });
            }
        };

        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let json: Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => return Ok(Vec::new()),
        };

        let mut candidates = Vec::new();

        if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
            for item in data {
                if let (Some(id), Some(title)) = (
                    item.get("id").and_then(|i| i.as_i64()),
                    item.get("title").and_then(|t| t.as_str()),
                ) {
                    let artist = item.pointer("/artist/name").and_then(|a| a.as_str()).unwrap_or(&query.artist);
                    let album = item.pointer("/album/title").and_then(|a| a.as_str());
                    let duration_secs = item.get("duration").and_then(|d| d.as_u64()).unwrap_or(0);
                    let preview = item.get("preview").and_then(|p| p.as_str()).map(|s| s.to_string());
                    let link = item.get("link").and_then(|l| l.as_str()).unwrap_or("");

                    candidates.push(MatchCandidate {
                        provider: self.name().to_string(),
                        external_id: id.to_string(),
                        external_url: link.to_string(),
                        title: title.to_string(),
                        artist: artist.to_string(),
                        album: album.map(|s| s.to_string()),
                        duration_ms: duration_secs * 1000,
                        confidence_score: 0.0,
                        direct_stream_url: preview,
                    });
                }
            }
        }

        Ok(candidates)
    }

    async fn resolve_stream_or_download_url(
        &self,
        candidate: &MatchCandidate,
    ) -> Result<Option<String>, CoreError> {
        Ok(candidate.direct_stream_url.clone().or_else(|| Some(candidate.external_url.clone())))
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
