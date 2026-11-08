async function testInnerTube() {
  const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Format-Version': '2',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241127.01.00', hl: 'fr', gl: 'FR' } },
      query: 'ninho',
      params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D'
    })
  });

  const data = await res.json();
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
  const contents = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const shelf = contents.find(c => c.musicShelfRenderer)?.musicShelfRenderer;
  const items = shelf?.contents || [];
  console.log('Total items found:', items.length);
  for (let i = 0; i < Math.min(items.length, 5); i++) {
    const item = items[i].musicResponsiveListItemRenderer;
    const videoId = item?.playlistItemData?.videoId;
    const title = item?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
    const artistRuns = item?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    const artist = artistRuns.map(r => r.text).join('');
    const duration = item?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
    const thumb = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
    console.log(`[${i+1}] videoId: ${videoId} | Title: "${title}" | Artist/Album: "${artist}" | Duration: ${duration} | Thumb: ${thumb}`);
  }
}

testInnerTube().catch(console.error);
