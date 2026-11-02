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
let isDemoMode = false;

// DOM Elements
const views = document.querySelectorAll('.view-panel');
const navItems = document.querySelectorAll('.nav-item');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const offlineBanner = document.getElementById('offline-banner');
const bannerUrl = document.getElementById('banner-url');
const bannerRetryBtn = document.getElementById('banner-retry-btn');
const bannerDemoBtn = document.getElementById('banner-demo-btn');
const bannerSettingsBtn = document.getElementById('banner-settings-btn');

const tracksTbody = document.getElementById('tracks-tbody');
const tracksCount = document.getElementById('tracks-count');
const tracksEmpty = document.getElementById('tracks-empty');
const tracksTableContainer = document.getElementById('tracks-table-container');
const tracksRetryBtn = document.getElementById('tracks-retry-btn');
const tracksDemoBtn = document.getElementById('tracks-demo-btn');

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
const demoToggleBtn = document.getElementById('demo-toggle-btn');

// Config DOM
const cfgUrl = document.getElementById('cfg-url');
const cfgUser = document.getElementById('cfg-user');
const cfgPass = document.getElementById('cfg-pass');
const cfgSaveBtn = document.getElementById('cfg-save-btn');
const cfgTestBtn = document.getElementById('cfg-test-btn');
const cfgFeedback = document.getElementById('cfg-feedback');

