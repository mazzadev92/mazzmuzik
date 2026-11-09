import React, { useState, useEffect, useRef } from 'react';
import {
  Search as SearchIcon,
  Play,
  ListPlus,
  Heart,
  Music,
  Loader2,
  X,
  Plus,
  Check,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { searchTracks } from '../services/api';
import { isMusicUrl, parseMusicUrl } from '../services/linkParser';
import type { Track, SourceType, ParsedMusicResult } from '../types/music';

const FILTERS: { id: SourceType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous les Catalogues' },
  { id: 'deezer', label: 'Deezer (HiFi)' },
  { id: 'ytmusic', label: 'YouTube Music' },
  { id: 'audius', label: 'Audius (320k)' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'radio', label: 'Radios Direct' },
  { id: 'bandcamp', label: 'Bandcamp' },
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Live';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SourceType | 'all'>('all');
  const [results, setResults] = useState<Track[]>([]);
  const [parsedResult, setParsedResult] = useState<ParsedMusicResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { setQueue, addToQueue, currentTrack, isPlaying, isLoadingTrack } = usePlayerStore();
  const { toggleFavorite, isFavorite, addRecentTrack, createPlaylistWithTracks } = useLibraryStore();

  // Ctrl+K keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async (term: string, source: SourceType | 'all') => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setParsedResult(null);
      return;
    }

    setLoading(true);
    setIsSaved(false);

    try {
      // 1. Check if user pasted a direct music URL (Spotify, Deezer, YouTube, SoundCloud)
      if (isMusicUrl(trimmed)) {
        const parsed = await parseMusicUrl(trimmed);
        if (parsed && parsed.tracks.length > 0) {
          setParsedResult(parsed);
          setResults(parsed.tracks);
          import('../services/api').then(({ prefetchManager }) => {
            prefetchManager.enqueue(parsed.tracks.slice(0, 5));
          });
          return;
        }
      }

      // 2. Regular multi-source catalog search
      setParsedResult(null);
      const data = await searchTracks(trimmed, source);
      setResults(data);

      if (data.length > 0) {
        import('../services/api').then(({ prefetchManager }) => {
          prefetchManager.enqueue(data.slice(0, 5));
        });
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 350ms instant debounce as user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setParsedResult(null);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(query, selectedFilter);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, selectedFilter]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query, selectedFilter);
  };

  const handlePlayItem = (track: Track) => {
    addRecentTrack(track);
    const idx = results.findIndex((t) => t.id === track.id);
    setQueue(results, Math.max(0, idx));
  };

  const handlePlayAll = () => {
    if (results.length === 0) return;
    addRecentTrack(results[0]);
    setQueue(results, 0);
  };

  const handleSaveToLibrary = () => {
    if (!parsedResult || results.length === 0) return;
    createPlaylistWithTracks(
      parsedResult.title,
      results,
      parsedResult.subtitle,
      parsedResult.coverUrl
    );
    setIsSaved(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 pt-2 md:p-8 space-y-3.5 md:space-y-6 custom-scrollbar select-none">
      {/* Search Bar Form */}
      <form onSubmit={onSearchSubmit} className="relative max-w-2xl">
        <div className="relative flex items-center">
          <SearchIcon
            size={18}
            className="absolute left-3.5 md:left-4 text-warm-stone/50 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre, artiste ou coller un lien Spotify, Deezer, YouTube..."
            className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-20 md:pr-28 rounded-xl bg-surface border border-border text-apex-white placeholder:text-warm-stone/40 focus:outline-none focus:border-champagne/80 focus:ring-1 focus:ring-champagne/40 text-xs md:text-sm transition-all shadow-inner"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setParsedResult(null);
              }}
              className="absolute right-16 md:right-22 text-warm-stone/50 hover:text-apex-white p-1"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 md:right-2 px-3 md:px-4 py-1.5 rounded-lg bg-champagne text-obsidian text-xs font-semibold hover:opacity-95 transition-opacity"
          >
            Chercher
          </button>
        </div>
      </form>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setSelectedFilter(f.id);
              if (query.trim()) handleSearch(query, f.id);
            }}
            className={`px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              selectedFilter === f.id
                ? 'bg-surface-hi border-champagne text-champagne shadow-sm'
                : 'bg-surface border-border text-warm-stone/70 hover:text-apex-white hover:bg-surface-hi/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Direct Link Ingestion Banner (Spotify / Deezer / YouTube / SoundCloud) */}
      {parsedResult && results.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface via-surface-hi to-surface border border-champagne/40 p-4 md:p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 animate-fadeIn">
          {parsedResult.coverUrl ? (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-border flex-shrink-0 shadow-lg">
              <img
                src={parsedResult.coverUrl}
                alt={parsedResult.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-obsidian border border-border flex items-center justify-center text-champagne flex-shrink-0">
              <Music size={32} />
            </div>
          )}

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider mb-2 border ${
              parsedResult.platform === 'spotify'
                ? 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/40'
                : parsedResult.platform === 'deezer'
                ? 'bg-champagne/20 text-champagne border-champagne/40'
                : 'bg-sage/20 text-sage border-sage/40'
            }">
              <span>{parsedResult.platform}</span>
              <span>•</span>
              <span>{parsedResult.type}</span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-apex-white truncate">
              {parsedResult.title}
            </h2>

            <p className="text-xs text-warm-stone/70 mt-0.5 truncate">
              {parsedResult.subtitle || `${results.length} titres importés sans compte`}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-4">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-champagne text-obsidian text-xs font-semibold hover:opacity-90 shadow-md transition-all active:scale-95"
              >
                <Play size={14} className="fill-obsidian" />
                <span>Tout Écouter ({results.length})</span>
              </button>

              {parsedResult.type !== 'track' && (
                <button
                  onClick={handleSaveToLibrary}
                  disabled={isSaved}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    isSaved
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-surface border-border text-apex-white hover:bg-surface-hi'
                  }`}
                >
                  {isSaved ? <Check size={14} /> : <Plus size={14} />}
                  <span>{isSaved ? 'Ajoutée à la bibliothèque' : 'Sauvegarder'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Header & List */}
      <div className="space-y-3">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-warm-stone/60 gap-3">
            <Loader2 size={28} className="animate-spin text-champagne" />
            <span className="text-xs">
              Exploration et ingestion des flux en cours...
            </span>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between pb-2 border-b border-border text-xs text-warm-stone/60 px-3 md:px-4">
              <span>Titre & Artiste</span>
              <div className="hidden sm:flex items-center gap-6">
                <span>Source</span>
                <span className="w-12 text-right">Durée</span>
                <span className="w-16 text-center">Actions</span>
              </div>
            </div>

            {results.map((track, idx) => {
              const fav = isFavorite(track.id);
              const isCurrent = currentTrack?.id === track.id;
              const isThisTrackLoading = isCurrent && isLoadingTrack;
              const isThisTrackPlaying = isCurrent && isPlaying;

              const isSpotify = track.source === 'spotify';

              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`group flex items-center justify-between p-2 md:p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-surface-hi/90 border-champagne/40'
                      : 'hover:bg-surface-hi/80 border-transparent hover:border-border'
                  }`}
                  onClick={() => handlePlayItem(track)}
                  onMouseEnter={() => {
                    import('../services/api').then(({ prefetchManager }) => {
                      prefetchManager.enqueue([track], true);
                    });
                  }}
                >
                  {/* Left: Cover & Titles */}
                  <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1 pr-2">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-obsidian border border-border overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                      {track.coverUrl ? (
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music size={18} className="text-sage/60" />
                      )}
                      <div
                        className={`absolute inset-0 bg-obsidian/60 flex items-center justify-center transition-opacity ${
                          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isThisTrackLoading ? (
                          <Loader2 size={16} className="animate-spin text-champagne" />
                        ) : isThisTrackPlaying ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-champagne animate-pulse" />
                        ) : (
                          <Play size={14} className="fill-champagne text-champagne" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-xs md:text-sm font-medium truncate transition-colors ${
                          isCurrent
                            ? 'text-champagne font-semibold'
                            : 'text-apex-white group-hover:text-champagne'
                        }`}
                      >
                        {track.title}
                      </span>
                      <span className="text-[11px] md:text-xs text-warm-stone/60 truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>

                  {/* Right: Meta & Actions */}
                  <div
                    className="flex items-center gap-2 md:gap-6 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`text-[9px] md:text-[10px] font-mono uppercase px-1.5 md:px-2 py-0.5 rounded border ${
                        isSpotify
                          ? 'bg-[#1DB954]/20 border-[#1DB954]/40 text-[#1DB954]'
                          : 'bg-surface border-border text-sage'
                      }`}
                    >
                      {track.source}
                    </span>

                    <span className="hidden sm:inline-block text-xs font-mono text-warm-stone/60 w-10 text-right">
                      {formatTime(track.duration)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(track)}
                        className="p-1 md:p-1.5 rounded text-warm-stone/50 hover:text-champagne transition-colors"
                        title="Ajouter aux favoris"
                      >
                        <Heart
                          size={15}
                          className={fav ? 'fill-champagne text-champagne' : ''}
                        />
                      </button>

                      <button
                        onClick={() => addToQueue(track)}
                        className="p-1 md:p-1.5 rounded text-warm-stone/50 hover:text-sage transition-colors"
                        title="Ajouter à la file d'attente"
                      >
                        <ListPlus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : query ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-warm-stone/40">
            <Music size={36} className="mb-2 text-border" />
            <span className="text-sm">Aucun résultat trouvé pour « {query} ».</span>
            <span className="text-xs text-warm-stone/30 mt-1">
              Essayez un autre mot-clé ou collez directement un lien Spotify, Deezer ou YouTube.
            </span>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center text-warm-stone/40">
            <SearchIcon size={36} className="mb-2 text-border" />
            <span className="text-sm">
              Recherchez des morceaux ou collez un lien direct pour l'importer instantanément.
            </span>
            <span className="text-xs text-warm-stone/30 mt-1">
              Compatible Spotify (titre, album, playlist), Deezer, YouTube Music, Audius et Radios.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
