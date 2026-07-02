/* =====================================================================
   Waselni · Trial wiring — ONE script, injected on every trial screen.
   ---------------------------------------------------------------------
   Detects the screen and applies the trial-only behaviour (login front
   door, remember-me, profile refresh, log-out / switch user). Every
   screen is otherwise identical to the prototype, so a designer update
   = re-copy the screen + re-inject this single tag (see tools/sync).

   Load order (after the data layer):
     <script src="config.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="waselni-data.js"></script>
     <script src="waselni-trial.js"></script>
   ===================================================================== */
(function () {
  var LS = localStorage;
  var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var recognised = function () { return !!LS.getItem('waselni_onboarding_complete'); };

  // clear the signed-in user from this device (log out / switch)
  function clearUser() {
    try { if (window.WaselniData) WaselniData.signOut(); } catch (e) {}
    ['waselni_onboarding_complete','waselni_profile','waselni_role','waselni_mode',
     'waselni_journey_request','waselni_driver_match','waselni_driver_status',
     'waselni_vehicle','waselni_license','waselni_pending_role',
     'waselni_uaepass_profile','waselni_preferences'
    ].forEach(function (k) { try { LS.removeItem(k); } catch (e) {} });
  }
  window.waselniLogout = function () { clearUser(); location.replace('waselni-login.html'); };

  // ---------- shared: post-ride connect (Stars Aligned) ----------
  // map a backend person → the swipe-deck rider shape stars-aligned renders
  function personToRider(p) {
    p = p || {};
    var tags = [];
    (p.tags || []).slice(0, 2).forEach(function (t) { tags.push({ text: t, type: 'career' }); });
    (p.interests || []).slice(0, 2).forEach(function (t) { tags.push({ text: t, type: 'interest' }); });
    return { id: p.id, initial: p.initial, name: p.knownAs || p.name || 'Someone', role: p.title || '', tags: tags };
  }
  // a single, fully-owned floating button → writes the ride party + opens Stars Aligned.
  // (trial-only shortcut to the post-ride connect screen; in production drop-off triggers it.)
  function connectButton(show, buildParty) {
    var id = 'waselniConnectBtn';
    var btn = document.getElementById(id);
    if (!show) { if (btn) btn.style.display = 'none'; return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.textContent = '✨ Connect with your crew';
      btn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:9999;' +
        'padding:13px 22px;border:none;border-radius:999px;background:#3D1E5E;color:#F0E8D5;' +
        "font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.01em;" +
        'box-shadow:0 6px 20px rgba(61,30,94,0.35);cursor:pointer;';
      (document.body || document.documentElement).appendChild(btn);
    }
    btn.style.display = 'block';
    btn.onclick = function () {
      var go = function () { location.href = 'waselni-stars-aligned.html'; };
      Promise.resolve(buildParty()).then(function (party) {
        if (party && party.length) { try { LS.setItem('waselni_stars_party', JSON.stringify(party)); } catch (e) {} }
        go();
      }, go);
    };
  }

  // ---------- index.html : entry gate / login front door ----------
  if (path === 'index.html' || path === '') {
    try {
      var q = location.search;
      if (q.indexOf('fresh') > -1) { LS.clear(); }             // ?fresh = reset (testing)
      else if (recognised()) { location.replace('waselni-home.html'); return; }
      else if (q.indexOf('signup') === -1) { location.replace('waselni-login.html'); return; }
      // ?signup → fall through, show the role selector (onboarding)
    } catch (e) {}
  }

  // ---------- waselni-home.html : remember + refresh + log-out row ----------
  if (path === 'waselni-home.html') {
    try { LS.setItem('waselni_onboarding_complete', '1'); } catch (e) {}   // reaching home = onboarded
    try {
      if (window.WaselniData && WaselniData.ready) {
        if (WaselniData.currentUserId()) { WaselniData.init(); }            // returning → restore from DB
        else {                                                              // just onboarded → create in DB
          var p = JSON.parse(LS.getItem('waselni_profile') || '{}');
          if (p.legalName || p.fullName) WaselniData.saveProfile();
        }
      }
    } catch (e) {}

    document.addEventListener('DOMContentLoaded', function () {
      try {
        var sheet = document.getElementById('avatarSheet');
        if (!sheet || document.getElementById('waselniLogoutRow')) return;
        var closeBtn = sheet.querySelector('.sheet-close-btn');
        var row = document.createElement('div');
        row.className = 'sheet-row sheet-row-last';
        row.id = 'waselniLogoutRow';
        row.style.cursor = 'pointer';
        row.onclick = window.waselniLogout;
        row.innerHTML =
          '<div class="sheet-row-left">' +
            '<div class="sheet-row-icon">' +
              '<svg viewBox="0 0 16 16" width="16" height="16" fill="none">' +
                '<path d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h2" stroke="#B4322A" stroke-width="1.4" stroke-linecap="round"/>' +
                '<path d="M10 11l3-3-3-3" stroke="#B4322A" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path d="M13 8H6" stroke="#B4322A" stroke-width="1.4" stroke-linecap="round"/>' +
              '</svg>' +
            '</div>' +
            '<div>' +
              '<div class="sheet-row-title" style="color:#B4322A;">Log out</div>' +
              '<div class="sheet-row-sub">Switch to another account on this device</div>' +
            '</div>' +
          '</div>';
        if (closeBtn && closeBtn.parentNode) closeBtn.parentNode.insertBefore(row, closeBtn);
        else sheet.appendChild(row);
      } catch (e) {}

      // --- wire the "Find journey" / "Post a journey" button to the live backend ---
      try {
        if (typeof window.searchRides === 'function' && !window.searchRides.__wln) {
          var _origSearch = window.searchRides;
          window.searchRides = function () {
            try {
              var pickup = (document.getElementById('pickupInput') || {}).value || '';
              var destination = (document.getElementById('destinationInput') || {}).value || '';
              if (!pickup || !destination) return _origSearch();            // let the screen show its validation
              var mode = LS.getItem('waselni_mode') || 'passenger';
              var te = document.getElementById('timeDisplay');
              var time = te ? te.textContent.trim() : '';
              // driver → offer the ride; passenger → post a match request. Then navigate.
              var go = function () { if (mode === 'driver') location.href = 'waselni-journeys.html'; else _origSearch(); };
              if (window.WaselniData && WaselniData.ready) {
                var op;
                if (mode === 'driver') {
                  var veh = {}; try { veh = JSON.parse(LS.getItem('waselni_vehicle') || '{}'); } catch (e) {}
                  op = WaselniData.postJourney({ from: pickup, to: destination, time: time, seats: veh.seats || 3 });
                } else {
                  op = WaselniData.requestRide({ destination: destination, from: pickup, time: time });
                }
                Promise.resolve(op).then(go, go);                           // navigate whether or not it succeeds
              } else { go(); }
            } catch (e) { _origSearch(); }                                  // any failure → original behaviour
          };
          window.searchRides.__wln = true;
        }
      } catch (e) {}
    });
  }

  // ---------- waselni-journeys.html (passenger) : real match, not the demo ----------
  if (path === 'waselni-journeys.html' && (LS.getItem('waselni_mode') || 'passenger') !== 'driver') {
    // map the backend match onto the shape the journeys card renders
    var toMatch = function (m) {
      if (!m || !m.journey) return null;
      var j = m.journey;
      var base = { from: j.from_area, to: j.to_area, date: 'Today', timeBadge: 'Pickup ' + (j.depart_label || '') };
      if (m.status !== 'accepted') { base.status = 'looking'; return base; }   // pending = still being chosen
      var d = m.driver || {};
      base.status = 'driver_found';
      base.initial = d.initial; base.name = d.name; base.knownAs = d.knownAs; base.title = d.title;
      base.car = ''; base.price = ''; base.mutualConnections = 0;
      base.tags = d.tags || []; base.interests = d.interests || [];
      base.coPassengers = (m.coPassengers || []).map(function (c) {
        return { initial: c.initial, name: c.name, knownAs: c.knownAs, title: c.title, tags: c.tags || [], interests: c.interests || [] };
      });
      return base;
    };
    // the ride party for Stars Aligned = the driver + any co-passengers, once accepted
    var buildPassengerParty = function () {
      if (!(window.WaselniData && WaselniData.ready)) return Promise.resolve([]);
      return WaselniData.getMyMatch().then(function (m) {
        if (!m || m.status !== 'accepted') return [];
        var party = [];
        if (m.driver) party.push(personToRider(m.driver));
        (m.coPassengers || []).forEach(function (c) { party.push(personToRider(c)); });
        return party;
      }, function () { return []; });
    };
    var applyReal = function () {
      if (!(window.WaselniData && WaselniData.ready)) return;
      WaselniData.getMyMatch().then(function (m) {
        var match = toMatch(m);
        if (match) LS.setItem('waselni_driver_match', JSON.stringify(match));
        else LS.removeItem('waselni_driver_match');
        if (typeof window.renderJourneys === 'function') window.renderJourneys();
        connectButton(!!(m && m.status === 'accepted'), buildPassengerParty);  // offer connect once the driver picked them
      }, function () {});
    };
    var startJ = function () {
      setTimeout(function () {
        // placeholder AFTER the screen's init cleared it → trips the 1500ms fake-match guard
        if (LS.getItem('waselni_journey_request') && !LS.getItem('waselni_driver_match')) {
          LS.setItem('waselni_driver_match', JSON.stringify({ from: '', to: '', date: 'Today', timeBadge: '', status: 'looking' }));
          if (typeof window.renderJourneys === 'function') window.renderJourneys();
        }
        applyReal();
      }, 60);
    };
    if (document.readyState === 'complete') startJ();
    else window.addEventListener('load', startJ);
    try { if (window.WaselniData) WaselniData.onRequestsChange(applyReal); } catch (e) {}
  }

  // ---------- waselni-journeys.html (driver) : real candidates + live accept ----------
  if (path === 'waselni-journeys.html' && (LS.getItem('waselni_mode') || 'passenger') === 'driver') {
    var mapCand = function (c) {
      var p = c.person || {};
      return { requestId: c.requestId, id: p.id, initial: p.initial, name: p.name, knownAs: p.knownAs,
               title: p.title, tags: p.tags || [], interests: p.interests || [] };
    };
    var buildDriverParty = function () {
      if (!(window.WaselniData && WaselniData.ready)) return Promise.resolve([]);
      return WaselniData.getMyRoster().then(function (roster) {
        return (roster.confirmed || []).map(function (c) { return personToRider(c.person); });
      }, function () { return []; });
    };
    var applyDriver = function () {
      if (!(window.WaselniData && WaselniData.ready)) return;
      WaselniData.getMyRoster().then(function (roster) {
        var journey = roster.journey;
        if (!journey) return;                                       // no posted ride → leave the screen alone
        var confirmed = (roster.confirmed || []).map(mapCand);
        var pending = (roster.pending || []).map(mapCand);
        var st = { from: journey.from_area, to: journey.to_area,
                   timeBadge: 'Pickup ' + (journey.depart_label || ''), date: 'Today', seats: journey.seats || 3 };
        // one accept path only: show pending candidates until all are decided, then the confirmed crew
        if (pending.length) { st.status = 'driver_matched'; st.matched = 0; st.candidates = pending; }
        else if (confirmed.length) { st.status = 'driver_confirmed'; st.confirmedPassengers = confirmed; }
        else { st.status = 'driver_looking'; }
        LS.setItem('waselni_driver_status', JSON.stringify(st));
        if (typeof window.renderJourneys === 'function') window.renderJourneys();
        connectButton(confirmed.length > 0, buildDriverParty);      // offer connect once someone's aboard
      }, function () {});
    };
    var startD = function () { setTimeout(applyDriver, 60); };
    if (document.readyState === 'complete') startD();
    else window.addEventListener('load', startD);
    try { if (window.WaselniData) WaselniData.onRequestsChange(applyDriver); } catch (e) {}

    // Persist each per-candidate Accept / Skip — the screen records them in memory only.
    // The sheet rebuilds its buttons per candidate but keeps stable ids and always opens at index 0,
    // so we snapshot the same candidate slice at open time and mirror the index on each decision.
    var drvIdx = 0, drvShown = [];
    var wrapOpen = function () {
      if (typeof window.openDriverPassengerSheet === 'function' && !window.openDriverPassengerSheet.__wln) {
        var orig = window.openDriverPassengerSheet;
        window.openDriverPassengerSheet = function () {
          drvIdx = 0;
          try {
            var st = JSON.parse(LS.getItem('waselni_driver_status') || 'null');
            var cands = (st && st.candidates) || [];
            drvShown = cands.slice(0, ((st && st.seats) || 3) + 1);  // same slice + moment the sheet uses
          } catch (e) { drvShown = []; }
          return orig.apply(this, arguments);
        };
        window.openDriverPassengerSheet.__wln = true;
      }
    };
    if (document.readyState === 'complete') wrapOpen();
    else window.addEventListener('load', wrapOpen);
    document.addEventListener('click', function (e) {
      var t = e.target; if (!t || (t.id !== 'drvAccept' && t.id !== 'drvSkip')) return;
      try {
        var cand = drvShown[drvIdx];                                // capture phase → runs before the sheet advances
        if (cand && cand.requestId && window.WaselniData && WaselniData.ready) {
          WaselniData.decideCandidate(cand.requestId, t.id === 'drvAccept');
        }
        drvIdx++;                                                   // Accept and Skip both advance the sheet
      } catch (err) {}
    }, true);
  }

  // ---------- waselni-stars-aligned.html : real ride party + real connections ----------
  if (path === 'waselni-stars-aligned.html') {
    var starsStart = function () {
      // 1) repopulate the swipe deck from the real ride party (mutating the screen's own const array)
      try {
        var party = JSON.parse(LS.getItem('waselni_stars_party') || '[]');
        if (party.length && typeof riders !== 'undefined' && Array.isArray(riders)) {
          riders.length = 0;
          party.forEach(function (p) { riders.push(p); });
          if (typeof window.renderRider === 'function') window.renderRider(0);
        }
      } catch (e) {}
      // 2) persist a connection whenever a rider is chosen — covers the Connect button AND swipe-right,
      //    since both set decisions[i]='connect' internally (which we can't hook, but can observe).
      var persisted = {};
      setInterval(function () {
        try {
          if (typeof decisions === 'undefined' || typeof riders === 'undefined') return;
          for (var i = 0; i < riders.length; i++) {
            if (decisions[i] === 'connect' && !persisted[i]) {
              persisted[i] = true;
              var r = riders[i];
              if (r && r.id && window.WaselniData && WaselniData.ready) WaselniData.createConnection(r.id);
            }
          }
        } catch (e) {}
      }, 400);
    };
    if (document.readyState === 'complete') starsStart();
    else window.addEventListener('load', starsStart);
  }

  // ---------- onboarding pills → UAE-representative, sourced from the taxonomy ----------
  // (the prototype screens ship demo lists; we swap in the UAE taxonomy at runtime so the
  //  designer's screens stay untouched and matching + onboarding share ONE source of truth.)
  var whenReady = function (fn) { if (document.readyState === 'complete') fn(); else window.addEventListener('load', fn); };

  // preferences (professions): repoint the autocomplete at the full UAE title list (search reads it live)
  if (path === 'waselni-preferences.html') {
    whenReady(function () {
      try {
        var T = window.WaselniTaxonomy; if (!T) return;
        if (typeof JOB_LIST === 'undefined' || !Array.isArray(JOB_LIST)) return;
        var uae = T.allProfessions(); if (!uae.length) return;
        JOB_LIST.length = 0; uae.forEach(function (p) { JOB_LIST.push(p); });
      } catch (e) {}
    });
  }

  // interests: rebuild the carousel from the UAE interest list (addInterest stays the screen's own)
  if (path === 'waselni-interests.html') {
    whenReady(function () {
      try {
        var T = window.WaselniTaxonomy; if (!T) return;
        var track = document.getElementById('carouselTrack');
        if (!track || typeof window.addInterest !== 'function') return;
        var list = T.allInterests(); if (!list.length) return;
        track.innerHTML = '';
        list.concat(list).forEach(function (i) {                         // doubled for the seamless scroll loop
          var pill = document.createElement('button');
          pill.className = 'carousel-pill';
          pill.textContent = i;
          pill.onclick = function () { window.addInterest(i); };
          track.appendChild(pill);
        });
      } catch (e) {}
    });
  }

  // find-your-people: SEED (Yassin's Excel) + LEARNED (real picks) "who to meet".
  // Never a preset: seed is a curated starting point; learned surfaces real demand
  // (≥threshold% of a sector's users picked a target). The user edits freely.
  if (path === 'waselni-find-your-people.html') {
    whenReady(function () {
      try {
        var T = window.WaselniTaxonomy; if (!T) return;
        var grid = document.getElementById('chipsGrid');
        if (!grid || typeof window.toggleChip !== 'function') return;
        var prof = {}; try { prof = JSON.parse(LS.getItem('waselni_profile') || '{}'); } catch (e) {}
        var job = (prof.jobTitles && prof.jobTitles[0]) || '';
        var sector = T.familyOf(job);
        var CAP = 10, shown = {};
        var addChip = function (label) {                                // dedupe; never touches existing chips/selection
          if (!label || shown[label]) return;
          if (grid.querySelectorAll('.chip').length >= CAP) return;
          shown[label] = true;
          var chip = document.createElement('div');
          chip.className = 'chip';
          chip.textContent = label;
          chip.onclick = function () { window.toggleChip(label, chip); };
          grid.appendChild(chip);
        };
        var seed = T.suggestedFor(job);
        if (!seed.length) {                                             // free-typed / unknown sector → a broad UAE default
          seed = ['Banking, Finance & Wealth', 'Real Estate & Property', 'Consulting, Legal & Professional Services',
                  'Technology, Fintech & Web3', 'Government & Public Sector', 'Media, Marketing & Creative'];
        }
        grid.innerHTML = '';
        seed.forEach(addChip);                                          // curated seed first (synchronous)
        // learned layer — appended when it returns, so it never clobbers seed chips or a selection in progress
        if (sector && window.WaselniData && WaselniData.ready && typeof WaselniData.learnedAudience === 'function') {
          WaselniData.learnedAudience(sector).then(function (learned) {
            (learned || []).forEach(addChip);
          }, function () {});
        }
      } catch (e) {}
    });
  }
})();
