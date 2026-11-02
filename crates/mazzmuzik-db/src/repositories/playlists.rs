use uuid::Uuid;
use crate::entities::{Playlist, Track};
use crate::error::DbError;
use crate::pool::DbPool;

pub struct PlaylistRepository;

impl PlaylistRepository {
    pub async fn create(pool: &DbPool, name: &str, comment: Option<&str>) -> Result<Playlist, DbError> {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO playlists (id, name, comment) VALUES (?, ?, ?)"
        )
        .bind(&id)
        .bind(name)
        .bind(comment)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id).await
    }

    pub async fn find_by_id(pool: &DbPool, id: &str) -> Result<Playlist, DbError> {
        sqlx::query_as::<_, Playlist>("SELECT * FROM playlists WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Playlist id '{}' not found", id)))
    }

    pub async fn list_all(pool: &DbPool) -> Result<Vec<Playlist>, DbError> {
        let playlists = sqlx::query_as::<_, Playlist>(
            "SELECT * FROM playlists ORDER BY name ASC"
        )
        .fetch_all(pool)
        .await?;

        Ok(playlists)
    }

    pub async fn add_track(pool: &DbPool, playlist_id: &str, track_id: &str) -> Result<(), DbError> {
        let next_pos: (i32,) = sqlx::query_as(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?"
        )
        .bind(playlist_id)
        .fetch_one(pool)
        .await?;

        sqlx::query(
            "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)"
        )
        .bind(playlist_id)
        .bind(track_id)
        .bind(next_pos.0)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_tracks(pool: &DbPool, playlist_id: &str) -> Result<Vec<Track>, DbError> {
        let tracks = sqlx::query_as::<_, Track>(
            r#"SELECT t.* 
               FROM tracks t 
               JOIN playlist_tracks pt ON pt.track_id = t.id 
               WHERE pt.playlist_id = ? 
               ORDER BY pt.position ASC"#
        )
        .bind(playlist_id)
        .fetch_all(pool)
        .await?;

        Ok(tracks)
    }

    pub async fn delete(pool: &DbPool, id: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM playlists WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }
}
