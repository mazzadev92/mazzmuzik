use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Provider error ({provider}): {message}")]
    Provider {
        provider: String,
        message: String,
    },

    #[error("Tagging error: {0}")]
    Tagging(String),

    #[error("Resolver error: {0}")]
    Resolver(String),

    #[error("Download error: {0}")]
    Download(String),

    #[error("Item not found: {0}")]
    NotFound(String),
}
