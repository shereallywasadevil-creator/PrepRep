/* "Plan my week": a short, friendly set of questions (where you live, your stores, how many people, favourite
   ingredients, weekly budget, diet, which meals, which days), then PrepRep builds the plan.
   The mascot is PrepRep's own (a smiling meal-prep box). Store tiles use names, not store logos.
   Screens by Claude; the planning itself is plan_meals in prepwise.py, built by the Local AI. */
"use strict";
window.PREP_WIZARD = (() => {
  const COUNTRIES = [["us", "🇺🇸", "United States"], ["uk", "🇬🇧", "United Kingdom"], ["ca", "🇨🇦", "Canada"], ["au", "🇦🇺", "Australia"], ["de", "🇩🇪", "Germany"], ["fr", "🇫🇷", "France"]];
  const STORES = {
    us: ["Walmart", "Target", "Costco", "Kroger", "Aldi", "Trader Joe's", "Whole Foods", "Safeway", "Publix", "H-E-B", "Lidl", "Sam's Club"],
    uk: ["Tesco", "Sainsbury's", "Asda", "Aldi", "Lidl", "Morrisons", "Waitrose", "Co-op"],
    ca: ["Walmart", "Loblaws", "No Frills", "Costco", "Sobeys", "Metro", "FreshCo", "Real Canadian Superstore"],
    au: ["Woolworths", "Coles", "Aldi", "IGA", "Costco"],
    de: ["Aldi", "Lidl", "Rewe", "Edeka", "Kaufland", "Netto", "Penny"],
    fr: ["Carrefour", "E.Leclerc", "Auchan", "Lidl", "Intermarché", "Super U", "Monoprix"],
  };
  const FAVES = [["chicken", "🍗", ["chicken_breast", "chicken_thighs"]], ["beef", "🥩", ["ground_beef", "stew_beef", "sirloin"]], ["pork", "🥓", ["pork_tenderloin", "ground_pork"]],
    ["turkey", "🦃", ["ground_turkey"]], ["shrimp", "🍤", ["shrimp"]], ["salmon", "🐟", ["salmon"]], ["tuna", "🥫", ["tuna"]], ["eggs", "🥚", ["eggs"]], ["tofu", "🧈", ["tofu"]],
    ["beans", "🫘", ["black_beans", "kidney_beans", "white_beans"]], ["chickpeas", "🧆", ["chickpeas"]], ["lentils", "🥣", ["red_lentils", "brown_lentils"]], ["rice", "🍚", ["rice", "brown_rice"]],
    ["pasta", "🍝", ["ww_pasta", "orzo"]], ["potatoes", "🥔", ["potatoes"]], ["sweet potato", "🍠", ["sweet_potatoes"]], ["broccoli", "🥦", ["broccoli", "frozen_broccoli"]],
    ["spinach", "🥬", ["spinach", "kale"]], ["peppers", "🫑", ["pepper"]], ["avocado", "🥑", ["avocado"]], ["cheese", "🧀", ["cheddar", "mozzarella", "parmesan", "feta"]],
    ["peanut butter", "🥜", ["peanut_butter", "peanuts"]], ["mushrooms", "🍄", ["mushrooms"]], ["pineapple", "🍍", ["pineapple"]], ["coconut", "🥥", ["coconut_milk"]]];
  const DIETS = [["none", "🍽️", "No restrictions"], ["vegetarian", "🥗", "Vegetarian"], ["vegan", "🌱", "Vegan"], ["pescatarian", "🐟", "Pescatarian"],
    ["noseafood", "🦐", "No seafood"], ["glutenfree", "🌾", "Gluten-free"], ["dairyfree", "🥛", "Dairy-free"], ["nopork", "🐖", "No pork"],
    ["noredmeat", "🥩", "No red meat"], ["nutfree", "🥜", "Nut-free"], ["eggfree", "🥚", "Egg-free"]];
  const BLOCK = {vegetarian: ["meat", "seafood"], vegan: ["meat", "seafood", "dairy", "egg", "honey"], pescatarian: ["meat"], noseafood: ["seafood"],
    glutenfree: ["gluten"], dairyfree: ["dairy"], nopork: ["pork"], noredmeat: ["red meat"], nutfree: ["nuts"], eggfree: ["egg"]};
  const MEALS = [["breakfast", "🥪", "Breakfast"], ["lunch", "🍱", "Lunch"], ["dinner", "🍲", "Dinner"]];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DEFAULT = {country: "us", stores: [], people: 1, faves: [], extra: [], budget: 6000, diets: ["none"], meals: ["lunch", "dinner"], days: ["Mon", "Tue", "Wed", "Thu", "Fri"]};

  /* our own mascot: a smiling meal-prep box with a sprout */
  const MASCOT = `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="mb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef1ea"/></linearGradient></defs>
    <ellipse cx="60" cy="110" rx="34" ry="5" fill="#000" opacity=".08"/>
    <path d="M60 28c-4-10-14-14-22-12 2 9 10 14 22 12z" fill="#7bc96f"/><path d="M60 28c4-12 15-16 24-13-3 10-12 15-24 13z" fill="#56b13f"/><rect x="58" y="24" width="4" height="12" rx="2" fill="#3f8f2c"/>
    <rect x="20" y="36" width="80" height="66" rx="22" fill="url(#mb)" stroke="#e3e7df" stroke-width="2"/>
    <rect x="20" y="36" width="80" height="16" rx="8" fill="#56b13f"/>
    <circle cx="46" cy="70" r="5" fill="#1c1f1d"/><circle cx="74" cy="70" r="5" fill="#1c1f1d"/><circle cx="47.5" cy="68.5" r="1.6" fill="#fff"/><circle cx="75.5" cy="68.5" r="1.6" fill="#fff"/>
    <path d="M51 80q9 8 18 0" fill="none" stroke="#1c1f1d" stroke-width="3" stroke-linecap="round"/>
    <circle cx="38" cy="80" r="4" fill="#ffb4a2" opacity=".7"/><circle cx="82" cy="80" r="4" fill="#ffb4a2" opacity=".7"/></svg>`;

  function allowed(r, a) {
    const block = new Set((a.diets || []).flatMap(d => BLOCK[d] || []));
    return !(r.contains || []).some(c => block.has(c));
  }
  function favScore(r, a) {
    const keys = new Set(r.keys || []), words = (a.extra || []).map(w => w.toLowerCase());
    let n = 0;
    for (const f of a.faves || []) { const fv = FAVES.find(x => x[0] === f); if (fv && fv[2].some(k => keys.has(k))) n++; }
    for (const w of words) if (r.ingredients.some(i => i.item.toLowerCase().includes(w)) || r.name.toLowerCase().includes(w)) n++;
    return n;
  }
  function servingsFor(a) {
    const days = a.days.length, p = a.people, b = a.meals.includes("breakfast") ? p * days : 0;
    const mains = p * days * a.meals.filter(m => m !== "breakfast").length;
    return {breakfast: b, mains};
  }

  /* the questions */
  function steps(h, a, S) {
    const tile = (on, emoji, label, onclick, cls = "") => h("button", {class: "wtile" + (on ? " on" : "") + cls, "aria-pressed": String(on), onclick},
      emoji ? h("span", {class: "wemo", text: emoji}) : null, h("span", {class: "wlab", text: label}));
    const toggle = (list, v) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
    return [
      {q: "Where do you live?", body: redraw => h("div", {class: "wgrid"}, ...COUNTRIES.map(([k, f, n]) => tile(a.country === k, f, n, () => { a.country = k; a.stores = a.stores.filter(s => (STORES[k] || []).includes(s)); redraw(); }))),
       note: () => a.country === "us" ? "" : "Prices in PrepRep are US estimates, so treat costs as a rough guide where you live."},
      {q: "Which grocery stores do you shop at?", sub: "Pick as many as you like.", ok: () => true,
       body: redraw => h("div", {class: "wgrid stores"}, ...(STORES[a.country] || STORES.us).map(n => tile(a.stores.includes(n), "", n, () => { a.stores = toggle(a.stores, n); redraw(); }, " store")))},
      {q: "How many are you cooking for?", body: redraw => h("div", {class: "wpeople"},
        h("div", {class: "wbig"}, h("b", {text: a.people}), h("small", {text: a.people === 1 ? "person" : "people"})),
        h("div", {class: "wdots"}, ...[1, 2, 3, 4, 5, 6].map(n => h("button", {class: "wdot" + (n <= a.people ? " on" : ""), "aria-label": `${n} ${n === 1 ? "person" : "people"}`, onclick: () => { a.people = n; redraw(); }, text: n <= a.people ? "👤" : ""}))))},
      {q: "Any favourite ingredients?", sub: "We'll put meals with these first. Skip if you like everything.", ok: () => true,
       body: redraw => { const add = h("input", {class: "wadd", placeholder: "Add your own, e.g. garlic", "aria-label": "Add an ingredient"});
         add.addEventListener("keydown", e => { if (e.key === "Enter" && add.value.trim()) { a.extra = [...new Set([...a.extra, add.value.trim().toLowerCase()])]; redraw(); } });
         return h("div", {}, h("div", {class: "wchips"}, ...FAVES.map(([k, e]) => tile(a.faves.includes(k), e, k, () => { a.faves = toggle(a.faves, k); redraw(); }, " chip")),
           ...a.extra.map(w => tile(true, "➕", w, () => { a.extra = a.extra.filter(x => x !== w); redraw(); }, " chip"))), add); }},
      {q: "What's your weekly budget?", body: redraw => { const r = h("input", {type: "range", min: "20", max: "325", step: "5", value: String(Math.round(a.budget / 100)), "aria-label": "Weekly budget"});
         const big = h("b", {text: "$" + Math.round(a.budget / 100)}); r.addEventListener("input", () => { a.budget = +r.value * 100; big.textContent = "$" + r.value; });
         return h("div", {class: "wbudget"}, h("div", {class: "wbig"}, big, h("small", {text: "this week"})), r, h("div", {class: "wends"}, h("small", {text: "$20"}), h("small", {text: "$325"}))); }},
      {q: "Any dietary requirements?", sub: "Pick all that apply.",
       body: redraw => h("div", {class: "wgrid diets"}, ...DIETS.map(([k, e, n]) => tile(a.diets.includes(k), e, n, () => {
         a.diets = k === "none" ? ["none"] : toggle(a.diets.filter(x => x !== "none"), k); if (!a.diets.length) a.diets = ["none"]; redraw(); })))},
      {q: "Which meals should I plan?", ok: () => a.meals.length > 0,
       body: redraw => h("div", {class: "wgrid three"}, ...MEALS.map(([k, e, n]) => tile(a.meals.includes(k), e, n, () => { a.meals = toggle(a.meals, k); redraw(); })))},
      {q: "Which days should I plan?", ok: () => a.days.length > 0,
       body: redraw => h("div", {class: "wdays"}, h("div", {class: "wbig"}, h("b", {text: a.days.length}), h("small", {text: a.days.length === 1 ? "day" : "days"})),
         h("div", {class: "wdaylist"}, ...DAYS.map(d => h("button", {class: "wday" + (a.days.includes(d) ? " on" : ""), "aria-pressed": String(a.days.includes(d)), onclick: () => { a.days = toggle(a.days, d).sort((x, y) => DAYS.indexOf(x) - DAYS.indexOf(y)); redraw(); }, text: d}))))},
    ];
  }

  /* the screen: one question at a time, then "Building your meal plan" */
  function open({h, S, onDone, build}) {
    const a = JSON.parse(JSON.stringify({...DEFAULT, ...(S.get("answers") || {}), budget: (S.get("answers") || {}).budget || S.get("budget")}));
    const list = steps(h, a, S);
    let i = 0;
    const ov = h("div", {class: "wiz", role: "dialog", "aria-modal": "true", "aria-label": "Plan my week"});
    document.body.append(ov); document.body.classList.add("wizopen");
    const close = () => { ov.remove(); document.body.classList.remove("wizopen"); };
    const draw = () => {
      const st = list[i], ok = !st.ok || st.ok();
      const card = h("div", {class: "wcard"},
        h("div", {class: "wtop"}, h("button", {class: "wback", "aria-label": i ? "Back" : "Close", onclick: () => { if (i) { i--; draw(); } else close(); }, text: i ? "‹" : "✕"}),
          h("b", {class: "wbrand", text: "preprep"}), h("span", {class: "wring", style: `--p:${Math.round(100 * (i + 1) / list.length)}`, "aria-label": `Question ${i + 1} of ${list.length}`})),
        h("div", {class: "wmascot"}), h("div", {class: "wbubble"}, h("b", {text: st.q}), st.sub ? h("small", {text: st.sub}) : null),
        h("div", {class: "wbody"}, st.body(draw)), st.note && st.note() ? h("p", {class: "wnote", text: st.note()}) : null,
        h("button", {class: "wnext", disabled: !ok, onclick: () => { if (i < list.length - 1) { i++; draw(); } else finish(); }, text: i < list.length - 1 ? "Continue ›" : "Build my plan ›"}));
      card.querySelector(".wmascot").innerHTML = MASCOT;
      ov.replaceChildren(card);
      const first = card.querySelector(".wbody button, .wbody input"); if (first && document.activeElement === document.body) first.focus();
    };
    ov.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    async function finish() {
      S.set("answers", a); S.set("budget", a.budget); if (a.country !== "us" && S.get("units") === "us" && a.country !== "uk") S.set("units", "metric");
      const ring = h("div", {class: "wbuild"}), msg = h("small", {text: "Analysing your answers"});
      const card = h("div", {class: "wcard center"}, h("div", {class: "wbuildring"}, h("div", {class: "wmascot chef"}), ring),
        h("h2", {text: "Building your meal plan"}), msg);
      card.querySelector(".wmascot").innerHTML = MASCOT;
      ov.replaceChildren(card);
      const tell = [["Analysing your answers", 15], ["Picking meals for your diet", 35], ["Fitting them to your budget", 60], ["Writing your shopping list", 85]];
      let k = 0; const tick = setInterval(() => { if (k < tell.length) { msg.textContent = tell[k][0]; ring.style.setProperty("--p", tell[k][1]); k++; } }, 600);
      let result;
      try { result = await build(a); } catch (e) { result = {error: String(e.message || e)}; }
      await new Promise(r => setTimeout(r, Math.max(0, 2400 - k * 600)));
      clearInterval(tick); ring.style.setProperty("--p", 100);
      setTimeout(() => { close(); onDone(result); }, 350);
    }
    draw();
  }
  return {open, allowed, favScore, servingsFor, STORES, DIETS, MEALS};
})();
