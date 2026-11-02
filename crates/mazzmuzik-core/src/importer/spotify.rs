use regex::Regex;
use reqwest::Client;
use serde_json::Value;
use std::sync::LazyLock;
use crate::error::CoreError;
use crate::models::{ImportedPlaylist, TrackQuery};

static SPOTIFY_ID_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"playlist[/:]+([a-zA-Z0-9]+)").unwrap()
});

pub struct SpotifyPlaylistImporter {
    client: Client,
}

impl Default for SpotifyPlaylistImporter {
    fn default() -> Self {
        Self::new()
    }
}

impl SpotifyPlaylistImporter {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    /// Extrait l'ID de playlist Spotify depuis l'URL
    pub fn extract_playlist_id(url: &str) -> Option<String> {
        SPOTIFY_ID_REGEX.captures(url).and_then(|c| c.get(1)).map(|m| m.as_str().to_string())
    }

    /// Importe une playlist publique Spotify de manière 100% anonyme (sans compte ni token privé)
    pub async fn import_from_url(&self, url: &str) -> Result<ImportedPlaylist, CoreError> {
        let playlist_id = Self::extract_playlist_id(url).ok_or_else(|| {
            CoreError::Resolver(format!("Invalid Spotify playlist URL: {}", url))
        })?;

        let page_url = format!("https://open.spotify.com/playlist/{}", playlist_id);
        let resp = self.client.get(&page_url).send().await.map_err(CoreError::Network)?;

        if !resp.status().is_success() {
            return Err(CoreError::Resolver(format!("Spotify returned HTTP {}", resp.status())));
        }

        let html = resp.text().await.map_err(CoreError::Network)?;

        // Récupération du titre de la playlist via balise <title> ou oEmbed
        let title_re = Regex::new(r"<title>([^<]+)</title>").unwrap();
        let playlist_title = title_re.captures(&html)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().replace(" - playlist by Spotify", "").replace(" | Spotify", "").trim().to_string())
            .unwrap_or_else(|| "Spotify Playlist".to_string());

        let mut tracks = Vec::new();

        // Extraction des morceaux depuis les balises méta et scripts JSON intégrés
        // Spotify injecte les données dans <script id="__NEXT_DATA__" type="application/json">
        let script_re = Regex::new(r#"<script id="__NEXT_DATA__" type="application/json">([^<]+)</script>"#).unwrap();
        if let Some(caps) = script_re.captures(&html) {
            if let Some(json_str) = caps.get(1) {
                if let Ok(json) = serde_json::from_str::<Value>(json_str.as_str()) {
                    if let Some(track_list) = json.pointer("/props/pageProps/state/data/entity/trackList").and_then(|t| t.as_array()) {
                        for item in track_list {
                            if let (Some(title), Some(subtitle)) = (
                                item.get("title").and_then(|t| t.as_str()),
                                item.get("subtitle").and_then(|s| s.as_str()),
                            ) {
                                let duration = item.get("duration").and_then(|d| d.as_u64());

                                tracks.push(TrackQuery {
                                    title: title.to_string(),
                                    artist: subtitle.to_string(),
                                    album: None,
                                    duration_ms: duration,
                                    isrc: None,
                                    mbid: None,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Fallback par regex sur les balises de pistes Spotify si __NEXT_DATA__ a été refactoré
        if tracks.is_empty() {
            let meta_music_re = Regex::new(r#""name":\s*"([^"]+)",\s*"artists":\s*\[\{"name":\s*"([^"]+)""#).unwrap();
            for caps in meta_music_re.captures_iter(&html) {
                if let (Some(t), Some(a)) = (caps.get(1), caps.get(2)) {
                    tracks.push(TrackQuery {
                        title: t.as_str().to_string(),
                        artist: a.as_str().to_string(),
                        album: None,
                        duration_ms: None,
                        isrc: None,
                        mbid: None,
                    });
                }
            }
        }

        Ok(ImportedPlaylist {
            name: playlist_title,
            source: "spotify".to_string(),
            tracks,
        })
    }
}
