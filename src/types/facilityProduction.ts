export type EvidenceConfidence =
  | 'CONFIRMED' | 'CORROBORATED' | 'CREATOR_PROVIDED'
  | 'ANALYST_INFERRED' | 'UNVERIFIED' | 'UNKNOWN';

export type FacilityVisualFamily =
  | 'SITE_AERIAL' | 'TERRAIN_CONTEXT' | 'FACILITY_EXTERIOR'
  | 'ACCESS_AND_LOGISTICS' | 'CONSTRUCTION_CAMP' | 'SURVEY_AND_PREPARATION'
  | 'EXCAVATION_AND_BLASTING' | 'TUNNELING' | 'ROCK_REMOVAL'
  | 'TEMPORARY_WORKS' | 'CONCRETE_AND_LINING' | 'STRUCTURAL_FIT_OUT'
  | 'INTERNAL_SYSTEMS' | 'WORKER_POV' | 'MACHINERY_ACTION' | 'MATERIAL_FLOW'
  | 'QUALITY_CONTROL' | 'ENVIRONMENTAL_CHALLENGE' | 'ARCHIVAL_REFERENCE'
  | 'MAP_OR_TIMELINE' | 'TECHNICAL_GRAPHIC' | 'CUTAWAY_RECONSTRUCTION'
  | 'OPERATIONAL_CONTEXT' | 'ABANDONMENT_OR_REMAINS' | 'HERO_FACILITY'
  | 'CHAPTER_TRANSITION' | 'ATMOSPHERIC_INTERSTITIAL';

export type FacilityStoryFunction =
  | 'OPENING_HOOK' | 'ESTABLISH_MYSTERY' | 'ESTABLISH_LOCATION' | 'ESTABLISH_SCALE'
  | 'EXPLAIN_STRATEGIC_NEED' | 'INTRODUCE_CONSTRUCTION_PROBLEM' | 'EXPLAIN_PROCESS'
  | 'SHOW_HUMAN_SCALE' | 'SHOW_LOGISTICS' | 'EXPLAIN_HIDDEN_SYSTEM'
  | 'EXPLAIN_SPATIAL_RELATIONSHIP' | 'BRIDGE_STAGE' | 'RESET_ATTENTION'
  | 'PREVIEW_PAYOFF' | 'REVEAL_PURPOSE' | 'DELIVER_ENGINEERING_PAYOFF'
  | 'PROVIDE_HISTORICAL_CONTEXT' | 'SHOW_FAILURE_OR_LIMIT' | 'CONCLUDE_CHAPTER'
  | 'RESOLVE_FATE';

export type FacilityMediaRoute =
  | 'GENERATED_T2V' | 'REFERENCE_IMAGE_I2V' | 'AUTHENTIC_VIDEO'
  | 'ARCHIVAL_IMAGE' | 'ARCHIVAL_VIDEO' | 'SATELLITE_REFERENCE'
  | 'EDITOR_NATIVE_GRAPHIC' | 'REFERENCE_LOCKED_GRAPHIC'
  | 'STATIC_IMAGE_WITH_MOTION' | 'NO_VALID_ROUTE';

export type FacilityClaimStatus =
  | 'EXACT_SITE_VERIFIED' | 'FACILITY_TYPE_CORROBORATED'
  | 'CONTEXTUAL_DEFENCE_INFRASTRUCTURE' | 'GENERIC_NON_IDENTIFYING_VISUAL'
  | 'UNUSABLE';
export type LayoutClaimStatus =
  | 'EXACT_LAYOUT_VERIFIED' | 'PARTIAL_LAYOUT_VERIFIED'
  | 'CONCEPTUAL_RELATIONSHIP_ONLY' | 'UNKNOWN';
export type FacilityStatus =
  | 'HISTORICAL' | 'DECLASSIFIED' | 'ABANDONED' | 'PRESERVED_OR_MUSEUM'
  | 'ACTIVE_PUBLICLY_DOCUMENTED' | 'PROPOSED_OR_UNBUILT' | 'UNKNOWN';
export type FacilityVisibility = 'NONE' | 'PARTIAL' | 'FULL' | 'DETAIL_ONLY';
export type GenerationPermission = 'T2V_ALLOWED' | 'REFERENCE_REQUIRED' | 'EDITOR_ONLY' | 'NOT_ALLOWED';
export type FacilityStateCode = 'A' | 'B' | 'C';
export type FacilitySettingScope = string;

export interface FacilityMeasurement {
  value: number | null;
  unit: string;
  confidence: 'CONFIRMED' | 'CORROBORATED' | 'CREATOR_PROVIDED' | 'ANALYST_INFERRED' | 'UNKNOWN';
}

