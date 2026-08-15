import type {
  CinematicEnergy,
  GraphicAnnotationDevice,
  GraphicComposition,
  GraphicMotionPattern,
  GraphicSceneSpec,
  GraphicSubtype,
  PlannedScene,
  StoryFunction,
  TimedScene,
  TopicBrief,
  VisualFamily,
  VisualTreatmentWithReference,
} from '../types';
import type {
  ConstructionStage,
  FacilityChapter,
  FacilityProductionHandoff,
  FacilityVisualBeat,
  LayoutClaimStatus,
} from '../types/facilityProduction';

interface Candidate {
  chapter: FacilityChapter;
  beat: FacilityVisualBeat;
  stage: ConstructionStage;
  environmentRef: string;
  treatment: VisualTreatmentWithReference;
}

const GRAPHIC = new Set<VisualFamily>(['TECHNICAL_GRAPHIC', 'MAP_OR_TIMELINE', 'CUTAWAY_RECONSTRUCTION']);
const REFERENCE_ROUTES = new Set(['REFERENCE_IMAGE_I2V', 'AUTHENTIC_VIDEO', 'ARCHIVAL_IMAGE', 'ARCHIVAL_VIDEO', 'SATELLITE_REFERENCE', 'REFERENCE_LOCKED_GRAPHIC', 'STATIC_IMAGE_WITH_MOTION']);
const STATE_RANK = { A: 0, B: 1, C: 2 } as const;
const STOP_WORDS = new Set(['the','and','that','this','with','from','into','while','through','about','then','than','only','also','must','still','each','when','where','which','their','there','have','has','had','does','not','without','show','scene','visual','facility','stage','construction']);
const SECURITY_EXCLUSIONS = [
  'invented current access routes or hidden entrances',
  'current security procedures, guard posts, or guard routines',
  'surveillance positions or security blind spots',
  'vulnerability analysis or weapons-employment guidance',
  'invented exact room arrangement or security checkpoints',
];

const CUE_RULES: Array<{ pattern: RegExp; families: VisualFamily[]; stories?: StoryFunction[]; weight: number }> = [
  { pattern:/\b(mountain|granite|rock|cliff|ice|arctic|coast|sea|island|desert|valley|remote|underground|terrain|geolog(?:y|ical))\b/i, families:['TERRAIN_CONTEXT','SITE_AERIAL','FACILITY_EXTERIOR'], stories:['ESTABLISH_LOCATION','ESTABLISH_SCALE'], weight:24 },
  { pattern:/\b(survey|road|railway|railroad|port|construction camp|access|temporary power|workers? arrived|equipment arrived|transport|supply|logistics)\b/i, families:['SURVEY_AND_PREPARATION','ACCESS_AND_LOGISTICS','CONSTRUCTION_CAMP'], stories:['SHOW_LOGISTICS'], weight:28 },
  { pattern:/\b(drill(?:ing)?|blast(?:ing)?|excavat(?:e|ion|or)|shaft|cavern|dig(?:ging)?|rock removal|spoil|muck)\b/i, families:['EXCAVATION_AND_BLASTING','ROCK_REMOVAL','MACHINERY_ACTION'], stories:['INTRODUCE_CONSTRUCTION_PROBLEM','EXPLAIN_PROCESS'], weight:34 },
  { pattern:/\b(tunnel|portal|tbm|tunnel boring|rock bolt|shotcrete|ground support|lining|breakthrough)\b/i, families:['TUNNELING','TEMPORARY_WORKS','CONCRETE_AND_LINING'], stories:['EXPLAIN_PROCESS'], weight:36 },
  { pattern:/\b(reinforced concrete|steel|slab|wall|chamber|waterproofing|drainage|foundation|permanent structure|hardened door)\b/i, families:['CONCRETE_AND_LINING','STRUCTURAL_FIT_OUT','QUALITY_CONTROL'], stories:['EXPLAIN_PROCESS'], weight:28 },
  { pattern:/\b(ventilation|generator|electricity|electrical|power|heating|cooling|drainage|water|air supply|utilities|communications? system)\b/i, families:['INTERNAL_SYSTEMS','TECHNICAL_GRAPHIC'], stories:['EXPLAIN_HIDDEN_SYSTEM'], weight:36 },
  { pattern:/\b(conceptual|cutaway|cross.section|spatial relationship|surface.*(?:tunnel|chamber)|non.to.scale)\b/i, families:['CUTAWAY_RECONSTRUCTION','TECHNICAL_GRAPHIC'], stories:['EXPLAIN_SPATIAL_RELATIONSHIP'], weight:44 },
  { pattern:/\b(archive|archival|photograph|drawing|declassified|document|memo|plan|report|map|blueprint|government record)\b/i, families:['ARCHIVAL_REFERENCE','MAP_OR_TIMELINE'], stories:['PROVIDE_HISTORICAL_CONTEXT'], weight:38 },
  { pattern:/\b(groundwater|collapse|cracking|settlement|ice movement|corrosion|leak|instability|failure|redesign|obsolete)\b/i, families:['ENVIRONMENTAL_CHALLENGE','QUALITY_CONTROL'], stories:['SHOW_FAILURE_OR_LIMIT'], weight:36 },
  { pattern:/\b(abandoned|decommissioned|closed|demolished|collapsed|remains|preserved|museum|today|ruins?)\b/i, families:['ABANDONMENT_OR_REMAINS'], stories:['RESOLVE_FATE'], weight:42 },
];

