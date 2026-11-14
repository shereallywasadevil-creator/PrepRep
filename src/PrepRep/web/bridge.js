/* Titan part: bridge. The page asks the app's engine to do things a web page can't (files, processes, AI).
   Inside a Titan desktop app it uses WebView2 messages; in a browser it falls back to POST /api/<type>
   (the blueprint's dev server answers those), so the same page works in both.
     const r = await titan.call("save", {data});              // -> engine's result object
     const r = await titan.call("coach", {prompt}, t => ...); // streamed pieces arrive in the callback
   Results with an "error" field mean the engine couldn't do it; show r.error to the user. */
(function () {
  "use strict";
  const host = window.chrome && window.chrome.webview;
  const pending = {}, partials = {};
  let seq = 0;
  if (host) host.addEventListener("message", e => {
    const d = e.data || {};
    if (d.partial != null) { if (partials[d.id]) partials[d.id](d.partial); return; }
    const f = pending[d.id];
    if (f) { delete pending[d.id]; delete partials[d.id]; f(d.result || {}); }
  });
  function call(type, payload, onPartial) {
    if (host) return new Promise(res => { const id = String(++seq); pending[id] = res; if (onPartial) partials[id] = onPartial; host.postMessage({id, type, payload: payload || {}}); });
    return fetch("/api/" + encodeURIComponent(type), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload || {})})
      .then(r => r.json()).catch(() => ({error: "The app's engine isn't answering."}));
  }
  window.titan = Object.assign(window.titan || {}, {call, inApp: !!host});
})();
