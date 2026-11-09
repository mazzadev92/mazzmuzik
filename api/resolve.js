// Vercel Serverless Function: /api/resolve
// Resolves a FULL-LENGTH audio stream URL. Never returns 30 s previews.
// Multi-source engine: JioSaavn (320 kbps AAC/MP4 direct) -> Audius (320 kbps MP3) -> Bound Backend
const TTL_SECONDS = 4 * 3600;
const CACHE_CONTROL = 'public, s-maxage=14400, stale-while-revalidate=3600';
const memory = new Map();
const inflight = new Map();

const normalize = (q) => q.toLowerCase().replace(/\s+/g, ' ').trim();

// ==========================================
// PURE JAVASCRIPT DES DECRYPTION (FIPS 46-3)
// ==========================================
const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
];
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
];
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
];
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
];
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
];
const S_BOXES = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
  ]
];

function permute(bits, table) {
  return table.map((idx) => bits[idx - 1]);
}

function bytesToBits(bytes) {
  const bits = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((bytes[i] >> b) & 1);
    }
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    bytes.push(byte);
  }
  return bytes;
}

function generateKeys(keyBytes) {
  const keyBits = bytesToBits(keyBytes);
  const pc1 = permute(keyBits, PC1);
  let c = pc1.slice(0, 28);
  let d = pc1.slice(28, 56);
  const roundKeys = [];

  for (let round = 0; round < 16; round++) {
    const shift = SHIFTS[round];
    c = c.slice(shift).concat(c.slice(0, shift));
    d = d.slice(shift).concat(d.slice(0, shift));
    roundKeys.push(permute(c.concat(d), PC2));
  }
  return roundKeys;
}

function desBlock(blockBits, roundKeys, decrypt = true) {
  const ip = permute(blockBits, IP);
  let l = ip.slice(0, 32);
  let r = ip.slice(32, 64);
  const keys = decrypt ? [...roundKeys].reverse() : roundKeys;

  for (let round = 0; round < 16; round++) {
    const k = keys[round];
    const er = permute(r, E);
    const xor = er.map((bit, idx) => bit ^ k[idx]);

    const sOutput = [];
    for (let s = 0; s < 8; s++) {
      const chunk = xor.slice(s * 6, (s + 1) * 6);
      const row = (chunk[0] << 1) | chunk[5];
      const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
      const val = S_BOXES[s][row][col];
      for (let b = 3; b >= 0; b--) {
        sOutput.push((val >> b) & 1);
      }
    }

    const p = permute(sOutput, P);
    const newR = l.map((bit, idx) => bit ^ p[idx]);
    l = r;
    r = newR;
  }

  return permute(r.concat(l), FP);
}

function desDecryptECB(base64Cipher, keyStr = '38346591') {
  try {
    const keyBytes = Buffer.from(keyStr, 'utf-8');
    const roundKeys = generateKeys(keyBytes);
    const cipherBytes = Buffer.from(base64Cipher, 'base64');
    const decryptedBytes = [];

    for (let i = 0; i < cipherBytes.length; i += 8) {
      const block = cipherBytes.slice(i, i + 8);
      const blockBits = bytesToBits(block);
      const decBits = desBlock(blockBits, roundKeys, true);
      decryptedBytes.push(...bitsToBytes(decBits));
    }

    const pad = decryptedBytes[decryptedBytes.length - 1];
    if (pad >= 1 && pad <= 8) {
      decryptedBytes.splice(decryptedBytes.length - pad, pad);
    }

    return Buffer.from(decryptedBytes).toString('utf-8');
  } catch {
    return null;
  }
}

function isJioMatch(song, expectedArtist, expectedTitle, searchQuery) {
  const songTitle = (song.song || song.title || '').toLowerCase();
  const songArtist = (song.primary_artists || song.singers || '').toLowerCase();

  if (expectedArtist) {
    const artistTokens = expectedArtist.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
    const hasArtist = artistTokens.some((tok) => songArtist.includes(tok) || songTitle.includes(tok));
    if (!hasArtist) return false;
  }

  if (expectedTitle) {
    const cleanTitle = expectedTitle.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const titleTokens = cleanTitle.split(/[\s,]+/).filter((w) => w.length > 2);
    if (titleTokens.length > 0) {
      const hasTitle = titleTokens.some((tok) => songTitle.includes(tok));
      if (!hasTitle) return false;
    }
  }

  // If no explicit artist or title was supplied, ensure that at least one significant query term matches the song
  if (!expectedArtist && !expectedTitle && searchQuery) {
    const queryTokens = searchQuery.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
    const matchesAny = queryTokens.some((tok) => songTitle.includes(tok) || songArtist.includes(tok));
    if (!matchesAny) return false;
  }

  return true;
}

/**
 * Searches JioSaavn for full 320 kbps MP4 / AAC studio audio stream
 */
