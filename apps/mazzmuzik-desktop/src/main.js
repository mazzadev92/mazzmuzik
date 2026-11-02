import { SubsonicClient } from './api.js';

const client = new SubsonicClient();
const audio = document.getElementById('audio-engine');

// State
let currentQueue = [];
let currentIndex = -1;
let currentLyrics = [];
let activeLyricIdx = -1;
let isShuffle = false;
let isRepeat = false;

// DOM Elements
const views = document.querySelectorAll('.view-panel');
const navItems = document.querySelectorAll('.nav-item');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const tracksTbody = document.getElementById('tracks-tbody');
const tracksCount = document.getElementById('tracks-count');
const albumsGrid = document.getElementById('albums-grid');
const albumsCount = document.getElementById('albums-count');
const artistsGrid = document.getElementById('artists-grid');
const artistsCount = document.getElementById('artists-count');

const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playBtn = document.getElementById('btn-play');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const shuffleBtn = document.getElementById('btn-shuffle');
const repeatBtn = document.getElementById('btn-repeat');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const volSlider = document.getElementById('vol-slider');
const volIcon = document.getElementById('vol-icon');

const lyricsDrawer = document.getElementById('lyrics-drawer');
const lyricsBtn = document.getElementById('btn-lyrics');
const closeLyricsBtn = document.getElementById('close-lyrics-btn');
const lyricsList = document.getElementById('lyrics-list');

const quickSearchInput = document.getElementById('quick-search');
const refreshBtn = document.getElementById('refresh-btn');

// Config DOM
const cfgUrl = document.getElementById('cfg-url');
const cfgUser = document.getElementById('cfg-user');
const cfgPass = document.getElementById('cfg-pass');
const cfgSaveBtn = document.getElementById('cfg-save-btn');
const cfgTestBtn = document.getElementById('cfg-test-btn');
const cfgFeedback = document.getElementById('cfg-feedback');

// Init
window.addEventListener('DOMContentLoaded', async () => {
  cfgUrl.value = client.serverUrl;
  cfgUser.value = client.username;
  cfgPass.value = client.password;

  audio.volume = parseFloat(volSlider.value);

  setupEventListeners();
  await checkConnectionAndLoad();
});

function setupEventListeners() {
  // Navigation
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      switchView(targetView);
    });
  });

  // Audio Events
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('ended', onTrackEnded);
  audio.addEventListener('play', () => { playBtn.textContent = '⏸'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });

  // Player Controls
  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', playPrevious);
  nextBtn.addEventListener('click', playNext);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.style.color = isShuffle ? 'var(--accent)' : 'var(--text-muted)';
  });

  repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.style.color = isRepeat ? 'var(--accent)' : 'var(--text-muted)';
  });

  progressContainer.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
  });

  volSlider.addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
    volIcon.textContent = audio.volume === 0 ? '🔇' : (audio.volume < 0.5 ? '🔉' : '🔊');
  });

  // Lyrics Drawer
  lyricsBtn.addEventListener('click', () => {
    lyricsDrawer.classList.toggle('open');
    lyricsBtn.classList.toggle('active');
  });
  closeLyricsBtn.addEventListener('click', () => {
    lyricsDrawer.classList.remove('open');
    lyricsBtn.classList.remove('active');
  });

  // Quick Search
  let searchTimeout = null;
  quickSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = e.target.value.trim();
      if (q) {
        switchView('search');
        performSearch(q);
      }
    }, 300);
  });

  refreshBtn.addEventListener('click', loadAllData);

  // Settings Actions
  cfgSaveBtn.addEventListener('click', () => {
    client.saveConfig(cfgUrl.value.trim(), cfgUser.value.trim(), cfgPass.value);
    cfgFeedback.className = 'feedback-msg success';
    cfgFeedback.textContent = 'Configuration enregistrée !';
    checkConnectionAndLoad();
  });

  cfgTestBtn.addEventListener('click', async () => {
    cfgFeedback.className = 'feedback-msg';
    cfgFeedback.textContent = 'Test en cours...';
    client.saveConfig(cfgUrl.value.trim(), cfgUser.value.trim(), cfgPass.value);
    const ok = await client.ping();
    if (ok) {
      cfgFeedback.className = 'feedback-msg success';
      cfgFeedback.textContent = 'Connexion réussie !';
      updateStatus(true);
    } else {
      cfgFeedback.className = 'feedback-msg error';
      cfgFeedback.textContent = 'Échec de connexion au serveur.';
      updateStatus(false);
    }
  });

  // Keyboard Shortcuts (Media Keys & Space)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight' && e.ctrlKey) {
      playNext();
    } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
      playPrevious();
    }
  });
}

function switchView(viewName) {
  navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
  views.forEach(v => v.classList.toggle('active', v.id === `view-${viewName}`));
}

function updateStatus(online) {
  statusDot.classList.toggle('online', online);
  statusText.textContent = online ? 'Connecté' : 'Déconnecté';
}

async function checkConnectionAndLoad() {
  const online = await client.ping();
  updateStatus(online);
  if (online) {
    await loadAllData();
  }
}

async function loadAllData() {
  await Promise.all([
    loadTracks(),
    loadAlbums(),
    loadArtists()
  ]);
}

