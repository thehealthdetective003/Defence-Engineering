import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Sun, CheckCircle2, FilePlus, FolderOpen, AlertCircle, FileUp, FileDown, Wrench, Shield, MapPinned, Workflow, WandSparkles, ChevronDown, DatabaseZap, CircleGauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { AppState, PhaseType } from './types';
import { Phase1Topic } from './components/Phase1Topic';
import { Phase2Script } from './components/Phase2Script';
import { Phase4Visuals } from './components/Phase4Visuals';
import { SettingsPanel } from './components/SettingsPanel';
import { useSettings } from './components/SettingsContext';
import { ProjectLibrary } from './components/ProjectLibrary';
import { clearActiveProject, initializeProjectStorage, isQuotaExceededError, loadActiveProject, loadProject, requestPersistentStorage, saveProject } from './lib/storageUtils';
import { toast } from 'sonner';
import { resplitTranscription, resetDownstreamForTiming } from './lib/timedTranscript';
import { migrateProject, projectSceneDuration } from './lib/projectMigration';
import { downloadRecoverySnapshot, updateRecoverySnapshot } from './lib/recoveryVault';
const PHASES = [
  { id: 1, label: 'FACILITY BRIEF', shortLabel: 'Brief', description: 'Load and verify the authoritative facility handoff', icon: MapPinned },
  { id: 2, label: 'SCENE DIRECTION', shortLabel: 'Direction', description: 'Align timestamped narration with construction visuals', icon: Workflow },
  { id: 3, label: 'PROMPT STUDIO', shortLabel: 'Prompts', description: 'Compile final facility-native generation prompts', icon: WandSparkles },
];
export const INITIAL_STATE: AppState = {
  projectSchemaVersion: 11,
  id: undefined,
  projectName: 'Untitled Facility Documentary',
  projectFormat: 'facility-construction',
  phase: 1,
  topic: null,
  plannedScenes: [],
  sceneDirections: [],
  masterVoiceoverScript: '',
  voiceoverTranscription: null,
  t2vPromptProfile: 'omni-flash',
  visualPrompts: [],
  demoState: 'idle',
  demoScenes: [],
  demoSceneNumbers: [],
};

const createInitialState = (): AppState => ({ ...INITIAL_STATE, id: crypto.randomUUID() });
type SaveStatus = 'loading' | 'saving' | 'saved' | 'error';

