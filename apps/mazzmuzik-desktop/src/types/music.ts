export type SourceType =
  | 'deezer'
  | 'ytmusic'
  | 'soundcloud'
  | 'audius'
  | 'bandcamp'
  | 'archive'
  | 'radio'
  | 'mixcloud'
  | 'local';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  coverUrl: string;
  source: SourceType;
  streamUrl?: string;
  previewUrl?: string;
  isrc?: string;
  year?: number;
  genre?: string;
  isFavorite?: boolean;
  bitrate?: string;
  lyrics?: string;
  filePath?: string; // If downloaded locally
  addedAt?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  country?: string;
  tags?: string[];
  codec?: string;
  bitrate?: number;
}

export interface LrcLine {
  time: number; // in seconds
  text: string;
}

export interface EQBand {
  frequency: number;
  gain: number; // in dB (-12 to +12)
}

export type ShaderPreset = 'bioforge' | 'braise' | 'eau_noire' | 'statique';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AppSettings {
  sourceOrder: SourceType[];
  crossfadeDuration: number; // 0-12s
  gaplessEnabled: boolean;
  shaderPreset: ShaderPreset;
  shaderActive: boolean;
  volume: number; // 0-1
  eqBands: number[]; // 10 gain values
  downloadPath: string;
  apiUrl: string;
  apiKey: string;
  deezerArl?: string;
  preferFlac?: boolean;
}
