use uuid::Uuid;
use crate::entities::{DownloadQueueItem, ManualReviewItem};
use crate::error::DbError;
use crate::pool::DbPool;

pub struct QueueRepository;

impl QueueRepository {
    pub async fn push(
        pool: &DbPool,
        title: &str,
        artist: &str,
        album: Option<&str>,
        preferred_format: &str,
        priority: i32,
    ) -> Result<DownloadQueueItem, DbError> {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"INSERT INTO download_queue (
                id, query_title, query_artist, query_album, preferred_format,
                status, priority
            ) VALUES (?, ?, ?, ?, ?, 'pending', ?)"#
        )
        .bind(&id)
        .bind(title)
        .bind(artist)
        .bind(album)
        .bind(preferred_format)
        .bind(priority)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id).await
    }

    pub async fn find_by_id(pool: &DbPool, id: &str) -> Result<DownloadQueueItem, DbError> {
        sqlx::query_as::<_, DownloadQueueItem>(
            "SELECT * FROM download_queue WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| DbError::NotFound(format!("Queue item '{}' not found", id)))
    }

    pub async fn pop_next_pending(pool: &DbPool) -> Result<Option<DownloadQueueItem>, DbError> {
        let item = sqlx::query_as::<_, DownloadQueueItem>(
            r#"SELECT * FROM download_queue 
               WHERE status = 'pending' 
               ORDER BY priority DESC, created_at ASC 
               LIMIT 1"#
        )
        .fetch_optional(pool)
        .await?;

        Ok(item)
    }

    pub async fn update_status(
        pool: &DbPool,
        id: &str,
        status: &str,
        progress: f64,
        error_message: Option<&str>,
        track_id: Option<&str>,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"UPDATE download_queue SET 
                status = ?, 
                download_progress = ?, 
                error_message = ?, 
                track_id = ?, 
                updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?"#
        )
        .bind(status)
        .bind(progress)
        .bind(error_message)
        .bind(track_id)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn mark_resolved(
        pool: &DbPool,
        id: &str,
        confidence_score: f64,
        chosen_provider: &str,
        external_id: &str,
        external_url: &str,
    ) -> Result<(), DbError> {
        sqlx::query(
            r#"UPDATE download_queue SET 
                status = 'resolved', 
                confidence_score = ?, 
                chosen_provider = ?, 
                external_id = ?, 
                external_url = ?, 
                updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?"#
        )
        .bind(confidence_score)
        .bind(chosen_provider)
        .bind(external_id)
        .bind(external_url)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn list_by_status(pool: &DbPool, status: &str) -> Result<Vec<DownloadQueueItem>, DbError> {
        let items = sqlx::query_as::<_, DownloadQueueItem>(
            "SELECT * FROM download_queue WHERE status = ? ORDER BY priority DESC, created_at ASC"
        )
        .bind(status)
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    pub async fn list_all(pool: &DbPool) -> Result<Vec<DownloadQueueItem>, DbError> {
        let items = sqlx::query_as::<_, DownloadQueueItem>(
            "SELECT * FROM download_queue ORDER BY created_at DESC LIMIT 100"
        )
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    // --- Arbitrage Manuel ---

    pub async fn push_manual_review(
        pool: &DbPool,
        queue_id: &str,
        title: &str,
        artist: &str,
        duration_ms: Option<i64>,
        candidates_json: &str,
    ) -> Result<ManualReviewItem, DbError> {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"INSERT INTO manual_review_items (
                id, queue_id, query_title, query_artist, query_duration_ms, candidates_json, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')"#
        )
        .bind(&id)
        .bind(queue_id)
        .bind(title)
        .bind(artist)
        .bind(duration_ms)
        .bind(candidates_json)
        .execute(pool)
        .await?;

        // Mettre à jour le statut dans la file de téléchargement
        Self::update_status(pool, queue_id, "manual_review", 0.0, None, None).await?;

        sqlx::query_as::<_, ManualReviewItem>("SELECT * FROM manual_review_items WHERE id = ?")
            .bind(&id)
            .fetch_one(pool)
            .await
            .map_err(Into::into)
    }

    pub async fn list_pending_manual_reviews(pool: &DbPool) -> Result<Vec<ManualReviewItem>, DbError> {
        let items = sqlx::query_as::<_, ManualReviewItem>(
            "SELECT * FROM manual_review_items WHERE status = 'pending' ORDER BY created_at ASC"
        )
        .fetch_all(pool)
        .await?;

        Ok(items)
    }

    pub async fn resolve_manual_review(
        pool: &DbPool,
        review_id: &str,
        approved: bool,
        selected_candidate_id: Option<&str>,
    ) -> Result<(), DbError> {
        let review = sqlx::query_as::<_, ManualReviewItem>(
            "SELECT * FROM manual_review_items WHERE id = ?"
        )
        .bind(review_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| DbError::NotFound(format!("Manual review item '{}' not found", review_id)))?;

        let new_status = if approved { "approved" } else { "rejected" };

        sqlx::query(
            "UPDATE manual_review_items SET status = ?, selected_candidate_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(new_status)
        .bind(selected_candidate_id)
        .bind(review_id)
        .execute(pool)
        .await?;

        if approved {
            Self::update_status(pool, &review.queue_id, "resolved", 0.0, None, None).await?;
        } else {
            Self::update_status(pool, &review.queue_id, "failed", 0.0, Some("Rejected by user during manual review"), None).await?;
        }

        Ok(())
    }
}
