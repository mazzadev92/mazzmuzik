use mazzmuzik_core::{
    Deduplicator, FileOrganizer, LyricsManager, PoTokenConfig, PoTokenProvider,
};
use tempfile::tempdir;

#[test]
fn test_file_organizer_sanitization_and_hierarchy() {
    // 1. Caractères interdits Windows/POSIX
    let clean = FileOrganizer::sanitize_filename("AC/DC: Back *in* Black? <Yes> | \"Real\"");
    assert!(!clean.contains('/'));
    assert!(!clean.contains('\\'));
    assert!(!clean.contains(':'));
    assert!(!clean.contains('*'));
    assert!(!clean.contains('?'));
    assert!(!clean.contains('"'));
    assert!(!clean.contains('<'));
    assert!(!clean.contains('>'));
    assert!(!clean.contains('|'));

    // 2. Rangement Artiste/Album/TT - Titre.ext
    let rel_path = FileOrganizer::build_relative_path(
        "Kavinsky",
        Some("OutRun"),
        Some(7),
        "Nightcall",
        "flac",
    );
    let s = rel_path.to_str().unwrap().replace('\\', "/");
    assert_eq!(s, "Kavinsky/OutRun/07 - Nightcall.flac");

    // 3. Morceau orphelin (sans album) rangé dans "Singles"
    let singles_path = FileOrganizer::build_relative_path(
        "Daft Punk",
        None,
        None,
        "Human After All (Remix)",
        "flac",
    );
    let s_singles = singles_path.to_str().unwrap().replace('\\', "/");
    assert_eq!(s_singles, "Daft Punk/Singles/01 - Human After All (Remix).flac");
}

#[tokio::test]
async fn test_lyrics_manager_lrc_read_write() {
    let dir = tempdir().expect("Failed to create tempdir");
    let audio_file = dir.path().join("01 - Test Song.flac");
    tokio::fs::write(&audio_file, b"fake audio content").await.unwrap();

    let lrc_content = "[00:12.50] Première ligne de paroles\n[00:15.80] Deuxième ligne synchronisée\n";
    let lrc_path = LyricsManager::write_lrc_file(&audio_file, lrc_content).await.expect("Failed to write lrc");

    assert!(lrc_path.exists());
    assert_eq!(lrc_path.extension().unwrap(), "lrc");

    let read_back = LyricsManager::read_lrc_file(&audio_file).await.unwrap();
    assert!(read_back.is_some());
    assert_eq!(read_back.unwrap(), lrc_content.trim());
}

#[tokio::test]
async fn test_deduplicator_file_fingerprint() {
    let dir = tempdir().expect("Failed to create tempdir");
    let file1 = dir.path().join("track1.flac");
    let file2 = dir.path().join("track2.flac");

    tokio::fs::write(&file1, b"identical audio bytes").await.unwrap();
    tokio::fs::write(&file2, b"identical audio bytes").await.unwrap();

    let fp1 = Deduplicator::compute_file_fingerprint(&file1).await.unwrap();
    let fp2 = Deduplicator::compute_file_fingerprint(&file2).await.unwrap();

    assert_eq!(fp1, fp2);
    assert!(!fp1.is_empty());
}

#[test]
fn test_potoken_extractor_args() {
    let provider = PoTokenProvider::new(PoTokenConfig::default());

    // Sans token
    let args_default = provider.build_extractor_args(None);
    assert_eq!(args_default, vec!["--extractor-args", "youtube:player_client=ios,web"]);

    // Avec token
    let args_with_token = provider.build_extractor_args(Some("token_xyz_123"));
    assert_eq!(
        args_with_token,
        vec!["--extractor-args", "youtube:player_client=ios,web;po_token=token_xyz_123"]
    );
}
