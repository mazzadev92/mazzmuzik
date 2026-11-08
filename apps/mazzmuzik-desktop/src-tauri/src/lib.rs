use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const LOCAL_PROXY_PORT: u16 = 28234;

static RUST_STREAM_CACHE: Mutex<Option<HashMap<String, (String, Instant)>>> = Mutex::new(None);

pub async fn run_local_proxy() {
    let listener = match TcpListener::bind(format!("127.0.0.1:{}", LOCAL_PROXY_PORT)).await {
        Ok(l) => l,
        Err(e) => {
            log::warn!("Proxy audio local impossible de lier 127.0.0.1:{}: {}", LOCAL_PROXY_PORT, e);
            return;
        }
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .unwrap_or_default();

    loop {
        if let Ok((mut socket, _)) = listener.accept().await {
            let client = client.clone();
            tokio::spawn(async move {
                let mut buf = [0u8; 4096];
                let n = match socket.read(&mut buf).await {
                    Ok(n) if n > 0 => n,
                    _ => return,
                };

                let req_str = String::from_utf8_lossy(&buf[..n]);
                let first_line = req_str.lines().next().unwrap_or_default();
                let parts: Vec<&str> = first_line.split_whitespace().collect();
                if parts.len() < 2 {
                    return;
                }

                let method = parts[0];
                let path = parts[1];

                if method == "OPTIONS" {
                    let resp = "HTTP/1.1 200 OK\r\n\
                                Access-Control-Allow-Origin: *\r\n\
                                Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
                                Access-Control-Allow-Headers: Range, Content-Type, Accept\r\n\
                                Access-Control-Max-Age: 86400\r\n\
                                Content-Length: 0\r\n\r\n";
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                if !path.starts_with("/stream?url=") {
                    let resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                let raw_encoded = &path["/stream?url=".len()..];
                let target_url = percent_decode_str(raw_encoded);

                let mut req = client.get(&target_url);
                for line in req_str.lines() {
                    let lower = line.to_ascii_lowercase();
                    if lower.starts_with("range:") {
                        if let Some(val) = line.split(':').nth(1) {
                            req = req.header("Range", val.trim());
                        }
                    }
                }

                let upstream = match req.send().await {
                    Ok(r) => r,
                    Err(e) => {
                        let msg = e.to_string();
                        let err_resp = format!(
                            "HTTP/1.1 502 Bad Gateway\r\n\
                             Access-Control-Allow-Origin: *\r\n\
                             Content-Length: {}\r\n\r\n{}",
                            msg.len(),
                            msg
                        );
                        let _ = socket.write_all(err_resp.as_bytes()).await;
                        return;
                    }
                };

                let status = upstream.status();
                let mut headers_str = format!(
                    "HTTP/1.1 {} {}\r\n\
                     Access-Control-Allow-Origin: *\r\n\
                     Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
                     Access-Control-Allow-Headers: Range, Content-Type, Accept\r\n\
                     Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n",
                    status.as_u16(),
                    status.canonical_reason().unwrap_or("OK")
                );

                for (k, v) in upstream.headers() {
                    let name = k.as_str().to_ascii_lowercase();
                    if ["content-type", "content-length", "content-range", "accept-ranges"].contains(&name.as_str()) {
                        if let Ok(val) = v.to_str() {
                            headers_str.push_str(&format!("{}: {}\r\n", k, val));
                        }
                    }
                }
                headers_str.push_str("\r\n");

                if socket.write_all(headers_str.as_bytes()).await.is_err() {
                    return;
                }

                if method == "HEAD" {
                    return;
                }

                let mut stream = upstream.bytes_stream();
                while let Some(chunk_res) = stream.next().await {
                    match chunk_res {
                        Ok(chunk) => {
                            if socket.write_all(&chunk).await.is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            });
        }
    }
}

fn percent_decode_str(s: &str) -> String {
    let mut bytes = Vec::new();
    let mut chars = s.as_bytes().iter().copied();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let h1 = chars.next();
            let h2 = chars.next();
            if let (Some(h1), Some(h2)) = (h1, h2) {
                let s_hex = [h1, h2];
                if let Ok(hex_str) = std::str::from_utf8(&s_hex) {
                    if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                        bytes.push(val);
                        continue;
                    }
                }
                bytes.push(b'%');
                bytes.push(h1);
                bytes.push(h2);
            } else {
                bytes.push(b'%');
            }
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackItem {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    #[serde(rename = "coverUrl")]
    pub cover_url: String,
    pub source: String,
    #[serde(rename = "streamUrl")]
    pub stream_url: Option<String>,
    pub bitrate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtdlpJsonEntry {
    id: Option<String>,
    title: Option<String>,
    uploader: Option<String>,
    artist: Option<String>,
    duration: Option<f64>,
    thumbnail: Option<String>,
    #[serde(rename = "url")]
    _url: Option<String>,
    webpage_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeezerSearchResponse {
    data: Option<Vec<DeezerTrackEntry>>,
}

#[derive(Debug, Deserialize)]
struct DeezerTrackEntry {
    id: i64,
    title: String,
    duration: Option<f64>,
    artist: Option<DeezerArtistEntry>,
    album: Option<DeezerAlbumEntry>,
    preview: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeezerArtistEntry {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeezerAlbumEntry {
    title: Option<String>,
    cover_xl: Option<String>,
    cover_big: Option<String>,
}

const SONGS_PARAM: &str = "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D";
const ALBUMS_PARAM: &str = "EgWKAQIYAWoKEAkQBRAKEAMQBA%3D%3D";
const ARTISTS_PARAM: &str = "EgWKAQIgAWoKEAkQBRAKEAMQBA%3D%3D";

/// Searches YouTube Music using the official InnerTube WEB_REMIX API (zero account, studio tracks)
#[tauri::command]
async fn search_ytmusic(query: String, filter: Option<String>) -> Result<Vec<TrackItem>, String> {
    let params = match filter.as_deref().unwrap_or("songs") {
        "albums" => ALBUMS_PARAM,
        "artists" => ARTISTS_PARAM,
        _ => SONGS_PARAM,
    };

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20241127.01.00",
                "hl": "fr",
                "gl": "FR"
            }
        },
        "query": query,
        "params": params
    });

    let res = client
        .post("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header("Content-Type", "application/json")
        .header("X-Goog-Api-Format-Version", "2")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        .header("Referer", "https://music.youtube.com/")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur requête InnerTube: {}", e))?;

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Erreur décodage JSON InnerTube: {}", e))?;

    let mut tracks = Vec::new();

    if let Some(tabs) = json["contents"]["tabbedSearchResultsRenderer"]["tabs"].as_array() {
        if let Some(first_tab) = tabs.first() {
            if let Some(sections) = first_tab["tabRenderer"]["content"]["sectionListRenderer"]["contents"].as_array() {
                for section in sections {
                    if let Some(shelf) = section["musicShelfRenderer"]["contents"].as_array() {
                        for item in shelf {
                            if let Some(renderer) = item.get("musicResponsiveListItemRenderer") {
                                if let Some(track) = parse_music_responsive_item(renderer) {
                                    tracks.push(track);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(tracks)
}

fn parse_music_responsive_item(renderer: &serde_json::Value) -> Option<TrackItem> {
    let video_id = renderer["playlistItemData"]["videoId"]
        .as_str()
        .or_else(|| renderer["navigationEndpoint"]["watchEndpoint"]["videoId"].as_str())?
        .to_string();

    let flex = renderer["flexColumns"].as_array()?;

    // Title
    let title = flex
        .get(0)?
        ["musicResponsiveListItemFlexColumnRenderer"]["text"]["runs"]
        .as_array()?
        .first()?
        ["text"]
        .as_str()?
        .to_string();

    // Artists, album, duration
    let mut artist = String::new();
    let mut album = String::new();
    let mut duration_str = String::new();

    if let Some(col1_runs) = flex.get(1).and_then(|c| {
        c["musicResponsiveListItemFlexColumnRenderer"]["text"]["runs"].as_array()
    }) {
        let texts: Vec<&str> = col1_runs
            .iter()
            .filter_map(|r| r["text"].as_str())
            .filter(|s| *s != " • ")
            .collect();

        if let Some(a) = texts.first() {
            artist = a.to_string();
        }
        if texts.len() >= 3 {
            album = texts[1].to_string();
            duration_str = texts[2].to_string();
        } else if texts.len() == 2 {
            if texts[1].contains(':') {
                duration_str = texts[1].to_string();
            } else {
                album = texts[1].to_string();
            }
        }
    }

    // Fallback duration in fixedColumns
    if duration_str.is_empty() {
        if let Some(fixed) = renderer["fixedColumns"].as_array() {
            if let Some(d) = fixed.get(0) {
                if let Some(text) = d["musicResponsiveListItemFixedColumnRenderer"]["text"]["runs"][0]["text"].as_str() {
                    duration_str = text.to_string();
                }
            }
        }
    }

    let duration = parse_duration_to_secs(&duration_str);

    // Cover: high resolution square
    let mut cover_url = String::new();
    if let Some(thumbs) = renderer["thumbnail"]["musicThumbnailRenderer"]["thumbnail"]["thumbnails"].as_array() {
        if let Some(last_thumb) = thumbs.last() {
            if let Some(u) = last_thumb["url"].as_str() {
                cover_url = if let Some(idx) = u.rfind("=w") {
                    format!("{}=w540-h540-l90-rj", &u[..idx])
                } else {
                    u.to_string()
                };
            }
        }
    }

    Some(TrackItem {
        id: format!("ytmusic-{}", video_id),
        title,
        artist: if artist.is_empty() { "Artiste Inconnu".into() } else { artist },
        album: if album.is_empty() { "YouTube Music".into() } else { album },
        duration,
        cover_url,
        source: "ytmusic".into(),
        stream_url: None,
        bitrate: Some("256k Opus".into()),
    })
}

fn parse_duration_to_secs(d: &str) -> f64 {
    let parts: Vec<&str> = d.trim().split(':').collect();
    if parts.len() == 2 {
        let mins = parts[0].parse::<f64>().unwrap_or(0.0);
        let secs = parts[1].parse::<f64>().unwrap_or(0.0);
        mins * 60.0 + secs
    } else if parts.len() == 3 {
        let hrs = parts[0].parse::<f64>().unwrap_or(0.0);
        let mins = parts[1].parse::<f64>().unwrap_or(0.0);
        let secs = parts[2].parse::<f64>().unwrap_or(0.0);
        hrs * 3600.0 + mins * 60.0 + secs
    } else {
        0.0
    }
}

/// Searches Deezer catalog (clean metadata, 1000x1000 covers, zero account required)
#[tauri::command]
async fn search_deezer(query: String, limit: Option<u32>) -> Result<Vec<TrackItem>, String> {
    let count = limit.unwrap_or(25);
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.deezer.com/search")
        .query(&[("q", query.as_str()), ("limit", &count.to_string())])
        .header("User-Agent", "MazzMuziK/1.0")
        .send()
        .await
        .map_err(|e| format!("Erreur Deezer API: {}", e))?;

    let parsed: DeezerSearchResponse = res
        .json()
        .await
        .map_err(|e| format!("Erreur parsing Deezer: {}", e))?;

    let mut tracks = Vec::new();
    if let Some(items) = parsed.data {
        for t in items {
            let cover_url = t.album.as_ref()
                .and_then(|a| a.cover_xl.clone().or_else(|| a.cover_big.clone()))
                .unwrap_or_default();

            tracks.push(TrackItem {
                id: format!("deezer-{}", t.id),
                title: t.title,
                artist: t.artist.and_then(|a| a.name).unwrap_or_else(|| "Artiste Inconnu".into()),
                album: t.album.and_then(|a| a.title).unwrap_or_else(|| "Single / Album".into()),
                duration: t.duration.unwrap_or(0.0),
                cover_url,
                source: "deezer".into(),
                stream_url: t.preview,
                bitrate: Some("FLAC / 320k".into()),
            });
        }
    }

    Ok(tracks)
}

fn get_binary_path(app: &AppHandle, binary_name: &str) -> Option<std::path::PathBuf> {
    // 1. Resource directory
    if let Ok(res_dir) = app.path().resource_dir() {
        let p = res_dir.join("binaries").join(format!("{}-x86_64-pc-windows-msvc.exe", binary_name));
        if p.exists() { return Some(p); }
        let p = res_dir.join(format!("{}-x86_64-pc-windows-msvc.exe", binary_name));
        if p.exists() { return Some(p); }
        let p = res_dir.join(format!("{}.exe", binary_name));
        if p.exists() { return Some(p); }
    }
    // 2. Adjacent to current exe
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let p = parent.join("binaries").join(format!("{}-x86_64-pc-windows-msvc.exe", binary_name));
            if p.exists() { return Some(p); }
            let p = parent.join("binaries").join(format!("{}.exe", binary_name));
            if p.exists() { return Some(p); }
            let p = parent.join(format!("{}-x86_64-pc-windows-msvc.exe", binary_name));
            if p.exists() { return Some(p); }
            let p = parent.join(format!("{}.exe", binary_name));
            if p.exists() { return Some(p); }
        }
    }
    // 3. Fallback known workspace locations
    let candidates = [
        format!(r"D:\Mazz MuZik\apps\mazzmuzik-desktop\src-tauri\binaries\{}-x86_64-pc-windows-msvc.exe", binary_name),
        format!(r"D:\Mazz MuZik\apps\mazzmuzik-desktop\binaries\{}-x86_64-pc-windows-msvc.exe", binary_name),
        format!(r"D:\Mazz MuZik\binaries\{}-x86_64-pc-windows-msvc.exe", binary_name),
        format!(r"D:\Mazz MuZik\apps\mazzmuzik-desktop\src-tauri\binaries\{}.exe", binary_name),
        format!(r"D:\Mazz MuZik\apps\mazzmuzik-desktop\binaries\{}.exe", binary_name),
        format!(r"D:\Mazz MuZik\binaries\{}.exe", binary_name),
    ];
    for c in candidates {
        let p = std::path::PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Runs the powershell fetch-tools.ps1 script to update all local sidecars
#[tauri::command]
async fn run_tool_update(app: AppHandle) -> Result<String, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Impossible de déterminer le répertoire ressources: {}", e))?;

    let script_path = resource_dir.join("scripts").join("fetch-tools.ps1");
    let final_script = if script_path.exists() {
        script_path
    } else {
        std::path::PathBuf::from(r"D:\Mazz MuZik\apps\mazzmuzik-desktop\scripts\fetch-tools.ps1")
    };

    let output = Command::new("powershell")
        .args([
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            final_script.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| format!("Échec d'exécution du script de synchronisation: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Erreur lors de la mise à jour:\n{}\n{}", stdout, stderr))
    }
}

/// Resolves direct stream URL using the yt-dlp sidecar + Deno JS engine
#[tauri::command]
async fn resolve_stream_url(
    app: AppHandle,
    source: String,
    query_or_id: String,
    _arl: Option<String>,
    artist: Option<String>,
    title: Option<String>,
) -> Result<String, String> {
    let cache_key = format!("{}:{}:{:?}:{:?}", source, query_or_id, artist, title);
    if let Ok(guard) = RUST_STREAM_CACHE.lock() {
        if let Some(map) = guard.as_ref() {
            if let Some((url, time)) = map.get(&cache_key) {
                if time.elapsed() < Duration::from_secs(3 * 3600) {
                    return Ok(url.clone());
                }
            }
        }
    }

    // If source is Deezer, cross-resolve to YouTube Music studio version if no native Deezer stream
    let actual_target = if source == "deezer" {
        let search_term = match (&artist, &title) {
            (Some(a), Some(t)) if !a.is_empty() && !t.is_empty() => format!("{} {}", a, t),
            _ => query_or_id.clone(),
        };

        match search_ytmusic(search_term.clone(), Some("songs".into())).await {
            Ok(yt_hits) if !yt_hits.is_empty() => {
                let vid = yt_hits[0].id.replace("ytmusic-", "");
                format!("https://music.youtube.com/watch?v={}", vid)
            }
            _ => format!("ytsearch1:{}", search_term),
        }
    } else {
        query_or_id.clone()
    };

    let ytdlp_bin = get_binary_path(&app, "yt-dlp")
        .ok_or_else(|| "Binaire yt-dlp introuvable".to_string())?;

    let target_url = match source.as_str() {
        "deezer" => actual_target,
        "ytmusic" => {
            if actual_target.starts_with("http") {
                actual_target
            } else {
                format!("https://music.youtube.com/watch?v={}", actual_target)
            }
        }
        "soundcloud" => {
            if actual_target.starts_with("http") {
                actual_target
            } else {
                let term = match (&artist, &title) {
                    (Some(a), Some(t)) if !a.is_empty() && !t.is_empty() => format!("{} {}", a, t),
                    _ => actual_target,
                };
                format!("scsearch1:{}", term)
            }
        }
        "bandcamp" => {
            if actual_target.starts_with("http") {
                actual_target
            } else {
                let term = match (&artist, &title) {
                    (Some(a), Some(t)) if !a.is_empty() && !t.is_empty() => format!("{} {}", a, t),
                    _ => actual_target,
                };
                format!("bcsearch1:{}", term)
            }
        }
        _ => {
            if actual_target.starts_with("http") {
                actual_target
            } else {
                format!("https://music.youtube.com/watch?v={}", actual_target)
            }
        }
    };

    let deno_arg = if let Some(deno_path) = get_binary_path(&app, "deno") {
        format!("deno:{}", deno_path.to_string_lossy())
    } else {
        "deno".to_string()
    };

    let mut cmd = tokio::process::Command::new(ytdlp_bin);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .args([
            "--js-runtimes",
            &deno_arg,
            "-g",
            "-f",
            "bestaudio/best",
            "--no-playlist",
            "--quiet",
            &target_url,
        ])
        .output()
        .await
        .map_err(|e| format!("Erreur exécution yt-dlp: {}", e))?;

    if output.status.success() {
        let stream_url = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or_default()
            .trim()
            .to_string();

        if !stream_url.is_empty() {
            if let Ok(mut guard) = RUST_STREAM_CACHE.lock() {
                let map = guard.get_or_insert_with(HashMap::new);
                map.insert(cache_key, (stream_url.clone(), Instant::now()));
            }
            Ok(stream_url)
        } else {
            Err("Aucun flux audio extrait par yt-dlp".into())
        }
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Échec de résolution du flux: {}", err))
    }
}

/// Unified multi-source search (InnerTube WEB_REMIX for YT Music, Deezer for metadata, yt-dlp for SC/Bandcamp)
#[tauri::command]
async fn search_sidecar(
    app: AppHandle,
    source: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<TrackItem>, String> {
    match source.as_str() {
        "ytmusic" => search_ytmusic(query, Some("songs".into())).await,
        "deezer" => search_deezer(query, limit).await,
        "soundcloud" | "bandcamp" => {
            let ytdlp_bin = get_binary_path(&app, "yt-dlp")
                .ok_or_else(|| "Binaire yt-dlp introuvable".to_string())?;

            let count = limit.unwrap_or(15);
            let search_spec = match source.as_str() {
                "soundcloud" => format!("scsearch{}:{}", count, query),
                "bandcamp" => format!("bcsearch{}:{}", count, query),
                _ => format!("scsearch{}:{}", count, query),
            };

            let deno_arg = if let Some(deno_path) = get_binary_path(&app, "deno") {
                format!("deno:{}", deno_path.to_string_lossy())
            } else {
                "deno".to_string()
            };

            let mut cmd = tokio::process::Command::new(ytdlp_bin);
            #[cfg(windows)]
            cmd.creation_flags(CREATE_NO_WINDOW);

            let output = cmd
                .args([
                    "--js-runtimes",
                    &deno_arg,
                    "--dump-json",
                    "--flat-playlist",
                    "--no-playlist",
                    "--quiet",
                    &search_spec,
                ])
                .output()
                .await
                .map_err(|e| format!("Erreur exécution recherche: {}", e))?;

            let mut tracks = Vec::new();
            let stdout = String::from_utf8_lossy(&output.stdout);

            for line in stdout.lines() {
                if line.trim().is_empty() {
                    continue;
                }
                if let Ok(entry) = serde_json::from_str::<YtdlpJsonEntry>(line) {
                    let raw_id = entry.webpage_url.as_deref().or(entry.id.as_deref()).unwrap_or_default();
                    let title = entry.title.unwrap_or_else(|| "Titre Inconnu".into());
                    let artist = entry
                        .artist
                        .or(entry.uploader)
                        .unwrap_or_else(|| "Artiste Inconnu".into());
                    let duration = entry.duration.unwrap_or(0.0);
                    let cover_url = entry.thumbnail.unwrap_or_default();

                    tracks.push(TrackItem {
                        id: format!("{}-{}", source, raw_id),
                        title,
                        artist,
                        album: format!("Catalogue {}", source),
                        duration,
                        cover_url,
                        source: source.clone(),
                        stream_url: None,
                        bitrate: Some("160-320k".into()),
                    });
                }
            }
            Ok(tracks)
        }
        _ => search_ytmusic(query, Some("songs".into())).await,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_tool_update,
            resolve_stream_url,
            search_sidecar,
            search_ytmusic,
            search_deezer
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                log::info!("MazzMuziK Desktop démarré en mode Debug");
            }

            // Start local audio streaming proxy with open CORS
            tauri::async_runtime::spawn(async move {
                run_local_proxy().await;
            });

            // Silent auto-maintenance in background: 3s after startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(3)).await;
                if let Err(e) = run_tool_update(app_handle).await {
                    log::warn!("Auto-maintenance background note: {}", e);
                } else {
                    log::info!("Auto-maintenance toolchain synchronisée.");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MazzMuziK desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ytmusic_search() {
        let results = search_ytmusic("ninho".into(), Some("songs".into())).await;
        match results {
            Ok(tracks) => {
                println!("YTMusic tracks count: {}", tracks.len());
                for t in &tracks {
                    println!("Track: {} by {} (id: {})", t.title, t.artist, t.id);
                }
                assert!(!tracks.is_empty());
            }
            Err(e) => {
                panic!("Search failed: {}", e);
            }
        }
    }
}
