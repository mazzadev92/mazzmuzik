pub mod deezer;
pub mod files;
pub mod spotify;
pub mod ytmusic;

pub use deezer::DeezerPlaylistImporter;
pub use files::FilePlaylistImporter;
pub use spotify::SpotifyPlaylistImporter;
pub use ytmusic::YtMusicPlaylistImporter;

use crate::error::CoreError;
use crate::models::ImportedPlaylist;

pub struct UniversalPlaylistImporter {
    spotify: SpotifyPlaylistImporter,
    deezer: DeezerPlaylistImporter,
    ytmusic: YtMusicPlaylistImporter,
}

impl Default for UniversalPlaylistImporter {
    fn default() -> Self {
        Self::new()
    }
}

impl UniversalPlaylistImporter {
    pub fn new() -> Self {
        Self {
            spotify: SpotifyPlaylistImporter::new(),
            deezer: DeezerPlaylistImporter::new(),
            ytmusic: YtMusicPlaylistImporter::new(),
        }
    }

    /// Détecte automatiquement la source (Spotify, Deezer, YT Music) et importe les pistes de manière anonyme
    pub async fn import_from_url(&self, url: &str) -> Result<ImportedPlaylist, CoreError> {
        let clean = url.trim().to_lowercase();

        if clean.contains("spotify.com") {
            self.spotify.import_from_url(url).await
        } else if clean.contains("deezer.com") {
            self.deezer.import_from_url(url).await
        } else if clean.contains("youtube.com") || clean.contains("youtu.be") {
            self.ytmusic.import_from_url(url).await
        } else {
            Err(CoreError::Resolver(format!(
                "Unsupported playlist provider URL: {}. Supported: Spotify, Deezer, YouTube Music, CSV, M3U.",
                url
            )))
        }
    }
}
