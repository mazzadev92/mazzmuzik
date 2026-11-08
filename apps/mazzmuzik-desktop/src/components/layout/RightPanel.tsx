import React, { useMemo, useEffect, useRef } from 'react';
import { X, Trash2, ListMusic, Mic2, Play, Music, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { parseLrc, getActiveLrcIndex } from '../../services/lrcParser';

export const RightPanel: React.FC = () => {
  const {
    currentTrack,
    queue,
    queueIndex,
    currentTime,
    isRightPanelOpen,
    rightPanelView,
    isLoadingLyrics,
    isLyricsSynced,
    toggleRightPanel,
    setRightPanelView,
    fetchCurrentLyrics,
    playTrack,
    removeFromQueue,
    clearQueue,
    seek,
  } = usePlayerStore();

  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack?.lyrics]);

  const activeLyricIndex = useMemo(() => {
    return getActiveLrcIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  const isPlainLyrics = useMemo(() => {
    return parsedLyrics.length === 0 && Boolean(currentTrack?.lyrics?.trim());
  }, [parsedLyrics, currentTrack?.lyrics]);

  const plainLines = useMemo(() => {
    if (!isPlainLyrics || !currentTrack?.lyrics) return [];
    return currentTrack.lyrics.split('\n');
  }, [isPlainLyrics, currentTrack?.lyrics]);

  // Auto-scroll active lyric line into center view
  useEffect(() => {
    if (activeLyricIndex >= 0 && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIndex]);

  // Trigger lyrics fetch if user opens lyrics view and none loaded yet
  useEffect(() => {
    if (rightPanelView === 'lyrics' && currentTrack && !currentTrack.lyrics && !isLoadingLyrics) {
      fetchCurrentLyrics();
    }
  }, [rightPanelView, currentTrack?.id]);

  if (!isRightPanelOpen) return null;

  return (
    <aside className="fixed inset-0 md:static md:w-80 md:min-w-80 h-full bg-surface border-l border-border flex flex-col z-50 md:z-10 select-none animate-in slide-in-from-right duration-200">
      {/* Header with Tabs & Close */}
      <div className="p-3 pt-[max(env(safe-area-inset-top),12px)] md:pt-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1 bg-obsidian p-1 rounded-lg border border-border">
          <button
            onClick={() => setRightPanelView('queue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              rightPanelView === 'queue'
                ? 'bg-surface-hi text-champagne border border-border/80'
                : 'text-warm-stone/60 hover:text-apex-white'
            }`}
          >
            <ListMusic size={14} />
            <span>File d'attente ({queue.length})</span>
          </button>

          <button
            onClick={() => setRightPanelView('lyrics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              rightPanelView === 'lyrics'
                ? 'bg-surface-hi text-champagne border border-border/80'
                : 'text-warm-stone/60 hover:text-apex-white'
            }`}
          >
            <Mic2 size={14} />
            <span>Paroles</span>
          </button>
        </div>

        <button
          onClick={toggleRightPanel}
          className="text-warm-stone/60 hover:text-apex-white p-1.5 rounded-md hover:bg-surface-hi transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {rightPanelView === 'queue' ? (
          <div>
            {queue.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-xs text-warm-stone/60">
                  <span>En cours & À suivre</span>
                  <button
                    onClick={clearQueue}
                    className="flex items-center gap-1 text-[11px] hover:text-champagne transition-colors"
                  >
                    <Trash2 size={12} />
                    <span>Vider</span>
                  </button>
                </div>

                {queue.map((track, idx) => {
                  const isCurrent = idx === queueIndex;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      className={`group flex items-center justify-between p-2 rounded-lg transition-all ${
                        isCurrent
                          ? 'bg-surface-hi border border-border text-champagne'
                          : 'hover:bg-surface-hi/60 text-apex-white'
                      }`}
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => playTrack(track)}
                        onMouseEnter={() => {
                          import('../../services/api').then(({ prefetchManager }) => {
                            prefetchManager.enqueue([track], true);
                          });
                        }}
                      >
                        <div className="w-8 h-8 rounded bg-obsidian border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {track.coverUrl ? (
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music size={14} className="text-sage/60" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-xs font-medium truncate">
                            {track.title}
                          </span>
                          <span className="text-[11px] text-warm-stone/60 truncate">
                            {track.artist}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => playTrack(track)}
                          className="p-1 text-sage hover:text-champagne"
                          title="Lire ce titre"
                        >
                          <Play size={13} />
                        </button>
                        <button
                          onClick={() => removeFromQueue(idx)}
                          className="p-1 text-warm-stone/60 hover:text-copper"
                          title="Retirer de la file"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-warm-stone/40">
                <ListMusic size={32} className="mb-2 text-border" />
                <span className="text-xs">La file d'attente est vide.</span>
                <span className="text-[11px] text-warm-stone/30 mt-1">
                  Lancez un titre ou ajoutez des morceaux depuis la recherche.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Lyrics View */
          <div className="h-full flex flex-col">
            {isLoadingLyrics ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-warm-stone/60">
                <Loader2 size={26} className="animate-spin text-champagne mb-3" />
                <span className="text-xs font-semibold text-apex-white">
                  Recherche des paroles...
                </span>
                <span className="text-[11px] text-warm-stone/40 mt-1">
                  Synchronisation via la base ouverte LRCLIB
                </span>
              </div>
            ) : parsedLyrics.length > 0 ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[10px] font-mono text-warm-stone/50">
                  <span className="flex items-center gap-1 text-champagne">
                    <Sparkles size={11} />
                    {isLyricsSynced ? 'Synchronisation active' : 'Paroles intégrales'}
                  </span>
                  <span>Cliquez pour caler la lecture</span>
                </div>

                {parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <p
                      key={idx}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => seek(line.time)}
                      className={`text-sm cursor-pointer transition-all duration-300 leading-relaxed select-text ${
                        isActive
                          ? 'text-champagne font-bold text-base pl-3 border-l-2 border-champagne scale-[1.02] shadow-sm'
                          : 'text-warm-stone/60 hover:text-apex-white pl-3'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })}
              </div>
            ) : isPlainLyrics ? (
              <div className="space-y-3 py-4 select-text">
                <div className="flex items-center justify-between pb-2 border-b border-border/40 text-[10px] font-mono text-warm-stone/50">
                  <span className="text-sage">Paroles texte intégrales</span>
                  <span>Non synchronisées</span>
                </div>
                {plainLines.map((line, idx) => (
                  <p
                    key={idx}
                    className={`text-sm leading-relaxed ${
                      line.trim() ? 'text-warm-stone/80' : 'h-3'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-warm-stone/40">
                <Mic2 size={32} className="mb-2 text-border" />
                <span className="text-xs font-medium text-apex-white/80">
                  Paroles non trouvées
                </span>
                <span className="text-[11px] text-warm-stone/40 mt-1 max-w-[220px]">
                  Titre instrumental ou non répertorié sur LRCLIB.
                </span>
                {currentTrack && (
                  <button
                    onClick={fetchCurrentLyrics}
                    className="mt-4 px-3 py-1.5 rounded-lg bg-surface-hi border border-border text-xs text-champagne hover:bg-surface transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw size={12} />
                    <span>Réessayer la recherche</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
