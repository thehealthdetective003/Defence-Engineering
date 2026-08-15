import assert from 'node:assert/strict';
import test from 'node:test';
import template from '../schemas/Defence_Facility_Visual_Handoff_Template.json';
import modusTemplate from '../schemas/Modus_Visual_Production_Handoff_V2_Template.json';
import { normalizeFacilityHandoff } from './productionTemplate';
import { validateVisualProductionHandoff } from './handoffValidation';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('valid facility template is accepted as the active 0.9.0 contract', () => {
  const result = validateVisualProductionHandoff(template);
  assert.equal(result.valid, true);
  assert.equal(result.format, 'facility');
  assert.equal(result.status, 'Valid Facility');
  assert.equal(template.environments.length, 3);
  assert.equal(template.construction_stages.length, 1);
});

test('missing facility and construction_stages are rejected', () => {
  const missingFacility: any = clone(template);
  delete missingFacility.facility;
  assert.ok(validateVisualProductionHandoff(missingFacility).schemaErrors.some(error => error.path === '/facility'));

  const missingStages: any = clone(template);
  delete missingStages.construction_stages;
  assert.ok(validateVisualProductionHandoff(missingStages).schemaErrors.some(error => error.path === '/construction_stages'));
});

test('facility schema rejects enum violations and unexpected closed-contract fields', () => {
  const invalidLayout: any = clone(template);
  invalidLayout.site_dimensions_and_spatial_relations.layout_claim_status = 'EXACT_BUT_UNVERIFIED';
  assert.ok(validateVisualProductionHandoff(invalidLayout).schemaErrors.some(error => error.path.includes('layout_claim_status')));

  const invalidRoute: any = clone(template);
  invalidRoute.reference_assets[0].recommended_media_routes = ['WEB_SEARCH'];
  assert.ok(validateVisualProductionHandoff(invalidRoute).schemaErrors.some(error => error.path.includes('recommended_media_routes')));

  const invalidPermission: any = clone(template);
  invalidPermission.visual_story_plan.chapters[0].visual_beats[0].generation_permission = 'UNRESTRICTED';
  assert.ok(validateVisualProductionHandoff(invalidPermission).schemaErrors.some(error => error.path.includes('generation_permission')));

  const additional: any = clone(template);
  additional.facility.secret_coordinates = 'not allowed';
  assert.ok(validateVisualProductionHandoff(additional).schemaErrors.some(error => error.path.includes('secret_coordinates')));
});

test('facility state codes A, B, and C validate while other codes fail', () => {
  for (const code of ['A', 'B', 'C']) {
    const value: any = clone(template);
    value.construction_stages[0].facility_state_code = code;
    value.visual_story_plan.chapters[0].visual_beats[0].required_facility_state_code = code;
    assert.equal(validateVisualProductionHandoff(value).valid, true, `expected ${code} to validate`);
  }
  const invalid: any = clone(template);
  invalid.construction_stages[0].facility_state_code = 'D';
  assert.ok(validateVisualProductionHandoff(invalid).schemaErrors.some(error => error.path.includes('facility_state_code')));
});

test('semantic validation rejects duplicate IDs across facility ID families', () => {
  const value: any = clone(template);
  value.facility_modules.push(clone(value.facility_modules[0]));
  value.reference_assets.push(clone(value.reference_assets[0]));
  value.environments.push(clone(value.environments[0]));
  value.construction_stages.push(clone(value.construction_stages[0]));
  value.visual_story_plan.chapters.push(clone(value.visual_story_plan.chapters[0]));
  value.visual_story_plan.chapters[0].visual_beats.push(clone(value.visual_story_plan.chapters[0].visual_beats[0]));
  const result = validateVisualProductionHandoff(value);
  assert.equal(result.valid, false);
  for (const id of ['FACILITY_WHOLE', 'REF_001', 'ENV_SITE_CONTEXT', 'STG_01', 'CH01']) {
    assert.ok(result.semanticErrors.some(error => error.message.includes(`"${id}"`)), `missing duplicate ${id}`);
  }
  assert.ok(result.semanticErrors.some(error => error.path.includes('visual_beats')));
});

