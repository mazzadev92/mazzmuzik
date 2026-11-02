use chrono::{Duration, Utc};
use crate::entities::ResolutionCacheEntry;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct ResolutionCacheRepository;

impl ResolutionCacheRepository {
    pub async fn get(
        pool: &DbPool,
        query_hash: &str,
        source_provider: &str,
    ) -> Result<Option<ResolutionCacheEntry>, DbError> {
        let entry = sqlx::query_as::<_, ResolutionCacheEntry>(
            r#"SELECT * FROM resolution_cache 
               WHERE query_hash = ? AND source_provider = ? AND expires_at > CURRENT_TIMESTAMP"#
        )
        .bind(query_hash)
        .bind(source_provider)
        .fetch_optional(pool)
        .await?;

        Ok(entry)
    }

    pub async fn set(
        pool: &DbPool,
        query_hash: &str,
        source_provider: &str,
        external_id: &str,
        external_url: &str,
        resolved_title: &str,
        resolved_artist: &str,
        resolved_duration_ms: i64,
        confidence_score: f64,
        payload_json: Option<&str>,
        ttl_days: i64,
    ) -> Result<(), DbError> {
        let expires_at = (Utc::now() + Duration::days(ttl_days)).naive_utc();

        sqlx::query(
            r#"INSERT INTO resolution_cache (
                query_hash, source_provider, external_id, external_url,
                resolved_title, resolved_artist, resolved_duration_ms,
                confidence_score, payload_json, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(query_hash, source_provider) DO UPDATE SET
                external_id = excluded.external_id,
                external_url = excluded.external_url,
                resolved_title = excluded.resolved_title,
                resolved_artist = excluded.resolved_artist,
                resolved_duration_ms = excluded.resolved_duration_ms,
                confidence_score = excluded.confidence_score,
                payload_json = excluded.payload_json,
                expires_at = excluded.expires_at"#
        )
        .bind(query_hash)
        .bind(source_provider)
        .bind(external_id)
        .bind(external_url)
        .bind(resolved_title)
        .bind(resolved_artist)
        .bind(resolved_duration_ms)
        .bind(confidence_score)
        .bind(payload_json)
        .bind(expires_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn cleanup_expired(pool: &DbPool) -> Result<u64, DbError> {
        let result = sqlx::query(
            "DELETE FROM resolution_cache WHERE expires_at <= CURRENT_TIMESTAMP"
        )
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }
}
