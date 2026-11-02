use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, RANGE};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use std::collections::HashMap;
use std::io::SeekFrom;
use std::path::Path;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;
use mazzmuzik_db::{
    AlbumRepository, ArtistRepository, GenreRepository, Track, TrackRepository,
};
use crate::routes::subsonic::auth::authenticate_subsonic;
use crate::routes::subsonic::models::*;
use crate::state::AppState;

pub fn wrap_response<T: serde::Serialize>(
    body: Option<T>,
    error: Option<SubsonicError>,
    is_json: bool,
) -> Response {
    let status = if error.is_some() { "failed" } else { "ok" };
    let resp = SubsonicResponseWrapper {
        subsonic_response: SubsonicResponse {
            status: status.to_string(),
            version: "1.16.1".to_string(),
            xmlns: Some("http://subsonic.org/restapi".to_string()),
            body,
            error,
        },
    };

    if is_json {
        Json(resp).into_response()
    } else {
        let xml = if let Ok(val) = serde_json::to_value(&resp) {
            json_to_subsonic_xml(&val)
        } else {
            quick_xml::se::to_string(&resp).unwrap_or_default()
        };

        (
            StatusCode::OK,
            [("Content-Type", "application/xml; charset=utf-8")],
            format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n{}", xml),
        ).into_response()
    }
}

fn json_to_subsonic_xml(v: &serde_json::Value) -> String {
    let root = &v["subsonic-response"];
    let status = root["status"].as_str().unwrap_or("ok");
    let version = root["version"].as_str().unwrap_or("1.16.1");

    let mut out = format!(
        "<subsonic-response xmlns=\"http://subsonic.org/restapi\" status=\"{}\" version=\"{}\">",
        status, version
    );

    if let Some(err) = root.get("error") {
        let code = err["code"].as_i64().unwrap_or(0);
        let msg = err["message"].as_str().unwrap_or("");
        out.push_str(&format!("<error code=\"{}\" message=\"{}\"/>", code, msg));
    }

    if let Some(lic) = root.get("license") {
        let valid = lic["valid"].as_bool().unwrap_or(true);
        let email = lic["email"].as_str().unwrap_or("user@mazzmuzik.local");
        out.push_str(&format!("<license valid=\"{}\" email=\"{}\"/>", valid, email));
    }

    out.push_str("</subsonic-response>");
    out
}

pub fn make_error(code: i32, message: &str, is_json: bool) -> Response {
    wrap_response::<()>(
        None,
        Some(SubsonicError {
            code,
            message: message.to_string(),
        }),
        is_json,
    )
}

fn track_to_child(t: &Track, artist_name: &str, album_title: Option<&str>) -> SubsonicChild {
    let ext = Path::new(&t.file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("flac");

    SubsonicChild {
        id: t.id.clone(),
        parent: t.album_id.clone(),
        is_dir: false,
        title: t.title.clone(),
        album: album_title.map(|s| s.to_string()),
        artist: artist_name.to_string(),
        track: t.track_number,
        year: None,
        genre: None,
        cover_art: t.album_id.clone().or_else(|| Some(t.id.clone())),
        size: t.file_size,
        content_type: t.mime_type.clone(),
        suffix: ext.to_string(),
        duration: (t.duration_ms / 1000) as i32,
        bit_rate: t.bitrate,
        path: t.file_path.clone(),
        play_count: t.play_count,
        starred: None,
        artist_id: t.artist_id.clone(),
        type_field: Some("music".to_string()),
    }
}

// 1. ping.view
pub async fn ping(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }
    wrap_response::<HashMap<String, String>>(Some(HashMap::new()), None, is_json)
}

// 2. getLicense.view
pub async fn get_license(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }
    wrap_response(
        Some(LicenseResponse {
            license: LicenseInfo {
                valid: true,
                email: "user@mazzmuzik.local".to_string(),
                license_expires: Some("2099-12-31T23:59:59".to_string()),
            },
        }),
        None,
        is_json,
    )
}

// 3. getMusicFolders.view
pub async fn get_music_folders(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }
    wrap_response(
        Some(MusicFoldersResponse {
            music_folders: MusicFoldersList {
                music_folder: vec![MusicFolderItem {
                    id: 1,
                    name: "Mazz MuZik Library".to_string(),
                }],
            },
        }),
        None,
        is_json,
    )
}

