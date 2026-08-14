# War Dogs Playbook NAICS Mapping Review

## Extraction summary

- Workbook filename: `us_census_2022_naics_complete_reference.xlsx`
- Workbook sheet: `6-Digit Industries`
- Official six-digit NAICS records extracted: 1012
- Total War Dogs sub-industries: 130

## Count by mapping type

- direct: 40
- multi_code: 53
- context_dependent: 33
- needs_review: 4

## Engineering Review Decisions

- Carpentry & Woodworking: `238350 Finish Carpentry Contractors` is primary/canonical; `321911` remains only a non-default manufacturing branch candidate.
- Medical Staffing & Temporary Health Personnel: `561320 Temporary Help Services` is primary/canonical; direct practitioner contracting requires profession-specific classification.
- K9 Units & Security Dogs: `561612 Security Guards and Patrol Services` is canonical; `812910` removed from the default candidate set.
- Water Treatment & Wastewater Management: added `221310 Water Supply and Irrigation Systems`; kept context-dependent water supply / wastewater / construction distinction.
- Solar & Renewable Energy Services: added `221115 Wind Electric Power Generation`; kept context-dependent generation / installation / consulting and solar-vs-wind distinction.
- Air & Maritime Logistics: changed to context-dependent and added `488510 Freight Transportation Arrangement` for broker/arrangement model review.
- Firearms & Ammunition Supply: changed to context-dependent; current four candidates are proposed only, not automatically written together.
- Bulletproof Vests and Riot Gear & Protective Apparel: changed to needs-review; existing candidates preserved only as proposed candidates.
- Mobile Medical Units: changed to needs-review; existing values preserved only as proposed candidates.
- Fire Safety Services: removed `423450`; `541350` is inspection-branch only while equipment supply needs review.
- Dispute Resolution & Mediation: remains needs-review with `541199 All Other Legal Services` as a proposed candidate only.

## Context-dependent mappings

### Product Supply & Procurement / PPE (Personal Protective Equipment)

- Proposed candidate code(s): 423450 Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers, 423850 Service Establishment Equipment and Supplies Merchant Wholesalers, 315990 Apparel Accessories and Other Apparel Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: PPE depends on medical, service-establishment, or apparel category.
- Information needed: medical_vs_general_ppe

### Product Supply & Procurement / Insulation & Drywall

- Proposed candidate code(s): 423330 Roofing, Siding, and Insulation Material Merchant Wholesalers, 238310 Drywall and Insulation Contractors
- Production-safe canonical code(s): None
- Why ambiguous: Could be materials supply or drywall/insulation contracting.
- Information needed: product_vs_installation

### Product Supply & Procurement / Drones & UAVs

- Proposed candidate code(s): 336411 Aircraft Manufacturing, 334511 Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: UAVs may map to aircraft manufacturing or navigation/search equipment depending on product.
- Information needed: aircraft_platform_vs_sensor_payload

### Information Technology & Cybersecurity / Network Infrastructure

- Proposed candidate code(s): 541512 Computer Systems Design Services, 238210 Electrical Contractors and Other Wiring Installation Contractors
- Production-safe canonical code(s): None
- Why ambiguous: Network design versus physical cabling/installation changes the NAICS.
- Information needed: design_vs_installation

### Information Technology & Cybersecurity / AI and Machine Learning Services

- Proposed candidate code(s): 541511 Custom Computer Programming Services, 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)
- Production-safe canonical code(s): None
- Why ambiguous: AI work may be software implementation or R&D.
- Information needed: software_delivery_vs_research

### Construction, Engineering & Specialized Services / Modular & Temporary Construction

- Proposed candidate code(s): 332311 Prefabricated Metal Building and Component Manufacturing, 236220 Commercial and Institutional Building Construction
- Production-safe canonical code(s): None
- Why ambiguous: Could be prefabricated building components or building construction services.
- Information needed: modular_product_vs_site_construction

### Construction, Engineering & Specialized Services / Design-Build Services

- Proposed candidate code(s): 236220 Commercial and Institutional Building Construction, 541330 Engineering Services, 541310 Architectural Services
- Production-safe canonical code(s): None
- Why ambiguous: Design-build mixes construction, engineering, and architectural scope.
- Information needed: prime_construction_vs_design_services

