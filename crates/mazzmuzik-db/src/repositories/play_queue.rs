use crate::entities::{PlaybackHistoryEntry, UserPlayQueue};
use crate::error::DbError;
use crate::pool::DbPool;

pub struct PlayQueueRepository;

impl PlayQueueRepository {
    pub async fn save_queue(
        pool: &DbPool,
        user_id: &str,
        current_track_id: Option<&str>,
        position_ms: i64,
        queue_json: &str,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO user_play_queue (user_id, current_track_id, position_ms, queue_json, changed_at)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(user_id) DO UPDATE SET
                   current_track_id = excluded.current_track_id,
                   position_ms = excluded.position_ms,
                   queue_json = excluded.queue_json,
                   changed_at = CURRENT_TIMESTAMP"#
        )
        .bind(user_id)
        .bind(current_track_id)
        .bind(position_ms)
        .bind(queue_json)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_queue(pool: &DbPool, user_id: &str) -> Result<Option<UserPlayQueue>, DbError> {
        let queue = sqlx::query_as::<_, UserPlayQueue>(
            "SELECT * FROM user_play_queue WHERE user_id = ?"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        Ok(queue)
    }

    pub async fn record_playback(
        pool: &DbPool,
        user_id: Option<&str>,
        track_id: &str,
        duration_played_ms: i64,
        client: Option<&str>,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"INSERT INTO playback_history (user_id, track_id, duration_played_ms, submission_client)
               VALUES (?, ?, ?, ?)"#
        )
        .bind(user_id)
        .bind(track_id)
        .bind(duration_played_ms)
        .bind(client)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_history(
        pool: &DbPool,
        limit: i64,
    ) -> Result<Vec<PlaybackHistoryEntry>, DbError> {
        let history = sqlx::query_as::<_, PlaybackHistoryEntry>(
            "SELECT * FROM playback_history ORDER BY played_at DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }
}
