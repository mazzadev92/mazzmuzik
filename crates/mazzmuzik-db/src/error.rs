use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("Migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("Password hashing error: {0}")]
    Auth(String),

    #[error("Record not found: {0}")]
    NotFound(String),
}
