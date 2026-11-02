use crate::entities::Favorite;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct FavoriteRepository;

impl FavoriteRepository {
    pub async fn star(
        pool: &DbPool,
        user_id: &str,
        item_type: &str,
        item_id: &str,
    ) -> Result<(), DbError> {
        sqlx::query(
            "INSERT OR IGNORE INTO favorites (user_id, item_type, item_id) VALUES (?, ?, ?)"
        )
        .bind(user_id)
        .bind(item_type)
        .bind(item_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn unstar(
        pool: &DbPool,
        user_id: &str,
        item_type: &str,
        item_id: &str,
    ) -> Result<(), DbError> {
        sqlx::query(
            "DELETE FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?"
        )
        .bind(user_id)
        .bind(item_type)
        .bind(item_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn is_starred(
        pool: &DbPool,
        user_id: &str,
        item_type: &str,
        item_id: &str,
    ) -> Result<bool, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?"
        )
        .bind(user_id)
        .bind(item_type)
        .bind(item_id)
        .fetch_one(pool)
        .await?;

        Ok(count.0 > 0)
    }

    pub async fn list_starred(
        pool: &DbPool,
        user_id: &str,
        item_type: &str,
    ) -> Result<Vec<Favorite>, DbError> {
        let favorites = sqlx::query_as::<_, Favorite>(
            "SELECT * FROM favorites WHERE user_id = ? AND item_type = ? ORDER BY starred_at DESC"
        )
        .bind(user_id)
        .bind(item_type)
        .fetch_all(pool)
        .await?;

        Ok(favorites)
    }
}
