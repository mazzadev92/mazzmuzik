use async_trait::async_trait;
use mazzmuzik_core::{
    compute_query_hash, duration_similarity, extract_features, normalize, string_similarity,
    CascadeResolver, CascadeResult, CoreError, MatchCandidate, MatchDecision, MatchScorer,
    SourceProvider, TrackQuery,
};
use std::sync::Arc;

#[test]
fn test_normalization_and_feature_extraction() {
    let raw = "Daft Punk - One More Time (Official Audio) [feat. Romanthony]";
    let norm = normalize(raw);
    assert_eq!(norm, "daft punk one more time");

    let feat_raw = "Kavinsky - Nightcall (feat. Lovefoxxx)";
    let feats = extract_features(feat_raw);
    assert_eq!(feats, vec!["lovefoxxx"]);

    // Caractères accentués français
    let french_raw = "Édith Piaf - La Vie En Rose (Remasterisé 2020)";
    assert_eq!(normalize(french_raw), "edith piaf la vie en rose");

    // Hachage stable
    let h1 = compute_query_hash("One More Time", "Daft Punk");
    let h2 = compute_query_hash("One More Time (Official Video)", "daft punk");
    assert_eq!(h1, h2);
}

#[test]
fn test_similarity_metrics() {
    // 1. Chaînes identiques
    assert_eq!(string_similarity("daft punk", "daft punk"), 1.0);

    // 2. Fautes de frappe légères
    assert!(string_similarity("the chemical brothers", "the chemikal brothers") > 0.90);

    // 3. Inclusion de sous-chaîne (titre YouTube contenant l'artiste)
    assert!(string_similarity("justice - genesis", "genesis") >= 0.65);

    // 4. Durée dans la tolérance de 3s
    assert_eq!(duration_similarity(240000, 241000, 3), 1.0);
    assert_eq!(duration_similarity(240000, 237500, 3), 1.0);

    // 5. Durée avec dérive de 10s (pénalité modérée)
    let score_10s = duration_similarity(240000, 250000, 3);
    assert!(score_10s > 0.40 && score_10s < 1.0);

    // 6. Durée avec dérive > 30s (éliminatoire)
    assert_eq!(duration_similarity(240000, 300000, 3), 0.0);
}

#[test]
fn test_scorer_and_confidence_threshold() {
    let scorer = MatchScorer::new(0.78, 3);

    let query = TrackQuery {
        title: "Around The World".to_string(),
        artist: "Daft Punk".to_string(),
        album: Some("Homework".to_string()),
        duration_ms: Some(429000),
        isrc: None,
        mbid: None,
    };

    // Cas 1 : Correspondance parfaite -> Auto-accepté
    let perfect_cand = MatchCandidate {
        provider: "ytmusic".to_string(),
        external_id: "atw_1".to_string(),
        external_url: "https://...".to_string(),
        title: "Around The World (Official Audio)".to_string(),
        artist: "Daft Punk".to_string(),
        album: Some("Homework".to_string()),
        duration_ms: 429500, // +0.5s
        confidence_score: 0.0,
        direct_stream_url: None,
    };
    match scorer.evaluate(&query, &perfect_cand) {
        MatchDecision::AutoAccepted(score) => assert!(score >= 0.90),
        _ => panic!("Expected AutoAccepted"),
    }

    // Cas 2 : Piste avec légère déviation de titre / durée -> Arbitrage manuel
    let review_cand = MatchCandidate {
        provider: "youtube".to_string(),
        external_id: "atw_live".to_string(),
        external_url: "https://...".to_string(),
        title: "Around The World (Alive 1997 Edit)".to_string(),
        artist: "Daft Punk".to_string(),
        album: None,
        duration_ms: 412000, // ~17s d'écart
        confidence_score: 0.0,
        direct_stream_url: None,
    };
    match scorer.evaluate(&query, &review_cand) {
        MatchDecision::NeedsManualReview(score) => {
            assert!(score < 0.78 && score >= 0.45);
        }
        _ => panic!("Expected NeedsManualReview"),
    }

    // Cas 3 : Vidéo d'une heure (mix ou full album) -> Rejetée
    let mix_cand = MatchCandidate {
        provider: "youtube".to_string(),
        external_id: "atw_mix".to_string(),
        external_url: "https://...".to_string(),
        title: "Daft Punk Homework Full Album 1 Hour".to_string(),
        artist: "Daft Punk".to_string(),
        album: None,
        duration_ms: 3600000,
        confidence_score: 0.0,
        direct_stream_url: None,
    };
    match scorer.evaluate(&query, &mix_cand) {
        MatchDecision::Rejected(score) => assert!(score <= 0.40),
        _ => panic!("Expected Rejected"),
    }
}

