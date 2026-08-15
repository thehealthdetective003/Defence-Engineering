import assert from 'node:assert/strict';
import test from 'node:test';
import type { SceneDirection } from '../types';
import { normalizeFacilityHandoff } from './productionTemplate';
import { createFacilityPipelineHandoff } from './testFixtures/facilityPipelineFixture';
import { canonicalFacilityIdentity, compileOmniPrompt, normalizeOmniSections, recompileOmniPrompts, resolveFacilityPromptScene } from './omniPromptCompiler';

const topic=normalizeFacilityHandoff(createFacilityPipelineHandoff());
const temporal_action={opening_state:'The exposed granite face is still',primary_motion:'The drill advances into the rock',physical_interaction:'The drill bit contacts granite',mid_shot_progression:'Broken rock falls below the face',ending_state:'The drill retracts while spoil remains contained'};
const direction:SceneDirection={number:1,start:0,end:10,duration:10,voiceover:'Drilling opened the first excavation.',silent:false,chapter_id:'CH01',beat_id:'EXCAVATION',visual_family:'EXCAVATION_AND_BLASTING',story_function:'INTRODUCE_CONSTRUCTION_PROBLEM',visual_treatment:'LIVE_ACTION_T2V',facility_visibility:'PARTIAL',energy_level:'HIGH',facility_claim_status:'GENERIC_NON_IDENTIFYING_VISUAL',layout_claim_status:'UNKNOWN',generation_permission:'T2V_ALLOWED',preferred_media_routes:['GENERATED_T2V'],reference_asset_ids:[],exact_site_claim_allowed:false,exact_layout_claim_allowed:false,facility_module_ids:['FACILITY_WHOLE'],truth_constraints:['Keep the facility generic and non-identifying.'],continuity_requirements:['preserve the excavation face'],graphic_spec:null,stage_id:'STG_01',state:'A',subject:'Exposed granite excavation face',facility_visual_state:'State A site preparation and early excavation',primary_action:'A rock drill advances into the exposed granite face',supporting_motion:'Broken rock falls into a contained spoil pile',environment_ref:'ENV_SITE_CONTEXT',environment_description:'Cold granite mountain construction site',camera:{shot_scale:'medium-wide',lens:'35mm',angle:'side three-quarter',movement:'slow lateral track',movement_speed:'slow'},lighting_and_material:'Cold daylight on rough granite and temporary steel',continuity_from_previous:'Opening construction state',transition_to_next:'The drill retracts before spoil removal',required_visible_features:['exposed granite rock face','temporary access matting'],forbidden_elements:['completed tunnel','concrete lining','permanent ventilation equipment','current guard posts'],temporal_action};
const promptFor=(value:SceneDirection,customTopic=topic)=>{const normalized=normalizeOmniSections({},value,customTopic);return compileOmniPrompt(normalized.sections,value);};

test('compiles one facility-native duration with explicit State A incompleteness',()=>{
  const prompt=promptFor(direction);
  assert.equal((prompt.match(/10-second continuous shot/gi)||[]).length,1);
  assert.match(prompt,/State A/i);assert.match(prompt,/not-yet-built permanent works absent/i);assert.match(prompt,/do not visually auto-complete/i);
  assert.doesNotMatch(prompt,/product proportions|factory ambience|aircraft|showdown/i);
});

test('enforces drilling physics and construction-specific synchronized sound',()=>{
  const prompt=promptFor(direction);
  assert.match(prompt,/drill acting on the supported exposed rock face/i);assert.match(prompt,/safe believable positions/i);assert.match(prompt,/never combat or weapon discharge/i);
  assert.match(prompt,/drilling, rock impact, excavator hydraulics/i);
});

test('preserves tunnel sequencing and prevents lining or completion ahead of excavation',()=>{
  const tunnel={...direction,number:2,stage_id:'STG_02',state:'B' as const,beat_id:'TUNNEL',visual_family:'TUNNELING' as const,voiceover:'The tunnel heading advanced beneath temporary support.',facility_visual_state:'Open tunnel heading with temporary support and partial lining',primary_action:'A tunnel drill advances at the unfinished heading',supporting_motion:'A loader moves muck behind the face',environment_ref:'ENV_CONSTRUCTION_ZONE',environment_description:'Underground tunnel construction zone',required_visible_features:['open tunnel heading','temporary rock bolts','partial concrete lining'],forbidden_elements:['finished internal systems','completed operational chamber']};
  const prompt=promptFor(tunnel);
  assert.match(prompt,/excavation advances at the face/i);assert.match(prompt,/lining remains behind it only where the assigned stage permits/i);assert.match(prompt,/cannot become fully finished mid-clip/i);
  assert.match(prompt,/finished internal systems/i);
});

