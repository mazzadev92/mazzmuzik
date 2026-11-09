import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, RepeatMode } from '../types/music';
import { audioEngine } from '../services/audioEngine';
import { RequestGate, transition, type PlaybackEvent, type PlaybackState } from '../services/playbackMachine';

const gate = new RequestGate();

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  playbackState: PlaybackState;
  playbackError: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  isRightPanelOpen: boolean;
  rightPanelView: 'queue' | 'lyrics';
  isEqOpen: boolean;
  isVisualizerOpen: boolean;
  isNowPlayingOpen: boolean;
  isLoadingTrack: boolean;
  isLoadingLyrics: boolean;
  isLyricsSynced: boolean;

  // Actions
  playTrack: (track: Track) => Promise<void>;
  fetchCurrentLyrics: () => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleRightPanel: () => void;
  setRightPanelView: (view: 'queue' | 'lyrics') => void;
  toggleEq: () => void;
  toggleVisualizer: () => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
}

function syncMediaSessionMetadata(track: Track) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const artwork = track.coverUrl
      ? [
          { src: track.coverUrl, sizes: '300x300', type: 'image/jpeg' },
          { src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
        ]
      : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'MazzMuziK HiFi',
      artwork,
    });
  } catch (err) {
    console.warn('MediaSession metadata sync error:', err);
  }
}