### Healthcare & Medical Services / Telemedicine Services

- Proposed candidate code(s): 621999 All Other Miscellaneous Ambulatory Health Care Services, 621399 Offices of All Other Miscellaneous Health Practitioners
- Production-safe canonical code(s): None
- Why ambiguous: Telemedicine depends on clinical provider type.
- Information needed: clinical_service_type

### Operations & Facilities Support / Facilities Maintenance & Repair

- Proposed candidate code(s): 561210 Facilities Support Services, 811310 Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance
- Production-safe canonical code(s): None
- Why ambiguous: Facilities support versus equipment repair depends on scope.
- Information needed: facility_support_vs_equipment_repair

### Operations & Facilities Support / Snow Removal & Outdoor Maintenance

- Proposed candidate code(s): 561730 Landscaping Services, 488490 Other Support Activities for Road Transportation
- Production-safe canonical code(s): None
- Why ambiguous: Outdoor maintenance may be landscaping or road support depending on setting.
- Information needed: grounds_vs_roadway

### Logistics, Transportation & Supply Chain / Vehicle Fleet Management

- Proposed candidate code(s): 811111 General Automotive Repair, 811198 All Other Automotive Repair and Maintenance, 541614 Process, Physical Distribution, and Logistics Consulting Services
- Production-safe canonical code(s): None
- Why ambiguous: Fleet management may be repair/maintenance or logistics consulting.
- Information needed: maintenance_vs_management_consulting

### Logistics, Transportation & Supply Chain / Air & Maritime Logistics

- Proposed candidate code(s): 481112 Scheduled Freight Air Transportation, 481212 Nonscheduled Chartered Freight Air Transportation, 483111 Deep Sea Freight Transportation, 483113 Coastal and Great Lakes Freight Transportation, 483211 Inland Water Freight Transportation, 488510 Freight Transportation Arrangement
- Production-safe canonical code(s): None
- Why ambiguous: Air and maritime logistics should not automatically select every carrier code; final selection depends on mode and operating model.
- Information needed: air_vs_maritime, scheduled_vs_chartered, carrier_vs_freight_arrangement

### Logistics, Transportation & Supply Chain / Disaster Relief Logistics

- Proposed candidate code(s): 488510 Freight Transportation Arrangement, 541614 Process, Physical Distribution, and Logistics Consulting Services, 624230 Emergency and Other Relief Services
- Production-safe canonical code(s): None
- Why ambiguous: Disaster logistics may be freight arrangement, logistics consulting, or emergency relief services.
- Information needed: freight_vs_consulting_vs_relief_service

### Research & Development / Scientific Research Services

- Proposed candidate code(s): 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology), 541714 Research and Development in Biotechnology (except Nanobiotechnology), 541713 Research and Development in Nanotechnology
- Production-safe canonical code(s): None
- Why ambiguous: Research field determines physical science, biotech, or nanotech code.
- Information needed: research_domain

### Research & Development / Product Development (Tech, Health, Military)

- Proposed candidate code(s): 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology), 541714 Research and Development in Biotechnology (except Nanobiotechnology), 541511 Custom Computer Programming Services
- Production-safe canonical code(s): None
- Why ambiguous: Product development could be R&D or software delivery.
- Information needed: research_vs_software_delivery

### Research & Development / Innovation & AI Development

- Proposed candidate code(s): 541511 Custom Computer Programming Services, 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)
- Production-safe canonical code(s): None
- Why ambiguous: AI development may be software or R&D.
- Information needed: software_delivery_vs_research

### Research & Development / Government-funded R&D Initiatives

- Proposed candidate code(s): 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology), 541714 Research and Development in Biotechnology (except Nanobiotechnology), 541720 Research and Development in the Social Sciences and Humanities
- Production-safe canonical code(s): None
- Why ambiguous: R&D topic determines official industry code.
- Information needed: research_domain

### Research & Development / Feasibility Studies & Pilot Programs

- Proposed candidate code(s): 541611 Administrative Management and General Management Consulting Services, 541690 Other Scientific and Technical Consulting Services, 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)
- Production-safe canonical code(s): None
- Why ambiguous: Feasibility studies may be management, scientific consulting, or R&D.
- Information needed: study_domain