test('enforces crane rigging, concrete placement, and internal-system constraints',()=>{
  const crane={...direction,primary_action:'A crane lifts one concrete form on taut rigging',supporting_motion:'The suspended form rises slowly'};
  assert.match(promptFor(crane),/rigging connected, taut under load/i);
  const concrete={...direction,stage_id:'STG_02',state:'B' as const,visual_family:'CONCRETE_AND_LINING' as const,primary_action:'A pump places concrete behind supported formwork',facility_visual_state:'Partial lining behind the open heading'};
  assert.match(promptFor(concrete),/do not transform it instantly into finished architecture/i);
  const systems={...concrete,visual_family:'INTERNAL_SYSTEMS' as const,primary_action:'Workers connect a documented temporary ventilation duct'};
  assert.match(promptFor(systems),/do not invent current security infrastructure or unseen internal routing/i);
});

test('generic site truth never presents contextual imagery as the exact facility',()=>{
  const prompt=promptFor(direction);
  assert.match(prompt,/generic, non-identifying/i);assert.match(prompt,/false exact-site claim/i);
  assert.doesNotMatch(prompt,/Hypothetical Documented Mountain Facility geometry/i);
});

test('conceptual and unknown layout truth block exact floor plans and cutaways',()=>{
  const conceptual={...direction,visual_family:'CUTAWAY_RECONSTRUCTION' as const,visual_treatment:'MOTION_GRAPHIC_T2V' as const,layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY' as const,graphic_spec:{graphic_subtype:'CONCEPTUAL_FACILITY_RELATIONSHIP' as const,visual_claim:'Show the supported surface to tunnel to chamber relationship',composition:'ORTHOGRAPHIC_CUTAWAY' as const,motion_pattern:'HIGHLIGHT_PULSE' as const,annotation_devices:['FLOW_LINES' as const],palette_profile:'PREMIUM_TECHNICAL_VECTOR' as const,maximum_animated_elements:2 as const,transition_anchor:null,text_policy:'NO_GENERATED_TEXT' as const,layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY' as const,not_to_scale:true,reference_asset_ids:[]}};
  const conceptualPrompt=promptFor(conceptual);
  assert.match(conceptualPrompt,/simplified non-to-scale conceptual geometry/i);assert.match(conceptualPrompt,/never imply an exact floor plan/i);
  const unknown={...conceptual,layout_claim_status:'UNKNOWN' as const,graphic_spec:{...conceptual.graphic_spec,layout_claim_status:'UNKNOWN' as const,not_to_scale:true}};
  const unknownPrompt=promptFor(unknown);
  assert.match(unknownPrompt,/Do not render an internal layout or exact cutaway/i);assert.match(unknownPrompt,/generated floor plan/i);
});

test('archival routes preserve provenance and never label reconstruction authentic',()=>{
  const archive={...direction,visual_family:'ARCHIVAL_REFERENCE' as const,visual_treatment:'REFERENCE_MEDIA' as const,facility_visibility:'NONE' as const,generation_permission:'REFERENCE_REQUIRED' as const,preferred_media_routes:['ARCHIVAL_IMAGE' as const],reference_asset_ids:['REF_001'],required_visible_features:[],voiceover:'A declassified photograph records the work.'};
  const prompt=promptFor(archive);
  assert.match(prompt,/clearly sourced archival material/i);assert.match(prompt,/never label generated reconstruction as authentic archive footage/i);assert.match(prompt,/REF_001/i);
});

test('active facility sensitivity policy reaches the final prompt',()=>{
  const activeTopic=normalizeFacilityHandoff(createFacilityPipelineHandoff({active:true}));
  const prompt=promptFor(direction,activeTopic);
  assert.match(prompt,/current access-route reconstruction/i);assert.match(prompt,/guard posts or patrol routines/i);assert.match(prompt,/surveillance positions or blind spots/i);assert.match(prompt,/vulnerability visualization or sabotage pathway/i);
});

test('resolves contradictory cameras to one credible facility camera instruction',()=>{
  const resolved=resolveFacilityPromptScene(topic,{...direction,camera:{...direction.camera,movement:'static tracking pan'}});
  assert.equal(resolved.camera.behavior,'locked camera');assert.ok(resolved.camera.contradictions.length>0);
  assert.doesNotMatch(canonicalFacilityIdentity(topic),/product/i);
});

test('recompiles long projects locally without changing VO or scene order',()=>{
  const directions=Array.from({length:75},(_,index)=>({...direction,number:index+1,start:index*10,end:index===74?745.75:(index+1)*10,duration:index===74?5.75:10,voiceover:`Exact VO ${index+1}`}));
  const prompts=directions.map(item=>({number:item.number,stage_id:item.stage_id,state:item.state,action_description:item.primary_action,video_prompt:'old prompt',voiceover:item.voiceover,stock_keywords:'facility construction',continuity_notes:item.continuity_from_previous,quality_flags:[],omniSections:normalizeOmniSections({},item,topic).sections}));
  const compiled=recompileOmniPrompts(prompts,directions,topic);
  assert.deepEqual(compiled.map(item=>item.number),Array.from({length:75},(_,index)=>index+1));assert.ok(compiled.every((item,index)=>item.voiceover===directions[index].voiceover));assert.match(compiled.at(-1)!.video_prompt,/^5\.75-second continuous shot\./);
});
