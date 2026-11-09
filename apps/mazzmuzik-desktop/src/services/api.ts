import type { Track, RadioStation, SourceType } from '../types/music';
import { isMusicUrl, parseMusicUrl } from './linkParser';

const AUDIUS_API_BASE = 'https://discoveryprovider.audius.co/v1';
const RADIO_API_BASE = 'https://de1.api.radio-browser.info/json';

interface AudiusTrackResponse {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  user: {
    name: string;
    handle: string;
  };
}

interface RadioStationResponse {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  favicon?: string;
  country?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
}

/**
 * Searches Audius catalog (high quality 320kbps MP3 stream, zero auth)
 */
export async function searchAudius(query: string, limit = 20): Promise<Track[]> {
  try {
    const res = await fetch(
      `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=MazzMuziK`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: AudiusTrackResponse[] };
    const items = json.data || [];

    return items.map((item) => ({
      id: `audius-${item.id}`,
      title: item.title,
      artist: item.user.name,
      album: item.genre || 'Audius Direct',
      duration: item.duration,
      coverUrl: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
      source: 'audius',
      streamUrl: `${AUDIUS_API_BASE}/tracks/${item.id}/stream?app_name=MazzMuziK`,
      bitrate: '320 kbps',
    }));
  } catch (err) {
    console.warn('Audius search error:', err);
    return [];
  }
}

/**
 * Fetches trending tracks from Audius
 */
export async function getTrendingAudius(limit = 25): Promise<Track[]> {
  try {
    const res = await fetch(
      `${AUDIUS_API_BASE}/tracks/trending?limit=${limit}&app_name=MazzMuziK`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: AudiusTrackResponse[] };
    const items = json.data || [];

    return items.map((item) => ({
      id: `audius-${item.id}`,
      title: item.title,
      artist: item.user.name,
      album: item.genre || 'Audius Trending',
      duration: item.duration,
      coverUrl: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
      source: 'audius',
      streamUrl: `${AUDIUS_API_BASE}/tracks/${item.id}/stream?app_name=MazzMuziK`,
      bitrate: '320 kbps',
    }));
  } catch (err) {
    console.warn('Audius trending error:', err);
    return [];
  }
}

/**
 * Searches live radio stations from Radio-Browser
 */
export async function searchRadio(query: string, limit = 25): Promise<Track[]> {
  try {
    const res = await fetch(
      `${RADIO_API_BASE}/stations/byname/${encodeURIComponent(query)}?limit=${limit}`
    );
    if (!res.ok) return [];
    const items = (await res.json()) as RadioStationResponse[];

    return items.map((station) => ({
      id: `radio-${station.stationuuid}`,
      title: station.name,
      artist: station.country || 'Radio Direct',
      album: station.tags || 'Live Web Radio',
      duration: 0,
      coverUrl: station.favicon || '',
      source: 'radio',
      streamUrl: station.url_resolved || station.url,
      bitrate: station.bitrate ? `${station.bitrate} kbps` : 'Live Stream',
    }));
  } catch (err) {
    console.warn('Radio search error:', err);
    return [];
  }
}

/**
 * Gets top curated live radio stations (French & international classics)
 */
export async function getTopRadios(limit = 30): Promise<RadioStation[]> {
  try {
    const res = await fetch(`${RADIO_API_BASE}/stations/topclick/${limit}`);
    if (!res.ok) return [];
    const items = (await res.json()) as RadioStationResponse[];

    return items.map((s) => ({
      id: s.stationuuid,
      name: s.name,
      url: s.url_resolved || s.url,
      favicon: s.favicon,
      country: s.country,
      tags: s.tags ? s.tags.split(',').map((t) => t.trim()) : [],
      codec: s.codec,
      bitrate: s.bitrate,
    }));
  } catch (err) {
    console.warn('Top radios error:', err);
    return [];
  }
}

export const isTauri =
  typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

/**
 * Direct search on Deezer (returns high-res 1000x1000 covers, clean titles, exact durations, preview streams)
 */
