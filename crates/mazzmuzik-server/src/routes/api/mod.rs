pub mod auth;
pub mod import;
pub mod library;
pub mod queue;
pub mod recommendations;
pub mod search;

use axum::routing::{get, post};
use axum::Router;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/setup", post(auth::setup_first_user))
        .route("/auth/login", post(auth::login))
        .route("/search", get(search::search_unified))
        .route("/import", post(import::import_playlist))
        .route("/queue", get(queue::list_queue))
        .route("/review", get(queue::list_manual_reviews))
        .route("/review/:id", post(queue::resolve_manual_review))
        .route("/library", get(library::get_stats))
        .route("/library/scan", post(library::trigger_scan))
        .route("/recommendations", get(recommendations::get_recommendations))
}