### Security & Protective Services / Surveillance System Installation & Monitoring

- Proposed candidate code(s): 561621 Security Systems Services (except Locksmiths), 238210 Electrical Contractors and Other Wiring Installation Contractors
- Production-safe canonical code(s): None
- Why ambiguous: Security systems service versus electrical installation depends on scope.
- Information needed: monitoring_vs_installation

### Security & Protective Services / Physical Security Systems (Access Control, Alarm Systems)

- Proposed candidate code(s): 561621 Security Systems Services (except Locksmiths), 423610 Electrical Apparatus and Equipment, Wiring Supplies, and Related Equipment Merchant Wholesalers, 334290 Other Communications Equipment Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: Systems service, equipment supply, or manufacturing depends on delivery model.
- Information needed: service_vs_supply_vs_manufacturing

### Security & Protective Services / Tactical Gear & Ballistics Supply

- Proposed candidate code(s): 423990 Other Miscellaneous Durable Goods Merchant Wholesalers, 339920 Sporting and Athletic Goods Manufacturing, 315990 Apparel Accessories and Other Apparel Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: Gear/ballistics supply depends on item class.
- Information needed: apparel_vs_equipment

### Security & Protective Services / Firearms & Ammunition Supply

- Proposed candidate code(s): 332994 Small Arms, Ordnance, and Ordnance Accessories Manufacturing, 332992 Small Arms Ammunition Manufacturing, 332993 Ammunition (except Small Arms) Manufacturing, 423990 Other Miscellaneous Durable Goods Merchant Wholesalers
- Production-safe canonical code(s): None
- Why ambiguous: Firearms and ammunition supply should not automatically select all manufacturing/distributor candidates; final selection depends on item and role.
- Information needed: firearms_or_small_arms, small_arms_ammunition, other_ammunition, dealer_distributor_vs_manufacturer

### Security & Protective Services / Fire Safety Services (Inspection, Safety Equipment)

- Proposed candidate code(s): 541350 Building Inspection Services
- Production-safe canonical code(s): None
- Why ambiguous: Building Inspection Services is retained only for the inspection branch. Fire-safety equipment supply requires additional classification review; medical equipment wholesaling was removed.
- Information needed: inspection_vs_equipment_supply, fire_safety_equipment_classification

### Education, Training & Development / Online Course Development & E-Learning

- Proposed candidate code(s): 611710 Educational Support Services, 541511 Custom Computer Programming Services
- Production-safe canonical code(s): None
- Why ambiguous: Course development service versus software platform build changes code.
- Information needed: content_development_vs_software_platform

### Education, Training & Development / Simulation & Virtual Reality Training Solutions

- Proposed candidate code(s): 541511 Custom Computer Programming Services, 611430 Professional and Management Development Training
- Production-safe canonical code(s): None
- Why ambiguous: VR solution may be software development or training service.
- Information needed: software_vs_training_service

### Environmental, Energy & Sustainability Services / Water Treatment & Wastewater Management

- Proposed candidate code(s): 221310 Water Supply and Irrigation Systems, 221320 Sewage Treatment Facilities, 237110 Water and Sewer Line and Related Structures Construction
- Production-safe canonical code(s): None
- Why ambiguous: War Dogs source includes clean-water systems and wastewater; final code depends on supply/operations, wastewater treatment, or construction.
- Information needed: water_supply_operations, wastewater_treatment, construction

### Environmental, Energy & Sustainability Services / Solar & Renewable Energy Services

- Proposed candidate code(s): 221114 Solar Electric Power Generation, 221115 Wind Electric Power Generation, 238210 Electrical Contractors and Other Wiring Installation Contractors, 541690 Other Scientific and Technical Consulting Services
- Production-safe canonical code(s): None
- Why ambiguous: Renewable services may be generation, installation, or consulting; generation must distinguish solar from wind.
- Information needed: generation_vs_installation_vs_consulting, solar_vs_wind_generation

### Environmental, Energy & Sustainability Services / Stormwater Management Systems

- Proposed candidate code(s): 237110 Water and Sewer Line and Related Structures Construction, 541620 Environmental Consulting Services
- Production-safe canonical code(s): None
- Why ambiguous: Construction/structures versus environmental consulting.
- Information needed: construction_vs_consulting

