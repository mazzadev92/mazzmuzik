use async_trait::async_trait;
use reqwest::Client;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct BandcampProvider {
    client: Client,
}

impl Default for BandcampProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl BandcampProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("MazzMuZik/0.1")
            .build()
            .unwrap_or_default();
        Self { client }
    }
}

#[async_trait]
impl SourceProvider for BandcampProvider {
    fn name(&self) -> &'static str {
        "bandcamp"
    }

    fn priority(&self) -> u32 {
        5
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        let query_str = format!("{} {}", query.artist, query.title);
        let url = format!(
            "https://bandcamp.com/api/fuzzysearch/1/appautocomplete?q={}",
            urlencoding::encode(&query_str)
        );

        let mut candidates = Vec::new();

        if let Ok(resp) = self.client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(results) = json.pointer("/auto/results").and_then(|r| r.as_array()) {
                        for item in results {
                            let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
                            if item_type == "t" || item_type == "a" {
                                if let (Some(name), Some(item_url)) = (
                                    item.get("name").and_then(|n| n.as_str()),
                                    item.get("url").and_then(|u| u.as_str()),
                                ) {
                                    let band_name = item.get("band_name").and_then(|b| b.as_str()).unwrap_or(&query.artist);
                                    let id = item.get("id").and_then(|i| i.as_i64()).unwrap_or(0);

                                    candidates.push(MatchCandidate {
                                        provider: self.name().to_string(),
                                        external_id: id.to_string(),
                                        external_url: item_url.to_string(),
                                        title: name.to_string(),
                                        artist: band_name.to_string(),
                                        album: None,
                                        duration_ms: query.duration_ms.unwrap_or(0),
                                        confidence_score: 0.0,
                                        direct_stream_url: None,
                                    });
                                }
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
