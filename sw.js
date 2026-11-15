// PrepRep service worker: keeps the app working offline after the first visit.
const CACHE = "preprep-e144182e";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "index.html", "theme.css", "app.css", "bridge.js", "pyweb.js", "toast.js", "states.js", "form.js", "store.js", "chart.js", "wizard.js", "app.js", "data/recipes.json", "data/exercises.json", "logic/prepwise.py"]))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.endsWith(".exe")) return;   // big downloads go straight to the network
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
    return hit || net;          // cached first (fast, offline); new files are saved for next time
  }));
});
