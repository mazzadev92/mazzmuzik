//! Mazz MuZik Core Library
//!
//! Provides matching, cascade resolution, download queue management,
//! audio tagging, and playlist imports.

pub mod downloader;
pub mod error;
pub mod importer;
pub mod matcher;
pub mod metadata;
pub mod models;
pub mod organizer;
pub mod queue;
pub mod resolver;
pub mod tagger;

pub use downloader::*;
pub use error::CoreError;
pub use importer::{
    DeezerPlaylistImporter, FilePlaylistImporter, SpotifyPlaylistImporter,
    UniversalPlaylistImporter, YtMusicPlaylistImporter,
};
pub use matcher::*;
pub use metadata::*;
pub use models::*;
pub use organizer::*;
pub use queue::*;
pub use resolver::{
    AudiusProvider, BandcampProvider, CascadeResolver, CascadeResult, DeezerProvider,
    SoundCloudProvider, SoulseekProvider, SourceProvider, YouTubeProvider, YtMusicProvider,
};
pub use tagger::*;