export async function searchDeezer(query: string, limit = 25): Promise<Track[]> {
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const items = await invoke<Track[]>('search_deezer', { query, limit });
      if (items && items.length > 0) return items;
    } catch (err) {
      console.warn('Deezer Tauri invoke error:', err);
    }
  }

  try {
    const endpoint = isTauri
      ? `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`
      : `/api/deezer/search?q=${encodeURIComponent(query)}&limit=${limit}`;

    const res = await fetch(endpoint);
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{
          id: number;
          title: string;
          duration?: number;
          preview?: string;
          artist?: { name?: string };
          album?: { title?: string; cover_xl?: string; cover_big?: string; cover_medium?: string };
        }>;
      };
      if (json.data) {
        return json.data.map((d) => ({
          id: `deezer-${d.id}`,
          title: d.title,
          artist: d.artist?.name || 'Artiste Inconnu',
          album: d.album?.title || 'Single',
          duration: d.duration || 0,
          coverUrl: d.album?.cover_xl || d.album?.cover_big || d.album?.cover_medium || '',
          source: 'deezer' as SourceType,
          previewUrl: d.preview || undefined,
          streamUrl: undefined, // Leave undefined so resolveTrackStream fetches the FULL STUDIO TRACK!
          bitrate: 'FLAC / 320k',
        }));
      }
    }
  } catch (err) {
    console.warn('Deezer search fallback error:', err);
  }
  return [];
}

/**
 * Direct search on YouTube Music InnerTube WEB_REMIX (official studio tracks, albums, covers)
 */
export async function searchYTMusic(query: string): Promise<Track[]> {
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const items = await invoke<Track[]>('search_ytmusic', { query, filter: 'songs' });
      if (items && items.length > 0) return items;
    } catch (err) {
      console.warn('YTMusic Tauri invoke error:', err);
    }
  }

  // Fast Web PWA endpoint
  if (!isTauri) {
    try {
      const res = await fetch(`/api/ytmusic?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.tracks) && json.tracks.length > 0) {
          return json.tracks;
        }
      }
    } catch (err) {
      console.warn('Fast /api/ytmusic endpoint note:', err);
    }
  }

  // Fallback: direct InnerTube request via proxy when on browser
  try {
    const body = {
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241127.01.00', hl: 'fr', gl: 'FR' } },
      query,
      params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D'
    };
    const endpoint = isTauri
      ? 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false'
      : '/api/ytmusic/youtubei/v1/search?prettyPrint=false';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (isTauri) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const json = await res.json();
      const tabs = json?.contents?.tabbedSearchResultsRenderer?.tabs;
      const sections = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      const tracks: Track[] = [];
      for (const s of sections || []) {
        const contents = s.musicShelfRenderer?.contents;
        for (const item of contents || []) {
          const r = item.musicResponsiveListItemRenderer;
          if (!r) continue;
          const videoId = r.playlistItemData?.videoId || r.navigationEndpoint?.watchEndpoint?.videoId;
          const title = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
          const flex1Runs = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          const texts = flex1Runs?.map((x: any) => x?.text).filter((x: string) => x && x !== ' • ');
          const artist = texts?.[0] || 'Artiste Inconnu';
          const album = texts?.[1] || 'YouTube Music';
          const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
          if (videoId && title) {
            tracks.push({
              id: `ytmusic-${videoId}`,
              title,
              artist,
              album,
              duration: 0,
              coverUrl: thumb,
              source: 'ytmusic',
              bitrate: '256k Opus',
            });
          }
        }
      }
      if (tracks.length > 0) return tracks;
    }
  } catch (err) {
    console.warn('InnerTube fetch error:', err);
  }

  return [];
}

/**
 * Resolves a YouTube Music video ID for any track title + artist in ~200ms
 * Used by the Web / Mobile PWA player to stream the 100% full studio song with zero 30s limit.
 */
export async function resolveYouTubeVideoId(artist: string, title: string): Promise<string | null> {
  const cleanTitle = cleanSongTitle(title);
  const cleanArtist = (artist || '').replace(/(?:feat\.|ft\.).*$/i, '').trim();
  const query = `${cleanArtist} ${cleanTitle}`.trim();
  if (!query) return null;

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const sidecarResults = await invoke<Track[]>('search_ytmusic', { query, filter: 'songs' });
      if (Array.isArray(sidecarResults) && sidecarResults.length > 0) {
        return sidecarResults[0].id.replace('ytmusic-', '');
      }
    } catch (err) {
      console.warn('Tauri YT search error:', err);
    }
  }

  // Fast Web PWA endpoint
  try {
    const res = await fetch(`/api/ytmusic?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.bestVideoId) return data.bestVideoId;
    }
  } catch (err) {
    console.warn('resolveYouTubeVideoId fast endpoint error, trying raw proxy:', err);
  }

  try {
    const body = {
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241127.01.00', hl: 'fr', gl: 'FR' } },
      query,
      params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D'
    };
    const endpoint = isTauri
      ? 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false'
      : '/api/ytmusic/youtubei/v1/search?prettyPrint=false';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tabs = json?.contents?.tabbedSearchResultsRenderer?.tabs;
    const sections = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    for (const s of sections || []) {
      const contents = s.musicShelfRenderer?.contents;
      for (const item of contents || []) {
        const r = item.musicResponsiveListItemRenderer;
        const videoId = r?.playlistItemData?.videoId || r?.navigationEndpoint?.watchEndpoint?.videoId;
        if (videoId) return videoId;
      }
    }
  } catch (err) {
    console.warn('resolveYouTubeVideoId error:', err);
  }
  return null;
}

