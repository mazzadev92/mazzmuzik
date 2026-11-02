-- Migration 0001: Initial Schema

-- Table des utilisateurs (pour l'authentification OpenSubsonic et admin)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Table des artistes
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    mbid TEXT UNIQUE,
    bio TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_artists_normalized ON artists(normalized_name);
CREATE INDEX IF NOT EXISTS idx_artists_mbid ON artists(mbid);

-- Table des albums
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    mbid TEXT UNIQUE,
    release_year INTEGER,
    cover_path TEXT,
    total_tracks INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_normalized ON albums(normalized_title);
CREATE INDEX IF NOT EXISTS idx_albums_mbid ON albums(mbid);

-- Table des morceaux (album_id NULLABLE, avec index sur duration_ms)
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
    artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    track_number INTEGER DEFAULT 1,
    disc_number INTEGER DEFAULT 1,
    duration_ms INTEGER NOT NULL,
    isrc TEXT,
    mbid TEXT UNIQUE,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    bitrate INTEGER,
    format TEXT NOT NULL,
    lrc_path TEXT,
    audio_fingerprint TEXT,
    play_count INTEGER NOT NULL DEFAULT 0,
    last_played_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_normalized ON tracks(normalized_title);
CREATE INDEX IF NOT EXISTS idx_tracks_duration ON tracks(duration_ms);
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
CREATE INDEX IF NOT EXISTS idx_tracks_fingerprint ON tracks(audio_fingerprint);

-- Genres & Relations
CREATE TABLE IF NOT EXISTS genres (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_genres_name ON genres(name);

CREATE TABLE IF NOT EXISTS track_genres (
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, genre_id)
);
CREATE INDEX IF NOT EXISTS idx_track_genres_genre ON track_genres(genre_id);
