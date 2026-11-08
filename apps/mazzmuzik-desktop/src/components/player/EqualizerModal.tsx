import React, { useState } from 'react';
import { X, RotateCcw, Sliders, Activity, Sparkles, Volume2 } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { EQ_PRESETS, EQ_CATEGORIES } from '../../constants/eqPresets';

const FREQUENCIES = [
  '32 Hz',
  '64 Hz',
  '125 Hz',
  '250 Hz',
  '500 Hz',
  '1 kHz',
  '2 kHz',
  '4 kHz',
  '8 kHz',
  '16 kHz',
];

export const EqualizerModal: React.FC = () => {
  const { isEqOpen, toggleEq } = usePlayerStore();
  const { eqBands, currentEqPreset, setEqBand, applyEqPreset } = useSettingsStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isEqOpen) return null;

  const filteredPresets = selectedCategory === 'all'
    ? EQ_PRESETS
    : EQ_PRESETS.filter((p) => p.category === selectedCategory);

  const activePresetObj = EQ_PRESETS.find((p) => p.id === currentEqPreset);

  // Generate SVG curve points for the 10 frequency bands
  // SVG viewBox: width = 500, height = 70. Center line = 35. Gain range = -12 to +12
  const svgPoints = eqBands
    .map((gain, i) => {
      const x = 25 + i * 50;
      const y = 35 - (gain / 12) * 28;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/85 backdrop-blur-md select-none p-4">
      <div className="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-surface-hi border border-border text-champagne shadow-inner">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-apex-white">
                  Égaliseur Studio & Console de Mixage (10 Bandes)
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-hi border border-champagne/40 text-champagne">
                  BiquadFilter DSP
                </span>
              </div>
              <p className="text-xs text-warm-stone/60">
                Traitement numérique temps réel 64 bits • Web Audio API • Proxy audio ultra-faible latence
              </p>
            </div>
          </div>

          <button
            onClick={toggleEq}
            className="p-1.5 rounded-lg text-warm-stone/60 hover:text-apex-white hover:bg-surface-hi transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Frequency Response Curve Visualizer */}
        <div className="relative w-full h-20 bg-obsidian/80 rounded-xl border border-border overflow-hidden p-2 flex flex-col justify-between flex-shrink-0">
          <div className="flex items-center justify-between text-[10px] text-warm-stone/50 font-mono px-2">
            <span className="flex items-center gap-1.5 text-sage">
              <Activity size={12} />
              Courbe de Réponse Fréquentielle
            </span>
            <span className="text-champagne font-semibold">
              {activePresetObj ? activePresetObj.name : 'Profil Personnalisé (Custom)'}
            </span>
          </div>

          <svg viewBox="0 0 500 70" className="w-full h-12 overflow-visible">
            {/* Grid Lines */}
            <line x1="0" y1="35" x2="500" y2="35" stroke="#1D2A22" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="12" x2="500" y2="12" stroke="#1D2A22" strokeDasharray="2 4" strokeWidth="0.5" />
            <line x1="0" y1="58" x2="500" y2="58" stroke="#1D2A22" strokeDasharray="2 4" strokeWidth="0.5" />

            {/* Filled Area below curve */}
            <defs>
              <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A57A" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#C9A57A" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <polygon
              points={`25,35 ${svgPoints} 475,35`}
              fill="url(#eqGradient)"
            />

            {/* Response Line */}
            <polyline
              fill="none"
              stroke="#C9A57A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />

            {/* Band Nodes */}
            {eqBands.map((gain, i) => {
              const x = 25 + i * 50;
              const y = 35 - (gain / 12) * 28;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-obsidian stroke-champagne stroke-2"
                />
              );
            })}
          </svg>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {EQ_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-surface-hi border-champagne text-champagne shadow-sm'
                    : 'bg-surface border-border text-warm-stone/60 hover:text-apex-white hover:bg-surface-hi/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => applyEqPreset('flat')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-warm-stone/60 hover:text-champagne transition-colors whitespace-nowrap ml-2 border border-border bg-surface-hi/40"
            title="Remettre tous les curseurs à 0 dB"
          >
            <RotateCcw size={12} />
            <span>Reset Flat</span>
          </button>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 overflow-y-auto max-h-36 pr-1 custom-scrollbar flex-shrink-0">
          {filteredPresets.map((preset) => {
            const isActive = currentEqPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyEqPreset(preset.id)}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs ${
                  isActive
                    ? 'bg-surface-hi border-champagne text-apex-white shadow-sm ring-1 ring-champagne/40'
                    : 'bg-surface border-border text-warm-stone/80 hover:bg-surface-hi hover:text-apex-white'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`font-semibold truncate ${isActive ? 'text-champagne' : ''}`}>
                    {preset.name}
                  </span>
                  {isActive && <Sparkles size={12} className="text-champagne flex-shrink-0 ml-1" />}
                </div>
                <span className="text-[10px] text-warm-stone/50 line-clamp-1">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* 10 Precision Sliders Fader Rack */}
        <div className="grid grid-cols-10 gap-2 py-3 bg-obsidian/70 p-3.5 rounded-xl border border-border flex-1">
          {FREQUENCIES.map((freq, idx) => {
            const gain = eqBands[idx] || 0;
            return (
              <div key={freq} className="flex flex-col items-center justify-between">
                <span
                  className={`text-[10px] font-mono font-semibold transition-colors ${
                    gain > 0
                      ? 'text-champagne'
                      : gain < 0
                      ? 'text-sage'
                      : 'text-warm-stone/40'
                  }`}
                >
                  {gain > 0 ? `+${gain}` : gain} dB
                </span>

                <div className="h-40 flex items-center justify-center my-1">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={gain}
                    onChange={(e) => setEqBand(idx, parseInt(e.target.value, 10))}
                    className="h-36 w-2 accent-champagne bg-surface-hi rounded appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                  />
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-warm-stone/80 font-mono text-center">
                    {freq}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-warm-stone/60 pt-2 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-champagne" />
            <span>Filtres IIR Biquad actifs • Plage de dynamique : -12 dB à +12 dB</span>
          </div>
          <button
            onClick={toggleEq}
            className="px-5 py-1.5 rounded-xl bg-champagne text-obsidian font-semibold hover:opacity-95 active:scale-95 transition-all shadow-md"
          >
            Appliquer & Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