export interface Facility {
  official_name: string;
  aliases: string[];
  facility_class: string;
  country_or_operator: string;
  builder_or_engineering_organizations: string[];
  construction_era: string;
  facility_status: FacilityStatus;
  public_location_name: string;
  location_precision_policy: 'PUBLIC_SITE_NAME_ONLY';
  overall_visual_description: string;
  immutable_identity_features: string[];
  visually_similar_facilities_to_avoid: string[];
  global_negative_constraints: string[];
}

export interface HistoricalContext {
  construction_period_start: string;
  construction_period_end: string;
  geopolitical_context: string;
  strategic_problem: string;
  intended_role: string;
  actual_role_if_different: string;
  current_status: string;
  key_publicly_documented_events: string[];
  uncertainty_notes: string[];
}

export interface SiteDimensionsAndSpatialRelations {
  overall_site_extent: FacilityMeasurement;
  maximum_documented_depth_or_overburden: FacilityMeasurement;
  documented_tunnel_or_internal_length: FacilityMeasurement;
  documented_major_chamber_dimensions: string[];
  important_spatial_relationships: string[];
  terrain_relationships: string[];
  human_scale_reference: string;
  layout_claim_status: LayoutClaimStatus;
}

export interface FacilityModule {
  module_id: string;
  module_name: string;
  module_type: string;
  verified_function: string;
  location_relation: string;
  required_visible_features: string[];
  spatial_relationships: string[];
  minimum_visible_anchor_count: number;
  forbidden_layout_claims: string[];
  likely_wrong_substitutions: string[];
}

export interface FacilityReferenceAsset {
  asset_id: string;
  asset_type: string;
  facility_or_module: string;
  construction_or_operational_state: string;
  view_angle_or_document_scope: string;
  source_page_url: string;
  direct_media_url_or_file_reference: string;
  publisher_or_owner: string;
  date_or_event: string;
  visual_verification: string;
  facility_claim_status: FacilityClaimStatus;
  layout_claim_status: LayoutClaimStatus;
  exact_site_verified: boolean;
  visible_or_documented_features: string[];
  allowed_usage: string[];
  forbidden_usage: string[];
  recommended_media_routes: FacilityMediaRoute[];
  confidence: EvidenceConfidence;
}

export interface FacilityEnvironment {
  environment_id: string;
  environment_name: string;
  setting_scope: FacilitySettingScope;
  environment_type: string;
  facility_claim_status: FacilityClaimStatus;
  exact_facility_name_if_verified: string;
  geographic_context: string;
  terrain: string;
  ground_or_surface_condition: string;
  weather_or_climate: string;
  lighting: string;
  visible_exterior_features: string[];
  construction_features: string[];
  machinery: string[];
  temporary_works: string[];
  tools: string[];
  worker_roles: string[];
  worker_uniforms_and_ppe: string[];
  scale_references: string[];
  allowed_background_activity: string[];
  forbidden_elements: string[];
}

export interface FacilityState {
  overall_form: string;
  surface_state: string;
  subsurface_state: string;
  recognizable_as_final_facility: boolean;
  access_state: string;
  temporary_works_state: string;
  permanent_works_state: string;
  interior_visibility: string;
}

export interface FacilityGeometryControl {
  primary_facility_module_id: string;
  secondary_facility_module_ids: string[];
  required_visible_anchors: string[];
  minimum_visible_anchor_count: number;
  corrective_positive_geometry: string[];
  likely_wrong_substitutions: string[];
  negative_constraints: string[];
  immutable_during_clip: string[];
  forbidden_transformations: string[];
}

export interface FacilityStageAction {
  action_id: string;
  action_description: string;
  primary_subject: string;
  primary_action: string;
  allowed_minor_motion: string;
  required_tools_or_machinery: string[];
  required_worker_roles: string[];
  forbidden_actions: string[];
}

export interface FacilityCameraGuidance {
  preferred_views: string[];
  safe_shot_scales: string[];
  preferred_camera_movements: string[];
  forbidden_camera_movements: string[];
  high_risk_views: string[];
}

export interface FacilityStageVisualOpportunities {
  recommended_visual_families: FacilityVisualFamily[];
  terrain_and_scale_opportunities: string[];
  access_and_logistics_opportunities: string[];
  excavation_or_tunneling_opportunities: string[];
  machinery_action_opportunities: string[];
  worker_activity_opportunities: string[];
  material_flow_opportunities: string[];
  quality_control_opportunities: string[];
  archival_or_reference_opportunities: string[];
  technical_graphic_opportunities: string[];
  non_facility_cutaway_opportunities: string[];
}

export interface FacilityVisualEvidence {
  confirmed_visual_details: string[];
  analyst_inferred_visual_details: string[];
  uncertain_visual_details: string[];
  excluded_visual_claims: string[];
  reference_asset_ids: string[];
}

