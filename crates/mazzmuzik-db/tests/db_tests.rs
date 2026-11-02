use mazzmuzik_db::{
    create_pool, run_migrations, AlbumRepository, ArtistRepository, FavoriteRepository,
    GenreRepository, PlayQueueRepository, PlaylistRepository, QueueRepository,
    ResolutionCacheRepository, Track, TrackRepository, UserRepository,
};
use uuid::Uuid;

async fn setup_test_db() -> mazzmuzik_db::DbPool {
    let pool = create_pool(":memory:", 5).await.expect("Failed to create memory pool");
    run_migrations(&pool).await.expect("Failed to run migrations");
    pool
}

#[tokio::test]
async fn test_migrations_and_foreign_keys() {
    let pool = setup_test_db().await;
    let count = UserRepository::count(&pool).await.expect("Failed to count users");
    assert_eq!(count, 0);
}

#[tokio::test]
async fn test_user_creation_and_argon2_auth() {
    let pool = setup_test_db().await;

    // 1. Initial count is 0
    assert_eq!(UserRepository::count(&pool).await.unwrap(), 0);

    // 2. Create admin user
    let user = UserRepository::create_user(&pool, "admin", "supersecret123").await.unwrap();
    assert_eq!(user.username, "admin");
    assert_ne!(user.password_hash, "supersecret123");
    assert!(user.password_hash.starts_with("$argon2"));

    // 3. Count is now 1
    assert_eq!(UserRepository::count(&pool).await.unwrap(), 1);

    // 4. Verification succeeds on right password, fails on wrong password
    let valid = UserRepository::verify_password("supersecret123", &user.password_hash).unwrap();
    assert!(valid);
    let invalid = UserRepository::verify_password("wrongpassword", &user.password_hash).unwrap();
    assert!(!invalid);

    // 5. Look up by username
    let found = UserRepository::find_by_username(&pool, "admin").await.unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, user.id);
}

#[tokio::test]
async fn test_singles_album_created_on_the_fly() {
    let pool = setup_test_db().await;

    // 1. Create artist
    let artist = ArtistRepository::get_or_create(&pool, "Daft Punk", "daft punk", None).await.unwrap();

    // 2. Create track without album (album_id is None)
    let orphan_track_id = Uuid::new_v4().to_string();
    let orphan_track = Track {
        id: orphan_track_id.clone(),
        album_id: None,
        artist_id: artist.id.clone(),
        title: "Aerodynamic (Daft Club Remix)".to_string(),
        normalized_title: "aerodynamic daft club remix".to_string(),
        track_number: Some(1),
        disc_number: Some(1),
        duration_ms: 212000,
        isrc: None,
        mbid: None,
        file_path: "Daft Punk/Singles/01 - Aerodynamic.flac".to_string(),
        file_size: 24000000,
        mime_type: "audio/flac".to_string(),
        bitrate: Some(900),
        format: "flac".to_string(),
        lrc_path: None,
        audio_fingerprint: Some("fp_daft_123".to_string()),
        play_count: 0,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };
    let inserted = TrackRepository::insert(&pool, &orphan_track).await.unwrap();
    assert!(inserted.album_id.is_none());

    // 3. Create Singles album on the fly for Daft Punk
    let singles_album = AlbumRepository::get_or_create_singles_album(&pool, &artist.id).await.unwrap();
    assert_eq!(singles_album.title, "Singles");
    assert_eq!(singles_album.normalized_title, "singles");
    assert_eq!(singles_album.artist_id, artist.id);

    // 4. Calling get_or_create_singles_album again returns the exact same album
    let singles_again = AlbumRepository::get_or_create_singles_album(&pool, &artist.id).await.unwrap();
    assert_eq!(singles_album.id, singles_again.id);
}

