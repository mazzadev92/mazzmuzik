import React from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Mic2,
  SlidersHorizontal,
  ListMusic,
  Loader2,
  Music,
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const NowPlayingModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isShuffled,
    repeatMode,
    isNowPlayingOpen,
    isLoadingTrack,
    closeNowPlaying,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    toggleShuffle,
    cycleRepeatMode,
    setRightPanelView,
    toggleEq,
  } = usePlayerStore();

  const { favorites, toggleFavorite } = useLibraryStore();

  if (!isNowPlayingOpen || !currentTrack) return null;

  const isFav = favorites.some((f) => f.id === currentTrack.id);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#111813] via-obsidian to-obsidian flex flex-col justify-between p-6 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),24px)] text-apex-white select-none animate-in slide-in-from-bottom duration-300 backdrop-blur-2xl">
      {/* 1. Header with Collapse & Source */}
      <div className="flex items-center justify-between w-full">
        <button
          onClick={closeNowPlaying}
          className="p-2 -ml-2 text-warm-stone/70 hover:text-apex-white active:scale-95 transition-transform"
          title="Réduire"
        >
          <ChevronDown size={28} />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-mono tracking-wider text-warm-stone/60">
            Lecture en cours
          </span>
          <span className="text-xs font-medium text-champagne/90">
            {currentTrack.album || currentTrack.source.toUpperCase()}
          </span>
        </div>

        <button
          onClick={() => {
            closeNowPlaying();
            setRightPanelView('queue');
          }}
          className="p-2 -mr-2 text-warm-stone/70 hover:text-apex-white"
          title="File d'attente"
        >
          <ListMusic size={22} />
        </button>
      </div>

      {/* 2. Grand Artwork (Cover) */}
      <div className="w-full flex-1 flex items-center justify-center py-4">
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
          {/* Subtle Ambient Glow behind cover */}
          <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-champagne/40 scale-105" />

          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? 'scale-100' : 'scale-95 opacity-80'
              }`}
            />
          ) : (
            <div className="w-full h-full bg-surface-hi flex items-center justify-center">
              <Music size={64} className="text-sage/40" />
            </div>
          )}
        </div>
      </div>

      {/* 3. Titles & Favorite Row */}
      <div className="w-full space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-3">
            <h2 className="text-xl sm:text-2xl font-bold text-apex-white truncate">
              {currentTrack.title}
            </h2>
            <p className="text-sm sm:text-base text-warm-stone/80 truncate">
              {currentTrack.artist}
            </p>
          </div>

          <button
            onClick={() => toggleFavorite(currentTrack)}
            className="p-2 text-warm-stone/60 hover:text-champagne transition-colors active:scale-125"
            title="Coup de cœur"
          >
            <Heart
              size={26}
              className={isFav ? 'fill-champagne text-champagne' : ''}
            />
          </button>
        </div>

        {/* 4. Live Scrub Bar */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.5"
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-1.5 bg-surface-hi accent-champagne rounded-lg cursor-pointer appearance-none"
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-warm-stone/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 5. Main Playback Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors ${
              isShuffled ? 'text-champagne' : 'text-warm-stone/50 hover:text-apex-white'
            }`}
            title="Lecture aléatoire"
          >
            <Shuffle size={20} />
          </button>

          <button
            onClick={prevTrack}
            className="p-2 text-warm-stone/80 hover:text-apex-white active:scale-90 transition-transform"
            title="Précédent"
          >
            <SkipBack size={28} />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoadingTrack}
            className="w-16 h-16 rounded-full bg-champagne text-obsidian flex items-center justify-center active:scale-95 transition-transform shadow-xl"
            title={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isLoadingTrack ? (
              <Loader2 size={30} className="animate-spin text-obsidian" />
            ) : isPlaying ? (
              <Pause size={28} className="fill-obsidian" />
            ) : (
              <Play size={28} className="fill-obsidian translate-x-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-2 text-warm-stone/80 hover:text-apex-white active:scale-90 transition-transform"
            title="Suivant"
          >
            <SkipForward size={28} />
          </button>

          <button
            onClick={cycleRepeatMode}
            className={`p-2 transition-colors ${
              repeatMode !== 'off' ? 'text-champagne' : 'text-warm-stone/50 hover:text-apex-white'
            }`}
            title={`Répétition: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        {/* 6. Quick Action Toolbar (Lyrics, Equalizer) */}
        <div className="flex items-center justify-around pt-3 border-t border-border/40">
          <button
            onClick={() => {
              closeNowPlaying();
              setRightPanelView('lyrics');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border text-xs text-warm-stone/80 hover:text-champagne hover:border-champagne/40 transition-colors"
          >
            <Mic2 size={15} />
            <span>Paroles</span>
          </button>

          <button
            onClick={() => {
              closeNowPlaying();
              toggleEq();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border text-xs text-warm-stone/80 hover:text-champagne hover:border-champagne/40 transition-colors"
          >
            <SlidersHorizontal size={15} />
            <span>Égaliseur</span>
          </button>
        </div>
      </div>
    </div>
  );
};
