use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use mazzmuzik_core::{MatchCandidate, TrackQuery};
use mazzmuzik_db::{Track, TrackRepository};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub q: String,
    pub remote: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct UnifiedSearchResult {
    pub query: String,
    pub local_tracks: Vec<Track>,
    pub remote_candidates: Vec<MatchCandidate>,
}

pub async fn search_unified(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    let clean_query = params.q.trim();
    if clean_query.is_empty() {
        return (
            StatusCode::OK,
            Json(UnifiedSearchResult {
                query: "".to_string(),
                local_tracks: vec![],
                remote_candidates: vec![],
            }),
        );
    }

    // 1. Recherche locale dans la bibliothèque SQLite
    let local = TrackRepository::search(&state.pool, clean_query, 20).await.unwrap_or_default();

    // 2. Recherche distante en cascade optionnelle
    let mut remote = Vec::new();
    if params.remote.unwrap_or(false) {
        let tq = TrackQuery {
            title: clean_query.to_string(),
            artist: "".to_string(),
            album: None,
            duration_ms: None,
            isrc: None,
            mbid: None,
        };
        if let Ok(res) = state.resolver.resolve(&tq).await {
            match res {
                mazzmuzik_core::CascadeResult::Resolved(best) => remote.push(best),
                mazzmuzik_core::CascadeResult::NeedsReview(candidates) => remote.extend(candidates),
                _ => {}
            }
        }
    }

    (
        StatusCode::OK,
        Json(UnifiedSearchResult {
            query: clean_query.to_string(),
            local_tracks: local,
            remote_candidates: remote,
        }),
    )
}
