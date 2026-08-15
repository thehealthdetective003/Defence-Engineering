import assert from 'node:assert/strict';
import test from 'node:test';
import { PlannedScene } from '../types';
import { calculateStageSummary, mergeDirectionMetadata, validateSceneDirections } from './sceneDirections';

const timed = [{number:1,start:0,end:10,duration:10,text:'The tunnel heading advances.',silent:false}];
const temporal_action={opening_state:'The rock face is exposed',primary_motion:'The drill advances',physical_interaction:'The bit contacts the rock',mid_shot_progression:'Spoil falls below the heading',ending_state:'The drill settles clear of the face'};
const generated=[{number:1,subject:'Partially excavated tunnel heading',facility_visual_state:'State B tunnel heading with temporary rock support',primary_action:'A drill advances into the exposed rock face',supporting_motion:'Loose spoil falls into a collection tray',environment_description:'Non-identifying underground construction zone',camera:{shot_scale:'medium-wide',lens:'35mm',angle:'side three-quarter',movement:'slow lateral track',movement_speed:'slow'},lighting_and_material:'Work lights reveal rough granite and temporary steel',continuity_from_previous:'The same heading and support geometry continue',transition_to_next:'The drill retracts before spoil removal',required_visible_features:['exposed rock face'],forbidden_elements:['completed operational chamber'],temporal_action}];
const plan:PlannedScene={number:1,chapter_id:'CH01',beat_id:'TUNNEL',visual_family:'TUNNELING',story_function:'EXPLAIN_PROCESS',visual_treatment:'LIVE_ACTION_T2V',facility_visibility:'PARTIAL',stage_id:'STG_02',environment_ref:'ENV_CONSTRUCTION_ZONE',state:'B',energy_level:'MEDIUM',facility_claim_status:'GENERIC_NON_IDENTIFYING_VISUAL',layout_claim_status:'UNKNOWN',generation_permission:'T2V_ALLOWED',preferred_media_routes:['GENERATED_T2V'],reference_asset_ids:[],exact_site_claim_allowed:false,exact_layout_claim_allowed:false,facility_module_ids:['FACILITY_WHOLE'],required_visible_features:['temporary rock bolts'],forbidden_elements:['finished lining','current access routes or hidden entrances'],truth_constraints:['Keep the facility generic and non-identifying.','Internal layout is unknown: do not generate a floor plan.'],continuity_requirements:['preserve the same tunnel heading'],graphic_spec:null};

test('merges canonical plan metadata while preserving imported timing and VO',()=>{
  const merged=mergeDirectionMetadata(generated,timed,[plan]);
  assert.equal(merged[0].voiceover,timed[0].text);
  assert.equal(merged[0].start,0);
  assert.equal(merged[0].facility_visibility,'PARTIAL');
  assert.equal(merged[0].facility_visual_state,generated[0].facility_visual_state);
  assert.deepEqual(merged[0].required_visible_features,['temporary rock bolts','exposed rock face']);
  assert.ok(merged[0].forbidden_elements.includes('current access routes or hidden entrances'));
  assert.equal('product_visibility' in merged[0],false);
  assert.equal('product_visual_state' in merged[0],false);
  assert.deepEqual(validateSceneDirections(merged,timed,[plan]),[]);
});

test('rejects generated changes to timing, VO, and immutable truth metadata',()=>{
  const merged=mergeDirectionMetadata(generated,timed,[plan]);
  merged[0].voiceover='Changed narration';
  merged[0].duration=8;
  merged[0].layout_claim_status='EXACT_LAYOUT_VERIFIED';
  const errors=validateSceneDirections(merged,timed,[plan]);
  assert.ok(errors.some(error=>/timing metadata was modified/i.test(error)));
  assert.ok(errors.some(error=>/VO or silence metadata was modified/i.test(error)));
  assert.ok(errors.some(error=>/layout_claim_status was modified/i.test(error)));
});

test('rejects positive depictions of current access, security, surveillance, or vulnerability details',()=>{
  for(const primary_action of ['Workers reveal the current security checkpoint','A diagram maps current guard routines','The camera shows surveillance blind spots','The shot identifies facility vulnerabilities']){
    const merged=mergeDirectionMetadata([{...generated[0],primary_action}],timed,[plan]);
    assert.ok(validateSceneDirections(merged,timed,[plan]).some(error=>/sensitive security or access details/i.test(error)),primary_action);
  }
});

test('conceptual or unknown layout cannot be directed as an exact floor plan',()=>{
  const conceptual={...plan,layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY' as const,truth_constraints:['Use a non-to-scale conceptual relationship.']};
  const merged=mergeDirectionMetadata([{...generated[0],subject:'An exact floor plan of every internal room'}],timed,[conceptual]);
  assert.ok(validateSceneDirections(merged,timed,[conceptual]).some(error=>/exact internal layout claims are not allowed/i.test(error)));
});

test('facility visibility NONE permits an empty visible-feature list',()=>{
  const atmospheric={...plan,visual_family:'ATMOSPHERIC_INTERSTITIAL' as const,story_function:'RESET_ATTENTION' as const,facility_visibility:'NONE' as const,required_visible_features:[]};
  const response={...generated[0],subject:'Windblown granite ridge',facility_visual_state:'Facility omitted; terrain context only',required_visible_features:[]};
  const merged=mergeDirectionMetadata([response],timed,[atmospheric]);
  assert.deepEqual(merged[0].required_visible_features,[]);
  assert.deepEqual(validateSceneDirections(merged,timed,[atmospheric]),[]);
});

test('returns a render-safe facility stage summary',()=>{
  const first=mergeDirectionMetadata(generated,timed,[plan])[0];
  assert.deepEqual(calculateStageSummary([first,{...first,number:2},{...first,number:3,stage_id:'STG_03'}]),[
    {stage_id:'STG_02',scenes:2},{stage_id:'STG_03',scenes:1},
  ]);
  assert.deepEqual(calculateStageSummary([]),[]);
});
