import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Download, Copy, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, ArrowRight, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { AppState, TopicBrief } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn, copyToClipboard } from '@/lib/utils';
import { validateAdaptiveBrief, validateAdaptiveWarnings, getLifecycleStageCount, getNegativePromptGlobal } from '../lib/adaptiveSchema';
import { StandardPreview } from './previews/StandardPreview';
import { useSettings } from './SettingsContext';
import { DEFAULT_FACILITY_HANDOFF_TEMPLATE, facilityHandoffTemplatePrompt, normalizeFacilityHandoff } from '../lib/productionTemplate';
import { HandoffValidationResult, validateVisualProductionHandoff } from '../lib/handoffValidation';
interface Phase1TopicProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}
export function Phase1Topic({ state, setState }: Phase1TopicProps) {
  const { settings } = useSettings();
  const activeFacilityTemplate = settings.facilityHandoffTemplate || DEFAULT_FACILITY_HANDOFF_TEMPLATE;
  const standardBlankTemplate = JSON.stringify(activeFacilityTemplate, null, 2);
  const [jsonInput, setJsonInput] = useState('');
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [showPasteEditor, setShowPasteEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [parsedBrief, setParsedBrief] = useState<TopicBrief | null>(null);
  const [validationResult, setValidationResult] = useState<HandoffValidationResult | null>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (isValid && parsedBrief) {
          handleLockTopic();
        } else {
          handleValidate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isValid, parsedBrief, jsonInput]);
  useEffect(() => {
    if (state.topic && !jsonInput) {
      setJsonInput(JSON.stringify(state.topic, null, 2));
      setParsedBrief(state.topic);
      const result = validateVisualProductionHandoff(state.topic._production_handoff || state.topic);
      setValidationResult(result);
      setIsValid(result.valid);
    } else if (!state.topic && !jsonInput) {
      setJsonInput(standardBlankTemplate);
    }
  }, [state.topic, jsonInput, standardBlankTemplate]);
  const handleDownloadTemplate = () => {
    const template = standardBlankTemplate;
    const blob = new Blob([template], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facility-construction_handoff_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };
  const handleCopyPrompt = async () => {
    const promptText = facilityHandoffTemplatePrompt(activeFacilityTemplate);
    const success = await copyToClipboard(promptText);
    if (success) {
      toast.success('Research prompt copied to clipboard');
    } else {
      toast.error('Copy failed. Please copy manually.');
    }
  };
  const handleImportBrief = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setJsonInput(JSON.stringify(parsed, null, 2));
      setShowPasteEditor(true);
      const result = validateVisualProductionHandoff(parsed);
      setValidationResult(result);
      setIsValid(false); setParsedBrief(null); setError(null); setWarnings([]);
      if (result.valid) toast.success(`${result.status} imported. Validate and load it to continue.`);
      else {
        setError('Invalid facility handoff JSON. Fix the listed errors before loading it.');
        toast.error('Invalid facility handoff JSON. The current project was not changed.');
      }
    } catch {
      setValidationResult(validateVisualProductionHandoff(null));
      setError('Invalid JSON file. Check its syntax and try again.');
    }
  };
  const handleValidate = () => {
    setError(null);
    setWarnings([]);
    setIsValid(false);
    setParsedBrief(null);
    setValidationResult(null);
    if (!jsonInput.trim()) {
      setError('Please paste some JSON first.');
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      const result = validateVisualProductionHandoff(parsed);
      setValidationResult(result);
      if (!result.valid) {
        setError('Invalid facility handoff JSON. Fix the listed schema or reference errors before loading it.');
        return;
      }
      const normalized = normalizeFacilityHandoff(parsed);
      const missing = validateAdaptiveBrief(normalized);
      const adaptiveWarnings = validateAdaptiveWarnings(normalized);
      
      if (missing.length > 0) {
        setWarnings([...missing.map(item => `Missing: ${item}`), ...adaptiveWarnings]);
        // We still allow it if it's valid JSON, but user needs to be aware
        setParsedBrief(normalized as TopicBrief);
        setIsValid(true);
      } else {
        setWarnings(adaptiveWarnings);
        setParsedBrief(normalized as TopicBrief);
        setIsValid(true);
      }
    } catch (e) {
      setValidationResult(validateVisualProductionHandoff(null));
      setError('Invalid JSON. Check your brackets and quotes.');
    }
  };
  const handleLockTopic = () => {
    if (!parsedBrief) return;
    
    setState((prev) => ({
      ...prev,
      topic: parsedBrief,
      masterVoiceoverScript: parsedBrief.master_voiceover_script || '',
      projectName: parsedBrief.topic?.facility || parsedBrief.topic?.title || "Untitled",
      plannedScenes: [], sceneDirections: [], visualPrompts: [], demoScenes: [], demoSceneNumbers: [], demoState: 'idle',
      phase: 2,
    }));
  };
  return (
    <div className="flex h-full w-full flex-col space-y-6">
      {/* 1. TOP SECTION - Instructions */}
      <Collapsible
        open={isHowToOpen}
        onOpenChange={setIsHowToOpen}
        className="inset-panel overflow-hidden rounded-2xl"
      >
        <CollapsibleTrigger className="flex h-auto w-full items-center justify-between p-4 outline-none transition-all hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="section-kicker">Quick start guide</span>
          {isHowToOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Prepare your topic brief externally using an LLM (ChatGPT, Gemini, etc.), 
            then import the completed JSON here. The app will read it and pre-fill all 
            phases automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadTemplate}
              className="h-8 border-border bg-card/50 font-mono text-[10px] hover:border-primary/30 hover:bg-primary/5"
            >
              <Download className="h-3 w-3 mr-2" />
              Download blank template
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyPrompt}
              className="h-8 border-border bg-card/50 font-mono text-[10px] hover:border-primary/30 hover:bg-primary/5"
            >
              <Copy className="h-3 w-3 mr-2" />
              Copy LLM prompt
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {/* 2. MIDDLE SECTION - JSON Paste */}
      <div className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
          <Button className="relative min-h-14 h-auto whitespace-normal px-4 text-center text-xs font-bold tracking-[0.08em] shadow-[0_14px_32px_hsl(var(--primary)/0.18)] sm:text-sm sm:tracking-[0.12em]">
            <FileJson className="h-5 w-5 mr-2"/><span className="sm:hidden">IMPORT HANDOFF JSON</span><span className="hidden sm:inline">IMPORT FACILITY HANDOFF JSON</span>
            <input type="file" accept=".json,application/json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={event=>{const file=event.target.files?.[0]; if(file) handleImportBrief(file); event.currentTarget.value='';}}/>
          </Button>
          <Button variant="outline" className="h-14 border-border/70 bg-card/40 px-5 hover:border-primary/30 hover:bg-primary/5" onClick={()=>setShowPasteEditor(value=>!value)}>{showPasteEditor?'HIDE JSON EDITOR':'PASTE JSON (OPTIONAL)'}</Button>
        </div>
        <div className="space-y-2 block">
          {/* Left Column: Existing JSON Blueprint Box */}
          <div className="space-y-2 block">
            {showPasteEditor && <><label className="section-kicker">
              PROJECT JSON BLUEPRINT [IMPORT REVIEW / OPTIONAL PASTE]
            </label>
            <div className="relative block">
              <Textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setIsValid(false);
                  setParsedBrief(null);
                  setError(null);
                  setWarnings([]);
                  setValidationResult(null);
                }}
                placeholder="{ paste your completed topic brief JSON here... }"
                className="code-surface scrollbar-thin h-[500px] resize-none overflow-y-auto rounded-xl p-4 font-mono text-xs focus-visible:border-primary/50 focus-visible:ring-primary/35"
              />
              <div className="pointer-events-none absolute right-3 top-3 text-primary/25">
                <FileJson className="h-8 w-8" />
              </div>
            </div></>}
          </div>
        </div>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs font-mono"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
        {validationResult && (
          <div className={cn(
            'rounded-md border p-3 font-mono text-xs',
            validationResult.valid
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}>
            <div className="font-bold uppercase tracking-wider">{validationResult.status}</div>
            {!validationResult.valid && validationResult.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationResult.errors.map((item, index) => (
                  <li key={`${item.path}-${item.code}-${index}`}><span className="font-bold">{item.path}</span>: {item.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {warnings.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-500 text-xs font-mono space-y-1"
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertTriangle className="h-4 w-4" />
              REVIEW WARNINGS
            </div>
            <ul className="list-disc list-inside grid grid-cols-2 gap-x-4">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </motion.div>
        )}
        <div className="relative">
          <Button
            onClick={handleValidate}
            className={cn(
              "w-full h-14 font-bold text-lg tracking-widest transition-all duration-300",
              isValid 
                ? "bg-green-600 hover:bg-green-700 text-white" 
                : "bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_14px_32px_hsl(var(--primary)/0.18)]"
            )}
          >
            {isValid ? (
              <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                VALIDATED
              </motion.div>
            ) : (
              'VALIDATE & LOAD'
            )}
          </Button>
          <div className="absolute -bottom-5 inset-x-0 text-center text-[10px] text-muted-foreground/60 hidden md:block">
            Shortcut: Ctrl+Enter
          </div>
        </div>
      </div>
      {/* 3. BOTTOM SECTION - Preview Panel */}
      <AnimatePresence>
        {isValid && parsedBrief && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5">
                    {validationResult?.status.toUpperCase() || 'VALID FACILITY'}
                  </Badge>
                  {validationResult?.format === 'facility' && (() => {
                    const source = parsedBrief._production_handoff as any;
                    const chapters = source?.visual_story_plan?.chapters || [];
                    const beatCount = chapters.reduce((total: number, chapter: any) => total + (chapter.visual_beats?.length || 0), 0);
                    const claims = chapters.flatMap((chapter:any)=>chapter.visual_beats||[]).map((beat:any)=>beat.facility_claim_status);
                    const siteTruth = claims.includes('EXACT_SITE_VERIFIED') ? 'EXACT SITE VERIFIED' : claims.includes('FACILITY_TYPE_CORROBORATED') ? 'FACILITY TYPE CORROBORATED' : claims.includes('CONTEXTUAL_DEFENCE_INFRASTRUCTURE') ? 'CONTEXTUAL INFRASTRUCTURE' : 'GENERIC / NON-IDENTIFYING';
                    const facilityStatus=source?.facility?.facility_status||'UNKNOWN';
                    const layoutTruth=source?.site_dimensions_and_spatial_relations?.layout_claim_status||'UNKNOWN';
                    const sensitive=facilityStatus==='ACTIVE_PUBLICLY_DOCUMENTED';
                    return <>
                      <Badge variant="outline" className="font-mono text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5">V{validationResult.version}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5">{chapters.length} CHAPTERS</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5">{beatCount} BEATS</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5">{source?.environments?.length || 0} ENVIRONMENTS</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/5">FACILITY STATUS · {facilityStatus.replaceAll('_',' ')}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-cyan-500/30 text-cyan-400 bg-cyan-500/5">SITE TRUTH · {siteTruth}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-cyan-500/30 text-cyan-400 bg-cyan-500/5">LAYOUT TRUTH · {layoutTruth.replaceAll('_',' ')}</Badge>
                      {sensitive&&<Badge variant="outline" className="font-mono text-[10px] border-red-500/40 text-red-400 bg-red-500/10">SENSITIVITY RESTRICTIONS ACTIVE</Badge>}
                    </>;
                  })()}
                  <Badge variant="outline" className="font-mono text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/5">
                    {getLifecycleStageCount(parsedBrief)} STAGES
                  </Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${parsedBrief.visual_lock ? 'border-green-500/30 text-green-400 bg-green-500/5' : 'border-destructive/30 text-destructive bg-destructive/5'}`}>
                    VISUAL LOCK {parsedBrief.visual_lock ? 'PRESENT' : 'MISSING'}
                  </Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${parsedBrief.facility_identity_lock ? 'border-green-500/30 text-green-400 bg-green-500/5' : 'border-amber-500/30 text-amber-400 bg-amber-500/5'}`}>
                    FACILITY IDENTITY {parsedBrief.facility_identity_lock ? 'PRESENT' : 'MISSING'}
                  </Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${getNegativePromptGlobal(parsedBrief).length > 0 ? 'border-green-500/30 text-green-400 bg-green-500/5' : 'border-amber-500/30 text-amber-400 bg-amber-500/5'}`}>
                    GLOBAL NEGATIVES {getNegativePromptGlobal(parsedBrief).length}
                  </Badge>
                </div>
                <div className="inset-panel rounded-2xl p-5 sm:p-6">
                  <StandardPreview data={parsedBrief as any} />
                </div>
            </div>
            <div className="relative">
              <Button 
                size="lg"
                onClick={handleLockTopic}
                className="h-14 w-full font-bold tracking-widest shadow-[0_14px_34px_hsl(var(--primary)/0.2)] xl:text-lg"
              >
                LOCK BRIEF → PHASE 2
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <div className="absolute -top-5 inset-x-0 text-center text-[10px] text-muted-foreground/60 hidden md:block">
                Shortcut: Ctrl+Enter
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
