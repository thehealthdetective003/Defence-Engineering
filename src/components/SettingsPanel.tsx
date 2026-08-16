import React, { useState } from 'react';
import { 
  Wrench, 
  Sliders, 
  Clock, 
  X,
  Brain,
  Lock,
  FileUp,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSettings } from './SettingsContext';
import { AppState } from '../types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_FACILITY_HANDOFF_TEMPLATE } from '../lib/productionTemplate';
import { HandoffValidationResult, validateVisualProductionHandoff } from '../lib/handoffValidation';
import { MAX_SCENE_DURATION_SECONDS, MIN_SCENE_DURATION_SECONDS, parseSceneDuration } from '../lib/sceneDuration';

interface SettingsPanelProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ state, setState, open, onOpenChange }: SettingsPanelProps) {
  const { settings, setSettings } = useSettings();
  const facilityTemplateStatus = validateVisualProductionHandoff(settings.facilityHandoffTemplate || DEFAULT_FACILITY_HANDOFF_TEMPLATE);
  const [templateImportResult, setTemplateImportResult] = useState<HandoffValidationResult | null>(null);
  const commitSceneDuration = (rawValue: string) => {
    const duration = parseSceneDuration(rawValue);
    if (duration === null) {
      toast.error(`Enter a duration between ${MIN_SCENE_DURATION_SECONDS} and ${MAX_SCENE_DURATION_SECONDS} seconds.`);
      return;
    }
    setSettings(previous => ({ ...previous, sceneDurationSeconds: duration }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent id="toolbox-sidebar" className="flex w-[440px] max-w-full flex-col border-l border-border/60 bg-background/95 p-0 text-foreground backdrop-blur-xl" showCloseButton={false}>
        
        {/* Header */}
        <SheetHeader className="border-b border-border/40 bg-muted/15 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <SheetTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
                <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl"><Wrench className="h-4 w-4" /></span>
                Facility toolbox
              </SheetTitle>
              <SheetDescription className="pl-12 text-[11px] text-muted-foreground">
                Documentary controls and system utilities
              </SheetDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)} 
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Content Area */}
        <div className="scrollbar-thin flex-1 select-none space-y-8 overflow-y-auto px-6 py-6">

          {/* Section: Gemini API Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/10 pb-2">
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                01 / GEMINI API CONFIG
              </span>
            </div>

            <div className="space-y-3 bg-muted/30 border border-border/50 p-4 rounded-lg">
              <div className="flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10px] text-foreground font-bold uppercase tracking-wider block">Managed API Key</span>
                  <p className="text-[10px] text-muted-foreground leading-normal uppercase">
                    API Key is managed securely by your Google AI Studio environment.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">OPTIONAL BROWSER API KEY</Label>
                <Input type="password" autoComplete="off" value={settings.apiKey} onChange={event => setSettings(previous => ({ ...previous, apiKey: event.target.value.trim() }))} placeholder="Only needed outside managed AI Studio" className="font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground normal-case">Saved only in this browser. It is never included in project JSON exports.</p>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                DEFAULT MODEL PIPELINE
              </Label>
              <Select value={settings.model} onValueChange={(val) => setSettings(s => ({...s, model: val}))}>
                <SelectTrigger className="bg-muted/20 border border-border/40 h-9 font-mono text-xs focus:ring-primary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border/40 font-mono text-xs">
                  <SelectItem value="gemini-3.5-flash">Gemini 3.5 Flash (Balanced speed)</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (Deep reasoning)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Timeline Calibration */}
          <div className="space-y-4">
            <div className="border-b border-border/10 pb-2">
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                02 / TIMELINE CALIBRATION
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  BASE SCENE DURATION
                </Label>
                <Input 
                  key={settings.sceneDurationSeconds}
                  type="number"
                  min={MIN_SCENE_DURATION_SECONDS}
                  max={MAX_SCENE_DURATION_SECONDS}
                  step="0.1"
                  defaultValue={settings.sceneDurationSeconds}
                  onBlur={event => {
                    const previous = settings.sceneDurationSeconds;
                    commitSceneDuration(event.currentTarget.value);
                    if (parseSceneDuration(event.currentTarget.value) === null) event.currentTarget.value = String(previous);
                  }}
                  onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  aria-describedby="scene-duration-help"
                  className="bg-muted/20 border-border/40 font-mono text-xs text-foreground h-9"
                />
                <p id="scene-duration-help" className="text-[10px] text-muted-foreground normal-case">
                  Default: 6 seconds. Enter any value from {MIN_SCENE_DURATION_SECONDS} to {MAX_SCENE_DURATION_SECONDS} seconds; decimals are supported.
                </p>
              </div>

