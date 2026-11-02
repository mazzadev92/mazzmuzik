use std::path::{Path, PathBuf};

pub struct FileOrganizer;

impl FileOrganizer {
    /// Nettoie les caractères interdits pour les systèmes de fichiers (Windows et POSIX)
    pub fn sanitize_filename(input: &str) -> String {
        let forbidden = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        let mut clean: String = input
            .chars()
            .map(|c| if forbidden.contains(&c) { '-' } else { c })
            .collect();

        // Réduire les tirets ou espaces successifs
        while clean.contains("--") {
            clean = clean.replace("--", "-");
        }
        clean.trim_matches(&[' ', '.', '-'][..]).to_string()
    }

    /// Génère le chemin relatif cible : `Artiste/Album/TT - Titre.ext`
    /// Si l'album est absent, utilise l'album canonique "Singles"
    pub fn build_relative_path(
        artist: &str,
        album: Option<&str>,
        track_number: Option<u32>,
        title: &str,
        extension: &str,
    ) -> PathBuf {
        let clean_artist = Self::sanitize_filename(if artist.trim().is_empty() { "Unknown Artist" } else { artist });
        let clean_album = Self::sanitize_filename(album.unwrap_or("Singles"));
        let clean_title = Self::sanitize_filename(if title.trim().is_empty() { "Unknown Track" } else { title });

        let track_prefix = match track_number {
            Some(n) => format!("{:02}", n),
            None => "01".to_string(),
        };

        let file_name = format!("{} - {}.{}", track_prefix, clean_title, extension);

        let mut path = PathBuf::new();
        path.push(clean_artist);
        path.push(clean_album);
        path.push(file_name);
        path
    }

    /// Construit le chemin absolu final dans le dossier musique de l'utilisateur
    pub fn build_absolute_path(
        music_root: &Path,
        artist: &str,
        album: Option<&str>,
        track_number: Option<u32>,
        title: &str,
        extension: &str,
    ) -> PathBuf {
        let relative = Self::build_relative_path(artist, album, track_number, title, extension);
        music_root.join(relative)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_and_build_path() {
        let path = FileOrganizer::build_relative_path(
            "AC/DC",
            Some("Back In Black: Remastered?"),
            Some(1),
            "Hells Bells / Version 1*",
            "flac",
        );

        let s = path.to_str().unwrap().replace('\\', "/");
        assert_eq!(s, "AC-DC/Back In Black- Remastered/01 - Hells Bells - Version 1.flac");
    }

    #[test]
    fn test_orphan_track_uses_singles_album() {
        let path = FileOrganizer::build_relative_path(
            "Daft Punk",
            None,
            None,
            "Aerodynamic",
            "flac",
        );

        let s = path.to_str().unwrap().replace('\\', "/");
        assert_eq!(s, "Daft Punk/Singles/01 - Aerodynamic.flac");
    }
}
