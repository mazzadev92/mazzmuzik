use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Redirect, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct LiveStreamParams {
    pub q: String,
}

#[derive(Debug, Serialize)]
pub struct StreamUrlResponse {
    pub success: bool,
    pub stream_url: Option<String>,
    pub query: String,
    pub message: Option<String>,
}

/// GET /api/stream/live?q=...
/// Redirige immédiatement le lecteur vers le flux audio direct extrait par yt-dlp
pub async fn stream_live(
    State(state): State<AppState>,
    Query(params): Query<LiveStreamParams>,
) -> Response {
    let clean_query = params.q.trim();
    if clean_query.is_empty() {
        return (StatusCode::BAD_REQUEST, "Query cannot be empty").into_response();
    }

    match state.downloader.get_stream_url(clean_query).await {
        Ok(url) => Redirect::temporary(&url).into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            format!("Live stream resolution error: {}", e),
        ).into_response(),
    }
}

/// GET /api/stream/url?q=...
/// Renvoie l'URL du flux audio direct au format JSON pour les clients applicatifs
pub async fn get_stream_url(
    State(state): State<AppState>,
    Query(params): Query<LiveStreamParams>,
) -> impl IntoResponse {
    let clean_query = params.q.trim();
    if clean_query.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(StreamUrlResponse {
                success: false,
                stream_url: None,
                query: "".to_string(),
                message: Some("Query cannot be empty".to_string()),
            }),
        );
    }

    match state.downloader.get_stream_url(clean_query).await {
        Ok(url) => (
            StatusCode::OK,
            Json(StreamUrlResponse {
                success: true,
                stream_url: Some(url),
                query: clean_query.to_string(),
                message: None,
            }),
        ),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(StreamUrlResponse {
                success: false,
                stream_url: None,
                query: clean_query.to_string(),
                message: Some(e.to_string()),
            }),
        ),
    }
}
