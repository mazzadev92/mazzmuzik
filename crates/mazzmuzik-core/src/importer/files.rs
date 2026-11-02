use crate::error::CoreError;
use crate::models::{ImportedPlaylist, TrackQuery};

pub struct FilePlaylistImporter;

impl FilePlaylistImporter {
    /// Parse un fichier CSV avec format `title,artist,album` ou avec en-têtes
    pub fn parse_csv(content: &str, playlist_name: &str) -> Result<ImportedPlaylist, CoreError> {
        let mut tracks = Vec::new();
        let lines: Vec<&str> = content.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Ignorer la ligne d'en-tête standard
            if idx == 0 && (line.to_lowercase().starts_with("title") || line.to_lowercase().starts_with("track")) {
                continue;
            }

            let parts: Vec<&str> = line.split(',').map(|s| s.trim().trim_matches('"')).collect();
            if parts.len() >= 2 {
                let title = parts[0].to_string();
                let artist = parts[1].to_string();
                let album = if parts.len() >= 3 && !parts[2].is_empty() {
                    Some(parts[2].to_string())
                } else {
                    None
                };

                tracks.push(TrackQuery {
                    title,
                    artist,
                    album,
                    duration_ms: None,
                    isrc: None,
                    mbid: None,
                });
            }
        }

        Ok(ImportedPlaylist {
            name: playlist_name.to_string(),
            source: "csv".to_string(),
            tracks,
        })
    }

    /// Parse un fichier M3U / M3U8 avec directives #EXTINF
    pub fn parse_m3u(content: &str, playlist_name: &str) -> Result<ImportedPlaylist, CoreError> {
        let mut tracks = Vec::new();
        let mut current_duration = None;
        let mut current_artist = None;
        let mut current_title = None;

        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("#EXTINF:") {
                // Format: #EXTINF:248,Daft Punk - Get Lucky
                let info = &line[8..];
                if let Some((dur_str, meta_str)) = info.split_once(',') {
                    if let Ok(secs) = dur_str.trim().parse::<i64>() {
                        if secs > 0 {
                            current_duration = Some((secs as u64) * 1000);
                        }
                    }

                    if let Some((art, tit)) = meta_str.split_once('-') {
                        current_artist = Some(art.trim().to_string());
                        current_title = Some(tit.trim().to_string());
                    } else {
                        current_title = Some(meta_str.trim().to_string());
                        current_artist = Some("Unknown Artist".to_string());
                    }
                }
            } else if !line.starts_with('#') && !line.is_empty() {
                // Ligne de chemin ou d'URL
                let title = current_title.take().unwrap_or_else(|| {
                    std::path::Path::new(line)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Unknown Track")
                        .to_string()
                });
                let artist = current_artist.take().unwrap_or_else(|| "Unknown Artist".to_string());
                let duration_ms = current_duration.take();

                tracks.push(TrackQuery {
                    title,
                    artist,
                    album: None,
                    duration_ms,
                    isrc: None,
                    mbid: None,
                });
            }
        }

        Ok(ImportedPlaylist {
            name: playlist_name.to_string(),
            source: "m3u".to_string(),
            tracks,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_csv() {
        let csv_data = "Title,Artist,Album\nGet Lucky,Daft Punk,Random Access Memories\nGenesis,Justice,Cross\n";
        let pl = FilePlaylistImporter::parse_csv(csv_data, "French Touch").unwrap();
        assert_eq!(pl.name, "French Touch");
        assert_eq!(pl.tracks.len(), 2);
        assert_eq!(pl.tracks[0].title, "Get Lucky");
        assert_eq!(pl.tracks[0].artist, "Daft Punk");
        assert_eq!(pl.tracks[0].album.as_deref(), Some("Random Access Memories"));
    }

    #[test]
    fn test_parse_m3u() {
        let m3u_data = "#EXTM3U\n#EXTINF:248,Daft Punk - Get Lucky\n/music/daft_punk.flac\n#EXTINF:234,Justice - Genesis\n/music/justice.flac\n";
        let pl = FilePlaylistImporter::parse_m3u(m3u_data, "Electronic Classics").unwrap();
        assert_eq!(pl.tracks.len(), 2);
        assert_eq!(pl.tracks[0].title, "Get Lucky");
        assert_eq!(pl.tracks[0].artist, "Daft Punk");
        assert_eq!(pl.tracks[0].duration_ms, Some(248000));
        assert_eq!(pl.tracks[1].title, "Genesis");
        assert_eq!(pl.tracks[1].duration_ms, Some(234000));
    }
}
