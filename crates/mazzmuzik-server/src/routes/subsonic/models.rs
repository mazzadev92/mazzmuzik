#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsonicAuthParams {
    pub u: Option<String>,
    pub p: Option<String>,
    pub t: Option<String>,
    pub s: Option<String>,
    pub v: Option<String>,
    pub c: Option<String>,
    pub f: Option<String>, // "json" or "xml"
    pub id: Option<String>,
    pub query: Option<String>,
    #[serde(rename = "type")]
    pub query_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicResponseWrapper<T: Serialize> {
    #[serde(rename = "subsonic-response")]
    pub subsonic_response: SubsonicResponse<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicResponse<T: Serialize> {
    pub status: String,
    pub version: String,
    pub xmlns: Option<String>,
    #[serde(flatten)]
    pub body: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<SubsonicError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsonicError {
    pub code: i32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseResponse {
    pub license: LicenseInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseInfo {
    pub valid: bool,
    pub email: String,
    pub license_expires: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStatusResponse {
    pub scan_status: ScanStatusInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStatusInfo {
    pub scanning: bool,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicFoldersResponse {
    pub music_folders: MusicFoldersList,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicFoldersList {
    pub music_folder: Vec<MusicFolderItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicFolderItem {
    pub id: i32,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexesResponse {
    pub indexes: IndexesList,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexesList {
    pub last_modified: i64,
    pub ignored_articles: String,
    pub index: Vec<IndexGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexGroup {
    pub name: String,
    pub artist: Vec<SubsonicArtistShort>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicArtistShort {
    pub id: String,
    pub name: String,
    pub album_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistsResponse {
    pub artists: ArtistsList,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistsList {
    pub ignored_articles: String,
    pub index: Vec<IndexGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistDetailResponse {
    pub artist: SubsonicArtistDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicArtistDetail {
    pub id: String,
    pub name: String,
    pub album_count: i32,
    pub album: Vec<SubsonicAlbumShort>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicAlbumShort {
    pub id: String,
    pub name: String,
    pub artist: String,
    pub artist_id: String,
    pub song_count: i32,
    pub duration: i32,
    pub created: String,
    pub year: Option<i32>,
    pub cover_art: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetailResponse {
    pub album: SubsonicAlbumDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicAlbumDetail {
    pub id: String,
    pub name: String,
    pub artist: String,
    pub artist_id: String,
    pub song_count: i32,
    pub duration: i32,
    pub created: String,
    pub year: Option<i32>,
    pub cover_art: Option<String>,
    pub song: Vec<SubsonicChild>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumList2Response {
    pub album_list2: AlbumList2Container,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumList2Container {
    pub album: Vec<SubsonicAlbumShort>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongResponse {
    pub song: SubsonicChild,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongsListResponse {
    pub songs: SongsListContainer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongsListContainer {
    pub song: Vec<SubsonicChild>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicChild {
    pub id: String,
    pub parent: Option<String>,
    pub is_dir: bool,
    pub title: String,
    pub album: Option<String>,
    pub artist: String,
    pub track: Option<i32>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub cover_art: Option<String>,
    pub size: i64,
    pub content_type: String,
    pub suffix: String,
    pub duration: i32,
    pub bit_rate: Option<i32>,
    pub path: String,
    pub play_count: i32,
    pub starred: Option<String>,
    pub artist_id: String,
    pub type_field: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenresResponse {
    pub genres: GenresContainer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenresContainer {
    pub genre: Vec<GenreItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenreItem {
    pub value: String,
    pub song_count: i32,
    pub album_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Search3Response {
    pub search_result3: SearchResult3Container,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult3Container {
    pub artist: Vec<SubsonicArtistShort>,
    pub album: Vec<SubsonicAlbumShort>,
    pub song: Vec<SubsonicChild>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistsResponse {
    pub playlists: PlaylistsContainer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistsContainer {
    pub playlist: Vec<SubsonicPlaylistShort>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicPlaylistShort {
    pub id: String,
    pub name: String,
    pub comment: Option<String>,
    pub song_count: i32,
    pub duration: i32,
    pub public: bool,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDetailResponse {
    pub playlist: SubsonicPlaylistDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicPlaylistDetail {
    pub id: String,
    pub name: String,
    pub comment: Option<String>,
    pub song_count: i32,
    pub duration: i32,
    pub public: bool,
    pub created: String,
    pub entry: Vec<SubsonicChild>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResponse {
    pub lyrics: LyricsContainer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsContainer {
    pub artist: String,
    pub title: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayQueueResponse {
    pub play_queue: PlayQueueContainer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayQueueContainer {
    pub current: Option<String>,
    pub position: i64,
    pub username: String,
    pub changed: String,
    pub entry: Vec<SubsonicChild>,
}
