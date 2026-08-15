import type {
  AnyFacilityProductionHandoff,
  FacilityClaimStatus,
  FacilityMediaRoute,
  FacilityStateCode,
  FacilityStoryFunction,
  FacilityVisibility,
  FacilityVisualFamily,
  GenerationPermission,
  LayoutClaimStatus,
} from './types/facilityProduction';
export type {
  FacilityStateCode,
  FacilityStoryFunction as StoryFunction,
  FacilityVisibility,
  FacilityVisualFamily as VisualFamily,
} from './types/facilityProduction';

export type PhaseType = 1 | 2 | 3;
export type ProjectFormatId = 'facility-construction';
export type T2VPromptProfile = 'omni-flash' | 'veo-flow';
export interface Settings {
  apiKey: string;
  model: string;
  defaultDuration: string;
  defaultStyle: string;
  sceneDurationSeconds: 8 | 10;
  facilityHandoffTemplate?: Record<string, any>;
  facilityHandoffTemplateName?: string;
  facilityHandoffTemplateImportedAt?: string;
}
export interface OmniPromptSections {
  cinematography: string;
  subject: string;
  action: string;
  environment: string;
  style_lighting: string;
  facility_state: string;
  sound: string;
  exclusions: string;
}
export interface TopicBrief {
  schema_version?: string;
  topic: { 
    title: string; 
    facility?: string;
    category: string; 
    country_or_operator?: string;
    construction_era?: string;
    facility_status?: string;
    public_location_name?: string;
    suggested_duration?: string | number;
    platform_risk?: string;
  };
  source_integrity?: {
    source_quality_summary?: string;
    evidence_confidence_summary?: string;
    allowed_claim_confidence?: string[];
    disallowed_claim_confidence?: string[];
    research_ledger_note?: string;
  };
  global_visual_constants: string;
  /**
   * The full anchor text (legacy single-field format).
   * May contain both positive descriptions and "NOT / NO" exclusion clauses.
   * The prompt engine automatically splits this via parseAnchorComponents().
   * You may also provide the split fields below directly.
   */
  anti_hallucination_anchor?: string;
  /** Positive-only facility visual specification. */
  visual_lock?: string;
  /** Facility exclusions used only as negative constraints. */
  visual_exclusions?: string;
  facility_identity_lock?: {
    core_geometry: string;
    surface_finish: string;
    markings: string;
    scale_reference: string;
    distinctive_features: string[];
    must_remain_consistent_across_all_scenes: boolean;
  };
  master_voiceover_script?: string;
  global_negative_prompts?: string;
  negative_prompt_global?: string[];
  cinematography_rules?: {
    camera_style: string;
    lens_language: string;
    lighting_style: string;
    color_grade: string;
    motion_rules: string;
  };
  scene_continuity_rules?: {
    lifecycle_progression: string;
    state_consistency: string;
    environment_logic: string;
    markings_consistency: string;
    scale_consistency: string;
    no_stage_skipping: boolean;
  };
  lifecycle_stage_count?: number | string;
  quality_control?: any;
  _production_handoff?: AnyFacilityProductionHandoff;
  environments: Array<{
    environment_id?: string;
    stage_ref?: string;
    name: string;
    environment_type?: string;
    visual_details: string;
    confirmed_visuals?: string;
    inferred_visuals?: string;
    reference_confidence?: {
      visual_reference?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
      facility_accuracy?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
      inference_level?: string;
    };
    do_not_show?: string[];
    nation?: string;
  }>;
  lifecycle_stages?: Array<{
    stage_id?: string;
    stage_name: string;
    environment_ref: string;
    stage_function?: string;
    evidence_confidence?: string;
    action: string;
    facility_visual_state?: string;
    /** A = site/preparation, B = partial construction, C = completed/remains. */
    state?: 'A' | 'B' | 'C';
    primary_camera_shot?: string;
    secondary_detail_shots?: string[];
    motion_direction?: string;
    quality_control_focus?: string;
    continuity_from_previous_stage?: string;
    transition_to_next_stage?: string;
    visual_risk_notes?: string;
    source_claim_refs?: string[];
  }>;
  shot_plan?: Array<{
    stage_ref: string;
    shot_number: number;
    shot_type: string;
    purpose: string;
    camera_motion: string;
    approx_duration_seconds?: string | number;
    continuity_notes?: string;
  }>;
}
export interface TimedWord { text: string; start: number; end: number; probability: number; }
export interface TimedTranscriptSegment { text: string; start: number; end: number; words: TimedWord[]; }
export interface TimedScene { number: number; start: number; end: number; duration: number; text: string; silent: boolean; }
export interface VoiceoverTranscription {
  audioFileName: string;
  duration: number;
  language: 'en';
  languageProbability: number;
  model: string;
  computeType: string;
  text: string;
  segments: TimedTranscriptSegment[];
  words: TimedWord[];
  sceneDurationSeconds: 8 | 10;
  scenes: TimedScene[];
  importedAt: string;
}
export type VisualTreatment = 'LIVE_ACTION_T2V' | 'STATIC_GRAPHIC_T2V' | 'MOTION_GRAPHIC_T2V';
export type VisualTreatmentWithReference = VisualTreatment | 'REFERENCE_MEDIA';
export type CinematicEnergy = 'LOW' | 'MEDIUM' | 'HIGH';
export type GraphicSubtype =
  | 'SITE_CROSS_SECTION'
  | 'TERRAIN_OVERBURDEN'
  | 'EXCAVATION_PROGRESSION'
  | 'TUNNEL_SEQUENCE'
  | 'STRUCTURAL_LAYER'
  | 'VENTILATION_FLOW'
  | 'DRAINAGE_FLOW'
  | 'CONSTRUCTION_TIMELINE'
  | 'CONCEPTUAL_FACILITY_RELATIONSHIP'
  | 'SCALE_COMPARISON';
