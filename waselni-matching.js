/* =====================================================================
   Waselni · Matching engine — pure scoring + route gate.
   ---------------------------------------------------------------------
   Two layers, from the matchmaking doc:
     1. routeGate()  — hard pass/fail feasibility (seats, gender, area/time)
     2. networkScore() — the networking value, 65/35 career/interest blend
                         (shifts with the driver's trip intent)
   Uses WaselniTaxonomy (career families + interest groups). No backend
   calls — waselni-data.js feeds it people/journeys from Supabase. Scores
   are internal only; users see plain reasons ("same field", "2 shared
   interests"), never numbers.

   Load after waselni-taxonomy.js:
     <script src="waselni-taxonomy.js"></script>
     <script src="waselni-matching.js"></script>
   ===================================================================== */
(function () {
  var T = window.WaselniTaxonomy || {};
  var norm = function (s) { return (s || '').toString().trim().toLowerCase(); };
  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };

  // weights — mirror the "Scoring weights" tab in waselni-taxonomy.xlsx
  var W = {
    blend: { balanced: 0.65, network: 0.80, company: 0.20 },   // professional weight
    prof:  { exactSeek: 1.0, sameFamily: 0.5, sameCompany: 0.3, perConnection: 0.1, connCap: 0.3 },
    intr:  { exactShared: 0.5, exactCap: 1.0, sameGroup: 0.2, groupCap: 0.6 },
  };

  function familiesOf(person) {
    var out = new Set();
    (person.jobTitles || person.tags || []).forEach(function (t) {
      var f = T.familyOf && T.familyOf(t); if (f) out.add(f);
    });
    return out;
  }

  // professional compatibility: how well `them` matches what `me` is looking for
  function professionalScore(me, them) {
    var theirFamilies = familiesOf(them);
    var mySeek = (T.seekingFamilies && T.seekingFamilies(me.preferences || me.audience || [])) || new Set();
    var myFamilies = familiesOf(me);
    var s = 0, hitSeek = false, sameField = false;
    theirFamilies.forEach(function (f) {
      if (mySeek.has(f)) hitSeek = true;      // I explicitly want to meet their field
      if (myFamilies.has(f)) sameField = true; // we're in the same field
    });
    if (hitSeek)   s = Math.max(s, W.prof.exactSeek);
    if (sameField) s = Math.max(s, W.prof.sameFamily);
    if (me.company && them.company && norm(me.company) === norm(them.company)) s += W.prof.sameCompany;
    s += Math.min((them.mutualConnections || 0) * W.prof.perConnection, W.prof.connCap);
    return clamp01(s);
  }

  // interest compatibility: shared exact + related (same group)
  function interestScore(me, them) {
    var mine = (me.interests || []).map(norm);
    var theirSet = {}; (them.interests || []).forEach(function (i) { theirSet[norm(i)] = true; });
    var exact = 0, related = 0;
    var myCats = {}; mine.forEach(function (i) { var c = T.categoryOf && T.categoryOf(i); if (c) myCats[c] = true; });
    mine.forEach(function (i) {
      if (theirSet[i]) { exact++; return; }
    });
    (them.interests || []).forEach(function (i) {
      var n = norm(i);
      if (mine.indexOf(n) > -1) return;                          // exact already counted
      var c = T.categoryOf && T.categoryOf(i);
      if (c && myCats[c]) related++;                             // related, not exact
    });
    var s = Math.min(exact * W.intr.exactShared, W.intr.exactCap)
          + Math.min(related * W.intr.sameGroup, W.intr.groupCap);
    return clamp01(s);
  }

  // 65/35 blend (or intent mode). Directional: score(me→them).
  function networkScore(me, them, intent) {
    var w = W.blend[intent] != null ? W.blend[intent] : W.blend.balanced;
    return clamp01(w * professionalScore(me, them) + (1 - w) * interestScore(me, them));
  }

  // plain-language reasons — what a user actually sees
  function reasons(me, them) {
    var out = [];
    var myFam = familiesOf(me), theirFam = familiesOf(them);
    var same = false; theirFam.forEach(function (f) { if (myFam.has(f)) same = true; });
    if (same) out.push('same field');
    var mySeek = (T.seekingFamilies && T.seekingFamilies(me.preferences || me.audience || [])) || new Set();
    var wants = false; theirFam.forEach(function (f) { if (mySeek.has(f)) wants = true; });
    if (wants && !same) out.push('someone you want to meet');
    var mine = {}; (me.interests || []).forEach(function (i) { mine[norm(i)] = true; });
    var shared = (them.interests || []).filter(function (i) { return mine[norm(i)]; });
    if (shared.length) out.push(shared.length + ' shared interest' + (shared.length > 1 ? 's' : ''));
    if (them.mutualConnections) out.push(them.mutualConnections + ' mutual connection' + (them.mutualConnections > 1 ? 's' : ''));
    return out;
  }

  // hard gate — lenient for a small trial: seats + gender + loose destination overlap
  function routeGate(req, journey) {
    var seats = journey.seatsLeft != null ? journey.seatsLeft : journey.seats;
    if (seats != null && seats <= 0) return false;
    var gp = journey.genderPref;
    if (gp && gp !== 'none' && req.gender) {
      if (gp === 'men_only'   && req.gender !== 'male')   return false;
      if (gp === 'women_only' && req.gender !== 'female') return false;
    }
    var a = norm(req.destination || req.to), b = norm(journey.to_area || journey.to);
    if (a && b) {
      var at = a.split(/[^a-z0-9]+/).filter(function (t) { return t.length > 2; });
      var bt = b.split(/[^a-z0-9]+/).filter(function (t) { return t.length > 2; });
      var overlap = at.some(function (t) { return bt.indexOf(t) > -1; });
      if (!overlap && a.indexOf(b) === -1 && b.indexOf(a) === -1) return false;
    }
    return true;
  }

  window.WaselniMatching = {
    professionalScore: professionalScore,
    interestScore: interestScore,
    networkScore: networkScore,
    reasons: reasons,
    routeGate: routeGate,
    // driver's candidate passengers ranked by the DRIVER's score (driver decides)
    rankCandidates: function (driver, candidates, intent) {
      return (candidates || []).map(function (p) {
        return { person: p, score: networkScore(driver, p, intent), reasons: reasons(driver, p) };
      }).sort(function (x, y) { return y.score - x.score; });
    },
    // open journeys ranked for a passenger, gated then scored
    rankJourneysFor: function (passenger, journeys, intent) {
      return (journeys || []).filter(function (j) { return routeGate(passenger, j); })
        .map(function (j) {
          var driver = j.driver || j;
          return { journey: j, score: networkScore(passenger, driver, intent), reasons: reasons(passenger, driver) };
        }).sort(function (x, y) { return y.score - x.score; });
    },
  };
})();