async function loadTracks() {
  const songs = await client.getRandomSongs(100);
  tracksCount.textContent = `${songs.length} titres`;
  tracksTbody.innerHTML = '';
  songs.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(s.title || 'Sans titre')}</strong></td>
      <td>${escapeHtml(s.artist || 'Artiste inconnu')}</td>
      <td>${escapeHtml(s.album || '-')}</td>
      <td>${formatTime(s.duration || 0)}</td>
    `;
    tr.addEventListener('click', () => {
      playTrackList(songs, idx);
    });
    tracksTbody.appendChild(tr);
  });
}

async function loadAlbums() {
  const albums = await client.getAlbums('recent', 50);
  albumsCount.textContent = `${albums.length} albums`;
  albumsGrid.innerHTML = '';
  albums.forEach(al => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.innerHTML = `
      <div class="card-cover">💿</div>
      <div class="card-title">${escapeHtml(al.title || al.name || 'Sans titre')}</div>
      <div class="card-sub">${escapeHtml(al.artist || 'Artiste inconnu')}</div>
    `;
    card.addEventListener('click', async () => {
      const fullAlbum = await client.getAlbum(al.id);
      if (fullAlbum && fullAlbum.song) {
        playTrackList(fullAlbum.song, 0);
      }
    });
    albumsGrid.appendChild(card);
  });
}

async function loadArtists() {
  const artists = await client.getArtists();
  artistsCount.textContent = `${artists.length} artistes`;
  artistsGrid.innerHTML = '';
  artists.forEach(a => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.innerHTML = `
      <div class="card-cover">🎙️</div>
      <div class="card-title">${escapeHtml(a.name || 'Artiste')}</div>
      <div class="card-sub">${a.albumCount || 0} albums</div>
    `;
    artistsGrid.appendChild(card);
  });
}

async function performSearch(query) {
  const container = document.getElementById('search-results');
  container.innerHTML = '<p class="empty-state">Recherche en cours...</p>';
  const results = await client.search(query);
  container.innerHTML = '';

  if (results.songs.length === 0 && results.albums.length === 0 && results.artists.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun résultat trouvé pour cette recherche.</p>';
    return;
  }

  if (results.songs.length > 0) {
    const sec = document.createElement('div');
    sec.innerHTML = `<h3 style="margin-bottom: 12px; color: var(--primary);">Titres</h3>`;
    const table = document.createElement('table');
    table.className = 'tracks-table';
    table.innerHTML = `<tbody></tbody>`;
    results.songs.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(s.title)}</strong></td>
        <td>${escapeHtml(s.artist)}</td>
        <td>${formatTime(s.duration || 0)}</td>
      `;
      tr.addEventListener('click', () => playTrackList(results.songs, idx));
      table.querySelector('tbody').appendChild(tr);
    });
    sec.appendChild(table);
    container.appendChild(sec);
  }
}

// Player Functions
function playTrackList(tracks, index) {
  currentQueue = tracks;
  currentIndex = index;
  loadCurrentTrack();
}

async function loadCurrentTrack() {
  if (currentIndex < 0 || currentIndex >= currentQueue.length) return;
  const track = currentQueue[currentIndex];

  playerTitle.textContent = track.title || 'Sans titre';
  playerArtist.textContent = track.artist || 'Artiste inconnu';

  const streamUrl = client.buildStreamUrl(track.id);
  audio.src = streamUrl;
  audio.play().catch(() => {});

  loadLyrics(track.artist, track.title);
}

function togglePlay() {
  if (!audio.src) {
    if (currentQueue.length > 0) loadCurrentTrack();
    return;
  }
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function playNext() {
  if (currentQueue.length === 0) return;
  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * currentQueue.length);
  } else {
    currentIndex = (currentIndex + 1) % currentQueue.length;
  }
  loadCurrentTrack();
}

function playPrevious() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (currentQueue.length === 0) return;
  currentIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
  loadCurrentTrack();
}

function onTrackEnded() {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNext();
  }
}

function onTimeUpdate() {
  if (!audio.duration) return;
  const pos = (audio.currentTime / audio.duration) * 100;
  progressBar.style.width = `${pos}%`;
  timeCurrent.textContent = formatTime(audio.currentTime);

  updateActiveLyric(audio.currentTime);
}

// Synced Lyrics
async function loadLyrics(artist, title) {
  lyricsList.innerHTML = '<p class="lyrics-empty">Recherche des paroles...</p>';
  currentLyrics = [];
  activeLyricIdx = -1;

  const raw = await client.getLyrics(artist, title);
  if (!raw) {
    lyricsList.innerHTML = '<p class="lyrics-empty">Aucune parole synchronisée disponible</p>';
    return;
  }

  // Parse LRC
  const lines = raw.split('\n');
  const parsed = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = regex.exec(line.trim());
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const frac = parseInt(match[3], 10);
      const ms = match[3].length === 2 ? frac * 10 : frac;
      const totalSec = min * 60 + sec + ms / 1000;
      parsed.push({ time: totalSec, text: match[4].trim() });
    }
  }

  parsed.sort((a, b) => a.time - b.time);
  currentLyrics = parsed;

  if (currentLyrics.length === 0) {
    lyricsList.innerHTML = `<div class="lyric-line">${escapeHtml(raw)}</div>`;
    return;
  }

  lyricsList.innerHTML = '';
  currentLyrics.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'lyric-line';
    div.textContent = item.text || '...';
    div.addEventListener('click', () => {
      audio.currentTime = item.time;
    });
    lyricsList.appendChild(div);
  });
}

function updateActiveLyric(time) {
  if (currentLyrics.length === 0) return;
  let targetIdx = -1;
  for (let i = currentLyrics.length - 1; i >= 0; i--) {
    if (time >= currentLyrics[i].time) {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx !== activeLyricIdx && targetIdx >= 0) {
    activeLyricIdx = targetIdx;
    const lyricElements = lyricsList.querySelectorAll('.lyric-line');
    lyricElements.forEach((el, i) => {
      el.classList.toggle('active', i === targetIdx);
    });

    const activeEl = lyricElements[targetIdx];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// Helpers
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padLeft ? s.toString().padStart(2, '0') : (s < 10 ? '0' + s : s)}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
    }
  });
}