export type GraphicComposition =
  | 'SINGLE_SUBJECT'
  | 'ORTHOGRAPHIC_CUTAWAY'
  | 'LEFT_TO_RIGHT_FLOW'
  | 'LAYERED_SEPARATION'
  | 'TWO_PANEL_COMPARISON'
  | 'CONCENTRIC_SIGNAL_FIELD'
  | 'SYMBOLIC_ROUTE'
  | 'MATCHED_SHAPE_TRANSITION';
export type GraphicMotionPattern =
  | 'MINIMAL_PARALLAX'
  | 'HIGHLIGHT_PULSE'
  | 'FLOW_DRAW_ON'
  | 'COMPONENT_TRANSLATION'
  | 'LAYER_SEPARATION'
  | 'SIGNAL_SWEEP'
  | 'HEAT_ZONE_PROGRESSION';
export type GraphicAnnotationDevice = 'DIRECTIONAL_ARROWS'|'FLOW_LINES'|'HIGHLIGHT_RING'|'COLORED_ZONE'|'SIGNAL_WAVES'|'MEASUREMENT_BASELINE';
export interface GraphicSceneSpec {
  graphic_subtype: GraphicSubtype;
  visual_claim: string;
  composition: GraphicComposition;
  motion_pattern: GraphicMotionPattern;
  annotation_devices: GraphicAnnotationDevice[];
  palette_profile: 'PREMIUM_TECHNICAL_VECTOR';
  maximum_animated_elements: 1 | 2 | 3;
  transition_anchor: string | null;
  text_policy: 'NO_GENERATED_TEXT';
  layout_claim_status: LayoutClaimStatus;
  not_to_scale: boolean;
  reference_asset_ids: string[];
}
export interface PlannedScene {
  number: number;
  chapter_id: string;
  beat_id: string;
  visual_family: FacilityVisualFamily;
  story_function: FacilityStoryFunction;
  visual_treatment: VisualTreatmentWithReference;
  facility_visibility: FacilityVisibility;
  stage_id: string;
  environment_ref: string;
  state: FacilityStateCode;
  energy_level: CinematicEnergy;
  facility_claim_status: FacilityClaimStatus;
  layout_claim_status: LayoutClaimStatus;
  generation_permission: GenerationPermission;
  preferred_media_routes: FacilityMediaRoute[];
  reference_asset_ids: string[];
  exact_site_claim_allowed: boolean;
  exact_layout_claim_allowed: boolean;
  facility_module_ids: string[];
  required_visible_features: string[];
  forbidden_elements: string[];
  truth_constraints: string[];
  continuity_requirements: string[];
  graphic_spec: GraphicSceneSpec | null;
}
export interface TemporalAction {
  opening_state: string;
  primary_motion: string;
  physical_interaction: string;
  mid_shot_progression: string;
  ending_state: string;
}
export interface SceneDirection {
  number: number;
  start: number;
  end: number;
  duration: number;
  voiceover: string;
  silent: boolean;
  chapter_id?: string;
  beat_id?: string;
  visual_family?: FacilityVisualFamily;
  story_function?: FacilityStoryFunction;
  visual_treatment?: VisualTreatmentWithReference;
  facility_visibility?: FacilityVisibility;
  energy_level?: CinematicEnergy;
  facility_claim_status?: FacilityClaimStatus;
  layout_claim_status?: LayoutClaimStatus;
  generation_permission?: GenerationPermission;
  preferred_media_routes?: FacilityMediaRoute[];
  reference_asset_ids?: string[];
  exact_site_claim_allowed?: boolean;
  exact_layout_claim_allowed?: boolean;
  facility_module_ids?: string[];
  truth_constraints?: string[];
  continuity_requirements?: string[];
  graphic_spec?: GraphicSceneSpec | null;
  stage_id: string;
  state: FacilityStateCode;
  subject: string;
  facility_visual_state: string;
  primary_action: string;
  supporting_motion: string;
  environment_ref: string;
  environment_description: string;
  camera: { shot_scale: string; lens: string; angle: string; movement: string; movement_speed: string };
  lighting_and_material: string;
  continuity_from_previous: string;
  transition_to_next: string;
  required_visible_features: string[];
  forbidden_elements: string[];
  temporal_action?: TemporalAction;
}
export interface T2VPrompt {
  number: number;
  stage_id?: string;
  state?: 'A' | 'B' | 'C';
  continuity_notes?: string;
  quality_flags?: string[];
  action_description: string;
  video_prompt: string;
  voiceover: string;
  stock_keywords: string;
  omniSections?: OmniPromptSections;
}
export interface AppState {
  projectSchemaVersion: number;
  id?: string;
  projectName: string;
  projectFormat: ProjectFormatId;
  phase: PhaseType;
  topic: TopicBrief | null;
  plannedScenes: PlannedScene[];
  sceneDirections: SceneDirection[];
  masterVoiceoverScript: string;
  voiceoverTranscription: VoiceoverTranscription | null;
  t2vPromptProfile: T2VPromptProfile;
  visualPrompts: T2VPrompt[];
  demoState: 'idle' | 'generating' | 'review' | 'approved';
  demoScenes: T2VPrompt[];
  demoSceneNumbers: number[];
}
export interface SavedProject {
  id: string;
  name: string;
  title: string;
  category: string;
  phase: PhaseType;
  sceneCount: number;
  demoOnly: boolean;
  savedAt: string;
  createdAt: string;
}
export interface FullProjectData extends AppState {
  id: string;
  savedAt: string;
  createdAt: string;
}
