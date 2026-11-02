use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};
use crate::error::CoreError;
use crate::matcher::confidence::{MatchDecision, MatchScorer};
use crate::models::{MatchCandidate, TrackQuery};
use crate::resolver::providers::*;
use crate::resolver::traits::SourceProvider;

#[derive(Debug, Clone)]
pub enum CascadeResult {
    /// Correspondance trouvée dépassant le seuil de confiance
    Resolved(MatchCandidate),
    /// Des candidats ont été trouvés mais aucun n'atteint le seuil (arbitrage manuel requis)
    NeedsReview(Vec<MatchCandidate>),
    /// Aucun candidat trouvé sur l'ensemble de la cascade
    NotFound,
}

pub struct CascadeResolver {
    providers: Vec<Arc<dyn SourceProvider>>,
    scorer: MatchScorer,
}

impl Default for CascadeResolver {
    fn default() -> Self {
        Self::new(0.78, 3)
    }
}

impl CascadeResolver {
    pub fn new(confidence_threshold: f64, duration_tolerance_secs: u64) -> Self {
        let providers: Vec<Arc<dyn SourceProvider>> = vec![
            Arc::new(YtMusicProvider::new()),
            Arc::new(YouTubeProvider::new()),
            Arc::new(DeezerProvider::new()),
            Arc::new(SoundCloudProvider::new()),
            Arc::new(BandcampProvider::new()),
            Arc::new(AudiusProvider::new()),
            Arc::new(SoulseekProvider),
        ];

        Self {
            providers,
            scorer: MatchScorer::new(confidence_threshold, duration_tolerance_secs),
        }
    }

    pub fn with_custom_providers(
        providers: Vec<Arc<dyn SourceProvider>>,
        confidence_threshold: f64,
        duration_tolerance_secs: u64,
    ) -> Self {
        let mut sorted = providers;
        sorted.sort_by_key(|p| p.priority());
        Self {
            providers: sorted,
            scorer: MatchScorer::new(confidence_threshold, duration_tolerance_secs),
        }
    }

    /// Résout une piste en parcourant la cascade ordonnée de providers avec gestion d'erreurs
    pub async fn resolve(&self, query: &TrackQuery) -> Result<CascadeResult, CoreError> {
        let mut all_scored_candidates = Vec::new();

        for provider in &self.providers {
            info!("Trying provider: {} for '{} - {}'", provider.name(), query.artist, query.title);

            // Réessai avec backoff exponentiel pour la résilience
            let mut attempts = 0;
            let max_attempts = 2;
            let mut search_result = Err(CoreError::Resolver("Initial".to_string()));

            while attempts < max_attempts {
                search_result = provider.search(query).await;
                if search_result.is_ok() {
                    break;
                }
                attempts += 1;
                if attempts < max_attempts {
                    tokio::time::sleep(Duration::from_millis(150 * (1 << attempts))).await;
                }
            }

            match search_result {
                Ok(candidates) => {
                    let mut provider_candidates = Vec::new();
                    for mut cand in candidates {
                        let score = self.scorer.score_candidate(query, &cand);
                        cand.confidence_score = score;
                        provider_candidates.push(cand);
                    }

                    // Trier les candidats de ce provider par score décroissant
                    provider_candidates.sort_by(|a, b| {
                        b.confidence_score
                            .partial_cmp(&a.confidence_score)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });

                    // Vérifier si le meilleur candidat de ce maillon dépasse le seuil
                    if let Some(best) = provider_candidates.first() {
                        if let MatchDecision::AutoAccepted(score) = self.scorer.evaluate(query, best) {
                            info!(
                                "Match auto-accepted on provider '{}' with score {:.2}: '{}' by '{}'",
                                provider.name(), score, best.title, best.artist
                            );
                            return Ok(CascadeResult::Resolved(best.clone()));
                        }
                    }

                    all_scored_candidates.extend(provider_candidates);
                }
                Err(err) => {
                    warn!("Provider '{}' failed during cascade: {}. Continuing to next provider.", provider.name(), err);
                }
            }
        }

        // Si aucun candidat n'a été auto-accepté, trier l'ensemble des candidats trouvés
        if !all_scored_candidates.is_empty() {
            all_scored_candidates.sort_by(|a, b| {
                b.confidence_score
                    .partial_cmp(&a.confidence_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            // Ne conserver que les candidats plausibles (> 0.40) pour la revue manuelle
            let reviewable: Vec<MatchCandidate> = all_scored_candidates
                .into_iter()
                .filter(|c| c.confidence_score >= 0.40)
                .take(10)
                .collect();

            if !reviewable.is_empty() {
                return Ok(CascadeResult::NeedsReview(reviewable));
            }
        }

        Ok(CascadeResult::NotFound)
    }
}
