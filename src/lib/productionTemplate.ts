import type { TopicBrief } from '../types';
import type { FacilityProductionHandoff, FacilityStateCode } from '../types/facilityProduction';
import {
  DEFAULT_FACILITY_PRODUCTION_TEMPLATE,
  FACILITY_SCHEMA_NAME,
  FACILITY_SCHEMA_VERSION,
  validateVisualProductionHandoff,
} from './handoffValidation';

export const DEFAULT_FACILITY_HANDOFF_TEMPLATE: FacilityProductionHandoff = DEFAULT_FACILITY_PRODUCTION_TEMPLATE;

const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.map(String).map(item => item.trim()).filter(Boolean)
  : value ? [String(value).trim()].filter(Boolean) : [];

const describe = (record: Record<string, unknown> | undefined, omit: string[] = []) => Object.entries(record || {})
  .filter(([key, value]) => !omit.includes(key) && value !== '' && value !== null && (!Array.isArray(value) || value.length))
  .map(([key, value]) => {
    const rendered = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `${key.replace(/_/g, ' ')}: ${rendered}`;
  })
  .join('; ');

const measurementDescription = (label: string, measurement: any): string => {
  if (measurement?.value === null || measurement?.value === undefined) return '';
  return `${label}: ${measurement.value}${measurement.unit ? ` ${measurement.unit}` : ''} (${measurement.confidence || 'UNKNOWN'})`;
};

export function validateFacilityHandoffTemplate(data: unknown): string[] {
  return validateVisualProductionHandoff(data).errors.map(error => `${error.path}: ${error.message}`);
}

export function facilityHandoffTemplatePrompt(template: FacilityProductionHandoff): string {
  return `You are a defence-facility research, construction-history, and visual-continuity specialist. Fill this Secret Defence Facilities Visual Production Handoff JSON for [FACILITY].\nRULES:\n- Preserve every key and its data type; do not add or remove fields.\n- Use only public, declassified, or creator-provided evidence.\n- Keep confirmed evidence separate from analyst inference and uncertainty.\n- Leave unknown dimensions, internal layouts, relationships, and claims UNKNOWN; never fabricate them.\n- Give every environment, facility module, reference asset, action, stage, chapter, and beat a stable unique ID.\n- Keep construction stages chronological and use facility_state_code A (site/preparation), B (partial construction), or C (completed/operational/abandoned physical facility).\n- Respect sensitivity_and_truth_policy, including location precision and active-security restrictions.\n- Return only valid JSON.\n\n${JSON.stringify(template, null, 2)}`;
}

