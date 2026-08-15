import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import facilitySchema from '../schemas/Defence_Facility_Visual_Handoff_Schema.json';
import facilityTemplate from '../schemas/Defence_Facility_Visual_Handoff_Template.json';
import type { FacilityProductionHandoff } from '../types/facilityProduction';

export const FACILITY_SCHEMA_NAME = 'Secret Defence Facilities Visual Production Handoff' as const;
export const FACILITY_SCHEMA_VERSION = '0.9.0' as const;

export type HandoffFormat = 'facility' | 'unsupported' | 'invalid';
export type HandoffStatusLabel = 'Valid Facility' | 'Invalid';
export interface HandoffValidationIssue {
  path: string;
  message: string;
  code: 'schema' | 'duplicate-id' | 'broken-reference' | 'chronology' | 'unsupported-version';
}
export interface HandoffValidationResult {
  valid: boolean;
  format: HandoffFormat;
  status: HandoffStatusLabel;
  version?: string;
  schemaErrors: HandoffValidationIssue[];
  semanticErrors: HandoffValidationIssue[];
  errors: HandoffValidationIssue[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateFacilitySchema = ajv.compile(facilitySchema);
export const DEFAULT_FACILITY_PRODUCTION_TEMPLATE = facilityTemplate as FacilityProductionHandoff;

export function detectHandoffFormat(value: any): HandoffFormat {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  const name = String(value.schema?.name || '');
  const version = String(value.schema?.version || '');
  if (name === FACILITY_SCHEMA_NAME && version === FACILITY_SCHEMA_VERSION) return 'facility';
  if (name || version) return 'unsupported';
  return 'invalid';
}

const schemaIssue = (error: ErrorObject): HandoffValidationIssue => {
  const missing = error.keyword === 'required' ? `/${String((error.params as any).missingProperty || '')}` : '';
  const additional = error.keyword === 'additionalProperties' ? `/${String((error.params as any).additionalProperty || '')}` : '';
  return {
    path: `${error.instancePath || '/'}${missing}${additional}`.replace(/\/+/g, '/'),
    message: error.message || 'Facility handoff schema validation failed.',
    code: 'schema',
  };
};
const issue = (path: string, message: string, code: HandoffValidationIssue['code']): HandoffValidationIssue => ({ path, message, code });
const ids = (items: any[], field: string) => new Set((items || []).map(item => String(item?.[field] || '')).filter(Boolean));

function duplicateIssues(items: any[], field: string, path: string): HandoffValidationIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  (items || []).forEach(item => {
    const id = String(item?.[field] || '');
    if (!id) return;
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  });
  return [...duplicates].map(id => issue(path, `Duplicate ${field} "${id}".`, 'duplicate-id'));
}

function referenceIssues(values: unknown, path: string, known: Set<string>, kind: string): HandoffValidationIssue[] {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return list.map(String).filter(Boolean).filter(id => !known.has(id))
    .map(id => issue(path, `Unknown ${kind} reference "${id}".`, 'broken-reference'));
}

export function validateFacilitySemantics(data: FacilityProductionHandoff): HandoffValidationIssue[] {
  const errors: HandoffValidationIssue[] = [];
  const modules = ids(data.facility_modules, 'module_id');
  const assets = ids(data.reference_assets, 'asset_id');
  const environments = ids(data.environments, 'environment_id');
  const stages = ids(data.construction_stages, 'stage_id');

  errors.push(...duplicateIssues(data.facility_modules, 'module_id', '/facility_modules'));
  errors.push(...duplicateIssues(data.reference_assets, 'asset_id', '/reference_assets'));
  errors.push(...duplicateIssues(data.environments, 'environment_id', '/environments'));
  errors.push(...duplicateIssues(data.construction_stages, 'stage_id', '/construction_stages'));
  errors.push(...duplicateIssues(data.construction_stages.flatMap(stage => stage.stage_actions || []), 'action_id', '/construction_stages/*/stage_actions'));

  const chapters = data.visual_story_plan.chapters || [];
  const beats = chapters.flatMap(chapter => chapter.visual_beats || []);
  errors.push(...duplicateIssues(chapters, 'chapter_id', '/visual_story_plan/chapters'));
  errors.push(...duplicateIssues(beats, 'beat_id', '/visual_story_plan/chapters/*/visual_beats'));

  data.construction_stages.forEach((stage, index) => {
    const base = `/construction_stages/${index}`;
    if (index > 0 && stage.stage_number <= data.construction_stages[index - 1].stage_number) {
      errors.push(issue(`${base}/stage_number`, 'Construction stages must be ordered by strictly increasing stage_number.', 'chronology'));
    }
    errors.push(...referenceIssues(stage.environment_ids, `${base}/environment_ids`, environments, 'environment'));
    errors.push(...referenceIssues(stage.geometry_control.primary_facility_module_id, `${base}/geometry_control/primary_facility_module_id`, modules, 'facility module'));
    errors.push(...referenceIssues(stage.geometry_control.secondary_facility_module_ids, `${base}/geometry_control/secondary_facility_module_ids`, modules, 'facility module'));
    errors.push(...referenceIssues(stage.visual_evidence.reference_asset_ids, `${base}/visual_evidence/reference_asset_ids`, assets, 'reference asset'));
  });

  data.stage_transitions.forEach((transition, index) => {
    errors.push(...referenceIssues(transition.from_stage_id, `/stage_transitions/${index}/from_stage_id`, stages, 'construction stage'));
    errors.push(...referenceIssues(transition.to_stage_id, `/stage_transitions/${index}/to_stage_id`, stages, 'construction stage'));
  });

  chapters.forEach((chapter, chapterIndex) => {
    const base = `/visual_story_plan/chapters/${chapterIndex}`;
    errors.push(...referenceIssues(chapter.applicable_construction_stage_ids, `${base}/applicable_construction_stage_ids`, stages, 'construction stage'));
    chapter.visual_beats.forEach((beat, beatIndex) => {
      const beatBase = `${base}/visual_beats/${beatIndex}`;
      errors.push(...referenceIssues(beat.applicable_stage_ids, `${beatBase}/applicable_stage_ids`, stages, 'construction stage'));
      errors.push(...referenceIssues(beat.environment_ids, `${beatBase}/environment_ids`, environments, 'environment'));
      errors.push(...referenceIssues(beat.reference_asset_ids, `${beatBase}/reference_asset_ids`, assets, 'reference asset'));
    });
  });
  return errors;
}

export function validateVisualProductionHandoff(data: any): HandoffValidationResult {
  const source = data?._production_handoff || data;
  const format = detectHandoffFormat(source);
  let schemaErrors: HandoffValidationIssue[] = [];
  let semanticErrors: HandoffValidationIssue[] = [];
  if (format === 'facility') {
    if (!validateFacilitySchema(source)) schemaErrors = (validateFacilitySchema.errors || []).map(schemaIssue);
    else semanticErrors = validateFacilitySemantics(source as FacilityProductionHandoff);
  } else if (format === 'unsupported') {
    const identity = String(source?.schema?.name || 'unknown handoff');
    schemaErrors = [issue('/schema', `Unsupported handoff identity/version: "${identity}" ${String(source?.schema?.version || '')}. Expected ${FACILITY_SCHEMA_NAME} ${FACILITY_SCHEMA_VERSION}.`, 'unsupported-version')];
  } else {
    schemaErrors = [issue('/', 'File is not a recognized facility handoff.', 'schema')];
  }
  const errors = [...schemaErrors, ...semanticErrors];
  const valid = errors.length === 0;
  return {
    valid,
    format,
    status: valid ? 'Valid Facility' : 'Invalid',
    version: source?.schema?.version,
    schemaErrors,
    semanticErrors,
    errors,
  };
}
