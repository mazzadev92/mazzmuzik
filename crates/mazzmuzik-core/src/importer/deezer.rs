use reqwest::Client;
use serde_json::Value;
use crate::error::CoreError;
use crate::models::{ImportedPlaylist, TrackQuery};

pub struct DeezerPlaylistImporter {
    client: Client,
}

impl Default for DeezerPlaylistImporter {
    fn default() -> Self {
        Self::new()
    }
}

impl DeezerPlaylistImporter {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("MazzMuZik/0.1")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    /// Extrait l'identifiant Deezer depuis une URL de type https://www.deezer.com/playlist/123456
    pub fn extract_playlist_id(url: &str) -> Option<String> {
        let clean = url.trim();
        if let Some(pos) = clean.find("/playlist/") {
            let after = &clean[pos + 10..];
            let id: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if !id.is_empty() {
                return Some(id);
            }
        }
        if clean.chars().all(|c| c.is_ascii_digit()) && !clean.is_empty() {
            return Some(clean.to_string());
        }
        None
    }

    /// Importe une playlist publique Deezer de manière anonyme
    pub async fn import_from_url(&self, url: &str) -> Result<ImportedPlaylist, CoreError> {
        let id = Self::extract_playlist_id(url).ok_or_else(|| {
            CoreError::Resolver(format!("Invalid Deezer playlist URL: {}", url))
        })?;

        let api_url = format!("https://api.deezer.com/playlist/{}", id);
        let resp = self.client.get(&api_url).send().await.map_err(CoreError::Network)?;

        if !resp.status().is_success() {
            return Err(CoreError::Resolver(format!("Deezer API returned HTTP {}", resp.status())));
        }

        let json: Value = resp.json().await.map_err(CoreError::Network)?;

        let playlist_title = json.get("title")
            .and_then(|t| t.as_str())
            .unwrap_or("Deezer Playlist")
            .to_string();

        let mut tracks = Vec::new();
        if let Some(track_list) = json.pointer("/tracks/data").and_then(|d| d.as_array()) {
            for item in track_list {
                if let (Some(title), Some(artist)) = (
                    item.get("title").and_then(|t| t.as_str()),
                    item.pointer("/artist/name").and_then(|a| a.as_str()),
                ) {
                    let album = item.pointer("/album/title").and_then(|a| a.as_str()).map(|s| s.to_string());
                    let duration_ms = item.get("duration").and_then(|d| d.as_u64()).map(|s| s * 1000);
                    let isrc = item.get("isrc").and_then(|i| i.as_str()).map(|s| s.to_string());

                    tracks.push(TrackQuery {
                        title: title.to_string(),
                        artist: artist.to_string(),
                        album,
                        duration_ms,
                        isrc,
                        mbid: None,
                    });
                }
            }
        }

        Ok(ImportedPlaylist {
            name: playlist_title,
            source: "deezer".to_string(),
            tracks,
        })
    }
}
