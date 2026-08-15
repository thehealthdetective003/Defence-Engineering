import type { OmniPromptSections, SceneDirection, T2VPrompt, TopicBrief } from '../types';
import {
  facilityIdentityClause,
  facilityNegativeConstraints,
  facilityPhysicsClause,
  facilityRouteClause,
  facilitySoundClause,
  facilityStateClause,
  facilityTruthClause,
  resolveFacilityScene,
  type ResolvedFacilityScene,
  uniqueFacilityTerms,
} from './facilityPromptPolicy';

const clean=(value:unknown)=>String(value??'').replace(/\[object Object\]/gi,'').replace(/\s+/g,' ').trim();
const key=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const sentence=(value:unknown):string=>{let text=clean(value).replace(/\s+([,.;:!?])/g,'$1').replace(/([,.;:!?])\1+/g,'$1').replace(/\s*[,;:]\s*$/,'').trim();text=text.replace(/\b(?:and|or|of|for|on|the|with|to|from|while|but|a|an)\s*[.!?]?$/i,'').trim();if(!text)return '';text=text[0].toUpperCase()+text.slice(1);return /[.!?]$/.test(text)?text:`${text}.`;};
const list=(values:string[])=>values.length<2?(values[0]||''):values.length===2?`${values[0]} and ${values[1]}`:`${values.slice(0,-1).join(', ')}, and ${values.at(-1)}`;

const scaleMap:Array<[RegExp,string]>=[[/\bextreme\s+wide\b/i,'extreme-wide'],[/\bmedium\s+close\s*up\b/i,'medium close-up'],[/\bmedium\s+wide\b/i,'medium-wide'],[/\bclose\s*up\b/i,'close-up'],[/\bmacro\b/i,'macro close-up'],[/\bwide\b/i,'wide'],[/\bmedium\b/i,'medium']];
const movementMap:Array<[RegExp,string]>=[[/\b(?:lock(?:ed)?|static|stationary|tripod)\b/i,'locked camera'],[/\bpan\b/i,'slow pan'],[/\b(?:push|move)\s*-?in\b/i,'slow push-in'],[/\b(?:pull|move)\s*-?back\b/i,'slow pull-back'],[/\b(?:crane|rise|aerial)\b/i,'restrained crane rise'],[/\blateral\s+dolly\b/i,'slow lateral dolly'],[/\blateral\s+(?:track|tracking)\b/i,'slow lateral tracking movement'],[/\bdolly\b/i,'slow dolly'],[/\btrack(?:ing)?\b|\bfollow(?:ing)?\b/i,'restrained tracking movement']];
const mapped=(value:string,map:Array<[RegExp,string]>)=>map.find(([pattern])=>pattern.test(value))?.[1];
const normalized=(value:unknown)=>clean(value).toLowerCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ').trim();

export interface ResolvedFacilityPromptScene extends ResolvedFacilityScene {
  identity:string[];
  camera:{shotScale:string;lens:string;viewpoint:string;behavior:string;speed:string;movementCount:number;contradictions:string[]};
}

export function resolveFacilityPromptScene(topic:TopicBrief|null,direction:SceneDirection):ResolvedFacilityPromptScene {
  const resolved=resolveFacilityScene(topic,direction),guidance=resolved.stage.camera_guidance;
  const allowedScales=(guidance?.safe_shot_scales||[]).map(value=>mapped(normalized(value),scaleMap)).filter(Boolean) as string[];
  const allowedMovements=(guidance?.preferred_camera_movements||[]).map(value=>mapped(normalized(value),movementMap)).filter(Boolean) as string[];
  const forbidden=(guidance?.forbidden_camera_movements||[]).map(normalized);
  const scaleInput=normalized(direction.camera.shot_scale),lensInput=normalized(direction.camera.lens),viewpoint=normalized(direction.camera.angle)||(guidance?.preferred_views||[]).map(normalized)[0]||'side profile',movementInput=normalized(direction.camera.movement);
  const rawMovements=movementMap.filter(([pattern])=>pattern.test(movementInput)).map(([,label])=>label);
  const directionMovements=rawMovements.includes('slow lateral tracking movement')?rawMovements.filter(item=>item!=='restrained tracking movement'):rawMovements.includes('slow lateral dolly')?rawMovements.filter(item=>item!=='slow dolly'):rawMovements;
  const contradictions:string[]=[];
  const cameraText=`${scaleInput} ${lensInput} ${viewpoint} ${movementInput}`;
  if(/static|locked/.test(cameraText)&&/track|dolly|pan|push|pull|crane/.test(cameraText))contradictions.push('Locked/static camera conflicts with camera movement.');
  if(/macro/.test(cameraText)&&/wide|medium-wide/.test(cameraText))contradictions.push('Macro conflicts with a wide shot scale.');
  const requestedScale=mapped(scaleInput,scaleMap),shotScale=requestedScale&&(!allowedScales.length||allowedScales.includes(requestedScale))?requestedScale:(allowedScales[0]||'medium-wide');
  const focal=lensInput.match(/\b(\d{2,3})\s*mm\b/)?.[1];
  const lens=focal?(Number(focal)<=35?'wide-angle':Number(focal)<=60?'normal':Number(focal)<=100?'short telephoto':'long telephoto'):/wide/.test(lensInput)?'wide-angle':/long\s+telephoto/.test(lensInput)?'long telephoto':/telephoto/.test(lensInput)?'short telephoto':'normal';
  const movementConflict=directionMovements.length>1||(/static|locked|tripod/.test(movementInput)&&/track|dolly|pan|push|pull|crane/.test(movementInput));
  let behavior=(!movementConflict?directionMovements[0]:undefined)||(allowedMovements[0]||'locked camera');
  const movementWords=key(behavior).split(' ').filter(word=>!['slow','restrained','camera','movement'].includes(word));
  if(forbidden.some(item=>movementWords.some(word=>item.includes(word))))behavior='locked camera';
  const identity=uniqueFacilityTerms([direction.required_visible_features,resolved.stage.geometry_control?.required_visible_anchors||[],resolved.modules.flatMap(module=>module.required_visible_features),resolved.handoff?.facility.immutable_identity_features||[]]).slice(0,6);
  return {...resolved,identity,camera:{shotScale,lens,viewpoint,behavior,speed:/^(?:none|n\/a|static|locked)?$/i.test(clean(direction.camera.movement_speed))?'':normalized(direction.camera.movement_speed),movementCount:directionMovements.length,contradictions}};
}

