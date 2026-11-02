use async_trait::async_trait;
use crate::error::CoreError;
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::traits::SourceProvider;

pub struct SoulseekProvider;

impl Default for SoulseekProvider {
    fn default() -> Self {
        Self
    }
}

#[async_trait]
impl SourceProvider for SoulseekProvider {
    fn name(&self) -> &'static str {
        "soulseek"
    }

    fn priority(&self) -> u32 {
        7
    }

    async fn search(&self, _query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        // Maillon Soulseek décentralisé (isolé derrière le trait, passif par défaut pour l'anonymat pur HTTP)
        Ok(Vec::new())
    }

    async fn resolve_stream_or_download_url(
        &self,
        candidate: &MatchCandidate,
    ) -> Result<Option<String>, CoreError> {
        Ok(Some(candidate.external_url.clone()))
    }
}
