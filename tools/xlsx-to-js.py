#!/usr/bin/env python3
"""Regenerate LiveTrial/waselni-taxonomy.js FROM the Excel workbook.
The workbook (Backend/Matchmaking Algorithm/waselni-taxonomy.xlsx) is the
source of truth; run this whenever Yassin edits it.

Run:  python3 xlsx-to-js.py
"""
import json, openpyxl

XLSX = "/Users/yassinyassin/Documents/Business/Businesses/Carpool-ParkingShare/App /Prototype/Backend/Matchmaking Algorithm/waselni-taxonomy.xlsx"
JS   = "/Users/yassinyassin/Documents/Business/Businesses/Carpool-ParkingShare/App /Prototype/LiveTrial/waselni-taxonomy.js"

wb = openpyxl.load_workbook(XLSX)

def read_wide(ws):
    groups = {}
    for col in range(1, ws.max_column + 1):
        name = ws.cell(1, col).value
        if not name: continue
        items = [ws.cell(r, col).value for r in range(2, ws.max_row + 1) if ws.cell(r, col).value]
        groups[str(name).strip()] = [str(i).strip() for i in items]
    return groups

families   = read_wide(wb["Career families"])
categories = read_wide(wb["Interest groups"])

def js_obj(d):
    return "{\n" + "\n".join(
        "    " + json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) + ","
        for k, v in d.items()) + "\n  }"

HELPERS = r"""
  /* ---- reverse indexes (normalised: lowercased + trimmed) ------------- */
  const norm = s => (s || '').toString().trim().toLowerCase();
  const PROF_TO_FAMILY = {}, INT_TO_CATEGORY = {}, FAMILY_BY_NORM = {};
  for (const fam in CAREER_FAMILIES) { FAMILY_BY_NORM[norm(fam)] = fam; CAREER_FAMILIES[fam].forEach(p => PROF_TO_FAMILY[norm(p)] = fam); }
  for (const cat in INTEREST_CATEGORIES) INTEREST_CATEGORIES[cat].forEach(i => INT_TO_CATEGORY[norm(i)] = cat);
  const singularise = s => norm(s).replace(/ies$/, 'y').replace(/s$/, '');

  const WaselniTaxonomy = {
    CAREER_FAMILIES, INTEREST_CATEGORIES,

    /* the family (sector) a profession belongs to, or null if free-typed */
    familyOf(profession) { return PROF_TO_FAMILY[norm(profession)] || null; },

    /* the group an interest belongs to, or null */
    categoryOf(interest) { return INT_TO_CATEGORY[norm(interest)] || null; },

    /* "who I want to meet" is a career/sector the USER picked from the same
       Career families list — resolve it to a family. A sector name maps to
       itself; a job title maps to its sector. The app never presets this. */
    audienceFamily(pick) {
      const n = norm(pick);
      if (FAMILY_BY_NORM[n]) return FAMILY_BY_NORM[n];
      return PROF_TO_FAMILY[n] || PROF_TO_FAMILY[singularise(pick)] || null;
    },

    /* the set of families covered by a user's "want to meet" picks */
    seekingFamilies(wantToMeet) {
      const out = new Set();
      (wantToMeet || []).forEach(c => { const f = this.audienceFamily(c); if (f) out.add(f); });
      return out;
    },
  };

  window.WaselniTaxonomy = WaselniTaxonomy;
})();
"""

out = ("""/* =====================================================================
   Waselni · Career + Interest compatibility taxonomy  (UAE edition)
   ---------------------------------------------------------------------
   GENERATED FROM  Backend/Matchmaking Algorithm/waselni-taxonomy.xlsx
   by  LiveTrial/tools/xlsx-to-js.py  —  DO NOT EDIT BY HAND.
   To change a grouping: edit the Excel, then re-run the generator.

   Model: each user sets who THEY are (career + interests) and who they
   want to MEET (careers/sectors, picked from CAREER_FAMILIES). There is
   no app-imposed audience list — "want to meet" resolves to a family via
   audienceFamily(). Same data as the Excel, in the form the browser reads.

   Load order in a screen (before waselni-data.js):
     <script src="waselni-taxonomy.js"></script>
     <script src="waselni-data.js"></script>
   ===================================================================== */
(function () {

  const CAREER_FAMILIES = """ + js_obj(families) + """;

  const INTEREST_CATEGORIES = """ + js_obj(categories) + """;
""" + HELPERS)

open(JS, "w", encoding="utf-8").write(out)

roles = sum(len(v) for v in families.values())
ints  = sum(len(v) for v in categories.values())
print("regenerated:", JS.split("/")[-1])
print("  families:", len(families), "| roles:", roles)
print("  interest groups:", len(categories), "| interests:", ints)
