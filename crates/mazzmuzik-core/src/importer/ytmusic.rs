use regex::Regex;
use reqwest::Client;
use serde_json::Value;
use std::sync::LazyLock;
use crate::error::CoreError;
use crate::models::{ImportedPlaylist, TrackQuery};

static YT_LIST_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[?&]list=([a-zA-Z0-9_-]+)").unwrap()
});

pub struct YtMusicPlaylistImporter {
    client: Client,
}

impl Default for YtMusicPlaylistImporter {
    fn default() -> Self {
        Self::new()
    }
}

impl YtMusicPlaylistImporter {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    pub fn extract_playlist_id(url: &str) -> Option<String> {
        YT_LIST_REGEX.captures(url).and_then(|c| c.get(1)).map(|m| m.as_str().to_string())
    }

    /// Importe une playlist publique YouTube / YouTube Music de manière anonyme
    pub async fn import_from_url(&self, url: &str) -> Result<ImportedPlaylist, CoreError> {
        let list_id = Self::extract_playlist_id(url).ok_or_else(|| {
            CoreError::Resolver(format!("Invalid YouTube/YT Music playlist URL: {}", url))
        })?;

        let browse_id = if list_id.starts_with("VL") {
            list_id.clone()
        } else {
            format!("VL{}", list_id)
        };

        let api_url = "https://music.youtube.com/youtubei/v1/browse";
        let body = serde_json::json!({
            "context": {
                "client": {
                    "clientName": "WEB_REMIX",
                    "clientVersion": "1.20240722.01.00",
                    "hl": "en",
                    "gl": "US"
                }
            },
            "browseId": browse_id
        });

        let resp = self.client.post(api_url)
            .header("Content-Type", "application/json")
            .header("Referer", "https://music.youtube.com/")
            .json(&body)
            .send()
            .await
            .map_err(CoreError::Network)?;

        let mut tracks = Vec::new();
        let mut playlist_name = "YouTube Music Playlist".to_string();

        if resp.status().is_success() {
            if let Ok(json) = resp.json::<Value>().await {
                if let Some(header_title) = json.pointer("/header/musicDetailHeaderRenderer/title/runs/0/text").and_then(|t| t.as_str()) {
                    playlist_name = header_title.to_string();
                }

                if let Some(contents) = json.pointer("/contents/singleColumnBrowseResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents/0/musicPlaylistShelfRenderer/contents")
                    .and_then(|c| c.as_array()) {
                    for item in contents {
                        if let Some(r) = item.get("musicResponsiveListItemRenderer") {
                            let title = r.pointer("/flexColumns/0/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
                                .and_then(|t| t.as_str());
                            let artist = r.pointer("/flexColumns/1/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
                                .and_then(|a| a.as_str());

                            if let (Some(t), Some(a)) = (title, artist) {
                                tracks.push(TrackQuery {
                                    title: t.to_string(),
                                    artist: a.to_string(),
                                    album: None,
                                    duration_ms: None,
                                    isrc: None,
                                    mbid: None,
                                });
                            }
                        }
                    }
                }
            }
        }

        Ok(ImportedPlaylist {
            name: playlist_name,
            source: "ytmusic".to_string(),
            tracks,
        })
    }
}
