use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MatchCandidate {
    pub provider: String,
    pub external_id: String,
    pub external_url: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: u64,
    pub confidence_score: f64,
    pub direct_stream_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackQuery {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<u64>,
    pub isrc: Option<String>,
    pub mbid: Option<String>,
}
