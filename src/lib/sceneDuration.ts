export const DEFAULT_SCENE_DURATION_SECONDS = 6;
export const MIN_SCENE_DURATION_SECONDS = 0.1;
export const MAX_SCENE_DURATION_SECONDS = 600;
export const MAX_TIMED_SCENES = 10_000;

export function parseSceneDuration(value: unknown): number | null {
  const duration = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(duration) || duration < MIN_SCENE_DURATION_SECONDS || duration > MAX_SCENE_DURATION_SECONDS) return null;
  return Number(duration.toFixed(3));
}

export function normalizeSceneDuration(value: unknown, fallback = DEFAULT_SCENE_DURATION_SECONDS): number {
  return parseSceneDuration(value) ?? parseSceneDuration(fallback) ?? DEFAULT_SCENE_DURATION_SECONDS;
}

export function requireSceneDuration(value: unknown): number {
  const duration = parseSceneDuration(value);
  if (duration === null) {
    throw new Error(`Scene duration must be between ${MIN_SCENE_DURATION_SECONDS} and ${MAX_SCENE_DURATION_SECONDS} seconds.`);
  }
  return duration;
}

export function timedSceneCount(audioDuration: number, sceneDuration: number): number {
  const duration = requireSceneDuration(sceneDuration);
  const count = Math.ceil(audioDuration / duration);
  if (count > MAX_TIMED_SCENES) {
    throw new Error(`This timing would create ${count.toLocaleString()} scenes. Increase the scene duration to keep the project at ${MAX_TIMED_SCENES.toLocaleString()} scenes or fewer.`);
  }
  return count;
}
