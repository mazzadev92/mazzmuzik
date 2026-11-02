pub mod confidence;
pub mod normalizer;
pub mod similarity;

pub use confidence::{MatchDecision, MatchScorer};
pub use normalizer::{compute_query_hash, extract_features, normalize};
pub use similarity::{duration_similarity, string_similarity};
