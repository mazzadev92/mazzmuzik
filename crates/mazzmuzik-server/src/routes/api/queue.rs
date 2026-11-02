use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use mazzmuzik_db::QueueRepository;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct AddToQueuePayload {
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveReviewPayload {
    pub approved: bool,
    pub selected_candidate_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SimpleStatusResponse {
    pub success: bool,
    pub message: String,
}

pub async fn list_queue(State(state): State<AppState>) -> impl IntoResponse {
    match QueueRepository::list_all(&state.pool).await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SimpleStatusResponse {
                success: false,
                message: e.to_string(),
            }),
        ).into_response(),
    }
}

pub async fn list_manual_reviews(State(state): State<AppState>) -> impl IntoResponse {
    match QueueRepository::list_pending_manual_reviews(&state.pool).await {
        Ok(items) => (StatusCode::OK, Json(items)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SimpleStatusResponse {
                success: false,
                message: e.to_string(),
            }),
        ).into_response(),
    }
}

pub async fn resolve_manual_review(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ResolveReviewPayload>,
) -> impl IntoResponse {
    match QueueRepository::resolve_manual_review(
        &state.pool,
        &id,
        payload.approved,
        payload.selected_candidate_id.as_deref(),
    ).await {
        Ok(()) => (
            StatusCode::OK,
            Json(SimpleStatusResponse {
                success: true,
                message: if payload.approved {
                    "Candidate approved. Queued for download.".to_string()
                } else {
                    "Review rejected.".to_string()
                },
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SimpleStatusResponse {
                success: false,
                message: e.to_string(),
            }),
        ),
    }
}

pub async fn add_to_queue(
    State(state): State<AppState>,
    Json(payload): Json<AddToQueuePayload>,
) -> impl IntoResponse {
    let clean_title = payload.title.trim();
    if clean_title.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(SimpleStatusResponse {
                success: false,
                message: "Title cannot be empty".to_string(),
            }),
        );
    }
    let artist = payload.artist.as_deref().unwrap_or("Artiste inconnu");
    let preferred_format = &state.config.library.preferred_format;

    match QueueRepository::push(
        &state.pool,
        clean_title,
        artist,
        payload.album.as_deref(),
        preferred_format,
        0,
    ).await {
        Ok(item) => (
            StatusCode::OK,
            Json(SimpleStatusResponse {
                success: true,
                message: format!("Ajouté à la file de téléchargement : {} - {} (id: {})", artist, clean_title, item.id),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SimpleStatusResponse {
                success: false,
                message: e.to_string(),
            }),
        ),
    }
}
