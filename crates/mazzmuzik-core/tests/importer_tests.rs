use mazzmuzik_core::{
    DeezerPlaylistImporter, FilePlaylistImporter, SpotifyPlaylistImporter,
    UniversalPlaylistImporter, YtMusicPlaylistImporter,
};

#[test]
fn test_spotify_url_id_extraction() {
    let url1 = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123456";
    let id1 = SpotifyPlaylistImporter::extract_playlist_id(url1);
    assert_eq!(id1.as_deref(), Some("37i9dQZF1DXcBWIGoYBM5M"));

    let url2 = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
    let id2 = SpotifyPlaylistImporter::extract_playlist_id(url2);
    assert_eq!(id2.as_deref(), Some("37i9dQZF1DXcBWIGoYBM5M"));
}

#[test]
fn test_deezer_url_id_extraction() {
    let url = "https://www.deezer.com/fr/playlist/908622995";
    let id = DeezerPlaylistImporter::extract_playlist_id(url);
    assert_eq!(id.as_deref(), Some("908622995"));

    let direct_id = "908622995";
    assert_eq!(DeezerPlaylistImporter::extract_playlist_id(direct_id).as_deref(), Some("908622995"));
}

#[test]
fn test_ytmusic_url_id_extraction() {
    let url = "https://music.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_PEoN-PBhkTgSStjce";
    let id = YtMusicPlaylistImporter::extract_playlist_id(url);
    assert_eq!(id.as_deref(), Some("PL4fGSI1pDJn6jXS_PEoN-PBhkTgSStjce"));
}

#[test]
fn test_csv_importer() {
    let csv = r#"Title,Artist,Album
Around The World,Daft Punk,Homework
Genesis,Justice,Cross
Nightcall,Kavinsky,OutRun"#;

    let res = FilePlaylistImporter::parse_csv(csv, "Synth & House").unwrap();
    assert_eq!(res.name, "Synth & House");
    assert_eq!(res.tracks.len(), 3);
    assert_eq!(res.tracks[0].title, "Around The World");
    assert_eq!(res.tracks[0].artist, "Daft Punk");
    assert_eq!(res.tracks[0].album.as_deref(), Some("Homework"));
    assert_eq!(res.tracks[2].title, "Nightcall");
    assert_eq!(res.tracks[2].artist, "Kavinsky");
}

#[test]
fn test_m3u_importer() {
    let m3u = r#"#EXTM3U
#EXTINF:429,Daft Punk - Around The World
/home/music/Daft Punk/Homework/07 - Around The World.flac
#EXTINF:234,Justice - Genesis
/home/music/Justice/Cross/01 - Genesis.flac"#;

    let res = FilePlaylistImporter::parse_m3u(m3u, "My Favorites").unwrap();
    assert_eq!(res.name, "My Favorites");
    assert_eq!(res.tracks.len(), 2);
    assert_eq!(res.tracks[0].title, "Around The World");
    assert_eq!(res.tracks[0].artist, "Daft Punk");
    assert_eq!(res.tracks[0].duration_ms, Some(429000));
}

#[tokio::test]
async fn test_universal_importer_routing_error_on_invalid() {
    let importer = UniversalPlaylistImporter::new();
    let err = importer.import_from_url("https://unknown-service.com/playlist/123").await;
    assert!(err.is_err());
}
