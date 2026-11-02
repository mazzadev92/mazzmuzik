pub mod api;
pub mod subsonic;
pub mod web;

use axum::Router;
use crate::state::AppState;

pub fn app_router(state: AppState) -> Router {
    Router::new()
        .merge(web::router())
        .nest("/api", api::router())
        .nest("/rest", subsonic::router())
        .merge(subsonic::router())
        .with_state(state)
}