/**
 * Executes a multi-source search in parallel via Promise.allSettled
 */
export async function searchTracks(
  query: string,
  source: SourceType | 'all' = 'all'
): Promise<Track[]> {
  if (!query.trim()) return [];

  // Direct Music Link detection (Spotify, Deezer, YouTube, SoundCloud)
  if (isMusicUrl(query)) {
    try {
      const parsed = await parseMusicUrl(query);
      if (parsed && parsed.tracks.length > 0) {
        return parsed.tracks;
      }
    } catch (err) {
      console.warn('Direct URL parsing failed:', err);
    }
  }

  const promises: Promise<Track[]>[] = [];

  if (source === 'all' || source === 'deezer') {
    promises.push(searchDeezer(query, source === 'all' ? 12 : 25));
  }

  if (source === 'all' || source === 'ytmusic') {
    promises.push(searchYTMusic(query));
  }

  if (source === 'all' || source === 'audius') {
    promises.push(searchAudius(query, source === 'all' ? 8 : 25));
  }

  if (source === 'all' || source === 'radio') {
    promises.push(searchRadio(query, source === 'all' ? 6 : 25));
  }

  // Only query SoundCloud if explicitly selected in filter tabs (yt-dlp crawl takes ~10s)
  if (source === 'soundcloud') {
    promises.push(
      (async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const sidecarResults = await invoke<Track[]>('search_sidecar', {
            source: 'soundcloud',
            query,
            limit: 20,
          });
          return Array.isArray(sidecarResults) ? sidecarResults : [];
        } catch (err) {
          console.warn('Search error for soundcloud:', err);
          return [];
        }
      })()
    );
  }

  // Only query Bandcamp if explicitly selected in filter tabs
  if (source === 'bandcamp') {
    promises.push(
      (async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const sidecarResults = await invoke<Track[]>('search_sidecar', {
            source: 'bandcamp',
            query,
            limit: 15,
          });
          return Array.isArray(sidecarResults) ? sidecarResults : [];
        } catch (err) {
          console.warn('Search error for bandcamp:', err);
          return [];
        }
      })()
    );
  }

  const settled = await Promise.allSettled(promises);
  const results: Track[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      results.push(...s.value);
    }
  }

  return dedupeTracks(results);
}

const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Same song from Deezer and YouTube Music: keep one row. The YouTube entry plays (exact videoId),
 * the Deezer entry lends its cover and duration.
 */
