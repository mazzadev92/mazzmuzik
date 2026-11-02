use uuid::Uuid;
use crate::entities::Genre;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct GenreRepository;

impl GenreRepository {
    pub async fn get_or_create(pool: &DbPool, name: &str) -> Result<Genre, DbError> {
        let clean_name = name.trim();
        if let Some(existing) = sqlx::query_as::<_, Genre>(
            "SELECT * FROM genres WHERE name = ?"
        )
        .bind(clean_name)
        .fetch_optional(pool)
        .await? {
            return Ok(existing);
        }

        let id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO genres (id, name) VALUES (?, ?)")
            .bind(&id)
            .bind(clean_name)
            .execute(pool)
            .await?;

        Ok(Genre {
            id,
            name: clean_name.to_string(),
        })
    }

    pub async fn link_track(pool: &DbPool, track_id: &str, genre_id: &str) -> Result<(), DbError> {
        sqlx::query(
            "INSERT OR IGNORE INTO track_genres (track_id, genre_id) VALUES (?, ?)"
        )
        .bind(track_id)
        .bind(genre_id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn get_genres_for_track(pool: &DbPool, track_id: &str) -> Result<Vec<Genre>, DbError> {
        let genres = sqlx::query_as::<_, Genre>(
            r#"SELECT g.id, g.name 
               FROM genres g 
               JOIN track_genres tg ON tg.genre_id = g.id 
               WHERE tg.track_id = ? 
               ORDER BY g.name ASC"#
        )
        .bind(track_id)
        .fetch_all(pool)
        .await?;
        Ok(genres)
    }

    pub async fn list_all(pool: &DbPool) -> Result<Vec<Genre>, DbError> {
        let genres = sqlx::query_as::<_, Genre>(
            "SELECT * FROM genres ORDER BY name ASC"
        )
        .fetch_all(pool)
        .await?;
        Ok(genres)
    }

    pub async fn find_similar_tracks_by_genre(
        pool: &DbPool,
        track_id: &str,
        limit: i64,
    ) -> Result<Vec<String>, DbError> {
        let track_ids = sqlx::query_as::<_, (String,)>(
            r#"SELECT DISTINCT tg2.track_id
               FROM track_genres tg1
               JOIN track_genres tg2 ON tg1.genre_id = tg2.genre_id
               WHERE tg1.track_id = ? AND tg2.track_id != ?
               LIMIT ?"#
        )
        .bind(track_id)
        .bind(track_id)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(track_ids.into_iter().map(|t| t.0).collect())
    }
}
