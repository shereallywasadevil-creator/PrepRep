/* Titan part: states. Every panel is always in one clear state: loading, empty, error, or showing data.
     titan.state(box, "loading", {text: "Loading scores…"});
     titan.state(box, "empty", {title: "No games today", text: "Check back tomorrow."});
     titan.state(box, "error", {title: "Couldn't load", text: r.error, action: ["Try again", reload]});
   Then fill the box with data as usual (it replaces the state). */
(function () {
  "use strict";
  let styled = false;
  function state(box, kind, o) {
    o = o || {};
    if (!styled) {
      const st = document.createElement("style");
      st.textContent = ".t-state{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:28px 16px;color:var(--dim,#93a4ac)}" +
        ".t-state b{color:var(--ink,#eef3f5);font-size:17px}.t-state.error b{color:var(--bad,#ff6b5e)}" +
        ".t-spin{width:22px;height:22px;border-radius:50%;border:3px solid var(--rule,#25323a);border-top-color:var(--accent,#ff5a4e);animation:t-spin .8s linear infinite}@keyframes t-spin{to{transform:rotate(360deg)}}";
      document.head.append(st); styled = true;
    }
    const d = document.createElement("div"); d.className = "t-state " + kind;
    d.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind === "loading") { const s = document.createElement("div"); s.className = "t-spin"; d.append(s); }
    if (o.title) { const b = document.createElement("b"); b.textContent = o.title; d.append(b); }
    const p = document.createElement("div"); p.textContent = o.text || (kind === "loading" ? "Loading…" : kind === "empty" ? "Nothing here yet." : "Something went wrong."); d.append(p);
    if (o.action) { const btn = document.createElement("button"); btn.textContent = o.action[0]; btn.addEventListener("click", o.action[1]); d.append(btn); }
    box.replaceChildren(d);
    return d;
  }
  window.titan = Object.assign(window.titan || {}, {state});
})();