test('semantic validation rejects unresolved module, environment, stage, asset, and chapter-stage references', () => {
  const value: any = clone(template);
  const stage = value.construction_stages[0];
  stage.environment_ids = ['ENV_MISSING'];
  stage.geometry_control.primary_facility_module_id = 'MODULE_MISSING';
  stage.geometry_control.secondary_facility_module_ids = ['MODULE_SECONDARY_MISSING'];
  stage.visual_evidence.reference_asset_ids = ['REF_MISSING'];
  value.stage_transitions = [{ from_stage_id: 'STG_FROM_MISSING', to_stage_id: 'STG_TO_MISSING' }];
  const chapter = value.visual_story_plan.chapters[0];
  chapter.applicable_construction_stage_ids = ['STG_CHAPTER_MISSING'];
  const beat = chapter.visual_beats[0];
  beat.applicable_stage_ids = ['STG_BEAT_MISSING'];
  beat.environment_ids = ['ENV_BEAT_MISSING'];
  beat.reference_asset_ids = ['REF_BEAT_MISSING'];
  const result = validateVisualProductionHandoff(value);
  assert.equal(result.schemaErrors.length, 0);
  for (const id of ['ENV_MISSING', 'MODULE_MISSING', 'MODULE_SECONDARY_MISSING', 'REF_MISSING', 'STG_FROM_MISSING', 'STG_TO_MISSING', 'STG_CHAPTER_MISSING', 'STG_BEAT_MISSING', 'ENV_BEAT_MISSING', 'REF_BEAT_MISSING']) {
    assert.ok(result.semanticErrors.some(error => error.message.includes(`"${id}"`)), `missing broken reference ${id}`);
  }
});

test('construction stages must remain chronologically ordered', () => {
  const value: any = clone(template);
  const second = clone(value.construction_stages[0]);
  second.stage_id = 'STG_02';
  second.stage_number = 0;
  second.stage_actions[0].action_id = 'STG_02_ACT_01';
  value.construction_stages.push(second);
  const result = validateVisualProductionHandoff(value);
  assert.ok(result.semanticErrors.some(error => error.code === 'chronology' && error.path.includes('/construction_stages/1/stage_number')));
});

test('Modus manufacturing JSON is not silently accepted as a facility handoff', () => {
  const result = validateVisualProductionHandoff(modusTemplate);
  assert.equal(result.valid, false);
  assert.equal(result.format, 'unsupported');
  assert.match(result.errors[0].message, /Expected Secret Defence Facilities/);
});

test('normalization is facility-native, preserves raw handoff, and does not fabricate unknown layout data', () => {
  const value: any = clone(template);
  value.facility.official_name = 'Example Mountain Complex';
  value.construction_stages[0].environment_ids = ['ENV_CONSTRUCTION_ZONE', 'ENV_SITE_CONTEXT'];
  const normalized = normalizeFacilityHandoff(value);
  assert.equal(normalized.topic.facility, 'Example Mountain Complex');
  assert.equal('product' in normalized.topic, false);
  assert.equal('manufacturer' in normalized.topic, false);
  assert.equal(normalized.lifecycle_stages?.[0].environment_ref, 'ENV_CONSTRUCTION_ZONE');
  assert.ok(normalized.lifecycle_stages?.[0].facility_visual_state !== undefined);
  assert.equal('product_visual_state' in (normalized.lifecycle_stages?.[0] || {}), false);
  assert.equal(normalized.quality_control.site_dimensions_and_spatial_relations.layout_claim_status, 'UNKNOWN');
  assert.equal(normalized.quality_control.site_dimensions_and_spatial_relations.overall_site_extent.value, null);
  assert.deepEqual(normalized._production_handoff, value);
  assert.equal(validateVisualProductionHandoff(normalized).status, 'Valid Facility');
});