export interface FacilityContinuity {
  previous_stage_end_state: string;
  current_stage_start_state: string;
  current_stage_end_state: string;
  next_stage_expected_state: string;
  features_that_must_remain_consistent: string[];
  temporary_features_that_may_disappear: string[];
  forbidden_regressions: string[];
}

export interface FacilityPromptConstraints {
  one_stable_facility_state: boolean;
  one_primary_action: boolean;
  no_permanent_feature_appears_before_construction: boolean;
  no_automatic_completion_of_facility: boolean;
  no_geometry_morphing: boolean;
  no_readable_generated_text: boolean;
  no_invented_exact_layout: boolean;
  must_repeat_present_and_absent_features: boolean;
  must_include_view_specific_geometry: boolean;
}

export interface ConstructionStage {
  stage_id: string;
  stage_number: number;
  stage_name: string;
  construction_function: string;
  facility_state_code: FacilityStateCode;
  stage_visual_summary: string;
  environment_ids: string[];
  site_state: FacilityState;
  present_now: string[];
  not_yet_built_or_installed: string[];
  temporarily_exposed: string[];
  open_interfaces: string[];
  temporary_works_present: string[];
  removed_material_or_spoil_state: string;
  geometry_control: FacilityGeometryControl;
  stage_actions: FacilityStageAction[];
  camera_guidance: FacilityCameraGuidance;
  stage_visual_opportunities: FacilityStageVisualOpportunities;
  visual_evidence: FacilityVisualEvidence;
  continuity: FacilityContinuity;
  prompt_constraints: FacilityPromptConstraints;
}

export interface FacilityStageTransition {
  from_stage_id: string;
  to_stage_id: string;
  /**
   * The 0.9 template leaves stage_transitions empty, so it does not declare a
   * closed transition payload beyond the reference-bearing endpoints.
   */
  [key: string]: unknown;
}

export interface FacilityVisualBeat {
  beat_id: string;
  beat_order: number;
  beat_name: string;
  story_function: FacilityStoryFunction;
  visual_family: FacilityVisualFamily;
  narrative_purpose: string;
  semantic_alignment_terms: string[];
  applicable_stage_ids: string[];
  environment_ids: string[];
  facility_visibility: FacilityVisibility;
  required_facility_state_code: FacilityStateCode | null;
  facility_claim_status: FacilityClaimStatus;
  layout_claim_status: LayoutClaimStatus;
  reference_asset_ids: string[];
  preferred_media_routes: FacilityMediaRoute[];
  generation_permission: GenerationPermission;
  exact_site_claim_allowed: boolean;
  exact_layout_claim_allowed: boolean;
  preferred_shot_scales: string[];
  preferred_camera_movements: string[];
  minimum_usable_duration_seconds: number;
  preferred_duration_seconds: number;
  maximum_duration_seconds: number;
  must_show: string[];
  must_not_show: string[];
  continuity_requirements: string[];
  negative_constraints: string[];
}

export interface FacilityChapter {
  chapter_id: string;
  chapter_name: string;
  chapter_order: number;
  narrative_goal: string;
  chapter_question: string;
  chapter_payoff: string;
  opening_rehook_intent: string;
  applicable_construction_stage_ids: string[];
  required_visual_families: FacilityVisualFamily[];
  optional_visual_families: FacilityVisualFamily[];
  forbidden_visual_families: FacilityVisualFamily[];
  visual_beats: FacilityVisualBeat[];
}

export interface FacilityRangeTarget { minimum: number; maximum: number; }
export interface FacilityPreferredDuration extends FacilityRangeTarget { preferred: number; }
export interface FacilityRhythmPolicy {
  preferred_usable_scene_duration_seconds: FacilityPreferredDuration;
  maximum_consecutive_same_visual_family: number;
  maximum_consecutive_full_facility_scenes: number;
  maximum_consecutive_same_environment_without_new_information: number;
  require_context_process_detail_cycle_when_supported: boolean;
  attention_reset_interval_seconds: FacilityRangeTarget;
  minimum_meaningful_visual_families_per_60_seconds: number;
  avoid_repeated_camera_angle: boolean;
  avoid_repeated_camera_movement: boolean;
  avoid_decorative_visuals_without_narrative_purpose: boolean;
}
export interface FacilityMediaRoutingPolicy {
  exact_historical_events_prefer_authentic_media: boolean;
  exact_facility_geometry_prefers_reference_media: boolean;
  exact_internal_layout_requires_verified_reference: boolean;
  exact_markings_require_reference_lock: boolean;
  maps_timelines_dimensions_and_diagrams_require_editor_graphics: boolean;
  generated_t2v_allowed_for_contextual_non_identifying_visuals: boolean;
  conceptual_cutaway_allowed_only_when_not_presented_as_exact: boolean;
  no_valid_route_must_be_flagged: boolean;
}
export interface FacilityVisualBalanceTargets {
  construction_and_engineering_percent: FacilityRangeTarget;
  terrain_scale_access_and_logistics_percent: FacilityRangeTarget;
  archival_history_and_reference_media_percent: FacilityRangeTarget;
  technical_graphics_maps_and_cutaways_percent: FacilityRangeTarget;
  operational_context_abandonment_and_fate_percent: FacilityRangeTarget;
  hero_facility_imagery_percent: FacilityRangeTarget;
  targets_are_advisory_not_hard_quotas: boolean;
}

