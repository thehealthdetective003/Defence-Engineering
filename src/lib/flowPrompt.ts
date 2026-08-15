import type { SceneDirection, T2VPromptProfile, TopicBrief } from '../types';
import {
  facilityIdentityClause,
  facilityNegativeConstraints,
  facilityPhysicsClause,
  facilityRouteClause,
  facilitySoundClause,
  facilityStateClause,
  facilityTruthClause,
  resolveFacilityScene,
  uniqueFacilityTerms,
} from './facilityPromptPolicy';

const words=(value:string)=>value.trim().split(/\s+/).filter(Boolean);
const truncateWords=(value:string,limit:number)=>{const parts=words(value);return parts.length>limit?`${parts.slice(0,limit).join(' ').replace(/[,:;|]+$/,'')}.`:value.trim();};

export function normalizeConstraintList(value:unknown):string[]{return uniqueFacilityTerms([value]);}

export function compactIdentity(topic:TopicBrief|null):string {
  const handoff=topic?._production_handoff,lock=topic?.facility_identity_lock;
  const candidates=typeof topic?.visual_lock==='string'&&topic.visual_lock.trim()?[topic.visual_lock.split('|').slice(0,6).join(', ')]:[lock?.core_geometry,lock?.surface_finish,lock?.scale_reference,lock?.distinctive_features,handoff?.facility.overall_visual_description,handoff?.facility.immutable_identity_features];
  return truncateWords(normalizeConstraintList(candidates).join(', '),52);
}

export function relevantNegatives(direction:SceneDirection,topic:TopicBrief|null):string[]{
  const resolved=resolveFacilityScene(topic,direction);
  return facilityNegativeConstraints(resolved,direction);
}

export function profileInstruction(profile:T2VPromptProfile):string {
  const common=`Return one concise video_prompt per supplied scene. The application adds duration, authoritative construction state, facility identity, site/layout truth, media routing, construction physics, synchronized ambience, and exclusions, so do not repeat those blocks. Use one primary action and one physically accessible camera movement. Preserve present works, absent future works, temporary works, exposed geology, open interfaces, spoil state, and installed infrastructure exactly as supplied. Never auto-complete construction. When graphic_spec is present, communicate only its supported facility claim within its layout status. Never include voiceover, labels, JSON, headings, or abstract narration.`;
  return profile==='omni-flash'?`Write natural documentary directions optimized for Gemini Omni Flash, emphasizing credible construction progression, material response, and restrained camera behavior. ${common}`:`Write compact cinematography directions optimized for Veo in Google Flow, emphasizing facility composition, credible machinery and worker motion, geology, construction materials, environmental response, and continuity. ${common}`;
}

export function buildFocusedFacilityContext(topic:TopicBrief|null,directions:SceneDirection[]){
  const handoff=topic?._production_handoff;if(!handoff)return null;
  const stageIds=new Set(directions.map(item=>item.stage_id)),environmentIds=new Set(directions.map(item=>item.environment_ref)),moduleIds=new Set(directions.flatMap(item=>item.facility_module_ids||[])),referenceIds=new Set(directions.flatMap(item=>item.reference_asset_ids||[])),beatIds=new Set(directions.map(item=>item.beat_id).filter(Boolean));
  const stages=handoff.construction_stages.filter(stage=>stageIds.has(stage.stage_id));
  stages.forEach(stage=>{stage.environment_ids.forEach(id=>environmentIds.add(id));moduleIds.add(stage.geometry_control.primary_facility_module_id);stage.geometry_control.secondary_facility_module_ids.forEach(id=>moduleIds.add(id));stage.visual_evidence.reference_asset_ids.forEach(id=>referenceIds.add(id));});
  return {schema:handoff.schema,facility:handoff.facility,historical_context:handoff.historical_context,site_dimensions_and_spatial_relations:handoff.site_dimensions_and_spatial_relations,facility_modules:handoff.facility_modules.filter(module=>moduleIds.has(module.module_id)),construction_stages:stages,environments:handoff.environments.filter(environment=>environmentIds.has(environment.environment_id)),selected_beats:handoff.visual_story_plan.chapters.flatMap(chapter=>chapter.visual_beats).filter(beat=>beatIds.has(beat.beat_id)),reference_assets:handoff.reference_assets.filter(asset=>referenceIds.has(asset.asset_id)),media_routing_policy:handoff.visual_story_plan.media_routing_policy,sensitivity_and_truth_policy:handoff.sensitivity_and_truth_policy,global_prompt_rules:handoff.global_prompt_rules};
}

