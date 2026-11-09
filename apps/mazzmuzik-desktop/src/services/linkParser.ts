import type { Track, ParsedMusicResult } from '../types/music';
import { isTauri } from './api';

/**
 * Checks if the user input is a direct link or URI to a supported streaming service
 */
export function isMusicUrl(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.startsWith('spotify:')) return true;
  if (!/^https?:\/\//i.test(trimmed)) return false;

  return (
    trimmed.includes('spotify.com') ||
    trimmed.includes('deezer.com') ||
    trimmed.includes('deezer.page.link') ||
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('music.youtube.com') ||
    trimmed.includes('soundcloud.com') ||
    trimmed.includes('audius.co')
  );
}

/**
 * Parses any supported music link into structured Track(s) and metadata
 * Sovereign execution: zero login, zero accounts, zero API keys required.
 */
export async function parseMusicUrl(rawUrl: string): Promise<ParsedMusicResult | null> {
  const url = rawUrl.trim();

  // 1. SPOTIFY (Track, Playlist, Album)
  if (url.includes('spotify.com') || url.startsWith('spotify:')) {
    return parseSpotify(url);
  }

  // 2. DEEZER (Track, Album, Playlist)
  if (url.includes('deezer.com') || url.includes('deezer.page.link')) {
    return parseDeezer(url);
  }

  // 3. YOUTUBE / YOUTUBE MUSIC
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return parseYouTube(url);
  }

  // 4. SOUNDCLOUD
  if (url.includes('soundcloud.com')) {
    return parseSoundCloud(url);
  }

  return null;
}

/**
 * Parses Spotify links via the sovereign /api/spotify parser
 */
