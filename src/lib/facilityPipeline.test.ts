import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVisualProductionHandoff } from './handoffValidation';
import { normalizeFacilityHandoff } from './productionTemplate';
import { importTranscriptionJson } from './transcriptionImport';
import { buildDocumentaryScenePlan } from './scenePlanner';
import { mergeDirectionMetadata, validateSceneDirections } from './sceneDirections';
import { compileOmniPrompt, normalizeOmniSections } from './omniPromptCompiler';
import { finalizeFlowPrompt } from './flowPrompt';
import { createFacilityPipelineHandoff } from './testFixtures/facilityPipelineFixture';

test('valid facility handoff travels through import, planning, direction, and both final compilers',()=>{
  const handoff=createFacilityPipelineHandoff();
  const validation=validateVisualProductionHandoff(handoff);
  assert.equal(validation.valid,true,validation.errors.map(error=>`${error.path}: ${error.message}`).join(' | '));
  const topic=normalizeFacilityHandoff(handoff);
  const lines=[
    'A declassified archival photograph records the historical construction period.',
    'The remote granite mountain terrain defined the site.',
    'Drilling and controlled blasting opened the first excavation and spoil pile.',
    'The tunnel heading advanced under temporary rock bolts.',
    'Partial reinforced concrete lining followed behind the excavation.',
    'Groundwater leakage and cracking constrained the works.',
    'A conceptual cutaway shows the supported surface to tunnel to chamber relationship.',
    'Today the abandoned weathered remains survive at the site.',
  ];
  const scenes=lines.map((text,index)=>({number:index+1,start:index*10,end:(index+1)*10,duration:10,text,silent:false}));
  const transcript=importTranscriptionJson({duration:80,text:lines.join(' '),scenes},'fixture.json',10);
  const plan=buildDocumentaryScenePlan(topic,transcript.scenes);
  assert.deepEqual(plan.map(item=>item.visual_family),['ARCHIVAL_REFERENCE','TERRAIN_CONTEXT','EXCAVATION_AND_BLASTING','TUNNELING','CONCRETE_AND_LINING','ENVIRONMENTAL_CHALLENGE','CUTAWAY_RECONSTRUCTION','ABANDONMENT_OR_REMAINS']);
  assert.deepEqual(plan.map(item=>item.state),['A','A','A','B','B','B','B','C']);
  const generated=plan.map(item=>({number:item.number,subject:item.visual_family.replaceAll('_',' ').toLowerCase(),facility_visual_state:`Assigned State ${item.state} facility condition`,primary_action:item.visual_treatment==='REFERENCE_MEDIA'?'The editor holds on the cited archival evidence':'One physically supported construction action progresses',supporting_motion:'Only supported material and environmental motion continues',environment_description:'A non-identifying documented facility context',camera:{shot_scale:'medium-wide',lens:'35mm',angle:'side three-quarter',movement:'slow lateral track',movement_speed:'slow'},lighting_and_material:'Restrained documentary light on credible materials',continuity_from_previous:'The assigned chronology and geometry continue',transition_to_next:'The state settles before the next scene',required_visible_features:item.required_visible_features,forbidden_elements:item.forbidden_elements,temporal_action:{opening_state:'The assigned state is stable',primary_motion:'One action begins',physical_interaction:'Material responds physically',mid_shot_progression:'The action visibly progresses',ending_state:'The state settles without auto-completion'}}));
  const directions=mergeDirectionMetadata(generated,transcript.scenes,plan);
  assert.deepEqual(validateSceneDirections(directions,transcript.scenes,plan),[]);
  const omni=directions.map(direction=>compileOmniPrompt(normalizeOmniSections({},direction,topic).sections,direction));
  const flow=directions.map(direction=>finalizeFlowPrompt(direction.primary_action,direction,topic,'veo-flow'));
  const all=[...omni,...flow].join('\n');
  assert.match(all,/do not visually auto-complete/i);assert.match(all,/false exact-site claim/i);assert.match(all,/current access-route reconstruction/i);
  assert.match(omni[0],/archival material/i);assert.match(omni[0],/never label generated reconstruction as authentic archive footage/i);
  assert.match(omni[2],/construction blasting only/i);assert.match(omni[3],/excavation advances at the face/i);assert.match(omni[4],/do not transform it instantly into finished architecture/i);
  assert.match(omni[6],/non-to-scale conceptual geometry/i);assert.doesNotMatch(omni[6],/exact floor plan may be shown/i);
  assert.match(omni[7],/Preserve abandonment/i);assert.doesNotMatch(omni[7],/active early construction/i);
});
