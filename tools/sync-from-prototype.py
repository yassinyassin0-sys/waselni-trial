#!/usr/bin/env python3
"""Sync trial screens FROM the designer's prototype.

Each trial screen = the prototype screen + one standard block of <script>
includes (config, supabase, waselni-data.js, waselni-trial.js) injected before
</head>. All trial behaviour lives in waselni-trial.js, so syncing is just
"copy the latest prototype screen + re-inject that block."

Trial-specific screens (the trust-based auth, the login, driver-verification)
are NEVER overwritten from the prototype — they're the trial's own.

Usage:
  python3 sync-from-prototype.py                 # dry run, all syncable screens
  python3 sync-from-prototype.py --apply         # actually write them
  python3 sync-from-prototype.py --apply waselni-home.html   # just one
"""
import sys, os, re

PROT  = "/Users/yassinyassin/Documents/Business/Businesses/Carpool-ParkingShare/App /Prototype/HTML/design/screens"
TRIAL = "/Users/yassinyassin/Documents/Business/Businesses/Carpool-ParkingShare/App /Prototype/LiveTrial"

# Load order matters: taxonomy → matching → data → trial
# (matching.js captures window.WaselniTaxonomy at load; data.js uses window.WaselniMatching).
INCLUDES = ("  <script src=\"config.js\"></script>\n"
            "  <script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\"></script>\n"
            "  <script src=\"waselni-taxonomy.js\"></script>\n"
            "  <script src=\"waselni-matching.js\"></script>\n"
            "  <script src=\"waselni-data.js\"></script>\n"
            "  <script src=\"waselni-trial.js\"></script>\n")

# some prototype screens link fonts from a local ./*_files/css2 that isn't copied
# here → swap to the Google Fonts CDN (idempotent; a no-op if already on the CDN)
CDN_FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:'
             'ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600'
             '&display=swap" rel="stylesheet">')
FONT_RE = re.compile(r'<link[^>]*_files/css2[^>]*>')   # ./x_files/css2 OR file:///…/x_files/css2

# prototype UI + thin wiring → safe to re-copy and re-inject
SYNCABLE = [
    "index.html", "waselni-home.html", "waselni-auth-social.html",
    "waselni-preferences.html", "waselni-interests.html", "waselni-find-your-people.html",
    "waselni-events.html", "waselni-stars-aligned.html",
    "waselni-edit-preferences-interests.html", "waselni-journeys.html",
]
# trial's own — never pulled from the prototype
SKIP = ["waselni-auth-uaepass.html", "waselni-login.html", "waselni-driver-verification.html"]

def sync_one(name, apply):
    src, dst = os.path.join(PROT, name), os.path.join(TRIAL, name)
    if not os.path.exists(src):
        return "no prototype file — skipped"
    html = open(src, encoding="utf-8").read()
    html = FONT_RE.sub(CDN_FONTS, html)                # fix broken local font links
    if "waselni-trial.js" in html:
        wired = html                                   # already has the block
    elif "</head>" in html:
        wired = html.replace("</head>", INCLUDES + "</head>", 1)
    else:
        return "!! no </head> — needs manual wiring"
    if apply:
        open(dst, "w", encoding="utf-8").write(wired)
        return "synced (%d KB)" % (len(wired) // 1024)
    return "would sync (+%d wiring bytes, </head> ok)" % (len(wired) - len(html))

def main():
    apply = "--apply" in sys.argv
    picked = [a for a in sys.argv[1:] if a.endswith(".html")] or SYNCABLE
    print("MODE:", "APPLY (writing files)" if apply else "DRY RUN (no changes)")
    for n in picked:
        if n in SKIP:
            print("  %-44s SKIP (trial-specific)" % n); continue
        print("  %-44s %s" % (n, sync_one(n, apply)))
    print("never synced from prototype:", ", ".join(SKIP))

main()
