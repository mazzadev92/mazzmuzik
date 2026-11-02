use uuid::Uuid;
use crate::entities::Album;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct AlbumRepository;

impl AlbumRepository {
    pub async fn get_or_create(
        pool: &DbPool,
        artist_id: &str,
        title: &str,
        normalized_title: &str,
        mbid: Option<&str>,
        release_year: Option<i32>,
    ) -> Result<Album, DbError> {
        if let Some(existing) = sqlx::query_as::<_, Album>(
            "SELECT * FROM albums WHERE artist_id = ? AND normalized_title = ?"
        )
        .bind(artist_id)
        .bind(normalized_title)
        .fetch_optional(pool)
        .await? {
            return Ok(existing);
        }

        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO albums (id, artist_id, title, normalized_title, mbid, release_year) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(artist_id)
        .bind(title)
        .bind(normalized_title)
        .bind(mbid)
        .bind(release_year)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id).await
    }

    /// Crée ou récupère à la volée l'album canonique "Singles" pour les pistes sans album
    pub async fn get_or_create_singles_album(
        pool: &DbPool,
        artist_id: &str,
    ) -> Result<Album, DbError> {
        Self::get_or_create(pool, artist_id, "Singles", "singles", None, None).await
    }

    pub async fn find_by_id(pool: &DbPool, id: &str) -> Result<Album, DbError> {
        sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| DbError::NotFound(format!("Album id '{}' not found", id)))
    }

    pub async fn list_by_artist(pool: &DbPool, artist_id: &str) -> Result<Vec<Album>, DbError> {
        let albums = sqlx::query_as::<_, Album>(
            "SELECT * FROM albums WHERE artist_id = ? ORDER BY release_year DESC, title ASC"
        )
        .bind(artist_id)
        .fetch_all(pool)
        .await?;
        Ok(albums)
    }

    pub async fn list_all(pool: &DbPool) -> Result<Vec<Album>, DbError> {
        let albums = sqlx::query_as::<_, Album>(
            "SELECT * FROM albums ORDER BY title ASC"
        )
        .fetch_all(pool)
        .await?;
        Ok(albums)
    }
}
