import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ArrowLeft, CheckCircle2, Copy, Loader2, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import { AppState, SceneDirection } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useSettings } from './SettingsContext';
import { copyToClipboard } from '@/lib/utils';
import { TranscriptionImportPanel } from './TranscriptionImportPanel';
import { calculateStageSummary, mergeDirectionMetadata, validateSceneDirections } from '../lib/sceneDirections';
import { formatTimestamp } from '../lib/timedTranscript';
import { buildDocumentaryScenePlan, buildFacilityBatchContext, summarizeScenePlan } from '../lib/scenePlanner';

interface Props { state: AppState; setState: Dispatch<SetStateAction<AppState>>; }
const directionSchema={type:Type.ARRAY,items:{type:Type.OBJECT,required:['number','subject','facility_visual_state','primary_action','supporting_motion','environment_description','camera','lighting_and_material','continuity_from_previous','transition_to_next','required_visible_features','forbidden_elements','temporal_action'],properties:{number:{type:Type.INTEGER},subject:{type:Type.STRING},facility_visual_state:{type:Type.STRING},primary_action:{type:Type.STRING},supporting_motion:{type:Type.STRING},environment_description:{type:Type.STRING},camera:{type:Type.OBJECT,required:['shot_scale','lens','angle','movement','movement_speed'],properties:{shot_scale:{type:Type.STRING},lens:{type:Type.STRING},angle:{type:Type.STRING},movement:{type:Type.STRING},movement_speed:{type:Type.STRING}}},lighting_and_material:{type:Type.STRING},continuity_from_previous:{type:Type.STRING},transition_to_next:{type:Type.STRING},required_visible_features:{type:Type.ARRAY,items:{type:Type.STRING}},forbidden_elements:{type:Type.ARRAY,items:{type:Type.STRING}},temporal_action:{type:Type.OBJECT,required:['opening_state','primary_motion','physical_interaction','mid_shot_progression','ending_state'],properties:{opening_state:{type:Type.STRING},primary_motion:{type:Type.STRING},physical_interaction:{type:Type.STRING},mid_shot_progression:{type:Type.STRING},ending_state:{type:Type.STRING}}}}}};

export const FACILITY_DIRECTOR_SYSTEM_INSTRUCTION = `You direct concise documentary scenes about the construction, operation, history, and remains of defence facilities.

Return one object per planned scene, in order. Return the scene number and creative direction fields only. Never return or modify timing, voiceover, lifecycle state, plan metadata, truth metadata, or reference metadata. The assigned beat, facility visual family, story function, treatment, facility visibility, construction stage, A/B/C state, environment, claim statuses, generation permission, media routes, exact-claim permissions, module IDs, references, truth constraints, continuity requirements, and graphic specification are authoritative.

Illustrate the exact narration claim with physical, camera-visible language. Every fixed-duration clip is one continuous shot with a clear opening state, one primary motion or change, one physical interaction, visible mid-shot progression, and a settled ending. Preserve the assigned facility state and causal continuity across adjacent scenes. Choose a credible camera position and restrained movement; never pass the camera through rock, walls, roofs, tunnel linings, or sealed spaces.

State A is pre-facility, site preparation, access work, exposed terrain, temporary works, or early excavation. Do not show completed tunnels, finished structural lining, installed permanent systems, operational chambers, or completed-facility hero imagery. State B is partial construction: show only the openings, excavations, temporary supports, structural work, exposed layers, or installed systems explicitly present in the assigned stage. Do not regress to untouched terrain unless the scene is explicitly historical, and do not advance to a pristine operational facility. State C is completed, operational, decommissioned, abandoned, preserved, or ruined as assigned; do not revert it to active early construction unless the plan explicitly marks historical material.

Facility visibility is strict. NONE omits the facility. DETAIL_ONLY stays on the assigned module or construction detail. PARTIAL preserves every supplied present-now, not-yet-built, temporarily-exposed, temporary-works, and absent-component constraint. FULL preserves only corroborated facility identity and condition. Treat required_visible_features as additive to the plan; never omit plan-required features. Add plan forbidden elements to the generated exclusions and do not positively depict them.

Truth status controls representation. EXACT_SITE_VERIFIED may look site-specific only when exact_site_claim_allowed is true and cited references are supplied. FACILITY_TYPE_CORROBORATED shows the supported facility type without claiming the exact named site. CONTEXTUAL_DEFENCE_INFRASTRUCTURE and GENERIC_NON_IDENTIFYING_VISUAL must remain non-identifying. NEVER_GENERATE means do not invent an image; direct the assigned reference or graphic treatment instead. REFERENCE_REQUIRED and REFERENCE_MEDIA require the cited archival, documentary, survey, map, or plan asset: describe what evidence the editor should use and how to frame it, never fabricate authentic-looking archival footage.

Layout truth is equally strict. EXACT_LAYOUT_VERIFIED can show only cited spatial facts. PARTIAL_LAYOUT_VERIFIED shows only the verified portion and leaves the rest unspecified. CONCEPTUAL_RELATIONSHIP_ONLY uses a simplified, explicitly non-to-scale relationship diagram and must never imply an exact floor plan. UNKNOWN forbids generated floor plans, room arrangements, hidden entrances, internal routes, and exact cutaways. For STATIC_GRAPHIC_T2V and MOTION_GRAPHIC_T2V, explain only graphic_spec.visual_claim with its supplied subtype, composition, motion pattern, nonverbal annotations, layout status, references, and animation limit. Use a clean 16:9 flat technical vector graphic with stable simplified geometry, no generated text or numbers, no readable labels, no fake measurements, and no invented rooms or connections.

Never invent proprietary internals, underground layouts, access routes, security systems or procedures, guard posts, guard routines or patterns, surveillance positions or blind spots, vulnerabilities, hidden entrances, checkpoints, classified capabilities, weapon deployment, combat, explosions, unit markings, precise coordinates, exact events, or identifiable current locations. Never convert contextual bunker imagery into a depiction of the exact named facility. Aircraft, vehicles, personnel, and machinery may appear only as contextual scale or historically supported construction/logistics evidence; never turn them into the primary subject, an aviation performance sequence, or a cinematic showdown. Avoid generic industrial assembly lines, facility beauty shots, aerobatics, cockpit spectacle, or deployed-platform footage. Use only the facility construction evidence, historical context, modules, stages, environments, references, and constraints supplied in the batch.`;

