// Vercel Serverless Function: /api/spotify
// Sovereign, zero-auth Spotify metadata parser (tracks, playlists, albums)
// Uses Spotify public embed endpoints & __NEXT_DATA__ SSR state without API keys.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, id: queryId, type: queryType } = req.query || {};
  let targetType = queryType;
  let targetId = queryId;

  if (url) {
    const raw = decodeURIComponent(String(url));
    const match = raw.match(/(?:open\.spotify\.com|spotify(?::|\/))(?:\/(?:intl-[a-z]{2}\/)?|\/)?(track|playlist|album)[:/]([a-zA-Z0-9]+)/i);
    if (match) {
      targetType = match[1].toLowerCase();
      targetId = match[2];
    }
  }

  if (!targetType || !targetId) {
    return res.status(400).json({ error: 'URL ou identifiant Spotify invalide' });
  }

  try {
    const embedUrl = `https://open.spotify.com/embed/${targetType}/${targetId}`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Erreur Spotify (${response.status})` });
    }

    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      return res.status(502).json({ error: 'Données Spotify indisponibles' });
    }

    const parsed = JSON.parse(nextDataMatch[1]);
    const entity = parsed?.props?.pageProps?.state?.data?.entity;
    if (!entity) {
      return res.status(404).json({ error: 'Entité Spotify introuvable' });
    }

    if (targetType === 'track') {
      const coverUrl =
        entity.visualIdentity?.image?.[0]?.url ||
        entity.album?.coverArt?.sources?.[0]?.url ||
        '';

      const track = {
        id: `spotify-${entity.id || targetId}`,
        title: entity.name || entity.title,
        artist:
          (entity.artists && entity.artists.map((a) => a.name).join(', ')) ||
          entity.subtitle ||
          'Artiste Inconnu',
        album: entity.album?.name || 'Single',
        duration: Math.round((entity.duration || 0) / 1000),
        coverUrl,
        source: 'spotify',
        previewUrl: entity.audioPreview?.url || undefined,
        bitrate: '320k direct',
      };

      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
      return res.status(200).json({
        type: 'track',
        platform: 'spotify',
        track,
        tracks: [track],
      });
    }

    // Playlist or Album
    const coverUrl =
      entity.visualIdentity?.image?.[0]?.url ||
      entity.album?.coverArt?.sources?.[0]?.url ||
      '';

    const tracks = (entity.trackList || []).map((t, idx) => ({
      id: `spotify-${t.id || (t.uri ? t.uri.split(':').pop() : `${targetId}-${idx}`)}`,
      title: t.title || t.name,
      artist:
        t.subtitle ||
        (t.artists && t.artists.map((a) => a.name).join(', ')) ||
        'Artiste Inconnu',
      album: entity.name || entity.title || 'Collection Spotify',
      duration: Math.round((t.duration || 0) / 1000),
      coverUrl: coverUrl,
      source: 'spotify',
      previewUrl: t.audioPreview?.url || undefined,
      bitrate: '320k direct',
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');
    return res.status(200).json({
      type: targetType,
      platform: 'spotify',
      id: targetId,
      title: entity.name || entity.title,
      description: entity.description || entity.subtitle || '',
      coverUrl,
      trackCount: tracks.length,
      tracks,
    });
  } catch (err) {
    console.error('Spotify parser error:', err);
    return res.status(500).json({ error: 'Erreur interne lors du traitement Spotify' });
  }
}
