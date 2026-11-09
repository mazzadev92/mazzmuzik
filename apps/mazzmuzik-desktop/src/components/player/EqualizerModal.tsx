import React, { useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { EQ_PRESETS, EQ_CATEGORIES } from '../../constants/eqPresets';

const FREQUENCIES = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const MAX_DB = 12;

/** Vertical fader driven by pointer events: works with touch, mouse and pen on every browser. */
const Fader: React.FC<{ value: number; label: string; onChange: (v: number) => void }> = ({
  value,
  label,
  onChange,
}) => {
  const track = useRef<HTMLDivElement>(null);

  const setFromY = (clientY: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onChange(Math.round(MAX_DB - ratio * MAX_DB * 2));
  };

  const pct = ((MAX_DB - value) / (MAX_DB * 2)) * 100;
  const fillTop = value >= 0 ? pct : 50;
  const fillHeight = Math.abs(value) / (MAX_DB * 2) * 100;

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={`${label} Hz`}
      aria-orientation="vertical"
      aria-valuemin={-MAX_DB}
      aria-valuemax={MAX_DB}
      aria-valuenow={value}
      aria-valuetext={`${value} dB`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromY(e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromY(e.clientY);
      }}
      onDoubleClick={() => onChange(0)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(MAX_DB, value + 1));
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(-MAX_DB, value - 1));
        else if (e.key === 'Home') onChange(0);
        else return;
        e.preventDefault();
      }}
      style={{ touchAction: 'none' }}
      className="relative h-40 w-full max-w-[34px] mx-auto cursor-pointer rounded-full outline-none focus-visible:ring-1 focus-visible:ring-champagne"
    >
      <div className="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full bg-surface-hi" />
      <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
      <div
        className="absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-champagne"
        style={{ top: `${fillTop}%`, height: `${fillHeight}%` }}
      />
      <div
        className="absolute left-1/2 h-4 w-6 -translate-x-1/2 -translate-y-1/2 rounded-md border border-champagne bg-obsidian shadow"
        style={{ top: `${pct}%` }}
      />
    </div>
  );
};

export const EqualizerModal: React.FC = () => {
  const { isEqOpen, toggleEq } = usePlayerStore();
  const { eqBands, currentEqPreset, setEqBand, applyEqPreset } = useSettingsStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isEqOpen) return null;

  const filteredPresets =
    selectedCategory === 'all' ? EQ_PRESETS : EQ_PRESETS.filter((p) => p.category === selectedCategory);
  const activePreset = EQ_PRESETS.find((p) => p.id === currentEqPreset);

  const points = eqBands.map((g, i) => `${25 + i * 50},${35 - (g / MAX_DB) * 28}`).join(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-obsidian/85 backdrop-blur-md select-none sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleEq();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Égaliseur"
        className="w-full sm:max-w-3xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl px-4 pt-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-apex-white">Égaliseur</h2>
            <p className="text-xs text-champagne truncate">{activePreset ? activePreset.name : 'Personnalisé'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyEqPreset('flat')}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs text-warm-stone/80 border border-border bg-surface-hi/40 active:scale-95 transition-transform"
            >
              <RotateCcw size={13} />
              Réinitialiser
            </button>
            <button
              onClick={toggleEq}
              aria-label="Fermer"
              className="h-9 w-9 flex items-center justify-center rounded-lg text-warm-stone/70 hover:text-apex-white hover:bg-surface-hi"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-obsidian/80 px-3 py-2">
          <svg viewBox="0 0 500 70" className="w-full h-14 overflow-visible" aria-hidden="true">
            <line x1="0" y1="35" x2="500" y2="35" stroke="#1D2A22" strokeDasharray="3 3" />
            <defs>
              <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A57A" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#C9A57A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`25,35 ${points} 475,35`} fill="url(#eqGradient)" />
            <polyline
              fill="none"
              stroke="#C9A57A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none]">
          {EQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-champagne text-obsidian border-champagne'
                  : 'bg-surface border-border text-warm-stone/70'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:flex-wrap [scrollbar-width:none]">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyEqPreset(preset.id)}
              className={`h-9 px-3.5 rounded-xl text-xs whitespace-nowrap border transition-colors ${
                currentEqPreset === preset.id
                  ? 'border-champagne text-champagne bg-surface-hi'
                  : 'border-border text-warm-stone/80 bg-surface'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-10 gap-0.5 sm:gap-2 rounded-xl border border-border bg-obsidian/70 py-3 px-1 sm:px-3">
          {FREQUENCIES.map((freq, idx) => {
            const gain = eqBands[idx] || 0;
            return (
              <div key={freq} className="flex flex-col items-center gap-1.5 min-w-0">
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    gain > 0 ? 'text-champagne' : gain < 0 ? 'text-sage' : 'text-warm-stone/40'
                  }`}
                >
                  {gain > 0 ? `+${gain}` : gain}
                </span>
                <Fader value={gain} label={freq} onChange={(v) => setEqBand(idx, v)} />
                <span className="text-[10px] text-warm-stone/70 font-mono">{freq}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