export interface FacilityVisualStoryPlan {
  documentary_arc: {
    central_construction_question: string;
    central_mystery_question: string;
    strategic_context_question: string;
    opening_visual_promise: string;
    promised_engineering_payoffs: string[];
    purpose_reveal: string;
    closing_visual_payoff: string;
    facility_fate_or_present_day_payoff: string;
  };
  chapters: FacilityChapter[];
  rhythm_policy: FacilityRhythmPolicy;
  media_routing_policy: FacilityMediaRoutingPolicy;
  visual_balance_targets: FacilityVisualBalanceTargets;
}

export interface SensitivityAndTruthPolicy {
  facility_claim_status_values: FacilityClaimStatus[];
  layout_claim_status_values: LayoutClaimStatus[];
  facility_status_values: FacilityStatus[];
  exact_site_claim_requires_verified_reference: boolean;
  exact_layout_claim_requires_declassified_or_official_reference: boolean;
  conceptual_reconstruction_must_not_imply_exact_layout: boolean;
  active_facility_access_routes_forbidden: boolean;
  active_security_procedures_forbidden: boolean;
  current_guard_patterns_forbidden: boolean;
  vulnerability_analysis_forbidden: boolean;
  security_blind_spots_forbidden: boolean;
  weapons_employment_instructions_forbidden: boolean;
  historical_public_construction_detail_allowed: boolean;
  generated_facility_signage_forbidden: boolean;
  generated_readable_markings_forbidden: boolean;
  invented_facility_names_forbidden: boolean;
}

export interface FacilityGlobalPromptRules {
  visual_family_values: FacilityVisualFamily[];
  story_function_values: FacilityStoryFunction[];
  facility_visibility_values: FacilityVisibility[];
  generation_permission_values: GenerationPermission[];
  media_route_values: FacilityMediaRoute[];
  evidence_confidence_values: EvidenceConfidence[];
  facility_state_code_values: Record<FacilityStateCode, string>;
  use_positive_geometry_before_negative_constraints: boolean;
  use_smallest_relevant_facility_module: boolean;
  treat_each_generated_clip_as_stateless: boolean;
  one_stable_state_per_clip: boolean;
  one_primary_action_per_clip: boolean;
  maximum_minor_supporting_actions: number;
  maximum_camera_movements: number;
  generated_readable_text_forbidden: boolean;
  geometry_transformation_forbidden: boolean;
  generic_facility_fallback_cannot_be_presented_as_exact: boolean;
  reference_asset_required_when_text_is_insufficient: boolean;
  exact_layout_requires_verified_reference: boolean;
  conceptual_cutaways_must_be_visually_generic_and_not_to_scale_when_layout_unknown: boolean;
  active_security_detail_generation_forbidden: boolean;
  final_prompt_generation_belongs_to_app: boolean;
  transcript_alignment_belongs_to_app: boolean;
  scene_plan_must_precede_prompt_generation: boolean;
  visual_beat_must_have_narrative_purpose: boolean;
  editor_native_graphics_required_for_readable_maps_timelines_and_diagrams: boolean;
  historical_event_reconstruction_must_not_be_claimed_as_authentic_footage: boolean;
}

export interface FacilityProductionHandoff {
  schema: {
    name: 'Secret Defence Facilities Visual Production Handoff';
    version: '0.9.0';
    contract_type: 'VISUAL_ONLY_ENGINE_TO_APP_HANDOFF';
    project_scope: 'SECRET_UNUSUAL_DEFENCE_FACILITIES_CONSTRUCTION_DOCUMENTARY';
    template_status: 'DRAFT_PENDING_CREATOR_PREFERENCES';
  };
  facility: Facility;
  historical_context: HistoricalContext;
  site_dimensions_and_spatial_relations: SiteDimensionsAndSpatialRelations;
  facility_modules: FacilityModule[];
  reference_assets: FacilityReferenceAsset[];
  environments: FacilityEnvironment[];
  construction_stages: ConstructionStage[];
  stage_transitions: FacilityStageTransition[];
  visual_story_plan: FacilityVisualStoryPlan;
  sensitivity_and_truth_policy: SensitivityAndTruthPolicy;
  global_prompt_rules: FacilityGlobalPromptRules;
}

export type AnyFacilityProductionHandoff = FacilityProductionHandoff;
