import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  SlidersHorizontal,
  Sparkles,
  ListMusic,
  Mic2,
  Radio as RadioIcon,
  Loader2,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { SourceType } from '../../types/music';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const SOURCE_LABELS: Record<SourceType, { label: string; color: string }> = {
  deezer: { label: 'Deezer HiFi', color: 'text-champagne border-champagne/40 bg-champagne/10' },
  audius: { label: 'Audius', color: 'text-champagne border-champagne/40 bg-champagne/10' },
  ytmusic: { label: 'YouTube', color: 'text-sage border-sage/40 bg-sage/10' },
  soundcloud: { label: 'SoundCloud', color: 'text-copper border-copper/40 bg-copper/10' },
  bandcamp: { label: 'Bandcamp', color: 'text-eucalyptus border-eucalyptus/40 bg-eucalyptus/10' },
  radio: { label: 'Radio Live', color: 'text-champagne border-champagne/40 bg-champagne/10' },
  archive: { label: 'Archive', color: 'text-warm-stone border-warm-stone/40 bg-warm-stone/10' },
  mixcloud: { label: 'Mixcloud', color: 'text-sage border-sage/40 bg-sage/10' },
  local: { label: 'Local', color: 'text-warm-stone border-warm-stone/40 bg-warm-stone/10' },
};

