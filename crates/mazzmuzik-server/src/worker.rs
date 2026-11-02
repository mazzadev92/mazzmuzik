use std::path::Path;
use std::time::Duration;
use tracing::{error, info};
use mazzmuzik_core::{normalize, ProcessOutcome, TrackQuery};
use mazzmuzik_db::{
    AlbumRepository, ArtistRepository, GenreRepository, QueueRepository, Track, TrackRepository,
};
use crate::state::AppState;

pub fn spawn_queue_worker(state: AppState) {
    tokio::spawn(async move {
        info!("Starting Mazz MuZik download queue worker loop");
        loop {
            // Cherche le prochain élément en attente
            match QueueRepository::pop_next_pending(&state.pool).await {
                Ok(Some(item)) => {
                    info!("Queue worker picked item: '{}' by '{}' (id: {})", item.query_title, item.query_artist, item.id);

                    // Mettre à jour en 'resolving'
                    let _ = QueueRepository::update_status(&state.pool, &item.id, "resolving", 0.1, None, None).await;

                    let query = TrackQuery {
                        title: item.query_title.clone(),
                        artist: item.query_artist.clone(),
                        album: item.query_album.clone(),
                        duration_ms: None,
                        isrc: None,
                        mbid: None,
                    };

                    let music_dir = Path::new(&state.config.library.music_dir);
                    let temp_dir = music_dir.join(".temp");

                    match state.processor.process_job(&query, music_dir, &temp_dir).await {
                        Ok(ProcessOutcome::Completed(track)) => {
                            info!("Successfully downloaded and processed: {:?}", track.file_path);

                            // Enregistrement en base de données SQLite
                            match record_completed_track(&state, &track).await {
                                Ok(db_track) => {
                                    let _ = QueueRepository::update_status(
                                        &state.pool,
                                        &item.id,
                                        "completed",
                                        1.0,
                                        None,
                                        Some(&db_track.id),
                                    ).await;
                                }
                                Err(e) => {
                                    error!("Failed to save completed track to DB: {}", e);
                                    let _ = QueueRepository::update_status(
                                        &state.pool,
                                        &item.id,
                                        "failed",
                                        0.0,
                                        Some(&format!("Database save error: {}", e)),
                                        None,
                                    ).await;
                                }
                            }
                        }
                        Ok(ProcessOutcome::NeedsManualReview(candidates)) => {
                            info!("Item '{}' requires manual review ({} candidates)", item.query_title, candidates.len());
                            let candidates_json = serde_json::to_string(&candidates).unwrap_or_default();
                            let _ = QueueRepository::push_manual_review(
                                &state.pool,
                                &item.id,
                                &item.query_title,
                                &item.query_artist,
                                None,
                                &candidates_json,
                            ).await;
                        }
                        Ok(ProcessOutcome::Failed(msg)) => {
                            error!("Job failed: {}", msg);
                            let _ = QueueRepository::update_status(
                                &state.pool,
                                &item.id,
                                "failed",
                                0.0,
                                Some(&msg),
                                None,
                            ).await;
                        }
                        Err(err) => {
                            error!("Unexpected processor error: {}", err);
                            let _ = QueueRepository::update_status(
                                &state.pool,
                                &item.id,
                                "failed",
                                0.0,
                                Some(&err.to_string()),
                                None,
                            ).await;
                        }
                    }
                }
                Ok(None) => {
                    // Aucun élément en attente : veille brève
                    tokio::time::sleep(Duration::from_millis(800)).await;
                }
                Err(e) => {
                    error!("Error polling download queue: {}", e);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        }
    });
}

async fn record_completed_track(
    state: &AppState,
    processed: &mazzmuzik_core::ProcessedTrack,
) -> Result<Track, mazzmuzik_db::DbError> {
    // 1. Artiste
    let artist_name = &processed.metadata.artist;
    let norm_artist = normalize(artist_name);
    let artist = ArtistRepository::get_or_create(
        &state.pool,
        artist_name,
        &norm_artist,
        processed.metadata.mbid.as_deref(),
    ).await?;

    // 2. Album (ou Singles si None)
    let album = match &processed.metadata.album {
        Some(alb_title) => {
            let norm_album = normalize(alb_title);
            Some(AlbumRepository::get_or_create(
                &state.pool,
                &artist.id,
                alb_title,
                &norm_album,
                None,
                processed.metadata.release_year,
            ).await?)
        }
        None => {
            Some(AlbumRepository::get_or_create_singles_album(&state.pool, &artist.id).await?)
        }
    };

    // 3. Piste (Track)
    let norm_title = normalize(&processed.metadata.title);
    let track_id = uuid::Uuid::new_v4().to_string();

    let track = Track {
        id: track_id.clone(),
        album_id: album.map(|a| a.id),
        artist_id: artist.id.clone(),
        title: processed.metadata.title.clone(),
        normalized_title: norm_title,
        track_number: processed.metadata.track_number.map(|n| n as i32),
        disc_number: processed.metadata.disc_number.map(|n| n as i32),
        duration_ms: processed.duration_ms as i64,
        isrc: processed.metadata.isrc.clone(),
        mbid: processed.metadata.mbid.clone(),
        file_path: processed.file_path.to_string_lossy().to_string(),
        file_size: processed.file_size as i64,
        mime_type: processed.mime_type.clone(),
        bitrate: Some(900),
        format: processed.format.clone(),
        lrc_path: processed.lrc_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        audio_fingerprint: Some(processed.fingerprint.clone()),
        play_count: 0,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };

    let inserted = TrackRepository::insert(&state.pool, &track).await?;

    // 4. Genres
    for genre_name in &processed.metadata.genres {
        if let Ok(genre) = GenreRepository::get_or_create(&state.pool, genre_name).await {
            let _ = GenreRepository::link_track(&state.pool, &inserted.id, &genre.id).await;
        }
    }

    Ok(inserted)
}