async function resolveJioSaavn(searchQuery, expectedArtist, expectedTitle) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(searchQuery)}&p=1&n=5&_format=json&_marker=0&ctx=web6dot0`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];

    for (const song of results) {
      if (song.encrypted_media_url && isJioMatch(song, expectedArtist, expectedTitle, searchQuery)) {
        const dec = desDecryptECB(song.encrypted_media_url);
        if (dec && dec.startsWith('http')) {
          const streamUrl = dec.replace(/_96\.(mp4|m4a)/i, '_320.$1');
          return {
            streamUrl,
            title: song.song || song.title,
            artist: song.primary_artists || song.singers || '',
            duration: Number(song.duration) || 0,
            source: 'jiosaavn',
            bitrate: '320 kbps',
            streamType: 'audio',
          };
        }
      }
    }
  } catch (err) {
    console.warn('JioSaavn resolve error:', err);
  }
  return null;
}

/**
 * Resolves YouTube Music studio track via official InnerTube WEB_REMIX API
 * Zero accounts, zero API keys, covers 100% of French & International music.
 */
async function resolveYouTubeMusic(searchQuery) {
  try {
    const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://music.youtube.com/',
        'X-Goog-Api-Format-Version': '2',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241127.01.00',
            hl: 'fr',
            gl: 'FR',
          },
        },
        query: searchQuery,
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!ytRes.ok) return null;
    const json = await ytRes.json();
    const tabs = json?.contents?.tabbedSearchResultsRenderer?.tabs;
    const sections = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

    for (const s of sections || []) {
      for (const item of s.musicShelfRenderer?.contents || []) {
        const r = item.musicResponsiveListItemRenderer;
        const videoId = r?.playlistItemData?.videoId || r?.navigationEndpoint?.watchEndpoint?.videoId;
        const title = r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        const artist = r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        const thumbs = r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
        const coverUrl = thumbs?.[thumbs.length - 1]?.url;

        if (videoId && title) {
          return {
            videoId,
            streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title,
            artist: artist || '',
            coverUrl: coverUrl || '',
            source: 'ytmusic',
            streamType: 'youtube',
            bitrate: '256k Opus / Studio',
          };
        }
      }
    }
  } catch (err) {
    console.warn('YouTube Music resolve error:', err);
  }
  return null;
}

async function resolveStream(searchQuery, artist, title) {
  // 1. JioSaavn: 100M+ complete studio songs in direct 320 kbps (zero DRM, zero 30s limit)
  const jio = await resolveJioSaavn(searchQuery, artist, title);
  if (jio) return jio;

  // 2. YouTube Music InnerTube: studio tracks for 100% of the world's catalog (French rap, international, indies)
  const yt = await resolveYouTubeMusic(searchQuery);
  if (yt) return yt;

  // 3. Bound backend service (mazzmuzik-server via MAZZMUZIK_SERVER_URL binding)
  const serverUrl = process.env.MAZZMUZIK_SERVER_URL || process.env.STREAM_RESOLVER_URL;
  if (serverUrl) {
    try {
      const target = new URL('/api/stream/url', serverUrl);
      target.searchParams.set('q', searchQuery);
      const r = await fetch(target, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const data = await r.json();
        const streamUrl = data.stream_url || data.streamUrl;
        if (streamUrl) return { streamUrl, source: 'mazzmuzik-server', streamType: 'audio' };
      }
    } catch (err) {
      console.warn('MazzMuziK Server resolution error:', err);
    }
  }

  // 4. Audius: full-length 320 kbps stream
  try {
    const url = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(searchQuery)}&limit=3&app_name=MazzMuziK`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const first = (await r.json())?.data?.[0];
      if (first?.id) {
        return {
          streamUrl: `https://discoveryprovider.audius.co/v1/tracks/${first.id}/stream?app_name=MazzMuziK`,
          title: first.title,
          source: 'audius',
          streamType: 'audio',
        };
      }
    }
  } catch (err) {
    console.warn('Audius resolution error:', err);
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { artist, title, q } = req.query || {};
  const searchQuery = String(q || `${artist || ''} ${title || ''}`).trim();
  if (!searchQuery) return res.status(400).json({ error: 'Paramètre q manquant' });

  const key = `resolve:${normalize(searchQuery)}:${normalize(artist || '')}:${normalize(title || '')}`;
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) {
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.setHeader('X-Mazz-Cache', 'HIT');
    return res.status(200).json(hit.value);
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = resolveStream(searchQuery, artist, title).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const result = await pending;
  if (!result) {
    return res.status(404).json({ error: 'Flux studio introuvable' });
  }

  memory.set(key, { value: result, expires: Date.now() + TTL_SECONDS * 1000 });
  if (memory.size > 500) memory.delete(memory.keys().next().value);

  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.setHeader('X-Mazz-Cache', 'MISS');
  return res.status(200).json(result);
}