// Fournisseur fictif pour tester la cascade sans réseau externe
struct MockProvider {
    name: &'static str,
    priority: u32,
    should_fail: bool,
    candidates: Vec<MatchCandidate>,
}

#[async_trait]
impl SourceProvider for MockProvider {
    fn name(&self) -> &'static str {
        self.name
    }
    fn priority(&self) -> u32 {
        self.priority
    }
    async fn search(&self, _query: &TrackQuery) -> Result<Vec<MatchCandidate>, CoreError> {
        if self.should_fail {
            return Err(CoreError::Provider {
                provider: self.name.to_string(),
                message: "Mock network error".to_string(),
            });
        }
        Ok(self.candidates.clone())
    }
    async fn resolve_stream_or_download_url(
        &self,
        candidate: &MatchCandidate,
    ) -> Result<Option<String>, CoreError> {
        Ok(Some(candidate.external_url.clone()))
    }
}

#[tokio::test]
async fn test_cascade_failover_and_resolution() {
    let query = TrackQuery {
        title: "Harder, Better, Faster, Stronger".to_string(),
        artist: "Daft Punk".to_string(),
        album: Some("Discovery".to_string()),
        duration_ms: Some(224000),
        isrc: None,
        mbid: None,
    };

    // Provider 1 (ytmusic) : échoue
    let p1 = Arc::new(MockProvider {
        name: "ytmusic",
        priority: 1,
        should_fail: true,
        candidates: vec![],
    });

    // Provider 2 (youtube) : renvoie un candidat médiocre (score < 0.78)
    let p2 = Arc::new(MockProvider {
        name: "youtube",
        priority: 2,
        should_fail: false,
        candidates: vec![MatchCandidate {
            provider: "youtube".to_string(),
            external_id: "yt_dub".to_string(),
            external_url: "https://...".to_string(),
            title: "Harder Better Faster Stronger (Cover by Band)".to_string(),
            artist: "Random Band".to_string(),
            album: None,
            duration_ms: 220000,
            confidence_score: 0.0,
            direct_stream_url: None,
        }],
    });

    // Provider 3 (deezer) : renvoie le candidat parfait
    let p3 = Arc::new(MockProvider {
        name: "deezer",
        priority: 3,
        should_fail: false,
        candidates: vec![MatchCandidate {
            provider: "deezer".to_string(),
            external_id: "dz_exact".to_string(),
            external_url: "https://deezer.com/track/123".to_string(),
            title: "Harder, Better, Faster, Stronger".to_string(),
            artist: "Daft Punk".to_string(),
            album: Some("Discovery".to_string()),
            duration_ms: 224000,
            confidence_score: 0.0,
            direct_stream_url: None,
        }],
    });

    let cascade = CascadeResolver::with_custom_providers(vec![p1, p2, p3], 0.78, 3);
    let result = cascade.resolve(&query).await.expect("Cascade execution failed");

    match result {
        CascadeResult::Resolved(best) => {
            assert_eq!(best.provider, "deezer");
            assert_eq!(best.external_id, "dz_exact");
            assert!(best.confidence_score >= 0.90);
        }
        _ => panic!("Expected Resolved from Deezer after failovers"),
    }
}

#[tokio::test]
async fn test_cascade_returns_manual_review_when_below_threshold() {
    let query = TrackQuery {
        title: "Genesis".to_string(),
        artist: "Justice".to_string(),
        album: None,
        duration_ms: Some(234000),
        isrc: None,
        mbid: None,
    };

    // Provider renvoyant uniquement un candidat au score moyen (~0.60)
    let p = Arc::new(MockProvider {
        name: "soundcloud",
        priority: 1,
        should_fail: false,
        candidates: vec![MatchCandidate {
            provider: "soundcloud".to_string(),
            external_id: "sc_remix".to_string(),
            external_url: "https://...".to_string(),
            title: "Genesis (Justice Tribute Edit)".to_string(),
            artist: "Justice Tribute Fan".to_string(),
            album: None,
            duration_ms: 242000, // 8s delta
            confidence_score: 0.0,
            direct_stream_url: None,
        }],
    });

    let cascade = CascadeResolver::with_custom_providers(vec![p], 0.78, 3);
    let result = cascade.resolve(&query).await.expect("Cascade execution failed");

    match result {
        CascadeResult::NeedsReview(candidates) => {
            assert_eq!(candidates.len(), 1);
            assert!(candidates[0].confidence_score < 0.78);
            assert!(candidates[0].confidence_score >= 0.40);
        }
        _ => panic!("Expected NeedsReview when all candidates are below threshold"),
    }
}
