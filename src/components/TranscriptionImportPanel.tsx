import { Dispatch, SetStateAction, useRef } from 'react';
import { CheckCircle2, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { AppState } from '../types';
import { useSettings } from './SettingsContext';
import { formatTimestamp, resetDownstreamForTiming } from '../lib/timedTranscript';
import { importTranscriptionJson } from '../lib/transcriptionImport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface Props { state: AppState; setState: Dispatch<SetStateAction<AppState>>; }
export function TranscriptionImportPanel({ state, setState }: Props) {
  const { settings } = useSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const transcript = state.voiceoverTranscription;
  const importFile = async (file: File) => {
    try {
      const imported = importTranscriptionJson(JSON.parse(await file.text()), file.name, settings.sceneDurationSeconds);
      setState(prev => ({ ...resetDownstreamForTiming(prev), masterVoiceoverScript: imported.text, voiceoverTranscription: imported } as AppState));
      toast.success(`Imported ${imported.words.length} timed words into ${imported.scenes.length} scenes.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not import transcription JSON.'); }
    finally { if (inputRef.current) inputRef.current.value = ''; }
  };
  const updateSceneText = (number: number, text: string) => setState(prev => {
    if (!prev.voiceoverTranscription) return prev;
    const scenes = prev.voiceoverTranscription.scenes.map(scene => scene.number === number ? { ...scene, text, silent: !text.trim() } : scene);
    const masterVoiceoverScript = scenes.map(scene => scene.text).filter(Boolean).join(' ');
    return { ...prev, phase: 2, masterVoiceoverScript, voiceoverTranscription: { ...prev.voiceoverTranscription, scenes, text: masterVoiceoverScript }, plannedScenes: [], sceneDirections: [], visualPrompts: [], demoScenes: [], demoSceneNumbers: [], demoState: 'idle' };
  });
  return <div className="inset-panel mb-2 space-y-4 rounded-2xl p-5 sm:p-6">
    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><FileJson className="h-5 w-5"/></div><div><h3 className="text-sm font-bold tracking-wide">Timestamped narration</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Required · English · word-level timestamps · automatically split into {settings.sceneDurationSeconds}s scenes</p></div></div>
    <div className="rounded-xl border border-border/45 bg-card/45 p-3.5 text-xs leading-5 text-muted-foreground">Upload pre-split JSON with <code className="text-primary">duration</code> and a <code className="text-primary">scenes</code> array containing <code>start</code>, <code>end</code>, and <code>text</code> or <code>voiceover</code>. Word-timestamp JSON remains supported.</div>
    <Button variant="outline" className="relative h-10 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"><FileJson className="mr-2 h-4 w-4"/>{transcript ? 'REPLACE TRANSCRIPTION JSON' : 'IMPORT TRANSCRIPTION JSON'}<input ref={inputRef} type="file" accept=".json,application/json" className="absolute inset-0 cursor-pointer opacity-0" onChange={event=>event.target.files?.[0]&&importFile(event.target.files[0])}/></Button>
    {transcript && <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[10px]"><Badge><CheckCircle2 className="h-3 w-3 mr-1"/>IMPORTED</Badge><Badge variant="outline">{transcript.audioFileName}</Badge><Badge variant="outline">{formatTimestamp(transcript.duration)}</Badge><Badge variant="outline">{transcript.scenes.length} scenes</Badge><Badge variant="outline">{transcript.words.length} words</Badge></div>
      <div className="scrollbar-thin max-h-[360px] space-y-2 overflow-y-auto pr-1">{transcript.scenes.map(scene=><div key={scene.number} className="grid items-start gap-3 rounded-xl border border-border/40 bg-card/45 p-3 sm:grid-cols-[110px_1fr]"><div className="font-mono text-[10px]"><div className="font-bold text-primary">SCENE {String(scene.number).padStart(3,'0')}</div><div className="mt-1 text-muted-foreground">{formatTimestamp(scene.start)}<br/>{formatTimestamp(scene.end)}</div></div><Textarea value={scene.text} placeholder="Silent VO window" onChange={event=>updateSceneText(scene.number,event.target.value)} className="min-h-[58px] text-xs"/></div>)}</div>
    </div>}
  </div>;
}
