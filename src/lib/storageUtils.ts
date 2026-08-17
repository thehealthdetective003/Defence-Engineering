import { AppState, FullProjectData, SavedProject, Settings } from '../types';

export const FACILITY_STORAGE_KEYS = {
  autosave: 'facility_engine_save',
  settings: 'facility_engine_settings',
  projects: 'facility_engine_projects',
  projectPrefix: 'facility_engine_project_',
} as const;

const DATABASE_NAME = 'defence_facility_engine';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';
const META_STORE = 'meta';
const ACTIVE_PROJECT_KEY = 'activeProjectId';
const SETTINGS_KEY = 'settings';
const MIGRATION_KEY = 'localStorageMigrationV1';

type MetaRecord<T = unknown> = { key: string; value: T };

export type StorageFailureKind = 'quota' | 'unavailable' | 'write' | 'read';

export class ProjectStorageError extends Error {
  constructor(
    message: string,
    public readonly kind: StorageFailureKind,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProjectStorageError';
  }
}

export interface StorageUsage {
  usedBytes: number;
  totalBytes: number;
  usedKb: number;
  totalKb: number;
  percent: number;
  source: 'browser' | 'project-data';
}

let databasePromise: Promise<IDBDatabase> | null = null;

export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof ProjectStorageError) return error.kind === 'quota';
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return error instanceof Error && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|storage.*full/i.test(error.message)
  );
}

function storageError(error: unknown, operation: 'read' | 'write'): ProjectStorageError {
  if (error instanceof ProjectStorageError) return error;
  if (isQuotaExceededError(error)) {
    return new ProjectStorageError('Browser storage is full. Your latest in-memory work is still available for export.', 'quota', error);
  }
  return new ProjectStorageError(
    operation === 'write'
      ? 'The project could not be saved to browser storage.'
      : 'The project could not be read from browser storage.',
    operation,
    error,
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Storage transaction was aborted.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new ProjectStorageError('IndexedDB is unavailable in this browser context.', 'unavailable'));
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(storageError(request.error, 'read'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new ProjectStorageError('Project storage is blocked by another open app tab.', 'unavailable'));
    };
  });

  return databasePromise;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeProject(raw: Partial<FullProjectData> & AppState, forcedId?: string): FullProjectData {
  const now = nowIso();
  return {
    ...raw,
    id: forcedId || raw.id || crypto.randomUUID(),
    createdAt: raw.createdAt || now,
    savedAt: raw.savedAt || now,
  } as FullProjectData;
}

export function projectByteSize(project: unknown): number {
  return new Blob([JSON.stringify(project)]).size;
}

export function summarizeProject(project: FullProjectData): SavedProject {
  return {
    id: project.id,
    name: project.topic?.topic?.facility || project.projectName || 'Untitled Facility Documentary',
    title: project.topic?.topic?.title || 'Untitled Facility Documentary',
    category: project.topic?.topic?.category || 'Uncategorized',
    phase: project.phase,
    sceneCount: project.visualPrompts.length,
    demoOnly: project.demoScenes.length > 0 && project.visualPrompts.length === 0,
    savedAt: project.savedAt,
    createdAt: project.createdAt,
    sizeBytes: projectByteSize(project),
  };
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readLegacyProjects(): { projects: FullProjectData[]; activeId: string | null; keys: string[] } {
  const projects = new Map<string, FullProjectData>();
  const keys: string[] = [];
  if (typeof localStorage === 'undefined') return { projects: [], activeId: null, keys };

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(FACILITY_STORAGE_KEYS.projectPrefix)) continue;
    const raw = safeParse<FullProjectData>(localStorage.getItem(key));
    if (!raw || typeof raw !== 'object' || !raw.projectName) continue;
    const id = raw.id || key.slice(FACILITY_STORAGE_KEYS.projectPrefix.length) || crypto.randomUUID();
    projects.set(id, normalizeProject(raw, id));
    keys.push(key);
  }

  const autosave = safeParse<AppState & Partial<FullProjectData>>(localStorage.getItem(FACILITY_STORAGE_KEYS.autosave));
  let activeId: string | null = null;
  if (autosave && typeof autosave === 'object' && autosave.projectName) {
    activeId = autosave.id || crypto.randomUUID();
    const existing = projects.get(activeId);
    projects.set(activeId, normalizeProject({ ...existing, ...autosave } as FullProjectData, activeId));
    keys.push(FACILITY_STORAGE_KEYS.autosave);
  }
  if (localStorage.getItem(FACILITY_STORAGE_KEYS.projects)) keys.push(FACILITY_STORAGE_KEYS.projects);

  return { projects: [...projects.values()], activeId, keys };
}

