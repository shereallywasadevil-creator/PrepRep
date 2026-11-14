/* Titan part: form. Validates a form in place: each rule shows its message right under its field
   (announced to screen readers), focuses the first problem, and only returns values when all pass.
     const values = titan.validate(form, {
       name: v => v.trim() ? "" : "Enter a name.",
       age:  v => /^\d+$/.test(v) && +v >= 13 ? "" : "Use a whole number, 13 or more."});
     if (values) save(values);
   Each field needs an id matching its rule; the message goes into an element with id "<id>-error"
   (created automatically if missing). */
(function () {
  "use strict";
  function validate(form, rules) {
    const values = {}; let first = null;
    Object.entries(rules).forEach(([id, rule]) => {
      const field = form.querySelector("#" + CSS.escape(id)); if (!field) return;
      const v = field.type === "checkbox" ? field.checked : field.value;
      const msg = rule(v, values) || "";
      let err = form.querySelector("#" + CSS.escape(id + "-error"));
      if (!err) { err = document.createElement("div"); err.id = id + "-error"; err.className = "t-error"; err.setAttribute("aria-live", "polite"); err.style.color = "var(--bad,#ff6b5e)"; err.style.fontSize = "14px"; field.after(err); }
      err.textContent = msg;
      field.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) field.setAttribute("aria-describedby", err.id);
      if (msg && !first) first = field;
      values[id] = v;
    });
    if (first) { first.focus(); return null; }
    return values;
  }
  window.titan = Object.assign(window.titan || {}, {validate});
})();
