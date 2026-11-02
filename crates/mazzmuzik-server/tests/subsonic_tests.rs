use axum::body::Body;
use axum::http::{header::RANGE, Request, StatusCode};
use http_body_util::BodyExt;
use mazzmuzik_db::{
    create_pool, run_migrations, AlbumRepository, ArtistRepository, Track, TrackRepository,
    UserRepository,
};
use mazzmuzik_server::{app_router, AppConfig, AppState};
use tempfile::tempdir;
use tower::ServiceExt;
use uuid::Uuid;

async fn setup_subsonic_test() -> (axum::Router, String, String, tempfile::TempDir) {
    let pool = create_pool(":memory:", 5).await.expect("Failed to create memory DB");
    run_migrations(&pool).await.expect("Failed to run migrations");

    let dir = tempdir().expect("Failed to create tempdir");
    let test_file = dir.path().join("01 - Test Song.flac");
    tokio::fs::write(&test_file, b"1234567890abcdefghijklmnopqrstuvwxyz").await.unwrap();

    let user = UserRepository::create_user(&pool, "subsonic_user", "password123").await.unwrap();

    let artist = ArtistRepository::get_or_create(&pool, "Daft Punk", "daft punk", None).await.unwrap();
    let album = AlbumRepository::get_or_create(&pool, &artist.id, "Discovery", "discovery", None, Some(2001)).await.unwrap();

    let track = Track {
        id: Uuid::new_v4().to_string(),
        album_id: Some(album.id.clone()),
        artist_id: artist.id.clone(),
        title: "One More Time".to_string(),
        normalized_title: "one more time".to_string(),
        track_number: Some(1),
        disc_number: Some(1),
        duration_ms: 320000,
        isrc: None,
        mbid: None,
        file_path: test_file.to_string_lossy().to_string(),
        file_size: 36,
        mime_type: "audio/flac".to_string(),
        bitrate: Some(900),
        format: "flac".to_string(),
        lrc_path: None,
        audio_fingerprint: None,
        play_count: 10,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };
    TrackRepository::insert(&pool, &track).await.unwrap();

    let mut config = AppConfig::default();
    config.library.music_dir = dir.path().to_string_lossy().to_string();

    let state = AppState::new(pool, config);
    let router = app_router(state);

    (router, user.username, track.id, dir)
}

#[tokio::test]
async fn test_subsonic_ping_and_license() {
    let (app, username, _, _dir) = setup_subsonic_test().await;

    // 1. Ping view (JSON)
    let uri = format!("/rest/ping.view?u={}&p=password123&v=1.16.1&c=test&f=json", username);
    let req = Request::builder().uri(&uri).body(Body::empty()).unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["subsonic-response"]["status"], "ok");

    // 2. getLicense (valid=true)
    let lic_uri = format!("/rest/getLicense.view?u={}&p=password123&v=1.16.1&c=test&f=json", username);
    let lic_req = Request::builder().uri(&lic_uri).body(Body::empty()).unwrap();
    let lic_res = app.clone().oneshot(lic_req).await.unwrap();
    assert_eq!(lic_res.status(), StatusCode::OK);
    let lic_body = lic_res.into_body().collect().await.unwrap().to_bytes();
    let lic_json: serde_json::Value = serde_json::from_slice(&lic_body).unwrap();
    assert_eq!(lic_json["subsonic-response"]["license"]["valid"], true);

    // 3. getLicense (XML format default)
    let xml_uri = format!("/rest/getLicense.view?u={}&p=password123&v=1.16.1&c=test", username);
    let xml_req = Request::builder().uri(&xml_uri).body(Body::empty()).unwrap();
    let xml_res = app.clone().oneshot(xml_req).await.unwrap();
    assert_eq!(xml_res.status(), StatusCode::OK);
    let xml_body = xml_res.into_body().collect().await.unwrap().to_bytes();
    let xml_str = String::from_utf8_lossy(&xml_body);
    assert!(xml_str.contains("<license valid=\"true\""));
}

#[tokio::test]
async fn test_subsonic_browsing_endpoints() {
    let (app, username, track_id, _dir) = setup_subsonic_test().await;

    // 1. getIndexes
    let uri = format!("/rest/getIndexes.view?u={}&p=password123&v=1.16.1&c=test&f=json", username);
    let res = app.clone().oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 2. getAlbumList2
    let album_uri = format!("/rest/getAlbumList2.view?u={}&p=password123&v=1.16.1&c=test&type=newest&f=json", username);
    let album_res = app.clone().oneshot(Request::builder().uri(&album_uri).body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(album_res.status(), StatusCode::OK);
    let body = album_res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let albums = json["subsonic-response"]["albumList2"]["album"].as_array().unwrap();
    assert_eq!(albums.len(), 1);
    assert_eq!(albums[0]["name"], "Discovery");

    // 3. getSong
    let song_uri = format!("/rest/getSong.view?u={}&p=password123&v=1.16.1&c=test&id={}&f=json", username, track_id);
    let song_res = app.clone().oneshot(Request::builder().uri(&song_uri).body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(song_res.status(), StatusCode::OK);
    let song_body = song_res.into_body().collect().await.unwrap().to_bytes();
    let song_json: serde_json::Value = serde_json::from_slice(&song_body).unwrap();
    assert_eq!(song_json["subsonic-response"]["song"]["title"], "One More Time");
}

#[tokio::test]
async fn test_subsonic_stream_with_range_headers() {
    let (app, _username, track_id, _dir) = setup_subsonic_test().await;

    // 1. Requête Range partielle: bytes=0-9 (10 premiers octets)
    let stream_uri = format!("/rest/stream.view?id={}", track_id);
    let req = Request::builder()
        .uri(&stream_uri)
        .header(RANGE, "bytes=0-9")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(res.headers().get("Content-Range").unwrap(), "bytes 0-9/36");
    assert_eq!(res.headers().get("Content-Length").unwrap(), "10");

    let body = res.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&body[..], b"1234567890");

    // 2. Requête stream complète
    let full_req = Request::builder()
        .uri(&stream_uri)
        .body(Body::empty())
        .unwrap();
    let full_res = app.clone().oneshot(full_req).await.unwrap();
    assert_eq!(full_res.status(), StatusCode::OK);
    assert_eq!(full_res.headers().get("Content-Length").unwrap(), "36");
}
