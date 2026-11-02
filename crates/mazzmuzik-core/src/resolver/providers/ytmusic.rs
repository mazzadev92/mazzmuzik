use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct YtMusicProvider {
    client: Client,
}

impl Default for YtMusicProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl YtMusicProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0")
            .build()
            .unwrap_or_default();
        Self { client }
    }
}

#[async_trait]
impl SourceProvider for YtMusicProvider {
    fn name(&self) -> &'static str {
        "ytmusic"
    }

    fn priority(&self) -> u32 {
        1
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        let search_term = format!("{} {}", query.artist, query.title);
        let url = "https://music.youtube.com/youtubei/v1/search";

        let body = serde_json::json!({
            "context": {
                "client": {
                    "clientName": "WEB_REMIX",
                    "clientVersion": "1.20240722.01.00",
                    "hl": "en",
                    "gl": "US"
                }
            },
            "query": search_term,
            "params": "Eg-KAQwIABAAGAAgACgAMABqChAEEAMQCRAFEAo%3D" // Filter to songs
        });

        let resp = self.client.post(url)
            .header("Content-Type", "application/json")
            .header("Referer", "https://music.youtube.com/")
            .json(&body)
            .send()
            .await;

        let mut candidates = Vec::new();

        let resp = match resp {
            Ok(r) => r,
            Err(e) => {
                return Err(CoreError::Provider {
                    provider: self.name().to_string(),
                    message: format!("HTTP request failed: {}", e),
                });
            }
        };

        if !resp.status().is_success() {
            return Ok(candidates);
        }

        let json: Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => return Ok(candidates),
        };

        // Extraction robuste du contenu des sections
        if let Some(contents) = json.pointer("/contents/tabbedSearchResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents") {
            if let Some(sections) = contents.as_array() {
                for sec in sections {
                    if let Some(items) = sec.pointer("/musicShelfRenderer/contents").and_then(|c| c.as_array()) {
                        for item in items {
                            if let Some(item_renderer) = item.get("musicResponsiveListItemRenderer") {
                                let video_id = item_renderer.pointer("/playlistItemData/videoId")
                                    .and_then(|v| v.as_str());

                                if let Some(vid) = video_id {
                                    let title = item_renderer.pointer("/flexColumns/0/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
                                        .and_then(|t| t.as_str())
                                        .unwrap_or(&query.title);

                                    let artist = item_renderer.pointer("/flexColumns/1/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
                                        .and_then(|a| a.as_str())
                                        .unwrap_or(&query.artist);

                                    let duration_str = item_renderer.pointer("/fixedColumns/0/musicResponsiveListItemFixedColumnRenderer/text/runs/0/text")
                                        .and_then(|d| d.as_str());

                                    let duration_ms = parse_duration_to_ms(duration_str).unwrap_or(query.duration_ms.unwrap_or(0));

                                    candidates.push(MatchCandidate {
                                        provider: self.name().to_string(),
                                        external_id: vid.to_string(),
                                        external_url: format!("https://music.youtube.com/watch?v={}", vid),
                                        title: title.to_string(),
                                        artist: artist.to_string(),
                                        album: None,
                                        duration_ms,
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
        // Pour YT Music, le téléchargement direct est délégué à yt-dlp avec PoToken
        Ok(Some(candidate.external_url.clone()))
    }
}

fn parse_duration_to_ms(duration_str: Option<&str>) -> Option<u64> {
    let s = duration_str?;
    let parts: Vec<&str> = s.split(':').collect();
    match parts.len() {
        2 => {
            let mins: u64 = parts[0].parse().ok()?;
            let secs: u64 = parts[1].parse().ok()?;
            Some((mins * 60 + secs) * 1000)
        }
        3 => {
            let hours: u64 = parts[0].parse().ok()?;
            let mins: u64 = parts[1].parse().ok()?;
            let secs: u64 = parts[2].parse().ok()?;
            Some((hours * 3600 + mins * 60 + secs) * 1000)
        }
        _ => None,
    }
}
