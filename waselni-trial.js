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
    try { if (window.WaselniData && WaselniData.ready && WaselniData.currentUserId()) WaselniData.init(); } catch (e) {}

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
    });
  }
})();
