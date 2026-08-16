import test from 'node:test';
import assert from 'node:assert/strict';
import { importTranscriptionJson } from './transcriptionImport';

test('imports word timestamp JSON with a custom duration and preserves silent windows', () => {
  const result = importTranscriptionJson({ duration: 15, words: [{ word:'Hello',start:0,end:1 },{ word:'world',start:14,end:14.5 }] }, 'vo.json', 5);
  assert.equal(result.scenes.length, 3);
  assert.equal(result.scenes[1].silent, true);
  assert.equal(result.scenes[2].text, 'world');
});

test('rejects JSON without word timestamps', () => assert.throws(() => importTranscriptionJson({ text:'Hello' }, 'vo.json', 10), /word-level/));

test('preserves exact pre-split scenes using an arbitrary fractional duration', () => {
  const result = importTranscriptionJson({ duration:13, scenes:[{start:0,end:6.5,text:'First scene'},{start:6.5,end:13,text:'Second scene'}] }, 'scenes.json', 6.5);
  assert.deepEqual(result.scenes.map(scene=>[scene.start,scene.end,scene.text]), [[0,6.5,'First scene'],[6.5,13,'Second scene']]);
});
