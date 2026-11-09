import React from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  Folder,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  Activity,
  Layers,
  Key,
  Disc3,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { usePlayerStore } from '../store/playerStore';
import type { SourceType, ShaderPreset } from '../types/music';

const SOURCE_NAMES: Record<SourceType, string> = {
  deezer: 'Deezer HiFi (Catalogue Studio & Covers 1000x1000)',
  ytmusic: 'YouTube Music (InnerTube WEB_REMIX Studio)',
  audius: 'Audius Direct (Flux MP3 320k natif)',
  soundcloud: 'SoundCloud (scsearch sidecar)',
  bandcamp: 'Bandcamp (bcsearch sidecar)',
  radio: 'Radios Directes (Radio-Browser.info)',
  archive: 'Archive.org Audio Library',
  mixcloud: 'Mixcloud (mcsearch sidecar)',
  local: 'Fichiers Locaux',
  spotify: 'Spotify (Ingestion directe de titres, albums & playlists sans compte)',
};

const SHADER_PRESETS: { id: ShaderPreset; label: string; desc: string }[] = [
  { id: 'bioforge', label: 'Bioforge Leaf', desc: 'Rubans bioluminescents vert sauge et champagne' },
  { id: 'braise', label: 'Braise & Cuivre', desc: 'Ondes thermiques ambrées et pulsations chaleureuses' },
  { id: 'eau_noire', label: 'Eau Noire', desc: 'Rides liquides sombres et reflets eucalyptus' },
  { id: 'statique', label: 'Spectre Minimal', desc: 'Barres fréquentielles discrètes et réactives' },
];

