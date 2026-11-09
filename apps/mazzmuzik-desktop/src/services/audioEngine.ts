import type { EQBand } from '../types/music';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// Tiny 504-byte valid silent MP3 loop used to anchor iOS AVAudioSession in .playback mode
const SILENT_AUDIO_URI =
  'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAFAAAAPAAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAAAPAAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc';

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  // Dual Decks A and B
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;

  private activeDeck: 'A' | 'B' = 'A';
  private crossfadeTime = 2; // seconds (0-12s)
  private currentVolume = 0.8;
  private crossfadeTimer: number | null = null;
  private fadingOutDeck: 'A' | 'B' | null = null;
  private playToken = 0;
  private iosGraphEnabled = false;

  // Dual Playback Modes: HTML5 Audio vs YouTube Embedded Engine
  private currentMode: 'audio' | 'youtube' = 'audio';
  private ytPlayer: any = null;
  private isYtReady = false;
  private ytTimer: number | null = null;
  private ytInitPromise: Promise<void> | null = null;

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
  private onBufferingCallback?: (buffering: boolean) => void;
  private onErrorCallback?: () => void;

  private constructor() {
    // iOS: direct hardware output (no CORS attribute, no Web Audio graph) keeps lock-screen audio alive.
    // The graph is only built on iOS once the user actually moves an equalizer band (see enableGraphOnIOS).
    this.audioA = this.createDeck('A', !isIOS);
    this.audioB = this.createDeck('B', !isIOS);
    this.enableAudioSession();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.currentMode === 'youtube' && this.ytPlayer) {
          if (document.hidden) {
            // Keep silent audio anchor alive and command YouTube player to keep playing in background
            this.audioA.play().catch(() => {});
            try {
              this.ytPlayer.playVideo();
            } catch {}
          }
        }
      });
    }
  }

  /** Activates iOS AVAudioSession in playback mode (bypasses silent switch and lock-screen suspension) */
  public enableAudioSession(): void {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'playback';
      } catch (err) {
        // Ignored if unsupported
      }
    }
  }

  private createDeck(deck: 'A' | 'B', cors: boolean): HTMLAudioElement {
    const audio = new Audio();
    if (cors) audio.crossOrigin = 'anonymous'; // required by createMediaElementSource
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.preload = 'auto';
    audio.volume = this.currentVolume;
    this.setupAudioListeners(audio, deck);
    return audio;
  }

  /** iOS only: swap both decks for CORS-enabled elements so they can enter the EQ graph, keeping position. */
  private enableGraphOnIOS(): void {
    if (this.iosGraphEnabled) return;
    this.iosGraphEnabled = true;
    const old = this.deckAudio(this.activeDeck);
    const src = old.src;
    const time = old.currentTime;
    const wasPlaying = !old.paused;
    this.playToken++;
    this.settleCrossfade();
    for (const el of [this.audioA, this.audioB]) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    this.audioA = this.createDeck('A', true);
    this.audioB = this.createDeck('B', true);
    this.activeDeck = 'A';
    this.initWebAudio();
    if (src) {
      const el = this.audioA;
      el.src = src;
      el.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(time)) el.currentTime = time;
          if (wasPlaying) el.play().catch((err) => console.warn('EQ graph resume error:', err));
        },
        { once: true }
      );
    }
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
    if (isIOS && !this.iosGraphEnabled) {
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

      // Levels now live on the gain nodes: keep element volume at unity (no squared attenuation).
      this.audioA.volume = 1;
      this.audioB.volume = 1;
      this.isWebAudioReady = true;
    } catch (err) {
      console.warn('Web Audio initialization note (direct fallback active):', err);
    }
  }

  private setupAudioListeners(audio: HTMLAudioElement, deck: 'A' | 'B') {
    audio.addEventListener('timeupdate', () => {
      if (this.currentMode === 'audio' && this.activeDeck === deck && this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(audio.currentTime, audio.duration || 0);
      }
    });

    audio.addEventListener('ended', () => {
      if (this.currentMode === 'audio' && this.activeDeck === deck && this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    });

    audio.addEventListener('play', () => {
      if (this.currentMode === 'audio' && this.activeDeck === deck && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(true);
      }
    });

    audio.addEventListener('pause', () => {
      if (this.currentMode === 'audio' && this.activeDeck === deck && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(false);
      }
    });

    audio.addEventListener('waiting', () => {
      if (this.currentMode === 'audio' && this.activeDeck === deck) this.onBufferingCallback?.(true);
    });
    audio.addEventListener('playing', () => {
      if (this.currentMode === 'audio' && this.activeDeck === deck) this.onBufferingCallback?.(false);
    });
    audio.addEventListener('error', (e) => {
      if (this.currentMode === 'audio' && this.activeDeck === deck && audio.src) {
        console.error(`[AudioEngine Deck ${deck}] Media Error:`, audio.error, e);
        this.onErrorCallback?.();
      }
    });
  }

  private deckAudio(deck: 'A' | 'B'): HTMLAudioElement {
    return deck === 'A' ? this.audioA : this.audioB;
  }

  private deckGain(deck: 'A' | 'B'): GainNode | null {
    return deck === 'A' ? this.gainDeckA : this.gainDeckB;
  }

  /** Set a deck level (0..1). Web Audio: sample-accurate gain ramp. Otherwise: element volume. */
  private setDeckLevel(deck: 'A' | 'B', level: number, rampSeconds = 0): void {
    const clamped = Math.max(0, Math.min(1, level));
    const gain = this.deckGain(deck);
    if (this.isWebAudioReady && this.audioCtx && gain) {
      const now = this.audioCtx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      if (rampSeconds > 0) gain.gain.linearRampToValueAtTime(clamped, now + rampSeconds);
      else gain.gain.setValueAtTime(clamped, now);
      this.deckAudio(deck).volume = 1;
    } else {
      this.deckAudio(deck).volume = clamped * this.currentVolume;
    }
  }

  /** Settle any running crossfade instantly: outgoing deck stopped and silent, incoming at full level. */
  private settleCrossfade(): void {
    if (this.crossfadeTimer !== null) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.fadingOutDeck) {
      const out = this.deckAudio(this.fadingOutDeck);
      out.pause();
      this.setDeckLevel(this.fadingOutDeck, 0);
      this.fadingOutDeck = null;
    }
    this.setDeckLevel(this.activeDeck, 1);
  }

  /** Keeps YouTube player running completely invisibly in background (audio-only, zero visual popup) */
  private updateYouTubeContainerStyle(_visible: boolean) {
    if (typeof window === 'undefined') return;
    const container = document.getElementById('mazz-yt-player-container');
    if (!container) return;
    container.style.cssText =
      'position:fixed;left:-9999px;bottom:-9999px;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-9999;overflow:hidden;clip:rect(0,0,0,0);';
  }

  /** Initializes the YouTube embedded iframe engine for sovereign zero-cutoff playback */
  private initYouTubeApi(): Promise<void> {
    if (this.ytInitPromise) return this.ytInitPromise;

    this.ytInitPromise = new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve();

      let container = document.getElementById('mazz-yt-player-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'mazz-yt-player-container';
        container.style.cssText =
          'position:fixed;left:-9999px;bottom:-9999px;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-9999;overflow:hidden;clip:rect(0,0,0,0);';
        const playerDiv = document.createElement('div');
        playerDiv.id = 'mazz-yt-player';
        container.appendChild(playerDiv);
        document.body.appendChild(container);
      }

      const createPlayer = () => {
        try {
          this.ytPlayer = new (window as any).YT.Player('mazz-yt-player', {
            height: '1',
            width: '1',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: (e: any) => {
                this.isYtReady = true;
                try {
                  e.target.setVolume(this.currentVolume * 100);
                } catch {}
                resolve();
              },
              onStateChange: (e: any) => {
                if (e.data === 1) {
                  this.onPlayStateChangeCallback?.(true);
                  this.onBufferingCallback?.(false);
                } else if (e.data === 2) {
                  // If browser/iOS paused YouTube because screen is locked or tab is hidden, resume immediately!
                  if (typeof document !== 'undefined' && document.hidden && this.currentMode === 'youtube') {
                    this.audioA.play().catch(() => {});
                    try {
                      this.ytPlayer?.playVideo();
                    } catch {}
                  } else {
                    this.onPlayStateChangeCallback?.(false);
                  }
                } else if (e.data === 3) {
                  this.onBufferingCallback?.(true);
                } else if (e.data === 0) {
                  this.onTrackEndedCallback?.();
                }
              },
              onError: (e: any) => {
                console.warn('YouTube Player error code:', e.data);
                if (this.currentMode === 'youtube') {
                  this.onErrorCallback?.();
                }
              },
            },
          });
        } catch (err) {
          console.warn('Failed to create YT.Player:', err);
          resolve();
        }
      };

      if ((window as any).YT && (window as any).YT.Player) {
        createPlayer();
      } else {
        const prev = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          if (typeof prev === 'function') prev();
          createPlayer();
        };

        if (!document.getElementById('yt-iframe-api-script')) {
          const script = document.createElement('script');
          script.id = 'yt-iframe-api-script';
          script.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(script);
        }
      }
    });

    return this.ytInitPromise;
  }

  /** Plays full studio audio track via the YouTube embedded engine (zero 30s limit) */
  public async playYouTube(videoId: string): Promise<void> {
    this.currentMode = 'youtube';
    this.enableAudioSession();

    // Settle crossfade and stop Deck B
    this.playToken++;
    this.settleCrossfade();
    this.audioB.pause();
    this.audioB.removeAttribute('src');

    // Anchor iOS AVAudioSession in .playback mode using silent audio loop on audioA
    try {
      this.audioA.pause();
      this.audioA.src = SILENT_AUDIO_URI;
      this.audioA.loop = true;
      this.audioA.volume = 0.001;
      await this.audioA.play().catch(() => {});
    } catch {}

    await this.initYouTubeApi();

    if (!this.ytPlayer || !this.isYtReady) {
      await new Promise((r) => setTimeout(r, 300));
    }

    this.updateYouTubeContainerStyle(false);

    if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
      try {
        this.ytPlayer.loadVideoById({ videoId, startSeconds: 0 });
        this.ytPlayer.playVideo();
        this.ytPlayer.setVolume(this.currentVolume * 100);
      } catch (err) {
        console.warn('playYouTube load error:', err);
      }
    }

    if (this.ytTimer) clearInterval(this.ytTimer);
    this.ytTimer = window.setInterval(() => {
      if (
        this.currentMode === 'youtube' &&
        this.ytPlayer &&
        typeof this.ytPlayer.getCurrentTime === 'function'
      ) {
        try {
          const curr = this.ytPlayer.getCurrentTime() || 0;
          const dur = this.ytPlayer.getDuration() || 0;
          if (dur > 0) {
            this.onTimeUpdateCallback?.(curr, dur);
          }
        } catch {}
      }
    }, 250);
  }

  public async playTrack(url: string, crossfade = true): Promise<void> {
    this.currentMode = 'audio';
    this.enableAudioSession();
    this.audioA.loop = false;
    this.audioB.loop = false;
    this.updateYouTubeContainerStyle(false);
    if (this.ytTimer) {
      clearInterval(this.ytTimer);
      this.ytTimer = null;
    }
    if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      try {
        this.ytPlayer.stopVideo();
      } catch {}
    }

    const token = ++this.playToken;
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => undefined);
      if (token !== this.playToken) return;
    }

    this.settleCrossfade();

    const prevDeck = this.activeDeck;
    const prevAudio = this.deckAudio(prevDeck);
    const nextDeck: 'A' | 'B' = prevDeck === 'A' ? 'B' : 'A';
    const nextAudio = this.deckAudio(nextDeck);

    // iOS ignores HTMLMediaElement.volume (read-only) so a real crossfade is impossible there.
    const useCrossfade =
      crossfade &&
      (this.isWebAudioReady || !isIOS) &&
      this.crossfadeTime > 0 &&
      !prevAudio.paused &&
      Boolean(prevAudio.src);

    // Always load on the idle deck: the playing deck is never touched until the new one is audible.
    nextAudio.pause();
    nextAudio.src = url;
    nextAudio.currentTime = 0;
    this.setDeckLevel(nextDeck, useCrossfade ? 0 : 1);
    this.onBufferingCallback?.(true);

    try {
      await nextAudio.play();
    } catch (err) {
      // A newer request took over the deck: not an error for the caller.
      if (token !== this.playToken) return;
      throw err;
    }
    if (token !== this.playToken) return;

    this.activeDeck = nextDeck;

    if (useCrossfade) {
      const seconds = this.crossfadeTime;
      this.fadingOutDeck = prevDeck;
      this.setDeckLevel(prevDeck, 0, seconds);
      this.setDeckLevel(nextDeck, 1, seconds);
      if (!this.isWebAudioReady) this.runElementFade(prevDeck, nextDeck, seconds * 1000);
      this.crossfadeTimer = window.setTimeout(() => this.settleCrossfade(), seconds * 1000 + 60);
    } else {
      prevAudio.pause();
      prevAudio.currentTime = 0;
      this.setDeckLevel(prevDeck, 0);
      this.setDeckLevel(nextDeck, 1);
    }
  }

  /** Fallback fade for browsers without Web Audio graph (element volume steps). */
  private runElementFade(outDeck: 'A' | 'B', inDeck: 'A' | 'B', durationMs: number): void {
    const start = performance.now();
    const step = () => {
      if (this.fadingOutDeck !== outDeck || this.activeDeck !== inDeck) return;
      const p = Math.min(1, (performance.now() - start) / durationMs);
      this.deckAudio(outDeck).volume = (1 - p) * this.currentVolume;
      this.deckAudio(inDeck).volume = p * this.currentVolume;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Cancel in-flight loads and silence everything (used when the player is reset). */
  public stop(): void {
    this.playToken++;
    this.settleCrossfade();
    this.audioA.pause();
    this.audioB.pause();
    this.audioA.loop = false;
    this.audioB.loop = false;
    if (this.ytTimer) {
      clearInterval(this.ytTimer);
      this.ytTimer = null;
    }
    if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      try {
        this.ytPlayer.stopVideo();
      } catch {}
    }
  }

  public pause(): void {
    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.audioA.pause();
        this.ytPlayer.pauseVideo();
        this.onPlayStateChangeCallback?.(false);
      } catch {}
      return;
    }
    this.settleCrossfade();
    this.deckAudio(this.activeDeck).pause();
  }

  public resume(): void {
    this.enableAudioSession();
    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.audioA.play().catch(() => {});
        this.ytPlayer.playVideo();
        this.onPlayStateChangeCallback?.(true);
      } catch {}
      return;
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    this.deckAudio(this.activeDeck)
      .play()
      .catch((err) => console.warn('Resume error:', err));
  }

  public seek(seconds: number): void {
    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(seconds, true);
      } catch {}
      return;
    }
    const activeAudio = this.deckAudio(this.activeDeck);
    if (Number.isFinite(seconds) && activeAudio.duration) {
      activeAudio.currentTime = Math.max(0, Math.min(seconds, activeAudio.duration));
    }
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(this.currentVolume * 100);
      } catch {}
    }
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);
    } else if (!isIOS) {
      this.deckAudio(this.activeDeck).volume = this.currentVolume;
    }
  }

  public setCrossfade(seconds: number): void {
    this.crossfadeTime = Math.max(0, Math.min(12, seconds));
  }

  public setEqualizerGains(gains: number[]): void {
    this.currentGains = [...gains];
    if (isIOS && !this.iosGraphEnabled && gains.some((g) => g !== 0)) this.enableGraphOnIOS();
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
    if (this.analyser && this.isWebAudioReady && this.currentMode === 'audio') {
      this.analyser.getByteFrequencyData(this.freqData);
      return this.freqData;
    }

    // Dynamic wave simulation for YouTube mode and fallback
    const data = new Uint8Array(128);
    const isPlaying =
      this.currentMode === 'youtube'
        ? this.ytPlayer &&
          typeof this.ytPlayer.getPlayerState === 'function' &&
          this.ytPlayer.getPlayerState() === 1
        : !this.deckAudio(this.activeDeck).paused;

    if (isPlaying && this.currentVolume > 0) {
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
    onBuffering?: (buffering: boolean) => void;
    onError?: () => void;
  }): void {
    this.onBufferingCallback = callbacks.onBuffering;
    this.onErrorCallback = callbacks.onError;
    this.onTimeUpdateCallback = callbacks.onTimeUpdate;
    this.onTrackEndedCallback = callbacks.onEnded;
    this.onPlayStateChangeCallback = callbacks.onPlayStateChange;
  }
}

export const audioEngine = AudioEngine.getInstance();
