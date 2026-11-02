use deunicode::deunicode;
use regex::Regex;
use sha2::{Digest, Sha256};
use std::sync::LazyLock;

static NOISE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s*[\(\[](?:feat\.?|ft\.?|featuring|with)\s+[^\)\]]+[\)\]]|\s*[\(\[](?:official\s+(?:audio|video|music\s+video)|music\s+video|video\s+clip|clip\s+officiel|lyrics(?:\s+video)?|audio|(?:\d{4}\s+)?remaster(?:ed|ise|isee)?(?:\s+\d{4})?|live(?:\s+at[^\)\]]+)?)[\)\]]").unwrap()
});

static PUNCTUATION_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[^\w\s]").unwrap()
});

static MULTISPACE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\s+").unwrap()
});

/// Normalise une chaîne de caractères (titre, artiste, album)
/// Supprime les diacritiques, la ponctuation, les bruits de métadonnées et uniformise les espaces.
pub fn normalize(input: &str) -> String {
    // 1. Décomposition / conversion en ASCII sans accents
    let ascii = deunicode(input);

    // 2. Nettoyage des motifs parasites (feat, official video, remastered, etc.)
    let stripped = NOISE_REGEX.replace_all(&ascii, " ");

    // 3. Remplacement de la ponctuation par un espace
    let no_punct = PUNCTUATION_REGEX.replace_all(&stripped, " ");

    // 4. Passage en minuscules, réduction des espaces et trim
    let lower = no_punct.to_lowercase();
    let normalized = MULTISPACE_REGEX.replace_all(&lower, " ").trim().to_string();

    normalized
}

/// Extrait les artistes invités (features) s'ils sont mentionnés dans le titre
pub fn extract_features(title: &str) -> Vec<String> {
    static FEAT_EXTRACTOR: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?i)[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]").unwrap()
    });

    if let Some(caps) = FEAT_EXTRACTOR.captures(title) {
        if let Some(m) = caps.get(1) {
            return m.as_str()
                .split(&[',', '&', '/'][..])
                .map(|s| normalize(s.trim()))
                .filter(|s| !s.is_empty())
                .collect();
        }
    }
    Vec::new()
}

/// Calcule un hachage SHA-256 stable pour le cache de résolution
pub fn compute_query_hash(title: &str, artist: &str) -> String {
    let norm_title = normalize(title);
    let norm_artist = normalize(artist);
    let raw = format!("{}:{}", norm_title, norm_artist);

    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_title() {
        assert_eq!(
            normalize("Daft Punk - Get Lucky (Official Video) [feat. Pharrell Williams]"),
            "daft punk get lucky"
        );
        assert_eq!(
            normalize("Hôtel California (2013 Remastered)"),
            "hotel california"
        );
        assert_eq!(
            normalize("Stromae - Papaoutai (Clip Officiel)"),
            "stromae papaoutai"
        );
    }

    #[test]
    fn test_query_hash_deterministic() {
        let hash1 = compute_query_hash("Get Lucky (feat. Pharrell)", "Daft Punk");
        let hash2 = compute_query_hash("Get Lucky", "daft punk");
        assert_eq!(hash1, hash2);
    }
}