async function parseSpotify(url: string): Promise<ParsedMusicResult | null> {
  try {
    // In browser, use /api/spotify to bypass CORS cleanly
    const res = await fetch(`/api/spotify?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.tracks || data.tracks.length === 0) return null;

    return {
      platform: 'spotify',
      type: data.type || (data.tracks.length > 1 ? 'playlist' : 'track'),
      title: data.title || data.track?.title || 'Collection Spotify',
      subtitle: data.description || (data.tracks.length > 1 ? `${data.tracks.length} titres` : data.track?.artist),
      coverUrl: data.coverUrl || data.track?.coverUrl || '',
      trackCount: data.trackCount || data.tracks.length,
      tracks: data.tracks,
    };
  } catch (err) {
    console.warn('Spotify link parsing error:', err);
    return null;
  }
}

/**
 * Parses Deezer links (track, album, playlist) via Deezer API proxy
 */
async function parseDeezer(url: string): Promise<ParsedMusicResult | null> {
  try {
    const deezerBase = isTauri ? 'https://api.deezer.com' : '/api/deezer';

    // 1. Single Track
    const trackMatch = url.match(/(?:deezer\.com\/(?:[a-z]{2}\/)?track\/|track\/)([0-9]+)/i);
    if (trackMatch) {
      const trackId = trackMatch[1];
      const res = await fetch(`${deezerBase}/track/${trackId}`);
      if (!res.ok) return null;
      const d = await res.json();
      if (d.error || !d.title) return null;

      const coverUrl = d.album?.cover_xl || d.album?.cover_big || d.album?.cover_medium || '';
      const track: Track = {
        id: `deezer-${d.id}`,
        title: d.title,
        artist: d.artist?.name || 'Artiste Inconnu',
        album: d.album?.title || 'Single',
        duration: d.duration || 0,
        coverUrl,
        source: 'deezer',
        previewUrl: d.preview || undefined,
        bitrate: 'FLAC / 320k',
      };

      return {
        platform: 'deezer',
        type: 'track',
        title: track.title,
        subtitle: track.artist,
        coverUrl,
        trackCount: 1,
        tracks: [track],
      };
    }

    // 2. Album
    const albumMatch = url.match(/(?:deezer\.com\/(?:[a-z]{2}\/)?album\/|album\/)([0-9]+)/i);
    if (albumMatch) {
      const albumId = albumMatch[1];
      const res = await fetch(`${deezerBase}/album/${albumId}`);
      if (!res.ok) return null;
      const alb = await res.json();
      if (alb.error || !alb.tracks?.data) return null;

      const coverUrl = alb.cover_xl || alb.cover_big || alb.cover_medium || '';
      const tracks: Track[] = alb.tracks.data.map((t: any) => ({
        id: `deezer-${t.id}`,
        title: t.title,
        artist: t.artist?.name || alb.artist?.name || 'Artiste Inconnu',
        album: alb.title || 'Album Deezer',
        duration: t.duration || 0,
        coverUrl,
        source: 'deezer',
        previewUrl: t.preview || undefined,
        bitrate: 'FLAC / 320k',
      }));

      return {
        platform: 'deezer',
        type: 'album',
        title: alb.title,
        subtitle: alb.artist?.name || `${tracks.length} titres`,
        coverUrl,
        trackCount: tracks.length,
        tracks,
      };
    }

    // 3. Playlist
    const plMatch = url.match(/(?:deezer\.com\/(?:[a-z]{2}\/)?playlist\/|playlist\/)([0-9]+)/i);
    if (plMatch) {
      const plId = plMatch[1];
      const res = await fetch(`${deezerBase}/playlist/${plId}`);
      if (!res.ok) return null;
      const pl = await res.json();
      if (pl.error || !pl.tracks?.data) return null;

      const coverUrl = pl.picture_xl || pl.picture_big || pl.picture_medium || '';
      const tracks: Track[] = pl.tracks.data.map((t: any) => ({
        id: `deezer-${t.id}`,
        title: t.title,
        artist: t.artist?.name || 'Artiste Inconnu',
        album: t.album?.title || pl.title || 'Playlist Deezer',
        duration: t.duration || 0,
        coverUrl: t.album?.cover_xl || t.album?.cover_big || coverUrl,
        source: 'deezer',
        previewUrl: t.preview || undefined,
        bitrate: 'FLAC / 320k',
      }));

      return {
        platform: 'deezer',
        type: 'playlist',
        title: pl.title,
        subtitle: pl.description || `${tracks.length} morceaux`,
        coverUrl,
        trackCount: tracks.length,
        tracks,
      };
    }
  } catch (err) {
    console.warn('Deezer link parsing error:', err);
  }
  return null;
}

/**
 * Parses YouTube / YouTube Music video URLs
 */
async function parseYouTube(url: string): Promise<ParsedMusicResult | null> {
  try {
    const videoMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i
    );
    if (!videoMatch) return null;
    const videoId = videoMatch[1];

    // Query YouTube oembed for title & thumbnail
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = await res.json();

    const track: Track = {
      id: `ytmusic-${videoId}`,
      title: data.title || 'Titre YouTube',
      artist: data.author_name || 'YouTube',
      album: 'YouTube Music',
      duration: 0,
      coverUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: 'ytmusic',
      bitrate: '256k Opus',
    };

    return {
      platform: 'youtube',
      type: 'track',
      title: track.title,
      subtitle: track.artist,
      coverUrl: track.coverUrl,
      trackCount: 1,
      tracks: [track],
    };
  } catch (err) {
    console.warn('YouTube link parsing error:', err);
    return null;
  }
}

/**
 * Parses SoundCloud links via oEmbed
 */
async function parseSoundCloud(url: string): Promise<ParsedMusicResult | null> {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();

    const track: Track = {
      id: `soundcloud-${Date.now()}`,
      title: data.title || 'Titre SoundCloud',
      artist: data.author_name || 'Artiste SoundCloud',
      album: 'SoundCloud Stream',
      duration: 0,
      coverUrl: data.thumbnail_url || '',
      source: 'soundcloud',
      bitrate: 'HQ Audio',
    };

    return {
      platform: 'soundcloud',
      type: 'track',
      title: track.title,
      subtitle: track.artist,
      coverUrl: track.coverUrl,
      trackCount: 1,
      tracks: [track],
    };
  } catch (err) {
    console.warn('SoundCloud link parsing error:', err);
    return null;
  }
}
