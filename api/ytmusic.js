// Vercel Serverless Function: /api/ytmusic
// Proxies InnerTube API calls to music.youtube.com with required Google headers
// Enables 100% full-track streaming and search across Web, iOS, and Android

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Goog-Api-Format-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  // 1. If it's a GET search or resolve request
  if (req.method === 'GET') {
    const { q, artist, title } = req.query || {};
    const searchQuery = String(q || `${artist || ''} ${title || ''}`).trim();
    if (!searchQuery) {
      return res.status(400).json({ error: 'Paramètre q ou artist+title manquant' });
    }

    try {
      const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'Referer': 'https://music.youtube.com/',
          'X-Goog-Api-Format-Version': '2'
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20241127.01.00',
              hl: 'fr',
              gl: 'FR'
            }
          },
          query: searchQuery,
          params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D'
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (!ytRes.ok) {
        return res.status(ytRes.status).json({ error: `Erreur YouTube: ${ytRes.status}` });
      }

      const json = await ytRes.json();
      const tabs = json?.contents?.tabbedSearchResultsRenderer?.tabs;
      const sections = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      const tracks = [];

      for (const s of sections || []) {
        const contents = s.musicShelfRenderer?.contents;
        for (const item of contents || []) {
          const r = item.musicResponsiveListItemRenderer;
          if (!r) continue;
          const videoId = r.playlistItemData?.videoId || r.navigationEndpoint?.watchEndpoint?.videoId;
          const titleText = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
          const artistText = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
          const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
          const cover = thumbs?.[thumbs.length - 1]?.url;
          if (videoId && titleText) {
            tracks.push({
              id: `ytmusic-${videoId}`,
              videoId,
              title: titleText,
              artist: artistText || 'Artiste Inconnu',
              coverUrl: cover || '',
              source: 'ytmusic'
            });
          }
        }
      }

      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');
      return res.status(200).json({ tracks, count: tracks.length, bestVideoId: tracks[0]?.videoId || null });
    } catch (err) {
      console.error('Erreur API ytmusic GET:', err);
      return res.status(500).json({ error: err.message || 'Erreur interne' });
    }
  }

  // 2. If it's a POST request (forwards directly to YouTube Music InnerTube)
  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const targetUrl = 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false';

    const ytRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'Referer': 'https://music.youtube.com/',
        'X-Goog-Api-Format-Version': '2'
      },
      body: rawBody,
      signal: AbortSignal.timeout(8000)
    });

    const data = await ytRes.json();
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=900');
    return res.status(ytRes.status).json(data);
  } catch (err) {
    console.error('Erreur proxy ytmusic POST:', err);
    return res.status(500).json({ error: err.message || 'Erreur interne proxy YouTube' });
  }
}
