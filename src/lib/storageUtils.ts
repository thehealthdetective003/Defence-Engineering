import { AppState, SavedProject, FullProjectData } from '../types';

export const FACILITY_STORAGE_KEYS = {
  autosave: 'facility_engine_save',
  settings: 'facility_engine_settings',
  projects: 'facility_engine_projects',
  projectPrefix: 'facility_engine_project_',
} as const;
const PROJECTS_INDEX_KEY = FACILITY_STORAGE_KEYS.projects;
const PROJECT_PREFIX = FACILITY_STORAGE_KEYS.projectPrefix;

export const getAllProjects = (): SavedProject[] => {
  try {
    const raw = localStorage.getItem(PROJECTS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw).sort((a: SavedProject, b: SavedProject) => 
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  } catch (e) {
    console.error('Failed to parse projects index', e);
    return [];
  }
};

export const loadProject = (id: string): FullProjectData | null => {
  try {
    const raw = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as FullProjectData;
  } catch (e) {
    console.error(`Failed to load project ${id}`, e);
    return null;
  }
};

export const saveProject = (state: AppState): string => {
  const allProjects = getAllProjects();
  const id = state.id || crypto.randomUUID();
  const now = new Date().toISOString();
  
  const existingIndex = allProjects.findIndex(p => p.id === id);
  const existingFull = loadProject(id);
  
  const createdAt = existingFull?.createdAt || now;
  
  const fullData: FullProjectData = {
    ...state,
    id,
    savedAt: now,
    createdAt
  };
  
  const indexEntry: SavedProject = {
    id,
    name: state.topic?.topic?.facility || state.projectName || 'Untitled Facility Documentary',
    title: state.topic?.topic?.title || 'Untitled Facility Documentary',
    category: state.topic?.topic?.category || 'Uncategorized',
    phase: state.phase,
    sceneCount: state.visualPrompts.length,
    demoOnly: state.demoScenes.length > 0 && state.visualPrompts.length === 0,
    savedAt: now,
    createdAt
  };
  
  // Write full data
  try {
    localStorage.setItem(`${PROJECT_PREFIX}${id}`, JSON.stringify(fullData));
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      throw e;
    }
    throw e;
  }
  
  // Update index
  if (existingIndex > -1) {
    allProjects[existingIndex] = indexEntry;
  } else {
    allProjects.unshift(indexEntry);
  }
  
  localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(allProjects));
  
  return id;
};

export const deleteProject = (id: string) => {
  localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
  const allProjects = getAllProjects();
  const filtered = allProjects.filter(p => p.id !== id);
  localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(filtered));
};

export const calculateStorageUsage = () => {
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(PROJECT_PREFIX) || key === PROJECTS_INDEX_KEY || key === FACILITY_STORAGE_KEYS.settings || key === FACILITY_STORAGE_KEYS.autosave)) {
      const value = localStorage.getItem(key);
      if (value) {
        totalBytes += key.length + value.length;
      }
    }
  }
  
  const usedKb = totalBytes / 1024;
  const totalKb = 5120; // 5MB standard limit
  return {
    usedKb: Math.round(usedKb * 10) / 10,
    totalKb,
    percent: Math.min(100, (usedKb / totalKb) * 100)
  };
};
