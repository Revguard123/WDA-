import { isOfficialNaics2022 } from './naicsReference.js';

const KEY_RULES = {
  medical_vs_general_ppe: { medical_ppe: ['423450'], general_ppe: ['423850', '315990'], both: ['423450', '423850', '315990'] },
  product_vs_installation: { product_supply: ['423330'], installation: ['238310'], both: ['423330', '238310'] },
  aircraft_platform_vs_sensor_payload: { aircraft_platform: ['336411'], sensor_payload: ['334511'], both: ['336411', '334511'] },
  design_vs_installation: { design: ['541512'], installation: ['238210'], both: ['541512', '238210'] },
  software_delivery_vs_research: { software_delivery: ['541511'], research: ['541715'], both: ['541511', '541715'] },
  modular_product_vs_site_construction: { modular_product: ['332311'], site_construction: ['236220'], both: ['332311', '236220'] },
  prime_construction_vs_design_services: { construction_prime: ['236220'], design_services: ['541330', '541310'], both: ['236220', '541330', '541310'] },
  manufacturing_branch: { installation: [], manufacturing: ['321911'] },
  profession_specific_direct_practitioner_contracting: { staffing_firm: [], direct_practitioner: [] },
  clinical_service_type: { practitioner_service: ['621399'], general_ambulatory: ['621999'], unknown: [] },
  portable_clinic_service_model: { clinic_service: [], equipment_upfit: [], bundled: [] },
  facility_support_vs_equipment_repair: { facility_support: ['561210'], equipment_repair: ['811310'], both: ['561210', '811310'] },
  grounds_vs_roadway: { grounds: ['561730'], roadway: ['488490'], both: ['561730', '488490'] },
  maintenance_vs_management_consulting: { maintenance: ['811111', '811198'], consulting: ['541614'], both: ['811111', '811198', '541614'] },
  air_vs_maritime: { air: ['481112', '481212'], maritime: ['483111', '483113', '483211'], both: ['481112', '481212', '483111', '483113', '483211'] },
  scheduled_vs_chartered: { scheduled: ['481112'], chartered: ['481212'], unknown: [] },
  carrier_vs_freight_arrangement: { carrier: [], arrangement: ['488510'], both: ['488510'] },
  freight_vs_consulting_vs_relief_service: { freight: ['488510'], consulting: ['541614'], relief_service: ['624230'] },
  research_domain: {
    physical_engineering_life_sciences: ['541715'],
    biotech: ['541714'],
    nanotech: ['541713'],
    social_sciences: ['541720'],
  },
  research_vs_software_delivery: { research: ['541715', '541714'], software_delivery: ['541511'], both: ['541715', '541714', '541511'] },
  study_domain: { management: ['541611'], scientific_technical: ['541690'], research: ['541715'] },
  monitoring_vs_installation: { monitoring: ['561621'], installation: ['238210'], both: ['561621', '238210'] },
  service_vs_supply_vs_manufacturing: { service: ['561621'], supply: ['423610'], manufacturing: ['334290'] },
  apparel_vs_equipment: { apparel: ['315990'], equipment: ['339920'], both: ['315990', '339920'] },
  firearms_or_small_arms: { yes: ['332994'], no: [] },
  small_arms_ammunition: { yes: ['332992'], no: [] },
  other_ammunition: { yes: ['332993'], no: [] },
  dealer_distributor_vs_manufacturer: { dealer_distributor: ['423990'], manufacturer: ['332994', '332992', '332993'], both: ['423990', '332994', '332992', '332993'] },
  inspection_vs_equipment_supply: { inspection: ['541350'], equipment_supply: [], both: ['541350'] },
  fire_safety_equipment_classification: { inspection_only: ['541350'], equipment_needs_review: [] },
  content_development_vs_software_platform: { content_development: ['611710'], software_platform: ['541511'], both: ['611710', '541511'] },
  software_vs_training_service: { software: ['541511'], training: ['611430'], both: ['541511', '611430'] },
  water_supply_operations: { yes: ['221310'], no: [] },
  wastewater_treatment: { yes: ['221320'], no: [] },
  construction: { yes: ['237110'], no: [] },
  generation_vs_installation_vs_consulting: { generation: [], installation: ['238210'], consulting: ['541690'] },
  solar_vs_wind_generation: { solar: ['221114'], wind: ['221115'], not_generation: [] },
  construction_vs_consulting: { construction: ['237110'], consulting: ['541620'], both: ['237110', '541620'] },
  audit_vs_installation: { audit_consulting: ['541690'], installation: ['238210'], both: ['541690', '238210'] },
  monitoring_service_vs_equipment: { monitoring_service: ['541620'], equipment: ['334519'], both: ['541620', '334519'] },
  video_vs_written_or_design_content: { video: ['512110'], written_design: ['541430', '541613'], both: ['512110', '541430', '541613'] },
  financial_audit_vs_it_security_audit: { financial_audit: ['541211'], it_security_audit: ['541519'], both: ['541211', '541519'] },
  legal_service_vs_document_support: { legal_service: ['541110', '541199'], document_support: ['561410'], both: ['541110', '541199', '561410'] },
  legal_service_model: { legal_services: ['541199'], mediation_specific: [], unknown: [] },
};

export function validateAdaptiveResolverCoverage(contextKeys = []) {
  const missing = contextKeys.filter((key) => !KEY_RULES[key]);
  return { ok: missing.length === 0, missing };
}

function uniqueOfficialSubset(codes, allowed) {
  const allowedSet = new Set(allowed || []);
  const out = [];
  for (const code of codes || []) {
    if (!allowedSet.has(code)) continue;
    if (!isOfficialNaics2022(code)) continue;
    if (!out.includes(code)) out.push(code);
  }
  return out.slice(0, 5);
}

export function resolveAdaptiveCodes(mapping, adaptiveAnswers = {}) {
  if (!mapping || mapping.mapping_type === 'needs_review') {
    return { resolved: false, codes: [], unresolved_keys: mapping?.required_context || [] };
  }
  if (mapping.production_safe) {
    return { resolved: true, codes: mapping.codes || [], unresolved_keys: [] };
  }
  const candidateCodes = mapping.candidate_codes || [];
  const selected = [];
  const unresolved = [];
  for (const key of mapping.required_context || []) {
    const answer = adaptiveAnswers[key];
    const rule = KEY_RULES[key]?.[answer];
    if (!answer || !rule) {
      unresolved.push(key);
      continue;
    }
    for (const code of uniqueOfficialSubset(rule, candidateCodes)) {
      if (!selected.includes(code)) selected.push(code);
    }
  }
  const codes = uniqueOfficialSubset(selected, candidateCodes);
  return {
    resolved: codes.length > 0 && unresolved.length === 0,
    codes,
    unresolved_keys: unresolved,
  };
}
