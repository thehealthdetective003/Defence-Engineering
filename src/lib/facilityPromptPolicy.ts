import type { SceneDirection, TopicBrief } from '../types';
import type { ConstructionStage, FacilityEnvironment, FacilityModule, FacilityProductionHandoff, FacilityReferenceAsset } from '../types/facilityProduction';

const clean = (value: unknown) => String(value ?? '').replace(/\[object Object\]/gi, '').replace(/\s+/g, ' ').trim();
const flatten = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(flatten) : typeof value === 'string' ? value.split(/\s*[|;]\s*/).map(clean).filter(Boolean) : [];
export const uniqueFacilityTerms = (values: unknown[]): string[] => {
  const seen=new Set<string>();
  return values.flatMap(flatten).filter(value=>{const key=value.toLowerCase().replace(/^(?:no|avoid|exclude|without|do not (?:show|include|use))\s+/,'').replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true;});
};
const list=(values:string[])=>values.length<2?(values[0]||''):values.length===2?`${values[0]} and ${values[1]}`:`${values.slice(0,-1).join(', ')}, and ${values.at(-1)}`;

export interface ResolvedFacilityScene {
  handoff: FacilityProductionHandoff | null;
  stage: Partial<ConstructionStage>;
  environment: Partial<FacilityEnvironment>;
  modules: FacilityModule[];
  references: FacilityReferenceAsset[];
  present: string[];
  notBuilt: string[];
  temporary: string[];
  exposed: string[];
  open: string[];
  spoilState: string;
  confirmed: string[];
  inferred: string[];
  forbidden: string[];
  activeSensitivity: boolean;
}

export function resolveFacilityScene(topic:TopicBrief|null,direction:SceneDirection):ResolvedFacilityScene {
  const candidate=topic?._production_handoff;
  const handoff=candidate?.schema?.name==='Secret Defence Facilities Visual Production Handoff'?candidate as FacilityProductionHandoff:null;
  const stage:Partial<ConstructionStage>=handoff?.construction_stages.find(item=>item.stage_id===direction.stage_id)||{};
  const environment:Partial<FacilityEnvironment>=handoff?.environments.find(item=>item.environment_id===direction.environment_ref)||{};
  const moduleIds=new Set(direction.facility_module_ids||[]);
  if(stage.geometry_control?.primary_facility_module_id)moduleIds.add(stage.geometry_control.primary_facility_module_id);
  (stage.geometry_control?.secondary_facility_module_ids||[]).forEach(id=>moduleIds.add(id));
  const modules=(handoff?.facility_modules||[]).filter(module=>moduleIds.has(module.module_id));
  const referenceIds=new Set([...(direction.reference_asset_ids||[]),...(stage.visual_evidence?.reference_asset_ids||[])]);
  const references=(handoff?.reference_assets||[]).filter(asset=>referenceIds.has(asset.asset_id));
  return {
    handoff,stage,environment,modules,references,
    present:uniqueFacilityTerms([stage.present_now||[],direction.required_visible_features]),
    notBuilt:uniqueFacilityTerms([stage.not_yet_built_or_installed||[]]),
    temporary:uniqueFacilityTerms([stage.temporary_works_present||[],environment.temporary_works||[]]),
    exposed:uniqueFacilityTerms([stage.temporarily_exposed||[]]),
    open:uniqueFacilityTerms([stage.open_interfaces||[]]),
    spoilState:clean(stage.removed_material_or_spoil_state),
    confirmed:uniqueFacilityTerms([stage.visual_evidence?.confirmed_visual_details||[]]),
    inferred:uniqueFacilityTerms([stage.visual_evidence?.analyst_inferred_visual_details||[]]),
    forbidden:uniqueFacilityTerms([direction.forbidden_elements,stage.geometry_control?.negative_constraints||[],stage.geometry_control?.forbidden_transformations||[],stage.visual_evidence?.excluded_visual_claims||[],stage.stage_actions?.flatMap(action=>action.forbidden_actions)||[],environment.forbidden_elements||[],modules.flatMap(module=>[...module.forbidden_layout_claims,...module.likely_wrong_substitutions])]),
    activeSensitivity:handoff?.facility.facility_status==='ACTIVE_PUBLICLY_DOCUMENTED',
  };
}