export function canonicalFacilityIdentity(topic:TopicBrief|null):string {
  const handoff=topic?._production_handoff,facility=handoff?.facility;
  if(!facility)return 'Preserve only documented facility geometry; do not invent site identity or layout.';
  const anchors=uniqueFacilityTerms([facility.overall_visual_description,facility.immutable_identity_features,handoff.facility_modules.find(module=>module.module_id==='FACILITY_WHOLE')?.required_visible_features||[],handoff.site_dimensions_and_spatial_relations.terrain_relationships]).slice(0,7);
  return anchors.length?`Preserve the documented ${facility.facility_class||'facility'} identity: ${list(anchors)}.`:`Preserve the documented facility geometry without inventing site identity or layout.`;
}

const graphicComposition=(value:string):string=>({SINGLE_SUBJECT:'one dominant simplified facility element with generous negative space',ORTHOGRAPHIC_CUTAWAY:'a clear orthographic cross-section with supported layers kept separate',LEFT_TO_RIGHT_FLOW:'a clean left-to-right construction sequence',LAYERED_SEPARATION:'parallel terrain or structural layers separated along one stable axis',TWO_PANEL_COMPARISON:'two balanced text-free panels on one shared baseline',CONCENTRIC_SIGNAL_FIELD:'one abstract flow field without interface styling',SYMBOLIC_ROUTE:'a broad conceptual route without cartographic or access detail',MATCHED_SHAPE_TRANSITION:'one stable centered geometry'} as Record<string,string>)[value]||'one clear facility-technical composition';
const graphicMotion=(value:string):string=>({MINIMAL_PARALLAX:'Use only minimal parallax and one restrained emphasis pulse',HIGHLIGHT_PULSE:'Pulse one clean highlight once around the supported feature',FLOW_DRAW_ON:'Draw one directional construction or utility flow progressively',COMPONENT_TRANSLATION:'Move one construction element along one physically credible path',LAYER_SEPARATION:'Separate supported layers gently while preserving alignment',SIGNAL_SWEEP:'Move one abstract flow indicator while geometry stays fixed',HEAT_ZONE_PROGRESSION:'Progress one restrained environmental zone through the supported relationship'} as Record<string,string>)[value]||'Keep all major geometry stable';
const annotations=(values:string[])=>values.map(value=>({DIRECTIONAL_ARROWS:'simple directional arrows',FLOW_LINES:'clean flow lines',HIGHLIGHT_RING:'one highlight ring',COLORED_ZONE:'one colored zone',SIGNAL_WAVES:'abstract flow waves',MEASUREMENT_BASELINE:'an unlabeled scale baseline'} as Record<string,string>)[value]).filter(Boolean).join(' and ');

