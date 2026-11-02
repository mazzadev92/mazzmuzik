pub mod deduplicator;
pub mod scanner;
pub mod structure;

pub use deduplicator::Deduplicator;
pub use scanner::{LibraryScanner, ScannedAudioFile};
pub use structure::FileOrganizer;