export function facilityIdentityClause(resolved:ResolvedFacilityScene,direction:SceneDirection):string {
  if(direction.facility_visibility==='NONE')return 'Omit the facility itself; show only the assigned contextual evidence.';
  const facility=resolved.handoff?.facility;
  const generic=!direction.exact_site_claim_allowed||direction.facility_claim_status!=='EXACT_SITE_VERIFIED';
  const name=generic?(facility?.facility_class||'defence-facility type'):(facility?.official_name||facility?.facility_class||'documented facility');
  const anchors=uniqueFacilityTerms([direction.required_visible_features,resolved.stage.geometry_control?.required_visible_anchors||[],resolved.modules.flatMap(module=>module.required_visible_features),facility?.immutable_identity_features||[]]).slice(0,6);
  return anchors.length
    ? `Preserve the documented ${name} geometry and spatial relationships visible from this viewpoint: ${list(anchors)}.`
    : `Preserve the documented ${name} geometry visible from this viewpoint without inventing its layout.`;
}

export function facilityStateClause(resolved:ResolvedFacilityScene,direction:SceneDirection):string {
  if(direction.facility_visibility==='NONE')return 'Do not introduce a facility silhouette, portal, chamber, or finished structure.';
  const parts=[`Hold one stable construction State ${direction.state}: ${clean(direction.facility_visual_state) || clean(resolved.stage.stage_visual_summary) || 'the assigned facility condition'}.`];
  if(resolved.present.length)parts.push(`Permanent or physical works already present: ${list(resolved.present.slice(0,6))}.`);
  if(resolved.notBuilt.length)parts.push(`Keep not-yet-built permanent works absent: ${list(resolved.notBuilt.slice(0,6))}.`);
  if(resolved.temporary.length)parts.push(`Keep temporary works visibly temporary: ${list(resolved.temporary.slice(0,5))}.`);
  if(resolved.exposed.length)parts.push(`Keep these surfaces or systems exposed: ${list(resolved.exposed.slice(0,5))}.`);
  if(resolved.open.length)parts.push(`Keep these excavated or open interfaces unresolved: ${list(resolved.open.slice(0,4))}.`);
  if(resolved.spoilState)parts.push(`Maintain the documented spoil/material state: ${resolved.spoilState}.`);
  if(direction.state!=='C')parts.push('Do not visually auto-complete the tunnel, lining, permanent systems, chambers, finishes, or facility during the clip.');
  if(direction.visual_family==='ABANDONMENT_OR_REMAINS')parts.push('Preserve abandonment, weathering, damage, or remains; do not restore a pristine operational condition.');
  return parts.join(' ');
}

export function facilityTruthClause(resolved:ResolvedFacilityScene,direction:SceneDirection):string {
  const references=direction.reference_asset_ids||[];
  const clauses:string[]=[];
  if(direction.facility_claim_status==='EXACT_SITE_VERIFIED'&&direction.exact_site_claim_allowed&&references.length)clauses.push(`Exact-site depiction is limited to documented features visible in references ${references.join(', ')}.`);
  else if(direction.facility_claim_status==='FACILITY_TYPE_CORROBORATED')clauses.push('Depict only the corroborated facility type; do not identify this as the exact named site.');
  else if(direction.facility_claim_status==='CONTEXTUAL_DEFENCE_INFRASTRUCTURE')clauses.push('This is contextual defence infrastructure and must not be presented as the exact named facility.');
  else if(direction.facility_claim_status==='GENERIC_NON_IDENTIFYING_VISUAL')clauses.push('Keep all facility imagery generic, non-identifying, and free of exact-site claims.');
  else clauses.push('Do not generate or present an unusable facility claim.');
  if(direction.layout_claim_status==='EXACT_LAYOUT_VERIFIED'&&direction.exact_layout_claim_allowed&&references.length)clauses.push(`Show only exact spatial relationships documented by references ${references.join(', ')}.`);
  else if(direction.layout_claim_status==='PARTIAL_LAYOUT_VERIFIED')clauses.push('Show only the documented portion of the layout; leave all other rooms, routes, and relationships unspecified.');
  else if(direction.layout_claim_status==='CONCEPTUAL_RELATIONSHIP_ONLY')clauses.push('Use simplified non-to-scale conceptual geometry only; never imply an exact floor plan or room arrangement.');
  else clauses.push('Layout is unknown: do not generate an internal cutaway, floor plan, room arrangement, hidden entrance, or access route.');
  return clauses.join(' ');
}

