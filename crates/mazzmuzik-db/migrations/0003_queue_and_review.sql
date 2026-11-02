-- Migration 0003: Download Queue and Manual Review Items

CREATE TABLE IF NOT EXISTS download_queue (
    id TEXT PRIMARY KEY,
    query_title TEXT NOT NULL,
    query_artist TEXT NOT NULL,
    query_album TEXT,
    preferred_format TEXT NOT NULL DEFAULT 'flac',
    status TEXT NOT NULL CHECK (status IN (
        'pending', 'resolving', 'resolved', 'downloading', 'tagging', 'completed', 'failed', 'manual_review'
    )),
    priority INTEGER NOT NULL DEFAULT 0,
    confidence_score REAL,
    chosen_provider TEXT,
    external_id TEXT,
    external_url TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    download_progress REAL NOT NULL DEFAULT 0.0,
    track_id TEXT REFERENCES tracks(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_queue_status_prio ON download_queue(status, priority DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS manual_review_items (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL UNIQUE REFERENCES download_queue(id) ON DELETE CASCADE,
    query_title TEXT NOT NULL,
    query_artist TEXT NOT NULL,
    query_duration_ms INTEGER,
    candidates_json TEXT NOT NULL,
    selected_candidate_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manual_review_status ON manual_review_items(status, created_at ASC);
