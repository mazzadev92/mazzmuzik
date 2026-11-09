import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, Playlist } from '../types/music';

interface LibraryState {
  favorites: Track[];
  playlists: Playlist[];
  recentTracks: Track[];
  downloadedTracks: Track[];

  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: string) => boolean;
  addRecentTrack: (track: Track) => void;
  createPlaylist: (name: string, description?: string) => string;
  createPlaylistWithTracks: (name: string, tracks: Track[], description?: string, coverUrl?: string) => string;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  addDownloadedTrack: (track: Track) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: [],
      playlists: [
        {
          id: 'pl-favorites',
          name: 'Coups de Cœur',
          description: 'Vos morceaux préférés rassemblés',
          trackIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'pl-chill',
          name: 'Bioforge Ambient',
          description: 'Textures organiques et fréquences immersives',
          trackIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      recentTracks: [],
      downloadedTracks: [],

      toggleFavorite: (track: Track) => {
        const { favorites } = get();
        const exists = favorites.some((t) => t.id === track.id);
        if (exists) {
          set({ favorites: favorites.filter((t) => t.id !== track.id) });
        } else {
          set({ favorites: [{ ...track, isFavorite: true }, ...favorites] });
        }
      },

      isFavorite: (trackId: string) => {
        return get().favorites.some((t) => t.id === trackId);
      },

      addRecentTrack: (track: Track) => {
        const { recentTracks } = get();
        const filtered = recentTracks.filter((t) => t.id !== track.id);
        set({ recentTracks: [track, ...filtered].slice(0, 50) });
      },

      createPlaylist: (name: string, description?: string) => {
        const id = 'pl-' + Date.now().toString(36);
        const newPl: Playlist = {
          id,
          name,
          description,
          trackIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ playlists: [...state.playlists, newPl] }));
        return id;
      },

      createPlaylistWithTracks: (name: string, tracks: Track[], description?: string, coverUrl?: string) => {
        const id = 'pl-' + Date.now().toString(36);
        const newPl: Playlist = {
          id,
          name,
          description,
          coverUrl: coverUrl || tracks[0]?.coverUrl,
          trackIds: tracks.map((t) => t.id),
          tracks,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ playlists: [newPl, ...state.playlists] }));
        return id;
      },

      deletePlaylist: (playlistId: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== playlistId),
        }));
      },

      addTrackToPlaylist: (playlistId: string, track: Track) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId && !pl.trackIds.includes(track.id)) {
              return {
                ...pl,
                trackIds: [...pl.trackIds, track.id],
                updatedAt: Date.now(),
              };
            }
            return pl;
          }),
        }));
      },

      removeTrackFromPlaylist: (playlistId: string, trackId: string) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId) {
              return {
                ...pl,
                trackIds: pl.trackIds.filter((id) => id !== trackId),
                updatedAt: Date.now(),
              };
            }
            return pl;
          }),
        }));
      },

      addDownloadedTrack: (track: Track) => {
        set((state) => {
          const exists = state.downloadedTracks.some((t) => t.id === track.id);
          if (exists) return state;
          return { downloadedTracks: [track, ...state.downloadedTracks] };
        });
      },
    }),
    {
      name: 'mazzmuzik-library-storage',
    }
  )
);