// Sample Demo Data (for testing when server is offline)
const DEMO_TRACKS = [
  {
    id: 'demo-1',
    title: 'Clair de Lune',
    artist: 'Claude Debussy',
    album: 'Suite Bergamasque',
    duration: 180,
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c89bdf1103.mp3?filename=debussy-clair-de-lune-111162.mp3',
    lyrics: `[00:00.00]Votre âme est un paysage choisi
[00:06.00]Que vont charmant masques et bergamasques
[00:13.00]Jouant du luth et dansant et quasi
[00:20.00]Tristes sous leurs déguisements fantasques.
[00:28.00]Tout en chantant sur le mode mineur
[00:36.00]L'amour vainqueur et la vie opportune,
[00:44.00]Ils n'ont pas l'air de croire à leur bonheur
[00:52.00]Et leur chanson se mêle au clair de lune,
[01:00.00]Au calme clair de lune triste et beau,
[01:10.00]Qui fait rêver les oiseaux dans les arbres
[01:20.00]Et sangloter d'extase les jets d'eau,
[01:30.00]Les grands jets d'eau sveltes parmi les marbres.`
  },
  {
    id: 'demo-2',
    title: 'Gymnopédie No. 1',
    artist: 'Erik Satie',
    album: 'Trois Gymnopédies',
    duration: 195,
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c6f2e20d20.mp3?filename=erik-satie-gymnopedie-no-1-105151.mp3',
    lyrics: `[00:00.00](Thème mélodique lent et contemplatif)
[00:15.00]Gymnopédie numéro un - Erik Satie
[00:30.00]Composée à Paris en 1888
[00:45.00]Harmonies épurées et atmosphériques
[01:00.00]Mazz MuZik - Lecture et synchronisation des paroles`
  },
  {
    id: 'demo-3',
    title: 'Canon in D Major',
    artist: 'Johann Pachelbel',
    album: 'Baroque Masterpieces',
    duration: 210,
    streamUrl: 'https://cdn.pixabay.com/download/audio/2021/11/01/audio_00a7b4618a.mp3?filename=canon-in-d-major-6754.mp3',
    lyrics: `[00:00.00]Basse continue en Ré majeur
[00:12.00]Entrée du premier violon
[00:24.00]Entrée du second violon en imitation canonique
[00:36.00]Polyphonie baroque à trois voix
[00:50.00]Mazz MuZik Player`
  }
];

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
  cfgUrl.value = client.serverUrl;
  cfgUser.value = client.username;
  cfgPass.value = client.password;
  bannerUrl.textContent = client.serverUrl;

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

  refreshBtn.addEventListener('click', () => {
    isDemoMode = false;
    demoToggleBtn.textContent = '🎵 Démo';
    checkConnectionAndLoad();
  });

  demoToggleBtn.addEventListener('click', () => {
    if (isDemoMode) {
      isDemoMode = false;
      demoToggleBtn.textContent = '🎵 Démo';
      checkConnectionAndLoad();
    } else {
      loadDemoData();
    }
  });

  // Banner Actions
  bannerRetryBtn.addEventListener('click', checkConnectionAndLoad);
  bannerDemoBtn.addEventListener('click', loadDemoData);
  bannerSettingsBtn.addEventListener('click', () => switchView('settings'));

  tracksRetryBtn.addEventListener('click', checkConnectionAndLoad);
  tracksDemoBtn.addEventListener('click', loadDemoData);

  // Settings Actions
  cfgSaveBtn.addEventListener('click', () => {
    client.saveConfig(cfgUrl.value.trim(), cfgUser.value.trim(), cfgPass.value);
    bannerUrl.textContent = client.serverUrl;
    cfgFeedback.className = 'feedback-msg success';
    cfgFeedback.textContent = 'Configuration enregistrée !';
    checkConnectionAndLoad();
  });

  cfgTestBtn.addEventListener('click', async () => {
    cfgFeedback.className = 'feedback-msg';
    cfgFeedback.textContent = 'Test en cours...';
    client.saveConfig(cfgUrl.value.trim(), cfgUser.value.trim(), cfgPass.value);
    bannerUrl.textContent = client.serverUrl;
    const ok = await client.ping();
    if (ok) {
      cfgFeedback.className = 'feedback-msg success';
      cfgFeedback.textContent = 'Connexion réussie !';
      updateStatus(true);
    } else {
      cfgFeedback.className = 'feedback-msg error';
      cfgFeedback.textContent = 'Échec : le serveur ne répond pas sur ce port.';
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
  offlineBanner.classList.toggle('hidden', online);
}

async function checkConnectionAndLoad() {
  const online = await client.ping();
  updateStatus(online);
  if (online) {
    await loadAllData();
  } else {
    showEmptyState(true);
  }
}

function showEmptyState(isOffline) {
  tracksEmpty.classList.remove('hidden');
  tracksTableContainer.classList.add('hidden');
  tracksCount.textContent = '0 titre';
  document.getElementById('tracks-empty-msg').textContent = isOffline
    ? `Le serveur Mazz MuZik n'est pas accessible sur ${client.serverUrl}. Démarrez le serveur (cargo run ou docker compose) ou chargez le mode démo pour tester.`
    : 'Votre serveur est connecté mais aucune piste n\'a encore été importée.';
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
  if (songs.length === 0) {
    showEmptyState(false);
    return;
  }

  tracksEmpty.classList.add('hidden');
  tracksTableContainer.classList.remove('hidden');
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

// Mode Démo pour tester immédiatement le lecteur et les paroles
function loadDemoData() {
  isDemoMode = true;
  demoToggleBtn.textContent = ' Quitter Démo';
  offlineBanner.classList.add('hidden');
  tracksEmpty.classList.add('hidden');
  tracksTableContainer.classList.remove('hidden');

  tracksCount.textContent = `${DEMO_TRACKS.length} titres (Démo)`;
  tracksTbody.innerHTML = '';

  DEMO_TRACKS.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(s.title)}</strong></td>
      <td>${escapeHtml(s.artist)}</td>
      <td>${escapeHtml(s.album)}</td>
      <td>${formatTime(s.duration)}</td>
    `;
    tr.addEventListener('click', () => {
      playTrackList(DEMO_TRACKS, idx);
    });
    tracksTbody.appendChild(tr);
  });

  // Albums démo
  albumsCount.textContent = '3 albums (Démo)';
  albumsGrid.innerHTML = '';
  DEMO_TRACKS.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.innerHTML = `
      <div class="card-cover">💿</div>
      <div class="card-title">${escapeHtml(s.album)}</div>
      <div class="card-sub">${escapeHtml(s.artist)}</div>
    `;
    card.addEventListener('click', () => playTrackList(DEMO_TRACKS, idx));
    albumsGrid.appendChild(card);
  });

  // Artistes démo
  artistsCount.textContent = '3 artistes (Démo)';
  artistsGrid.innerHTML = '';
  DEMO_TRACKS.forEach(s => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.innerHTML = `
      <div class="card-cover">🎙️</div>
      <div class="card-title">${escapeHtml(s.artist)}</div>
      <div class="card-sub">1 album</div>
    `;
    artistsGrid.appendChild(card);
  });

  // Lancer la première piste démo automatiquement
  playTrackList(DEMO_TRACKS, 0);
  switchView('tracks');
}

async function performSearch(query) {
  const container = document.getElementById('search-results');
  container.innerHTML = '<p class="empty-state">Recherche en cours...</p>';

  if (isDemoMode) {
    const filtered = DEMO_TRACKS.filter(t =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase())
    );
    displaySearchResults({ songs: filtered, albums: [], artists: [] });
    return;
  }

  const results = await client.search(query);
  displaySearchResults(results);
}

function displaySearchResults(results) {
  const container = document.getElementById('search-results');
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

  if (isDemoMode && track.streamUrl) {
    audio.src = track.streamUrl;
    audio.play().catch(() => {});
    parseAndDisplayLyrics(track.lyrics);
    return;
  }

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

  parseAndDisplayLyrics(raw);
}

function parseAndDisplayLyrics(rawLrc) {
  if (!rawLrc) {
    lyricsList.innerHTML = '<p class="lyrics-empty">Aucune parole disponible</p>';
    return;
  }

  const lines = rawLrc.split('\n');
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
    lyricsList.innerHTML = `<div class="lyric-line">${escapeHtml(rawLrc)}</div>`;
    return;
  }

  lyricsList.innerHTML = '';
  currentLyrics.forEach((item) => {
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
  return `${m}:${s < 10 ? '0' + s : s}`;
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