// 4. getIndexes.view
pub async fn get_indexes(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let artists = ArtistRepository::list_all(&state.pool).await.unwrap_or_default();
    let mut groups: HashMap<String, Vec<SubsonicArtistShort>> = HashMap::new();

    for a in artists {
        let initial = a.name.chars().next().unwrap_or('#').to_uppercase().to_string();
        let key = if initial.chars().all(|c| c.is_alphabetic()) { initial } else { "#".to_string() };
        groups.entry(key).or_default().push(SubsonicArtistShort {
            id: a.id,
            name: a.name,
            album_count: None,
        });
    }

    let mut index_list = Vec::new();
    let mut sorted_keys: Vec<String> = groups.keys().cloned().collect();
    sorted_keys.sort();

    for key in sorted_keys {
        if let Some(mut artists_in_group) = groups.remove(&key) {
            artists_in_group.sort_by(|a, b| a.name.cmp(&b.name));
            index_list.push(IndexGroup {
                name: key,
                artist: artists_in_group,
            });
        }
    }

    wrap_response(
        Some(IndexesResponse {
            indexes: IndexesList {
                last_modified: chrono::Utc::now().timestamp_millis(),
                ignored_articles: "The El La Los Las Le Les".to_string(),
                index: index_list,
            },
        }),
        None,
        is_json,
    )
}

// 5. getArtists.view
pub async fn get_artists(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let artists = ArtistRepository::list_all(&state.pool).await.unwrap_or_default();
    let mut groups: HashMap<String, Vec<SubsonicArtistShort>> = HashMap::new();

    for a in artists {
        let initial = a.name.chars().next().unwrap_or('#').to_uppercase().to_string();
        let key = if initial.chars().all(|c| c.is_alphabetic()) { initial } else { "#".to_string() };
        groups.entry(key).or_default().push(SubsonicArtistShort {
            id: a.id,
            name: a.name,
            album_count: None,
        });
    }

    let mut index_list = Vec::new();
    let mut sorted_keys: Vec<String> = groups.keys().cloned().collect();
    sorted_keys.sort();

    for key in sorted_keys {
        if let Some(artists_in_group) = groups.remove(&key) {
            index_list.push(IndexGroup {
                name: key,
                artist: artists_in_group,
            });
        }
    }

    wrap_response(
        Some(ArtistsResponse {
            artists: ArtistsList {
                ignored_articles: "The".to_string(),
                index: index_list,
            },
        }),
        None,
        is_json,
    )
}

// 6. getArtist.view
pub async fn get_artist(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let artist_id = match &params.id {
        Some(id) => id,
        None => return make_error(10, "Required parameter 'id' is missing", is_json),
    };

    let artist = match ArtistRepository::find_by_id(&state.pool, artist_id).await {
        Ok(a) => a,
        Err(_) => return make_error(70, "Artist not found", is_json),
    };

    let albums = AlbumRepository::list_by_artist(&state.pool, &artist.id).await.unwrap_or_default();
    let album_shorts: Vec<SubsonicAlbumShort> = albums.into_iter().map(|alb| {
        SubsonicAlbumShort {
            id: alb.id.clone(),
            name: alb.title,
            artist: artist.name.clone(),
            artist_id: artist.id.clone(),
            song_count: alb.total_tracks.unwrap_or(1),
            duration: 0,
            created: alb.created_at.to_string(),
            year: alb.release_year,
            cover_art: Some(alb.id),
        }
    }).collect();

    wrap_response(
        Some(ArtistDetailResponse {
            artist: SubsonicArtistDetail {
                id: artist.id,
                name: artist.name,
                album_count: album_shorts.len() as i32,
                album: album_shorts,
            },
        }),
        None,
        is_json,
    )
}

// 7. getAlbumList2.view
pub async fn get_album_list2(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let albums = AlbumRepository::list_all(&state.pool).await.unwrap_or_default();
    let mut album_shorts = Vec::new();

    for alb in albums {
        let artist_name = ArtistRepository::find_by_id(&state.pool, &alb.artist_id)
            .await
            .map(|a| a.name)
            .unwrap_or_else(|_| "Unknown Artist".to_string());

        album_shorts.push(SubsonicAlbumShort {
            id: alb.id.clone(),
            name: alb.title,
            artist: artist_name,
            artist_id: alb.artist_id,
            song_count: alb.total_tracks.unwrap_or(1),
            duration: 0,
            created: alb.created_at.to_string(),
            year: alb.release_year,
            cover_art: Some(alb.id),
        });
    }

    wrap_response(
        Some(AlbumList2Response {
            album_list2: AlbumList2Container {
                album: album_shorts,
            },
        }),
        None,
        is_json,
    )
}