function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Map<string, number>();
  const out: Track[] = [];
  for (const t of tracks) {
    const key = fold(t.artist) + '|' + fold(t.title);
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push(t);
      continue;
    }
    const kept = out[at];
    const [yt, dz] = kept.source === 'ytmusic' ? [kept, t] : [t, kept];
    if (yt.source === 'ytmusic' && dz.source === 'deezer') {
      out[at] = { ...yt, coverUrl: dz.coverUrl || yt.coverUrl, duration: dz.duration || yt.duration, album: dz.album || yt.album };
    }
  }
  return out;
}

const LOCAL_PROXY_PORT = 28234;
const streamCache = new Map<string, { url: string; time: number }>();

export function invalidateStream(id: string): void {
  streamCache.delete(id);
}

export function toProxiedStreamUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  // In a web browser / PWA on mobile or non-desktop, direct HTTPS media streams work natively
  if (!isTauri) {
    return rawUrl;
  }
  // Avoid double-proxying
  if (rawUrl.startsWith('http://127.0.0.1:') || rawUrl.startsWith('http://localhost:')) {
    return rawUrl;
  }
  return `http://127.0.0.1:${LOCAL_PROXY_PORT}/stream?url=${encodeURIComponent(rawUrl)}`;
}

/**
 * Resolves direct audio stream for a track via Tauri sidecar yt-dlp or direct previews
 * Caches in memory for instant 0 ms recall.
 */
const inflightResolves = new Map<string, Promise<string>>();

export function resolveTrackStream(track: Track): Promise<string> {
  const cached = streamCache.get(track.id);
  if (cached && Date.now() - cached.time < 4 * 3600 * 1000) return Promise.resolve(cached.url);
  // A click during a background prefetch joins the same request instead of starting a second one
  let pending = inflightResolves.get(track.id);
  if (!pending) {
    pending = doResolveTrackStream(track).finally(() => inflightResolves.delete(track.id));
    inflightResolves.set(track.id, pending);
  }
  return pending;
}