            </div>

            <div className="p-3.5 bg-muted/20 border border-border/40 rounded-lg">
              <p className="text-[10px] text-muted-foreground leading-relaxed uppercase">
                Base clips follow the custom {settings.sceneDurationSeconds}-second timing. Changing it re-splits imported timestamps and clears generated downstream output. Full Phase 3 generation runs in fixed sequential batches of 30 scenes.
              </p>
            </div>
          </div>

          {/* Section: Global Negative Prompts Defaults Removed */}

          <div className="space-y-4">
            <div className="border-b border-border/10 pb-2">
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold flex items-center gap-1.5">
                <FileUp className="w-3.5 h-3.5" />
                03 / FACILITY HANDOFF JSON TEMPLATE
              </span>
            </div>
            <div className="space-y-3 bg-muted/20 border border-border/40 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider">{settings.facilityHandoffTemplateName || 'Bundled template'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 normal-case">
                    {settings.facilityHandoffTemplateImportedAt
                      ? `Imported ${new Date(settings.facilityHandoffTemplateImportedAt).toLocaleString()}`
                      : 'Bundled Secret Defence Facilities Visual Production Handoff v0.9.0'}
                  </p>
                  <p className={`text-[10px] mt-1 font-bold ${facilityTemplateStatus.valid ? 'text-green-500' : 'text-destructive'}`}>
                    {facilityTemplateStatus.status}{facilityTemplateStatus.version ? ` · ${facilityTemplateStatus.version}` : ''}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed normal-case">
                Importing replaces the blank Facility Handoff Template and its generated research prompt. Filled handoff files supply the app's stages, environments, facility geometry, continuity, truth policy, and prompt constraints in Phase 1.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="relative h-9 text-[10px] font-mono">
                  <FileUp className="h-3.5 w-3.5 mr-2" /> IMPORT JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const parsed = JSON.parse(String(reader.result));
                          const result = validateVisualProductionHandoff(parsed);
                          setTemplateImportResult(result);
                          if (!result.valid || result.format !== 'facility') {
                            const details = result.errors.slice(0, 3).map(item => `${item.path}: ${item.message}`).join(' ');
                            toast.error(`Template not activated (${result.status}). ${details}`);
                            return;
                          }
                          setSettings(prev => ({
                            ...prev,
                            facilityHandoffTemplate: parsed,
                            facilityHandoffTemplateName: parsed.schema?.name || file.name,
                            facilityHandoffTemplateImportedAt: new Date().toISOString(),
                          }));
                          toast.success(`${result.status} template imported and activated.`);
                        } catch {
                          setTemplateImportResult(validateVisualProductionHandoff(null));
                          toast.error('The selected file is not valid JSON.');
                        } finally {
                          input.value = '';
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-[10px] font-mono"
                  onClick={() => {
                    setSettings(prev => ({ ...prev, facilityHandoffTemplate: DEFAULT_FACILITY_HANDOFF_TEMPLATE, facilityHandoffTemplateName: 'Secret Defence Facilities Visual Production Handoff 0.9.0', facilityHandoffTemplateImportedAt: undefined }));
                    setTemplateImportResult(validateVisualProductionHandoff(DEFAULT_FACILITY_HANDOFF_TEMPLATE));
                    toast.success('Bundled facility handoff template restored.');
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> RESTORE
                </Button>
              </div>
              {templateImportResult && !templateImportResult.valid && (
                <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-[10px] text-destructive normal-case">
                  <p className="font-bold uppercase tracking-wider">Invalid</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {templateImportResult.errors.map((item, index) => (
                      <li key={`${item.path}-${item.code}-${index}`}><span className="font-bold">{item.path}</span>: {item.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-border/40 bg-muted/15 p-6 text-center">
          <h4 className="text-xs font-bold tracking-[0.18em] text-foreground">DEFENCE FACILITY ENGINE</h4>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Version 2.2.0 · Studio build</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
