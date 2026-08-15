import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateProject, projectSceneDuration } from './projectMigration';
import type { AppState, PlannedScene, SceneDirection } from '../types';
import { normalizeFacilityHandoff } from './productionTemplate';
import { createFacilityPipelineHandoff } from './testFixtures/facilityPipelineFixture';

const initial:AppState={projectSchemaVersion:11,projectName:'Untitled Facility Documentary',projectFormat:'facility-construction',phase:1,topic:null,plannedScenes:[],sceneDirections:[],masterVoiceoverScript:'',voiceoverTranscription:null,t2vPromptProfile:'omni-flash',visualPrompts:[],demoState:'idle',demoScenes:[],demoSceneNumbers:[]};
const topic=normalizeFacilityHandoff(createFacilityPipelineHandoff());
const plan:PlannedScene={number:1,chapter_id:'CH01',beat_id:'TUNNEL',visual_family:'TUNNELING',story_function:'EXPLAIN_PROCESS',visual_treatment:'LIVE_ACTION_T2V',facility_visibility:'PARTIAL',stage_id:'STG_02',environment_ref:'ENV_CONSTRUCTION_ZONE',state:'B',energy_level:'MEDIUM',facility_claim_status:'GENERIC_NON_IDENTIFYING_VISUAL',layout_claim_status:'UNKNOWN',generation_permission:'T2V_ALLOWED',preferred_media_routes:['GENERATED_T2V'],reference_asset_ids:[],exact_site_claim_allowed:false,exact_layout_claim_allowed:false,facility_module_ids:['FACILITY_WHOLE'],required_visible_features:['open tunnel heading'],forbidden_elements:['completed operational chamber'],truth_constraints:['Internal layout is unknown.'],continuity_requirements:['preserve tunnel geometry'],graphic_spec:null};
const temporal_action={opening_state:'The rock face is exposed',primary_motion:'The drill advances',physical_interaction:'The bit contacts rock',mid_shot_progression:'Spoil falls below',ending_state:'The drill retracts'};
const scene:SceneDirection={...plan,start:0,end:8,duration:8,voiceover:'Hello',silent:false,subject:'Tunnel heading',facility_visual_state:'Partially excavated State B heading',primary_action:'A drill advances',supporting_motion:'Spoil falls',environment_description:'Underground construction zone',camera:{shot_scale:'wide',lens:'35mm',angle:'side',movement:'track',movement_speed:'slow'},lighting_and_material:'Work light on granite',continuity_from_previous:'Opening',transition_to_next:'Cut',required_visible_features:['open tunnel heading'],forbidden_elements:['completed operational chamber'],temporal_action};
const transcription={audioFileName:'vo.json',duration:8,language:'en',languageProbability:1,model:'external',computeType:'external',text:'Hello',segments:[],words:[{text:'Hello',start:0,end:1,probability:1}],sceneDurationSeconds:8 as const,scenes:[{number:1,start:0,end:8,duration:8,text:'Hello',silent:false}],importedAt:'now'};

test('rejects arbitrary Modus or unsupported project formats without semantic reinterpretation',()=>{
  const result=migrateProject({projectFormat:'standard-lifecycle',projectSchemaVersion:9,topic:{topic:{title:'Aircraft factory'},_production_handoff:{schema:{name:'Modus Assembly Visual Production Handoff',version:'2.0.0'}}}},initial,10);
  assert.equal(result.state,null);assert.match(result.error||'',/Modus manufacturing projects are not converted automatically/i);
});

test('round-trips a facility-construction project without changing timeline or canonical fields',()=>{
  const raw={...initial,phase:3,topic,voiceoverTranscription:transcription,plannedScenes:[plan],sceneDirections:[scene],visualPrompts:[{number:1,action_description:'Moves',video_prompt:'Prompt',voiceover:'Hello',stock_keywords:'tunnel'}]};
  const parsed=JSON.parse(JSON.stringify(raw));assert.equal(projectSceneDuration(parsed,10),8);
  const result=migrateProject(parsed,initial,10);
  assert.equal(result.state?.phase,3);assert.equal(result.state?.visualPrompts.length,1);assert.equal(result.state?.projectSchemaVersion,11);assert.equal(result.state?.projectFormat,'facility-construction');assert.equal(result.state?.sceneDirections[0].facility_visual_state,scene.facility_visual_state);
});

test('narrowly migrates the schema-10 intermediate facility project',()=>{
  const raw:any={...initial,projectFormat:'standard-lifecycle',projectSchemaVersion:10,phase:2,topic,voiceoverTranscription:transcription,plannedScenes:[plan],sceneDirections:[scene]};
  const result=migrateProject(raw,initial,8);
  assert.equal(result.state?.projectFormat,'facility-construction');assert.equal(result.state?.projectSchemaVersion,11);assert.match(result.message||'',/Intermediate facility project migrated/i);
});

test('repairs immutable facility truth metadata from a valid stored plan',()=>{
  const rawScene={...scene,stage_id:'WRONG',environment_ref:'',state:'A' as const,facility_claim_status:'EXACT_SITE_VERIFIED' as const};
  const result=migrateProject({...initial,phase:2,topic,plannedScenes:[plan],voiceoverTranscription:transcription,sceneDirections:[rawScene]},initial,8);
  assert.equal(result.state?.sceneDirections[0]?.environment_ref,'ENV_CONSTRUCTION_ZONE');assert.equal(result.state?.sceneDirections[0]?.stage_id,'STG_02');assert.equal(result.state?.sceneDirections[0]?.state,'B');assert.equal(result.state?.sceneDirections[0]?.facility_claim_status,'GENERIC_NON_IDENTIFYING_VISUAL');
});

test('preserves the complete facility handoff through project migration',()=>{
  const result=migrateProject(JSON.parse(JSON.stringify({...initial,topic,phase:1})),initial,10);
  assert.deepEqual(result.state?.topic?._production_handoff,createFacilityPipelineHandoff());
});
