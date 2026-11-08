import type { LrcLine } from '../types/music';

/**
 * Parses LRC formatted string into an array of timed lines
 */
export function parseLrc(lrcContent: string): LrcLine[] {
  if (!lrcContent || typeof lrcContent !== 'string') return [];

  const lines = lrcContent.split('\n');
  const result: LrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length > 0) {
      // Clean text by removing all time tags
      const text = trimmed.replace(timeRegex, '').trim();
      if (!text) continue;

      for (const match of matches) {
        const minutes = parseInt(match[1] || '0', 10);
        const seconds = parseInt(match[2] || '0', 10);
        const msRaw = match[3] || '0';
        const ms = msRaw.length === 2 ? parseInt(msRaw, 10) * 10 : parseInt(msRaw, 10);

        const time = minutes * 60 + seconds + ms / 1000;
        result.push({ time, text });
      }
    }
  }

  // Sort chronologically
  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Returns the index of the currently active line for a given playback time
 */
export function getActiveLrcIndex(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0) return -1;
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.time <= currentTime) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}
