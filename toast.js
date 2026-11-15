/* Titan part: toast. Short messages that confirm an action ("Saved") or report a problem, announced to
   screen readers, gone after a few seconds.   titan.toast("Saved");  titan.toast("Couldn't save", "bad"); */
(function () {
  "use strict";
  let box = null;
  function toast(message, kind, ms) {
    if (!box) {
      box = document.createElement("div"); box.className = "t-toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
      document.body.append(box);
      const st = document.createElement("style");
      st.textContent = ".t-toasts{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:50}" +
        ".t-toast{background:var(--raised,#1c262b);color:var(--ink,#eef3f5);border:1px solid var(--rule,#25323a);border-left:4px solid var(--ok,#3ecf8e);border-radius:10px;padding:10px 14px;max-width:360px;animation:t-in .2s ease}" +
        ".t-toast.bad{border-left-color:var(--bad,#ff6b5e)}.t-toast.warn{border-left-color:var(--warn,#f6c343)}@keyframes t-in{from{opacity:0;transform:translateY(8px)}}";
      document.head.append(st);
    }
    const t = document.createElement("div"); t.className = "t-toast" + (kind ? " " + kind : ""); t.textContent = message;
    box.append(t); setTimeout(() => t.remove(), ms || 3200);
    return t;
  }
  window.titan = Object.assign(window.titan || {}, {toast});
})();
