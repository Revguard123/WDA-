export const ADAPTIVE_QUESTIONS = {
  medical_vs_general_ppe: {
    key: 'medical_vs_general_ppe',
    prompt: 'Is this mainly medical PPE or general workplace protective gear?',
    options: [
      { value: 'medical_ppe', label: 'Medical PPE' },
      { value: 'general_ppe', label: 'General workplace PPE' },
      { value: 'both', label: 'Both' },
    ],
  },
  product_vs_installation: {
    key: 'product_vs_installation',
    prompt: 'Are you mainly supplying the materials or performing the installation?',
    options: [
      { value: 'product_supply', label: 'Supplying materials' },
      { value: 'installation', label: 'Performing installation' },
      { value: 'both', label: 'Both' },
    ],
  },
  aircraft_platform_vs_sensor_payload: {
    key: 'aircraft_platform_vs_sensor_payload',
    prompt: 'Is the work mainly the aircraft platform or the sensor/navigation payload?',
    options: [
      { value: 'aircraft_platform', label: 'Aircraft platform' },
      { value: 'sensor_payload', label: 'Sensor or navigation payload' },
      { value: 'both', label: 'Both' },
    ],
  },
  protective_apparel_classification: {
    key: 'protective_apparel_classification',
    prompt: 'Is this protective apparel, tactical equipment, or something else requiring review?',
    options: [
      { value: 'protective_apparel', label: 'Protective apparel' },
      { value: 'tactical_equipment', label: 'Tactical equipment' },
      { value: 'needs_review', label: 'Needs classification review' },
    ],
  },
  design_vs_installation: {
    key: 'design_vs_installation',
    prompt: 'Is your work mainly design/engineering or physical installation?',
    options: [
      { value: 'design', label: 'Design / engineering' },
      { value: 'installation', label: 'Physical installation' },
      { value: 'both', label: 'Both' },
    ],
  },
  software_delivery_vs_research: {
    key: 'software_delivery_vs_research',
    prompt: 'Are you primarily building/deploying software, or performing formal research and development?',
    options: [
      { value: 'software_delivery', label: 'Building or deploying software' },
      { value: 'research', label: 'Formal R&D' },
      { value: 'both', label: 'Both' },
    ],
  },
  modular_product_vs_site_construction: {
    key: 'modular_product_vs_site_construction',
    prompt: 'Is this mainly prefabricated/modular product supply or site construction?',
    options: [
      { value: 'modular_product', label: 'Modular product supply' },
      { value: 'site_construction', label: 'Site construction' },
      { value: 'both', label: 'Both' },
    ],
  },
  prime_construction_vs_design_services: {
    key: 'prime_construction_vs_design_services',
    prompt: 'Is the primary role construction prime work or design/engineering services?',
    options: [
      { value: 'construction_prime', label: 'Construction prime' },
      { value: 'design_services', label: 'Design / engineering services' },
      { value: 'both', label: 'Both' },
    ],
  },
  manufacturing_branch: {
    key: 'manufacturing_branch',
    prompt: 'Does this involve manufacturing wood products rather than installing carpentry?',
    options: [
      { value: 'installation', label: 'Installation / carpentry work' },
      { value: 'manufacturing', label: 'Manufacturing wood products' },
    ],
  },
  profession_specific_direct_practitioner_contracting: {
    key: 'profession_specific_direct_practitioner_contracting',
    prompt: 'Is this healthcare staffing through a staffing firm, or direct practitioner contracting?',
    options: [
      { value: 'staffing_firm', label: 'Staffing firm' },
      { value: 'direct_practitioner', label: 'Direct practitioner contracting' },
    ],
  },
  clinical_service_type: {
    key: 'clinical_service_type',
    prompt: 'What clinical service model best describes the work?',
    options: [
      { value: 'practitioner_service', label: 'Practitioner service' },
      { value: 'general_ambulatory', label: 'General ambulatory care' },
      { value: 'unknown', label: 'Not sure' },
    ],
  },
  portable_clinic_service_model: {
    key: 'portable_clinic_service_model',
    prompt: 'Is this a portable clinic service, equipment/upfit supply, or bundled model?',
    options: [
      { value: 'clinic_service', label: 'Clinic service' },
      { value: 'equipment_upfit', label: 'Equipment or vehicle upfit' },
      { value: 'bundled', label: 'Bundled / not sure' },
    ],
  },
  facility_support_vs_equipment_repair: {
    key: 'facility_support_vs_equipment_repair',
    prompt: 'Is this broad facility support or equipment repair?',
    options: [
      { value: 'facility_support', label: 'Broad facility support' },
      { value: 'equipment_repair', label: 'Equipment repair' },
      { value: 'both', label: 'Both' },
    ],
  },
  grounds_vs_roadway: {
    key: 'grounds_vs_roadway',
    prompt: 'Is the outdoor work mainly grounds maintenance or roadway support?',
    options: [
      { value: 'grounds', label: 'Grounds maintenance' },
      { value: 'roadway', label: 'Roadway support' },
      { value: 'both', label: 'Both' },
    ],
  },
  maintenance_vs_management_consulting: {
    key: 'maintenance_vs_management_consulting',
    prompt: 'Is this hands-on fleet maintenance or management consulting?',
    options: [
      { value: 'maintenance', label: 'Hands-on maintenance' },
      { value: 'consulting', label: 'Management consulting' },
      { value: 'both', label: 'Both' },
    ],
  },
  air_vs_maritime: {
    key: 'air_vs_maritime',
    prompt: 'Is this primarily air logistics or maritime logistics?',
    options: [
      { value: 'air', label: 'Air' },
      { value: 'maritime', label: 'Maritime' },
      { value: 'both', label: 'Both' },
    ],
  },
  scheduled_vs_chartered: {
    key: 'scheduled_vs_chartered',
    prompt: 'For air freight, is it scheduled or chartered?',
    options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'chartered', label: 'Chartered' },
      { value: 'unknown', label: 'Not sure' },
    ],
  },
  carrier_vs_freight_arrangement: {
    key: 'carrier_vs_freight_arrangement',
    prompt: 'Are you operating the carrier service or arranging freight through providers?',
    options: [
      { value: 'carrier', label: 'Carrier service' },
      { value: 'arrangement', label: 'Freight arrangement / brokering' },
      { value: 'both', label: 'Both' },
    ],
  },
  freight_vs_consulting_vs_relief_service: {
    key: 'freight_vs_consulting_vs_relief_service',
    prompt: 'Is the disaster logistics role freight, consulting, or direct relief service?',
    options: [
      { value: 'freight', label: 'Freight arrangement' },
      { value: 'consulting', label: 'Logistics consulting' },
      { value: 'relief_service', label: 'Relief service' },
    ],
  },
  research_domain: {
    key: 'research_domain',
    prompt: 'What type of research is closest?',
    options: [
      { value: 'physical_engineering_life_sciences', label: 'Physical, engineering, or life sciences' },
      { value: 'biotech', label: 'Biotechnology' },
      { value: 'nanotech', label: 'Nanotechnology' },
      { value: 'social_sciences', label: 'Social sciences / humanities' },
    ],
  },
  research_vs_software_delivery: {
    key: 'research_vs_software_delivery',
    prompt: 'Is this formal R&D or software delivery?',
    options: [
      { value: 'research', label: 'Formal R&D' },
      { value: 'software_delivery', label: 'Software delivery' },
      { value: 'both', label: 'Both' },
    ],
  },
  study_domain: {
    key: 'study_domain',
    prompt: 'What domain is the feasibility study in?',
    options: [
      { value: 'management', label: 'Management / operations' },
      { value: 'scientific_technical', label: 'Scientific / technical consulting' },
      { value: 'research', label: 'R&D' },
    ],
  },
  monitoring_vs_installation: {
    key: 'monitoring_vs_installation',
    prompt: 'Is this monitoring/service operation or physical installation?',
    options: [
      { value: 'monitoring', label: 'Monitoring / service' },
      { value: 'installation', label: 'Physical installation' },
      { value: 'both', label: 'Both' },
    ],
  },
  service_vs_supply_vs_manufacturing: {
    key: 'service_vs_supply_vs_manufacturing',
    prompt: 'Is this primarily service, equipment supply, or manufacturing?',
    options: [
      { value: 'service', label: 'Service' },
      { value: 'supply', label: 'Equipment supply' },
      { value: 'manufacturing', label: 'Manufacturing' },
    ],
  },
  apparel_vs_equipment: {
    key: 'apparel_vs_equipment',
    prompt: 'Is this mainly apparel or equipment?',
    options: [
      { value: 'apparel', label: 'Apparel' },
      { value: 'equipment', label: 'Equipment' },
      { value: 'both', label: 'Both' },
    ],
  },
  firearms_or_small_arms: {
    key: 'firearms_or_small_arms',
    prompt: 'Is this firearms/small arms equipment?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  small_arms_ammunition: {
    key: 'small_arms_ammunition',
    prompt: 'Is this small-arms ammunition?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  other_ammunition: {
    key: 'other_ammunition',
    prompt: 'Is this ammunition other than small-arms ammunition?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  dealer_distributor_vs_manufacturer: {
    key: 'dealer_distributor_vs_manufacturer',
    prompt: 'Is your role dealer/distributor or manufacturer?',
    options: [
      { value: 'dealer_distributor', label: 'Dealer / distributor' },
      { value: 'manufacturer', label: 'Manufacturer' },
      { value: 'both', label: 'Both' },
    ],
  },
  inspection_vs_equipment_supply: {
    key: 'inspection_vs_equipment_supply',
    prompt: 'Is this inspection service or equipment supply?',
    options: [
      { value: 'inspection', label: 'Inspection service' },
      { value: 'equipment_supply', label: 'Equipment supply' },
      { value: 'both', label: 'Both' },
    ],
  },
  fire_safety_equipment_classification: {
    key: 'fire_safety_equipment_classification',
    prompt: 'Does the fire-safety equipment branch need classification review?',
    options: [
      { value: 'inspection_only', label: 'Inspection only' },
      { value: 'equipment_needs_review', label: 'Equipment supply needs review' },
    ],
  },
  content_development_vs_software_platform: {
    key: 'content_development_vs_software_platform',
    prompt: 'Is this course content development or software platform development?',
    options: [
      { value: 'content_development', label: 'Course content' },
      { value: 'software_platform', label: 'Software platform' },
      { value: 'both', label: 'Both' },
    ],
  },
  software_vs_training_service: {
    key: 'software_vs_training_service',
    prompt: 'Is this software development or training service?',
    options: [
      { value: 'software', label: 'Software development' },
      { value: 'training', label: 'Training service' },
      { value: 'both', label: 'Both' },
    ],
  },
  water_supply_operations: {
    key: 'water_supply_operations',
    prompt: 'Does this involve clean-water supply or irrigation operations?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  wastewater_treatment: {
    key: 'wastewater_treatment',
    prompt: 'Does this involve wastewater treatment operations?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  construction: {
    key: 'construction',
    prompt: 'Does this involve construction of water/sewer structures?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  generation_vs_installation_vs_consulting: {
    key: 'generation_vs_installation_vs_consulting',
    prompt: 'Is this energy generation, installation, or consulting?',
    options: [
      { value: 'generation', label: 'Generation' },
      { value: 'installation', label: 'Installation' },
      { value: 'consulting', label: 'Consulting' },
    ],
  },
  solar_vs_wind_generation: {
    key: 'solar_vs_wind_generation',
    prompt: 'If generation applies, is it solar or wind?',
    options: [
      { value: 'solar', label: 'Solar' },
      { value: 'wind', label: 'Wind' },
      { value: 'not_generation', label: 'Not generation' },
    ],
  },
  construction_vs_consulting: {
    key: 'construction_vs_consulting',
    prompt: 'Is this construction or consulting?',
    options: [
      { value: 'construction', label: 'Construction' },
      { value: 'consulting', label: 'Consulting' },
      { value: 'both', label: 'Both' },
    ],
  },
  audit_vs_installation: {
    key: 'audit_vs_installation',
    prompt: 'Is this audit/consulting or implementation/installation?',
    options: [
      { value: 'audit_consulting', label: 'Audit / consulting' },
      { value: 'installation', label: 'Installation' },
      { value: 'both', label: 'Both' },
    ],
  },
  monitoring_service_vs_equipment: {
    key: 'monitoring_service_vs_equipment',
    prompt: 'Is this monitoring service or equipment?',
    options: [
      { value: 'monitoring_service', label: 'Monitoring service' },
      { value: 'equipment', label: 'Equipment' },
      { value: 'both', label: 'Both' },
    ],
  },
  video_vs_written_or_design_content: {
    key: 'video_vs_written_or_design_content',
    prompt: 'Is the content mainly video, written/design content, or both?',
    options: [
      { value: 'video', label: 'Video' },
      { value: 'written_design', label: 'Written or design content' },
      { value: 'both', label: 'Both' },
    ],
  },
  financial_audit_vs_it_security_audit: {
    key: 'financial_audit_vs_it_security_audit',
    prompt: 'Is this financial audit or IT security audit?',
    options: [
      { value: 'financial_audit', label: 'Financial audit' },
      { value: 'it_security_audit', label: 'IT security audit' },
      { value: 'both', label: 'Both' },
    ],
  },
  legal_service_vs_document_support: {
    key: 'legal_service_vs_document_support',
    prompt: 'Is this legal service or document support?',
    options: [
      { value: 'legal_service', label: 'Legal service' },
      { value: 'document_support', label: 'Document support' },
      { value: 'both', label: 'Both' },
    ],
  },
  legal_service_model: {
    key: 'legal_service_model',
    prompt: 'What legal service model is involved?',
    options: [
      { value: 'legal_services', label: 'Legal services' },
      { value: 'mediation_specific', label: 'Mediation-specific' },
      { value: 'unknown', label: 'Not sure' },
    ],
  },
};

export function getAdaptiveQuestion(key) {
  return ADAPTIVE_QUESTIONS[key] || null;
}

export function questionsForContextKeys(keys = []) {
  const seen = new Set();
  return keys
    .filter((key) => key && !seen.has(key) && (seen.add(key), true))
    .map((key) => getAdaptiveQuestion(key))
    .filter(Boolean);
}

export function validateAdaptiveQuestionCoverage(mappings = []) {
  const missing = [];
  for (const mapping of mappings) {
    if (mapping.mapping_type !== 'context_dependent') continue;
    for (const key of mapping.required_context || []) {
      if (!ADAPTIVE_QUESTIONS[key]) missing.push({ subindustry_id: mapping.subindustry_id, key });
    }
  }
  return { ok: missing.length === 0, missing };
}