export function Phase2Script({state,setState}:Props){
 const {settings}=useSettings(); const [isLoading,setIsLoading]=useState(false); const [batchStatus,setBatchStatus]=useState('');
 const [editor,setEditor]=useState(()=>state.sceneDirections.length?JSON.stringify(state.sceneDirections,null,2):'[]');
 const scenes=state.voiceoverTranscription?.scenes||[]; const transcript=state.voiceoverTranscription;
 const parsed=useMemo(()=>{try{const v=JSON.parse(editor);return Array.isArray(v)?v as SceneDirection[]:null}catch{return null}},[editor]);
 const errors=useMemo(()=>parsed?validateSceneDirections(parsed,scenes,state.plannedScenes):['Directions must be a valid JSON array.'],[parsed,scenes,state.plannedScenes]);
 const stageSummary=useMemo(()=>parsed&&!errors.length?calculateStageSummary(parsed):[],[parsed,errors]);
 const planSummary=useMemo(()=>summarizeScenePlan(state.plannedScenes),[state.plannedScenes]);
 const canResume=state.plannedScenes.length===scenes.length&&state.sceneDirections.length>0&&state.sceneDirections.length<scenes.length;
 const generate=async(resume=false)=>{
  if(!state.topic||!transcript?.scenes.length)return toast.error('Import timestamped VO JSON before generating directions.');
  const apiKey=settings.apiKey||process.env.GEMINI_API_KEY;if(!apiKey)return toast.error('Add a Gemini API key in Settings.');
  setIsLoading(true);
  try{
   const ai=new GoogleGenAI({apiKey}); const plan=resume?state.plannedScenes:buildDocumentaryScenePlan(state.topic,transcript.scenes); const generated:any[]=resume?[...state.sceneDirections]:[];
   if(!resume)setState(p=>({...p,plannedScenes:plan,sceneDirections:[],visualPrompts:[],demoScenes:[],demoSceneNumbers:[],demoState:'idle',phase:2}));
   for(let offset=generated.length;offset<scenes.length;offset+=30){
    const timedBatch=scenes.slice(offset,offset+30),planBatch=plan.slice(offset,offset+30);setBatchStatus(`batch ${Math.floor(offset/30)+1}/${Math.ceil(scenes.length/30)} · scenes ${timedBatch[0].number}–${timedBatch.at(-1)?.number}`);
    const facility_context=buildFacilityBatchContext(state.topic,planBatch);
    const contents=JSON.stringify({facility_context,prior_scene:generated.at(-1)||null,planned_scenes:planBatch.map((p,i)=>({...p,...timedBatch[i],voiceover:timedBatch[i].text}))});
    const response=await ai.models.generateContent({model:settings.model,contents,config:{responseMimeType:'application/json',responseSchema:directionSchema,systemInstruction:FACILITY_DIRECTOR_SYSTEM_INSTRUCTION}});
    const batch=JSON.parse(response.text||'[]'),nums=batch.map((x:any)=>Number(x.number)),expected=timedBatch.map(x=>x.number);
    if(batch.length!==expected.length||new Set(nums).size!==nums.length||expected.some(n=>!nums.includes(n))||nums.some((n:number)=>!expected.includes(n)))throw new Error(`Direction batch ${Math.floor(offset/30)+1} returned missing, duplicate, or unexpected scene numbers.`);
    generated.push(...batch);const partialTimed=scenes.slice(0,generated.length),partialPlan=plan.slice(0,generated.length),partial=mergeDirectionMetadata(generated,partialTimed,partialPlan);
    setEditor(JSON.stringify(partial,null,2));setState(p=>({...p,plannedScenes:plan,sceneDirections:partial}));
   }
   const merged=mergeDirectionMetadata(generated,scenes,plan),validation=validateSceneDirections(merged,scenes,plan);if(validation.length)throw new Error(validation.join(' '));
   setEditor(JSON.stringify(merged,null,2));setState(p=>({...p,plannedScenes:plan,sceneDirections:merged,visualPrompts:[],demoScenes:[],demoSceneNumbers:[],demoState:'idle',phase:2}));toast.success(`Planned and directed ${merged.length} timestamp-locked scenes.`);
  }catch(error){toast.error(error instanceof Error?error.message:'Direction generation failed.')}finally{setIsLoading(false);setBatchStatus('')}
 };
 const approve=()=>{if(!parsed||errors.length)return toast.error(errors[0]);setState(p=>({...p,sceneDirections:parsed,visualPrompts:[],demoScenes:[],demoSceneNumbers:[],demoState:'idle',phase:3}));toast.success('Scene directions approved.')};
 return <div className="space-y-6">
  <Button variant="link" className="workspace-back p-0" onClick={()=>setState(s=>({...s,phase:1}))}><ArrowLeft className="mr-1 h-3 w-3"/>Back to facility brief</Button>
  <TranscriptionImportPanel state={state} setState={setState}/>
  {transcript&&<div className="grid grid-cols-2 gap-2 md:grid-cols-5">{[['Runtime',formatTimestamp(transcript.duration)],['Scenes',scenes.length],['Window',`${transcript.sceneDurationSeconds}s`],['Final scene',`${scenes.at(-1)?.duration.toFixed(3)}s`],['Silent windows',scenes.filter(s=>s.silent).length]].map(([k,v])=><div key={k} className="metric-card p-3.5"><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{k}</div><div className="mt-1.5 text-base font-bold">{v}</div></div>)}</div>}
  <Button onClick={()=>generate(canResume)} disabled={isLoading||!transcript} className="h-13 w-full font-bold tracking-wide shadow-[0_14px_32px_hsl(var(--primary)/0.18)]">{isLoading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<PenTool className="mr-2 h-4 w-4"/>}{isLoading?`PLANNING & GENERATING · ${batchStatus}`:canResume?`RESUME DIRECTION GENERATION FROM SCENE ${state.sceneDirections.length+1}`:'GENERATE DETAILED SCENE DIRECTIONS'}</Button>
  {!!state.plannedScenes.length&&<div className="inset-panel space-y-3 rounded-2xl p-4"><div className="section-kicker text-muted-foreground">Automatic facility documentary plan</div><div className="flex flex-wrap gap-2"><Badge variant="default">Reference media: {planSummary.referenceScenes}</Badge>{planSummary.graphicScenes>0&&<Badge variant="default">Technical graphics: {planSummary.graphicScenes}</Badge>}{planSummary.states.map(([k,v])=><Badge key={k} variant="outline">State {k}: {v}</Badge>)}</div><div className="flex flex-wrap gap-2">{planSummary.families.map(([k,v])=><Badge key={k} variant="secondary">{k.replaceAll('_',' ')}: {v}</Badge>)}</div>{planSummary.graphicScenes>0&&<div className="flex flex-wrap gap-2">{planSummary.graphicSubtypes.map(([k,v])=><Badge key={k} variant="outline">{k.replaceAll('_',' ')}: {v}</Badge>)}</div>}<div className="flex flex-wrap gap-2">{planSummary.treatments.map(([k,v])=><Badge key={k} variant="outline">{k.replace('_T2V','').replaceAll('_',' ')}: {v}</Badge>)}</div></div>}
  <div className="space-y-3"><div className="flex items-center justify-between"><div><div className="section-kicker">Direction ledger</div><p className="mt-1 text-xs text-muted-foreground">Strict timestamp-locked scene direction JSON</p></div><Button size="sm" variant="outline" onClick={async()=>toast[await copyToClipboard(editor)?'success':'error']('JSON copied')}><Copy className="mr-2 h-3 w-3"/>COPY</Button></div><Textarea value={editor} onChange={e=>setEditor(e.target.value)} className="code-surface scrollbar-thin min-h-[520px] rounded-xl p-4 font-mono text-xs" spellCheck={false}/>{errors.length?<div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">{errors.slice(0,5).map((e,i)=><div key={i}>• {e}</div>)}</div>:<div className="flex items-center gap-2 text-xs text-primary"><CheckCircle2 className="h-4 w-4"/>Schema valid; timing, VO, and documentary plan are unchanged.</div>}{stageSummary.length>0&&<div className="flex flex-wrap gap-2">{stageSummary.map(item=><Badge key={item.stage_id} variant="secondary">{item.stage_id}: {item.scenes}</Badge>)}</div>}</div>
  <Button onClick={approve} disabled={errors.length>0} className="h-14 w-full font-bold tracking-widest shadow-[0_14px_32px_hsl(var(--primary)/0.18)]">APPROVE DIRECTIONS → PROMPT STUDIO</Button>
 </div>
}
