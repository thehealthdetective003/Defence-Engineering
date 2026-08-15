import assert from 'node:assert/strict';
import test from 'node:test';
import type { SceneDirection } from '../types';
import { normalizeFacilityHandoff } from './productionTemplate';
import { createFacilityPipelineHandoff } from './testFixtures/facilityPipelineFixture';
import { buildFlowContext, buildFocusedFacilityContext, compactIdentity, finalizeFlowPrompt, normalizeConstraintList, profileInstruction, relevantNegatives } from './flowPrompt';

const topic=normalizeFacilityHandoff(createFacilityPipelineHandoff({active:true}));
const direction:SceneDirection={number:1,start:0,end:10,duration:10,voiceover:'The excavation cut into granite.',silent:false,chapter_id:'CH01',beat_id:'EXCAVATION',visual_family:'EXCAVATION_AND_BLASTING',story_function:'INTRODUCE_CONSTRUCTION_PROBLEM',visual_treatment:'LIVE_ACTION_T2V',facility_visibility:'PARTIAL',energy_level:'HIGH',facility_claim_status:'GENERIC_NON_IDENTIFYING_VISUAL',layout_claim_status:'UNKNOWN',generation_permission:'T2V_ALLOWED',preferred_media_routes:['GENERATED_T2V'],reference_asset_ids:[],exact_site_claim_allowed:false,exact_layout_claim_allowed:false,facility_module_ids:['FACILITY_WHOLE'],truth_constraints:['Keep the facility generic and non-identifying.'],continuity_requirements:['preserve the rock face'],graphic_spec:null,stage_id:'STG_01',state:'A',subject:'Exposed granite excavation',facility_visual_state:'State A excavation before permanent works',primary_action:'A rock drill advances into granite',supporting_motion:'Spoil falls below the face',environment_ref:'ENV_SITE_CONTEXT',environment_description:'Cold mountain construction site',camera:{shot_scale:'medium-wide',lens:'35mm',angle:'side',movement:'slow track',movement_speed:'slow'},lighting_and_material:'Cold daylight on granite',continuity_from_previous:'Opening',transition_to_next:'Drill retracts',required_visible_features:['exposed granite rock face'],forbidden_elements:['completed tunnel','concrete lining'],temporal_action:{opening_state:'The face is still',primary_motion:'The drill advances',physical_interaction:'The bit contacts rock',mid_shot_progression:'Spoil falls',ending_state:'The drill retracts'}};

test('normalizes nested facility constraints without string corruption',()=>assert.deepEqual(normalizeConstraintList(['current access routes',['guard posts','current access routes'],'blind spots']),['current access routes','guard posts','blind spots']));
test('serializes facility identity without product or object coercion',()=>{assert.doesNotMatch(compactIdentity(topic),/\[object Object\]|product/i);});
test('profile instructions are distinct and facility-native',()=>{assert.notEqual(profileInstruction('omni-flash'),profileInstruction('veo-flow'));assert.match(profileInstruction('veo-flow'),/construction state/i);assert.doesNotMatch(profileInstruction('veo-flow'),/showdown|aircraft/i);});

test('scopes the authoritative facility handoff to the current prompt batch',()=>{
  const context:any=buildFocusedFacilityContext(topic,[direction]);
  assert.deepEqual(context.construction_stages.map((item:any)=>item.stage_id),['STG_01']);assert.deepEqual(context.environments.map((item:any)=>item.environment_id),['ENV_SITE_CONTEXT']);assert.deepEqual(context.facility_modules.map((item:any)=>item.module_id),['FACILITY_WHOLE']);assert.deepEqual(context.selected_beats.map((item:any)=>item.beat_id),['EXCAVATION']);
  const flow:any=buildFlowContext(topic,[direction],'veo-flow');assert.ok(flow.authoritative_facility_handoff);assert.equal('authoritative_production_handoff' in flow,false);
});

test('Veo final prompt adds facility state, construction physics, truth, sound, and sensitivity negatives',()=>{
  const result=finalizeFlowPrompt('A restrained camera follows the drill along the excavation face.',direction,topic,'veo-flow');
  assert.equal((result.match(/10-second continuous shot/gi)||[]).length,1);assert.match(result,/State A/i);assert.match(result,/do not visually auto-complete/i);assert.match(result,/drill acting on the supported exposed rock face/i);assert.match(result,/drilling, rock impact/i);assert.match(result,/Negative prompt:/i);assert.match(result,/current access-route reconstruction/i);assert.match(result,/vulnerability visualization or sabotage pathway/i);
});

test('site and layout negatives are intelligently merged with scene constraints',()=>{
  const negatives=relevantNegatives(direction,topic).join(' | ');
  assert.match(negatives,/false exact-site claim/i);assert.match(negatives,/invented exact internal layout/i);assert.match(negatives,/completed tunnel/i);assert.equal((negatives.match(/current access-route reconstruction/gi)||[]).length,1);
});

test('facility graphics obey conceptual layout truth and remain text-free',()=>{
  const graphic={...direction,visual_family:'CUTAWAY_RECONSTRUCTION' as const,visual_treatment:'MOTION_GRAPHIC_T2V' as const,layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY' as const,graphic_spec:{graphic_subtype:'CONCEPTUAL_FACILITY_RELATIONSHIP' as const,visual_claim:'Show the supported surface to tunnel to chamber relationship',composition:'ORTHOGRAPHIC_CUTAWAY' as const,motion_pattern:'HIGHLIGHT_PULSE' as const,annotation_devices:['FLOW_LINES' as const],palette_profile:'PREMIUM_TECHNICAL_VECTOR' as const,maximum_animated_elements:2 as const,transition_anchor:null,text_policy:'NO_GENERATED_TEXT' as const,layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY' as const,not_to_scale:true,reference_asset_ids:[]}};
  const result=finalizeFlowPrompt('ignored',graphic,topic,'veo-flow');assert.match(result,/flat technical-vector conceptual facility relationship/i);assert.match(result,/simplified non-to-scale conceptual geometry/i);assert.match(result,/No readable labels, fake dimensions/i);assert.match(result,/conceptual geometry presented as exact or to scale/i);
});

test('archival route never permits generated footage to masquerade as authentic evidence',()=>{
  const archive={...direction,visual_family:'ARCHIVAL_REFERENCE' as const,visual_treatment:'REFERENCE_MEDIA' as const,facility_visibility:'NONE' as const,generation_permission:'REFERENCE_REQUIRED' as const,preferred_media_routes:['ARCHIVAL_IMAGE' as const],reference_asset_ids:['REF_001'],required_visible_features:[]};
  const result=finalizeFlowPrompt('',archive,topic,'veo-flow');assert.match(result,/clearly sourced archival material/i);assert.match(result,/never label generated reconstruction as authentic archive footage/i);assert.match(result,/generated reconstruction presented as authentic archival footage/i);
});
