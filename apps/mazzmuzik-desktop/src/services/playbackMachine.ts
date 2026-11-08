export type PlaybackState =
  | 'idle'
  | 'resolving'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'switching'
  | 'error';

export type PlaybackEvent =
  | 'REQUEST' // user asks for a track
  | 'RESOLVED' // stream URL available
  | 'CANPLAY' // enough data buffered, audible
  | 'WAITING' // stall while playing
  | 'PAUSE'
  | 'RESUME'
  | 'FAIL'
  | 'STOP';

/** Strict transition table. Anything absent is ignored (state unchanged). */
const TABLE: Record<PlaybackState, Partial<Record<PlaybackEvent, PlaybackState>>> = {
  idle: { REQUEST: 'resolving' },
  resolving: { REQUEST: 'switching', RESOLVED: 'buffering', FAIL: 'error', STOP: 'idle' },
  buffering: { REQUEST: 'switching', CANPLAY: 'playing', PAUSE: 'paused', FAIL: 'error', STOP: 'idle' },
  playing: { REQUEST: 'switching', WAITING: 'buffering', PAUSE: 'paused', FAIL: 'error', STOP: 'idle' },
  paused: { REQUEST: 'switching', RESUME: 'playing', FAIL: 'error', STOP: 'idle' },
  switching: { REQUEST: 'switching', RESOLVED: 'buffering', FAIL: 'error', STOP: 'idle' },
  error: { REQUEST: 'resolving', STOP: 'idle' },
};

export function transition(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  return TABLE[state][event] ?? state;
}

/**
 * Monotonic request token. Every REQUEST bumps it; async continuations compare
 * their captured token with `current()` and abort when superseded, so rapid
 * track clicks can never leave a stale resolve/play racing the latest one.
 */
export class RequestGate {
  private id = 0;
  public next(): number {
    return ++this.id;
  }
  public current(): number {
    return this.id;
  }
  public isStale(token: number): boolean {
    return token !== this.id;
  }
}
