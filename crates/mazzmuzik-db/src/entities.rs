use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub normalized_name: String,
    pub mbid: Option<String>,
    pub bio: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Album {
    pub id: String,
    pub artist_id: String,
    pub title: String,
    pub normalized_title: String,
    pub mbid: Option<String>,
    pub release_year: Option<i32>,
    pub cover_path: Option<String>,
    pub total_tracks: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Track {
    pub id: String,
    pub album_id: Option<String>,
    pub artist_id: String,
    pub title: String,
    pub normalized_title: String,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub duration_ms: i64,
    pub isrc: Option<String>,
    pub mbid: Option<String>,
    pub file_path: String,
    pub file_size: i64,
    pub mime_type: String,
    pub bitrate: Option<i32>,
    pub format: String,
    pub lrc_path: Option<String>,
    pub audio_fingerprint: Option<String>,
    pub play_count: i32,
    pub last_played_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Genre {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ResolutionCacheEntry {
    pub id: i64,
    pub query_hash: String,
    pub source_provider: String,
    pub external_id: String,
    pub external_url: String,
    pub resolved_title: String,
    pub resolved_artist: String,
    pub resolved_duration_ms: i64,
    pub confidence_score: f64,
    pub payload_json: Option<String>,
    pub expires_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DownloadQueueItem {
    pub id: String,
    pub query_title: String,
    pub query_artist: String,
    pub query_album: Option<String>,
    pub preferred_format: String,
    pub status: String,
    pub priority: i32,
    pub confidence_score: Option<f64>,
    pub chosen_provider: Option<String>,
    pub external_id: Option<String>,
    pub external_url: Option<String>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub error_message: Option<String>,
    pub download_progress: f64,
    pub track_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ManualReviewItem {
    pub id: String,
    pub queue_id: String,
    pub query_title: String,
    pub query_artist: String,
    pub query_duration_ms: Option<i64>,
    pub candidates_json: String,
    pub selected_candidate_id: Option<String>,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub comment: Option<String>,
    pub is_public: bool,
    pub cover_path: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlaylistTrack {
    pub id: i64,
    pub playlist_id: String,
    pub track_id: String,
    pub position: i32,
    pub added_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Favorite {
    pub id: i64,
    pub user_id: String,
    pub item_type: String,
    pub item_id: String,
    pub starred_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlaybackHistoryEntry {
    pub id: i64,
    pub user_id: Option<String>,
    pub track_id: String,
    pub played_at: NaiveDateTime,
    pub duration_played_ms: i64,
    pub submission_client: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserPlayQueue {
    pub user_id: String,
    pub current_track_id: Option<String>,
    pub position_ms: i64,
    pub queue_json: String,
    pub changed_at: NaiveDateTime,
}
