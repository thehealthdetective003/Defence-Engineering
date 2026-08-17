import type { AppState } from '../types';

let latestSnapshot: AppState | null = null;

export function updateRecoverySnapshot(state: AppState) {
  latestSnapshot = state;
}

export function downloadRecoverySnapshot(state: AppState | null = latestSnapshot): boolean {
  if (!state) return false;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const projectName = state.topic?.topic?.title || state.projectName || 'Facility_Project';
  link.href = url;
  link.download = `${projectName.replace(/\s+/g, '_')}_Recovery.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