export function facilityRouteClause(resolved:ResolvedFacilityScene,direction:SceneDirection):string {
  const routes=direction.preferred_media_routes||[];
  const refs=direction.reference_asset_ids||[];
  const reference=`${refs.length?` Use cited assets ${refs.join(', ')} only within their allowed usage.`:''}`;
  if(routes.includes('NO_VALID_ROUTE')||direction.generation_permission==='NOT_ALLOWED')return 'No valid generated-media route exists: do not synthesize footage or an exact reconstruction; flag the scene for editorial resolution.';
  if(routes.includes('AUTHENTIC_VIDEO'))return `Use verified authentic video for the documented event or facility state; do not replace it with a generated reenactment.${reference}`;
  if(routes.includes('ARCHIVAL_VIDEO')||routes.includes('ARCHIVAL_IMAGE'))return `Use clearly sourced archival material as historical evidence; preserve its documented date and scope, and never label generated reconstruction as authentic archive footage.${reference}`;
  if(routes.includes('SATELLITE_REFERENCE'))return `Use satellite material only as constrained geographic context; do not derive current access routes, security positions, vulnerabilities, or hidden entrances.${reference}`;
  if(routes.includes('REFERENCE_IMAGE_I2V')||routes.includes('STATIC_IMAGE_WITH_MOTION'))return `Keep geometry locked to the cited reference image; motion may animate framing or documented activity but must not invent unseen layout.${reference}`;
  if(routes.includes('REFERENCE_LOCKED_GRAPHIC'))return `Build the graphic only from cited reference-locked relationships and dimensions; do not extrapolate beyond them.${reference}`;
  if(routes.includes('EDITOR_NATIVE_GRAPHIC')||direction.generation_permission==='EDITOR_ONLY')return 'Route this scene to an editor-native graphic; generated output may describe composition but must not fabricate labels, dimensions, maps, or layout.';
  const historical=/histor|archive|declassified|event|then|during construction/i.test(`${direction.voiceover} ${direction.story_function||''}`);
  return historical?'Treat generated imagery as an illustrative historical reconstruction, never as authentic footage.':'Use generated footage only for the assigned contextual, non-identifying, truth-bounded visual.';
}

export function facilityPhysicsClause(resolved:ResolvedFacilityScene,direction:SceneDirection):string {
  const text=`${direction.visual_family||''} ${direction.primary_action} ${direction.supporting_motion}`.toLowerCase();
  if(/crane|lift|hoist|rigging|sling/.test(text))return 'Keep rigging connected, taut under load, and attached to credible lifting points; the load remains supported and moves continuously without teleportation or impossible swing.';
  if(/internal_systems|ventilation|drainage|generator|power|piping|utilities/.test(text))return 'Show only documented ventilation, drainage, power, piping, or utility relationships and supported installation state; do not invent current security infrastructure or unseen internal routing.';
  if(/concrete_and_lining|concrete|lining|formwork|rebar|waterproof/.test(text))return 'Place concrete or lining only where the assigned construction state permits. Preserve formwork, reinforcement, wet or unfinished material, and exposed interfaces; do not transform it instantly into finished architecture or add permanent systems early.';
  if(/tunneling|tbm|tunnel boring|heading|shotcrete|rock bolt/.test(text))return 'Keep tunnelling machinery aligned with the supported tunnel direction. Excavation advances at the face; ground support or lining remains behind it only where the assigned stage permits, and the tunnel cannot become fully finished mid-clip.';
  if(direction.visual_family==='EXCAVATION_AND_BLASTING')return 'Keep the drill acting on the supported exposed rock face. Any blast is controlled historical construction blasting only: credible charge effect, rock fragmentation, dust, and workers or equipment at safe believable positions; never combat or weapon discharge.';
  if(/rock_removal|spoil|muck|loader|truck|conveyor/.test(text))return 'Excavated material must originate at the excavation face and remain conserved as loaders, trucks, or conveyors move it; no disappearing or duplicated spoil and no impossible machinery motion.';
  if(/excavation_and_blasting|drill|blast|charge|excavat/.test(text))return 'Keep the drill acting on the supported exposed rock face. Any blast is controlled historical construction blasting only: credible charge effect, rock fragmentation, dust, and workers or equipment at safe believable positions; never combat or weapon discharge.';
  if(/groundwater|leak|collapse|crack|settlement|ice|corrosion|instability/.test(text))return 'Make geology, groundwater, cracking, settlement, ice, or corrosion affect only the documented surfaces and construction response; preserve material continuity and avoid cinematic disaster escalation.';
  return 'Use one physically plausible construction or documentary action with continuous material, machinery, worker, and environmental motion; no teleportation, duplication, morphing, or unsupported state change.';
}