function setupMediaSessionActions(
  togglePlay: () => void,
  nextTrack: () => void,
  prevTrack: () => void,
  seek: (sec: number) => void
) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        seek(details.seekTime);
      }
    });
  } catch (err) {
    console.warn('MediaSession action handler setup error:', err);
  }
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      const fire = (event: PlaybackEvent) => {
        const cur = get().playbackState;
        const next = transition(cur, event);
        if (next !== cur) set({ playbackState: next });
      };

      // Connect audioEngine events
      audioEngine.setListeners({
        onTimeUpdate: (curr, dur) => {
          set({ currentTime: curr, duration: dur });
          if (
            typeof window !== 'undefined' &&
            'mediaSession' in navigator &&
            'setPositionState' in navigator.mediaSession
          ) {
            try {
              if (dur > 0 && Number.isFinite(curr)) {
                navigator.mediaSession.setPositionState({
                  duration: dur,
                  playbackRate: 1,
                  position: Math.min(curr, dur),
                });
              }
            } catch {
              // ignore out of bounds position states
            }
          }
        },
        onBuffering: (buffering) => fire(buffering ? 'WAITING' : 'CANPLAY'),
        onError: () => {
          const t = get().currentTrack;
          if (t) void import('../services/api').then(({ invalidateStream }) => invalidateStream(t.id));
          fire('FAIL');
          set({ isPlaying: false, isLoadingTrack: false });
        },
        onPlayStateChange: (playing) => {
          fire(playing ? 'RESUME' : 'PAUSE');
          set({ isPlaying: playing });
          if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
          }
        },
        onEnded: () => {
          const { repeatMode, nextTrack, currentTrack } = get();
          if (repeatMode === 'one' && currentTrack) {
            audioEngine.seek(0);
            audioEngine.resume();
          } else {
            nextTrack();
          }
        },
      });

      // Setup MediaSession Action Handlers (iOS / Android lock screen controls)
      setupMediaSessionActions(
        () => get().togglePlay(),
        () => get().nextTrack(),
        () => get().prevTrack(),
        (sec) => get().seek(sec)
      );

      return {
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        isPlaying: false,
        playbackState: 'idle' as PlaybackState,
        playbackError: null as string | null,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        isMuted: false,
        isShuffled: false,
        repeatMode: 'off',
        isRightPanelOpen: false,
        rightPanelView: 'queue',
        isEqOpen: false,
        isVisualizerOpen: false,
        isNowPlayingOpen: false,
        isLoadingTrack: false,
        isLoadingLyrics: false,
        isLyricsSynced: false,

        playTrack: async (track: Track) => {
          const token = gate.next();
                    // Show the new track instantly (0 ms perceived), whatever the previous state was.
          fire('REQUEST');
          set({
            playbackError: null,
            currentTrack: track,
            isPlaying: true,
            isLoadingTrack: true,
            isLoadingLyrics: !track.lyrics,
            currentTime: 0,
            duration: 0,
          });
          syncMediaSessionMetadata(track);

          // Fetch lyrics in background immediately
          if (!track.lyrics) {
            import('../services/api').then(async ({ fetchLyrics }) => {
              const lyr = await fetchLyrics(track.title, track.artist, track.duration);
              const { currentTrack } = get();
              if (!gate.isStale(token) && currentTrack && currentTrack.id === track.id) {
                set({
                  currentTrack: { ...currentTrack, lyrics: lyr?.lrc || '' },
                  isLyricsSynced: lyr?.isSynced ?? false,
                  isLoadingLyrics: false,
                });
              }
            }).catch(() => {
              if (!gate.isStale(token)) set({ isLoadingLyrics: false });
            });
          }

          try {
            const { resolveTrackStream, resolveYouTubeVideoId } = await import('../services/api');

            // 1. Direct High-Fidelity Stream Resolution (JioSaavn 320k, Desktop yt-dlp, Audius 320k, Live Radios)
            let streamUrl = track.streamUrl;
            if (!streamUrl || track.source === 'deezer' || track.source === 'spotify') {
              try {
                streamUrl = await resolveTrackStream(track);
              } catch (resErr) {
                console.warn('Direct stream resolution warning, trying fallbacks:', resErr);
              }
            }
            if (gate.isStale(token)) return;

            if (streamUrl) {
              fire('RESOLVED');
              const updatedTrack = { ...track, streamUrl };
              set({ currentTrack: updatedTrack });
              syncMediaSessionMetadata(updatedTrack);

              await audioEngine.playTrack(streamUrl);
              if (gate.isStale(token)) return;
              set({ isPlaying: true, isLoadingTrack: false, playbackError: null });
              fire('CANPLAY');

              const { queue, queueIndex } = get();
              const upcoming = queue.slice(queueIndex + 1, queueIndex + 5);
              if (upcoming.length > 0) {
                const { prefetchManager } = await import('../services/api');
                prefetchManager.enqueue(upcoming);
              }
              return;
            }

            // 2. Secondary Engine: YouTube video ID resolution for YouTube-only songs
            let videoId = track.source === 'ytmusic' ? track.id.replace('ytmusic-', '') : '';
            if (!videoId) {
              try {
                videoId = (await resolveYouTubeVideoId(track.artist, track.title)) || '';
              } catch {}
            }

            if (videoId) {
              fire('RESOLVED');
              const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
              const updatedTrack = { ...track, streamUrl: ytUrl };
              set({ currentTrack: updatedTrack });
              syncMediaSessionMetadata(updatedTrack);

              await audioEngine.playYouTube(videoId);
              if (gate.isStale(token)) return;
              set({ isPlaying: true, isLoadingTrack: false, playbackError: null });
              fire('CANPLAY');

              const { queue, queueIndex } = get();
              const upcoming = queue.slice(queueIndex + 1, queueIndex + 5);
              if (upcoming.length > 0) {
                const { prefetchManager } = await import('../services/api');
                prefetchManager.enqueue(upcoming);
              }
              return;
            }

            throw new Error(`Flux audio indisponible pour : ${track.title}`);
          } catch (err) {
            if (gate.isStale(token)) return;
            console.error('Failed to resolve and play track:', err);
            fire('FAIL');
            set({
              isPlaying: false,
              isLoadingTrack: false,
              playbackError: err instanceof Error ? err.message : 'Lecture impossible',
            });
          }
        },

        fetchCurrentLyrics: async () => {
          const { currentTrack } = get();
          if (!currentTrack) return;
          set({ isLoadingLyrics: true });
          try {
            const { fetchLyrics } = await import('../services/api');
            const lyr = await fetchLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration);
            const now = get().currentTrack;
            if (now && now.id === currentTrack.id) {
              set({
                currentTrack: { ...now, lyrics: lyr?.lrc || '' },
                isLyricsSynced: lyr?.isSynced ?? false,
                isLoadingLyrics: false,
              });
            }
          } catch {
            set({ isLoadingLyrics: false });
          }
        },

        togglePlay: () => {
          const { isPlaying, currentTrack } = get();
          if (!currentTrack) return;
          if (isPlaying) {
            audioEngine.pause();
            set({ isPlaying: false });
          } else {
            audioEngine.resume();
            set({ isPlaying: true });
          }
        },

        nextTrack: () => {
          const { queue, queueIndex, isShuffled, repeatMode, playTrack } = get();
          if (queue.length === 0) return;

          let nextIdx = queueIndex + 1;
          if (isShuffled) {
            nextIdx = Math.floor(Math.random() * queue.length);
          } else if (nextIdx >= queue.length) {
            if (repeatMode === 'all') {
              nextIdx = 0;
            } else {
              set({ isPlaying: false });
              return;
            }
          }

          set({ queueIndex: nextIdx });
          const nextTrk = queue[nextIdx];
          if (nextTrk) {
            playTrack(nextTrk);
          }
        },

        prevTrack: () => {
          const { queue, queueIndex, currentTime, playTrack } = get();
          if (currentTime > 3) {
            audioEngine.seek(0);
            return;
          }
          if (queueIndex > 0) {
            const prevIdx = queueIndex - 1;
            set({ queueIndex: prevIdx });
            const prevTrk = queue[prevIdx];
            if (prevTrk) {
              playTrack(prevTrk);
            }
          } else {
            audioEngine.seek(0);
          }
        },

        seek: (seconds: number) => {
          audioEngine.seek(seconds);
          set({ currentTime: seconds });
        },

        setVolume: (vol: number) => {
          const clamped = Math.max(0, Math.min(1, vol));
          audioEngine.setVolume(clamped);
          set({ volume: clamped, isMuted: clamped === 0 });
        },

        toggleMute: () => {
          const { isMuted, volume } = get();
          if (isMuted) {
            audioEngine.setVolume(volume || 0.8);
            set({ isMuted: false });
          } else {
            audioEngine.setVolume(0);
            set({ isMuted: true });
          }
        },

        toggleShuffle: () => {
          set((state) => ({ isShuffled: !state.isShuffled }));
        },

        cycleRepeatMode: () => {
          const modes: RepeatMode[] = ['off', 'all', 'one'];
          const current = get().repeatMode;
          const next = modes[(modes.indexOf(current) + 1) % modes.length];
          set({ repeatMode: next });
        },

        setQueue: (tracks: Track[], startIndex = 0) => {
          set({ queue: tracks, queueIndex: startIndex });
          const initial = tracks[startIndex];
          if (initial) {
            get().playTrack(initial);
          }
          // Enqueue upcoming tracks into background prefetch engine immediately
          const upcoming = tracks.slice(startIndex + 1, startIndex + 6);
          if (upcoming.length > 0) {
            import('../services/api').then(({ prefetchManager }) => {
              prefetchManager.enqueue(upcoming);
            });
          }
        },

        addToQueue: (track: Track) => {
          set((state) => ({ queue: [...state.queue, track] }));
        },

        removeFromQueue: (index: number) => {
          set((state) => {
            const nextQueue = state.queue.filter((_, i) => i !== index);
            let nextIndex = state.queueIndex;
            if (index < state.queueIndex) {
              nextIndex = Math.max(0, nextIndex - 1);
            }
            return { queue: nextQueue, queueIndex: nextIndex };
          });
        },

        clearQueue: () => {
          set({ queue: [], queueIndex: -1 });
        },

        toggleRightPanel: () => {
          set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen }));
        },

        setRightPanelView: (view: 'queue' | 'lyrics') => {
          set({ rightPanelView: view, isRightPanelOpen: true });
        },

        toggleEq: () => {
          set((state) => ({ isEqOpen: !state.isEqOpen }));
        },

        toggleVisualizer: () => {
          set((state) => ({ isVisualizerOpen: !state.isVisualizerOpen }));
        },

        openNowPlaying: () => {
          set({ isNowPlayingOpen: true });
        },

        closeNowPlaying: () => {
          set({ isNowPlayingOpen: false });
        },
      };
    },
    {
      name: 'mazzmuzik-player-storage',
      partialize: (state) => ({
        volume: state.volume,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
      }),
    }
  )
);