function stripInjectedClauses(value:string):string{return value.replace(/(?:exact\s+)?\d+(?:\.\d+)?[-\s]second(?:\s+continuous)?\s+shot[.:]?/gi,' ').replace(/\b(?:global negatives?|forbidden elements?|required visible features?|visual lock verbatim)\s*:[^.!?]*(?:[.!?]|$)/gi,' ').replace(/\[object Object\]/gi,' ').replace(/\s+/g,' ').trim();}
const graphicComposition=(value:string):string=>({SINGLE_SUBJECT:'one dominant simplified facility element with generous negative space',ORTHOGRAPHIC_CUTAWAY:'a clear orthographic cross-section with supported layers separated',LEFT_TO_RIGHT_FLOW:'a clean left-to-right construction sequence',LAYERED_SEPARATION:'separated terrain or structural layers on one stable axis',TWO_PANEL_COMPARISON:'two balanced text-free panels on one shared baseline',CONCENTRIC_SIGNAL_FIELD:'one abstract flow field without interface styling',SYMBOLIC_ROUTE:'a broad conceptual relationship without cartographic or access detail',MATCHED_SHAPE_TRANSITION:'one stable centered geometry'} as Record<string,string>)[value]||'one clear facility-technical composition';
const graphicMotion=(value:string):string=>({MINIMAL_PARALLAX:'use only minimal parallax and one restrained emphasis pulse',HIGHLIGHT_PULSE:'pulse one clean highlight once',FLOW_DRAW_ON:'draw one directional construction or utility flow progressively',COMPONENT_TRANSLATION:'move one construction element along one credible path',LAYER_SEPARATION:'separate supported layers gently while preserving alignment',SIGNAL_SWEEP:'move one abstract flow indicator while geometry stays fixed',HEAT_ZONE_PROGRESSION:'progress one restrained environmental zone through the supported relationship'} as Record<string,string>)[value]||'keep all major geometry stable';

function graphicBody(direction:SceneDirection):string {
  const spec=direction.graphic_spec;if(!spec)return '';
  const layout=spec.layout_claim_status==='EXACT_LAYOUT_VERIFIED'?'Use only the exact documented relationship in cited references.':spec.layout_claim_status==='PARTIAL_LAYOUT_VERIFIED'?'Show only the verified portion; leave everything else unspecified.':spec.layout_claim_status==='CONCEPTUAL_RELATIONSHIP_ONLY'?'Use simplified non-to-scale conceptual geometry and never imply an exact floor plan.':'Do not render an internal layout or exact cutaway; use a non-spatial process or terrain concept.';
  return `Create a premium 16:9 flat technical-vector ${spec.graphic_subtype.toLowerCase().replaceAll('_',' ')} for one claim: ${spec.visual_claim}. Use ${graphicComposition(spec.composition)}; ${graphicMotion(spec.motion_pattern)}. Animate no more than ${spec.maximum_animated_elements} elements, keep the background and major geometry fixed, then hold the resolved graphic for the final quarter. ${layout} No readable labels, fake dimensions, pseudo-technical interfaces, map labels, logos, or invented rooms.`;
}

export function finalizeFlowPrompt(generated:string,direction:SceneDirection,topic:TopicBrief|null,profile:T2VPromptProfile):string {
  const resolved=resolveFacilityScene(topic,direction),prefix=`${Number(direction.duration.toFixed(3))}-second continuous shot.`;
  const reference=direction.visual_treatment==='REFERENCE_MEDIA';
  const body=direction.graphic_spec?graphicBody(direction):reference?facilityRouteClause(resolved,direction):truncateWords(stripInjectedClauses(generated),80);
  const positive=[facilityIdentityClause(resolved,direction),facilityStateClause(resolved,direction),facilityTruthClause(resolved,direction),reference?'':facilityRouteClause(resolved,direction),reference?'':facilityPhysicsClause(resolved,direction)].filter(Boolean).join(' ');
  const negatives=relevantNegatives(direction,topic).map(value=>value.replace(/^(?:no|avoid|without|do not (?:show|include))\s+/i,'')).join(', ');
  const negativeClause=negatives?(profile==='veo-flow'?`Negative prompt: ${truncateWords(negatives,70)}`:`Exclude ${truncateWords(negatives,70)}`):'';
  return [prefix,body,positive,facilitySoundClause(resolved,direction),'Exclude dialogue, narration, music, and readable generated text.',negativeClause].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}

export function buildFlowContext(topic:TopicBrief|null,directions:SceneDirection[],profile:T2VPromptProfile){
  return {target_profile:profile,facility_identity:compactIdentity(topic),cinematography_rules:topic?.cinematography_rules,continuity_rules:topic?.scene_continuity_rules,authoritative_facility_handoff:buildFocusedFacilityContext(topic,directions),scenes:directions.map(direction=>({...direction,relevant_forbidden_elements:relevantNegatives(direction,topic)}))};
}
