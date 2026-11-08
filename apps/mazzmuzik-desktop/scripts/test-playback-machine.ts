import assert from 'node:assert/strict';
import { transition, RequestGate, type PlaybackState } from '../src/services/playbackMachine.ts';

// Happy path
let s: PlaybackState = 'idle';
s = transition(s, 'REQUEST'); assert.equal(s, 'resolving');
s = transition(s, 'RESOLVED'); assert.equal(s, 'buffering');
s = transition(s, 'CANPLAY'); assert.equal(s, 'playing');
s = transition(s, 'PAUSE'); assert.equal(s, 'paused');
s = transition(s, 'RESUME'); assert.equal(s, 'playing');
s = transition(s, 'WAITING'); assert.equal(s, 'buffering');

// Rapid clicks: any active state -> switching, switching is re-entrant
for (const st of ['resolving', 'buffering', 'playing', 'paused', 'switching'] as PlaybackState[]) {
  assert.equal(transition(st, 'REQUEST'), 'switching', st);
}
// Invalid events are ignored
assert.equal(transition('idle', 'CANPLAY'), 'idle');
assert.equal(transition('idle', 'PAUSE'), 'idle');
assert.equal(transition('error', 'CANPLAY'), 'error');
// Error recovers on new request
assert.equal(transition('error', 'REQUEST'), 'resolving');
assert.equal(transition('resolving', 'FAIL'), 'error');

// Gate: only the latest token is fresh
const g = new RequestGate();
const a = g.next(); const b = g.next(); const c = g.next();
assert.ok(g.isStale(a) && g.isStale(b) && !g.isStale(c));

console.log('playbackMachine: OK');
