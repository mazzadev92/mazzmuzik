use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct SoundCloudProvider {
    client: Client,
}

impl Default for SoundCloudProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl SoundCloudProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0")
            .build()
            .unwrap_or_default();
        Self { client }
    }
}

#[async_trait]
impl SourceProvider for SoundCloudProvider {
    fn name(&self) -> &'static str {
        "soundcloud"
    }

    fn priority(&self) -> u32 {
        4
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        // SoundCloud public search via anonymous client or web search
        let query_str = format!("{} {}", query.artist, query.title);
        let url = format!(
            "https://api-v2.soundcloud.com/search/tracks?q={}&client_id=a3e059563d7fd3372b49b37f00a00bcf&limit=5",
            urlencoding::encode(&query_str)
        );

        let mut candidates = Vec::new();

        if let Ok(resp) = self.client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<Value>().await {
                    if let Some(collection) = json.get("collection").and_then(|c| c.as_array()) {
                        for item in collection {
                            if let (Some(id), Some(title), Some(permalink_url)) = (
                                item.get("id").and_then(|i| i.as_i64()),
                                item.get("title").and_then(|t| t.as_str()),
                                item.get("permalink_url").and_then(|p| p.as_str()),
                            ) {
                                let username = item.pointer("/user/username").and_then(|u| u.as_str()).unwrap_or(&query.artist);
                                let duration = item.get("duration").and_then(|d| d.as_u64()).unwrap_or(0);

                                candidates.push(MatchCandidate {
                                    provider: self.name().to_string(),
                                    external_id: id.to_string(),
                                    external_url: permalink_url.to_string(),
                                    title: title.to_string(),
                                    artist: username.to_string(),
                                    album: None,
                                    duration_ms: duration,
                                    confidence_score: 0.0,
                                    direct_stream_url: None,
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
        Ok(Some(candidate.external_url.clone()))
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
