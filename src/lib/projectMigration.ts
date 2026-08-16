import { AppState, T2VPrompt } from '../types';
import { resplitTranscription } from './timedTranscript';
import { ensureRequiredVisibleFeatures, validateSceneDirections } from './sceneDirections';
import { deriveGraphicSceneSpec, resolvePlannedState } from './scenePlanner';
import { normalizeSceneDuration } from './sceneDuration';

export type MigrationResult = { state: AppState | null; message?: string; error?: string };

export function projectSceneDuration(raw: any, fallback: number): number {
  const value = Number(raw?.voiceoverTranscription?.sceneDurationSeconds);
  return normalizeSceneDuration(value, fallback);
}

export function migrateProject(raw: any, initial: AppState, sceneDuration: number): MigrationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { state: null, error: 'Invalid project file.' };
  const facilityHandoff=raw.topic?._production_handoff;
  const hasFacilityContract=facilityHandoff?.schema?.name==='Secret Defence Facilities Visual Production Handoff'&&facilityHandoff?.schema?.version==='0.9.0';
  const intermediateFacilityProject=raw.projectFormat==='standard-lifecycle'&&raw.projectSchemaVersion===10&&hasFacilityContract;
  if(raw.projectFormat!=='facility-construction'&&!intermediateFacilityProject)return {state:null,error:'Unsupported project format. Load a facility-construction project; Modus manufacturing projects are not converted automatically.'};

  sceneDuration = projectSceneDuration(raw, sceneDuration);
  let transcription = raw.voiceoverTranscription || null;
  let timingChanged = false;
  if (transcription && transcription.sceneDurationSeconds !== sceneDuration) {
    transcription = resplitTranscription(transcription, sceneDuration);
    timingChanged = true;
  }
  const rawPlan = Array.isArray(raw.plannedScenes) ? raw.plannedScenes.map((item:any,index:number)=>{
    const state=['A','B','C'].includes(item?.state)?item.state:resolvePlannedState(raw.topic,item?.stage_id);
    const base={...item,state};
    const timed=transcription?.scenes?.[index];
    return {...base,graphic_spec:item?.graphic_spec??(timed?deriveGraphicSceneSpec(raw.topic,timed,base):null)};
  }) : [];
  const graphicSubtypes=['SITE_CROSS_SECTION','TERRAIN_OVERBURDEN','EXCAVATION_PROGRESSION','TUNNEL_SEQUENCE','STRUCTURAL_LAYER','VENTILATION_FLOW','DRAINAGE_FLOW','CONSTRUCTION_TIMELINE','CONCEPTUAL_FACILITY_RELATIONSHIP','SCALE_COMPARISON'];
  const graphicSpecValid=(item:any)=>item?.graphic_spec===null||(
    graphicSubtypes.includes(item?.graphic_spec?.graphic_subtype)&&item?.graphic_spec?.visual_claim&&item?.graphic_spec?.composition&&item?.graphic_spec?.motion_pattern
    &&Array.isArray(item?.graphic_spec?.annotation_devices)&&[1,2,3].includes(item?.graphic_spec?.maximum_animated_elements)&&item?.graphic_spec?.text_policy==='NO_GENERATED_TEXT'
    &&['EXACT_LAYOUT_VERIFIED','PARTIAL_LAYOUT_VERIFIED','CONCEPTUAL_RELATIONSHIP_ONLY','UNKNOWN'].includes(item?.graphic_spec?.layout_claim_status)
    &&typeof item?.graphic_spec?.not_to_scale==='boolean'&&Array.isArray(item?.graphic_spec?.reference_asset_ids)
  );
  // Schema 10 introduces the defence-facility planner and truth-aware direction contract.
  // Pre-facility plans are not accepted; schema-10 facility plans remain eligible.
  const planValid = raw.projectSchemaVersion >= 10 && !!transcription && rawPlan.length === transcription.scenes.length && rawPlan.every((item:any,index:number)=>
    item?.number===index+1&&item?.chapter_id&&item?.beat_id&&item?.visual_family&&item?.story_function&&item?.visual_treatment&&item?.facility_visibility&&item?.stage_id&&item?.environment_ref&&['A','B','C'].includes(item?.state)
    &&['LOW','MEDIUM','HIGH'].includes(item?.energy_level)&&item?.facility_claim_status&&item?.layout_claim_status&&item?.generation_permission
    &&typeof item?.exact_site_claim_allowed==='boolean'&&typeof item?.exact_layout_claim_allowed==='boolean'
    &&['preferred_media_routes','reference_asset_ids','facility_module_ids','required_visible_features','forbidden_elements','truth_constraints','continuity_requirements'].every(field=>Array.isArray(item?.[field]))
    &&graphicSpecValid(item)
  );
  const rawDirections = Array.isArray(raw.sceneDirections) ? raw.sceneDirections : [];
  const planByNumber = new Map(rawPlan.map((item:any)=>[Number(item.number),item]));
  const repairedDirections = planValid ? rawDirections.map((item:any)=>{
    const plan:any=planByNumber.get(Number(item?.number));
    if(!plan)return item;
    return {...item,chapter_id:plan.chapter_id,beat_id:plan.beat_id,visual_family:plan.visual_family,story_function:plan.story_function,visual_treatment:plan.visual_treatment,facility_visibility:plan.facility_visibility,energy_level:plan.energy_level,facility_claim_status:plan.facility_claim_status,layout_claim_status:plan.layout_claim_status,generation_permission:plan.generation_permission,preferred_media_routes:plan.preferred_media_routes,reference_asset_ids:plan.reference_asset_ids,exact_site_claim_allowed:plan.exact_site_claim_allowed,exact_layout_claim_allowed:plan.exact_layout_claim_allowed,facility_module_ids:plan.facility_module_ids,truth_constraints:plan.truth_constraints,continuity_requirements:plan.continuity_requirements,graphic_spec:plan.graphic_spec,stage_id:plan.stage_id,environment_ref:plan.environment_ref,state:plan.state,required_visible_features:ensureRequiredVisibleFeatures(item,plan),forbidden_elements:[...new Set([...(plan.forbidden_elements||[]),...(Array.isArray(item.forbidden_elements)?item.forbidden_elements:[])])]};
  }) : rawDirections;
  const directionsValid = planValid && !!transcription && validateSceneDirections(repairedDirections, transcription.scenes, rawPlan).length === 0;
  const imageMode = raw.phase4Mode === 'image-animation';
  const profileSupported = raw.projectSchemaVersion >= 4 && (raw.t2vPromptProfile === 'omni-flash' || raw.t2vPromptProfile === 'veo-flow');
  const rawPrompts = Array.isArray(raw.visualPrompts) ? raw.visualPrompts : [];
  const promptNumbers = new Set<number>();
  const promptsCompatible = directionsValid && rawPrompts.every((item:any) => {
    const number = Number(item?.number);
    const valid = Number.isInteger(number) && number >= 1 && number <= transcription.scenes.length && !promptNumbers.has(number) && typeof item?.video_prompt === 'string' && item.video_prompt.trim();
    if (valid) promptNumbers.add(number);
    return Boolean(valid);
  });
  const compatiblePrompts: T2VPrompt[] = directionsValid && !imageMode && profileSupported && promptsCompatible
    ? rawPrompts.map((item: any) => {
        const number=Number(item.number);
        const base:T2VPrompt={
        number, stage_id: item.stage_id || item.stage_ref, state: item.state,
        continuity_notes: item.continuity_notes, quality_flags: item.quality_flags,
        action_description: String(item.action_description || ''), video_prompt: String(item.video_prompt || ''),
        voiceover: transcription.scenes[number - 1]?.text || '', stock_keywords: String(item.stock_keywords || ''),
        omniSections:item.omniSections,
      };
      return base;
    })
    : [];
  const preserveOutput = compatiblePrompts.length > 0;
  const phase = directionsValid ? (Number(raw.phase) >= 3 ? 3 : Math.max(1, Number(raw.phase) || 1)) : (raw.topic ? 2 : 1);
  const state: AppState = {
    ...initial,
    id: raw.id,
    projectName: raw.projectName || initial.projectName,
    projectFormat: 'facility-construction',
    phase: phase as 1 | 2 | 3,
    topic: raw.topic || null,
    masterVoiceoverScript: transcription?.text || '',
    voiceoverTranscription: transcription,
    plannedScenes: planValid ? rawPlan : [],
    sceneDirections: directionsValid ? repairedDirections : [],
    visualPrompts: preserveOutput ? compatiblePrompts.sort((a,b)=>a.number-b.number) : [],
    demoState: 'idle', demoScenes: [], demoSceneNumbers: [],
    t2vPromptProfile: profileSupported ? raw.t2vPromptProfile : 'omni-flash',
    projectSchemaVersion: 11,
  };
  const reset = timingChanged || imageMode || !profileSupported || !directionsValid || !preserveOutput;
  const planningUpgrade = intermediateFacilityProject||raw.projectSchemaVersion<11;
  return { state, message: planningUpgrade
    ? 'Intermediate facility project migrated to the facility-construction format and isolated Facility Engine storage model.'
    : reset && raw.topic ? 'Project migrated to the timestamped T2V pipeline; incompatible downstream output was reset.' : undefined };
}