export async function initializeProjectStorage(): Promise<{ migratedProjects: number }> {
  const database = await openDatabase();
  try {
    const readTransaction = database.transaction(META_STORE, 'readonly');
    const readComplete = transactionComplete(readTransaction);
    const migrated = await requestResult(readTransaction.objectStore(META_STORE).get(MIGRATION_KEY)) as MetaRecord<boolean> | undefined;
    await readComplete;
    if (migrated?.value) return { migratedProjects: 0 };

    const legacy = readLegacyProjects();
    const transaction = database.transaction([PROJECT_STORE, META_STORE], 'readwrite');
    const complete = transactionComplete(transaction);
    const projectStore = transaction.objectStore(PROJECT_STORE);
    const metaStore = transaction.objectStore(META_STORE);
    legacy.projects.forEach(project => projectStore.put(project));
    if (legacy.activeId) metaStore.put({ key: ACTIVE_PROJECT_KEY, value: legacy.activeId });
    metaStore.put({ key: MIGRATION_KEY, value: true });
    await complete;

    legacy.keys.forEach(key => localStorage.removeItem(key));
    return { migratedProjects: legacy.projects.length };
  } catch (error) {
    throw storageError(error, 'write');
  }
}

export async function getAllProjects(): Promise<SavedProject[]> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const complete = transactionComplete(transaction);
    const records = await requestResult(transaction.objectStore(PROJECT_STORE).getAll()) as FullProjectData[];
    await complete;
    return records.map(summarizeProject).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (error) {
    throw storageError(error, 'read');
  }
}

export async function loadProject(id: string): Promise<FullProjectData | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const complete = transactionComplete(transaction);
    const record = await requestResult(transaction.objectStore(PROJECT_STORE).get(id)) as FullProjectData | undefined;
    await complete;
    return record || null;
  } catch (error) {
    throw storageError(error, 'read');
  }
}

export async function loadActiveProject(): Promise<FullProjectData | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(META_STORE, 'readonly');
    const complete = transactionComplete(transaction);
    const active = await requestResult(transaction.objectStore(META_STORE).get(ACTIVE_PROJECT_KEY)) as MetaRecord<string> | undefined;
    await complete;
    return active?.value ? loadProject(active.value) : null;
  } catch (error) {
    throw storageError(error, 'read');
  }
}

export async function saveProject(state: AppState): Promise<FullProjectData> {
  try {
    const database = await openDatabase();
    const id = state.id || crypto.randomUUID();
    const existing = state.id ? await loadProject(state.id) : null;
    const now = nowIso();
    const fullData: FullProjectData = {
      ...state,
      id,
      savedAt: now,
      createdAt: existing?.createdAt || now,
    };

    const transaction = database.transaction([PROJECT_STORE, META_STORE], 'readwrite');
    const complete = transactionComplete(transaction);
    transaction.objectStore(PROJECT_STORE).put(fullData);
    transaction.objectStore(META_STORE).put({ key: ACTIVE_PROJECT_KEY, value: id });
    await complete;
    return fullData;
  } catch (error) {
    throw storageError(error, 'write');
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction([PROJECT_STORE, META_STORE], 'readwrite');
    const complete = transactionComplete(transaction);
    transaction.objectStore(PROJECT_STORE).delete(id);
    const metaStore = transaction.objectStore(META_STORE);
    const active = await requestResult(metaStore.get(ACTIVE_PROJECT_KEY)) as MetaRecord<string> | undefined;
    if (active?.value === id) metaStore.delete(ACTIVE_PROJECT_KEY);
    await complete;
  } catch (error) {
    throw storageError(error, 'write');
  }
}

export async function clearActiveProject(): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(META_STORE, 'readwrite');
    const complete = transactionComplete(transaction);
    transaction.objectStore(META_STORE).delete(ACTIVE_PROJECT_KEY);
    await complete;
  } catch (error) {
    throw storageError(error, 'write');
  }
}

export async function loadSettings(): Promise<Partial<Settings> | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(META_STORE, 'readonly');
    const complete = transactionComplete(transaction);
    const record = await requestResult(transaction.objectStore(META_STORE).get(SETTINGS_KEY)) as MetaRecord<Partial<Settings>> | undefined;
    await complete;
    if (record?.value) return record.value;
    return safeParse<Partial<Settings>>(typeof localStorage === 'undefined' ? null : localStorage.getItem(FACILITY_STORAGE_KEYS.settings));
  } catch (error) {
    throw storageError(error, 'read');
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(META_STORE, 'readwrite');
    const complete = transactionComplete(transaction);
    transaction.objectStore(META_STORE).put({ key: SETTINGS_KEY, value: settings });
    await complete;
    if (typeof localStorage !== 'undefined') localStorage.removeItem(FACILITY_STORAGE_KEYS.settings);
  } catch (error) {
    throw storageError(error, 'write');
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function calculateStorageUsage(): Promise<StorageUsage> {
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const totalBytes = estimate.quota || 0;
      return {
        usedBytes,
        totalBytes,
        usedKb: Math.round((usedBytes / 1024) * 10) / 10,
        totalKb: Math.round((totalBytes / 1024) * 10) / 10,
        percent: totalBytes ? Math.min(100, (usedBytes / totalBytes) * 100) : 0,
        source: 'browser',
      };
    }

    const projects = await getAllProjects();
    const usedBytes = projects.reduce((total, project) => total + (project.sizeBytes || 0), 0);
    return {
      usedBytes,
      totalBytes: 0,
      usedKb: Math.round((usedBytes / 1024) * 10) / 10,
      totalKb: 0,
      percent: 0,
      source: 'project-data',
    };
  } catch (error) {
    throw storageError(error, 'read');
  }
}
