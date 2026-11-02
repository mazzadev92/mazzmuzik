use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use uuid::Uuid;
use crate::entities::User;
use crate::error::DbError;
use crate::pool::DbPool;

pub struct UserRepository;

impl UserRepository {
    pub fn hash_password(password: &str) -> Result<String, DbError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| DbError::Auth(e.to_string()))?
            .to_string();
        Ok(password_hash)
    }

    pub fn verify_password(password: &str, password_hash: &str) -> Result<bool, DbError> {
        let parsed_hash = PasswordHash::new(password_hash)
            .map_err(|e| DbError::Auth(e.to_string()))?;
        let argon2 = Argon2::default();
        Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
    }

    pub async fn count(pool: &DbPool) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(pool)
            .await?;
        Ok(count.0)
    }

    pub async fn create_user(pool: &DbPool, username: &str, password: &str) -> Result<User, DbError> {
        let id = Uuid::new_v4().to_string();
        let password_hash = Self::hash_password(password)?;

        sqlx::query(
            "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)"
        )
        .bind(&id)
        .bind(username)
        .bind(&password_hash)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, &id).await
    }

    pub async fn find_by_id(pool: &DbPool, id: &str) -> Result<User, DbError> {
        sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, created_at FROM users WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| DbError::NotFound(format!("User id '{}' not found", id)))
    }

    pub async fn find_by_username(pool: &DbPool, username: &str) -> Result<Option<User>, DbError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, created_at FROM users WHERE username = ?"
        )
        .bind(username)
        .fetch_optional(pool)
        .await?;
        Ok(user)
    }
}