### Environmental, Energy & Sustainability Services / Energy Efficiency Audits & Solutions

- Proposed candidate code(s): 541690 Other Scientific and Technical Consulting Services, 238210 Electrical Contractors and Other Wiring Installation Contractors
- Production-safe canonical code(s): None
- Why ambiguous: Audit/consulting versus implementation/installation.
- Information needed: audit_vs_installation

### Environmental, Energy & Sustainability Services / Air Quality Control & Monitoring

- Proposed candidate code(s): 541620 Environmental Consulting Services, 334519 Other Measuring and Controlling Device Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: Environmental consulting/monitoring versus instrument manufacturing/supply.
- Information needed: monitoring_service_vs_equipment

### Marketing, Communications & Media / Content Creation (Video, Blog Posts)

- Proposed candidate code(s): 512110 Motion Picture and Video Production, 541430 Graphic Design Services, 541613 Marketing Consulting Services
- Production-safe canonical code(s): None
- Why ambiguous: Video production, design, and marketing content differ by deliverable.
- Information needed: video_vs_written_or_design_content

### Legal & Compliance Services / Audit Services (Financial, IT Security)

- Proposed candidate code(s): 541211 Offices of Certified Public Accountants, 541519 Other Computer Related Services
- Production-safe canonical code(s): None
- Why ambiguous: Financial audit and IT security audit use different industries.
- Information needed: financial_audit_vs_it_security_audit

### Legal & Compliance Services / Legal Research & Documentation

- Proposed candidate code(s): 541110 Offices of Lawyers, 541199 All Other Legal Services, 561410 Document Preparation Services
- Production-safe canonical code(s): None
- Why ambiguous: Legal office/service versus document prep depends on who performs legal work.
- Information needed: legal_service_vs_document_support

## Needs-review mappings

### Product Supply & Procurement / Bulletproof Vests

- Proposed candidate code(s): 315990 Apparel Accessories and Other Apparel Manufacturing, 339920 Sporting and Athletic Goods Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: Existing proposed candidates are not sufficiently supported by title-level evidence for production use; additional classification review required.
- Information needed: protective_apparel_classification

### Product Supply & Procurement / Riot Gear & Protective Apparel

- Proposed candidate code(s): 315990 Apparel Accessories and Other Apparel Manufacturing, 339920 Sporting and Athletic Goods Manufacturing
- Production-safe canonical code(s): None
- Why ambiguous: Existing proposed candidates are not sufficiently supported by title-level evidence for production use; additional classification review required.
- Information needed: protective_apparel_classification

### Healthcare & Medical Services / Mobile Medical Units

- Proposed candidate code(s): 621910 Ambulance Services, 423450 Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers
- Production-safe canonical code(s): None
- Why ambiguous: Portable/mobile clinics may bundle vehicle upfitting, equipment, staffing, and dispatch; do not default to Ambulance Services or equipment supply without additional review.
- Information needed: portable_clinic_service_model

### Legal & Compliance Services / Dispute Resolution & Mediation

- Proposed candidate code(s): 541199 All Other Legal Services
- Production-safe canonical code(s): None
- Why ambiguous: No direct Census six-digit title for mediation/dispute resolution was identified in the workbook. All Other Legal Services is a proposed candidate only and requires human legal-service-model review.
- Information needed: legal_service_model

## Mappings with 4-5 codes

- Security & Protective Services / Firearms & Ammunition Supply: canonical None; candidates 332994 Small Arms, Ordnance, and Ordnance Accessories Manufacturing, 332992 Small Arms Ammunition Manufacturing, 332993 Ammunition (except Small Arms) Manufacturing, 423990 Other Miscellaneous Durable Goods Merchant Wholesalers
- Environmental, Energy & Sustainability Services / Solar & Renewable Energy Services: canonical None; candidates 221114 Solar Electric Power Generation, 221115 Wind Electric Power Generation, 238210 Electrical Contractors and Other Wiring Installation Contractors, 541690 Other Scientific and Technical Consulting Services

## Surprising parent-industry mismatches

- Some product-supply Playbook sub-industries map to manufacturing codes where the source meaning includes the produced item, but broker usage may prefer wholesaler/distributor codes during human review.
- Some healthcare support sub-industries map to staffing, food service, laundry, or janitorial codes because the Playbook description is operational support rather than clinical care.
- Some R&D and AI sub-industries map to software or consulting codes when the deliverable is implementation rather than research.

