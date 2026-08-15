import { PlannedScene, SceneDirection, TimedScene } from '../types';

const requiredStrings: Array<keyof SceneDirection> = [
  'stage_id', 'subject', 'facility_visual_state', 'primary_action', 'supporting_motion',
  'environment_ref', 'environment_description', 'lighting_and_material',
  'continuity_from_previous', 'transition_to_next',
];
const immutableScalarFields: Array<keyof PlannedScene> = [
  'chapter_id', 'beat_id', 'visual_family', 'story_function', 'visual_treatment',
  'facility_visibility', 'stage_id', 'environment_ref', 'state', 'energy_level',
  'facility_claim_status', 'layout_claim_status', 'generation_permission',
  'exact_site_claim_allowed', 'exact_layout_claim_allowed',
];
const immutableArrayFields: Array<keyof PlannedScene> = [
  'preferred_media_routes', 'reference_asset_ids', 'facility_module_ids',
  'truth_constraints', 'continuity_requirements',
];
const SECURITY_DETAIL_PATTERN = /\b(?:current\s+(?:access routes?|security procedures?|guard (?:posts?|routines?|patterns?))|surveillance (?:positions?|coverage|blind spots?)|hidden entrances?|security checkpoints?|facility vulnerabilities?|exploitable weak points?)\b/i;
const EXACT_LAYOUT_PATTERN = /\b(?:exact|precise|verified)\s+(?:floor\s*plans?|room arrangements?|internal layouts?|cutaways?)\b/i;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean) : [];
}
function unique(values: unknown[]): string[] {
  return [...new Set(values.flatMap(strings))];
}

export function ensureRequiredVisibleFeatures(item: any, plan?: PlannedScene): string[] {
  const supplied = strings(item?.required_visible_features);
  const assigned = plan?.required_visible_features || [];
  if (supplied.length || assigned.length) return unique([assigned, supplied]);
  if (plan?.visual_treatment === 'STATIC_GRAPHIC_T2V' || plan?.visual_treatment === 'MOTION_GRAPHIC_T2V') {
    return ['supported facility geometry and spatial relationships only'];
  }
  if (plan?.facility_visibility === 'NONE') return [];
  return [String(item?.subject || item?.facility_visual_state || 'assigned facility subject').trim()].filter(Boolean);
}

export function mergeDirectionMetadata(generated: any[], timedScenes: TimedScene[], plannedScenes: PlannedScene[] = []): SceneDirection[] {
  const byNumber = new Map(generated.map(item => [Number(item?.number), item]));
  const planByNumber = new Map(plannedScenes.map(item => [item.number, item]));
  return timedScenes.map(timed => {
    const item = byNumber.get(timed.number) || {};
    const plan = planByNumber.get(timed.number);
    return {
      number: timed.number, start: timed.start, end: timed.end, duration: timed.duration,
      voiceover: timed.text, silent: timed.silent,
      chapter_id: plan?.chapter_id, beat_id: plan?.beat_id, visual_family: plan?.visual_family,
      story_function: plan?.story_function, visual_treatment: plan?.visual_treatment,
      facility_visibility: plan?.facility_visibility, energy_level: plan?.energy_level,
      facility_claim_status: plan?.facility_claim_status, layout_claim_status: plan?.layout_claim_status,
      generation_permission: plan?.generation_permission,
      preferred_media_routes: plan ? [...plan.preferred_media_routes] : undefined,
      reference_asset_ids: plan ? [...plan.reference_asset_ids] : undefined,
      exact_site_claim_allowed: plan?.exact_site_claim_allowed,
      exact_layout_claim_allowed: plan?.exact_layout_claim_allowed,
      facility_module_ids: plan ? [...plan.facility_module_ids] : undefined,
      truth_constraints: plan ? [...plan.truth_constraints] : undefined,
      continuity_requirements: plan ? [...plan.continuity_requirements] : undefined,
      graphic_spec: plan?.graphic_spec ?? null,
      stage_id: plan?.stage_id || String(item.stage_id || ''),
      state: plan?.state || String(item.state || '').toUpperCase().replace(/^STATE[_\s-]*/, '') as 'A' | 'B' | 'C',
      subject: String(item.subject || ''),
      facility_visual_state: String(item.facility_visual_state || ''),
      primary_action: String(item.primary_action || ''), supporting_motion: String(item.supporting_motion || ''),
      environment_ref: plan?.environment_ref || String(item.environment_ref || ''),
      environment_description: String(item.environment_description || ''),
      camera: {
        shot_scale: String(item.camera?.shot_scale || ''), lens: String(item.camera?.lens || ''),
        angle: String(item.camera?.angle || ''), movement: String(item.camera?.movement || ''),
        movement_speed: String(item.camera?.movement_speed || ''),
      },
      lighting_and_material: String(item.lighting_and_material || ''),
      continuity_from_previous: String(item.continuity_from_previous || ''),
      transition_to_next: String(item.transition_to_next || ''),
      required_visible_features: ensureRequiredVisibleFeatures(item, plan),
      forbidden_elements: unique([plan?.forbidden_elements || [], strings(item.forbidden_elements)]),
      temporal_action: {
        opening_state: String(item.temporal_action?.opening_state || ''),
        primary_motion: String(item.temporal_action?.primary_motion || ''),
        physical_interaction: String(item.temporal_action?.physical_interaction || ''),
        mid_shot_progression: String(item.temporal_action?.mid_shot_progression || ''),
        ending_state: String(item.temporal_action?.ending_state || ''),
      },
    };
  });
}