const stem = (value:string) => value.length > 5 ? value.replace(/(?:ing|tion|ions|ments|ment|ed|es|s)$/,'') : value;
const tokenize = (value:string) => new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g)||[]).map(stem).filter(word => !STOP_WORDS.has(word)));
const overlap = (a:Set<string>, b:Set<string>) => [...a].filter(word => b.has(word)).length;
const unique = (values:unknown[]):string[] => {
  const seen=new Set<string>();
  const flatten=(value:unknown):string[] => Array.isArray(value)?value.flatMap(flatten):typeof value==='string'?[value.trim()].filter(Boolean):[];
  return values.flatMap(flatten).filter(value=>{const key=value.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
};
const facilityHandoff = (topic:TopicBrief):FacilityProductionHandoff => {
  const handoff=topic._production_handoff as FacilityProductionHandoff|undefined;
  if(handoff?.schema?.name!=='Secret Defence Facilities Visual Production Handoff')throw new Error('A valid facility handoff is required for scene planning.');
  return handoff;
};
const historicalCue = (text:string) => /\b(archive|archival|historical|earlier|before construction|pre[- ]construction|declassified|document|photograph|drawing|memo|report|record|then|at the time)\b/i.test(text);

function treatmentFor(beat:FacilityVisualBeat):VisualTreatmentWithReference {
  const routes=beat.preferred_media_routes||[];
  const referenceOnly=beat.generation_permission!=='T2V_ALLOWED'||(!routes.includes('GENERATED_T2V')&&routes.some(route=>REFERENCE_ROUTES.has(route)));
  if(referenceOnly)return 'REFERENCE_MEDIA';
  if(!GRAPHIC.has(beat.visual_family))return 'LIVE_ACTION_T2V';
  const words=`${beat.beat_name} ${beat.narrative_purpose} ${beat.semantic_alignment_terms.join(' ')}`.toLowerCase();
  return /flow|path|sequence|progress|timeline|relationship|layer|ventilation|drainage|excavation/.test(words)?'MOTION_GRAPHIC_T2V':'STATIC_GRAPHIC_T2V';
}

function layoutEligible(handoff:FacilityProductionHandoff, beat:FacilityVisualBeat):boolean {
  if(beat.visual_family!=='CUTAWAY_RECONSTRUCTION')return true;
  if(beat.layout_claim_status==='EXACT_LAYOUT_VERIFIED')return beat.exact_layout_claim_allowed&&beat.reference_asset_ids.length>0&&handoff.site_dimensions_and_spatial_relations.layout_claim_status==='EXACT_LAYOUT_VERIFIED';
  if(beat.layout_claim_status==='PARTIAL_LAYOUT_VERIFIED')return beat.reference_asset_ids.length>0;
  if(beat.layout_claim_status==='CONCEPTUAL_RELATIONSHIP_ONLY')return handoff.site_dimensions_and_spatial_relations.important_spatial_relationships.length>0||beat.must_show.length>0;
  return false;
}

function familyAllowedForStage(family:VisualFamily, state:'A'|'B'|'C', text:string):boolean {
  const historical=historicalCue(text)||family==='ARCHIVAL_REFERENCE'||family==='MAP_OR_TIMELINE';
  if(state==='A'&&['TUNNELING','CONCRETE_AND_LINING','STRUCTURAL_FIT_OUT','INTERNAL_SYSTEMS','OPERATIONAL_CONTEXT','ABANDONMENT_OR_REMAINS','HERO_FACILITY'].includes(family))return false;
  if(state==='B'&&['TERRAIN_CONTEXT','SITE_AERIAL','SURVEY_AND_PREPARATION'].includes(family)&&!historical)return false;
  if(state==='B'&&['OPERATIONAL_CONTEXT','ABANDONMENT_OR_REMAINS','HERO_FACILITY'].includes(family))return false;
  if(state==='C'&&['SURVEY_AND_PREPARATION','EXCAVATION_AND_BLASTING','ROCK_REMOVAL','TUNNELING','TEMPORARY_WORKS','CONCRETE_AND_LINING','STRUCTURAL_FIT_OUT'].includes(family)&&!historical)return false;
  return true;
}

function candidatesFor(handoff:FacilityProductionHandoff):Candidate[] {
  const stages=new Map(handoff.construction_stages.map(stage=>[stage.stage_id,stage]));
  const environments=new Map(handoff.environments.map(environment=>[environment.environment_id,environment]));
  return handoff.visual_story_plan.chapters.flatMap(chapter=>chapter.visual_beats.flatMap(beat=>{
    if(beat.facility_claim_status==='UNUSABLE'||beat.generation_permission==='NOT_ALLOWED'&&beat.preferred_media_routes.includes('NO_VALID_ROUTE')||!layoutEligible(handoff,beat))return [];
    const ids=beat.applicable_stage_ids.length?beat.applicable_stage_ids:chapter.applicable_construction_stage_ids.length?chapter.applicable_construction_stage_ids:handoff.construction_stages.map(stage=>stage.stage_id);
    return ids.flatMap(stageId=>{
      const stage=stages.get(stageId);if(!stage)return [];
      if(beat.required_facility_state_code&&beat.required_facility_state_code!==stage.facility_state_code)return [];
      const environmentRef=beat.environment_ids.find(id=>environments.get(id)?.facility_claim_status!=='UNUSABLE')||stage.environment_ids.find(id=>environments.get(id)?.facility_claim_status!=='UNUSABLE')||'';
      if(!environmentRef)return [];
      return [{chapter,beat,stage,environmentRef,treatment:treatmentFor(beat)}];
    });
  }));
}

const CHAPTER_WORDS:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
function explicitChapterIndex(text:string):number|null {
  const match=text.toLowerCase().match(/\bchapter\s+(?:(\d{1,2})|(one|two|three|four|five|six|seven|eight|nine|ten))\b/);if(!match)return null;
  const number=match[1]?Number(match[1]):CHAPTER_WORDS[match[2]];return Number.isInteger(number)&&number>0?number-1:null;
}
function chapterText(chapter:FacilityChapter):string {return [chapter.chapter_name,chapter.narrative_goal,chapter.chapter_question,chapter.chapter_payoff,...chapter.visual_beats.flatMap(beat=>[beat.beat_name,beat.narrative_purpose,...beat.semantic_alignment_terms])].join(' ');}
function alignChapters(handoff:FacilityProductionHandoff, scenes:TimedScene[]):FacilityChapter[] {
  const chapters=[...handoff.visual_story_plan.chapters].sort((a,b)=>a.chapter_order-b.chapter_order);if(!chapters.length)throw new Error('Facility handoff has no visual-story chapters.');
  let current=0;return scenes.map(scene=>{
    const explicit=explicitChapterIndex(scene.text);if(explicit!==null&&explicit>=0&&explicit<chapters.length)current=Math.max(current,explicit);
    else if(current<chapters.length-1){const words=tokenize(scene.text),now=overlap(words,tokenize(chapterText(chapters[current]))),next=overlap(words,tokenize(chapterText(chapters[current+1])));if(next>=4&&next>=now+3)current++;}
    return chapters[current];
  });
}

function cueScore(text:string, family:VisualFamily, story:StoryFunction):number {
  return CUE_RULES.reduce((score,rule)=>rule.pattern.test(text)?score+(rule.families.includes(family)?rule.weight:0)+(rule.stories?.includes(story)?Math.round(rule.weight*.55):0):score,0);
}
function truthConstraints(handoff:FacilityProductionHandoff, beat:FacilityVisualBeat):string[] {
  const constraints=[...SECURITY_EXCLUSIONS];
  if(beat.facility_claim_status==='EXACT_SITE_VERIFIED')constraints.push(beat.exact_site_claim_allowed&&beat.reference_asset_ids.length?'Exact-site imagery must remain locked to the cited references.':'Do not present this image as the exact named site.');
  if(beat.facility_claim_status==='FACILITY_TYPE_CORROBORATED')constraints.push('Show only the corroborated facility type, not an exact-site reconstruction.');
  if(beat.facility_claim_status==='CONTEXTUAL_DEFENCE_INFRASTRUCTURE')constraints.push('Contextual defence infrastructure must not be presented as the exact named facility.');
  if(beat.facility_claim_status==='GENERIC_NON_IDENTIFYING_VISUAL')constraints.push('Keep the facility generic and non-identifying.');
  if(beat.layout_claim_status==='EXACT_LAYOUT_VERIFIED')constraints.push('Use only exact spatial relationships supported by the cited layout references.');
  if(beat.layout_claim_status==='PARTIAL_LAYOUT_VERIFIED')constraints.push('Show only the verified portion of the layout; leave all other arrangement unspecified.');
  if(beat.layout_claim_status==='CONCEPTUAL_RELATIONSHIP_ONLY')constraints.push('Use a simplified non-to-scale relationship graphic; never imply an exact floor plan.');
  if(beat.layout_claim_status==='UNKNOWN')constraints.push('Internal layout is unknown: do not generate a floor plan, room arrangement, hidden entrance, or exact cutaway.');
  if(handoff.site_dimensions_and_spatial_relations.layout_claim_status==='UNKNOWN')constraints.push('Site-wide layout remains unknown even when individual visible features are documented.');
  return unique(constraints);
}

function sceneConstraints(handoff:FacilityProductionHandoff,candidate:Candidate,text:string){
  const {stage,beat}=candidate;
  const moduleIds=unique([stage.geometry_control.primary_facility_module_id,stage.geometry_control.secondary_facility_module_ids]);
  const modules=handoff.facility_modules.filter(module=>moduleIds.includes(module.module_id));
  const environment=handoff.environments.find(item=>item.environment_id===candidate.environmentRef);
  const required=unique([beat.must_show,stage.present_now,stage.temporarily_exposed,stage.temporary_works_present,stage.geometry_control.required_visible_anchors,modules.map(module=>module.required_visible_features),stage.visual_evidence.confirmed_visual_details,stage.stage_visual_summary]);
  const forbidden=unique([beat.must_not_show,beat.negative_constraints,stage.not_yet_built_or_installed,stage.geometry_control.negative_constraints,stage.geometry_control.forbidden_transformations,stage.visual_evidence.excluded_visual_claims,environment?.forbidden_elements,modules.map(module=>module.forbidden_layout_claims),modules.map(module=>module.likely_wrong_substitutions),SECURITY_EXCLUSIONS]);
  if(stage.facility_state_code==='A')forbidden.push('completed tunnel','concrete lining before excavation','finished internal systems','permanent installed equipment','completed operational facility');
  if(stage.facility_state_code==='B'&&!historicalCue(text))forbidden.push('untouched pre-construction terrain presented as the current state','pristine completed operational facility');
  if(stage.facility_state_code==='C'&&beat.visual_family==='ABANDONMENT_OR_REMAINS')forbidden.push('pristine active operational condition','newly completed finishes');
  return {moduleIds,required:unique(required),forbidden:unique(forbidden),truth:truthConstraints(handoff,beat),continuity:unique([beat.continuity_requirements,stage.continuity.features_that_must_remain_consistent,stage.continuity.forbidden_regressions])};
}

const GRAPHIC_COMPOSITION:Record<GraphicSubtype,GraphicComposition>={
  SITE_CROSS_SECTION:'ORTHOGRAPHIC_CUTAWAY',TERRAIN_OVERBURDEN:'ORTHOGRAPHIC_CUTAWAY',EXCAVATION_PROGRESSION:'LEFT_TO_RIGHT_FLOW',TUNNEL_SEQUENCE:'LEFT_TO_RIGHT_FLOW',STRUCTURAL_LAYER:'LAYERED_SEPARATION',VENTILATION_FLOW:'ORTHOGRAPHIC_CUTAWAY',DRAINAGE_FLOW:'ORTHOGRAPHIC_CUTAWAY',CONSTRUCTION_TIMELINE:'LEFT_TO_RIGHT_FLOW',CONCEPTUAL_FACILITY_RELATIONSHIP:'ORTHOGRAPHIC_CUTAWAY',SCALE_COMPARISON:'TWO_PANEL_COMPARISON',
};
const GRAPHIC_MOTION:Record<GraphicSubtype,GraphicMotionPattern>={
  SITE_CROSS_SECTION:'MINIMAL_PARALLAX',TERRAIN_OVERBURDEN:'LAYER_SEPARATION',EXCAVATION_PROGRESSION:'FLOW_DRAW_ON',TUNNEL_SEQUENCE:'FLOW_DRAW_ON',STRUCTURAL_LAYER:'LAYER_SEPARATION',VENTILATION_FLOW:'FLOW_DRAW_ON',DRAINAGE_FLOW:'FLOW_DRAW_ON',CONSTRUCTION_TIMELINE:'FLOW_DRAW_ON',CONCEPTUAL_FACILITY_RELATIONSHIP:'HIGHLIGHT_PULSE',SCALE_COMPARISON:'MINIMAL_PARALLAX',
};
const GRAPHIC_ANNOTATIONS:Record<GraphicSubtype,GraphicAnnotationDevice[]>={
  SITE_CROSS_SECTION:['COLORED_ZONE','FLOW_LINES'],TERRAIN_OVERBURDEN:['MEASUREMENT_BASELINE','COLORED_ZONE'],EXCAVATION_PROGRESSION:['DIRECTIONAL_ARROWS','COLORED_ZONE'],TUNNEL_SEQUENCE:['DIRECTIONAL_ARROWS','FLOW_LINES'],STRUCTURAL_LAYER:['COLORED_ZONE','DIRECTIONAL_ARROWS'],VENTILATION_FLOW:['FLOW_LINES','DIRECTIONAL_ARROWS'],DRAINAGE_FLOW:['FLOW_LINES','DIRECTIONAL_ARROWS'],CONSTRUCTION_TIMELINE:['DIRECTIONAL_ARROWS'],CONCEPTUAL_FACILITY_RELATIONSHIP:['FLOW_LINES','HIGHLIGHT_RING'],SCALE_COMPARISON:['MEASUREMENT_BASELINE'],
};

function graphicSubtypeFor(value:string):GraphicSubtype {
  if(/\b(ventilation|airflow|air supply|fresh air|exhaust air)\b/i.test(value))return 'VENTILATION_FLOW';
  if(/\b(drainage|groundwater|water flow|sump|leak)\b/i.test(value))return 'DRAINAGE_FLOW';
  if(/\b(overburden|depth|mountain above|terrain layer|rock cover)\b/i.test(value))return 'TERRAIN_OVERBURDEN';
  if(/\b(drill|blast|excavat|spoil|muck|rock removal)\b/i.test(value))return 'EXCAVATION_PROGRESSION';
  if(/\b(surface.*(?:tunnel|chamber)|relationship|spatial|conceptual|cutaway|cross.section)\b/i.test(value))return 'CONCEPTUAL_FACILITY_RELATIONSHIP';
  if(/\b(tunnel|portal|tbm|breakthrough|shotcrete|rock bolt)\b/i.test(value))return 'TUNNEL_SEQUENCE';
  if(/\b(concrete|lining|waterproof|structural layer|reinforcement|steel|slab)\b/i.test(value))return 'STRUCTURAL_LAYER';
  if(/\b(timeline|chronolog|construction period|sequence of stages)\b/i.test(value))return 'CONSTRUCTION_TIMELINE';
  if(/\b(scale|size|dimension|compare|comparison|depth)\b/i.test(value))return 'SCALE_COMPARISON';
  return 'SITE_CROSS_SECTION';
}

export function deriveGraphicSceneSpec(topic:TopicBrief|null|undefined,scene:TimedScene,plan:Pick<PlannedScene,'beat_id'|'visual_family'|'visual_treatment'> & Partial<Pick<PlannedScene,'layout_claim_status'|'reference_asset_ids'>>):GraphicSceneSpec|null {
  if(plan.visual_treatment!=='STATIC_GRAPHIC_T2V'&&plan.visual_treatment!=='MOTION_GRAPHIC_T2V')return null;
  const handoff=topic?._production_handoff as FacilityProductionHandoff|undefined;
  const beat=handoff?.visual_story_plan.chapters.flatMap(chapter=>chapter.visual_beats).find(item=>item.beat_id===plan.beat_id);
  const source=[scene.text,beat?.beat_name,beat?.narrative_purpose,...(beat?.semantic_alignment_terms||[]),plan.visual_family].filter(Boolean).join(' ');
  const subtype=graphicSubtypeFor(source),layout=plan.layout_claim_status||beat?.layout_claim_status||'UNKNOWN';
  const claim=(beat?.narrative_purpose||scene.text||'Show one supported facility relationship').split(/(?<=[.!?])\s+|\s*;\s*/)[0].slice(0,180).trim();
  return {graphic_subtype:subtype,visual_claim:claim,composition:GRAPHIC_COMPOSITION[subtype],motion_pattern:plan.visual_treatment==='STATIC_GRAPHIC_T2V'?'MINIMAL_PARALLAX':GRAPHIC_MOTION[subtype],annotation_devices:GRAPHIC_ANNOTATIONS[subtype].slice(0,2),palette_profile:'PREMIUM_TECHNICAL_VECTOR',maximum_animated_elements:plan.visual_treatment==='STATIC_GRAPHIC_T2V'?1:3,transition_anchor:null,text_policy:'NO_GENERATED_TEXT',layout_claim_status:layout,not_to_scale:layout==='CONCEPTUAL_RELATIONSHIP_ONLY'||layout==='UNKNOWN',reference_asset_ids:plan.reference_asset_ids||beat?.reference_asset_ids||[]};
}

export function resolvePlannedState(topic:TopicBrief|null|undefined,stageId:string):'A'|'B'|'C' {
  const raw=(topic?._production_handoff as FacilityProductionHandoff|undefined)?.construction_stages.find(stage=>stage.stage_id===stageId)?.facility_state_code;
  const legacy=topic?.lifecycle_stages?.find(stage=>stage.stage_id===stageId)?.state;
  return raw||legacy||'A';
}

export function buildDocumentaryScenePlan(topic:TopicBrief,scenes:TimedScene[]):PlannedScene[] {
  const handoff=facilityHandoff(topic),candidates=candidatesFor(handoff);if(!candidates.length)throw new Error('The facility handoff contains no usable visual beats.');
  const chapters=alignChapters(handoff,scenes),plan:PlannedScene[]=[];
  for(let index=0;index<scenes.length;index++){
    const scene=scenes[index],chapter=chapters[index],words=tokenize(scene.text),previous=plan.at(-1),historic=historicalCue(scene.text);
    let pool=candidates.filter(candidate=>candidate.chapter.chapter_id===chapter.chapter_id&&familyAllowedForStage(candidate.beat.visual_family,candidate.stage.facility_state_code,scene.text));
    if(previous&&!historic)pool=pool.filter(candidate=>STATE_RANK[candidate.stage.facility_state_code]>=STATE_RANK[previous.state]);
    if(!pool.length)pool=candidates.filter(candidate=>familyAllowedForStage(candidate.beat.visual_family,candidate.stage.facility_state_code,scene.text)&&(!previous||historic||STATE_RANK[candidate.stage.facility_state_code]>=STATE_RANK[previous.state]));
    if(!pool.length)throw new Error(`No chronology-safe facility visual opportunity is available for scene ${scene.number}.`);
    const recent=plan.filter(item=>item.number>=scene.number-Math.max(2,Math.ceil(60/Math.max(scene.duration,1))));
    const ranked=pool.map(candidate=>{
      const beatText=`${candidate.beat.beat_name} ${candidate.beat.narrative_purpose} ${candidate.beat.semantic_alignment_terms.join(' ')} ${candidate.stage.stage_name} ${candidate.stage.stage_visual_summary}`;
      let score=overlap(words,tokenize(beatText))*13+cueScore(scene.text,candidate.beat.visual_family,candidate.beat.story_function);
      if(candidate.treatment==='REFERENCE_MEDIA'&&historicalCue(scene.text))score+=24;
      if(candidate.beat.visual_family==='ABANDONMENT_OR_REMAINS'&&/\b(today|abandoned|remains|ruins?|preserved|museum)\b/i.test(scene.text))score+=30;
      if(previous?.beat_id===candidate.beat.beat_id)score+=4;
      const sameRun=[...plan].reverse().findIndex(item=>item.visual_family!==candidate.beat.visual_family);const run=sameRun===-1?plan.length:sameRun;
      if(run>=2)score-=Math.min(20,(run-1)*6);
      const recentCount=recent.filter(item=>item.visual_family===candidate.beat.visual_family).length;if(recentCount>=2)score-=recentCount*3;
      if(!recent.some(item=>item.visual_family===candidate.beat.visual_family))score+=3;
      if(scene.duration<candidate.beat.minimum_usable_duration_seconds)score-=30;
      return {candidate,score};
    }).sort((a,b)=>b.score-a.score||a.candidate.beat.beat_order-b.candidate.beat.beat_order||a.candidate.stage.stage_number-b.candidate.stage.stage_number);
    const chosen=ranked[0].candidate,beat=chosen.beat,constraints=sceneConstraints(handoff,chosen,scene.text);
    const item:PlannedScene={number:scene.number,chapter_id:chapter.chapter_id,beat_id:beat.beat_id,visual_family:beat.visual_family,story_function:beat.story_function,visual_treatment:chosen.treatment,facility_visibility:beat.facility_visibility,stage_id:chosen.stage.stage_id,environment_ref:chosen.environmentRef,state:chosen.stage.facility_state_code,energy_level:['EXCAVATION_AND_BLASTING','ROCK_REMOVAL','MACHINERY_ACTION','ENVIRONMENTAL_CHALLENGE'].includes(beat.visual_family)?'HIGH':['ARCHIVAL_REFERENCE','MAP_OR_TIMELINE','ATMOSPHERIC_INTERSTITIAL'].includes(beat.visual_family)?'LOW':'MEDIUM',facility_claim_status:beat.facility_claim_status,layout_claim_status:beat.layout_claim_status,generation_permission:beat.generation_permission,preferred_media_routes:[...beat.preferred_media_routes],reference_asset_ids:[...beat.reference_asset_ids],exact_site_claim_allowed:beat.exact_site_claim_allowed,exact_layout_claim_allowed:beat.exact_layout_claim_allowed,facility_module_ids:constraints.moduleIds,required_visible_features:constraints.required,forbidden_elements:constraints.forbidden,truth_constraints:constraints.truth,continuity_requirements:constraints.continuity,graphic_spec:null};
    item.graphic_spec=deriveGraphicSceneSpec(topic,scene,item);plan.push(item);
  }
  return plan;
}

export function buildFacilityBatchContext(topic:TopicBrief,planBatch:PlannedScene[]){
  const handoff=facilityHandoff(topic),stageIds=new Set(planBatch.map(item=>item.stage_id)),environmentIds=new Set(planBatch.map(item=>item.environment_ref)),beatIds=new Set(planBatch.map(item=>item.beat_id)),referenceIds=new Set(planBatch.flatMap(item=>item.reference_asset_ids)),moduleIds=new Set(planBatch.flatMap(item=>item.facility_module_ids));
  return {schema:handoff.schema,facility:handoff.facility,historical_context:handoff.historical_context,site_dimensions_and_spatial_relations:handoff.site_dimensions_and_spatial_relations,facility_modules:handoff.facility_modules.filter(module=>moduleIds.has(module.module_id)),construction_stages:handoff.construction_stages.filter(stage=>stageIds.has(stage.stage_id)),environments:handoff.environments.filter(environment=>environmentIds.has(environment.environment_id)),selected_beats:handoff.visual_story_plan.chapters.flatMap(chapter=>chapter.visual_beats).filter(beat=>beatIds.has(beat.beat_id)),reference_assets:handoff.reference_assets.filter(asset=>referenceIds.has(asset.asset_id)),sensitivity_and_truth_policy:handoff.sensitivity_and_truth_policy,global_prompt_rules:handoff.global_prompt_rules};
}

export function summarizeScenePlan(plan:PlannedScene[]){
  const count=(key:keyof PlannedScene)=>Object.entries(plan.reduce<Record<string,number>>((result,item)=>{const value=String(item[key]);result[value]=(result[value]||0)+1;return result;},{})).sort((a,b)=>b[1]-a[1]);
  const graphic=plan.filter(item=>item.graphic_spec),reference=plan.filter(item=>item.visual_treatment==='REFERENCE_MEDIA');
  const graphicSubtypes=Object.entries(graphic.reduce<Record<string,number>>((result,item)=>{const key=String(item.graphic_spec?.graphic_subtype);result[key]=(result[key]||0)+1;return result;},{})).sort((a,b)=>b[1]-a[1]);
  return {families:count('visual_family'),treatments:count('visual_treatment'),visibility:count('facility_visibility'),energy:count('energy_level'),states:count('state'),graphicSubtypes,graphicScenes:graphic.length,referenceScenes:reference.length};
}
