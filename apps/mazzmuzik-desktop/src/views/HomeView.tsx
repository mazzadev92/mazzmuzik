import React, { useEffect, useState } from 'react';
import { Play, Sparkles, Radio, Music, Flame, Clock } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { getTrendingAudius, getTopRadios } from '../services/api';
import type { Track, RadioStation } from '../types/music';

export const HomeView: React.FC = () => {
  const { playTrack, setQueue } = usePlayerStore();
  const { recentTracks, addRecentTrack } = useLibraryStore();

  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [radios, setRadios] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [audTracks, radioList] = await Promise.all([
          getTrendingAudius(12),
          getTopRadios(6),
        ]);
        if (mounted) {
          setTrendingTracks(audTracks);
          setRadios(radioList);
        }
      } catch (e) {
        console.error('Home load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePlay = (track: Track, tracksContext?: Track[]) => {
    addRecentTrack(track);
    if (tracksContext && tracksContext.length > 0) {
      const idx = tracksContext.findIndex((t) => t.id === track.id);
      setQueue(tracksContext, Math.max(0, idx));
    } else {
      playTrack(track);
    }
  };

  const handlePlayRadio = (r: RadioStation) => {
    const radioTrack: Track = {
      id: `radio-${r.id}`,
      title: r.name,
      artist: r.country || 'Live Radio',
      album: r.tags ? r.tags.join(', ') : 'Flux Direct',
      duration: 0,
      coverUrl: r.favicon || '',
      source: 'radio',
      streamUrl: r.url,
      bitrate: r.bitrate ? `${r.bitrate} kbps` : 'Live Stream',
    };
    addRecentTrack(radioTrack);
    playTrack(radioTrack);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-8 custom-scrollbar">
      {/* Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-surface to-surface-hi border border-border p-5 md:p-8 overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-hi border border-border text-champagne text-xs font-mono">
            <Sparkles size={13} />
            <span>MazzMuziK Audio Engine</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-apex-white">
            Expérience Haute-Fidélité Sans Frontières.
          </h1>
          <p className="text-sm text-warm-stone/80 leading-relaxed">
            Streaming audio pur, multi-sources décentralisé, sans compte et sans publicité. Égaliseur 10 bandes et shaders audio temps réel.
          </p>
        </div>
      </div>

      {/* Récemment écoutés */}
      {recentTracks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-apex-white font-semibold text-lg">
            <Clock size={20} className="text-champagne" />
            <h2>Récemment Écoutés</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentTracks.slice(0, 6).map((track) => (
              <div
                key={track.id}
                onClick={() => handlePlay(track, recentTracks)}
                onMouseEnter={() => {
                  import('../services/api').then(({ prefetchManager }) => {
                    prefetchManager.enqueue([track], true);
                  });
                }}
                className="group p-3 rounded-xl bg-surface hover:bg-surface-hi border border-border transition-all cursor-pointer flex flex-col gap-2.5 hover:shadow-lg"
              >
                <div className="relative aspect-square rounded-lg bg-obsidian overflow-hidden border border-border/60">
                  {track.coverUrl ? (
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sage/60">
                      <Music size={24} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-obsidian/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-champagne text-obsidian flex items-center justify-center shadow-lg">
                      <Play size={18} className="fill-obsidian translate-x-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-apex-white truncate">
                    {track.title}
                  </span>
                  <span className="text-[11px] text-warm-stone/60 truncate">
                    {track.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Radios en Direct Recommandées */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-apex-white font-semibold text-lg">
          <Radio size={20} className="text-sage" />
          <h2>Radios en Direct</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {radios.map((r) => (
            <div
              key={r.id}
              onClick={() => handlePlayRadio(r)}
              className="group p-4 rounded-xl bg-surface hover:bg-surface-hi border border-border transition-all cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-obsidian border border-border overflow-hidden flex items-center justify-center">
                  {r.favicon ? (
                    <img
                      src={r.favicon}
                      alt={r.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Radio size={18} className="text-sage" />
                  )}
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-sage shadow-[0_0_8px_rgba(148,184,154,0.6)] animate-pulse" />
              </div>

              <div>
                <span className="text-xs font-semibold text-apex-white line-clamp-1">
                  {r.name}
                </span>
                <span className="text-[10px] text-warm-stone/60 block truncate">
                  {r.country || 'International'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tendances Audius Direct */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-apex-white font-semibold text-lg">
          <Flame size={20} className="text-copper" />
          <h2>Tendances Décentralisées (Audius Direct)</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-surface border border-border animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {trendingTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => handlePlay(track, trendingTracks)}
                className="group p-3 rounded-xl bg-surface hover:bg-surface-hi border border-border transition-all cursor-pointer flex flex-col gap-2.5 hover:shadow-lg"
              >
                <div className="relative aspect-square rounded-lg bg-obsidian overflow-hidden border border-border/60">
                  {track.coverUrl ? (
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sage/60">
                      <Music size={24} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-obsidian/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-champagne text-obsidian flex items-center justify-center shadow-lg">
                      <Play size={18} className="fill-obsidian translate-x-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-apex-white truncate">
                    {track.title}
                  </span>
                  <span className="text-[11px] text-warm-stone/60 truncate">
                    {track.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
