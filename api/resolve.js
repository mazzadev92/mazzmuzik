// Vercel Serverless Function: /api/resolve
// Resolves a FULL-LENGTH audio stream URL. Never returns 30 s previews.
// Cache chain: Upstash Redis REST (optional) -> in-memory TTL 4 h -> origin providers.
const TTL_SECONDS = 4 * 3600;
const CACHE_CONTROL = 'public, s-maxage=14400, stale-while-revalidate=3600';
const memory = new Map(); // warm-instance cache: key -> { value, expires }
const inflight = new Map(); // dedupe concurrent identical lookups

const normalize = (q) => q.toLowerCase().replace(/\s+/g, ' ').trim();

async function redis(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      signal: AbortSignal.timeout(1500),
    });
    return r.ok ? (await r.json()).result : null;
  } catch {
    return null;
  }
}

async function cacheGet(key) {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const raw = await redis(['GET', key]);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    memory.set(key, { value, expires: Date.now() + TTL_SECONDS * 1000 });
    return value;
  } catch {
    return null; // corrupt entry: treat as a miss
  }
}

async function cacheSet(key, value) {
  memory.set(key, { value, expires: Date.now() + TTL_SECONDS * 1000 });
  if (memory.size > 500) memory.delete(memory.keys().next().value);
  await redis(['SET', key, JSON.stringify(value), 'EX', TTL_SECONDS]);
}

async function resolveStream(searchQuery) {
  // 1. Bound backend service (mazzmuzik-server via MAZZMUZIK_SERVER_URL binding)
  const serverUrl = process.env.MAZZMUZIK_SERVER_URL || process.env.STREAM_RESOLVER_URL;
  if (serverUrl) {
    try {
      const target = new URL('/api/stream/url', serverUrl);
      target.searchParams.set('q', searchQuery);
      const r = await fetch(target, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const data = await r.json();
        const streamUrl = data.stream_url || data.streamUrl;
        if (streamUrl) return { streamUrl, source: 'mazzmuzik-server' };
      }
    } catch (err) {
      console.warn('MazzMuziK Server resolution error:', err);
    }
  }

  // 2. Audius: full-length 320 kbps stream, artist-published and free to stream
  try {
    const url = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(searchQuery)}&limit=3&app_name=MazzMuziK`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const first = (await r.json())?.data?.[0];
      if (first?.id) {
        return {
          streamUrl: `https://discoveryprovider.audius.co/v1/tracks/${first.id}/stream?app_name=MazzMuziK`,
          title: first.title,
          source: 'audius',
        };
      }
    }
  } catch (err) {
    console.warn('Audius resolution error:', err);
  }

  return null; // no 30 s preview fallback: caller decides what to do
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { artist, title, q } = req.query || {};
  const searchQuery = String(q || `${artist || ''} ${title || ''}`).trim();
  if (!searchQuery) return res.status(400).json({ error: 'Paramètre q manquant' });

  const key = `resolve:${normalize(searchQuery)}`;
  const cached = await cacheGet(key);
  if (cached) {
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.setHeader('X-Mazz-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = resolveStream(searchQuery).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const result = await pending;
  if (!result) {
    return res.status(404).json({ error: 'Flux studio introuvable' });
  }

  await cacheSet(key, result);
  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.setHeader('X-Mazz-Cache', 'MISS');
  return res.status(200).json(result);
}
