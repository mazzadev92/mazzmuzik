use serde::{Deserialize, Serialize};
use super::candidate::TrackQuery;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedPlaylist {
    pub name: String,
    pub source: String,
    pub tracks: Vec<TrackQuery>,
}
