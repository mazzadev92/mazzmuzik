//! Mazz MuZik SQLite Database & sqlx Persistence Layer

pub mod entities;
pub mod error;
pub mod pool;
pub mod repositories;

pub use entities::*;
pub use error::DbError;
pub use pool::{create_pool, DbPool};
pub use repositories::*;

/// Exécute les migrations SQL versionnées sur le pool SQLite
pub async fn run_migrations(pool: &DbPool) -> Result<(), DbError> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(DbError::Migration)?;
    Ok(())
}
