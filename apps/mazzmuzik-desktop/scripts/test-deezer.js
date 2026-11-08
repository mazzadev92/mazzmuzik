async function testDeezer() {
  const res = await fetch('https://api.deezer.com/search?q=ninho&limit=5');
  const data = await res.json();
  console.log('Total Deezer tracks:', data.total);
  data.data.forEach((t, i) => {
    console.log(`[${i+1}] ID: ${t.id} | "${t.title}" by ${t.artist.name} | Album: "${t.album.title}" | Duration: ${t.duration}s | Cover: ${t.album.cover_big}`);
  });
}
testDeezer().catch(console.error);
