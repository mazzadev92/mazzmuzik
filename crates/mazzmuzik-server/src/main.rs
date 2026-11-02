//! Mazz MuZik Server Daemon
//!
//! Exposes the internal REST API, the OpenSubsonic v1.16.1 endpoint,
//! and the minimal administration Web UI.

mod config;
mod routes;
mod state;
mod worker;

use config::AppConfig;
use mazzmuzik_db::{create_pool, run_migrations, UserRepository};
use routes::app_router;
use state::AppState;
use std::net::SocketAddr;
use tracing::info;
use worker::spawn_queue_worker;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mazzmuzik_server=info,mazzmuzik_core=info,mazzmuzik_db=info".into()),
        )
        .init();

    info!("=== Mazz MuZik Server starting ===");

    // 1. Chargement de la configuration
    let config = AppConfig::load();
    info!("Configuration loaded (port: {}, music_dir: {})", config.server.port, config.library.music_dir);

    // 2. Connexion à SQLite et exécution des migrations versionnées
    let pool = create_pool(&config.database.path, config.database.busy_timeout_secs).await?;
    info!("Connected to SQLite at: {}", config.database.path);
    run_migrations(&pool).await?;
    info!("Database migrations applied successfully");

    // 3. Vérification du premier utilisateur (Passe 1.3)
    let user_count = UserRepository::count(&pool).await?;
    if user_count == 0 {
        info!("No users found in database. Initial setup is open at /api/setup or Web UI.");
    } else {
        info!("Database has {} registered user(s).", user_count);
    }

    // 4. Initialisation de l'état applicatif
    let state = AppState::new(pool, config.clone());

    // 5. Lancement de la boucle de travail en arrière-plan
    spawn_queue_worker(state.clone());

    // 6. Démarrage du serveur HTTP Axum
    let app = app_router(state);

    let addr: SocketAddr = format!("{}:{}", config.server.host, config.server.port).parse()?;
    info!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Mazz MuZik Server shutdown complete.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received, draining active connections...");
}
