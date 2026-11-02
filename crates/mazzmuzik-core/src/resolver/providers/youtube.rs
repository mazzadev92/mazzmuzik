use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct YouTubeProvider {
    client: Client,
    invidious_instances: Vec<&'static str>,
}

impl Default for YouTubeProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl YouTubeProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0")
            .build()
            .unwrap_or_default();

        let invidious_instances = vec![
            "https://inv.tux.pizza",
            "https://invidious.nerdvpn.de",
            "https://invidious.projectsegfau.lt",
        ];

        Self { client, invidious_instances }
    }
}

#[async_trait]
impl SourceProvider for YouTubeProvider {
    fn name(&self) -> &'static str {
        "youtube"
    }

    fn priority(&self) -> u32 {
        2
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        let search_term = format!("{} - {}", query.artist, query.title);

        // Tentative sur instances Invidious publiques
        for instance in &self.invidious_instances {
            let url = format!("{}/api/v1/search?q={}&type=video", instance, urlencoding::encode(&search_term));
            if let Ok(resp) = self.client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(items) = resp.json::<Vec<Value>>().await {
                        let mut candidates = Vec::new();
                        for item in items.iter().take(5) {
                            if let (Some(vid), Some(title)) = (
                                item.get("videoId").and_then(|v| v.as_str()),
                                item.get("title").and_then(|t| t.as_str()),
                            ) {
                                let author = item.get("author").and_then(|a| a.as_str()).unwrap_or(&query.artist);
                                let length_seconds = item.get("lengthSeconds").and_then(|l| l.as_u64()).unwrap_or(0);

                                candidates.push(MatchCandidate {
                                    provider: self.name().to_string(),
                                    external_id: vid.to_string(),
                                    external_url: format!("https://www.youtube.com/watch?v={}", vid),
                                    title: title.to_string(),
                                    artist: author.to_string(),
                                    album: None,
                                    duration_ms: length_seconds * 1000,
                                    confidence_score: 0.0,
                                    direct_stream_url: None,
                                });
                            }
                        }
                        if !candidates.is_empty() {
                            return Ok(candidates);
                        }
                    }
                }
            }
        }

        // Si Invidious indisponible, retourner un candidat généré direct pour yt-dlp
        Ok(vec![MatchCandidate {
            provider: self.name().to_string(),
            external_id: format!("ytsearch:{}", search_term),
            external_url: format!("ytsearch:{}", search_term),
            title: query.title.clone(),
            artist: query.artist.clone(),
            album: query.album.clone(),
            duration_ms: query.duration_ms.unwrap_or(0),
            confidence_score: 0.70,
            direct_stream_url: None,
        }])
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