#[tokio::test]
async fn test_resolution_cache_unique_constraint() {
    let pool = setup_test_db().await;

    let query_hash = "abc123hash";

    // 1. Insert cache for provider "ytmusic"
    ResolutionCacheRepository::set(
        &pool,
        query_hash,
        "ytmusic",
        "yt_vid_1",
        "https://music.youtube.com/watch?v=yt_vid_1",
        "Get Lucky",
        "Daft Punk",
        248000,
        0.95,
        None,
        7,
    ).await.unwrap();

    // 2. Insert cache for provider "deezer" for the same query_hash (MUST SUCCEED thanks to UNIQUE(query_hash, source_provider))
    ResolutionCacheRepository::set(
        &pool,
        query_hash,
        "deezer",
        "dz_trk_1",
        "https://deezer.com/track/dz_trk_1",
        "Get Lucky",
        "Daft Punk",
        248000,
        0.92,
        None,
        7,
    ).await.unwrap();

    // 3. Both exist independently
    let yt_entry = ResolutionCacheRepository::get(&pool, query_hash, "ytmusic").await.unwrap();
    assert!(yt_entry.is_some());
    assert_eq!(yt_entry.unwrap().external_id, "yt_vid_1");

    let dz_entry = ResolutionCacheRepository::get(&pool, query_hash, "deezer").await.unwrap();
    assert!(dz_entry.is_some());
    assert_eq!(dz_entry.unwrap().external_id, "dz_trk_1");

    // 4. Overwrite "ytmusic" updates the row without conflict error
    ResolutionCacheRepository::set(
        &pool,
        query_hash,
        "ytmusic",
        "yt_vid_updated",
        "https://music.youtube.com/watch?v=yt_vid_updated",
        "Get Lucky",
        "Daft Punk",
        248000,
        0.98,
        None,
        7,
    ).await.unwrap();

    let yt_updated = ResolutionCacheRepository::get(&pool, query_hash, "ytmusic").await.unwrap();
    assert_eq!(yt_updated.unwrap().external_id, "yt_vid_updated");
}

#[tokio::test]
async fn test_queue_status_check_constraint() {
    let pool = setup_test_db().await;

    // 1. Normal push with valid status "pending" works
    let item = QueueRepository::push(&pool, "One More Time", "Daft Punk", Some("Discovery"), "flac", 10).await.unwrap();
    assert_eq!(item.status, "pending");

    // 2. Transition through allowed states works
    QueueRepository::update_status(&pool, &item.id, "downloading", 0.5, None, None).await.unwrap();
    let updated = QueueRepository::find_by_id(&pool, &item.id).await.unwrap();
    assert_eq!(updated.status, "downloading");
    assert_eq!(updated.download_progress, 0.5);

    // 3. Attempting an invalid status must fail because of SQLite CHECK constraint
    let result = sqlx::query("UPDATE download_queue SET status = 'invalid_state' WHERE id = ?")
        .bind(&item.id)
        .execute(&pool)
        .await;
    assert!(result.is_err(), "Expected SQLite CHECK constraint violation on invalid status");
}

#[tokio::test]
async fn test_genres_and_similarity() {
    let pool = setup_test_db().await;

    let artist = ArtistRepository::get_or_create(&pool, "Justice", "justice", None).await.unwrap();
    let album = AlbumRepository::get_or_create(&pool, &artist.id, "Cross", "cross", None, Some(2007)).await.unwrap();

    let track1 = Track {
        id: Uuid::new_v4().to_string(),
        album_id: Some(album.id.clone()),
        artist_id: artist.id.clone(),
        title: "Genesis".to_string(),
        normalized_title: "genesis".to_string(),
        track_number: Some(1),
        disc_number: Some(1),
        duration_ms: 234000,
        isrc: None,
        mbid: None,
        file_path: "Justice/Cross/01 - Genesis.flac".to_string(),
        file_size: 25000000,
        mime_type: "audio/flac".to_string(),
        bitrate: Some(950),
        format: "flac".to_string(),
        lrc_path: None,
        audio_fingerprint: None,
        play_count: 5,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };
    TrackRepository::insert(&pool, &track1).await.unwrap();

    let track2 = Track {
        id: Uuid::new_v4().to_string(),
        album_id: Some(album.id.clone()),
        artist_id: artist.id.clone(),
        title: "Let There Be Light".to_string(),
        normalized_title: "let there be light".to_string(),
        track_number: Some(2),
        disc_number: Some(1),
        duration_ms: 295000,
        isrc: None,
        mbid: None,
        file_path: "Justice/Cross/02 - Let There Be Light.flac".to_string(),
        file_size: 30000000,
        mime_type: "audio/flac".to_string(),
        bitrate: Some(950),
        format: "flac".to_string(),
        lrc_path: None,
        audio_fingerprint: None,
        play_count: 3,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };
    TrackRepository::insert(&pool, &track2).await.unwrap();

    // Link genre "Electro House" to both tracks
    let genre = GenreRepository::get_or_create(&pool, "Electro House").await.unwrap();
    GenreRepository::link_track(&pool, &track1.id, &genre.id).await.unwrap();
    GenreRepository::link_track(&pool, &track2.id, &genre.id).await.unwrap();

    let track1_genres = GenreRepository::get_genres_for_track(&pool, &track1.id).await.unwrap();
    assert_eq!(track1_genres.len(), 1);
    assert_eq!(track1_genres[0].name, "Electro House");

    let similar = GenreRepository::find_similar_tracks_by_genre(&pool, &track1.id, 5).await.unwrap();
    assert_eq!(similar.len(), 1);
    assert_eq!(similar[0], track2.id);
}

