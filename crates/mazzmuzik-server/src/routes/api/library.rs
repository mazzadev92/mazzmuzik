use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;
use std::path::Path;
use mazzmuzik_core::{normalize, LibraryScanner};
use mazzmuzik_db::{
    AlbumRepository, ArtistRepository, GenreRepository, Track, TrackRepository,
};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct LibraryStats {
    pub total_tracks: i64,
    pub total_artists: usize,
    pub total_albums: usize,
    pub music_dir: String,
}

pub async fn get_stats(State(state): State<AppState>) -> impl IntoResponse {
    let total_tracks = TrackRepository::count(&state.pool).await.unwrap_or(0);
    let artists = ArtistRepository::list_all(&state.pool).await.unwrap_or_default();
    let albums = AlbumRepository::list_all(&state.pool).await.unwrap_or_default();

    (
        StatusCode::OK,
        Json(LibraryStats {
            total_tracks,
            total_artists: artists.len(),
            total_albums: albums.len(),
            music_dir: state.config.library.music_dir.clone(),
        }),
    )
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub success: bool,
    pub scanned_files: usize,
    pub newly_added_tracks: usize,
}

pub async fn trigger_scan(State(state): State<AppState>) -> impl IntoResponse {
    let root = Path::new(&state.config.library.music_dir);
    let scanned = match LibraryScanner::scan_directory(root).await {
        Ok(s) => s,
        Err(_e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ScanResult {
                    success: false,
                    scanned_files: 0,
                    newly_added_tracks: 0,
                }),
            );
        }
    };

    let mut added = 0;
    for file in &scanned {
        // Vérifie si le fichier existe déjà par son chemin absolu
        let file_path_str = file.absolute_path.to_string_lossy().to_string();
        if let Ok(Some(_)) = TrackRepository::find_by_path(&state.pool, &file_path_str).await {
            continue;
        }

        // Créer l'artiste
        let artist_name = &file.metadata.artist;
        let norm_artist = normalize(artist_name);
        let artist = match ArtistRepository::get_or_create(&state.pool, artist_name, &norm_artist, None).await {
            Ok(a) => a,
            Err(_) => continue,
        };

        // Créer l'album (ou Singles)
        let album = match &file.metadata.album {
            Some(alb_title) => {
                let norm_album = normalize(alb_title);
                AlbumRepository::get_or_create(&state.pool, &artist.id, alb_title, &norm_album, None, file.metadata.release_year).await.ok()
            }
            None => {
                AlbumRepository::get_or_create_singles_album(&state.pool, &artist.id).await.ok()
            }
        };

        let norm_title = normalize(&file.metadata.title);
        let track_id = uuid::Uuid::new_v4().to_string();

        let track = Track {
            id: track_id.clone(),
            album_id: album.map(|a| a.id),
            artist_id: artist.id.clone(),
            title: file.metadata.title.clone(),
            normalized_title: norm_title,
            track_number: file.metadata.track_number.map(|n| n as i32),
            disc_number: file.metadata.disc_number.map(|n| n as i32),
            duration_ms: file.metadata.duration_ms as i64,
            isrc: file.metadata.isrc.clone(),
            mbid: file.metadata.mbid.clone(),
            file_path: file_path_str,
            file_size: file.file_size as i64,
            mime_type: file.mime_type.clone(),
            bitrate: Some(900),
            format: file.format.clone(),
            lrc_path: file.lrc_path.as_ref().map(|p| p.to_string_lossy().to_string()),
            audio_fingerprint: Some(file.fingerprint.clone()),
            play_count: 0,
            last_played_at: None,
            created_at: chrono::Utc::now().naive_utc(),
            updated_at: chrono::Utc::now().naive_utc(),
        };

        if let Ok(inserted) = TrackRepository::insert(&state.pool, &track).await {
            added += 1;
            for genre_name in &file.metadata.genres {
                if let Ok(genre) = GenreRepository::get_or_create(&state.pool, genre_name).await {
                    let _ = GenreRepository::link_track(&state.pool, &inserted.id, &genre.id).await;
                }
            }
        }
    }

    (
        StatusCode::OK,
        Json(ScanResult {
            success: true,
            scanned_files: scanned.len(),
            newly_added_tracks: added,
        }),
    )
}