async function doResolveTrackStream(track: Track): Promise<string> {
  // 1. Instant Cache Hit (0 ms)
  const cached = streamCache.get(track.id);
  if (cached && Date.now() - cached.time < 4 * 3600 * 1000) {
    return cached.url;
  }

  // 2. Pre-existing full streamUrl (Audius 320k, Radio direct)
  if (track.streamUrl && track.source !== 'deezer' && track.source !== 'spotify') {
    const proxied = toProxiedStreamUrl(track.streamUrl);
    streamCache.set(track.id, { url: proxied, time: Date.now() });
    return proxied;
  }

  // 3. Resolve via Tauri sidecar (Desktop)
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const resolved = await invoke<string>('resolve_stream_url', {
        source: track.source,
        queryOrId: track.id.replace(/^([a-z]+-)/, ''),
        artist: track.artist || null,
        title: track.title || null,
      });
      const proxied = toProxiedStreamUrl(resolved);
      streamCache.set(track.id, { url: proxied, time: Date.now() });
      return proxied;
    } catch (err) {
      console.error('Error resolving track stream via Tauri sidecar:', err);
    }
  }

  // 4. Web PWA Server Resolver: fetch full studio stream via /api/resolve (yt-dlp)
  try {
    const videoId = track.source === 'ytmusic' ? track.id.replace('ytmusic-', '') : '';
    const params = new URLSearchParams();
    if (videoId) params.set('videoId', videoId);
    if (track.artist) params.set('artist', track.artist);
    if (track.title) params.set('title', track.title);
    if (track.previewUrl) params.set('previewUrl', track.previewUrl);
    params.set('q', `${track.artist} ${track.title}`.trim());

    const res = await fetch(`/api/resolve?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.streamUrl) {
        streamCache.set(track.id, { url: json.streamUrl, time: Date.now() });
        return json.streamUrl;
      }
    }
  } catch (err) {
    console.warn('Web PWA server resolver error:', err);
  }

  // 5. Cloud fallback: search Audius for matching full 320kbps track
  try {
    const cleanSearch = `${track.artist} ${track.title}`.trim();
    const audiusMatches = await searchAudius(cleanSearch, 3);
    if (audiusMatches[0]?.streamUrl) {
      streamCache.set(track.id, { url: audiusMatches[0].streamUrl, time: Date.now() });
      return audiusMatches[0].streamUrl;
    }
  } catch (err) {
    console.warn('Audius fallback error:', err);
  }

  throw new Error(`Flux audio complet indisponible pour : ${track.title}`);
}

/**
 * High-speed autonomous background pre-fetching engine.
 * Resolves upcoming tracks and hovered tracks so clicks start in 0 ms.
 */
class PrefetchManager {
  private queue: Track[] = [];
  private active = 0;
  private static readonly CONCURRENCY = 3;

  public enqueue(tracks: Track[], priority = false) {
    for (const t of tracks) {
      if (!t || t.streamUrl || streamCache.has(t.id) || inflightResolves.has(t.id)) continue;
      const known = this.queue.findIndex((q) => q.id === t.id);
      if (known >= 0) {
        if (!priority) continue;
        this.queue.splice(known, 1);
      }
      if (priority) this.queue.unshift(t);
      else this.queue.push(t);
    }
    this.pump();
  }

  private pump() {
    while (this.active < PrefetchManager.CONCURRENCY && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.active++;
      resolveTrackStream(next)
        .catch(() => undefined) // a failed prefetch is retried for real on click
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}

export const prefetchManager = new PrefetchManager();

const lyricsMemoryCache = new Map<string, string>();

/**
 * Cleans track titles for accurate lyrics matching (removes (Clip Officiel), feat, etc.)
 */
function cleanSongTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/(?:feat\.|ft\.).*$/i, '')
    .replace(/^[^-]+-\s*/, '')
    .trim();
}

/**
 * Fetches synchronized LRC lyrics from LRCLIB open database
 */
export async function fetchLyrics(
  title: string,
  artist: string,
  duration?: number
): Promise<{ lrc: string; isSynced: boolean } | null> {
  const cleanTitle = cleanSongTitle(title);
  const cleanArtist = (artist || '').replace(/(?:feat\.|ft\.).*$/i, '').trim();
  const cacheKey = `${cleanArtist.toLowerCase()}:${cleanTitle.toLowerCase()}`;

  if (lyricsMemoryCache.has(cacheKey)) {
    const cached = lyricsMemoryCache.get(cacheKey)!;
    return { lrc: cached, isSynced: cached.includes('[') };
  }

  try {
    const lrcBase = isTauri ? 'https://lrclib.net' : '/api/lyrics';

    // 1. Direct match with duration if available
    let directUrl = `${lrcBase}/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    if (duration && duration > 0) {
      directUrl += `&duration=${Math.round(duration)}`;
    }

    const res = await fetch(directUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        lyricsMemoryCache.set(cacheKey, data.syncedLyrics);
        return { lrc: data.syncedLyrics, isSynced: true };
      }
      if (data.plainLyrics) {
        lyricsMemoryCache.set(cacheKey, data.plainLyrics);
        return { lrc: data.plainLyrics, isSynced: false };
      }
    }

    // 2. Fallback to broad query search
    const searchUrl = `${lrcBase}/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`;
    const searchRes = await fetch(searchUrl);
    if (searchRes.ok) {
      const searchItems = await searchRes.json();
      if (Array.isArray(searchItems) && searchItems.length > 0) {
        const best = searchItems.find((s: any) => s.syncedLyrics) || searchItems[0];
        if (best?.syncedLyrics) {
          lyricsMemoryCache.set(cacheKey, best.syncedLyrics);
          return { lrc: best.syncedLyrics, isSynced: true };
        }
        if (best?.plainLyrics) {
          lyricsMemoryCache.set(cacheKey, best.plainLyrics);
          return { lrc: best.plainLyrics, isSynced: false };
        }
      }
    }
  } catch (err) {
    console.warn('Lyrics fetch note:', err);
  }

  return null;
}
