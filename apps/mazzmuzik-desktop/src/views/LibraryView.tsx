import React, { useState } from 'react';
import {
  Heart,
  ListMusic,
  Download,
  Clock,
  Play,
  Plus,
  Trash2,
  Music,
} from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import type { Track } from '../types/music';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const LibraryView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'favorites' | 'playlists' | 'recent' | 'downloads'>('favorites');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPl, setIsCreatingPl] = useState(false);

  const {
    favorites,
    playlists,
    recentTracks,
    downloadedTracks,
    toggleFavorite,
    createPlaylist,
    deletePlaylist,
  } = useLibraryStore();

  const { playTrack, setQueue } = usePlayerStore();

  const handlePlayCollection = (tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks, startIndex);
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreatingPl(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-apex-white">
            Votre Bibliothèque
          </h1>
          <p className="text-xs text-warm-stone/70">
            Titres sauvegardés, playlists sur mesure et cache hors-ligne.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveSection('favorites')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'favorites'
                ? 'bg-surface-hi text-champagne border border-border'
                : 'text-warm-stone/70 hover:text-apex-white'
            }`}
          >
            <Heart size={14} className={activeSection === 'favorites' ? 'fill-champagne' : ''} />
            <span>Coups de Cœur ({favorites.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('playlists')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'playlists'
                ? 'bg-surface-hi text-champagne border border-border'
                : 'text-warm-stone/70 hover:text-apex-white'
            }`}
          >
            <ListMusic size={14} />
            <span>Playlists ({playlists.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('recent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'recent'
                ? 'bg-surface-hi text-champagne border border-border'
                : 'text-warm-stone/70 hover:text-apex-white'
            }`}
          >
            <Clock size={14} />
            <span>Historique ({recentTracks.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('downloads')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'downloads'
                ? 'bg-surface-hi text-champagne border border-border'
                : 'text-warm-stone/70 hover:text-apex-white'
            }`}
          >
            <Download size={14} />
            <span>Hors-Ligne ({downloadedTracks.length})</span>
          </button>
        </div>
      </div>

      {/* Main Section Content */}
      {activeSection === 'favorites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-apex-white">
              {favorites.length} morceau{favorites.length > 1 ? 'x' : ''} dans vos favoris
            </span>
            {favorites.length > 0 && (
              <button
                onClick={() => handlePlayCollection(favorites, 0)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-champagne text-obsidian text-xs font-semibold hover:opacity-95 shadow-md"
              >
                <Play size={14} className="fill-obsidian" />
                <span>Tout Écouter</span>
              </button>
            )}
          </div>

          {favorites.length > 0 ? (
            <div className="space-y-1">
              {favorites.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => handlePlayCollection(favorites, idx)}
                  className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-hi/80 border border-transparent hover:border-border transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <span className="text-xs font-mono text-warm-stone/50 w-5 text-right">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-obsidian border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {track.coverUrl ? (
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music size={18} className="text-sage/60" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-apex-white truncate group-hover:text-champagne transition-colors">
                        {track.title}
                      </span>
                      <span className="text-xs text-warm-stone/60 truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-border text-sage">
                      {track.source}
                    </span>
                    <span className="text-xs font-mono text-warm-stone/60 w-12 text-right">
                      {formatDuration(track.duration)}
                    </span>
                    <button
                      onClick={() => toggleFavorite(track)}
                      className="text-champagne p-1"
                      title="Retirer des favoris"
                    >
                      <Heart size={16} className="fill-champagne" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-warm-stone/40">
              <Heart size={36} className="mb-2 text-border" />
              <span className="text-sm">Aucun favori pour l'instant.</span>
              <span className="text-xs text-warm-stone/30 mt-1">
                Cliquez sur le cœur d'un titre en cours de lecture pour l'ajouter ici.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Playlists Section */}
      {activeSection === 'playlists' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-apex-white">
              Vos Listes de Lecture
            </span>
            <button
              onClick={() => setIsCreatingPl(!isCreatingPl)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hi border border-border text-champagne text-xs font-semibold hover:bg-border transition-colors"
            >
              <Plus size={14} />
              <span>Nouvelle Playlist</span>
            </button>
          </div>

          {isCreatingPl && (
            <form onSubmit={handleCreatePlaylist} className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nom de la nouvelle playlist..."
                className="flex-1 h-9 px-3 rounded-lg bg-obsidian border border-border text-xs text-apex-white placeholder:text-warm-stone/40 focus:outline-none focus:border-champagne"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-champagne text-obsidian text-xs font-semibold hover:opacity-95"
              >
                Créer
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingPl(false)}
                className="px-3 py-2 rounded-lg text-xs text-warm-stone/70 hover:text-apex-white"
              >
                Annuler
              </button>
            </form>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="group p-4 rounded-xl bg-surface hover:bg-surface-hi border border-border transition-all flex flex-col justify-between gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-lg bg-obsidian border border-border flex items-center justify-center text-champagne">
                    <ListMusic size={24} />
                  </div>
                  {pl.id !== 'pl-favorites' && (
                    <button
                      onClick={() => deletePlaylist(pl.id)}
                      className="opacity-0 group-hover:opacity-100 text-warm-stone/40 hover:text-copper transition-opacity p-1"
                      title="Supprimer la playlist"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-apex-white truncate">
                    {pl.name}
                  </h3>
                  <p className="text-[11px] text-warm-stone/60 truncate mt-0.5">
                    {pl.trackIds.length} titre{pl.trackIds.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique Section */}
      {activeSection === 'recent' && (
        <div className="space-y-4">
          <span className="text-sm font-semibold text-apex-white">
            Historique d'écoute récent
          </span>
          {recentTracks.length > 0 ? (
            <div className="space-y-1">
              {recentTracks.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track)}
                  className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-hi/80 border border-transparent hover:border-border transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <div className="w-10 h-10 rounded-lg bg-obsidian border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {track.coverUrl ? (
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music size={18} className="text-sage/60" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-apex-white truncate group-hover:text-champagne transition-colors">
                        {track.title}
                      </span>
                      <span className="text-xs text-warm-stone/60 truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-border text-sage">
                    {track.source}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-warm-stone/40">
              <Clock size={36} className="mb-2 text-border" />
              <span className="text-sm">Aucun historique récent.</span>
            </div>
          )}
        </div>
      )}

      {/* Downloads Section */}
      {activeSection === 'downloads' && (
        <div className="space-y-4">
          <span className="text-sm font-semibold text-apex-white">
            Morceaux mis en cache hors-ligne
          </span>
          {downloadedTracks.length > 0 ? (
            <div className="space-y-1">
              {downloadedTracks.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track)}
                  className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-hi/80 border border-transparent hover:border-border transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <div className="w-10 h-10 rounded-lg bg-obsidian border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <Download size={18} className="text-sage" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-apex-white truncate">
                        {track.title}
                      </span>
                      <span className="text-xs text-warm-stone/60 truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-sage">Hors-ligne disponible</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-warm-stone/40">
              <Download size={36} className="mb-2 text-border" />
              <span className="text-sm">Aucun morceau téléchargé pour le moment.</span>
              <span className="text-xs text-warm-stone/30 mt-1">
                Le streaming en direct met automatiquement en cache les flux dans votre stockage local.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
