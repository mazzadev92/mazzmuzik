-- Migration 0004: Playlists, Favorites, Playback History, and Settings

CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    comment TEXT,
    is_public BOOLEAN NOT NULL DEFAULT 1,
    cover_path TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, position)
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id, position);

CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('track', 'album', 'artist')),
    item_id TEXT NOT NULL,
    starred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_type ON favorites(user_id, item_type, item_id);

CREATE TABLE IF NOT EXISTS playback_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_played_ms INTEGER NOT NULL,
    submission_client TEXT
);
CREATE INDEX IF NOT EXISTS idx_playback_history_track ON playback_history(track_id, played_at DESC);

CREATE TABLE IF NOT EXISTS user_play_queue (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_track_id TEXT REFERENCES tracks(id) ON DELETE SET NULL,
    position_ms INTEGER NOT NULL DEFAULT 0,
    queue_json TEXT NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