## Duplicate-like shared NAICS observations

- 236220 Commercial and Institutional Building Construction: Construction, Engineering & Specialized Services / General Construction (Building, Renovation); Construction, Engineering & Specialized Services / Modular & Temporary Construction; Construction, Engineering & Specialized Services / Design-Build Services
- 237110 Water and Sewer Line and Related Structures Construction: Construction, Engineering & Specialized Services / Road & Infrastructure Construction; Environmental, Energy & Sustainability Services / Water Treatment & Wastewater Management; Environmental, Energy & Sustainability Services / Stormwater Management Systems
- 238210 Electrical Contractors and Other Wiring Installation Contractors: Information Technology & Cybersecurity / Network Infrastructure; Construction, Engineering & Specialized Services / Electrical & Wiring; Operations & Facilities Support / HVAC, Electrical, Plumbing, and Specialized Trades; Security & Protective Services / Surveillance System Installation & Monitoring; Environmental, Energy & Sustainability Services / Solar & Renewable Energy Services; Environmental, Energy & Sustainability Services / Energy Efficiency Audits & Solutions
- 238220 Plumbing, Heating, and Air-Conditioning Contractors: Construction, Engineering & Specialized Services / HVAC Installations & Repairs; Construction, Engineering & Specialized Services / Plumbing; Operations & Facilities Support / HVAC, Electrical, Plumbing, and Specialized Trades
- 315990 Apparel Accessories and Other Apparel Manufacturing: Product Supply & Procurement / PPE (Personal Protective Equipment); Product Supply & Procurement / Bulletproof Vests; Product Supply & Procurement / Riot Gear & Protective Apparel; Security & Protective Services / Tactical Gear & Ballistics Supply
- 334290 Other Communications Equipment Manufacturing: Product Supply & Procurement / Telecommunications Equipment; Product Supply & Procurement / Surveillance Cameras & Equipment; Security & Protective Services / Physical Security Systems (Access Control, Alarm Systems)
- 339920 Sporting and Athletic Goods Manufacturing: Product Supply & Procurement / Bulletproof Vests; Product Supply & Procurement / Riot Gear & Protective Apparel; Security & Protective Services / Tactical Gear & Ballistics Supply
- 423450 Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers: Product Supply & Procurement / PPE (Personal Protective Equipment); Product Supply & Procurement / Medical Consumables (Bandages, Syringes, etc.); Product Supply & Procurement / Medical Furniture (Beds, Chairs, etc.); Healthcare & Medical Services / Durable Medical Equipment (DME); Healthcare & Medical Services / Medical Supplies (PPE, Bandages, etc.); Healthcare & Medical Services / Mobile Medical Units
- 488510 Freight Transportation Arrangement: Logistics, Transportation & Supply Chain / Freight & Cargo Shipping; Logistics, Transportation & Supply Chain / Air & Maritime Logistics; Logistics, Transportation & Supply Chain / Disaster Relief Logistics
- 541511 Custom Computer Programming Services: Information Technology & Cybersecurity / Software Development & Integration; Information Technology & Cybersecurity / AI and Machine Learning Services; Healthcare & Medical Services / Health IT & EHR Systems; Research & Development / Product Development (Tech, Health, Military); Research & Development / Innovation & AI Development; Education, Training & Development / Online Course Development & E-Learning; Education, Training & Development / Simulation & Virtual Reality Training Solutions
- 541512 Computer Systems Design Services: Information Technology & Cybersecurity / Network Infrastructure; Information Technology & Cybersecurity / Software Development & Integration; Information Technology & Cybersecurity / Mobile Device Management; Information Technology & Cybersecurity / IT Consulting & Strategy; Healthcare & Medical Services / Health IT & EHR Systems
- 541519 Other Computer Related Services: Professional & Administrative Services / IT Help Desk & Technical Support; Information Technology & Cybersecurity / Cybersecurity Compliance (NIST, CMMC); Information Technology & Cybersecurity / Mobile Device Management; Information Technology & Cybersecurity / Penetration Testing & Security Audits; Information Technology & Cybersecurity / IT Consulting & Strategy; Legal & Compliance Services / Audit Services (Financial, IT Security)
- 541611 Administrative Management and General Management Consulting Services: Professional & Administrative Services / Project Management Support; Research & Development / Feasibility Studies & Pilot Programs; Legal & Compliance Services / Contract & Grant Management
- 541613 Marketing Consulting Services: Marketing, Communications & Media / Advertising & Digital Campaigns; Marketing, Communications & Media / Graphic Design & Branding; Marketing, Communications & Media / Content Creation (Video, Blog Posts); Marketing, Communications & Media / Crisis Communication & Reputation Management
- 541614 Process, Physical Distribution, and Logistics Consulting Services: Logistics, Transportation & Supply Chain / Vehicle Fleet Management; Logistics, Transportation & Supply Chain / Transportation Management Consulting; Logistics, Transportation & Supply Chain / Supply Chain Optimization; Logistics, Transportation & Supply Chain / Disaster Relief Logistics
- 541618 Other Management Consulting Services: Professional & Administrative Services / Project Management Support; Legal & Compliance Services / Regulatory & Compliance Consulting; Legal & Compliance Services / Contract & Grant Management
- 541620 Environmental Consulting Services: Environmental, Energy & Sustainability Services / Stormwater Management Systems; Environmental, Energy & Sustainability Services / Environmental Consulting & Compliance; Environmental, Energy & Sustainability Services / Air Quality Control & Monitoring
- 541690 Other Scientific and Technical Consulting Services: Information Technology & Cybersecurity / Cybersecurity Compliance (NIST, CMMC); Information Technology & Cybersecurity / Penetration Testing & Security Audits; Research & Development / Feasibility Studies & Pilot Programs; Environmental, Energy & Sustainability Services / Solar & Renewable Energy Services; Environmental, Energy & Sustainability Services / Energy Efficiency Audits & Solutions; Legal & Compliance Services / Regulatory & Compliance Consulting
- 541714 Research and Development in Biotechnology (except Nanobiotechnology): Research & Development / Scientific Research Services; Research & Development / Product Development (Tech, Health, Military); Research & Development / Government-funded R&D Initiatives
- 541715 Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology): Information Technology & Cybersecurity / AI and Machine Learning Services; Research & Development / Scientific Research Services; Research & Development / Product Development (Tech, Health, Military); Research & Development / Prototype Testing & Evaluation; Research & Development / Innovation & AI Development; Research & Development / Government-funded R&D Initiatives; Research & Development / Feasibility Studies & Pilot Programs
- 561410 Document Preparation Services: Professional & Administrative Services / FOIA and Records Management; Professional & Administrative Services / Proposal Writing & Documentation Services; Legal & Compliance Services / FOIA & Records Management Services; Legal & Compliance Services / Legal Research & Documentation
- 561612 Security Guards and Patrol Services: Security & Protective Services / Armed & Unarmed Guard Services; Security & Protective Services / K9 Units & Security Dogs; Security & Protective Services / Executive & VIP Protection
- 611430 Professional and Management Development Training: Education, Training & Development / Compliance Training (OSHA, HIPAA, etc.); Education, Training & Development / Military & Tactical Training; Education, Training & Development / Leadership & Management Development; Education, Training & Development / Workforce Development (Job Readiness, Soft Skills); Education, Training & Development / DEI Training (Diversity, Equity, Inclusion); Education, Training & Development / Language & Cultural Training; Education, Training & Development / Simulation & Virtual Reality Training Solutions

## Unresolved questions requiring human judgment

- For context-dependent mappings, the future adaptive questionnaire must select among candidate NAICS codes before recommendations are shown.
- Do not globally prefer wholesaler codes over manufacturing codes merely because fulfillment model is broker/vendor sourcing; use fulfillment for compatibility/risk/explanation and adaptive narrowing.
- For mixed service/product categories, should the selected fulfillment model drive NAICS narrowing?
- Should any machine-proposed mapping be promoted to human-reviewed only after client approval?

## Provenance

- War Dogs industry and sub-industry definitions came from the supplied Playbook/Notion export.
- NAICS codes and titles came from the supplied U.S. Census Bureau 2022 NAICS workbook.
- Sub-industry to NAICS associations are application mappings and remain machine-proposed until reviewed.
