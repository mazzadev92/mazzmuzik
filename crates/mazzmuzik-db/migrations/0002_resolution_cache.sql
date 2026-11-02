-- Migration 0002: Resolution Cache

CREATE TABLE IF NOT EXISTS resolution_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT NOT NULL,
    source_provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    external_url TEXT NOT NULL,
    resolved_title TEXT NOT NULL,
    resolved_artist TEXT NOT NULL,
    resolved_duration_ms INTEGER NOT NULL,
    confidence_score REAL NOT NULL,
    payload_json TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(query_hash, source_provider)
);
CREATE INDEX IF NOT EXISTS idx_resolution_query ON resolution_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_resolution_expiry ON resolution_cache(expires_at);