export function normalizeFacilityHandoff(input: FacilityProductionHandoff): TopicBrief {
  const facility = input.facility || ({} as FacilityProductionHandoff['facility']);
  const history = input.historical_context || ({} as FacilityProductionHandoff['historical_context']);
  const site = input.site_dimensions_and_spatial_relations || ({} as FacilityProductionHandoff['site_dimensions_and_spatial_relations']);
  const modules = Array.isArray(input.facility_modules) ? input.facility_modules : [];
  const facilityName = facility.official_name || facility.public_location_name || 'Untitled facility';

  const documentedDimensions = [
    measurementDescription('overall site extent', site.overall_site_extent),
    measurementDescription('maximum documented depth or overburden', site.maximum_documented_depth_or_overburden),
    measurementDescription('documented tunnel or internal length', site.documented_tunnel_or_internal_length),
    ...strings(site.documented_major_chamber_dimensions),
  ].filter(Boolean);
  const moduleIdentity = modules.map(module => [
    module.module_name || module.module_id,
    module.module_type,
    ...strings(module.required_visible_features),
  ].filter(Boolean).join(': ')).filter(Boolean);
  const visualLock = [
    facility.overall_visual_description,
    ...strings(facility.immutable_identity_features),
    ...documentedDimensions,
    ...strings(site.terrain_relationships),
    ...moduleIdentity,
  ].filter(Boolean).join(' | ');
  const exclusions = [
    ...strings(facility.visually_similar_facilities_to_avoid),
    ...strings(facility.global_negative_constraints),
    ...modules.flatMap(module => strings(module.likely_wrong_substitutions)),
    ...modules.flatMap(module => strings(module.forbidden_layout_claims)),
    ...strings(history.uncertainty_notes),
  ];

  const environments = (input.environments || []).map((environment, index) => ({
    environment_id: environment.environment_id || `ENV_${String(index + 1).padStart(2, '0')}`,
    name: environment.environment_name || environment.environment_id || `Environment ${index + 1}`,
    environment_type: environment.environment_type || environment.setting_scope,
    visual_details: describe(environment as unknown as Record<string, unknown>, ['environment_id', 'environment_name', 'forbidden_elements']),
    confirmed_visuals: describe(environment as unknown as Record<string, unknown>, ['environment_id', 'environment_name', 'forbidden_elements']),
    do_not_show: strings(environment.forbidden_elements),
    nation: facility.country_or_operator,
    _production_environment: environment,
  }));

  const stages = (input.construction_stages || []).map((stage, index) => {
    const actions = (stage.stage_actions || []).flatMap(action => strings(action.action_description || action.primary_action));
    const state = (['A', 'B', 'C'].includes(stage.facility_state_code) ? stage.facility_state_code : undefined) as FacilityStateCode | undefined;
    const facilityVisualState = describe(stage.site_state as unknown as Record<string, unknown>);
    return {
      stage_id: stage.stage_id || `STG_${String(index + 1).padStart(2, '0')}`,
      stage_name: stage.stage_name || `Construction stage ${index + 1}`,
      environment_ref: stage.environment_ids?.[0] || '',
      stage_function: stage.construction_function || stage.stage_visual_summary,
      action: actions.join(' ') || stage.stage_visual_summary || '',
      facility_visual_state: facilityVisualState,
      state,
      primary_camera_shot: strings(stage.camera_guidance?.preferred_views).join(', '),
      secondary_detail_shots: strings(stage.camera_guidance?.safe_shot_scales),
      motion_direction: strings(stage.camera_guidance?.preferred_camera_movements).join(', '),
      quality_control_focus: strings(stage.geometry_control?.required_visible_anchors).join(', '),
      continuity_from_previous_stage: stage.continuity?.previous_stage_end_state || '',
      transition_to_next_stage: stage.continuity?.next_stage_expected_state || '',
      visual_risk_notes: [
        ...strings(stage.camera_guidance?.high_risk_views),
        ...strings(stage.geometry_control?.negative_constraints),
        ...strings(stage.visual_evidence?.excluded_visual_claims),
      ].join(', '),
      source_claim_refs: strings(stage.visual_evidence?.reference_asset_ids),
      _production_stage: stage,
    };
  });

  const facilityIdentityLock = {
    core_geometry: visualLock,
    surface_finish: facility.overall_visual_description || '',
    markings: '',
    scale_reference: site.human_scale_reference || '',
    distinctive_features: strings(facility.immutable_identity_features),
    must_remain_consistent_across_all_scenes: true,
  };

  return {
    schema_version: `defence_facility_visual_handoff_${input.schema?.version || FACILITY_SCHEMA_VERSION}`,
    topic: {
      title: facilityName,
      facility: facilityName,
      category: facility.facility_class || 'Defence facility',
      country_or_operator: facility.country_or_operator || '',
      construction_era: facility.construction_era || '',
      facility_status: facility.facility_status || 'UNKNOWN',
      public_location_name: facility.public_location_name || '',
    },
    global_visual_constants: 'Photorealistic defence-infrastructure documentary; physically credible terrain, scale, construction methods, materials, and period context; no invented exact site or internal layout claims.',
    facility_identity_lock: facilityIdentityLock,
    visual_lock: visualLock,
    visual_exclusions: exclusions.join(', '),
    negative_prompt_global: [...new Set([...strings(facility.global_negative_constraints), ...exclusions])],
    master_voiceover_script: (input as any).master_voiceover_script || '',
    environments,
    lifecycle_stages: stages,
    lifecycle_stage_count: stages.length,
    scene_continuity_rules: {
      lifecycle_progression: 'Follow construction_stages in chronological order.',
      state_consistency: 'Honor facility_state_code A/B/C without inventing missing construction or layout details.',
      environment_logic: 'Use only referenced environment_ids for each construction stage.',
      markings_consistency: 'Preserve immutable facility identity features and forbid generated readable markings.',
      scale_consistency: site.human_scale_reference || 'Keep documented scale stable; leave undocumented dimensions unknown.',
      no_stage_skipping: true,
    },
    quality_control: {
      source_schema: input.schema,
      historical_context: history,
      site_dimensions_and_spatial_relations: site,
      reference_assets: input.reference_assets,
      stage_transitions: input.stage_transitions,
      visual_story_plan: input.visual_story_plan,
      sensitivity_and_truth_policy: input.sensitivity_and_truth_policy,
      global_prompt_rules: input.global_prompt_rules,
    },
    _production_handoff: input,
  } as TopicBrief;
}

export function isFacilityHandoff(data: any): data is FacilityProductionHandoff {
  return data?.schema?.name === FACILITY_SCHEMA_NAME
    && data?.schema?.version === FACILITY_SCHEMA_VERSION
    && !!data?.facility
    && Array.isArray(data?.construction_stages);
}
