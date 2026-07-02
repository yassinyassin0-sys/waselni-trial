# Waselni Live Trial — Ops Brief & Decisions

Deploy / hosting / backend workflow for taking the trial live. The coder's original
questions + ops's answers, kept together for reference.

## Context
- Static HTML/JS app, no build step. **Prototype** = designer's screens in a git repo,
  auto-pushed to GitHub (`yassinyassin0-sys/Waselni`) by a watcher → GitHub Pages.
- **LiveTrial/** = wired copies of the real screens + a decoupled data layer
  (`waselni-data.js`) syncing `localStorage` ↔ Supabase.
- Trial goals: public URL for multi-device/network testing; Supabase shared backend;
  trust-based login (first name + 4-digit PIN, **no email/SMS**); prototype stays
  untouched; prototype→trial sync without drift.

## Decisions (ops)
1. **Hosting → Netlify, separate repo.** Auto-deploys on push (zero config), better CDN
   for UAE than GH Pages, kept a completely separate repo from the prototype. Free tier is enough.
2. **Anon key in public repo → safe.** Browser-public by design, bounded by RLS.
   The **service_role** key must NEVER appear in client code. `config.js` (URL + anon key)
   in a public repo is the standard pattern.
3. **Security → acceptable for a closed trial; tighten RLS.** Scope UPDATE + DELETE so a
   user can only touch their own rows. *(OPEN — see below: needs an auth identity we don't
   currently have.)*
4. **Deploy → Netlify + GitHub, no watcher.** `git push` → Netlify deploys in ~10s.
   Prototype watcher stays completely independent.
5. **Prototype→trial sync → inject, don't bake in.** Keep the wiring as an external script
   injected before `</body>`; a small sync script copies the updated prototype screen +
   re-applies the injection. One command, repeatable, no drift.
6. **Supabase → Singapore (ap-southeast-1), free tier.** 500 MB DB / 50K MAU — plenty for a
   closed trial. Check for a new Middle-East region at project-creation time.
7. **Domain → Netlify subdomain fine** (e.g. `waselni-trial.netlify.app`). Custom domain
   later if it goes to a wider beta.

## Open items to resolve
- **RLS per-row scoping (point 3) vs. our auth model.** We do NOT use Supabase Auth — login
  is our own first name + 4-digit PIN over the anon key — so there's **no `auth.uid()`** for
  RLS to scope by. Options: **(a)** accept permissive RLS for the closed, invite-gated, no-PII
  trial; **(b)** add Supabase *anonymous auth* to get an `auth.uid()`, but that's per-device
  and would break the cross-device first-name+PIN login (the whole point). Note: the schema
  already default-denies everything except the specific grants, and `trial_users` has **no
  DELETE policy**. → ops decision needed.
- **Sync is slightly more than one script.** Beyond `waselni-data.js` there are a few
  per-screen hooks (remember-me redirect, home "remembered" flag, uaepass PIN capture,
  find-your-people save, login link, taxonomy include). Plan: refactor these into a **single
  screen-detecting injected script** so sync = inject one tag (matches ops's model exactly).

## To proceed
- **Supabase project:** NOT yet created → create in Singapore → run `db/schema.sql` → copy
  Project URL + anon key into `LiveTrial/config.js`.
- **Trial repo:** create a separate GitHub repo → push `LiveTrial/` → connect Netlify.
- **Coder:** refactor wiring → single injection; author/hand over the sync script.

---

## Appendix — the coder's original brief (the 7 questions)
1. **Hosting** — GitHub Pages (separate repo) or Netlify/Vercel? Easiest ongoing updates + separation?
2. **Secrets** — `config.js` holds Supabase URL + anon key; confirm public-repo-safe + keep service_role out of client.
3. **Security posture** — 4-digit PIN, permissive RLS, public anon key, no PII beyond first name/role/interests. OK for a closed trial? Anything to lock down first?
4. **Deploy/update workflow** — watcher, GitHub Action, or manual? Minimal steps per update.
5. **Prototype→trial sync** — cleanest way to re-apply the thin wiring after a designer screen update, no drift?
6. **Supabase** — region for UAE users, free-tier limits, RLS scope.
7. **Domain** — subdomain vs custom.
