use super::normalizer::normalize;
use super::similarity::{duration_similarity, string_similarity};
use crate::models::{MatchCandidate, TrackQuery};

#[derive(Debug, Clone, PartialEq)]
pub enum MatchDecision {
    AutoAccepted(f64),
    NeedsManualReview(f64),
    Rejected(f64),
}

pub struct MatchScorer {
    pub confidence_threshold: f64,
    pub duration_tolerance_secs: u64,
}

impl Default for MatchScorer {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.78,
            duration_tolerance_secs: 3,
        }
    }
}

impl MatchScorer {
    pub fn new(confidence_threshold: f64, duration_tolerance_secs: u64) -> Self {
        Self {
            confidence_threshold,
            duration_tolerance_secs,
        }
    }

    /// Calcule le score global de confiance d'un candidat face à une requête
    pub fn score_candidate(&self, query: &TrackQuery, candidate: &MatchCandidate) -> f64 {
        let norm_query_title = normalize(&query.title);
        let norm_query_artist = normalize(&query.artist);

        let norm_cand_title = normalize(&candidate.title);
        let norm_cand_artist = normalize(&candidate.artist);

        // 1. Similarité Titre (45%)
        let title_score = string_similarity(&norm_query_title, &norm_cand_title);

        // 2. Similarité Artiste (35%)
        // Gère le cas où l'artiste est présent dans le titre de la vidéo candidate (très fréquent sur YouTube)
        let mut artist_score = string_similarity(&norm_query_artist, &norm_cand_artist);
        if artist_score < 0.60 && norm_cand_title.contains(&norm_query_artist) {
            artist_score = 0.85;
        }

        // 3. Similarité Durée (20%)
        let duration_score = if let Some(exp_duration) = query.duration_ms {
            duration_similarity(exp_duration, candidate.duration_ms, self.duration_tolerance_secs)
        } else {
            0.75
        };

        // Calcul pondéré
        let mut total_score = 0.45 * title_score + 0.35 * artist_score + 0.20 * duration_score;

        // Pénalité éliminatoire si la durée est drastiquement différente (> 30s)
        if duration_score == 0.0 && query.duration_ms.is_some() {
            total_score = total_score.min(0.40);
        }

        // Bonus ISRC ou MBID si dispo
        if let Some(q_isrc) = &query.isrc {
            if q_isrc == &candidate.external_id {
                total_score = 1.0;
            }
        }

        total_score.clamp(0.0, 1.0)
    }

    /// Évalue la décision selon le seuil de confiance configuré
    pub fn evaluate(&self, query: &TrackQuery, candidate: &MatchCandidate) -> MatchDecision {
        let score = self.score_candidate(query, candidate);

        if score >= self.confidence_threshold {
            MatchDecision::AutoAccepted(score)
        } else if score >= 0.45 {
            MatchDecision::NeedsManualReview(score)
        } else {
            MatchDecision::Rejected(score)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perfect_match() {
        let scorer = MatchScorer::default();
        let query = TrackQuery {
            title: "Get Lucky".to_string(),
            artist: "Daft Punk".to_string(),
            album: Some("Random Access Memories".to_string()),
            duration_ms: Some(248000),
            isrc: None,
            mbid: None,
        };
        let candidate = MatchCandidate {
            provider: "ytmusic".to_string(),
            external_id: "vid123".to_string(),
            external_url: "https://...".to_string(),
            title: "Get Lucky (feat. Pharrell Williams)".to_string(),
            artist: "Daft Punk".to_string(),
            album: Some("Random Access Memories".to_string()),
            duration_ms: 248000,
            confidence_score: 0.0,
            direct_stream_url: None,
        };

        let decision = scorer.evaluate(&query, &candidate);
        match decision {
            MatchDecision::AutoAccepted(score) => assert!(score > 0.90),
            _ => panic!("Expected AutoAccepted"),
        }
    }

    #[test]
    fn test_duration_mismatch_forces_manual_review() {
        let scorer = MatchScorer::default();
        let query = TrackQuery {
            title: "Get Lucky".to_string(),
            artist: "Daft Punk".to_string(),
            album: None,
            duration_ms: Some(248000),
            isrc: None,
            mbid: None,
        };
        // Candidat qui est un live ou mix d'une heure (3600000 ms)
        let candidate = MatchCandidate {
            provider: "youtube".to_string(),
            external_id: "vid_long".to_string(),
            external_url: "https://...".to_string(),
            title: "Get Lucky - Daft Punk Full Concert Live".to_string(),
            artist: "Daft Punk".to_string(),
            album: None,
            duration_ms: 3600000,
            confidence_score: 0.0,
            direct_stream_url: None,
        };

        let decision = scorer.evaluate(&query, &candidate);
        match decision {
            MatchDecision::Rejected(score) | MatchDecision::NeedsManualReview(score) => {
                assert!(score <= 0.40);
            }
            MatchDecision::AutoAccepted(_) => panic!("Long mix should never be auto-accepted"),
        }
    }
}
