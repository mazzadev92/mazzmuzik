use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use mazzmuzik_db::{create_pool, run_migrations};
use mazzmuzik_server::{app_router, AppConfig, AppState};
use tower::ServiceExt;

async fn setup_test_app() -> axum::Router {
    let pool = create_pool(":memory:", 5).await.expect("Failed to create memory DB");
    run_migrations(&pool).await.expect("Failed to run migrations");

    let mut config = AppConfig::default();
    config.library.music_dir = "tests_music_dir".to_string();

    let state = AppState::new(pool, config);
    app_router(state)
}

#[tokio::test]
async fn test_web_ui_served() {
    let app = setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8_lossy(&body);
    assert!(body_str.contains("Mazz MuZik"));
    assert!(body_str.contains("GPL-3.0"));
}

#[tokio::test]
async fn test_setup_first_user_and_login() {
    let app = setup_test_app().await;

    // 1. Initial Setup
    let setup_payload = serde_json::json!({
        "username": "admin",
        "password": "initial_password_123"
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/setup")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&setup_payload).unwrap()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    // 2. Second setup must be rejected
    let req2 = Request::builder()
        .method("POST")
        .uri("/api/setup")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&setup_payload).unwrap()))
        .unwrap();
    let res2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::BAD_REQUEST);

    // 3. Login with valid credentials
    let login_payload = serde_json::json!({
        "username": "admin",
        "password": "initial_password_123"
    });
    let login_req = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
        .unwrap();
    let login_res = app.clone().oneshot(login_req).await.unwrap();
    assert_eq!(login_res.status(), StatusCode::OK);

    // 4. Login with invalid password
    let bad_login = serde_json::json!({
        "username": "admin",
        "password": "wrong_password"
    });
    let bad_req = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&bad_login).unwrap()))
        .unwrap();
    let bad_res = app.clone().oneshot(bad_req).await.unwrap();
    assert_eq!(bad_res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_library_and_import_api() {
    let app = setup_test_app().await;

    // 1. Stats
    let stats_req = Request::builder().uri("/api/library").body(Body::empty()).unwrap();
    let stats_res = app.clone().oneshot(stats_req).await.unwrap();
    assert_eq!(stats_res.status(), StatusCode::OK);

    // 2. Import CSV playlist
    let csv_content = "Title,Artist,Album\nGenesis,Justice,Cross\nNightcall,Kavinsky,OutRun\n";
    let import_payload = serde_json::json!({
        "csv_content": csv_content,
        "playlist_name": "Electro Classics"
    });
    let import_req = Request::builder()
        .method("POST")
        .uri("/api/import")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&import_payload).unwrap()))
        .unwrap();
    let import_res = app.clone().oneshot(import_req).await.unwrap();
    assert_eq!(import_res.status(), StatusCode::OK);

    // 3. Queue consultation
    let queue_req = Request::builder().uri("/api/queue").body(Body::empty()).unwrap();
    let queue_res = app.clone().oneshot(queue_req).await.unwrap();
    assert_eq!(queue_res.status(), StatusCode::OK);
    let body = queue_res.into_body().collect().await.unwrap().to_bytes();
    let items: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["query_title"], "Genesis");
    assert_eq!(items[1]["query_title"], "Nightcall");
}