// 8. getAlbum.view
pub async fn get_album(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let album_id = match &params.id {
        Some(id) => id,
        None => return make_error(10, "Required parameter 'id' is missing", is_json),
    };

    let album = match AlbumRepository::find_by_id(&state.pool, album_id).await {
        Ok(a) => a,
        Err(_) => return make_error(70, "Album not found", is_json),
    };

    let artist = ArtistRepository::find_by_id(&state.pool, &album.artist_id)
        .await
        .map(|a| a.name)
        .unwrap_or_else(|_| "Unknown Artist".to_string());

    let tracks = TrackRepository::list_by_album(&state.pool, &album.id).await.unwrap_or_default();
    let total_duration = tracks.iter().map(|t| (t.duration_ms / 1000) as i32).sum();

    let song_children: Vec<SubsonicChild> = tracks
        .into_iter()
        .map(|t| track_to_child(&t, &artist, Some(&album.title)))
        .collect();

    wrap_response(
        Some(AlbumDetailResponse {
            album: SubsonicAlbumDetail {
                id: album.id.clone(),
                name: album.title.clone(),
                artist,
                artist_id: album.artist_id,
                song_count: song_children.len() as i32,
                duration: total_duration,
                created: album.created_at.to_string(),
                year: album.release_year,
                cover_art: Some(album.id),
                song: song_children,
            },
        }),
        None,
        is_json,
    )
}

// 9. getSong.view
pub async fn get_song(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let song_id = match &params.id {
        Some(id) => id,
        None => return make_error(10, "Required parameter 'id' is missing", is_json),
    };

    let track = match TrackRepository::find_by_id(&state.pool, song_id).await {
        Ok(t) => t,
        Err(_) => return make_error(70, "Song not found", is_json),
    };

    let artist_name = ArtistRepository::find_by_id(&state.pool, &track.artist_id)
        .await
        .map(|a| a.name)
        .unwrap_or_else(|_| "Unknown Artist".to_string());

    let album_title = if let Some(alb_id) = &track.album_id {
        AlbumRepository::find_by_id(&state.pool, alb_id).await.ok().map(|a| a.title)
    } else {
        None
    };

    wrap_response(
        Some(SongResponse {
            song: track_to_child(&track, &artist_name, album_title.as_deref()),
        }),
        None,
        is_json,
    )
}

// 10. getRandomSongs.view
pub async fn get_random_songs(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let tracks = TrackRepository::get_random_tracks(&state.pool, 25).await.unwrap_or_default();
    let mut songs = Vec::new();
    for t in tracks {
        let artist = ArtistRepository::find_by_id(&state.pool, &t.artist_id).await.map(|a| a.name).unwrap_or_default();
        songs.push(track_to_child(&t, &artist, None));
    }

    wrap_response(
        Some(SongsListResponse {
            songs: SongsListContainer { song: songs },
        }),
        None,
        is_json,
    )
}

// 11. getTopSongs.view
pub async fn get_top_songs(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let tracks = TrackRepository::get_top_tracks(&state.pool, 25).await.unwrap_or_default();
    let mut songs = Vec::new();
    for t in tracks {
        let artist = ArtistRepository::find_by_id(&state.pool, &t.artist_id).await.map(|a| a.name).unwrap_or_default();
        songs.push(track_to_child(&t, &artist, None));
    }

    wrap_response(
        Some(SongsListResponse {
            songs: SongsListContainer { song: songs },
        }),
        None,
        is_json,
    )
}

// 12. getGenres.view
pub async fn get_genres(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Err(_) = authenticate_subsonic(&state, &params).await {
        return make_error(40, "Wrong username or password", is_json);
    }

    let genres = GenreRepository::list_all(&state.pool).await.unwrap_or_default();
    let genre_items: Vec<GenreItem> = genres.into_iter().map(|g| {
        GenreItem {
            value: g.name,
            song_count: 1,
            album_count: 1,
        }
    }).collect();

    wrap_response(
        Some(GenresResponse {
            genres: GenresContainer { genre: genre_items },
        }),
        None,
        is_json,
    )
}

