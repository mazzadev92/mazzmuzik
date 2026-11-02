use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct AudiusProvider {
    client: Client,
}

impl Default for AudiusProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl AudiusProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("MazzMuZik/0.1")
            .build()
            .unwrap_or_default();
        Self { client }
    }
}

#[async_trait]
impl SourceProvider for AudiusProvider {
    fn name(&self) -> &'static str {
        "audius"
    }

    fn priority(&self) -> u32 {
        6
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        let query_str = format!("{} {}", query.artist, query.title);
        let url = format!(
            "https://discoveryprovider.audius.co/v1/tracks/search?query={}&app_name=mazzmuzik",
            urlencoding::encode(&query_str)
        );

        let mut candidates = Vec::new();

        if let Ok(resp) = self.client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<Value>().await {
                    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                        for item in data.iter().take(5) {
                            if let (Some(id), Some(title)) = (
                                item.get("id").and_then(|i| i.as_str()),
                                item.get("title").and_then(|t| t.as_str()),
                            ) {
                                let user = item.pointer("/user/name").and_then(|u| u.as_str()).unwrap_or(&query.artist);
                                let duration = item.get("duration").and_then(|d| d.as_u64()).unwrap_or(0);
                                let stream_url = format!("https://discoveryprovider.audius.co/v1/tracks/{}/stream?app_name=mazzmuzik", id);

                                candidates.push(MatchCandidate {
                                    provider: self.name().to_string(),
                                    external_id: id.to_string(),
                                    external_url: format!("https://audius.co/tracks/{}", id),
                                    title: title.to_string(),
                                    artist: user.to_string(),
                                    album: None,
                                    duration_ms: duration * 1000,
                                    confidence_score: 0.0,
                                    direct_stream_url: Some(stream_url),
                                });
                            }
                        }
                    }
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
