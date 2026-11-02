use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{info, warn};
use crate::error::CoreError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonicalMetadata {
    pub mbid: Option<String>,
    pub title: String,
    pub artist: String,
    pub artist_mbid: Option<String>,
    pub album: Option<String>,
    pub album_mbid: Option<String>,
    pub release_year: Option<i32>,
    pub isrc: Option<String>,
    pub track_number: Option<u32>,
    pub genres: Vec<String>,
}

pub struct MusicBrainzClient {
    client: Client,
}

impl Default for MusicBrainzClient {
    fn default() -> Self {
        Self::new("MazzMuZik/0.1 ( https://github.com/mazzmuzik/mazzmuzik )")
    }
}

impl MusicBrainzClient {
    pub fn new(user_agent: &str) -> Self {
        let client = Client::builder()
            .user_agent(user_agent)
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// Recherche les métadonnées canoniques d'un morceau sur MusicBrainz
    pub async fn fetch_canonical(
        &self,
        artist: &str,
        title: &str,
    ) -> Result<Option<CanonicalMetadata>, CoreError> {
        let clean_artist = artist.replace('"', "");
        let clean_title = title.replace('"', "");
        let query_str = format!("artist:\"{}\" AND recording:\"{}\"", clean_artist, clean_title);

        let url = format!(
            "https://musicbrainz.org/ws/2/recording/?query={}&fmt=json&limit=3",
            urlencoding::encode(&query_str)
        );

        let resp = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                warn!("MusicBrainz request error: {}", e);
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

        if let Some(recordings) = json.get("recordings").and_then(|r| r.as_array()) {
            if let Some(rec) = recordings.first() {
                let mbid = rec.get("id").and_then(|id| id.as_str()).map(|s| s.to_string());
                let rec_title = rec.get("title").and_then(|t| t.as_str()).unwrap_or(title).to_string();

                let mut artist_name = artist.to_string();
                let mut artist_mbid = None;
                if let Some(credit) = rec.pointer("/artist-credit/0/artist") {
                    if let Some(n) = credit.get("name").and_then(|n| n.as_str()) {
                        artist_name = n.to_string();
                    }
                    artist_mbid = credit.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());
                }

                let mut album_title = None;
                let mut album_mbid = None;
                let mut release_year = None;
                let track_number = None;

                if let Some(releases) = rec.get("releases").and_then(|r| r.as_array()) {
                    if let Some(rel) = releases.first() {
                        album_title = rel.get("title").and_then(|t| t.as_str()).map(|s| s.to_string());
                        album_mbid = rel.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());
                        if let Some(date) = rel.get("date").and_then(|d| d.as_str()) {
                            if date.len() >= 4 {
                                release_year = date[..4].parse::<i32>().ok();
                            }
                        }
                    }
                }

                let mut isrc = None;
                if let Some(isrcs) = rec.get("isrcs").and_then(|i| i.as_array()) {
                    if let Some(first_isrc) = isrcs.first().and_then(|s| s.as_str()) {
                        isrc = Some(first_isrc.to_string());
                    }
                }

                let mut genres = Vec::new();
                if let Some(tags) = rec.get("tags").and_then(|t| t.as_array()) {
                    for tag in tags.iter().take(5) {
                        if let Some(tag_name) = tag.get("name").and_then(|n| n.as_str()) {
                            genres.push(tag_name.to_string());
                        }
                    }
                }

                info!("MusicBrainz canonical match: '{}' by '{}' (MBID: {:?})", rec_title, artist_name, mbid);

                return Ok(Some(CanonicalMetadata {
                    mbid,
                    title: rec_title,
                    artist: artist_name,
                    artist_mbid,
                    album: album_title,
                    album_mbid,
                    release_year,
                    isrc,
                    track_number,
                    genres,
                }));
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