// 13. getScanStatus.view & startScan.view
pub async fn get_scan_status(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    let count = TrackRepository::count(&state.pool).await.unwrap_or(0);
    wrap_response(
        Some(ScanStatusResponse {
            scan_status: ScanStatusInfo {
                scanning: false,
                count,
            },
        }),
        None,
        is_json,
    )
}

pub async fn start_scan(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    let count = TrackRepository::count(&state.pool).await.unwrap_or(0);
    wrap_response(
        Some(ScanStatusResponse {
            scan_status: ScanStatusInfo {
                scanning: true,
                count,
            },
        }),
        None,
        is_json,
    )
}

// 14. getLyrics.view
pub async fn get_lyrics(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    if let Some(song_id) = &params.id {
        if let Ok(track) = TrackRepository::find_by_id(&state.pool, song_id).await {
            if let Some(lrc_path) = track.lrc_path {
                if let Ok(content) = tokio::fs::read_to_string(&lrc_path).await {
                    let artist = ArtistRepository::find_by_id(&state.pool, &track.artist_id)
                        .await.map(|a| a.name).unwrap_or_default();
                    return wrap_response(
                        Some(LyricsResponse {
                            lyrics: LyricsContainer {
                                artist,
                                title: track.title,
                                value: content,
                            },
                        }),
                        None,
                        is_json,
                    );
                }
            }
        }
    }
    wrap_response(
        Some(LyricsResponse {
            lyrics: LyricsContainer {
                artist: "".to_string(),
                title: "".to_string(),
                value: "".to_string(),
            },
        }),
        None,
        is_json,
    )
}

// 15. search3.view
pub async fn search3(
    State(state): State<AppState>,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let is_json = params.f.as_deref() == Some("json");
    let query_str = params.query.clone().unwrap_or_default();

    let tracks = TrackRepository::search(&state.pool, &query_str, 20).await.unwrap_or_default();
    let mut song_children = Vec::new();
    for t in tracks {
        let artist_name = ArtistRepository::find_by_id(&state.pool, &t.artist_id).await.map(|a| a.name).unwrap_or_default();
        song_children.push(track_to_child(&t, &artist_name, None));
    }

    wrap_response(
        Some(Search3Response {
            search_result3: SearchResult3Container {
                artist: vec![],
                album: vec![],
                song: song_children,
            },
        }),
        None,
        is_json,
    )
}

// 16. stream.view — Support strict des HTTP Range headers (HTTP 206 Partial Content / 200 OK)
pub async fn stream(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<SubsonicAuthParams>,
) -> Response {
    let song_id = match &params.id {
        Some(id) => id,
        None => return StatusCode::BAD_REQUEST.into_response(),
    };

    let track = match TrackRepository::find_by_id(&state.pool, song_id).await {
        Ok(t) => t,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    let path = Path::new(&track.file_path);
    let mut file = match File::open(path).await {
        Ok(f) => f,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    let total_len = match file.metadata().await {
        Ok(m) => m.len(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let mime = track.mime_type;

    // Gestion du header Range: bytes=start-end
    if let Some(range_header) = headers.get(RANGE).and_then(|h| h.to_str().ok()) {
        if let Some(range_str) = range_header.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_str.split('-').collect();
            let start: u64 = parts[0].parse().unwrap_or(0);
            let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                parts[1].parse().unwrap_or(total_len - 1)
            } else {
                total_len - 1
            };

            if start <= end && end < total_len {
                let range_length = end - start + 1;
                if file.seek(SeekFrom::Start(start)).await.is_ok() {
                    let stream = ReaderStream::new(file.take(range_length));
                    let body = Body::from_stream(stream);

                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(CONTENT_TYPE, mime)
                        .header(ACCEPT_RANGES, "bytes")
                        .header(CONTENT_LENGTH, range_length.to_string())
                        .header(CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, total_len))
                        .body(body)
                        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
                }
            }
        }
    }

    // Réponse complète (200 OK)
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, mime)
        .header(ACCEPT_RANGES, "bytes")
        .header(CONTENT_LENGTH, total_len.to_string())
        .body(body)
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}
