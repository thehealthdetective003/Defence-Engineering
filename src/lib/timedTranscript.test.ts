import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimedScenes } from './timedTranscript';

test('builds arbitrary fractional windows with a partial final scene', () => {
  const scenes = buildTimedScenes([
    { text: ' Hello', start: 0.2, end: 0.6, probability: 1 },
    { text: ' boundary', start: 6.3, end: 6.8, probability: 1 },
    { text: ' end', start: 13.1, end: 13.4, probability: 1 },
  ], 14.25, 6.5);
  assert.equal(scenes.length, 3);
  assert.equal(scenes[0].text, 'Hello');
  assert.equal(scenes[1].text, 'boundary');
  assert.equal(scenes[2].duration, 1.25);
  assert.equal(scenes[2].text, 'end');
});

test('preserves silent 8 second windows', () => {
  const scenes = buildTimedScenes([
    { text: ' Before', start: 1, end: 2, probability: 1 },
    { text: ' after', start: 17, end: 18, probability: 1 },
  ], 24, 8);
  assert.equal(scenes.length, 3);
  assert.equal(scenes[1].silent, true);
  assert.equal(scenes[1].text, '');
});
