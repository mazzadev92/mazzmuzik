use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use mazzmuzik_db::QueueRepository;
use crate::state::AppState;

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
