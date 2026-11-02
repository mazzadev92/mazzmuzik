use uuid::Uuid;
use crate::entities::Artist;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct ArtistRepository;

impl ArtistRepository {
    pub async fn get_or_create(
        pool: &DbPool,
        name: &str,
        normalized_name: &str,
        mbid: Option<&str>,
    ) -> Result<Artist, DbError> {
        if let Some(existing) = sqlx::query_as::<_, Artist>(
            "SELECT * FROM artists WHERE normalized_name = ?"
        )
        .bind(normalized_name)
        .fetch_optional(pool)
        .await? {
            return Ok(existing);
        }

        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO artists (id, name, normalized_name, mbid) VALUES (?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(name)
        .bind(normalized_name)
        .bind(mbid)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id).await
    }

    pub async fn find_by_id(pool: &DbPool, id: &str) -> Result<Artist, DbError> {
        sqlx::query_as::<_, Artist>("SELECT * FROM artists WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Artist id '{}' not found", id)))
    }

    pub async fn list_all(pool: &DbPool) -> Result<Vec<Artist>, DbError> {
        let artists = sqlx::query_as::<_, Artist>(
            "SELECT * FROM artists ORDER BY name ASC"
        )
        .fetch_all(pool)
        .await?;
        Ok(artists)
    }
}
