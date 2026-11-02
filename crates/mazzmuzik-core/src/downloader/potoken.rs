use reqwest::Client;
use serde_json::Value;
use tracing::info;
use crate::error::CoreError;

#[derive(Debug, Clone)]
pub struct PoTokenConfig {
    pub enabled: bool,
    pub bgutil_url: String,
}

impl Default for PoTokenConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            bgutil_url: "http://127.0.0.1:4444".to_string(),
        }
    }
}

pub struct PoTokenProvider {
    config: PoTokenConfig,
    client: Client,
}

impl PoTokenProvider {
    pub fn new(config: PoTokenConfig) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .unwrap_or_default();
        Self { config, client }
    }

    /// Récupère un PoToken frais auprès du service local bgutil s'il est en cours d'exécution
    pub async fn get_token(&self) -> Result<Option<String>, CoreError> {
        if !self.config.enabled {
            return Ok(None);
        }

        let endpoint = format!("{}/token", self.config.bgutil_url);
        match self.client.get(&endpoint).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<Value>().await {
                        if let Some(token) = json.get("token").and_then(|t| t.as_str()) {
                            info!("Successfully acquired PoToken from bgutil");
                            return Ok(Some(token.to_string()));
                        }
                    }
                }
            }
            Err(_) => {
                // Silencieux si bgutil tourne en mode extractor-args interne sans daemon HTTP
            }
        }

        Ok(None)
    }

    /// Construit les arguments d'extraction pour yt-dlp
    pub fn build_extractor_args(&self, potoken: Option<&str>) -> Vec<String> {
        let mut args = Vec::new();
        if let Some(token) = potoken {
            args.push("--extractor-args".to_string());
            args.push(format!("youtube:player_client=ios,web;po_token={}", token));
        } else {
            // Mode par défaut pour anonymous fallback
            args.push("--extractor-args".to_string());
            args.push("youtube:player_client=ios,web".to_string());
        }
        args
    }
}
