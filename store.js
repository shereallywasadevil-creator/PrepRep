/* Titan part: store. Saves settings or progress through the app's engine (a real file on the PC), and falls
   back to the browser's storage when there is no engine. Writes are batched so fast clicks don't hammer disk.
     const s = titan.store("settings", {theme: "dark", volume: 5});   // name + defaults
     await s.ready;  s.get("theme");  s.set("theme", "light");  s.all()
   The engine needs "load" and "save" handlers (the desktop blueprint has them). */
(function () {
  "use strict";
  function store(name, defaults) {
    let data = Object.assign({}, defaults || {}), timer = 0;
    const key = "titan:" + name;
    const call = window.titan && window.titan.call;
    const ready = (async () => {
      try {
        if (call && window.titan.inApp) { const r = await call("load", {name}); if (r && !r.error && typeof r === "object") Object.assign(data, r[name] || r); }
        else { const raw = localStorage.getItem(key); if (raw) Object.assign(data, JSON.parse(raw)); }
      } catch (e) { /* first run, or storage blocked: keep the defaults */ }
    })();
    function flush() {
      try {
        if (call && window.titan.inApp) call("save", {name, data: {[name]: data}});
        else localStorage.setItem(key, JSON.stringify(data));
      } catch (e) { /* storage blocked: the app keeps working, it just won't remember */ }
    }
    return {
      ready,
      get: k => data[k],
      all: () => Object.assign({}, data),
      set(k, v) { data[k] = v; clearTimeout(timer); timer = setTimeout(flush, 250); },
      flush,
    };
  }
  window.titan = Object.assign(window.titan || {}, {store});
})();
