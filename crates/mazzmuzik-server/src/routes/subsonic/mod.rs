pub mod auth;
pub mod handlers;
pub mod models;

use axum::routing::get;
use axum::Router;
use crate::state::AppState;
use handlers::*;

pub fn router() -> Router<AppState> {
    Router::new()
        // Endpoints OpenSubsonic avec et sans extension .view
        .route("/ping.view", get(ping))
        .route("/ping", get(ping))
        .route("/getLicense.view", get(get_license))
        .route("/getLicense", get(get_license))
        .route("/getMusicFolders.view", get(get_music_folders))
        .route("/getMusicFolders", get(get_music_folders))
        .route("/getIndexes.view", get(get_indexes))
        .route("/getIndexes", get(get_indexes))
        .route("/getArtists.view", get(get_artists))
        .route("/getArtists", get(get_artists))
        .route("/getArtist.view", get(get_artist))
        .route("/getArtist", get(get_artist))
        .route("/getArtistInfo2.view", get(get_artist))
        .route("/getArtistInfo2", get(get_artist))
        .route("/getAlbumList2.view", get(get_album_list2))
        .route("/getAlbumList2", get(get_album_list2))
        .route("/getAlbum.view", get(get_album))
        .route("/getAlbum", get(get_album))
        .route("/getAlbumInfo2.view", get(get_album))
        .route("/getAlbumInfo2", get(get_album))
        .route("/getSong.view", get(get_song))
        .route("/getSong", get(get_song))
        .route("/getRandomSongs.view", get(get_random_songs))
        .route("/getRandomSongs", get(get_random_songs))
        .route("/getTopSongs.view", get(get_top_songs))
        .route("/getTopSongs", get(get_top_songs))
        .route("/getGenres.view", get(get_genres))
        .route("/getGenres", get(get_genres))
        .route("/getScanStatus.view", get(get_scan_status))
        .route("/getScanStatus", get(get_scan_status))
        .route("/startScan.view", get(start_scan))
        .route("/startScan", get(start_scan))
        .route("/getLyrics.view", get(get_lyrics))
        .route("/getLyrics", get(get_lyrics))
        .route("/search2.view", get(search3))
        .route("/search2", get(search3))
        .route("/search3.view", get(search3))
        .route("/search3", get(search3))
        .route("/stream.view", get(stream))
        .route("/stream", get(stream))
}
