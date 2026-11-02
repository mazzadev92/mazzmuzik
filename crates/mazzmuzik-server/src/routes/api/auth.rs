use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use mazzmuzik_db::UserRepository;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct AuthPayload {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub user_id: Option<String>,
    pub username: Option<String>,
    pub message: String,
}

/// Endpoint de configuration du premier utilisateur au démarrage si la table est vide (Passe 1.3)
pub async fn setup_first_user(
    State(state): State<AppState>,
    Json(payload): Json<AuthPayload>,
) -> impl IntoResponse {
    let count = match UserRepository::count(&state.pool).await {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    success: false,
                    user_id: None,
                    username: None,
                    message: format!("Database error: {}", e),
                }),
            );
        }
    };

    if count > 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                user_id: None,
                username: None,
                message: "Setup already completed. Users exist.".to_string(),
            }),
        );
    }

    match UserRepository::create_user(&state.pool, &payload.username, &payload.password).await {
        Ok(user) => (
            StatusCode::CREATED,
            Json(AuthResponse {
                success: true,
                user_id: Some(user.id),
                username: Some(user.username),
                message: "First administrator user successfully created.".to_string(),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthResponse {
                success: false,
                user_id: None,
                username: None,
                message: format!("Failed to create user: {}", e),
            }),
        ),
    }
}

/// Authentification locale par mot de passe (vérification Argon2id)
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<AuthPayload>,
) -> impl IntoResponse {
    let user = match UserRepository::find_by_username(&state.pool, &payload.username).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthResponse {
                    success: false,
                    user_id: None,
                    username: None,
                    message: "Invalid credentials".to_string(),
                }),
            );
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    success: false,
                    user_id: None,
                    username: None,
                    message: format!("Database error: {}", e),
                }),
            );
        }
    };

    match UserRepository::verify_password(&payload.password, &user.password_hash) {
        Ok(true) => (
            StatusCode::OK,
            Json(AuthResponse {
                success: true,
                user_id: Some(user.id),
                username: Some(user.username),
                message: "Login successful".to_string(),
            }),
        ),
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(AuthResponse {
                success: false,
                user_id: None,
                username: None,
                message: "Invalid credentials".to_string(),
            }),
        ),
    }
}
