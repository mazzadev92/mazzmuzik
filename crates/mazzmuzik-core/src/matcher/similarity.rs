use strsim::{jaro_winkler, normalized_levenshtein};

/// Calcule un score hybride de similarité textuelle entre 0.0 et 1.0
/// Combine Jaro-Winkler (60%) et Levenshtein normalisé (40%)
pub fn string_similarity(a: &str, b: &str) -> f64 {
    let a_clean = a.trim();
    let b_clean = b.trim();

    if a_clean.is_empty() && b_clean.is_empty() {
        return 1.0;
    }
    if a_clean.is_empty() || b_clean.is_empty() {
        return 0.0;
    }
    if a_clean == b_clean {
        return 1.0;
    }

    let jw = jaro_winkler(a_clean, b_clean);
    let lev = normalized_levenshtein(a_clean, b_clean);
    let mut score = 0.60 * jw + 0.40 * lev;

    // Si une chaîne contient l'autre, pondérer selon le ratio de longueur
    if a_clean.contains(b_clean) || b_clean.contains(a_clean) {
        let min_len = a_clean.len().min(b_clean.len()) as f64;
        let max_len = a_clean.len().max(b_clean.len()) as f64;
        if max_len > 0.0 {
            let ratio = min_len / max_len;
            let containment_score = 0.50 + 0.45 * ratio;
            score = score.max(containment_score);
        }
    }

    score.clamp(0.0, 1.0)
}

/// Calcule le score de correspondance de durée en fonction de la tolérance
/// - Ecart <= tolerance_secs (ex: 3s) : 1.0
/// - Ecart entre 3s et 15s : pénalité progressive (de 1.0 à 0.4)
/// - Ecart entre 15s et 30s : forte pénalité (de 0.4 à 0.05)
/// - Ecart > 30s : 0.0
pub fn duration_similarity(expected_ms: u64, actual_ms: u64, tolerance_secs: u64) -> f64 {
    if expected_ms == 0 || actual_ms == 0 {
        // Durée inconnue : score neutre sans pénalité bloquante
        return 0.70;
    }

    let diff_ms = if expected_ms > actual_ms {
        expected_ms - actual_ms
    } else {
        actual_ms - expected_ms
    };
    let diff_secs = diff_ms as f64 / 1000.0;
    let tol = tolerance_secs as f64;

    if diff_secs <= tol {
        1.0
    } else if diff_secs <= 15.0 {
        // Décroissance linéaire de 1.0 à 0.4
        1.0 - ((diff_secs - tol) / (15.0 - tol)) * 0.60
    } else if diff_secs <= 30.0 {
        // Décroissance de 0.4 à 0.05
        0.40 - ((diff_secs - 15.0) / 15.0) * 0.35
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_similarity() {
        assert_eq!(string_similarity("daft punk", "daft punk"), 1.0);
        assert!(string_similarity("daft punk", "daft punck") > 0.90);
        assert!(string_similarity("justice", "daft punk") < 0.40);
    }

    #[test]
    fn test_duration_similarity() {
        // Exact
        assert_eq!(duration_similarity(240000, 240000, 3), 1.0);
        // Tolérance ±3s
        assert_eq!(duration_similarity(240000, 242500, 3), 1.0);
        assert_eq!(duration_similarity(240000, 237500, 3), 1.0);
        // 10s d'écart
        let score_10s = duration_similarity(240000, 250000, 3);
        assert!(score_10s >= 0.40 && score_10s < 1.0);
        // 45s d'écart (éliminatoire)
        assert_eq!(duration_similarity(240000, 285000, 3), 0.0);
    }
}
