# Waselni · Live Trial — backend (the data layer)

Makes the **real Waselni screens** live with a real database, for a closed friend trial. The design stays yours — all the backend logic lives in **one file** (`waselni-data.js`) that the screens talk to. You can keep editing the UI freely; the data layer never touches your markup.

```
LiveTrial/
├── index.html, waselni-*.html  ← COPIES of your real screens, wired to the data layer
├── waselni-data.js   ← the ONLY backend file the screens load
├── config.js         ← paste your Supabase URL + anon key here
├── db/schema.sql     ← run once in Supabase
└── _archive_wrong_screens/  ← my earlier from-scratch screens (ignore)
```

> Your prototype in `HTML/design/screens/` is untouched. These are copies. **Phase 1 (profiles) is already wired** — the steps in §2 are done here; they're kept as a reference for re-syncing.

---

## 1 · Supabase setup (one time, ~5 min)
1. **supabase.com** → sign up (free) → New project (region: Frankfurt or Mumbai). Wait ~2 min.
2. **SQL Editor** → paste all of `db/schema.sql` → Run.
3. **Settings → API** → copy the **Project URL** + **anon public** key into `config.js`. Set `INVITE_CODE` too.

Until those keys are in, `WaselniData.ready` is `false` and every call is a safe no-op — so the screens keep working exactly as today.

---

## 2 · How a screen connects (the whole footprint)

**a) Load the data layer** — three lines before the screen's own `<script>`:
```html
<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="waselni-data.js"></script>
```

**b) On entry — restore a returning user** (so their profile comes back from the DB):
```js
await WaselniData.init();   // fills localStorage.waselni_profile + waselni_role
```

**c) When onboarding finishes — save the real user** (e.g. the find-your-people "continue" handler):
```js
await WaselniData.saveProfile();   // reads your localStorage profile → writes to Supabase
```

**d) Bypass UAE Pass — use a typed name.** In `waselni-auth-uaepass.html`, the name is hardcoded (`fullName: 'Ahmed Al-Mansouri'`). Add a text input (your UI), then set it:
```js
uaePassProfile.fullName = document.getElementById('nameInput').value.trim();
```
Everything downstream (`auth-social` → `waselni_profile.legalName`) then works unchanged.

That's the entire integration for Phase 1. Your screens read `localStorage` exactly as they do now — the data layer just keeps it in sync with the database.

### The API (`window.WaselniData`)
| Call | Does |
|---|---|
| `WaselniData.ready` | `true` once Supabase keys are set |
| `await init()` | load this user's profile from DB → localStorage |
| `await saveProfile()` | save the localStorage profile → DB |
| `await getPeople()` | everyone else, in the screens' person shape `{name,knownAs,title,tags,interests}` |
| `await getPeopleRanked()` | people sorted by overlap with you (+ `shared`, `reasons`) |
| `onPeopleChange(cb)` | live updates when the pool changes |

---

## Phase 2 (next)
`postJourney()` / `getJourneys()` / `requestRide()` / `getMyRide()` — a passenger request matched to a real driver + co-passengers from the pool (a simplified version of the route-gate + career/interest two-layer algorithm), then the ride lifecycle. The `trial_journeys` / `trial_requests` / `trial_connections` tables are already in the schema, ready for it.

## Notes
- Closed, trust-based trial: no login, DB open to anyone with the link + code, no sensitive data (names/professions/interests only).
- Reset: `truncate trial_users, trial_journeys, trial_requests, trial_connections cascade;`
- **Keeping copies in sync with your prototype:** edit the UI in `HTML/design/screens/` as usual. When you want those changes in the trial, re-copy the screen into `LiveTrial/` and re-apply the wiring (§2 a–d). The footprint is tiny, so this is a 2-minute step — not a rebuild.
