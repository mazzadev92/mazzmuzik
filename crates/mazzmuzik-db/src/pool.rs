use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous};
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;
use crate::error::DbError;

pub type DbPool = SqlitePool;

pub async fn create_pool(database_path: &str, busy_timeout_secs: u64) -> Result<DbPool, DbError> {
    if database_path != ":memory:" {
        if let Some(parent) = Path::new(database_path).parent() {
            if !parent.as_os_str().is_empty() {
                tokio::fs::create_dir_all(parent).await.map_err(|e| {
                    DbError::Sqlx(sqlx::Error::Configuration(Box::new(e)))
                })?;
            }
        }
    }

    let options = if database_path == ":memory:" {
        SqliteConnectOptions::from_str("sqlite::memory:")?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true)
    } else {
        SqliteConnectOptions::from_str(&format!("sqlite://{}", database_path))?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(Duration::from_secs(busy_timeout_secs))
            .foreign_keys(true)
    };

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(busy_timeout_secs))
        .connect_with(options)
        .await?;

    Ok(pool)
}
