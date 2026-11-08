import type { EQBand } from '../types/music';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  // Dual Decks A and B
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;

  private activeDeck: 'A' | 'B' = 'A';
  private crossfadeTime = 2; // seconds (0-12s)
  private currentVolume = 0.8;
  private crossfadeTimer: number | null = null;

  // Web Audio Context & Processing Graph
  private audioCtx: AudioContext | null = null;
  private sourceA: MediaElementAudioSourceNode | null = null;
  private sourceB: MediaElementAudioSourceNode | null = null;
  private gainDeckA: GainNode | null = null;
  private gainDeckB: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private currentGains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(128));
  private masterGain: GainNode | null = null;
  private isWebAudioReady = false;

  private onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  private onTrackEndedCallback?: () => void;
  private onPlayStateChangeCallback?: (isPlaying: boolean) => void;

  private constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();

    // Critical iOS lockscreen & background audio configuration:
    // On iOS Safari, crossOrigin can trigger strict CORS failures on remote audio streams,
    // and createMediaElementSource mutes when locked.
    if (!isIOS) {
      this.audioA.crossOrigin = 'anonymous';
      this.audioB.crossOrigin = 'anonymous';
    }
    this.audioA.setAttribute('playsinline', 'true');
    this.audioB.setAttribute('playsinline', 'true');
    this.audioA.setAttribute('webkit-playsinline', 'true');
    this.audioB.setAttribute('webkit-playsinline', 'true');

    this.audioA.preload = 'auto';
    this.audioB.preload = 'auto';
    this.audioA.volume = this.currentVolume;
    this.audioB.volume = 0;

    this.setupAudioListeners(this.audioA, 'A');
    this.setupAudioListeners(this.audioB, 'B');
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private initWebAudio() {
    if (this.isWebAudioReady) return;

    // CRITICAL iOS SAFARI RULE:
    // When an HTMLAudioElement is captured via createMediaElementSource in iOS WebKit,
    // iOS silences all Web Audio destinations as soon as the screen locks or app backgrounds.
    // Direct hardware audio output is mandatory on iOS for lockscreen playback.
    if (isIOS) {
      return;
    }
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();

      // Create 10 BiquadFilterNodes for 10-band Equalizer
      this.filters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = this.audioCtx!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = this.currentGains[idx] ?? 0;
        return filter;
      });

      // Chain filters: f0 -> f1 -> f2 ... -> f9
      for (let i = 0; i < this.filters.length - 1; i++) {
        this.filters[i].connect(this.filters[i + 1]);
      }

      // AnalyserNode for WebGL visualizer
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      const lastFilter = this.filters[this.filters.length - 1];
      lastFilter.connect(this.analyser);

      // Master Gain Node
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      // Deck A and Deck B individual gain nodes for studio crossfading
      this.gainDeckA = this.audioCtx.createGain();
      this.gainDeckB = this.audioCtx.createGain();
      this.gainDeckA.gain.value = this.activeDeck === 'A' ? 1 : 0;
      this.gainDeckB.gain.value = this.activeDeck === 'B' ? 1 : 0;

      // Connect Media Elements -> Deck Gain -> Equalizer Filter Cascade
      this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
      this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);
      this.sourceA.connect(this.gainDeckA);
      this.sourceB.connect(this.gainDeckB);
      this.gainDeckA.connect(this.filters[0]);
      this.gainDeckB.connect(this.filters[0]);

      this.isWebAudioReady = true;
    } catch (err) {
      console.warn('Web Audio initialization note (direct fallback active):', err);
    }
  }

  private setupAudioListeners(audio: HTMLAudioElement, deck: 'A' | 'B') {
    audio.addEventListener('timeupdate', () => {
      if (this.activeDeck === deck && this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(audio.currentTime, audio.duration || 0);
      }
    });

    audio.addEventListener('ended', () => {
      if (this.activeDeck === deck && this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    });

    audio.addEventListener('play', () => {
      if (this.activeDeck === deck && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(true);
      }
    });

    audio.addEventListener('pause', () => {
      if (this.activeDeck === deck && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(false);
      }
    });

    audio.addEventListener('error', (e) => {
      console.error(`[AudioEngine Deck ${deck}] Media Error:`, audio.error, e);
    });
  }

  public async playTrack(url: string, crossfade = true): Promise<void> {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (this.crossfadeTimer !== null) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }

    const nextDeck = this.activeDeck === 'A' ? 'B' : 'A';
    const currentAudio = this.activeDeck === 'A' ? this.audioA : this.audioB;
    const nextAudio = nextDeck === 'A' ? this.audioA : this.audioB;

    const useCrossfade =
      crossfade &&
      this.crossfadeTime > 0 &&
      !currentAudio.paused &&
      Boolean(currentAudio.src);

    if (useCrossfade) {
      nextAudio.src = url;
      nextAudio.volume = 0;
      await nextAudio.play();

      const startTime = Date.now();
      const durationMs = this.crossfadeTime * 1000;
      const targetVol = this.currentVolume;

      const currentGain = this.activeDeck === 'A' ? this.gainDeckA : this.gainDeckB;
      const nextGain = nextDeck === 'A' ? this.gainDeckA : this.gainDeckB;

      this.crossfadeTimer = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        currentAudio.volume = Math.max(0, targetVol * (1 - progress));
        nextAudio.volume = Math.min(targetVol, targetVol * progress);

        if (this.audioCtx) {
          if (currentGain) currentGain.gain.setValueAtTime(Math.max(0, 1 - progress), this.audioCtx.currentTime);
          if (nextGain) nextGain.gain.setValueAtTime(Math.min(1, progress), this.audioCtx.currentTime);
        }

        if (progress >= 1) {
          if (this.crossfadeTimer !== null) {
            clearInterval(this.crossfadeTimer);
            this.crossfadeTimer = null;
          }
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio.volume = targetVol;
          nextAudio.volume = targetVol;
          if (this.audioCtx) {
            if (currentGain) currentGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            if (nextGain) nextGain.gain.setValueAtTime(1, this.audioCtx.currentTime);
          }
        }
      }, 50);

      this.activeDeck = nextDeck;
    } else {
      // Immediate switch
      currentAudio.pause();
      currentAudio.currentTime = 0;

      this.activeDeck = 'A';
      if (this.audioCtx) {
        if (this.gainDeckA) this.gainDeckA.gain.setValueAtTime(1, this.audioCtx.currentTime);
        if (this.gainDeckB) this.gainDeckB.gain.setValueAtTime(0, this.audioCtx.currentTime);
      }
      this.audioA.src = url;
      this.audioA.volume = this.currentVolume;
      await this.audioA.play();
    }
  }

  public pause(): void {
    const activeAudio = this.activeDeck === 'A' ? this.audioA : this.audioB;
    activeAudio.pause();
  }

  public resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    const activeAudio = this.activeDeck === 'A' ? this.audioA : this.audioB;
    activeAudio.play().catch((err) => console.warn('Resume error:', err));
  }

  public seek(seconds: number): void {
    const activeAudio = this.activeDeck === 'A' ? this.audioA : this.audioB;
    if (Number.isFinite(seconds) && activeAudio.duration) {
      activeAudio.currentTime = Math.max(0, Math.min(seconds, activeAudio.duration));
    }
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    this.audioA.volume = this.currentVolume;
    this.audioB.volume = this.currentVolume;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);
    }
  }

  public setCrossfade(seconds: number): void {
    this.crossfadeTime = Math.max(0, Math.min(12, seconds));
  }

  public setEqualizerGains(gains: number[]): void {
    this.currentGains = [...gains];
    this.initWebAudio();
    if (!this.audioCtx || this.filters.length === 0) return;

    gains.forEach((gain, idx) => {
      if (this.filters[idx]) {
        const clampedGain = Math.max(-12, Math.min(12, gain));
        this.filters[idx].gain.setValueAtTime(clampedGain, this.audioCtx!.currentTime);
      }
    });
  }

  public setEqualizer(bands: EQBand[]): void {
    this.setEqualizerGains(bands.map((b) => b.gain));
  }

  public getFrequencyData(): Uint8Array {
    if (this.analyser && this.isWebAudioReady) {
      this.analyser.getByteFrequencyData(this.freqData);
      return this.freqData;
    }

    // Dynamic wave simulation fallback
    const data = new Uint8Array(128);
    const activeAudio = this.activeDeck === 'A' ? this.audioA : this.audioB;
    if (!activeAudio.paused && this.currentVolume > 0) {
      const t = Date.now() / 120;
      for (let i = 0; i < 128; i++) {
        const val =
          Math.sin(t + i * 0.18) * 45 +
          Math.cos(t * 0.8 + i * 0.09) * 35 +
          125;
        data[i] = Math.min(255, Math.max(0, Math.floor(val * this.currentVolume)));
      }
    }
    return data;
  }

  public setListeners(callbacks: {
    onTimeUpdate?: (curr: number, dur: number) => void;
    onEnded?: () => void;
    onPlayStateChange?: (playing: boolean) => void;
  }): void {
    this.onTimeUpdateCallback = callbacks.onTimeUpdate;
    this.onTrackEndedCallback = callbacks.onEnded;
    this.onPlayStateChangeCallback = callbacks.onPlayStateChange;
  }
}

export const audioEngine = AudioEngine.getInstance();
