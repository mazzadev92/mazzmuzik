import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SourceType, ShaderPreset } from '../types/music';
import { audioEngine } from '../services/audioEngine';
import { EQ_PRESETS } from '../constants/eqPresets';

interface SettingsState {
  sourceOrder: SourceType[];
  crossfadeDuration: number;
  gaplessEnabled: boolean;
  shaderPreset: ShaderPreset;
  shaderActive: boolean;
  eqBands: number[]; // 10 frequencies
  currentEqPreset: string;
  downloadPath: string;
  apiUrl: string;
  apiKey: string;
  deezerArl: string;
  preferFlac: boolean;
  isUpdatingTools: boolean;
  toolUpdateLog: string;

  setSourceOrder: (order: SourceType[]) => void;
  moveSource: (fromIndex: number, toIndex: number) => void;
  setCrossfadeDuration: (seconds: number) => void;
  setGaplessEnabled: (enabled: boolean) => void;
  setShaderPreset: (preset: ShaderPreset) => void;
  setShaderActive: (active: boolean) => void;
  setEqBand: (index: number, gain: number) => void;
  applyEqPreset: (presetId: string) => void;
  setDownloadPath: (path: string) => void;
  setApiConfig: (url: string, key: string) => void;
  setDeezerArl: (arl: string) => void;
  setPreferFlac: (prefer: boolean) => void;
  updateTools: () => Promise<void>;
}

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      sourceOrder: ['deezer', 'ytmusic', 'soundcloud', 'audius', 'bandcamp', 'radio'],
      crossfadeDuration: 2,
      gaplessEnabled: true,
      shaderPreset: 'bioforge',
      shaderActive: true,
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      currentEqPreset: 'flat',
      downloadPath: 'D:\\Mazz MuZik\\downloads',
      apiUrl:
        typeof window !== 'undefined' && !Boolean((window as any).__TAURI_INTERNALS__)
          ? '/api/server'
          : 'http://127.0.0.1:4040',
      apiKey: '',
      deezerArl: '63a2db46262a87f2b2efe5f77beac39f9c439f816b57ddbc8e3a27593b05d676ba1c11f65ac50ae25e49e45e7af1315b029d51215314239844e8ddcb565c45d1d6a7bc4ba2891023c111c92b1f2350f44dfecb58159608273aa8ef5ceaf0f419',
      preferFlac: false,
      isUpdatingTools: false,
      toolUpdateLog: '',

      setSourceOrder: (order) => set({ sourceOrder: order }),

      moveSource: (fromIndex, toIndex) => {
        const order = [...get().sourceOrder];
        const [moved] = order.splice(fromIndex, 1);
        if (moved) {
          order.splice(toIndex, 0, moved);
          set({ sourceOrder: order });
        }
      },

      setCrossfadeDuration: (seconds) => {
        const clamped = Math.max(0, Math.min(12, seconds));
        audioEngine.setCrossfade(clamped);
        set({ crossfadeDuration: clamped });
      },

      setGaplessEnabled: (enabled) => set({ gaplessEnabled: enabled }),

      setShaderPreset: (preset) => set({ shaderPreset: preset }),

      setShaderActive: (active) => set({ shaderActive: active }),

      setEqBand: (index, gain) => {
        const clamped = Math.max(-12, Math.min(12, gain));
        const newBands = [...get().eqBands];
        newBands[index] = clamped;
        set({ eqBands: newBands, currentEqPreset: 'custom' });
        audioEngine.setEqualizer(
          newBands.map((g, i) => ({ frequency: EQ_FREQUENCIES[i] || 1000, gain: g }))
        );
      },

      applyEqPreset: (presetId) => {
        const preset = EQ_PRESETS.find((p) => p.id === presetId);
        const gains = preset ? [...preset.gains] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        set({ eqBands: gains, currentEqPreset: presetId });
        audioEngine.setEqualizer(
          gains.map((g, i) => ({ frequency: EQ_FREQUENCIES[i] || 1000, gain: g }))
        );
      },

      setDownloadPath: (path) => set({ downloadPath: path }),

      setApiConfig: (url, key) => set({ apiUrl: url, apiKey: key }),

      setDeezerArl: (arl) => set({ deezerArl: arl }),

      setPreferFlac: (prefer) => set({ preferFlac: prefer }),

      updateTools: async () => {
        set({ isUpdatingTools: true, toolUpdateLog: 'Démarrage de la mise à jour des outils...' });
        try {
          // Tauri invoke
          const { invoke } = await import('@tauri-apps/api/core');
          const res = await invoke<string>('run_tool_update');
          set({
            isUpdatingTools: false,
            toolUpdateLog: res || 'Outils synchronisés avec succès dans src-tauri/binaries/ !',
          });
        } catch (e) {
          set({
            isUpdatingTools: false,
            toolUpdateLog: `Erreur lors de la mise à jour: ${String(e)}`,
          });
        }
      },
    }),
    {
      name: 'mazzmuzik-settings-storage',
    }
  )
);