export const SettingsView: React.FC = () => {
  const {
    sourceOrder,
    moveSource,
    crossfadeDuration,
    setCrossfadeDuration,
    gaplessEnabled,
    setGaplessEnabled,
    shaderPreset,
    setShaderPreset,
    shaderActive,
    setShaderActive,
    downloadPath,
    setDownloadPath,
    deezerArl,
    setDeezerArl,
    preferFlac,
    setPreferFlac,
    updateTools,
    isUpdatingTools,
    toolUpdateLog,
  } = useSettingsStore();

  const { toggleEq } = usePlayerStore();

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-8 custom-scrollbar select-none max-w-4xl">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-apex-white">
          Réglages & Configuration
        </h1>
        <p className="text-xs text-warm-stone/70">
          Personnalisez le moteur audio, l'ordre des sources de streaming et les outils locaux.
        </p>
      </div>

      {/* 1. Moteur Audio & Fondu Enchaîné */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-hi border border-border text-champagne">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-apex-white">
              Moteur Audio Dual-Deck & Crossfade
            </h2>
            <p className="text-xs text-warm-stone/60">
              Double platine Web Audio API pour transitions transparentes sans coupure
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Crossfade slider */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-warm-stone/80">Durée du fondu enchaîné (Crossfade)</span>
              <span className="font-mono text-champagne">{crossfadeDuration} seconde{crossfadeDuration > 1 ? 's' : ''}</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={crossfadeDuration}
              onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-surface-hi accent-champagne rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-warm-stone/50">
              0s = bascule immédiate, 2s à 12s = transition progressive avec compensation de gain.
            </span>
          </div>

          {/* Gapless toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div>
              <span className="text-xs font-medium text-apex-white block">Lecture sans blanc (Gapless)</span>
              <span className="text-[11px] text-warm-stone/50">Préchargement automatique du titre suivant sur la platine B</span>
            </div>
            <button
              onClick={() => setGaplessEnabled(!gaplessEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                gaplessEnabled ? 'bg-champagne' : 'bg-surface-hi border border-border'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-obsidian transition-transform ${
                  gaplessEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Equalizer Quick Launch */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div>
              <span className="text-xs font-medium text-apex-white block">Égaliseur 10 Bandes</span>
              <span className="text-[11px] text-warm-stone/50">Ajustement spectral 32 Hz à 16 kHz</span>
            </div>
            <button
              onClick={toggleEq}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hi border border-border text-xs text-champagne font-medium hover:bg-border transition-colors"
            >
              <SlidersHorizontal size={14} />
              <span>Ouvrir l'Égaliseur</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Visualiseur WebGL2 (Shaders) */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-hi border border-border text-sage">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-apex-white">
                Visualiseur Shaders WebGL2
              </h2>
              <p className="text-xs text-warm-stone/60">
                Effets graphiques dynamiques pilotés par les fréquences audio réelles
              </p>
            </div>
          </div>

          <button
            onClick={() => setShaderActive(!shaderActive)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              shaderActive ? 'bg-sage' : 'bg-surface-hi border border-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-obsidian transition-transform ${
                shaderActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {SHADER_PRESETS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => setShaderPreset(preset.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                shaderPreset === preset.id
                  ? 'bg-surface-hi border-sage shadow-[0_0_12px_rgba(148,184,154,0.15)] text-apex-white'
                  : 'bg-obsidian/40 border-border text-warm-stone/70 hover:bg-surface-hi/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{preset.label}</span>
                {shaderPreset === preset.id && (
                  <CheckCircle2 size={14} className="text-sage" />
                )}
              </div>
              <span className="text-[11px] text-warm-stone/50">{preset.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Priorité des Sources Multi-Catalogues */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-hi border border-border text-copper">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-apex-white">
              Ordre de Résolution Multi-Sources
            </h2>
            <p className="text-xs text-warm-stone/60">
              Détermine dans quel ordre les plateformes sont interrogées pour trouver le meilleur flux
            </p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          {sourceOrder.map((src: SourceType, index: number) => (
            <div
              key={src}
              className="flex items-center justify-between p-2.5 rounded-lg bg-obsidian border border-border text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] w-4 text-warm-stone/50 text-right">
                  {index + 1}.
                </span>
                <span className="font-medium text-apex-white">
                  {SOURCE_NAMES[src] || src}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={index === 0}
                  onClick={() => moveSource(index, index - 1)}
                  className="p-1 rounded text-warm-stone/60 hover:text-apex-white disabled:opacity-20 hover:bg-surface-hi"
                  title="Monter la priorité"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  disabled={index === sourceOrder.length - 1}
                  onClick={() => moveSource(index, index + 1)}
                  className="p-1 rounded text-warm-stone/60 hover:text-apex-white disabled:opacity-20 hover:bg-surface-hi"
                  title="Descendre la priorité"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Intégration Deezer & FLAC 1411 kbps */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-hi border border-border text-champagne">
              <Disc3 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-apex-white">
                Catalogue Deezer & Qualité HiFi Lossless
              </h2>
              <p className="text-xs text-warm-stone/60">
                Explorez 100M+ de titres avec pochettes 1000x1000 et flux FLAC 1411 kbps optionnels
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              deezerArl.trim()
                ? 'bg-sage/10 text-sage border-sage/30'
                : 'bg-surface-hi text-warm-stone/70 border-border'
            }`}
          >
            {deezerArl.trim() ? 'FLAC 1411 kbps Actif' : 'Hybride YT Music (Gratuit)'}
          </span>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs text-warm-stone/80 block mb-1.5 flex items-center gap-1.5">
              <Key size={13} className="text-champagne" />
              <span>Cookie ARL Deezer (Optionnel pour FLAC direct)</span>
            </label>
            <input
              type="password"
              value={deezerArl}
              onChange={(e) => setDeezerArl(e.target.value)}
              placeholder="Ex: 61e967a54a01... (192 caractères hexadécimaux)"
              className="w-full h-9 px-3 rounded-lg bg-obsidian border border-border text-xs text-apex-white font-mono placeholder:text-warm-stone/30 focus:outline-none focus:border-champagne"
            />
            <p className="text-[11px] text-warm-stone/50 mt-1">
              {deezerArl.trim()
                ? 'Cookie configuré. Les requêtes Deezer peuvent exploiter les flux FLAC 1411 kbps.'
                : 'Sans ARL : la recherche Deezer affiche les métadonnées officielles et la lecture est instantanément acheminée en haute fidélité via YouTube Music Studio (zéro compte requis).'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div>
              <span className="text-xs font-medium text-apex-white block">Priorité Lossless FLAC</span>
              <span className="text-[11px] text-warm-stone/50">Télécharger et diffuser en FLAC si le cookie ARL est présent</span>
            </div>
            <button
              onClick={() => setPreferFlac(!preferFlac)}
              disabled={!deezerArl.trim()}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 disabled:opacity-30 ${
                preferFlac && deezerArl.trim() ? 'bg-champagne' : 'bg-surface-hi border border-border'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-obsidian transition-transform ${
                  preferFlac && deezerArl.trim() ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Gestionnaire d'Outils & Sidecars */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-hi border border-border text-champagne">
              <RefreshCw size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-apex-white">
                Mise à Jour des Outils Locaux (Sidecars)
              </h2>
              <p className="text-xs text-warm-stone/60">
                Synchronise yt-dlp, FFmpeg, Node, Deno et les correctifs SoundCloud
              </p>
            </div>
          </div>

          <button
            onClick={updateTools}
            disabled={isUpdatingTools}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-champagne text-obsidian text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity shadow-md"
          >
            <RefreshCw size={14} className={isUpdatingTools ? 'animate-spin' : ''} />
            <span>{isUpdatingTools ? 'Mise à jour en cours...' : 'Mettre à jour les outils'}</span>
          </button>
        </div>

        {toolUpdateLog && (
          <div className="p-3 rounded-lg bg-obsidian border border-border font-mono text-[11px] text-warm-stone/80 max-h-36 overflow-y-auto whitespace-pre-wrap">
            {toolUpdateLog}
          </div>
        )}
      </section>

      {/* 6. Emplacement de stockage */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-hi border border-border text-sage">
            <Folder size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-apex-white">
              Répertoire de Téléchargement & Cache
            </h2>
            <p className="text-xs text-warm-stone/60">
              Dossier où sont stockés les fichiers audio hors-ligne
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <input
            type="text"
            value={downloadPath}
            onChange={(e) => setDownloadPath(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg bg-obsidian border border-border text-xs text-apex-white font-mono"
          />
        </div>
      </section>

      {/* 7. À Propos */}
      <section className="p-6 rounded-xl bg-surface border border-border space-y-2 text-xs text-warm-stone/70">
        <div className="flex items-center gap-2 text-apex-white font-medium mb-1">
          <Info size={16} className="text-champagne" />
          <span>MazzMuziK Desktop 1.0.0 — Bioforge Leaf Edition</span>
        </div>
        <p>
          Développé sur Tauri v2 (Rust) et React 19. Architecture 100% autonome sans abonnement ni publicité.
        </p>
      </section>
    </div>
  );
};
