/* PrepRep on the web (phones): runs the brain, prepwise.py, inside the browser with Pyodide (Python compiled to
   WebAssembly), so the phone version does the same maths as the desktop app. Only the web build loads this file
   (tools/build_web.py sets window.PREP_WEB); the desktop app keeps using its own Python through WebView2. */
(function () {
  "use strict";
  if (!window.PREP_WEB || !window.titan) return;
  const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";
  let booting = null;

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Couldn't load " + src)); document.head.append(s); });
  }

  function boot() {
    if (booting) return booting;
    booting = (async () => {
      await loadScript(PYODIDE + "pyodide.js");
      const py = await window.loadPyodide({indexURL: PYODIDE});
      const src = await fetch("logic/prepwise.py", {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error("brain file missing"); return r.text(); });
      py.FS.writeFile("/home/pyodide/prepwise.py", src);
      py.runPython("import sys, json\nsys.path.insert(0, '/home/pyodide')\nimport prepwise");
      return py;
    })();
    booting.catch(() => { booting = null; });   // let a later call try again (e.g. the phone was offline)
    return booting;
  }

  // Same answers as the desktop runner in Logic.cs: {ok: result} | {missing: true} | {error: "..."}
  const RUN = `
req = json.loads(_req)
f = getattr(prepwise, req.get('fn', ''), None)
if req.get('fn') == '__list__':
    _out = json.dumps({'ok': sorted(n for n in dir(prepwise) if not n.startswith('_') and callable(getattr(prepwise, n)))})
elif f is None:
    _out = json.dumps({'missing': True})
else:
    try:
        _out = json.dumps({'ok': f(*req.get('args', []))}, default=list)
    except Exception as e:
        _out = json.dumps({'error': type(e).__name__ + ': ' + str(e)})
_out`;

  window.titan.call = async (type, payload, onPartial) => {
    if (type === "ping") return {ok: true, version: "web"};
    if (type !== "logic" && type !== "brain") return {error: "That needs the desktop app."};
    try {
      const py = await boot();
      const req = type === "brain" ? {fn: "__list__"} : (payload || {});
      py.globals.set("_req", JSON.stringify(req));
      const r = JSON.parse(py.runPython(RUN));
      return type === "brain" ? {source: "web", functions: r.ok || []} : r;
    } catch (e) {
      return {error: "The planner couldn't start. Check your internet connection and try again."};
    }
  };
  window.titan.warmUp = () => boot().catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(() => window.titan.warmUp()); else setTimeout(() => window.titan.warmUp(), 1500);
})();
