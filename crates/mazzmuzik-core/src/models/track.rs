use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
    pub duration_ms: u64,
    pub release_year: Option<i32>,
    pub isrc: Option<String>,
    pub mbid: Option<String>,
    pub genres: Vec<String>,
    pub cover_image_bytes: Option<Vec<u8>>,
    pub cover_mime_type: Option<String>,
    pub synced_lyrics: Option<String>,
}
