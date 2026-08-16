import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCENE_DURATION_SECONDS,
  normalizeSceneDuration,
  parseSceneDuration,
  requireSceneDuration,
  timedSceneCount,
} from './sceneDuration';

test('uses six seconds as the fresh-project default', () => {
  assert.equal(DEFAULT_SCENE_DURATION_SECONDS, 6);
  assert.equal(normalizeSceneDuration(undefined), 6);
});

test('accepts arbitrary integer and fractional scene durations', () => {
  assert.equal(parseSceneDuration(6.5), 6.5);
  assert.equal(parseSceneDuration('13.2754'), 13.275);
  assert.equal(normalizeSceneDuration(42, 10), 42);
});

test('rejects invalid or unsafe scene durations', () => {
  assert.equal(parseSceneDuration(0), null);
  assert.equal(parseSceneDuration(Number.NaN), null);
  assert.equal(parseSceneDuration(601), null);
  assert.throws(() => requireSceneDuration(-1), /between 0.1 and 600 seconds/i);
});

test('prevents custom timing from creating an unbounded scene array', () => {
  assert.equal(timedSceneCount(60, 7.5), 8);
  assert.throws(() => timedSceneCount(3_600, 0.1), /10,000 scenes or fewer/i);
});
