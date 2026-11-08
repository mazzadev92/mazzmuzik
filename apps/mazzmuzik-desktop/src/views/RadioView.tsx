import React, { useState, useEffect } from 'react';
import { Radio as RadioIcon, Play, Pause, Search, Globe, Signal } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { getTopRadios } from '../services/api';
import type { RadioStation, Track } from '../types/music';

const CURATED_GENRES = [
  { id: 'all', label: 'Toutes les Radios' },
  { id: 'france', label: 'France' },
  { id: 'jazz', label: 'Jazz & Soul' },
  { id: 'electro', label: 'Électronique & Club' },
  { id: 'ambient', label: 'Ambient & Lo-Fi' },
  { id: 'rock', label: 'Rock & Indie' },
];

export const RadioView: React.FC = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [filteredStations, setFilteredStations] = useState<RadioStation[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const { addRecentTrack } = useLibraryStore();

  useEffect(() => {
    async function loadRadios() {
      setLoading(true);
      try {
        const data = await getTopRadios(60);
        setStations(data);
        setFilteredStations(data);
      } catch (err) {
        console.error('Failed to load radios:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRadios();
  }, []);

  useEffect(() => {
    let result = stations;
    if (selectedGenre !== 'all') {
      result = result.filter((s) => {
        const countryMatch = s.country?.toLowerCase().includes(selectedGenre);
        const tagsMatch = s.tags?.some((t) => t.toLowerCase().includes(selectedGenre));
        return countryMatch || tagsMatch;
      });
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.country?.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    setFilteredStations(result);
  }, [selectedGenre, searchFilter, stations]);

  const handlePlayStation = (s: RadioStation) => {
    const isCurrent = currentTrack?.id === `radio-${s.id}`;
    if (isCurrent) {
      togglePlay();
      return;
    }

    const radioTrack: Track = {
      id: `radio-${s.id}`,
      title: s.name,
      artist: s.country || 'Live Web Radio',
      album: s.tags?.slice(0, 3).join(', ') || 'Flux Direct Haute Qualité',
      duration: 0,
      coverUrl: s.favicon || '',
      source: 'radio',
      streamUrl: s.url,
      bitrate: s.bitrate ? `${s.bitrate} kbps` : 'Direct Stream',
    };

    addRecentTrack(radioTrack);
    playTrack(radioTrack);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-hi border border-border text-sage text-xs font-mono mb-2">
            <Signal size={13} />
            <span>Radio-Browser Index Mondial</span>
          </div>
          <h1 className="text-2xl font-bold text-apex-white">
            Radios en Direct & Web Radios
          </h1>
          <p className="text-xs text-warm-stone/70">
            Flux audio directs sans téléchargement. FIP, FG, Nova, BBC, Jazz Radio et stations indépendantes.
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3.5 top-3 text-warm-stone/50" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrer une radio..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface border border-border text-xs text-apex-white placeholder:text-warm-stone/40 focus:outline-none focus:border-champagne"
          />
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CURATED_GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGenre(g.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              selectedGenre === g.id
                ? 'bg-surface-hi border-sage text-sage shadow-sm'
                : 'bg-surface border-border text-warm-stone/70 hover:text-apex-white hover:bg-surface-hi/60'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Stations Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-surface border border-border animate-pulse"
            />
          ))}
        </div>
      ) : filteredStations.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredStations.map((s) => {
            const isCurrent = currentTrack?.id === `radio-${s.id}`;
            const activePlaying = isCurrent && isPlaying;

            return (
              <div
                key={s.id}
                onClick={() => handlePlayStation(s)}
                className={`group p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'bg-surface-hi border-sage shadow-[0_0_15px_rgba(148,184,154,0.15)]'
                    : 'bg-surface hover:bg-surface-hi border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-lg bg-obsidian border border-border overflow-hidden flex items-center justify-center p-1 relative">
                    {s.favicon ? (
                      <img
                        src={s.favicon}
                        alt={s.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <RadioIcon size={22} className="text-sage" />
                    )}

                    <div className="absolute inset-0 bg-obsidian/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {activePlaying ? (
                        <Pause size={18} className="fill-champagne text-champagne" />
                      ) : (
                        <Play size={18} className="fill-champagne text-champagne translate-x-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        activePlaying
                          ? 'bg-sage animate-ping'
                          : 'bg-sage/40'
                      }`}
                    />
                    {s.bitrate ? (
                      <span className="text-[9px] font-mono text-warm-stone/50">
                        {s.bitrate}k
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-apex-white truncate group-hover:text-champagne transition-colors">
                    {s.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-warm-stone/60 truncate">
                    <Globe size={11} className="text-sage/60" />
                    <span>{s.country || 'International'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-center text-warm-stone/40">
          <RadioIcon size={36} className="mb-2 text-border" />
          <span className="text-sm">Aucune station trouvée pour ce filtre.</span>
        </div>
      )}
    </div>
  );
};
