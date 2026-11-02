use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use mazzmuzik_db::{GenreRepository, Track, TrackRepository};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RecsQuery {
    pub track_id: String,
    pub limit: Option<i64>,
}

pub async fn get_recommendations(
    State(state): State<AppState>,
    Query(params): Query<RecsQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10);
    let similar_ids = match GenreRepository::find_similar_tracks_by_genre(&state.pool, &params.track_id, limit).await {
        Ok(ids) => ids,
        Err(_) => vec![],
    };

    let mut tracks: Vec<Track> = Vec::new();
    for id in similar_ids {
        if let Ok(t) = TrackRepository::find_by_id(&state.pool, &id).await {
            tracks.push(t);
        }
    }

    (StatusCode::OK, Json(tracks))
}