#[tokio::test]
async fn test_playlists_and_favorites() {
    let pool = setup_test_db().await;

    let user = UserRepository::create_user(&pool, "listener", "secret").await.unwrap();
    let artist = ArtistRepository::get_or_create(&pool, "Kavinsky", "kavinsky", None).await.unwrap();
    let track = Track {
        id: Uuid::new_v4().to_string(),
        album_id: None,
        artist_id: artist.id.clone(),
        title: "Nightcall".to_string(),
        normalized_title: "nightcall".to_string(),
        track_number: Some(1),
        disc_number: Some(1),
        duration_ms: 259000,
        isrc: None,
        mbid: None,
        file_path: "Kavinsky/Singles/01 - Nightcall.flac".to_string(),
        file_size: 27000000,
        mime_type: "audio/flac".to_string(),
        bitrate: Some(900),
        format: "flac".to_string(),
        lrc_path: None,
        audio_fingerprint: None,
        play_count: 0,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };
    TrackRepository::insert(&pool, &track).await.unwrap();

    // Playlists
    let playlist = PlaylistRepository::create(&pool, "Night Drive", Some("Best synthwave")).await.unwrap();
    PlaylistRepository::add_track(&pool, &playlist.id, &track.id).await.unwrap();
    let playlist_tracks = PlaylistRepository::get_tracks(&pool, &playlist.id).await.unwrap();
    assert_eq!(playlist_tracks.len(), 1);
    assert_eq!(playlist_tracks[0].id, track.id);

    // Favorites
    FavoriteRepository::star(&pool, &user.id, "track", &track.id).await.unwrap();
    let is_fav = FavoriteRepository::is_starred(&pool, &user.id, "track", &track.id).await.unwrap();
    assert!(is_fav);

    FavoriteRepository::unstar(&pool, &user.id, "track", &track.id).await.unwrap();
    let is_fav_after = FavoriteRepository::is_starred(&pool, &user.id, "track", &track.id).await.unwrap();
    assert!(!is_fav_after);
}

#[tokio::test]
async fn test_play_queue_persistence() {
    let pool = setup_test_db().await;
    let user = UserRepository::create_user(&pool, "mobile_user", "password").await.unwrap();
    let artist = ArtistRepository::get_or_create(&pool, "Perturbator", "perturbator", None).await.unwrap();
    
    let track = Track {
        id: Uuid::new_v4().to_string(),
        album_id: None,
        artist_id: artist.id.clone(),
        title: "Future Club".to_string(),
        normalized_title: "future club".to_string(),
        track_number: Some(1),
        disc_number: Some(1),
        duration_ms: 289000,
        isrc: None,
        mbid: None,
        file_path: "Perturbator/Singles/01 - Future Club.flac".to_string(),
        file_size: 32000000,
        mime_type: "audio/flac".to_string(),
        bitrate: Some(920),
        format: "flac".to_string(),
        lrc_path: None,
        audio_fingerprint: None,
        play_count: 0,
        last_played_at: None,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };
    let inserted_track = TrackRepository::insert(&pool, &track).await.unwrap();

    let queue_json = format!(r#"["{}"]"#, inserted_track.id);
    PlayQueueRepository::save_queue(&pool, &user.id, Some(&inserted_track.id), 45000, &queue_json).await.unwrap();

    let loaded = PlayQueueRepository::get_queue(&pool, &user.id).await.unwrap();
    assert!(loaded.is_some());
    let queue = loaded.unwrap();
    assert_eq!(queue.current_track_id.as_deref(), Some(inserted_track.id.as_str()));
    assert_eq!(queue.position_ms, 45000);
    assert_eq!(queue.queue_json, queue_json);
}
