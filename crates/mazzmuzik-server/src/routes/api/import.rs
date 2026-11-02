use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use mazzmuzik_core::FilePlaylistImporter;
use mazzmuzik_db::QueueRepository;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ImportRequest {
    pub url: Option<String>,
    pub csv_content: Option<String>,
    pub m3u_content: Option<String>,
    pub playlist_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportResponse {
    pub success: bool,
    pub playlist_name: String,
    pub queued_tracks_count: usize,
    pub message: String,
}

pub async fn import_playlist(
    State(state): State<AppState>,
    Json(payload): Json<ImportRequest>,
) -> impl IntoResponse {
    let name_fallback = payload.playlist_name.unwrap_or_else(|| "Imported Playlist".to_string());

    let imported = if let Some(url) = &payload.url {
        match state.importer.import_from_url(url).await {
            Ok(pl) => pl,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ImportResponse {
                        success: false,
                        playlist_name: name_fallback,
                        queued_tracks_count: 0,
                        message: format!("Failed to import from URL: {}", e),
                    }),
                );
            }
        }
    } else if let Some(csv) = &payload.csv_content {
        match FilePlaylistImporter::parse_csv(csv, &name_fallback) {
            Ok(pl) => pl,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ImportResponse {
                        success: false,
                        playlist_name: name_fallback,
                        queued_tracks_count: 0,
                        message: format!("Failed to parse CSV: {}", e),
                    }),
                );
            }
        }
    } else if let Some(m3u) = &payload.m3u_content {
        match FilePlaylistImporter::parse_m3u(m3u, &name_fallback) {
            Ok(pl) => pl,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ImportResponse {
                        success: false,
                        playlist_name: name_fallback,
                        queued_tracks_count: 0,
                        message: format!("Failed to parse M3U: {}", e),
                    }),
                );
            }
        }
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(ImportResponse {
                success: false,
                playlist_name: name_fallback,
                queued_tracks_count: 0,
                message: "No url, csv_content, or m3u_content provided".to_string(),
            }),
        );
    };

    let mut count = 0;
    for track in &imported.tracks {
        let preferred_format = &state.config.library.preferred_format;
        if let Ok(_) = QueueRepository::push(
            &state.pool,
            &track.title,
            &track.artist,
            track.album.as_deref(),
            preferred_format,
            0,
        ).await {
            count += 1;
        }
    }

    (
        StatusCode::OK,
        Json(ImportResponse {
            success: true,
            playlist_name: imported.name,
            queued_tracks_count: count,
            message: format!("Successfully added {} tracks to download queue", count),
        }),
    )
}
