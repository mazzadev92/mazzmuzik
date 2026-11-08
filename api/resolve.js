// Vercel Serverless Function: /api/resolve
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { videoId, artist, title, q } = req.query || {};
  const searchQuery = (q || `${artist || ''} ${title || ''}`).trim();

  // 1. External dedicated resolver (if configured in Vercel environment variables)
  const externalResolver = process.env.STREAM_RESOLVER_URL;
  if (externalResolver) {
    try {
      const targetUrl = `${externalResolver}/api/resolve?${new URLSearchParams(req.query).toString()}`;
      const extRes = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
      if (extRes.ok) {
        const data = await extRes.json();
        if (data.streamUrl) {
          return res.status(200).json({ streamUrl: data.streamUrl, source: 'external' });
        }
      }
    } catch (err) {
      console.warn('External resolver error:', err);
    }
  }

  // 2. High Quality Audius 320kbps full studio stream match
  if (searchQuery) {
    try {
      const audiusUrl = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(searchQuery)}&limit=3&app_name=MazzMuziK`;
      const aRes = await fetch(audiusUrl, { signal: AbortSignal.timeout(5000) });
      if (aRes.ok) {
        const json = await aRes.json();
        const first = json?.data?.[0];
        if (first?.id) {
          const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${first.id}/stream?app_name=MazzMuziK`;
          return res.status(200).json({ streamUrl, title: first.title, source: 'audius' });
        }
      }
    } catch (err) {
      console.warn('Audius resolution error:', err);
    }
  }

  // 3. Fallback: Deezer direct preview stream
  if (searchQuery) {
    try {
      const deezerRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=1`, { signal: AbortSignal.timeout(4000) });
      if (deezerRes.ok) {
        const dJson = await deezerRes.json();
        const dTrack = dJson?.data?.[0];
        if (dTrack?.preview) {
          return res.status(200).json({ streamUrl: dTrack.preview, isPreview: true, source: 'deezer' });
        }
      }
    } catch (err) {
      console.warn('Deezer fallback error:', err);
    }
  }

  return res.status(404).json({ error: 'Flux audio introuvable' });
}
