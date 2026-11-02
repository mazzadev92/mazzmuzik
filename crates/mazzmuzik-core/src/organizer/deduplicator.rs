use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;
use crate::error::CoreError;

pub struct Deduplicator;

impl Deduplicator {
    /// Calcule une empreinte de fichier par hachage SHA-256
    pub async fn compute_file_fingerprint(file_path: &Path) -> Result<String, CoreError> {
        let mut file = File::open(file_path).await.map_err(CoreError::Io)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 16384];

        loop {
            let bytes_read = file.read(&mut buffer).await.map_err(CoreError::Io)?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        Ok(hex::encode(hasher.finalize()))
    }
}
