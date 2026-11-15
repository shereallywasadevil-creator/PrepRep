"""Build the phone web app (PWA) of PrepRep into _site/ for GitHub Pages.

Same screens as the desktop app (src/PrepRep/web). Differences:
- pyweb.js runs the brain (web/logic/prepwise.py) in the browser with Pyodide;
- data is saved in the phone's browser storage;
- a manifest, icons and a service worker let it be added to the home screen and open offline.
Run after tools/fetch_photos.py so the photos are included.
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "src" / "PrepRep" / "web"
SITE = ROOT / "_site"
VERSION = sys.argv[1] if len(sys.argv) > 1 else "dev"

MANIFEST = {
    "name": "PrepRep", "short_name": "PrepRep", "description": "Meal prep, budget and workouts.",
    "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#ffffff", "theme_color": "#55b043",
    "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
              {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
}

SW = """// PrepRep service worker: keeps the app working offline after the first visit.
const CACHE = "preprep-%s";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(%s))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.endsWith(".exe")) return;   // big downloads go straight to the network
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
    return hit || net;          // cached first (fast, offline); new files are saved for next time
  }));
});
"""


def main():
    if SITE.exists():
        shutil.rmtree(SITE)
    shutil.copytree(WEB, SITE)
    head = ('<meta name="theme-color" content="#55b043">\n<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="apple-touch-icon" href="icons/icon-192.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-title" content="PrepRep">\n<script>window.PREP_WEB = true;</script>\n')
    idx = SITE / "index.html"
    html = idx.read_text(encoding="utf-8")
    html = html.replace("</head>", head + "</head>", 1)
    html = html.replace('<script src="bridge.js"></script>', '<script src="bridge.js"></script>\n<script src="pyweb.js"></script>', 1)
    html = html.replace("</body>", '<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");</script>\n</body>', 1)
    idx.write_text(html, encoding="utf-8")
    (SITE / "manifest.webmanifest").write_text(json.dumps(MANIFEST, indent=1), encoding="utf-8")
    shell = ["./", "index.html", "theme.css", "app.css", "bridge.js", "pyweb.js", "toast.js", "states.js", "form.js", "store.js",
             "chart.js", "wizard.js", "app.js", "data/recipes.json", "data/exercises.json", "logic/prepwise.py"]
    (SITE / "sw.js").write_text(SW % (VERSION, json.dumps(shell)), encoding="utf-8")
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    icons = ROOT / "tools" / "web_icons"
    shutil.copytree(icons, SITE / "icons")
    shutil.copytree(ROOT / "tools" / "web_download", SITE / "download")     # the page with the PC and phone links
    print(f"web app built in {SITE} ({sum(1 for _ in SITE.rglob('*'))} files)")


if __name__ == "__main__":
    main()
