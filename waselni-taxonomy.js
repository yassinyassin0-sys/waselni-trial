/* =====================================================================
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

  const CAREER_FAMILIES = {
    "Real Estate & Property": ["Real Estate Broker", "Property Consultant", "Leasing Manager", "Off-Plan Sales Specialist", "Property Manager", "Mortgage Advisor", "Real Estate Valuer", "Real Estate Investment Advisor"],
    "Banking, Finance & Wealth": ["Relationship Manager", "Wealth Manager", "Private Banker", "Investment Advisor", "Portfolio Manager", "Credit Analyst", "Financial Analyst", "Fund Manager", "Accountant", "Compliance Officer"],
    "Construction & Engineering": ["Civil Engineer", "Quantity Surveyor", "MEP Engineer", "Structural Engineer", "Site Engineer", "Project Manager", "Planning Engineer", "Architect", "Cost Estimator"],
    "Trade, Logistics & Supply Chain": ["Freight Forwarder", "Supply Chain Manager", "Logistics Coordinator", "Procurement Officer", "Import/Export Officer", "Warehouse Manager", "Commodities Trader", "Customs Broker"],
    "Aviation & Airlines": ["Cabin Crew", "Purser", "First Officer", "Captain", "Aircraft Maintenance Engineer", "Flight Dispatcher", "Airport Services Agent", "Air Traffic Controller"],
    "Hospitality & Tourism": ["Guest Relations Manager", "Front Office Manager", "Hotel Manager", "F&B Manager", "Executive Chef", "Restaurant Manager", "Events Manager", "Concierge", "Sommelier"],
    "Oil, Gas & Energy": ["Petroleum Engineer", "Reservoir Engineer", "Drilling Engineer", "Process Engineer", "HSE Officer", "Geologist", "Production Engineer", "Renewable Energy Engineer"],
    "Government & Public Sector": ["Public Relations Officer (PRO)", "Government Relations Officer", "Emiratisation Officer", "Policy Advisor", "Regulatory Affairs Officer", "Protocol Officer", "Immigration Officer"],
    "Healthcare & Medicine": ["General Practitioner", "Specialist Consultant", "Registered Nurse", "Surgeon", "Dentist", "Pharmacist", "Physiotherapist", "Radiologist", "Healthcare Administrator"],
    "Consulting, Legal & Professional Services": ["Management Consultant", "Strategy Consultant", "Auditor", "Tax Advisor", "Corporate Lawyer", "Legal Counsel", "Risk Advisor", "M&A Analyst", "Actuary"],
    "Technology, Fintech & Web3": ["Software Engineer", "Data Scientist", "AI/ML Engineer", "Cybersecurity Analyst", "Product Manager", "DevOps Engineer", "Blockchain Developer", "UX/UI Designer", "VARA Compliance Officer"],
    "Media, Marketing & Creative": ["Marketing Manager", "Social Media Manager", "Content Creator", "PR Manager", "Brand Manager", "Graphic Designer", "Photographer", "Videographer", "Creative Director"],
    "Luxury Retail & Fashion": ["Luxury Sales Associate", "Boutique Manager", "Brand Ambassador", "Visual Merchandiser", "Client Advisor", "Personal Shopper", "Watch & Jewellery Specialist", "Stylist"],
  };

  const INTEREST_CATEGORIES = {
    "Racket sports": ["Padel", "Tennis", "Squash"],
    "Team & spectator sports": ["Cricket", "Football", "Rugby"],
    "Fitness & wellness": ["Running / run clubs", "Cycling", "Gym & fitness", "CrossFit", "Yoga", "Pilates"],
    "Desert & adventure": ["Desert & dune-bashing", "Camping & glamping", "Hiking", "Skydiving"],
    "Water & marine": ["Yachting & sailing", "Kitesurfing", "Wakeboarding", "Paddleboarding", "Scuba diving"],
    "Premium & spectator sport": ["Golf", "Formula 1 / Motorsport", "Supercars & car culture", "Horse racing & polo"],
    "Food, coffee & nightlife": ["Brunch", "Fine dining", "Specialty coffee", "Beach clubs"],
    "Arts & culture": ["Art & galleries", "Museums", "Live music & concerts", "Photography"],
    "Digital & lifestyle": ["Gaming & e-sports", "Travel", "Reading & book clubs"],
  };

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
