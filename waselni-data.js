/* =====================================================================
   Waselni · Data layer  —  the ONLY file that talks to the backend.

   Your screens never change how they read data: they keep using
   localStorage (waselni_profile, waselni_role, …). This module keeps
   that localStorage in sync with Supabase — it LOADS it on entry and
   SAVES it on change. UI and data stay completely separate.

   Screens use it through one global:  window.WaselniData
   ---------------------------------------------------------------------
   Load order in a screen (before the screen's own scripts):
     <script src="config.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="waselni-data.js"></script>
   ===================================================================== */
(function () {
  const CFG = window.WASELNI_CONFIG || {};
  const READY = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.startsWith('PASTE') &&
                CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.startsWith('PASTE') &&
                !!window.supabase;
  const sb = READY ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  const UID = 'waselni_trial_uid';

  const ls = {
    profile(){ try { return JSON.parse(localStorage.getItem('waselni_profile') || '{}'); } catch { return {}; } },
    setProfile(p){ localStorage.setItem('waselni_profile', JSON.stringify(p)); },
    role(){ return localStorage.getItem('waselni_role') || 'both'; },
    setRole(r){ localStorage.setItem('waselni_role', r); }
  };

  /* ----- map between the screens' profile object and a DB row ----- */
  function profileToRow(p, role) {
    return {
      legal_name:   p.legalName || p.fullName || 'Guest',
      display_name: p.displayName || null,
      username:     (p.username || (p.legalName || p.fullName || '').trim().split(/\s+/)[0] || '').toLowerCase() || null,
      pin:          p.pin || null,
      gender:       p.gender || null,
      nationality:  p.nationality || null,
      role:         role || 'both',
      job_titles:   Array.isArray(p.jobTitles)   ? p.jobTitles   : [],
      interests:    Array.isArray(p.interests)   ? p.interests   : [],
      audience:     Array.isArray(p.preferences) ? p.preferences : [],
      company:      p.company || null,
      platforms:    Array.isArray(p.platforms) ? p.platforms : (p.platforms || {})
    };
  }
  function rowToProfile(r) {
    return {
      legalName: r.legal_name, displayName: r.display_name, gender: r.gender,
      username: r.username || null, pin: r.pin || null,
      nationality: r.nationality, jobTitles: r.job_titles || [], interests: r.interests || [],
      preferences: r.audience || [], company: r.company || null, platforms: r.platforms || []
    };
  }
  /* shape the screens use for a person / co-passenger / driver card */
  function rowToPerson(r) {
    const job = (r.job_titles && r.job_titles[0]) || '';
    return {
      id: r.id,
      name: r.legal_name,
      knownAs: r.display_name || (r.legal_name || '').trim().split(' ')[0] || 'Someone',
      initial: (r.legal_name || '?').trim().charAt(0).toUpperCase(),
      title: job + (r.company ? ' · ' + r.company : ''),
      tags: r.job_titles || [],
      interests: r.interests || [],
      audience: r.audience || []
    };
  }

  const WaselniData = {
    ready: READY,                                   // false until Supabase keys are in config.js
    currentUserId() { return localStorage.getItem(UID); },
    setCurrentUser(id) { localStorage.setItem(UID, id); },
    signOut() { localStorage.removeItem(UID); },

    /* Call on app entry. Restores a returning user's profile from the DB
       into localStorage so every screen reads it as usual. Returns the
       profile, or null (new user / not configured). */
    async init() {
      if (!sb) return null;
      const id = this.currentUserId();
      if (!id) return null;
      const { data } = await sb.from('trial_users').select('*').eq('id', id).maybeSingle();
      if (!data) { this.signOut(); return null; }
      ls.setProfile(rowToProfile(data));
      ls.setRole(data.role || 'both');
      return rowToProfile(data);
    },

    /* Call when onboarding completes (or any profile edit). Reads the
       current localStorage profile + role and writes it to Supabase
       (insert first time, update after). Returns the saved row id. */
    async saveProfile() {
      if (!sb) return null;
      const row = profileToRow(ls.profile(), ls.role());
      if (!row.legal_name || row.legal_name === 'Guest') return null;   // nothing to save yet
      const id = this.currentUserId();
      const q = id
        ? sb.from('trial_users').update(row).eq('id', id).select('id').maybeSingle()
        : sb.from('trial_users').insert(row).select('id').single();
      const { data, error } = await q;
      if (error) { console.warn('[waselni] saveProfile', error.message); return null; }
      if (data) this.setCurrentUser(data.id);
      return data;
    },

    /* Everyone else in the trial, in the person shape the screens render. */
    async getPeople() {
      if (!sb) return [];
      const { data, error } = await sb.from('trial_users').select('*').order('created_at');
      if (error) { console.warn('[waselni] getPeople', error.message); return []; }
      const me = this.currentUserId();
      return (data || []).filter(u => u.id !== me).map(rowToPerson);
    },

    /* People ranked by overlap with me — the networking score.
       Returns each person + {shared:[], reasons:[]}. */
    async getPeopleRanked() {
      const meP = ls.profile();
      const mine = new Set((meP.interests || []).map(s => s.toLowerCase()));
      const myJobs = new Set((meP.jobTitles || []).map(s => s.toLowerCase()));
      const people = await this.getPeople();
      return people.map(p => {
        const shared = (p.interests || []).filter(i => mine.has(i.toLowerCase()));
        const sameField = (p.tags || []).some(t => myJobs.has(t.toLowerCase()));
        const reasons = [];
        if (sameField) reasons.push('same field');
        if (shared.length) reasons.push(shared.length + ' shared interest' + (shared.length > 1 ? 's' : ''));
        return { ...p, shared, reasons, _score: shared.length * 2 + (sameField ? 3 : 0) };
      }).sort((a, b) => b._score - a._score);
    },

    /* live updates: cb() fires whenever the people pool changes */
    onPeopleChange(cb) {
      if (!sb) return;
      try { sb.channel('wd-people').on('postgres_changes',
        { event: '*', schema: 'public', table: 'trial_users' }, cb).subscribe(); } catch (e) {}
    },

    /* Is this first-name + PIN already taken? (signup uniqueness check) */
    async credentialTaken(firstName, pin) {
      if (!sb) return false;
      const uname = (firstName || '').trim().toLowerCase();
      if (!uname || !pin) return false;
      const { data } = await sb.from('trial_users').select('id').eq('username', uname).eq('pin', String(pin)).limit(1);
      return !!(data && data.length);
    },

    /* Log a returning user in by first name + PIN. Finds their profile in
       Supabase, restores it into localStorage, returns it (or null if no match). */
    async login(firstName, pin) {
      if (!sb) return null;
      const uname = (firstName || '').trim().toLowerCase();
      const { data, error } = await sb.from('trial_users')
        .select('*').eq('username', uname).eq('pin', String(pin)).limit(1);
      if (error || !data || !data.length) return null;
      const row = data[0];
      this.setCurrentUser(row.id);
      ls.setProfile(rowToProfile(row));
      ls.setRole(row.role || 'both');
      return rowToProfile(row);
    },

    /* ===== Phase 2 · journeys + matching ================================= */

    /* Driver posts a ride they're offering. */
    async postJourney(j) {
      if (!sb) return null;
      const me = this.currentUserId(); if (!me) return null;
      const row = { driver_id: me, from_area: j.from || '', to_area: j.to || '',
                    depart_label: j.time || j.depart || null, seats: j.seats || 3, notes: j.notes || null };
      const { data, error } = await sb.from('trial_journeys').insert(row).select('*').single();
      if (error) { console.warn('[waselni] postJourney', error.message); return null; }
      return data;
    },

    /* The driver's own latest posted journey (or null). */
    async getMyJourney() {
      if (!sb) return null;
      const me = this.currentUserId(); if (!me) return null;
      const { data } = await sb.from('trial_journeys').select('*')
        .eq('driver_id', me).order('created_at', { ascending: false }).limit(1);
      return (data && data[0]) || null;
    },

    /* Open journeys from OTHER drivers, each with the driver's person card + seatsLeft. */
    async getOpenJourneys() {
      if (!sb) return [];
      const me = this.currentUserId();
      const { data } = await sb.from('trial_journeys').select('*').order('created_at', { ascending: false });
      const journeys = (data || []).filter(j => j.driver_id !== me);
      if (!journeys.length) return [];
      const ids = [...new Set(journeys.map(j => j.driver_id))];
      const { data: users } = await sb.from('trial_users').select('*').in('id', ids);
      const byId = {}; (users || []).forEach(u => { byId[u.id] = u; });
      const { data: reqs } = await sb.from('trial_requests').select('journey_id,status');
      const taken = {}; (reqs || []).forEach(r => { if (r.status === 'accepted') taken[r.journey_id] = (taken[r.journey_id] || 0) + 1; });
      return journeys.map(j => ({
        ...j,
        driver: byId[j.driver_id] ? rowToPerson(byId[j.driver_id]) : null,
        seatsLeft: (j.seats || 0) - (taken[j.id] || 0),
      }));
    },

    /* Passenger asks for a ride → the engine matches it against open journeys →
       create a pending request on the best one. Returns {status, match?}. */
    async requestRide(req) {
      if (!sb) return { status: 'no_backend' };
      const me = this.currentUserId(); if (!me) return { status: 'no_user' };
      const meP = ls.profile();
      const journeys = await this.getOpenJourneys();
      const M = window.WaselniMatching;
      const pax = { jobTitles: meP.jobTitles, interests: meP.interests, preferences: meP.preferences,
                    gender: meP.gender, destination: req.destination || req.to };
      const ranked = M ? M.rankJourneysFor(pax, journeys, req.intent)
                       : journeys.map(j => ({ journey: j, reasons: [] }));
      if (!ranked.length) return { status: 'no_matches' };
      const best = ranked[0];
      const { error } = await sb.from('trial_requests')
        .upsert({ journey_id: best.journey.id, passenger_id: me, status: 'pending' },
                { onConflict: 'journey_id,passenger_id' });
      if (error) { console.warn('[waselni] requestRide', error.message); return { status: 'error' }; }
      return { status: 'pending', match: { driver: best.journey.driver, journey: best.journey, reasons: best.reasons } };
    },

    /* Passenger's current ride: their latest request + the driver + co-passengers. */
    async getMyMatch() {
      if (!sb) return null;
      const me = this.currentUserId(); if (!me) return null;
      const { data: reqs } = await sb.from('trial_requests').select('*')
        .eq('passenger_id', me).order('created_at', { ascending: false }).limit(1);
      const myReq = reqs && reqs[0]; if (!myReq) return null;
      const { data: journey } = await sb.from('trial_journeys').select('*').eq('id', myReq.journey_id).maybeSingle();
      if (!journey) return null;
      const { data: driver } = await sb.from('trial_users').select('*').eq('id', journey.driver_id).maybeSingle();
      const { data: co } = await sb.from('trial_requests').select('passenger_id,status')
        .eq('journey_id', journey.id).eq('status', 'accepted');
      const coIds = (co || []).map(r => r.passenger_id).filter(id => id !== me);
      let coPassengers = [];
      if (coIds.length) {
        const { data: cu } = await sb.from('trial_users').select('*').in('id', coIds);
        coPassengers = (cu || []).map(rowToPerson);
      }
      return { status: myReq.status, journey, driver: driver ? rowToPerson(driver) : null, coPassengers };
    },

    /* Driver's pending candidate passengers, ranked by the driver's own score. */
    async getCandidates() {
      if (!sb) return [];
      const j = await this.getMyJourney(); if (!j) return [];
      const { data: reqs } = await sb.from('trial_requests').select('*').eq('journey_id', j.id).eq('status', 'pending');
      const ids = (reqs || []).map(r => r.passenger_id);
      if (!ids.length) return [];
      const { data: users } = await sb.from('trial_users').select('*').in('id', ids);
      const byId = {}; (users || []).forEach(u => { byId[u.id] = u; });
      const meP = ls.profile();
      const M = window.WaselniMatching;
      return (reqs || []).map(r => {
        const u = byId[r.passenger_id]; if (!u) return null;
        const them = { jobTitles: u.job_titles, interests: u.interests, preferences: u.audience };
        const score = M ? M.networkScore(meP, them, j.intent) : 0;
        const why = M ? M.reasons(meP, them) : [];
        return { requestId: r.id, person: rowToPerson(u), reasons: why, _score: score };
      }).filter(Boolean).sort((a, b) => b._score - a._score);
    },

    /* Driver accepts or declines a candidate. */
    async decideCandidate(requestId, accept) {
      if (!sb) return false;
      const { error } = await sb.from('trial_requests')
        .update({ status: accept ? 'accepted' : 'declined' }).eq('id', requestId);
      if (error) { console.warn('[waselni] decideCandidate', error.message); return false; }
      return true;
    },

    /* Record a connection between two riders (Stars Aligned payoff). */
    async createConnection(otherId) {
      if (!sb) return false;
      const me = this.currentUserId(); if (!me || !otherId) return false;
      const a = me < otherId ? me : otherId, b = me < otherId ? otherId : me;   // stable order = unique pair
      const { error } = await sb.from('trial_connections').upsert({ user_a: a, user_b: b }, { onConflict: 'user_a,user_b' });
      return !error;
    },

    /* Live updates whenever any ride request changes (driver's candidates / passenger's status). */
    onRequestsChange(cb) {
      if (!sb) return;
      try { sb.channel('wd-requests').on('postgres_changes',
        { event: '*', schema: 'public', table: 'trial_requests' }, cb).subscribe(); } catch (e) {}
    }
  };

  window.WaselniData = WaselniData;
})();
