#!/usr/bin/env python3
"""Build machine-proposed War Dogs sub-industry to NAICS mappings.

The mappings in this script are application proposals, not human-reviewed,
client-approved, or expert-verified classifications.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

PLAYBOOK = Path("lib/playbook/war_dogs_playbook_source.json")
REFERENCE = Path("lib/playbook/naics/naics_2022_reference.json")
OUT = Path("lib/playbook/naics/subindustry_naics_map.json")
REPORT = Path("docs/playbook/naics_mapping_review.md")

MAPPING_TYPES = {"direct", "multi_code", "context_dependent", "needs_review"}


def slug(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip().lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def m(codes, mapping_type="direct", notes="", required_context=None, candidate_codes=None):
    return {
        "codes": codes,
        "mapping_type": mapping_type,
        "required_context": required_context or [],
        "mapping_notes": notes,
        "candidate_codes": candidate_codes,
    }


DIRECT = {
    # Professional & administrative
    "IT Help Desk & Technical Support": m(["541519", "541513"], "multi_code", "Help desk and managed support can fall under computer-related services or facilities management."),
    "Interpreter & Translation Services": m(["541930"], "direct", "Direct Census title alignment."),
    "FOIA and Records Management": m(["561410"], "direct", "Document preparation/redaction support is the closest official service code."),
    "Temporary & Contract Staffing": m(["561320"], "direct", "Direct Census title alignment to temporary help services."),
    "Proposal Writing & Documentation Services": m(["561410", "541990"], "multi_code", "Documentation support spans document preparation and other professional services."),
    "Project Management Support": m(["541611", "541618"], "multi_code", "Project management support is consulting-like and context-specific."),
    "Human Resources Services": m(["541612"], "direct", "Direct human resources consulting alignment."),
    "Accounting & Financial Services": m(["541219", "541211"], "multi_code", "Accounting support can be CPA offices or other accounting services."),
    # Product supply
    "Office Supplies & Equipment": m(["424120", "423420"], "multi_code", "Office supplies and office equipment are separate official wholesaler industries."),
    "Computers, Printers, and Peripherals": m(["423430"], "direct", "Direct computer/peripheral wholesaler alignment."),
    "Office Furniture": m(["423210"], "direct", "Direct furniture wholesaler alignment."),
    "Office Consumables (Paper, Ink, etc.)": m(["424120", "424130"], "multi_code", "Stationery/paper supplies and paper wholesalers both apply depending on item."),
    "Telecommunications Equipment": m(["423690", "334220", "334290"], "multi_code", "Telecom supply may be wholesaling or communications equipment manufacturing."),
    "PPE (Personal Protective Equipment)": m(["423450", "423850", "315990"], "context_dependent", "PPE depends on medical, service-establishment, or apparel category.", ["medical_vs_general_ppe"]),
    "Surgical & Diagnostic Instruments": m(["339112", "325413", "334510"], "multi_code", "Surgical instruments, diagnostic substances, and electromedical apparatus are distinct official industries."),
    "Medical Consumables (Bandages, Syringes, etc.)": m(["423450", "339113"], "multi_code", "Medical supplies can be wholesale supply or surgical appliance/supplies manufacturing."),
    "Medical Furniture (Beds, Chairs, etc.)": m(["423450", "337127"], "multi_code", "Hospital equipment wholesaling and institutional furniture both align depending on item."),
    "Concrete, Cement, and Aggregates": m(["327320", "327310", "423320"], "multi_code", "Concrete/cement materials span manufacturing and construction material wholesaling."),
    "Steel & Rebar": m(["423510", "331110"], "multi_code", "Steel/rebar supply can be metal service centers or iron and steel mills."),
    "Lumber & Building Supplies": m(["423310", "423390"], "multi_code", "Lumber and other construction materials are separate wholesaler industries."),
    "Roofing Materials": m(["423330"], "direct", "Direct roofing/siding/insulation material wholesaler alignment."),
    "Electrical & Plumbing Parts": m(["423610", "423720"], "multi_code", "Electrical and plumbing parts are separate official wholesaler industries."),
    "Insulation & Drywall": m(["423330", "238310"], "context_dependent", "Could be materials supply or drywall/insulation contracting.", ["product_vs_installation"]),
    "Trucks, Vans, SUVs": m(["423110", "336110", "336120"], "multi_code", "Vehicle supply can be wholesale or vehicle manufacturing."),
    "Utility Vehicles & Trailers": m(["423860", "336212", "532120"], "multi_code", "Utility vehicles/trailers can be supply, trailer manufacturing, or rental/leasing."),
    "Drones & UAVs": m(["336411", "334511"], "context_dependent", "UAVs may map to aircraft manufacturing or navigation/search equipment depending on product.", ["aircraft_platform_vs_sensor_payload"]),
    "Auto Parts (Tires, Batteries, etc.)": m(["423120", "423130", "335910"], "multi_code", "Auto parts, tires, and batteries are separate official industries."),
    "Military Vehicles & Tactical Transport": m(["336992", "423860"], "multi_code", "Military armored vehicles and transportation equipment supply both align."),
    "Bulletproof Vests": m([], "needs_review", "Existing proposed candidates are not sufficiently supported by title-level evidence for production use; additional classification review required.", ["protective_apparel_classification"], ["315990", "339920"]),
    "Firearms & Ammunition": m(["332994", "332992", "332993"], "multi_code", "Small arms and ammunition have separate official manufacturing codes."),
    "Surveillance Cameras & Equipment": m(["334310", "334290", "423690"], "multi_code", "Surveillance equipment may be AV/electronic equipment manufacturing or wholesaling."),
    "Riot Gear & Protective Apparel": m([], "needs_review", "Existing proposed candidates are not sufficiently supported by title-level evidence for production use; additional classification review required.", ["protective_apparel_classification"], ["315990", "339920"]),
    # IT
    "Cybersecurity Compliance (NIST, CMMC)": m(["541519", "541690"], "multi_code", "Cyber compliance services are not a named six-digit title; computer-related/professional technical consulting are closest."),
    "Network Infrastructure": m(["541512", "238210"], "context_dependent", "Network design versus physical cabling/installation changes the NAICS.", ["design_vs_installation"]),
    "Software Development & Integration": m(["541511", "541512"], "multi_code", "Custom programming and systems design both apply."),
    "Cloud Hosting & Data Management": m(["518210"], "direct", "Direct web hosting/data processing infrastructure alignment."),
    "AI and Machine Learning Services": m(["541511", "541715"], "context_dependent", "AI work may be software implementation or R&D.", ["software_delivery_vs_research"]),
    "Hardware & Equipment Procurement": m(["423430"], "direct", "Computer/peripheral wholesaler alignment."),
    "Mobile Device Management": m(["541519", "541512"], "multi_code", "MDM is computer-related support/systems design."),
    "Penetration Testing & Security Audits": m(["541519", "541690"], "multi_code", "Security testing is computer-related/professional technical consulting."),
    "IT Consulting & Strategy": m(["541512", "541519"], "multi_code", "IT strategy is systems design or other computer-related services."),
    # Construction
    "General Construction (Building, Renovation)": m(["236220"], "direct", "Commercial/institutional building construction is the closest federal facility construction code."),
    "Road & Infrastructure Construction": m(["237310", "237990", "237110"], "multi_code", "Road, heavy civil, and water/sewer infrastructure are separate codes."),
    "Roofing & Waterproofing": m(["238160", "238990"], "multi_code", "Roofing is direct; waterproofing may fall under other specialty trades."),
    "Electrical & Wiring": m(["238210"], "direct", "Direct title alignment."),
    "HVAC Installations & Repairs": m(["238220"], "direct", "Direct plumbing/heating/air-conditioning contractor alignment."),
    "Plumbing": m(["238220"], "direct", "Direct title alignment."),
    "Demolition & Site Prep": m(["238910"], "direct", "Site preparation contractors include demolition/site prep."),
    "Masonry & Concrete Services": m(["238140", "238110"], "multi_code", "Masonry and poured concrete are distinct specialty trades."),
    "Modular & Temporary Construction": m(["332311", "236220"], "context_dependent", "Could be prefabricated building components or building construction services.", ["modular_product_vs_site_construction"]),
    "Design-Build Services": m(["236220", "541330", "541310"], "context_dependent", "Design-build mixes construction, engineering, and architectural scope.", ["prime_construction_vs_design_services"]),
    "Carpentry & Woodworking": m(["238350"], "direct", "War Dogs source describes framing, cabinetry, trim work, and specialized wood installations; Finish Carpentry Contractors is the primary/canonical search code. Wood Window and Door Manufacturing is retained only as a non-default future branch.", ["manufacturing_branch"], ["321911"]),
    "Surveying & Mapping": m(["541370", "541360"], "multi_code", "Surveying/mapping can be geophysical or non-geophysical."),
    # Healthcare
    "Medical Staffing & Temporary Health Personnel": m(["561320"], "direct", "War Dogs source describes temporary/contract healthcare personnel and healthcare staffing firms; Temporary Help Services is the primary mapping. Direct practitioner contracting requires profession-specific classification later.", ["profession_specific_direct_practitioner_contracting"]),
    "Durable Medical Equipment (DME)": m(["423450"], "direct", "Medical/dental/hospital equipment wholesaler alignment."),
    "Medical Supplies (PPE, Bandages, etc.)": m(["423450", "339113"], "multi_code", "Medical supply wholesale and surgical supplies manufacturing both align."),
    "Health IT & EHR Systems": m(["541512", "541511"], "multi_code", "EHR systems are systems design/custom programming."),
    "Telemedicine Services": m(["621999", "621399"], "context_dependent", "Telemedicine depends on clinical provider type.", ["clinical_service_type"]),
    "Mobile Medical Units": m([], "needs_review", "Portable/mobile clinics may bundle vehicle upfitting, equipment, staffing, and dispatch; do not default to Ambulance Services or equipment supply without additional review.", ["portable_clinic_service_model"], ["621910", "423450"]),
    "Behavioral Health Services": m(["621330", "624190"], "multi_code", "Mental health practitioners and individual/family services both align depending on service model."),
    "Veterinary Services (for government-owned animals)": m(["541940"], "direct", "Direct title alignment."),
    "Surgical & Diagnostic Equipment": m(["339112", "334510", "325413"], "multi_code", "Equipment/instruments/diagnostic substances are separate official industries."),
    "Hospital Support Services (food, laundry, cleaning)": m(["722310", "812320", "561720"], "multi_code", "Hospital support combines food, laundry, and janitorial services."),
    # Facilities
    "Janitorial & Cleaning Services": m(["561720"], "direct", "Direct title alignment."),
    "Landscaping & Grounds Maintenance": m(["561730"], "direct", "Direct landscaping services alignment."),
    "Pest Control": m(["561710"], "direct", "Direct exterminating/pest control alignment."),
    "Laundry & Linen Services": m(["812320", "812331"], "multi_code", "Laundry and linen supply are separate official industries."),
    "Facilities Maintenance & Repair": m(["561210", "811310"], "context_dependent", "Facilities support versus equipment repair depends on scope.", ["facility_support_vs_equipment_repair"]),
    "HVAC, Electrical, Plumbing, and Specialized Trades": m(["238220", "238210", "238990"], "multi_code", "Multiple specialty trade contractors are intentionally bundled."),
    "Elevator Maintenance": m(["811310"], "direct", "Industrial/commercial machinery repair is closest for elevator maintenance."),
    "Waste Management & Recycling": m(["562111", "562920", "562998"], "multi_code", "Collection, recovery, and miscellaneous waste services all align."),
    "Snow Removal & Outdoor Maintenance": m(["561730", "488490"], "context_dependent", "Outdoor maintenance may be landscaping or road support depending on setting.", ["grounds_vs_roadway"]),
    # Logistics
    "Freight & Cargo Shipping": m(["484121", "484122", "488510"], "multi_code", "Freight can be trucking or freight arrangement."),
    "Courier & Delivery Services": m(["492110"], "direct", "Direct title alignment."),
    "Warehousing & Inventory Management": m(["493110", "493190"], "multi_code", "General and other warehousing/storage apply depending on inventory."),
    "Vehicle Fleet Management": m(["811111", "811198", "541614"], "context_dependent", "Fleet management may be repair/maintenance or logistics consulting.", ["maintenance_vs_management_consulting"]),
    "Transportation Management Consulting": m(["541614"], "direct", "Direct logistics consulting alignment."),
    "Air & Maritime Logistics": m([], "context_dependent", "Air and maritime logistics should not automatically select every carrier code; final selection depends on mode and operating model.", ["air_vs_maritime", "scheduled_vs_chartered", "carrier_vs_freight_arrangement"], ["481112", "481212", "483111", "483113", "483211", "488510"]),
    "Moving Services (for relocation, military)": m(["484210"], "direct", "Direct used household/office goods moving alignment."),
    "Supply Chain Optimization": m(["541614"], "direct", "Direct logistics consulting alignment."),
    "Disaster Relief Logistics": m(["488510", "541614", "624230"], "context_dependent", "Disaster logistics may be freight arrangement, logistics consulting, or emergency relief services.", ["freight_vs_consulting_vs_relief_service"]),
    # R&D
    "Scientific Research Services": m(["541715", "541714", "541713"], "context_dependent", "Research field determines physical science, biotech, or nanotech code.", ["research_domain"]),
    "Product Development (Tech, Health, Military)": m(["541715", "541714", "541511"], "context_dependent", "Product development could be R&D or software delivery.", ["research_vs_software_delivery"]),
    "Prototype Testing & Evaluation": m(["541380", "541715"], "multi_code", "Testing labs and R&D both align."),
    "Innovation & AI Development": m(["541511", "541715"], "context_dependent", "AI development may be software or R&D.", ["software_delivery_vs_research"]),
    "Government-funded R&D Initiatives": m(["541715", "541714", "541720"], "context_dependent", "R&D topic determines official industry code.", ["research_domain"]),
    "Feasibility Studies & Pilot Programs": m(["541611", "541690", "541715"], "context_dependent", "Feasibility studies may be management, scientific consulting, or R&D.", ["study_domain"]),
    # Security
    "Armed & Unarmed Guard Services": m(["561612"], "direct", "Direct title alignment."),
    "Surveillance System Installation & Monitoring": m(["561621", "238210"], "context_dependent", "Security systems service versus electrical installation depends on scope.", ["monitoring_vs_installation"]),
    "Physical Security Systems (Access Control, Alarm Systems)": m(["561621", "423610", "334290"], "context_dependent", "Systems service, equipment supply, or manufacturing depends on delivery model.", ["service_vs_supply_vs_manufacturing"]),
    "K9 Units & Security Dogs": m(["561612"], "direct", "War Dogs source describes detection/patrol/security K9 work with certified handlers; Security Guards and Patrol Services is the canonical search mapping. Animal-care/training classifications are outside this security-service scope."),
    "Executive & VIP Protection": m(["561612"], "direct", "Security guards/patrol services is closest official security service code."),
    "Background Screening & Vetting Services": m(["561611"], "direct", "Direct investigation/background check alignment."),
    "Tactical Gear & Ballistics Supply": m(["423990", "339920", "315990"], "context_dependent", "Gear/ballistics supply depends on item class.", ["apparel_vs_equipment"]),
    "Firearms & Ammunition Supply": m([], "context_dependent", "Firearms and ammunition supply should not automatically select all manufacturing/distributor candidates; final selection depends on item and role.", ["firearms_or_small_arms", "small_arms_ammunition", "other_ammunition", "dealer_distributor_vs_manufacturer"], ["332994", "332992", "332993", "423990"]),
    "Fire Safety Services (Inspection, Safety Equipment)": m([], "context_dependent", "Building Inspection Services is retained only for the inspection branch. Fire-safety equipment supply requires additional classification review; medical equipment wholesaling was removed.", ["inspection_vs_equipment_supply", "fire_safety_equipment_classification"], ["541350"]),
    # Education
    "Compliance Training (OSHA, HIPAA, etc.)": m(["611430", "611710"], "multi_code", "Professional training and educational support both align."),
    "Cybersecurity Training": m(["611420"], "direct", "Computer training alignment."),
    "Military & Tactical Training": m(["611699", "611430"], "multi_code", "Other schools/instruction and professional training both align."),
    "Leadership & Management Development": m(["611430"], "direct", "Direct professional/management training alignment."),
    "Workforce Development (Job Readiness, Soft Skills)": m(["624310", "611430"], "multi_code", "Vocational rehabilitation and professional development both align depending program."),
    "DEI Training (Diversity, Equity, Inclusion)": m(["611430"], "direct", "Professional/management development training alignment."),
    "Language & Cultural Training": m(["611630", "611430"], "multi_code", "Language schools plus professional training depending scope."),
    "Technical & Vocational Training": m(["611519"], "direct", "Direct technical/trade schools alignment."),
    "Online Course Development & E-Learning": m(["611710", "541511"], "context_dependent", "Course development service versus software platform build changes code.", ["content_development_vs_software_platform"]),
    "Simulation & Virtual Reality Training Solutions": m(["541511", "611430"], "context_dependent", "VR solution may be software development or training service.", ["software_vs_training_service"]),
    # Environmental
    "Hazardous Waste Management": m(["562112", "562211"], "multi_code", "Hazardous waste collection and treatment/disposal both align."),
    "Recycling Programs & Services": m(["562920", "562998"], "multi_code", "Materials recovery and miscellaneous waste services align."),
    "Water Treatment & Wastewater Management": m([], "context_dependent", "War Dogs source includes clean-water systems and wastewater; final code depends on supply/operations, wastewater treatment, or construction.", ["water_supply_operations", "wastewater_treatment", "construction"], ["221310", "221320", "237110"]),
    "Solar & Renewable Energy Services": m([], "context_dependent", "Renewable services may be generation, installation, or consulting; generation must distinguish solar from wind.", ["generation_vs_installation_vs_consulting", "solar_vs_wind_generation"], ["221114", "221115", "238210", "541690"]),
    "Stormwater Management Systems": m(["237110", "541620"], "context_dependent", "Construction/structures versus environmental consulting.", ["construction_vs_consulting"]),
    "Environmental Consulting & Compliance": m(["541620"], "direct", "Direct environmental consulting alignment."),
    "Energy Efficiency Audits & Solutions": m(["541690", "238210"], "context_dependent", "Audit/consulting versus implementation/installation.", ["audit_vs_installation"]),
    "Air Quality Control & Monitoring": m(["541620", "334519"], "context_dependent", "Environmental consulting/monitoring versus instrument manufacturing/supply.", ["monitoring_service_vs_equipment"]),
    "Mold & Asbestos Remediation": m(["562910"], "direct", "Direct remediation services alignment."),
    "Landfill & Waste Disposal": m(["562212", "562219"], "multi_code", "Solid waste landfill and other nonhazardous disposal both align."),
    # Marketing/media
    "Public Relations & Media Outreach": m(["541820"], "direct", "Direct public relations alignment."),
    "Market Research & Surveys": m(["541910"], "direct", "Direct marketing research/public opinion polling alignment."),
    "Advertising & Digital Campaigns": m(["541810", "541613"], "multi_code", "Advertising agencies and marketing consulting both align."),
    "Graphic Design & Branding": m(["541430", "541613"], "multi_code", "Graphic design plus branding/marketing consulting."),
    "Content Creation (Video, Blog Posts)": m(["512110", "541430", "541613"], "context_dependent", "Video production, design, and marketing content differ by deliverable.", ["video_vs_written_or_design_content"]),
    "Event Management & Conference Services": m(["561920", "711310", "711320"], "multi_code", "Convention/trade show organization and event promotion codes may apply."),
    "Crisis Communication & Reputation Management": m(["541820", "541613"], "multi_code", "PR and marketing consulting both align."),
    "Translation & Multilingual Services": m(["541930"], "direct", "Direct title alignment."),
    # Legal/compliance
    "Regulatory & Compliance Consulting": m(["541618", "541690"], "multi_code", "Compliance consulting may be management or technical/scientific consulting."),
    "FOIA & Records Management Services": m(["561410"], "direct", "Document preparation/redaction support alignment."),
    "Audit Services (Financial, IT Security)": m(["541211", "541519"], "context_dependent", "Financial audit and IT security audit use different industries.", ["financial_audit_vs_it_security_audit"]),
    "Legal Research & Documentation": m(["541110", "541199", "561410"], "context_dependent", "Legal office/service versus document prep depends on who performs legal work.", ["legal_service_vs_document_support"]),
    "Contract & Grant Management": m(["541611", "541618"], "multi_code", "Management consulting codes align."),
    "Dispute Resolution & Mediation": m([], "needs_review", "No direct Census six-digit title for mediation/dispute resolution was identified in the workbook. All Other Legal Services is a proposed candidate only and requires human legal-service-model review.", ["legal_service_model"], ["541199"]),
}


def main() -> int:
    playbook = json.loads(PLAYBOOK.read_text(encoding="utf-8"))
    reference = json.loads(REFERENCE.read_text(encoding="utf-8"))
    official = reference["records"]
    records = []
    missing_overrides = []

    for industry in playbook["industries"]:
        for sub in industry["subindustries"]:
            spec = DIRECT.get(sub["name"])
            if not spec:
                missing_overrides.append(f"{industry['name']} > {sub['name']}")
                spec = m([], "needs_review", "No machine-proposed mapping added yet.", ["human_review"])
            canonical_codes = spec["codes"] if spec["mapping_type"] in {"direct", "multi_code"} else []
            candidate_codes = spec["candidate_codes"]
            if candidate_codes is None:
                candidate_codes = spec["codes"] if spec["mapping_type"] in {"context_dependent", "needs_review"} else []
            all_codes = list(dict.fromkeys([*canonical_codes, *candidate_codes]))
            for code in all_codes:
                if code not in official:
                    raise SystemExit(f"Unknown NAICS code {code} for {sub['name']}")
            if len(canonical_codes) > 5 or len(candidate_codes) > 6:
                raise SystemExit(f"Too many codes for {sub['name']}: canonical={canonical_codes} candidates={candidate_codes}")
            if len(set(canonical_codes)) != len(canonical_codes):
                raise SystemExit(f"Duplicate code in mapping for {sub['name']}: {canonical_codes}")
            if len(set(candidate_codes)) != len(candidate_codes):
                raise SystemExit(f"Duplicate candidate code in mapping for {sub['name']}: {candidate_codes}")
            mapping_type = spec["mapping_type"]
            if mapping_type not in MAPPING_TYPES:
                raise SystemExit(f"Invalid mapping type {mapping_type!r} for {sub['name']}")
            if mapping_type == "direct" and not canonical_codes:
                raise SystemExit(f"Direct mapping has no code: {sub['name']}")
            production_safe = mapping_type in {"direct", "multi_code"} and bool(canonical_codes)
            mapping_status = "mapped" if production_safe else ("candidate_only" if candidate_codes else "unresolved")
            records.append({
                "subindustry_id": slug(f"{industry['name']} {sub['name']}"),
                "subindustry_name": sub["name"],
                "industry_name": industry["name"],
                "codes": canonical_codes,
                "official_titles": [official[code]["title"] for code in canonical_codes],
                "candidate_codes": candidate_codes,
                "candidate_titles": [official[code]["title"] for code in candidate_codes],
                "mapping_status": mapping_status,
                "production_safe": production_safe,
                "review_status": "machine_proposed",
                "mapping_type": mapping_type,
                "required_context": spec["required_context"],
                "mapping_notes": spec["mapping_notes"],
            })

    if missing_overrides:
        raise SystemExit("Missing mapping overrides:\n" + "\n".join(missing_overrides))

    payload = {
        "metadata": {
            "playbook_source": "Client-supplied War Dogs Playbook/Notion export",
            "naics_source": reference["metadata"]["source_name"],
            "naics_workbook_filename": reference["metadata"]["workbook_filename"],
            "mapping_provenance": "Application machine-proposed sub-industry to NAICS associations; not human-reviewed or client-approved.",
            "record_count": len(records),
        },
        "mappings": records,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    counts = Counter(r["mapping_type"] for r in records)
    shared = defaultdict(list)
    for r in records:
        for code in [*r["codes"], *r["candidate_codes"]]:
            shared[code].append(r)

    def titles(codes):
        return ", ".join(f"{code} {official[code]['title']}" for code in codes) or "None"

    context = [r for r in records if r["mapping_type"] == "context_dependent"]
    needs = [r for r in records if r["mapping_type"] == "needs_review"]
    four_five = [r for r in records if 4 <= max(len(r["codes"]), len(r["candidate_codes"])) <= 5]
    duplicate_like = [(code, rows) for code, rows in sorted(shared.items()) if len(rows) >= 3]

    lines = [
        "# War Dogs Playbook NAICS Mapping Review",
        "",
        "## Extraction summary",
        "",
        f"- Workbook filename: `{reference['metadata']['workbook_filename']}`",
        f"- Workbook sheet: `{reference['metadata']['sheet']}`",
        f"- Official six-digit NAICS records extracted: {reference['metadata']['record_count']}",
        f"- Total War Dogs sub-industries: {len(records)}",
        "",
        "## Count by mapping type",
        "",
        f"- direct: {counts['direct']}",
        f"- multi_code: {counts['multi_code']}",
        f"- context_dependent: {counts['context_dependent']}",
        f"- needs_review: {counts['needs_review']}",
        "",
        "## Engineering Review Decisions",
        "",
        "- Carpentry & Woodworking: `238350 Finish Carpentry Contractors` is primary/canonical; `321911` remains only a non-default manufacturing branch candidate.",
        "- Medical Staffing & Temporary Health Personnel: `561320 Temporary Help Services` is primary/canonical; direct practitioner contracting requires profession-specific classification.",
        "- K9 Units & Security Dogs: `561612 Security Guards and Patrol Services` is canonical; `812910` removed from the default candidate set.",
        "- Water Treatment & Wastewater Management: added `221310 Water Supply and Irrigation Systems`; kept context-dependent water supply / wastewater / construction distinction.",
        "- Solar & Renewable Energy Services: added `221115 Wind Electric Power Generation`; kept context-dependent generation / installation / consulting and solar-vs-wind distinction.",
        "- Air & Maritime Logistics: changed to context-dependent and added `488510 Freight Transportation Arrangement` for broker/arrangement model review.",
        "- Firearms & Ammunition Supply: changed to context-dependent; current four candidates are proposed only, not automatically written together.",
        "- Bulletproof Vests and Riot Gear & Protective Apparel: changed to needs-review; existing candidates preserved only as proposed candidates.",
        "- Mobile Medical Units: changed to needs-review; existing values preserved only as proposed candidates.",
        "- Fire Safety Services: removed `423450`; `541350` is inspection-branch only while equipment supply needs review.",
        "- Dispute Resolution & Mediation: remains needs-review with `541199 All Other Legal Services` as a proposed candidate only.",
        "",
        "## Context-dependent mappings",
        "",
    ]
    for r in context:
        lines += [
            f"### {r['industry_name']} / {r['subindustry_name']}",
            "",
            f"- Proposed candidate code(s): {titles(r['candidate_codes'])}",
            f"- Production-safe canonical code(s): {titles(r['codes'])}",
            f"- Why ambiguous: {r['mapping_notes']}",
            f"- Information needed: {', '.join(r['required_context']) or 'human judgment'}",
            "",
        ]
    lines += ["## Needs-review mappings", ""]
    for r in needs:
        lines += [
            f"### {r['industry_name']} / {r['subindustry_name']}",
            "",
            f"- Proposed candidate code(s): {titles(r['candidate_codes'])}",
            f"- Production-safe canonical code(s): {titles(r['codes'])}",
            f"- Why ambiguous: {r['mapping_notes']}",
            f"- Information needed: {', '.join(r['required_context']) or 'human judgment'}",
            "",
        ]
    lines += ["## Mappings with 4-5 codes", ""]
    for r in four_five:
        lines += [
            f"- {r['industry_name']} / {r['subindustry_name']}: canonical {titles(r['codes'])}; candidates {titles(r['candidate_codes'])}",
        ]
    lines += ["", "## Surprising parent-industry mismatches", ""]
    lines += [
        "- Some product-supply Playbook sub-industries map to manufacturing codes where the source meaning includes the produced item, but broker usage may prefer wholesaler/distributor codes during human review.",
        "- Some healthcare support sub-industries map to staffing, food service, laundry, or janitorial codes because the Playbook description is operational support rather than clinical care.",
        "- Some R&D and AI sub-industries map to software or consulting codes when the deliverable is implementation rather than research.",
        "",
        "## Duplicate-like shared NAICS observations",
        "",
    ]
    for code, rows in duplicate_like[:30]:
        names = "; ".join(f"{r['industry_name']} / {r['subindustry_name']}" for r in rows)
        lines.append(f"- {code} {official[code]['title']}: {names}")
    lines += [
        "",
        "## Unresolved questions requiring human judgment",
        "",
        "- For context-dependent mappings, the future adaptive questionnaire must select among candidate NAICS codes before recommendations are shown.",
        "- Do not globally prefer wholesaler codes over manufacturing codes merely because fulfillment model is broker/vendor sourcing; use fulfillment for compatibility/risk/explanation and adaptive narrowing.",
        "- For mixed service/product categories, should the selected fulfillment model drive NAICS narrowing?",
        "- Should any machine-proposed mapping be promoted to human-reviewed only after client approval?",
        "",
        "## Provenance",
        "",
        "- War Dogs industry and sub-industry definitions came from the supplied Playbook/Notion export.",
        "- NAICS codes and titles came from the supplied U.S. Census Bureau 2022 NAICS workbook.",
        "- Sub-industry to NAICS associations are application mappings and remain machine-proposed until reviewed.",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(records)} mappings to {OUT}")
    print(f"Mapping type counts: {dict(counts)}")
    print(f"Wrote review report to {REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