export default function App() {
  const { theme, setTheme } = useTheme();
  const { settings, setSettings, isLoaded } = useSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'new' | 'load', id?: string } | null>(null);
  const [showSavedFlash, setShowSavedFlash] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [profileConflict, setProfileConflict] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setInternalState] = useState<AppState>(createInitialState);
  const revisionRef = useRef(0);
  const lastPersistedRevisionRef = useRef(0);
  const stateRef = useRef(state);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  stateRef.current = state;
  updateRecoverySnapshot(state);

  const setState = useCallback<Dispatch<SetStateAction<AppState>>>((action) => {
    revisionRef.current += 1;
    setSaveStatus('saving');
    setInternalState(action);
  }, []);
  const activePhase = PHASES.find((p) => p.id === state.phase);
  const isDirty = saveStatus === 'saving' || saveStatus === 'error';

  const persistSnapshot = useCallback(async (snapshot: AppState, revision: number): Promise<AppState> => {
    setSaveStatus('saving');
    const operation = saveQueueRef.current.then(async () => {
      const saved = await saveProject(snapshot);
      const persistedState = saved as AppState;
      lastPersistedRevisionRef.current = Math.max(lastPersistedRevisionRef.current, revision);
      if (revision === revisionRef.current) {
        stateRef.current = persistedState;
        setInternalState(persistedState);
        setSaveStatus('saved');
        setStorageError(null);
        setShowSavedFlash(true);
        window.setTimeout(() => setShowSavedFlash(false), 1500);
      }
      return persistedState;
    });
    saveQueueRef.current = operation.then(() => undefined, () => undefined);
    try {
      return await operation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The project could not be saved.';
      setSaveStatus('error');
      setStorageError(message);
      console.error('Project checkpoint failed', error);
      throw error;
    }
  }, []);

  const checkpointState = useCallback(async (nextState: AppState): Promise<AppState> => {
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    stateRef.current = nextState;
    updateRecoverySnapshot(nextState);
    setInternalState(nextState);
    return persistSnapshot(nextState, revision);
  }, [persistSnapshot]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      await persistSnapshot(stateRef.current, revisionRef.current);
      return true;
    } catch (error) {
      if (isQuotaExceededError(error)) toast.error('Browser storage is full. Download the recovery JSON before clearing space.');
      else toast.error('Project could not be saved. Download a recovery copy before reloading.');
      return false;
    }
  }, [persistSnapshot]);

  useEffect(() => {
    if (!isHydrated) return;
    setState(prev => {
      const transcript = prev.voiceoverTranscription;
      if (!transcript || transcript.sceneDurationSeconds === settings.sceneDurationSeconds) return prev;
      const reset = resetDownstreamForTiming(prev);
      return { ...reset, voiceoverTranscription: resplitTranscription(transcript, settings.sceneDurationSeconds) } as AppState;
    });
  }, [isHydrated, settings.sceneDurationSeconds, state.voiceoverTranscription?.sceneDurationSeconds, setState]);
  // Smooth scroll to top when phase changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.phase]);
  // Autofill project name from the facility identity.
  useEffect(() => {
    if (state.topic?.topic?.facility && state.projectName === 'Untitled Facility Documentary') {
      setState(s => ({ ...s, projectName: s.topic?.topic?.facility || 'Untitled Facility Documentary' }));
    }
  }, [state.topic]);
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const restoreWorkspace = async () => {
      try {
        const migrationResult = await initializeProjectStorage();
        void requestPersistentStorage();
        const saved = await loadActiveProject();
        if (cancelled) return;
        if (saved) {
          const duration = projectSceneDuration(saved, settings.sceneDurationSeconds);
          const migration = migrateProject(saved, INITIAL_STATE, duration);
          if (!migration.state) throw new Error(migration.error || 'The saved project is not supported.');
          const restored = { ...migration.state, id: saved.id };
          setSettings(previous => ({ ...previous, sceneDurationSeconds: duration }));
          stateRef.current = restored;
          setInternalState(restored);
          updateRecoverySnapshot(restored);
          await saveProject(restored);
          if (migration.message) toast.info(migration.message);
        }
        if (migrationResult.migratedProjects > 0) toast.success(`Migrated ${migrationResult.migratedProjects} project${migrationResult.migratedProjects === 1 ? '' : 's'} to resilient storage.`);
        if (!cancelled) setSaveStatus('saved');
      } catch (error) {
        console.error('Failed to restore project workspace', error);
        if (!cancelled) {
          setStorageError(error instanceof Error ? error.message : 'Project storage is unavailable.');
          setSaveStatus('error');
        }
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };
    void restoreWorkspace();
    return () => { cancelled = true; };
  }, [isLoaded, settings.sceneDurationSeconds, setSettings]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isHydrated || revisionRef.current <= lastPersistedRevisionRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const snapshot = state;
    const revision = revisionRef.current;
    saveTimeoutRef.current = setTimeout(() => {
      if (revision <= lastPersistedRevisionRef.current) return;
      void persistSnapshot(snapshot, revision).catch(() => undefined);
    }, 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, isHydrated, persistSnapshot]);

  useEffect(() => {
    if (!state.id || typeof BroadcastChannel === 'undefined') return;
    const tabId = crypto.randomUUID();
    const channel = new BroadcastChannel('defence-facility-engine-project-lock');
    let conflictTimer: number | undefined;
    setProfileConflict(false);
    const markConflict = () => {
      setProfileConflict(true);
      if (conflictTimer) window.clearTimeout(conflictTimer);
      conflictTimer = window.setTimeout(() => setProfileConflict(false), 5000);
    };
    channel.onmessage = event => {
      const message = event.data as { type?: string; projectId?: string; tabId?: string };
      if (message.projectId !== state.id || message.tabId === tabId) return;
      if (message.type === 'closed') {
        setProfileConflict(false);
        return;
      }
      markConflict();
      if (message.type === 'opened') channel.postMessage({ type: 'present', projectId: state.id, tabId });
    };
    const announceClosed = () => channel.postMessage({ type: 'closed', projectId: state.id, tabId });
    window.addEventListener('pagehide', announceClosed);
    channel.postMessage({ type: 'opened', projectId: state.id, tabId });
    const heartbeat = window.setInterval(() => channel.postMessage({ type: 'present', projectId: state.id, tabId }), 2000);
    return () => {
      window.removeEventListener('pagehide', announceClosed);
      window.clearInterval(heartbeat);
      if (conflictTimer) window.clearTimeout(conflictTimer);
      announceClosed();
      channel.close();
    };
  }, [state.id]);

  const resetToNewProject = async () => {
    try { await clearActiveProject(); } catch (error) { console.error('Failed to clear active project pointer', error); }
    const resetState = createInitialState();
    revisionRef.current += 1;
    stateRef.current = resetState;
    setInternalState(resetState);
    setSaveStatus('saving');
    setStorageError(null);
  };

  const handleNewProject = () => {
    if (isDirty && state.topic) {
      setPendingAction({ type: 'new' });
    } else {
      void resetToNewProject();
    }
  };
  const confirmNewProject = async (saveBefore: boolean) => {
    if (saveBefore && !(await handleSave())) return;
    await resetToNewProject();
    setPendingAction(null);
  };
  const handleLoadProject = (id: string) => {
    if (isDirty && state.topic) {
      setPendingAction({ type: 'load', id });
    } else {
      void executeLoad(id);
    }
  };
  const executeLoad = async (id: string) => {
    try {
      const loaded = await loadProject(id);
      if (!loaded) throw new Error('Project record was not found.');
      const duration = projectSceneDuration(loaded, settings.sceneDurationSeconds);
      const migration = migrateProject(loaded, INITIAL_STATE, duration);
      const merged = migration.state;
      if (!merged) {
        toast.error(migration.error || 'This is not a supported facility-construction project.');
        setPendingAction(null);
        return;
      }
      const restored = { ...merged, id: loaded.id };
      revisionRef.current += 1;
      stateRef.current = restored;
      setInternalState(restored);
      setSettings(previous => ({ ...previous, sceneDurationSeconds: duration }));
      await persistSnapshot(restored, revisionRef.current);
      toast.success(`Loaded: ${restored.topic?.topic?.title || restored.projectName}`);
      if (migration.message) toast.info(migration.message);
      setIsLibraryOpen(false);
    } catch (error) {
      console.error('Failed to load project', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load project');
    }
    setPendingAction(null);
  };
  const isPhaseComplete = (phaseId: number) => {
    switch (phaseId) {
      case 1: return state.topic !== null;
      case 2: return state.sceneDirections.length > 0 && state.sceneDirections.length === state.voiceoverTranscription?.scenes.length;
      case 3: return state.visualPrompts.length > 0 && state.visualPrompts.length === state.sceneDirections.length;
      default: return false;
    }
  };
  const completedPhaseCount = PHASES.filter(phase => isPhaseComplete(phase.id)).length;
  const workflowProgress = Math.round((completedPhaseCount / PHASES.length) * 100);
  const ActivePhaseIcon = activePhase?.icon || MapPinned;
  if (!isLoaded || !isHydrated) return null;
  return (
    <div className="facility-shell min-h-screen bg-background text-foreground font-sans flex flex-col relative">
      <SettingsPanel state={state} setState={setState} open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ProjectLibrary 
        open={isLibraryOpen} 
        onOpenChange={setIsLibraryOpen} 
        currentState={state}
        onLoadProject={handleLoadProject}
        onNewProject={handleNewProject}
      />
      {/* Confirmation Dialog */}
      <Dialog open={pendingAction !== null} onOpenChange={(o) => !o && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save progress?</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'new' 
                ? "You're about to start a new project. Would you like to save your current work first?"
                : "You have unsaved changes. Would you like to save before loading the selected project?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="default"
              className="bg-primary text-black font-bold"
              onClick={async () => {
                if (pendingAction?.type === 'new') await confirmNewProject(true);
                else if (pendingAction?.id) {
                   if (await handleSave()) await executeLoad(pendingAction.id);
                }
              }}
            >
              SAVE & CONTINUE
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                if (pendingAction?.type === 'new') void confirmNewProject(false);
                else if (pendingAction?.id) void executeLoad(pendingAction.id);
              }}
            >
              DISCARD & CONTINUE
            </Button>
            <Button variant="ghost" onClick={() => setPendingAction(null)}>CANCEL</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {storageError && (
        <div className="z-50 flex flex-wrap items-center justify-center gap-3 bg-red-600 p-3 text-sm font-bold text-white">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>SAVE FAILED · YOUR CURRENT WORK IS STILL AVAILABLE IN MEMORY.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 hover:bg-white/20 text-white h-7 px-3 text-xs"
            onClick={() => downloadRecoverySnapshot(state)}
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> DOWNLOAD RECOVERY
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 hover:bg-white/20 text-white h-7 px-3 text-xs"
            onClick={() => setIsLibraryOpen(true)}
          >
            OPEN LIBRARY →
          </Button>
        </div>
      )}
      {profileConflict && (
        <div className="z-40 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" /> This project is open in another tab. Close one tab to prevent competing edits.
        </div>
      )}
      <header className="app-header sticky top-0 z-20 border-b border-border/40">
        <div className="mx-auto flex h-[76px] w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-extrabold tracking-[0.08em] text-foreground sm:text-base"><span className="sm:hidden">FACILITY ENGINE</span><span className="hidden sm:inline">DEFENCE FACILITY ENGINE</span></span>
                <Badge variant="outline" className="hidden border-primary/25 bg-primary/8 font-mono text-[9px] text-primary xl:inline-flex">STUDIO</Badge>
              </div>
              <div className="mt-0.5 hidden items-center gap-2 font-mono text-[10px] text-muted-foreground sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${saveStatus === 'error' ? 'bg-red-500' : isDirty ? 'bg-amber-400' : 'bg-primary'} ${saveStatus === 'saved' ? 'status-pulse' : ''}`} />
                <span className="truncate max-w-[150px] sm:max-w-[270px]">{state.topic?.topic?.facility || state.projectName}</span>
                <span className="hidden text-muted-foreground/50 sm:inline">·</span>
                <span className="hidden uppercase tracking-wider sm:inline">{saveStatus === 'error' ? 'Save failed · recovery available' : saveStatus === 'saving' ? 'Saving checkpoint' : 'Saved to resilient storage'}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button 
              id="projects-drawer-trigger"
              variant="outline"
              size="sm" 
              onClick={() => setIsLibraryOpen(true)} 
              className="h-9 border-border/60 bg-card/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            >
              <FolderOpen className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Library</span>
            </Button>
            
            <Button 
              id="new-project-button-header"
              variant="ghost"
              size="sm" 
              onClick={handleNewProject} 
              className="hidden h-9 text-muted-foreground hover:text-foreground xl:flex"
            >
              <FilePlus className="h-4 w-4 mr-1.5" />
              New Draft
            </Button>
            {/* IMPORT PROJECT (LOAD) */}
            <Button
              id="load-project-file-header"
              variant="ghost"
              size="sm"
              className="relative hidden h-9 text-xs text-muted-foreground hover:text-foreground lg:flex"
            >
              <FileUp className="h-4 w-4 mr-1.5" />
              LOAD PROJECT
              <input 
                type="file" 
                accept=".json" 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    try {
                      const importedData = JSON.parse(event.target?.result as string);
                      
                      // Validation: check for the core fields of AppState
                      if (importedData && typeof importedData === 'object' && 'phase' in importedData) {
                        if (typeof importedData.phase === 'number' && 'projectName' in importedData) {
                          const duration = projectSceneDuration(importedData, settings.sceneDurationSeconds);
                          const migration = migrateProject(importedData, INITIAL_STATE, duration);
                          const merged = migration.state;
                          if (!merged) {
                            toast.error(migration.error || 'Unsupported project format. Only facility-construction projects can be loaded.');
                            return;
                          }
                          setSettings(previous => ({ ...previous, sceneDurationSeconds: duration }));
                          await checkpointState({ ...merged, id: merged.id || crypto.randomUUID() });
                          toast.success("Project file loaded and saved to resilient storage.");
                          if (migration.message) toast.info(migration.message);
                        } else {
                          toast.error("Invalid project file format");
                        }
                      } else {
                        toast.error("File is not a valid Facility Engine project");
                      }
                    } catch (error) {
                      toast.error("Failed to parse project file");
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = ''; // Reset file input
                }}
              />
            </Button>
            {/* EXPORT PROJECT (SAVE) */}
            <Button 
              id="save-project-file-header"
              variant="default"
              size="sm" 
              onClick={() => {
                const data = JSON.stringify(state, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(state.topic?.topic?.title || state.projectName || 'Facility_Documentary').replace(/\s+/g, '_')}_FacilityEngine.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Project JSON downloaded successfully");
              }} 
              className="hidden h-9 text-xs font-semibold shadow-[0_8px_22px_hsl(var(--primary)/0.18)] md:flex"
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              SAVE PROJECT
            </Button>
            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
            <Button
              id="theme-toggle"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* TOOLBOX TRIGGER */}
            <Button
              id="settings-trigger"
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/18 hover:text-primary"
              title="Facility Toolbox"
            >
              <Wrench className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="relative z-[1] mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-6 flex flex-col justify-between gap-5 border-b border-border/50 pb-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <div className="section-kicker mb-3 flex items-center gap-2"><ActivePhaseIcon className="h-3.5 w-3.5"/> Documentary workspace · Phase 0{activePhase?.id}</div>
            <h1 className="display-title text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-[2.75rem]">{activePhase?.label}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{activePhase?.description}</p>
          </div>
          <div className="flex min-w-[230px] items-center gap-4 rounded-2xl border border-border/55 bg-card/45 px-4 py-3 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary"><CircleGauge className="h-5 w-5"/></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>Workflow</span><span>{workflowProgress}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${workflowProgress}%`}}/></div>
            </div>
          </div>
        </section>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="surface-panel sticky top-[100px] rounded-[22px] p-3">
              <div className="px-3 pb-2 pt-2"><div className="section-kicker text-muted-foreground">Production route</div></div>
              <nav className="space-y-1.5" aria-label="Documentary workflow">
                {PHASES.map(phase => {
                  const PhaseIcon = phase.icon;
                  const active = state.phase === phase.id;
                  const completed = isPhaseComplete(phase.id);
                  return <button key={phase.id} type="button" data-active={active} onClick={()=>setState(previous=>({...previous,phase:phase.id as PhaseType}))} className="phase-nav-item w-full rounded-xl px-3 py-3.5 text-left">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active?'bg-primary text-primary-foreground':'bg-muted/70 text-muted-foreground'}`}><PhaseIcon className="h-4 w-4"/></div>
                      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className={`font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${active?'text-primary':'text-foreground'}`}>0{phase.id} · {phase.shortLabel}</span>{completed&&<CheckCircle2 className="h-3.5 w-3.5 text-primary"/>}</div><p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{phase.description}</p></div>
                    </div>
                  </button>;
                })}
              </nav>
              <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold"><DatabaseZap className="h-4 w-4 text-primary"/> Local-first workspace</div>
                <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Facility data, timing, directions, and prompts stay organized inside this project.</p>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="surface-panel mb-4 rounded-2xl p-2 lg:hidden">
              <button onClick={()=>setIsStepperOpen(open=>!open)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left">
                <div><div className="section-kicker">Phase 0{activePhase?.id}</div><div className="mt-1 text-sm font-semibold">{activePhase?.label}</div></div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isStepperOpen?'rotate-180':''}`}/>
              </button>
              {isStepperOpen&&<div className="grid gap-1 border-t border-border/40 pt-2 sm:grid-cols-3">{PHASES.map(phase=>{const PhaseIcon=phase.icon;return <button key={phase.id} onClick={()=>setState(previous=>({...previous,phase:phase.id as PhaseType}))} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${state.phase===phase.id?'bg-primary/12 text-primary':'text-muted-foreground hover:bg-muted/50'}`}><PhaseIcon className="h-4 w-4"/><span>{phase.shortLabel}</span>{isPhaseComplete(phase.id)&&<CheckCircle2 className="ml-auto h-3.5 w-3.5"/>}</button>})}</div>}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={state.phase} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.22}}>
                <Card className="surface-panel relative min-h-[440px] overflow-hidden rounded-[24px] border-0 bg-transparent py-0 ring-0 lg:min-h-[540px]">
                  <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-accent/80"/>
                  <CardContent className="p-5 sm:p-7 lg:p-8">
                    {activePhase?.id===1?<Phase1Topic state={state} setState={setState}/>:activePhase?.id===2?<Phase2Script state={state} setState={setState} checkpointState={checkpointState}/>:activePhase?.id===3?<Phase4Visuals state={state} setState={setState} checkpointState={checkpointState}/>:null}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </main>
      {/* Persistent Saved Indicator */}
      <AnimatePresence>
        {showSavedFlash && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="surface-panel fixed bottom-6 right-6 z-50 rounded-full px-3 py-1.5"
          >
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Saved
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
