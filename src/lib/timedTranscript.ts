import { TimedScene, TimedWord, VoiceoverTranscription } from '../types';
import { requireSceneDuration, timedSceneCount } from './sceneDuration';

export function buildTimedScenes(words: TimedWord[], audioDuration: number, sceneDuration: number): TimedScene[] {
  if (!Number.isFinite(audioDuration) || audioDuration <= 0) return [];
  const duration = requireSceneDuration(sceneDuration);
  const count = timedSceneCount(audioDuration, duration);
  const buckets: TimedWord[][] = Array.from({ length: count }, () => []);
  words.forEach(word => {
    const midpoint = (Number(word.start) + Number(word.end)) / 2;
    const index = Math.max(0, Math.min(count - 1, Math.floor(midpoint / duration)));
    buckets[index].push(word);
  });
  return buckets.map((bucket, index) => {
    const start = index * duration;
    const end = Math.min(audioDuration, start + duration);
    return {
      number: index + 1, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)),
      duration: Number((end - start).toFixed(3)),
      text: bucket.map(word => word.text).join('').replace(/\s+/g, ' ').trim(),
      silent: bucket.length === 0,
    };
  });
}

export function resplitTranscription(transcription: VoiceoverTranscription, sceneDuration: number): VoiceoverTranscription {
  const duration = requireSceneDuration(sceneDuration);
  return { ...transcription, sceneDurationSeconds: duration, scenes: buildTimedScenes(transcription.words, transcription.duration, duration) };
}

export function resetDownstreamForTiming<T extends Record<string, any>>(state: T): T {
  return { ...state, phase: 2, plannedScenes: [], sceneDirections: [], visualPrompts: [], demoState: 'idle', demoScenes: [], demoSceneNumbers: [] };
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${(safe - minutes * 60).toFixed(3).padStart(6, '0')}`;
}