export function validateSceneDirections(directions: unknown, timedScenes: TimedScene[], plannedScenes?: PlannedScene[]): string[] {
  if (!Array.isArray(directions)) return ['Directions must be a JSON array.'];
  const errors: string[] = [];
  if (directions.length !== timedScenes.length) errors.push(`Expected ${timedScenes.length} scenes; found ${directions.length}.`);
  const seen = new Set<number>();
  directions.forEach((direction: any, index) => {
    const label = `Scene ${index + 1}`;
    const number = Number(direction?.number);
    if (!Number.isInteger(number)) errors.push(`${label}: number must be an integer.`);
    if (seen.has(number)) errors.push(`${label}: duplicate scene number ${number}.`);
    seen.add(number);
    const timed = timedScenes[number - 1];
    if (!timed) { errors.push(`${label}: scene number ${number} is outside the transcript.`); return; }
    if (Math.abs(Number(direction.start) - timed.start) > 0.001 || Math.abs(Number(direction.end) - timed.end) > 0.001 || Math.abs(Number(direction.duration) - timed.duration) > 0.001) errors.push(`${label}: timing metadata was modified.`);
    if (String(direction.voiceover ?? '') !== timed.text || Boolean(direction.silent) !== timed.silent) errors.push(`${label}: imported VO or silence metadata was modified.`);
    const plan = plannedScenes?.find(item => item.number === number);
    if (plan) {
      immutableScalarFields.forEach(field => {
        if (direction[field] !== plan[field]) errors.push(`${label}: immutable plan field ${field} was modified.`);
      });
      immutableArrayFields.forEach(field => {
        if (JSON.stringify(direction[field] ?? []) !== JSON.stringify(plan[field])) errors.push(`${label}: immutable plan field ${field} was modified.`);
      });
      if (JSON.stringify(direction.graphic_spec ?? null) !== JSON.stringify(plan.graphic_spec)) errors.push(`${label}: immutable plan field graphic_spec was modified.`);
    }
    if (!['A', 'B', 'C'].includes(direction.state)) errors.push(`${label}: state must be A, B, or C.`);
    requiredStrings.forEach(field => { if (!String(direction[field] || '').trim()) errors.push(`${label}: ${field} is required.`); });
    ['shot_scale', 'lens', 'angle', 'movement', 'movement_speed'].forEach(field => { if (!String(direction.camera?.[field] || '').trim()) errors.push(`${label}: camera.${field} is required.`); });
    if (!Array.isArray(direction.required_visible_features) || (direction.facility_visibility !== 'NONE' && direction.required_visible_features.length === 0)) errors.push(`${label}: required_visible_features must contain at least one item unless facility visibility is NONE.`);
    if (!Array.isArray(direction.forbidden_elements) || direction.forbidden_elements.length === 0) errors.push(`${label}: forbidden_elements must contain at least one item.`);
    if (plannedScenes) ['opening_state', 'primary_motion', 'physical_interaction', 'mid_shot_progression', 'ending_state'].forEach(field => { if (!String(direction.temporal_action?.[field] || '').trim()) errors.push(`${label}: temporal_action.${field} is required.`); });
    const positiveText = [direction.subject, direction.facility_visual_state, direction.primary_action, direction.supporting_motion, direction.environment_description, direction.lighting_and_material, ...strings(direction.required_visible_features), ...Object.values(direction.temporal_action || {})].join(' ');
    if (SECURITY_DETAIL_PATTERN.test(positiveText)) errors.push(`${label}: current sensitive security or access details must not be positively depicted.`);
    if (plan && ['UNKNOWN', 'CONCEPTUAL_RELATIONSHIP_ONLY'].includes(plan.layout_claim_status) && EXACT_LAYOUT_PATTERN.test(positiveText)) errors.push(`${label}: exact internal layout claims are not allowed for ${plan.layout_claim_status}.`);
  });
  timedScenes.forEach(scene => { if (!seen.has(scene.number)) errors.push(`Scene ${scene.number} is missing.`); });
  return [...new Set(errors)];
}

export interface StageSummaryItem { stage_id: string; scenes: number; }
export function calculateStageSummary(directions: SceneDirection[]): StageSummaryItem[] {
  const counts = new Map<string, number>();
  directions.forEach(item => counts.set(item.stage_id, (counts.get(item.stage_id) || 0) + 1));
  return [...counts.entries()].map(([stage_id, scenes]) => ({ stage_id, scenes }));
}
