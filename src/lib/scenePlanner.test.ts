import assert from 'node:assert/strict';
import test from 'node:test';
import template from '../schemas/Defence_Facility_Visual_Handoff_Template.json';
import { normalizeFacilityHandoff } from './productionTemplate';
import { buildDocumentaryScenePlan, deriveGraphicSceneSpec } from './scenePlanner';

const timed = (texts: string[]) => texts.map((text, index) => ({number:index+1,start:index*10,end:(index+1)*10,duration:10,text,silent:false}));

function facilityTopic(mutate?: (raw:any)=>void) {
  const raw:any=JSON.parse(JSON.stringify(template));
  raw.facility.official_name='Documented Mountain Facility';
  raw.facility.facility_class='underground defence facility';
  raw.site_dimensions_and_spatial_relations.important_spatial_relationships=['surface terrain connects to one access tunnel and then one underground chamber'];
  raw.site_dimensions_and_spatial_relations.layout_claim_status='CONCEPTUAL_RELATIONSHIP_ONLY';
  raw.facility_modules[0].required_visible_features=['stable mountain envelope'];
  raw.facility_modules[0].forbidden_layout_claims=['invented room arrangement'];
  const stageA=raw.construction_stages[0];
  Object.assign(stageA,{stage_name:'Site preparation and early excavation',stage_visual_summary:'Exposed rock, survey marks, temporary works, and active excavation',environment_ids:['ENV_SITE_CONTEXT'],present_now:['exposed rock face','temporary survey markers'],not_yet_built_or_installed:['completed tunnel','concrete lining','permanent ventilation equipment','operational chamber'],temporarily_exposed:['fresh rock face'],temporary_works_present:['temporary access matting']});
  stageA.geometry_control.required_visible_anchors=['exposed rock face'];
  stageA.visual_evidence.confirmed_visual_details=['temporary works beside excavated rock'];
  const stageB=JSON.parse(JSON.stringify(stageA));
  Object.assign(stageB,{stage_id:'STG_02',stage_number:2,stage_name:'Tunnelling and structural work',stage_visual_summary:'Partially excavated tunnel with temporary support and exposed lining work',facility_state_code:'B',environment_ids:['ENV_CONSTRUCTION_ZONE'],present_now:['open tunnel heading','temporary rock bolts','partial concrete lining'],not_yet_built_or_installed:['finished internal systems','completed operational chamber'],temporarily_exposed:['rock-to-lining interface'],temporary_works_present:['temporary ventilation duct']});
  stageB.stage_actions[0].action_id='STG_02_ACT_01';
  stageB.continuity.forbidden_regressions=['untouched terrain presented as current construction state'];
  const stageC=JSON.parse(JSON.stringify(stageA));
  Object.assign(stageC,{stage_id:'STG_03',stage_number:3,stage_name:'Abandoned remains',stage_visual_summary:'Weathered and abandoned documented remains',facility_state_code:'C',environment_ids:['ENV_COMPLETED_FACILITY'],present_now:['weathered concrete remains','sealed documented opening'],not_yet_built_or_installed:[],temporarily_exposed:[],temporary_works_present:[]});
  stageC.stage_actions[0].action_id='STG_03_ACT_01';
  raw.construction_stages=[stageA,stageB,stageC];
  const chapter=raw.visual_story_plan.chapters[0];
  chapter.chapter_name='Construction and fate';
  chapter.narrative_goal='Explain terrain, excavation, tunnelling, systems, evidence, and fate';
  chapter.applicable_construction_stage_ids=['STG_01','STG_02','STG_03'];
  const base=chapter.visual_beats[0];
  const beat=(id:string,family:string,story:string,purpose:string,terms:string[],stage:string,extra:any={})=>({
    ...JSON.parse(JSON.stringify(base)),beat_id:id,beat_order:0,beat_name:purpose,visual_family:family,story_function:story,
    narrative_purpose:purpose,semantic_alignment_terms:terms,applicable_stage_ids:[stage],
    environment_ids:[stage==='STG_01'?'ENV_SITE_CONTEXT':stage==='STG_02'?'ENV_CONSTRUCTION_ZONE':'ENV_COMPLETED_FACILITY'],
    facility_visibility:family==='TERRAIN_CONTEXT'||family==='ARCHIVAL_REFERENCE'?'NONE':'PARTIAL',
    required_facility_state_code:stage==='STG_01'?'A':stage==='STG_02'?'B':'C',
    facility_claim_status:'GENERIC_NON_IDENTIFYING_VISUAL',layout_claim_status:'UNKNOWN',
    preferred_media_routes:['GENERATED_T2V'],generation_permission:'T2V_ALLOWED',
    must_show:[purpose],must_not_show:['invented current access routes','current security procedures'],
    negative_constraints:['security checkpoints','surveillance positions','facility vulnerabilities'],...extra,
  });
  chapter.visual_beats=[
    beat('TERRAIN','TERRAIN_CONTEXT','ESTABLISH_LOCATION','Remote granite mountain terrain and geology',['mountain','granite','terrain','geology'],'STG_01'),
    beat('EXCAVATE','EXCAVATION_AND_BLASTING','INTRODUCE_CONSTRUCTION_PROBLEM','Drilling and controlled blasting remove rock',['drilling','blasting','excavation','spoil'],'STG_01'),
    beat('TUNNEL','TUNNELING','EXPLAIN_PROCESS','Tunnel heading advances with rock bolts and shotcrete',['tunnel','portal','rock bolt','shotcrete'],'STG_02'),
    beat('STRUCTURE','CONCRETE_AND_LINING','EXPLAIN_PROCESS','Reinforced concrete lining and waterproof structural layers',['concrete','lining','waterproofing'],'STG_02'),
    beat('SYSTEMS','INTERNAL_SYSTEMS','EXPLAIN_HIDDEN_SYSTEM','Documented ventilation and drainage infrastructure',['ventilation','air supply','drainage','power'],'STG_02'),
    beat('MACHINERY','MACHINERY_ACTION','EXPLAIN_PROCESS','Excavator and haul machinery remove spoil',['machinery','excavator','spoil'],'STG_02'),
    beat('WORKERS','WORKER_ACTIVITY','SHOW_HUMAN_SCALE','Construction workers install temporary supports',['workers','temporary support'],'STG_02'),
    beat('FAILURE','ENVIRONMENTAL_CHALLENGE','SHOW_FAILURE_OR_LIMIT','Groundwater leakage and cracking constrain construction',['groundwater','leak','cracking','failure'],'STG_02'),
    beat('GRAPHIC','TECHNICAL_GRAPHIC','EXPLAIN_SPATIAL_RELATIONSHIP','Conceptual non-to-scale ventilation flow',['ventilation','flow','conceptual'],'STG_02',{layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY'}),
    beat('CUTAWAY','CUTAWAY_RECONSTRUCTION','EXPLAIN_SPATIAL_RELATIONSHIP','Conceptual surface to tunnel to chamber relationship',['surface','tunnel','chamber','cutaway'],'STG_02',{layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY'}),
    beat('ARCHIVE','ARCHIVAL_REFERENCE','PROVIDE_HISTORICAL_CONTEXT','Declassified archival construction document',['archive','declassified','document','plan'],'STG_01',{reference_asset_ids:['REF_001'],preferred_media_routes:['ARCHIVAL_IMAGE'],generation_permission:'REFERENCE_REQUIRED'}),
    beat('REMAINS','ABANDONMENT_OR_REMAINS','RESOLVE_FATE','Abandoned weathered facility remains',['abandoned','remains','ruins','today'],'STG_03'),
  ].map((item:any,index:number)=>({...item,beat_order:index+1}));
  Object.assign(raw.reference_assets[0],{facility_claim_status:'GENERIC_NON_IDENTIFYING_VISUAL',asset_type:'ARCHIVAL_IMAGE',allowed_usage:['historical evidence'],recommended_media_routes:['ARCHIVAL_IMAGE'],confidence:'HIGH'});
  mutate?.(raw);
  return normalizeFacilityHandoff(raw);
}

const one = (text:string,mutate?: (raw:any)=>void) => buildDocumentaryScenePlan(facilityTopic(mutate),timed([text]))[0];

test('facility narration cues select supported construction and evidence families',()=>{
  assert.equal(one('The tunnel portal advanced under rock bolts and shotcrete.').visual_family,'TUNNELING');
  assert.equal(one('Crews used drilling and controlled blasting before removing spoil.').visual_family,'EXCAVATION_AND_BLASTING');
  assert.equal(one('Ventilation supplied fresh air while drainage removed groundwater.').visual_family,'INTERNAL_SYSTEMS');
  const archive=one('A declassified archival document records the original construction plan.');
  assert.equal(archive.visual_family,'ARCHIVAL_REFERENCE');
  assert.equal(archive.visual_treatment,'REFERENCE_MEDIA');
  assert.deepEqual(archive.preferred_media_routes,['ARCHIVAL_IMAGE']);
  assert.deepEqual(archive.reference_asset_ids,['REF_001']);
  assert.equal(one('Today the abandoned weathered remains are preserved as ruins.').visual_family,'ABANDONMENT_OR_REMAINS');
});

test('aircraft-base wording keeps the facility as subject and has no aviation showdown metadata',()=>{
  const item=one('Workers excavated the underground aircraft base tunnel through granite.');
  assert.ok(['EXCAVATION_AND_BLASTING','TUNNELING'].includes(item.visual_family));
  assert.equal('showdown_role' in item,false);
  assert.equal('camera_platform' in item,false);
});

test('Stage A carries present, absent, temporary, module, evidence, and security constraints',()=>{
  const item=one('Drilling and blasting opened the first excavation in the rock.');
  assert.equal(item.state,'A');
  assert.ok(item.required_visible_features.some(value=>/exposed rock face/i.test(value)));
  assert.ok(item.required_visible_features.some(value=>/temporary access matting/i.test(value)));
  assert.ok(item.forbidden_elements.some(value=>/completed tunnel/i.test(value)));
  assert.ok(item.forbidden_elements.some(value=>/permanent ventilation equipment/i.test(value)));
  assert.ok(item.forbidden_elements.some(value=>/security procedures/i.test(value)));
  assert.ok(item.facility_module_ids.includes('FACILITY_WHOLE'));
});

test('Stage B does not regress to current untouched terrain, but explicit history may return to State A',()=>{
  const plan=buildDocumentaryScenePlan(facilityTopic(),timed([
    'The tunnel heading advances beneath temporary rock bolts.',
    'The mountain and granite terrain surround the active works.',
    'Earlier, before construction, the untouched mountain terrain defined the site.',
  ]));
  assert.equal(plan[0].state,'B');
  assert.equal(plan[1].state,'B');
  assert.notEqual(plan[1].visual_family,'TERRAIN_CONTEXT');
  assert.equal(plan[2].state,'A');
  assert.equal(plan[2].visual_family,'TERRAIN_CONTEXT');
});

test('conceptual graphics stay non-to-scale and unknown layout blocks cutaway reconstruction',()=>{
  const conceptual=one('A conceptual cutaway shows the supported surface to tunnel to chamber relationship.');
  assert.equal(conceptual.visual_family,'CUTAWAY_RECONSTRUCTION');
  assert.equal(conceptual.layout_claim_status,'CONCEPTUAL_RELATIONSHIP_ONLY');
  assert.equal(conceptual.graphic_spec?.not_to_scale,true);
  assert.ok(conceptual.truth_constraints.some(value=>/never imply an exact floor plan/i.test(value)));
  const unknown=one('A cutaway explains the surface tunnel and underground chamber relationship.',raw=>{
    raw.site_dimensions_and_spatial_relations.layout_claim_status='UNKNOWN';
    raw.site_dimensions_and_spatial_relations.important_spatial_relationships=[];
    const beat=raw.visual_story_plan.chapters[0].visual_beats.find((item:any)=>item.beat_id==='CUTAWAY');
    beat.layout_claim_status='UNKNOWN';
  });
  assert.notEqual(unknown.visual_family,'CUTAWAY_RECONSTRUCTION');
});

test('facility graphics classify construction-native purposes and preserve truth metadata',()=>{
  const plan={beat_id:'GFX',visual_family:'TECHNICAL_GRAPHIC',visual_treatment:'MOTION_GRAPHIC_T2V',layout_claim_status:'CONCEPTUAL_RELATIONSHIP_ONLY',reference_asset_ids:[]} as const;
  const scene=(text:string)=>timed([text])[0];
  assert.equal(deriveGraphicSceneSpec(null,scene('Ventilation airflow moves through the tunnel'),plan as any)?.graphic_subtype,'VENTILATION_FLOW');
  assert.equal(deriveGraphicSceneSpec(null,scene('Excavation and spoil removal progress in stages'),plan as any)?.graphic_subtype,'EXCAVATION_PROGRESSION');
  assert.equal(deriveGraphicSceneSpec(null,scene('Concrete lining and waterproof structural layers'),plan as any)?.graphic_subtype,'STRUCTURAL_LAYER');
  const graphic=deriveGraphicSceneSpec(null,scene('Surface to tunnel spatial relationship'),plan as any);
  assert.equal(graphic?.graphic_subtype,'CONCEPTUAL_FACILITY_RELATIONSHIP');
  assert.equal(graphic?.not_to_scale,true);
  assert.equal(graphic?.text_policy,'NO_GENERATED_TEXT');
});

test('meaningful cues provide at least three visual families across a likely 60-second span',()=>{
  const plan=buildDocumentaryScenePlan(facilityTopic(),timed([
    'The remote granite mountain established the terrain.',
    'Drilling and blasting began the excavation.',
    'A tunnel heading advanced through the rock.',
    'Workers installed temporary support.',
    'Groundwater leakage forced an engineering redesign.',
    'A declassified archival document records the sequence.',
  ]));
  assert.ok(new Set(plan.map(item=>item.visual_family)).size>=3);
});

test('keeps imported scene numbering for 8-second and partial final windows',()=>{
  const input=[...timed(['mountain terrain','drilling excavation','tunnel portal']).map((scene,index)=>({...scene,start:index*8,end:(index+1)*8,duration:8})),{number:4,start:24,end:29.75,duration:5.75,text:'abandoned remains today',silent:false}];
  assert.deepEqual(buildDocumentaryScenePlan(facilityTopic(),input).map(item=>item.number),[1,2,3,4]);
});
