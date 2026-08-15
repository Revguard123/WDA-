#!/usr/bin/env python3
"""Build the runtime NAICS 2022 six-digit reference from the local Census workbook.

Uses only Python's standard library. The app consumes the generated JSON and does
not parse the workbook at runtime.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

WORKBOOK = Path("docs/playbook/us_census_2022_naics_complete_reference.xlsx")
OUT = Path("lib/playbook/naics/naics_2022_reference.json")
AUTHORITATIVE_SHEET = "6-Digit Industries"

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values = []
    for item in root.findall("a:si", NS):
        values.append("".join(node.text or "" for node in item.findall(".//a:t", NS)))
    return values


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    value = cell.find("a:v", NS)
    if value is None:
        return ""
    raw = value.text or ""
    if cell.attrib.get("t") == "s":
        return strings[int(raw)]
    return raw


def sheet_paths(zf: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    paths = {}
    for sheet in workbook.find("a:sheets", NS):
        rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = relmap[rid]
        paths[sheet.attrib["name"]] = target[1:] if target.startswith("/") else f"xl/{target}"
    return paths


def read_rows(zf: zipfile.ZipFile, sheet_path: str, strings: list[str]) -> list[list[str]]:
    root = ET.fromstring(zf.read(sheet_path))
    rows = []
    for row in root.findall(".//a:sheetData/a:row", NS):
        values = [cell_value(cell, strings).strip() for cell in row.findall("a:c", NS)]
        rows.append(values)
    return rows


def main() -> int:
    if not WORKBOOK.exists():
        print(f"Workbook not found: {WORKBOOK}", file=sys.stderr)
        return 1

    with zipfile.ZipFile(WORKBOOK) as zf:
        paths = sheet_paths(zf)
        if AUTHORITATIVE_SHEET not in paths:
            print(f"Missing authoritative sheet {AUTHORITATIVE_SHEET!r}; found {sorted(paths)}", file=sys.stderr)
            return 1
        rows = read_rows(zf, paths[AUTHORITATIVE_SHEET], shared_strings(zf))

    header = rows[0]
    required = [
        "6-Digit NAICS Code",
        "National Industry Title",
        "Sector Code",
        "Sector Title",
        "Subsector Code",
        "Subsector Title",
        "Industry Group Code",
        "Industry Group Title",
        "NAICS Industry Code",
        "NAICS Industry Title",
    ]
    positions = {name: header.index(name) for name in required}

    records = {}
    for row in rows[1:]:
        if len(row) < len(header):
            row = row + [""] * (len(header) - len(row))
        code = row[positions["6-Digit NAICS Code"]]
        if not code:
            continue
        if not re.fullmatch(r"\d{6}", code):
            raise SystemExit(f"Invalid six-digit NAICS code: {code!r}")
        if code in records:
            raise SystemExit(f"Duplicate NAICS code: {code}")
        records[code] = {
            "code": code,
            "title": row[positions["National Industry Title"]],
            "source": "U.S. Census Bureau 2022 NAICS",
            "sector_code": row[positions["Sector Code"]],
            "sector_title": row[positions["Sector Title"]],
            "subsector_code": row[positions["Subsector Code"]],
            "subsector_title": row[positions["Subsector Title"]],
            "industry_group_code": row[positions["Industry Group Code"]],
            "industry_group_title": row[positions["Industry Group Title"]],
            "naics_industry_code": row[positions["NAICS Industry Code"]],
            "naics_industry_title": row[positions["NAICS Industry Title"]],
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "metadata": {
            "classification_year": 2022,
            "source": "U.S. Census Bureau",
            "source_name": "U.S. Census Bureau 2022 NAICS",
            "workbook_filename": WORKBOOK.name,
            "sheet": AUTHORITATIVE_SHEET,
            "record_count": len(records),
        },
        "records": dict(sorted(records.items())),
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} six-digit NAICS records to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
