use async_trait::async_trait;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};

/// Trait universel pour tout fournisseur de sources audio publiques.
/// Chaque maillon de la cascade est isolé derrière ce trait et remplaçable
/// sans impacter le reste du système.
#[async_trait]
pub trait SourceProvider: Send + Sync {
    /// Nom unique du provider (ex: "ytmusic", "youtube", "deezer", etc.)
    fn name(&self) -> &'static str;

    /// Priorité d'exécution par défaut (plus petit = exécuté en premier)
    fn priority(&self) -> u32;

    /// Effectue une recherche anonyme de candidats pour une piste donnée
    async fn search(&self, query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError>;

    /// Résout l'URL directe de streaming ou de téléchargement si disponible
    async fn resolve_stream_or_download_url(
        &self,
        candidate: &MatchCandidate,
    ) -> Result<Option<String>, CoreError>;
}
