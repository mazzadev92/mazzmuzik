use crate::entities::Track;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct TrackRepository;

impl TrackRepository {
    pub async fn insert(pool: &DbPool, track: &Track) -> Result<Track, DbError> {
        sqlx::query(
            r#"INSERT INTO tracks (
                id, album_id, artist_id, title, normalized_title, track_number,
                disc_number, duration_ms, isrc, mbid, file_path, file_size,
                mime_type, bitrate, format, lrc_path, audio_fingerprint,
                play_count, last_played_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&track.id)
        .bind(&track.album_id)
        .bind(&track.artist_id)
        .bind(&track.title)
        .bind(&track.normalized_title)
        .bind(track.track_number)
        .bind(track.disc_number)
        .bind(track.duration_ms)
        .bind(&track.isrc)
        .bind(&track.mbid)
        .bind(&track.file_path)
        .bind(track.file_size)
        .bind(&track.mime_type)
        .bind(track.bitrate)
        .bind(&track.format)
        .bind(&track.lrc_path)
        .bind(&track.audio_fingerprint)
        .bind(track.play_count)
        .bind(track.last_played_at)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &track.id).await
    }

    pub async fn find_by_id(pool: &DbPool, id: &str) -> Result<Track, DbError> {
        sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Track id '{}' not found", id)))
    }

    pub async fn find_by_path(pool: &DbPool, file_path: &str) -> Result<Option<Track>, DbError> {
        let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE file_path = ?")
            .bind(file_path)
            .fetch_optional(pool)
            .await?;
        Ok(track)
    }

    pub async fn find_by_fingerprint(pool: &DbPool, fingerprint: &str) -> Result<Option<Track>, DbError> {
        let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE audio_fingerprint = ?")
            .bind(fingerprint)
            .fetch_optional(pool)
            .await?;
        Ok(track)
    }

    pub async fn list_by_album(pool: &DbPool, album_id: &str) -> Result<Vec<Track>, DbError> {
        let tracks = sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks WHERE album_id = ? ORDER BY disc_number ASC, track_number ASC"
        )
        .bind(album_id)
        .fetch_all(pool)
        .await?;
        Ok(tracks)
    }

    pub async fn list_by_artist(pool: &DbPool, artist_id: &str) -> Result<Vec<Track>, DbError> {
        let tracks = sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks WHERE artist_id = ? ORDER BY title ASC"
        )
        .bind(artist_id)
        .fetch_all(pool)
        .await?;
        Ok(tracks)
    }

    pub async fn search(pool: &DbPool, query: &str, limit: i64) -> Result<Vec<Track>, DbError> {
        let pattern = format!("%{}%", query.to_lowercase());
        let tracks = sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks WHERE normalized_title LIKE ? ORDER BY play_count DESC LIMIT ?"
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(tracks)
    }

    pub async fn get_random_tracks(pool: &DbPool, limit: i64) -> Result<Vec<Track>, DbError> {
        let tracks = sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?"
        )
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(tracks)
    }

    pub async fn get_top_tracks(pool: &DbPool, limit: i64) -> Result<Vec<Track>, DbError> {
        let tracks = sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks ORDER BY play_count DESC, title ASC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(tracks)
    }

    pub async fn increment_play_count(pool: &DbPool, id: &str) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE tracks SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn count(pool: &DbPool) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks")
            .fetch_one(pool)
            .await?;
        Ok(count.0)
    }
}