export const BottomPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    isRightPanelOpen,
    rightPanelView,
    isEqOpen,
    isLoadingTrack,
    openNowPlaying,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleRightPanel,
    setRightPanelView,
    toggleEq,
  } = usePlayerStore();

  const { favorites, toggleFavorite } = useLibraryStore();
  const { shaderActive, setShaderActive } = useSettingsStore();

  const isFav = currentTrack ? favorites.some((f) => f.id === currentTrack.id) : false;
  const isRadio = currentTrack?.source === 'radio';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const sourceMeta = currentTrack ? SOURCE_LABELS[currentTrack.source] : null;

  return (
    <footer className="relative h-16 md:h-[88px] min-h-[64px] md:min-h-[88px] w-full bg-surface border-t border-border px-3 md:px-5 flex items-center justify-between z-20 select-none">
      {/* Mini Progress Bar on Top for Mobile */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-surface-hi md:hidden">
        <div
          className="h-full bg-champagne transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Track Info (Left) */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 md:w-72 md:flex-initial">
        {currentTrack ? (
          <>
            <div
              onClick={openNowPlaying}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
              title="Agrandir le lecteur (Style Spotify)"
            >
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-lg bg-surface-hi border border-border overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <RadioIcon size={20} className="text-sage/60" />
                )}
              </div>

              <div className="flex flex-col min-w-0 pr-1 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs md:text-sm font-semibold text-apex-white truncate group-hover:text-champagne transition-colors">
                    {currentTrack.title}
                  </span>
                  {sourceMeta && (
                    <span
                      className={`hidden md:inline text-[9px] font-mono px-1.5 py-0.2 rounded border ${sourceMeta.color}`}
                    >
                      {sourceMeta.label}
                    </span>
                  )}
                </div>
                <span className="text-[11px] md:text-xs text-warm-stone/70 truncate">
                  {currentTrack.artist}
                </span>
              </div>
            </div>

            <button
              onClick={() => toggleFavorite(currentTrack)}
              className="text-warm-stone/60 hover:text-champagne transition-colors p-1"
              title="Ajouter aux favoris"
            >
              <Heart
                size={16}
                className={isFav ? 'fill-champagne text-champagne' : ''}
              />
            </button>
          </>
        ) : (
          <div className="text-xs text-warm-stone/40 italic">
            Aucun morceau sélectionné
          </div>
        )}
      </div>

      {/* Mobile Controls (Right on mobile) */}
      <div className="flex items-center gap-1.5 md:hidden">
        <button
          onClick={() => {
            if (isRightPanelOpen && rightPanelView === 'lyrics') {
              toggleRightPanel();
            } else {
              setRightPanelView('lyrics');
            }
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            isRightPanelOpen && rightPanelView === 'lyrics'
              ? 'text-champagne bg-surface-hi'
              : 'text-warm-stone/60'
          }`}
          title="Paroles"
        >
          <Mic2 size={18} />
        </button>

        <button
          onClick={togglePlay}
          disabled={!currentTrack || isLoadingTrack}
          className="w-9 h-9 rounded-full bg-champagne text-obsidian flex items-center justify-center active:scale-95 transition-transform"
        >
          {isLoadingTrack ? (
            <Loader2 size={18} className="animate-spin text-obsidian" />
          ) : isPlaying ? (
            <Pause size={18} className="fill-obsidian" />
          ) : (
            <Play size={18} className="fill-obsidian translate-x-0.5" />
          )}
        </button>

        <button
          onClick={nextTrack}
          className="text-warm-stone/70 hover:text-apex-white p-1.5"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Playback Controls & Progress Bar (Center Desktop) */}
      <div className="hidden md:flex flex-1 max-w-xl flex-col items-center gap-1.5">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={`transition-colors p-1.5 rounded-md hover:bg-surface-hi ${
              isShuffled ? 'text-champagne' : 'text-warm-stone/60 hover:text-apex-white'
            }`}
            title="Lecture aléatoire"
          >
            <Shuffle size={16} />
          </button>

          <button
            onClick={prevTrack}
            className="text-warm-stone/80 hover:text-apex-white transition-colors p-1.5 rounded-md hover:bg-surface-hi"
            title="Précédent"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentTrack || isLoadingTrack}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
              currentTrack
                ? 'bg-champagne text-obsidian shadow-[0_0_12px_rgba(201,165,122,0.3)] hover:opacity-95'
                : 'bg-surface-hi text-warm-stone/30 cursor-not-allowed'
            }`}
            title={isLoadingTrack ? 'Chargement du flux...' : isPlaying ? 'Pause' : 'Lecture'}
          >
            {isLoadingTrack ? (
              <Loader2 size={20} className="animate-spin text-obsidian" />
            ) : isPlaying ? (
              <Pause size={20} className="fill-obsidian" />
            ) : (
              <Play size={20} className="fill-obsidian translate-x-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="text-warm-stone/80 hover:text-apex-white transition-colors p-1.5 rounded-md hover:bg-surface-hi"
            title="Suivant"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={cycleRepeatMode}
            className={`transition-colors p-1.5 rounded-md hover:bg-surface-hi ${
              repeatMode !== 'off'
                ? 'text-champagne'
                : 'text-warm-stone/60 hover:text-apex-white'
            }`}
            title={`Répétition : ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        {/* Progress Bar Slider */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[11px] text-warm-stone/60 font-mono w-9 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            className="flex-1 h-1.5 bg-surface-hi rounded-full relative overflow-hidden cursor-pointer group"
            onClick={(e) => {
              if (isRadio || duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              seek(clickPos * duration);
            }}
          >
            <div
              className="h-full bg-champagne rounded-full transition-all group-hover:bg-sage"
              style={{ width: isRadio ? '100%' : `${progressPercent}%` }}
            />
          </div>

          <span className="text-[11px] text-warm-stone/60 font-mono w-9">
            {isRadio ? 'LIVE' : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Extra Controls & Volume (Right Desktop) */}
      <div className="hidden md:flex w-72 items-center justify-end gap-3">
        {/* Equalizer Toggle */}
        <button
          onClick={toggleEq}
          className={`p-2 rounded-lg transition-colors ${
            isEqOpen
              ? 'text-champagne bg-surface-hi border border-border'
              : 'text-warm-stone/60 hover:text-apex-white hover:bg-surface-hi'
          }`}
          title="Égaliseur 10 bandes"
        >
          <SlidersHorizontal size={17} />
        </button>

        {/* Visualizer Toggle */}
        <button
          onClick={() => setShaderActive(!shaderActive)}
          className={`p-2 rounded-lg transition-colors ${
            shaderActive
              ? 'text-sage bg-surface-hi border border-border'
              : 'text-warm-stone/60 hover:text-apex-white hover:bg-surface-hi'
          }`}
          title="Visualiseur Shader WebGL"
        >
          <Sparkles size={17} />
        </button>

        {/* Lyrics Toggle */}
        <button
          onClick={() => {
            if (isRightPanelOpen && rightPanelView === 'lyrics') {
              toggleRightPanel();
            } else {
              setRightPanelView('lyrics');
            }
          }}
          className={`p-2 rounded-lg transition-colors ${
            isRightPanelOpen && rightPanelView === 'lyrics'
              ? 'text-champagne bg-surface-hi border border-border'
              : 'text-warm-stone/60 hover:text-apex-white hover:bg-surface-hi'
          }`}
          title="Paroles karaoké synchronisées"
        >
          <Mic2 size={17} />
        </button>

        {/* Queue Toggle */}
        <button
          onClick={() => {
            if (isRightPanelOpen && rightPanelView === 'queue') {
              toggleRightPanel();
            } else {
              setRightPanelView('queue');
            }
          }}
          className={`p-2 rounded-lg transition-colors ${
            isRightPanelOpen && rightPanelView === 'queue'
              ? 'text-champagne bg-surface-hi border border-border'
              : 'text-warm-stone/60 hover:text-apex-white hover:bg-surface-hi'
          }`}
          title="File d'attente"
        >
          <ListMusic size={17} />
        </button>

        {/* Volume */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <button
            onClick={toggleMute}
            className="text-warm-stone/60 hover:text-apex-white transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-surface-hi accent-champagne rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </footer>
  );
};