export function facilitySoundClause(resolved:ResolvedFacilityScene,direction:SceneDirection):string {
  if(direction.visual_treatment==='STATIC_GRAPHIC_T2V'||direction.visual_treatment==='MOTION_GRAPHIC_T2V')return 'Use restrained abstract documentary sound synchronized only to visible graphic motion.';
  if(direction.visual_treatment==='REFERENCE_MEDIA')return 'Use authentic source audio only when supplied and verified; otherwise use restrained editorial room tone without fabricated event sound.';
  const text=`${direction.visual_family||''} ${direction.primary_action} ${direction.environment_description} ${resolved.environment.weather_or_climate||''} ${resolved.environment.geographic_context||''}`.toLowerCase();
  if(/excavation|blasting|drill|rock removal|spoil/.test(text))return 'Use synchronized drilling, rock impact, excavator hydraulics, truck or conveyor movement, and construction ventilation only when each source is visible or physically present.';
  if(/tunnel|tbm|underground construction/.test(text))return 'Use synchronized heavy mechanical rumble, cutter or drill contact, hydraulics, spoil handling, ventilation, and groundwater drips only where visibly or contextually supported.';
  if(/concrete|lining|formwork|rebar/.test(text))return 'Use synchronized pump, concrete vibration, formwork or tool contact, and subdued worker and machinery ambience matching the visible work.';
  if(/arctic|snow|ice|polar/.test(text))return 'Use wind, machinery, snow, and ice ambience corresponding only to visible conditions and actions.';
  if(/marine|coast|coastal|sea|island|port/.test(text))return 'Use wind, waves, cranes, steel contact, and machinery ambience corresponding only to visible coastal activity.';
  if(direction.state==='C'&&/underground|interior|subsurface|completed|operational/.test(text))return 'Use ventilation, generator or mechanical hum, footsteps where people are visible, and restrained underground reverberation.';
  return 'Use realistic synchronized terrain, construction, machinery, or environmental ambience corresponding only to visible plausible actions.';
}

export function facilityNegativeConstraints(resolved:ResolvedFacilityScene,direction:SceneDirection):string[] {
  const policy=resolved.handoff?.sensitivity_and_truth_policy;
  const global=resolved.handoff?.facility.global_negative_constraints||[];
  const truth:string[]=[];
  if(direction.facility_claim_status!=='EXACT_SITE_VERIFIED'||!direction.exact_site_claim_allowed)truth.push('false exact-site claim','contextual imagery named as the exact facility');
  if(direction.layout_claim_status==='UNKNOWN')truth.push('invented exact internal layout','fictional room arrangement','generated floor plan','exact facility cutaway');
  if(direction.layout_claim_status==='CONCEPTUAL_RELATIONSHIP_ONLY')truth.push('conceptual geometry presented as exact or to scale','invented room arrangement');
  if(direction.layout_claim_status==='PARTIAL_LAYOUT_VERIFIED')truth.push('undocumented layout beyond the verified portion');
  const sensitivity=[
    !policy||policy.active_facility_access_routes_forbidden?'current access-route reconstruction':null,
    !policy||policy.active_security_procedures_forbidden?'current security procedures':null,
    !policy||policy.current_guard_patterns_forbidden?'guard posts or patrol routines':null,
    !policy||policy.security_blind_spots_forbidden?'surveillance positions or blind spots':null,
    !policy||policy.vulnerability_analysis_forbidden?'vulnerability visualization or sabotage pathway':null,
    'unsupported hidden entrance','invented military signage','readable fake labels, logos, numbers, or map text','unsupported blast or survivability claims','combat or weapon-discharge spectacle',
  ].filter(Boolean) as string[];
  const archive=(direction.preferred_media_routes||[]).some(route=>['ARCHIVAL_IMAGE','ARCHIVAL_VIDEO','AUTHENTIC_VIDEO'].includes(route))||direction.visual_treatment==='REFERENCE_MEDIA';
  if(archive)truth.push('generated reconstruction presented as authentic archival footage');
  const negativeTruth=(direction.truth_constraints||[]).filter(value=>/\b(?:do not|never|must not|forbid|unknown)\b/i.test(value));
  return uniqueFacilityTerms([truth,sensitivity,negativeTruth,resolved.forbidden,global]);
}