function graphicClause(direction:SceneDirection):string {
  const spec=direction.graphic_spec;if(!spec)return '';
  const layout=spec.layout_claim_status==='EXACT_LAYOUT_VERIFIED'?'Use only the exact documented relationship in the cited references.':spec.layout_claim_status==='PARTIAL_LAYOUT_VERIFIED'?'Show only the verified portion and leave all other spatial arrangement absent.':spec.layout_claim_status==='CONCEPTUAL_RELATIONSHIP_ONLY'?'Use simplified non-to-scale conceptual geometry; never imply an exact floor plan.':'Do not render an internal layout or exact cutaway; reduce the graphic to a non-spatial process or terrain concept.';
  return `Create a premium 16:9 flat technical-vector ${spec.graphic_subtype.toLowerCase().replaceAll('_',' ')} for one claim: ${spec.visual_claim}. Use ${graphicComposition(spec.composition)}${annotations(spec.annotation_devices)?` with ${annotations(spec.annotation_devices)}`:''}. ${graphicMotion(spec.motion_pattern)}; animate no more than ${spec.maximum_animated_elements} elements, keep the background and main geometry fixed, and hold the resolved graphic during the final quarter. ${layout} No readable generated labels, fake dimensions, pseudo-technical interfaces, map labels, logos, or invented rooms.`;
}

export function normalizeOmniSections(raw:any,direction:SceneDirection,topic:TopicBrief|null):{sections:OmniPromptSections;resolved:ResolvedFacilityPromptScene} {
  const resolved=resolveFacilityPromptScene(topic,direction),graphic=graphicClause(direction);
  const temporal=direction.temporal_action;
  const progression=temporal?`${temporal.opening_state}. ${temporal.primary_motion}; ${temporal.physical_interaction}. Mid-shot, ${temporal.mid_shot_progression}. End with ${temporal.ending_state}.`:direction.primary_action;
  const route=facilityRouteClause(resolved,direction),truth=facilityTruthClause(resolved,direction),physics=facilityPhysicsClause(resolved,direction);
  const reference=direction.visual_treatment==='REFERENCE_MEDIA';
  const sections:OmniPromptSections={
    cinematography:graphic?'Use a stable orthographic 16:9 technical composition with no orbit, lens change, or artificial depth distortion.':reference?'Use restrained editorial framing of the cited source asset; preserve its aspect, crop, grain, and documentary provenance.':clean(raw?.cinematography)||`Use a ${resolved.camera.shotScale} ${resolved.camera.viewpoint} view on a ${resolved.camera.lens} lens with one ${resolved.camera.behavior}${resolved.camera.speed?` at ${resolved.camera.speed} speed`:''}. Keep the camera in physically accessible space; never pass through rock, lining, walls, roofs, or sealed chambers.`,
    subject:graphic?`A facility-native ${direction.graphic_spec?.graphic_subtype.toLowerCase().replaceAll('_',' ')} technical graphic`:clean(raw?.subject)||direction.subject,
    action:graphic?`${graphic} ${route}`:reference?route:`${progression} ${physics}`,
    environment:graphic?'Use a clean neutral technical field with no literal interface, readable map, or fabricated site detail.':`${clean(raw?.environment)||direction.environment_description}. ${truth}`,
    style_lighting:graphic?'Use geometric silhouettes, restrained outlines, two- or three-tone cel shading, pale cyan and cool gray with one red annotation accent and limited yellow-orange only for active material flow.':clean(raw?.style_lighting)||direction.lighting_and_material,
    facility_state:`${facilityIdentityClause(resolved,direction)} ${facilityStateClause(resolved,direction)} ${route}`,
    sound:facilitySoundClause(resolved,direction),
    exclusions:list(facilityNegativeConstraints(resolved,direction)),
  };
  return {sections,resolved};
}

export function compileOmniPrompt(sections:OmniPromptSections,direction:SceneDirection):string {
  const parts=[`${Number(direction.duration.toFixed(3))}-second continuous shot.`,sentence(sections.cinematography),sentence(sections.subject),sentence(sections.action),sentence(sections.environment),sentence(sections.style_lighting),sentence(sections.facility_state),sentence(sections.sound),sentence('Exclude dialogue, narration, music, and readable generated text'),sections.exclusions?sentence(`Exclude ${sections.exclusions.replace(/^(?:exclude|no|avoid)\s+/i,'')}`):''];
  const seen=new Set<string>();return parts.filter(Boolean).filter(part=>{const normalized=key(part);if(seen.has(normalized))return false;seen.add(normalized);return true;}).join(' ').replace(/\s+/g,' ').replace(/\.\s*\./g,'.').replace(/Exclude\s+(?:Do not|No|Avoid)\s+/gi,'Exclude ').trim();
}

export function recompileOmniPrompts(prompts:T2VPrompt[],directions:SceneDirection[],topic:TopicBrief|null):T2VPrompt[] {
  const byNumber=new Map(directions.map(direction=>[direction.number,direction]));
  return prompts.map(prompt=>{const direction=byNumber.get(prompt.number);if(!direction)return prompt;const {sections}=normalizeOmniSections(prompt.omniSections||{},direction,topic);return {...prompt,video_prompt:compileOmniPrompt(sections,direction),voiceover:direction.voiceover,omniSections:sections};});
}
