/* PrepRep (screens by Claude), styled after the meal-planner apps Dilan picked. The thinking (calories, budget meal
   prep, groceries, workouts, schedule) is prepwise.py, built step by step by Dilan's Local AI; a feature whose
   function isn't built yet says which step it's waiting for and switches on once that step passes. */
{
  "use strict";
  const $ = id => document.getElementById(id);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "style") e.style.cssText = v; else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }
  const money = c => "$" + (c / 100).toFixed(2);
  const iso = d => d.toISOString().slice(0, 10);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], DAYNAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  const WORKOUT_DAYS = {1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5]};
  const COLORS = ["#d9a25f", "#8cbf6e", "#de8b6b", "#c2a676", "#7fb59a", "#cf7f57", "#a9c06a", "#e09a7c"];
  const FOCUS_COLORS = {Push: ["#ff7a59", "#e8453c"], Pull: ["#5b8def", "#3a5bd9"], Legs: ["#56b13f", "#2f8a3b"], "Full body": ["#a46bf0", "#6a45d6"]};

  /* ---- the brain (prepwise.py, built by the Local AI) ---- */
  const STEP = {bmr: "s1", start_tdee: "s2", daily_target: "s3", estimate_tdee: "s4", macros: "s5", plan_meals: "s6",
    grocery_list: "s7", build_workout: "s8", parse_equipment: "s8b", swap_options: "s8c", review_workout: "s8d", schedule: "s9", adherence: "s10"};
  class Missing extends Error {}
  async function brain(fn, ...args) {
    const r = await titan.call("logic", {fn, args});
    if (r && r.missing) throw new Missing(fn);
    if (!r || r.error) throw new Error(r && r.error || "No answer from the brain.");
    return r.ok;
  }
  const oops = (e, what) => h("div", {class: "waiting"}, h("b", {text: e instanceof Missing ? what : what + " didn't work"}),
    e instanceof Missing ? `Your Local AI is still building this part of PrepRep's brain (step ${STEP[e.message]}). It switches on by itself once that step passes.` : String(e.message || e));

  /* ---- data ---- */
  const S = titan.store("prepwise", {profile: null, units: "us", budget: 6000, portions: 10, picks: [], plan: null, got: [],
    workout: {days: 3, equipment: [], minutes: 40}, free: [["Mon", "18:00", "19:30"], ["Wed", "18:00", "19:30"], ["Fri", "18:00", "19:30"], ["Sun", "10:00", "14:00"]],
    weighins: [], done: {}, prices: {}});
  let RECIPES = [], EXERCISES = [], CREDITS = {};
  /* units: everything is stored metric (the brain works in kg and cm); people see and type pounds and feet if they like */
  const US = () => (S.get("units") || "us") === "us";
  const LB = 2.20462;
  const showW = kg => US() ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 10) / 10;
  const wUnit = () => US() ? "lb" : "kg";
  const toKg = v => US() ? +v / LB : +v;
  const ftIn = cm => { const t = Math.round(cm / 2.54); return [Math.floor(t / 12), t % 12]; };
  const byName = n => RECIPES.find(r => r.name === n), byId = id => RECIPES.find(r => r.id === id);
  const cost = r => S.get("prices")[r.id] ?? r.cost_cents;
  const colorOf = r => COLORS[RECIPES.indexOf(r) % COLORS.length];
  function photo(el, r) { const img = new Image(); img.onload = () => { el.style.backgroundImage = `url(photos/${r.id}.jpg)`; const m = el.querySelector(".mono"); if (m) m.remove(); }; img.src = `photos/${r.id}.jpg`; }
  const CATS = [["high", "High Protein", r => r.tags.includes("high-protein")], ["budget", "Budget Friendly", r => r.tags.includes("budget")],
    ["quick", "30 Minute", r => r.minutes <= 30], ["veg", "Vegetarian", r => r.tags.includes("vegetarian")], ["breakfast", "Breakfast", r => r.tags.includes("breakfast")],
    ["prep", "Classic Meal Prep", r => r.tags.includes("classic prep") || r.servings >= 5]];

  /* ---- navigation ---- */
  let tab = "plans", stack = [];
  const VIEWS = {};
  async function go(view, arg, push = true) {
    if (push && stack.length && stack[stack.length - 1][0] === view && stack[stack.length - 1][1] === arg) return;
    if (push) stack.push([view, arg]);
    $("back").hidden = stack.length < 2;
    const main = $("main"); main.replaceChildren(); window.scrollTo({top: 0});
    if (!S.get("profile") && view !== "you") return VIEWS.you(main, true);
    await VIEWS[view](main, arg);
    drawBuildbar();
  }
  function goTab(t) {
    tab = t; stack = [];
    document.querySelectorAll(".tabs button").forEach(b => { b.classList.toggle("on", b.dataset.tab === t); b.toggleAttribute("aria-current", b.dataset.tab === t); });
    go(t);
  }
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => goTab(b.dataset.tab)));
  $("back").addEventListener("click", () => { stack.pop(); const [v, a] = stack[stack.length - 1] || [tab]; go(v, a, false); $("back").hidden = stack.length < 2; });
  $("search-btn").addEventListener("click", () => go("search"));

  /* ---- food cards ---- */
  function foodCard(r) {
    const on = S.get("picks").includes(r.id);
    const ph = h("div", {class: "ph", style: `--c:${colorOf(r)}`}, h("span", {class: "mono", "aria-hidden": "true", text: r.name[0]}));
    if (r.tags.includes("high-protein")) ph.append(h("span", {class: "badge", text: `${r.protein}g PROTEIN`}));
    else if (r.tags.includes("budget")) ph.append(h("span", {class: "badge", text: "BUDGET"}));
    const plus = h("button", {class: "plus", "aria-pressed": String(on), "aria-label": (on ? "Remove " : "Add ") + r.name, text: "+"});
    ph.append(plus); photo(ph, r);
    const card = h("div", {class: "food" + (on ? " on" : ""), "data-id": r.id, role: "listitem"}, ph, h("b", {text: r.name}), h("small", {text: `${money(cost(r))} · ${r.servings} servings · ${r.minutes} min`}));
    plus.addEventListener("click", e => { e.stopPropagation(); togglePick(r.id); });
    card.addEventListener("click", () => go("recipe", r.id));
    return card;
  }
  function togglePick(id) {
    const p = new Set(S.get("picks")); p.has(id) ? p.delete(id) : p.add(id); S.set("picks", [...p]);
    document.querySelectorAll(`.food[data-id="${id}"]`).forEach(c => { const on = p.has(id), b = c.querySelector(".plus");
      c.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", (on ? "Remove " : "Add ") + byId(id).name); });
    drawBuildbar();
  }
  function drawBuildbar() {
    const picks = S.get("picks"), bar = $("buildbar");
    bar.hidden = tab !== "plans" || !picks.length;
    $("thumbs").replaceChildren(...picks.slice(-4).map(id => { const r = byId(id), s = h("span", {style: `--c:${colorOf(r)}`}); photo(s, r); return s; }));
    $("build").textContent = `Build plan (${picks.length})`;
  }
  $("build").addEventListener("click", () => buildPlan());
  async function buildPlan() {
    const picks = S.get("picks"), pool = (picks.length ? picks.map(byId) : RECIPES).filter(Boolean).slice(0, 8)
      .map(r => ({name: r.name, servings: r.servings, cost_cents: cost(r), protein: r.protein}));
    try {
      const plan = await brain("plan_meals", pool, S.get("budget"), S.get("portions"));
      if (!plan) { titan.toast("Nothing fits your budget. Raise it or prep fewer servings in You.", "warn"); return; }
      S.set("plan", plan); S.set("got", []); $("list-dot").hidden = false;
      titan.toast(`Planned ${plan.servings} servings for ${money(plan.cost)}`); goTab("plans");
    } catch (e) { titan.toast(e instanceof Missing ? "Your AI is still building the meal planner (step s6)." : String(e.message), "warn"); }
  }

  /* ---- Meal Plans (home) ---- */
  VIEWS.plans = async main => {
    main.append(h("h1", {text: "Build a meal plan"}));
    const plan = S.get("plan");
    const first = plan ? byName(plan.recipes[0]) : RECIPES[0];
    const ph = h("div", {class: "ph", style: `--c:${colorOf(first)}`}, h("div", {class: "label"}, h("b", {text: plan ? "This Week" : "Your week"}), h("small", {text: weekRange()})));
    photo(ph, first);
    const info = h("div", {class: "info"});
    if (plan) {
      const pct = Math.min(100, Math.round(100 * plan.cost / S.get("budget")));
      info.append(h("h3", {text: "Meal prep plan"}),
        h("div", {class: "stats"}, h("div", {}, h("b", {text: money(plan.cost)}), h("small", {text: `of ${money(S.get("budget"))} budget`})),
          h("div", {}, h("b", {text: plan.servings}), h("small", {text: "servings"})), h("div", {}, h("b", {text: Math.round(plan.protein / plan.servings) + "g"}), h("small", {text: "protein each"}))),
        h("div", {class: "bar"}, h("i", {style: `width:${pct}%`})),
        ...[...new Set(plan.recipes)].map(n => h("div", {class: "muted", text: `${plan.recipes.filter(x => x === n).length}× ${n}`})),
        h("div", {style: "display:flex;gap:10px;margin-top:auto"}, h("button", {class: "btn", onclick: () => goTab("list"), text: "Shopping list"}), h("button", {class: "btn line", onclick: buildPlan, text: "Re-plan"})));
    } else {
      info.append(h("h3", {text: "Plan your week"}), h("p", {class: "muted", style: "margin:0", text: `Tap + on meals you like, then Build plan. PrepRep fits them into your ${money(S.get("budget"))} weekly budget.`}),
        h("button", {class: "btn", style: "margin-top:auto;align-self:flex-start", onclick: buildPlan, text: "Build my plan"}));
    }
    main.append(h("div", {class: "hero"}, ph, info));
    for (const [key, name] of [["high", "Most Protein"], ["budget", "Budget Friendly"], ["quick", "30 Minute Meals"]]) {
      const keep = CATS.find(c => c[0] === key)[2], list = RECIPES.filter(keep);
      main.append(h("div", {class: "sec"}, h("h2", {text: name}), h("button", {class: "seeall", onclick: () => go("category", key), text: "See All"})),
        h("div", {class: "row", role: "list", "aria-label": name}, ...list.map(foodCard)));
    }
    main.append(h("div", {class: "sec"}, h("h2", {text: "Meal plan options"})));
    main.append(h("div", {class: "tiles"}, ...CATS.map(([key, name, keep]) => {
      const r = RECIPES.find(keep) || RECIPES[0], t = h("button", {class: "tile", style: `--c:${colorOf(r)}`, onclick: () => go("category", key)}, h("i", {class: "mono", "aria-hidden": "true", text: name[0]}), h("span", {text: name}));
      photo(t, r); return t;
    }), h("button", {class: "tile more", onclick: () => go("category", "all")}, h("span", {text: "And more!"}))));
  };
  function weekRange() { const a = new Date(); a.setDate(a.getDate() - todayIdx()); const b = new Date(a); b.setDate(a.getDate() + 6);
    const f = d => d.toLocaleDateString(undefined, {month: "long", day: "numeric"}); return `${f(a)} – ${f(b)}`; }

  VIEWS.category = async (main, key) => {
    const cat = CATS.find(c => c[0] === key), list = cat ? RECIPES.filter(cat[2]) : RECIPES;
    main.append(h("h1", {text: cat ? cat[1] : "All meals"}), h("div", {class: "grid", role: "list"}, ...list.map(foodCard)));
  };
  VIEWS.search = async main => {
    const box = h("input", {class: "searchbox", type: "search", placeholder: "Search meals or ingredients", "aria-label": "Search meals"});
    const out = h("div", {class: "grid", role: "list", style: "margin-top:20px"});
    const run = () => { const q = box.value.trim().toLowerCase();
      out.replaceChildren(...RECIPES.filter(r => !q || r.name.toLowerCase().includes(q) || r.ingredients.some(i => i.item.toLowerCase().includes(q)) || r.tags.some(t => t.includes(q))).map(foodCard)); };
    box.addEventListener("input", run);
    main.append(h("h1", {text: "Search"}), box, out); run(); setTimeout(() => box.focus(), 50);
  };
  VIEWS.recipe = async (main, id) => {
    const r = byId(id), on = S.get("picks").includes(id);
    const ph = h("div", {class: "ph", style: `--c:${colorOf(r)}`}, h("div", {class: "label"}, h("b", {text: `${r.minutes} min`}), h("small", {text: `${r.servings} servings`}))); photo(ph, r);
    main.append(h("h1", {text: r.name}), h("div", {class: "hero"}, ph, h("div", {class: "info"},
      h("div", {class: "stats"}, h("div", {}, h("b", {text: r.kcal}), h("small", {text: "kcal / serving"})), h("div", {}, h("b", {text: r.protein + "g"}), h("small", {text: "protein"})), h("div", {}, h("b", {text: money(cost(r))}), h("small", {text: "whole batch"}))),
      h("p", {class: "muted", style: "margin:0", text: "Nutrition and prices are estimates. Set your store's prices in You."}),
      h("button", {class: on ? "btn line" : "btn", style: "margin-top:auto", onclick: () => { togglePick(id); go("recipe", id, false); }, text: on ? "Remove from my plan" : "Add to my plan"}))));
    main.append(h("div", {class: "sec"}, h("h2", {text: "Ingredients"})), h("div", {class: "list"}, ...r.ingredients.map(i => h("div", {class: "li"}, h("div", {class: "tx"}, h("b", {text: i.item}), h("small", {text: `${i.qty} ${i.unit} · ${i.aisle}`}))))));
    const c = CREDITS[id]; if (c) main.append(h("p", {class: "credits"}, `Photo: ${c.artist}, ${c.license}, Wikimedia Commons (`, h("a", {href: c.page, target: "_blank", rel: "noopener", text: "source"}), ")"));
  };

  /* ---- List ---- */
  VIEWS.list = async main => {
    $("list-dot").hidden = true;
    main.append(h("h1", {text: "Shopping List"}));
    const plan = S.get("plan");
    if (!plan) { main.append(h("p", {class: "muted", text: "Build a meal plan and everything you need shows up here, by aisle."}), h("button", {class: "btn", onclick: () => goTab("plans"), text: "Build a meal plan"})); return; }
    main.append(h("p", {class: "muted", text: `About ${money(plan.cost)} for ${plan.servings} servings.`}));
    try {
      const items = await brain("grocery_list", plan.recipes.map(byName).filter(Boolean).map(r => ({ingredients: r.ingredients})));
      const got = new Set(S.get("got")); let aisle = "", list = null;
      items.forEach((it, i) => {
        if (it.aisle !== aisle) { aisle = it.aisle; main.append(h("div", {class: "aisle", text: aisle})); list = h("div", {class: "list"}); main.append(list); }
        const key = it.item + "|" + it.unit, cb = h("input", {type: "checkbox", id: "g" + i}); cb.checked = got.has(key);
        const row = h("label", {class: "li" + (cb.checked ? " done" : ""), for: "g" + i}, cb, h("div", {class: "tx"}, h("b", {text: it.item}), h("small", {text: `${it.qty} ${it.unit}`})));
        cb.addEventListener("change", () => { cb.checked ? got.add(key) : got.delete(key); S.set("got", [...got]); row.classList.toggle("done", cb.checked); });
        list.append(row);
      });
    } catch (e) { main.append(oops(e, "Your combined shopping list")); }
  };

  /* ---- Workouts ----
     People choose: tell PrepRep their equipment (chips, or in their own words), then either let it build the week
     or pick every exercise themselves. Swap any exercise, and "Check my workout" gives plain tips.
     The thinking is prepwise.py (Local AI): build_workout, parse_equipment, swap_options, review_workout. */
  let selDay = todayIdx(), swapFor = null;
  const EQUIP = [["dumbbells", "Dumbbells"], ["barbell", "Barbell"], ["pull-up bar", "Pull-up bar"], ["bands", "Bands"],
    ["kettlebell", "Kettlebell"], ["bench", "Bench"], ["machines", "Gym machines"]];
  const exList = () => EXERCISES.map(({name, muscle, equipment, minutes}) => ({name, muscle, equipment, minutes}));
  const setW = patch => S.set("workout", {...S.get("workout"), ...patch});
  function setupCard(w) {
    const chips = h("div", {class: "chips", role: "group", "aria-label": "Your equipment"},
      h("span", {class: "chip on fixed", title: "Always included", text: "Bodyweight"}),
      ...EQUIP.map(([k, label]) => { const on = w.equipment.includes(k);
        return h("button", {class: "chip" + (on ? " on" : ""), "aria-pressed": String(on), onclick: () => {
          const eq = new Set(S.get("workout").equipment); on ? eq.delete(k) : eq.add(k); setW({equipment: EQUIP.map(x => x[0]).filter(x => eq.has(x))}); go("train", null, false); }, text: label}); }));
    const say = h("input", {id: "eqtext", placeholder: "Or just tell us: \"dumbbells and a pull-up bar\", \"I go to the gym\"", "aria-label": "Describe your equipment"});
    const use = h("button", {class: "btn small", text: "Use this", onclick: async () => {
      const t = say.value.trim(); if (!t) return say.focus();
      try { const tags = await brain("parse_equipment", t); setW({equipment: tags}); titan.toast(tags.length ? "Got it: " + tags.map(x => EQUIP.find(e => e[0] === x)[1]).join(", ") : "Got it: bodyweight only"); go("train", null, false); }
      catch (e) { titan.toast(e instanceof Missing ? "Your Local AI is still building this (step s8b). Use the buttons for now." : String(e.message || e)); } }});
    say.addEventListener("keydown", e => { if (e.key === "Enter") use.click(); });
    const sel = (id, opts, v, key) => { const s = h("select", {id, "aria-label": id}, ...opts.map(([val, t]) => { const o = h("option", {value: val, text: t}); o.selected = String(val) === String(v); return o; }));
      s.addEventListener("change", () => { setW({[key]: +s.value}); go("train", null, false); }); return s; };
    return h("div", {class: "setup"},
      h("div", {class: "setuprow"}, h("b", {text: "What you have"}), chips),
      h("div", {class: "setuprow say"}, say, use),
      h("div", {class: "setuprow"}, h("b", {text: "Your week"}),
        sel("Workouts a week", [1, 2, 3, 4, 5, 6].map(n => [n, `${n} day${n > 1 ? "s" : ""}`]), w.days, "days"),
        sel("Minutes a workout", [20, 30, 40, 45, 50, 60, 75, 90].map(n => [n, `${n} min`]), w.minutes, "minutes")),
      h("div", {class: "seg", role: "tablist", "aria-label": "Who picks the exercises"},
        ...[["auto", "Build it for me"], ["custom", "I'll pick my own"]].map(([k, t]) => h("button", {role: "tab", "aria-selected": String((w.mode || "auto") === k), class: (w.mode || "auto") === k ? "on" : "",
          onclick: () => { const cur = S.get("workout"); if (k === "custom" && !(cur.custom || []).length && lastAuto) setW({mode: k, custom: lastAuto.map(d => [...d])}); else setW({mode: k}); go("train", null, false); }, text: t}))));
  }
  let lastAuto = null;
  VIEWS.train = async main => {
    const w = S.get("workout"), when = WORKOUT_DAYS[w.days] || [];
    const FOCUS = w.days <= 2 ? () => "Full body" : i => ["Push", "Pull", "Legs"][i % 3];
    main.append(h("h1", {text: "Workouts"}), setupCard(w));
    const custom = (w.mode || "auto") === "custom";
    let plan;
    if (custom) {
      plan = Array.from({length: when.length}, (_, i) => [...((w.custom || [])[i] || [])]);
    } else {
      try { plan = await brain("build_workout", exList(), w.days, w.equipment, w.minutes); lastAuto = plan; }
      catch (e) { main.append(oops(e, "Your weekly workout"), h("p", {class: "muted", text: "Meanwhile you can pick your own exercises: choose \"I'll pick my own\" above."})); return; }
    }
    let times = [];
    try { times = await placeWeek(when, FOCUS); } catch (e) { /* schedule step not built yet */ }
    const strip = h("div", {class: "days", role: "list"});
    DAYS.forEach((d, i) => {
      const wi = when.indexOf(i), f = wi >= 0 ? FOCUS(wi) : null, [c1, c2] = f ? FOCUS_COLORS[f] : ["", ""];
      const at = times.find(p => p.day === d && p.task.startsWith("Workout"));
      strip.append(h("button", {class: "daycard" + (f ? "" : " rest") + (i === selDay ? " sel" : ""), style: f ? `--c1:${c1};--c2:${c2}` : "", "aria-pressed": String(i === selDay),
        onclick: () => { selDay = i; swapFor = null; go("train", null, false); }}, h("small", {text: i === todayIdx() ? `${d} · Today` : d}), h("b", {text: f || "Rest"}),
        f ? h("span", {class: "mins", text: at ? `${at.start}–${at.end}` : `${w.minutes} min`}) : null));
    });
    main.append(strip);
    const wi = when.indexOf(selDay);
    main.append(h("div", {class: "sec"}, h("h2", {text: wi >= 0 ? `${DAYNAMES[selDay]} · ${FOCUS(wi)}` : `${DAYNAMES[selDay]} · Rest day`})));
    const saveCustom = p => setW({mode: "custom", custom: p});
    if (wi < 0) { main.append(h("p", {class: "muted", text: "Recovery is part of training. Walk, stretch, sleep well."})); }
    else {
      const names = plan[wi] || [];
      const id = `workout-${selDay}`, done = (S.get("done")[weekKey()] || []).includes(id);
      const total = names.reduce((t, n) => t + ((EXERCISES.find(x => x.name === n) || {}).minutes || 0), 0);
      const list = h("div", {class: "list"});
      names.forEach((n, k) => {
        const ex = EXERCISES.find(x => x.name === n) || {};
        const row = h("div", {class: "li"}, h("span", {class: "ic", style: `--c:${FOCUS_COLORS[FOCUS(wi)][0]}`, text: k + 1}),
          h("div", {class: "tx"}, h("b", {text: n}), h("small", {text: ex.how || ""})), h("span", {class: "muted", text: `${ex.minutes || "?"} min`}),
          h("button", {class: "mini", "aria-label": "Swap " + n, onclick: () => { swapFor = swapFor === n ? null : n; go("train", null, false); }, text: "Swap"}),
          custom ? h("button", {class: "mini x", "aria-label": "Remove " + n, onclick: () => { const p = plan.map(d => [...d]); p[wi].splice(k, 1); saveCustom(p); go("train", null, false); }, text: "✕"}) : null);
        list.append(row);
        if (swapFor === n) {
          const box = h("div", {class: "swapbox"}, h("small", {class: "muted", text: "Loading swaps…"})); list.append(box);
          brain("swap_options", exList(), n, w.equipment).then(opts => {
            box.replaceChildren(opts.length ? h("small", {class: "muted", text: "Swap for (same muscles, your equipment):"}) : h("small", {class: "muted", text: "No other exercise for these muscles with your equipment. Add equipment above for more choices."}),
              ...opts.filter(o => !names.includes(o)).map(o => h("button", {class: "chip", onclick: () => { const p = plan.map(d => [...d]); p[wi][k] = o; swapFor = null; saveCustom(p); titan.toast("Swapped. Your changes are kept as your own plan."); go("train", null, false); }, text: o})));
          }).catch(e => box.replaceChildren(h("small", {class: "muted", text: e instanceof Missing ? "Swaps switch on when your Local AI finishes step s8c." : String(e.message || e)})));
        }
      });
      if (!names.length) list.append(h("p", {class: "muted", style: "padding:14px 0", text: custom ? "Nothing here yet. Add exercises below." : "Nothing fits this day with your time and equipment. Try more minutes or add equipment."}));
      main.append(list, h("p", {class: total > w.minutes ? "warn" : "muted", style: "margin:8px 0 0", text: `${total} of your ${w.minutes} minutes`}));
      if (custom) {
        const muscle = FOCUS(wi) === "Full body" ? null : FOCUS(wi).toLowerCase();
        const have = new Set(["none", ...w.equipment]);
        const pool = EXERCISES.filter(x => have.has(x.equipment) && !names.includes(x.name));
        const groups = ["push", "pull", "legs"].map(m => [m, pool.filter(x => x.muscle === m)]).filter(([m, xs]) => xs.length);
        main.append(h("div", {class: "addbox"}, h("b", {text: "Add an exercise"}), h("small", {class: "muted", text: muscle ? ` Today is ${FOCUS(wi)}; those come first.` : " Full body: mix push, pull and legs."}),
          ...groups.sort(([a], [b]) => (b === muscle) - (a === muscle)).map(([m, xs]) => h("div", {class: "addgrp"}, h("small", {class: "lab", text: m[0].toUpperCase() + m.slice(1)}),
            ...xs.map(x => h("button", {class: "chip", onclick: () => { const p = plan.map(d => [...d]); p[wi].push(x.name); saveCustom(p); go("train", null, false); }, text: `+ ${x.name} · ${x.minutes}m`}))))));
      }
      main.append(h("button", {class: done ? "btn line" : "btn", style: "margin-top:18px", onclick: () => { setDone(id, !done); if (!done) titan.toast("Workout done. Strong work."); go("train", null, false); }, text: done ? "Done ✓" : "Mark workout done"}));
    }
    // check the whole week
    const rev = h("div", {class: "review"}, h("h2", {text: "Check my workout"}), h("small", {class: "muted", text: "Checking your week…"}));
    main.append(rev);
    brain("review_workout", exList(), plan, w.minutes).then(tips => {
      rev.replaceChildren(h("h2", {text: "Check my workout"}), tips.length ? h("ul", {class: "tips"}, ...tips.map(t => h("li", {text: t})))
        : h("p", {class: "good", text: "✓ Looks balanced: push, pull and legs are covered and every day fits your time."}));
    }).catch(e => rev.replaceChildren(h("h2", {text: "Check my workout"}), h("p", {class: "muted", text: e instanceof Missing ? "Tips switch on when your Local AI finishes step s8d." : String(e.message || e)})));
    const prep = times.find(p => p.task === "Meal prep");
    if (prep) main.append(h("p", {class: "muted", style: "margin-top:22px", text: `Meal prep is set for ${prep.day} ${prep.start}–${prep.end}.`}));
  };
  async function placeWeek(when, FOCUS) {
    const order = s => DAYS.indexOf(s[0]) * 1440 + (+s[1].slice(0, 2)) * 60 + (+s[1].slice(3));
    const left = S.get("free").map(f => [...f]).sort((x, y) => order(x) - order(y)), out = [], w = S.get("workout");
    const place = async (task, slots) => { const r = await brain("schedule", slots, [task]); if (!r.placed.length) return false;
      const p = r.placed[0]; out.push(p); const s = left.find(x => x[0] === p.day && x[1] <= p.start && x[2] >= p.end); if (s) s[1] = p.end; return true; };
    for (let i = 0; i < when.length; i++) { const t = [`Workout · ${FOCUS(i)}`, w.minutes]; if (!(await place(t, left.filter(x => x[0] === DAYS[when[i]])))) await place(t, left); }
    if (S.get("plan")) await place(["Meal prep", Math.min(240, 30 + 30 * new Set(S.get("plan").recipes).size)], left);
    return out;
  }
  const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - todayIdx()); return iso(d); };
  function setDone(id, on) { const all = S.get("done"), cur = new Set(all[weekKey()] || []); on ? cur.add(id) : cur.delete(id); all[weekKey()] = [...cur]; S.set("done", all); }

  /* ---- Progress ---- */
  async function targets() {
    const p = S.get("profile");
    const base = await brain("bmr", p.sex, +p.age, +p.height_cm, +p.weight_kg), start = await brain("start_tdee", base, p.activity);
    let burn = start, learned = false;
    try { const log = S.get("weighins").slice(-28).map((w, i) => [i, +w.weight, +w.kcal]); const est = log.length >= 7 ? await brain("estimate_tdee", log) : null; if (est) { burn = est; learned = true; } }
    catch (e) { if (!(e instanceof Missing)) throw e; }
    const target = await brain("daily_target", burn, p.goal, p.sex, +p.rate || 0.5);
    $("kcal").textContent = target.toLocaleString(); $("kcalchip").hidden = false;
    return {target, burn, learned};
  }
  VIEWS.progress = async main => {
    main.append(h("h1", {text: "Progress"}));
    const top = h("div", {class: "grid"}); main.append(top);
    try {
      const t = await targets();
      top.append(h("div", {class: "panel"}, h("small", {class: "muted", text: "Eat each day"}), h("div", {class: "big", text: t.target.toLocaleString()}), h("small", {class: "muted", text: "kcal"})),
        h("div", {class: "panel"}, h("small", {class: "muted", text: "You burn"}), h("div", {class: "big", text: t.burn.toLocaleString()}), h("span", {class: "pill", text: t.learned ? "Learned from your weigh-ins" : "Starting estimate"})));
      try { const m = await brain("macros", t.target, +S.get("profile").weight_kg, S.get("profile").goal);
        top.append(h("div", {class: "panel"}, h("small", {class: "muted", text: "Protein · carbs · fat"}), h("div", {class: "big", style: "font-size:32px", text: `${m.protein}g · ${m.carbs}g · ${m.fat}g`}))); }
      catch (e) { if (!(e instanceof Missing)) top.append(oops(e, "Macros")); }
    } catch (e) { top.append(oops(e, "Your daily calories")); }
    const form = h("form", {class: "form panel", style: "margin-top:20px", novalidate: true},
      h("label", {for: "weight"}, `Weight this morning (${wUnit()})`, h("input", {id: "weight", type: "number", step: "0.1"})),
      h("label", {for: "eaten"}, "Calories eaten yesterday", h("input", {id: "eaten", type: "number", step: "10"})),
      h("label", {}, " ", h("button", {class: "btn", text: "Save weigh-in"})));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const v = titan.validate(form, {weight: s => toKg(s) >= 30 && toKg(s) <= 300 ? "" : US() ? "Weight in pounds, 66 to 660." : "Weight in kg, 30 to 300.", eaten: s => +s >= 500 && +s <= 8000 ? "" : "A rough number, 500 to 8000."});
      if (!v) return;
      const log = S.get("weighins").filter(w => w.date !== iso(new Date())); log.push({date: iso(new Date()), weight: Math.round(toKg(v.weight) * 100) / 100, kcal: +v.eaten}); S.set("weighins", log);
      titan.toast("Saved. Consistency beats perfection."); go("progress", null, false);
    });
    main.append(form, h("div", {class: "sec"}, h("h2", {text: "Weight trend"})), h("div", {class: "chart panel", id: "wchart"}));
    const log = S.get("weighins");
    if (log.length < 2) titan.state($("wchart"), "empty", {title: "Two weigh-ins and your trend appears here"});
    else titan.chart($("wchart"), {type: "line", title: `Weight (${wUnit()})`, data: log.slice(-30).map(w => ({label: w.date.slice(5), value: showW(w.weight)}))});
    main.append(h("p", {class: "muted", text: log.length >= 7 ? "A week of data: your calories now use your real burn." : `${7 - log.length} more weigh-in${7 - log.length === 1 ? "" : "s"} until PrepRep learns your real burn.`}));
  };

  /* ---- You ---- */
  VIEWS.you = async (main, first) => {
    const p = S.get("profile") || {sex: "male", age: "", height_cm: "", weight_kg: "", goal: "lose", activity: "light", rate: 0.5, name: ""}, w = S.get("workout");
    const sel = (id, opts, val) => h("select", {id}, ...opts.map(([v, t]) => { const o = h("option", {value: v, text: t}); o.selected = String(v) === String(val); return o; }));
    main.append(h("h1", {text: first ? "Welcome to PrepRep" : "You"}), first ? h("p", {class: "muted", text: "A few details and PrepRep plans your meals, calories and workouts. Everything stays on this PC."}) : null);
    const form = h("form", {class: "form", novalidate: true},
      h("label", {for: "name"}, "First name (optional)", h("input", {id: "name", value: p.name || ""})),
      h("label", {for: "sex"}, "Body (for the calorie formula)", sel("sex", [["male", "Male"], ["female", "Female"]], p.sex)),
      h("label", {for: "age"}, "Age", h("input", {id: "age", type: "number", value: p.age})),
      h("label", {for: "units"}, "Units", (() => { const u = sel("units", [["us", "Pounds, feet and inches"], ["metric", "Kilograms and centimetres"]], S.get("units") || "us");
        u.addEventListener("change", () => { S.set("units", u.value); go("you", null, false); }); return u; })()),
      US() ? h("label", {for: "height_ft"}, "Height", h("span", {class: "pair"},
          h("input", {id: "height_ft", type: "number", min: "3", max: "8", value: p.height_cm ? ftIn(p.height_cm)[0] : "", "aria-label": "Feet"}), h("span", {class: "unit", text: "ft"}),
          h("input", {id: "height_in", type: "number", min: "0", max: "11", value: p.height_cm ? ftIn(p.height_cm)[1] : "", "aria-label": "Inches"}), h("span", {class: "unit", text: "in"})))
        : h("label", {for: "height_cm"}, "Height (cm)", h("input", {id: "height_cm", type: "number", value: p.height_cm})),
      h("label", {for: "weight_kg"}, `Weight (${wUnit()})`, h("input", {id: "weight_kg", type: "number", step: "0.1", value: p.weight_kg ? showW(p.weight_kg) : ""})),
      h("label", {for: "goal"}, "Goal", sel("goal", [["lose", "Lose fat"], ["maintain", "Stay the same"], ["gain", "Build muscle"]], p.goal)),
      h("label", {for: "activity"}, "Daily activity", sel("activity", [["sedentary", "Mostly sitting"], ["light", "Light (some walking)"], ["moderate", "On my feet / training 3x"], ["active", "Training most days"], ["very", "Physical job + training"]], p.activity)),
      h("label", {for: "rate"}, "If losing: how fast", (() => { const opts = US() ? [[0.227, "Gently (0.5 lb a week)"], [0.454, "Steady (1 lb a week)"], [0.68, "Faster (1.5 lb a week)"]]
          : [[0.25, "Gently (0.25 kg a week)"], [0.5, "Steady (0.5 kg a week)"], [0.75, "Faster (0.75 kg a week)"]];
        const near = opts.reduce((a, o) => Math.abs(o[0] - (+p.rate || 0.5)) < Math.abs(a[0] - (+p.rate || 0.5)) ? o : a)[0]; return sel("rate", opts, near); })()),
      h("label", {for: "budget"}, "Weekly grocery budget ($)", h("input", {id: "budget", type: "number", value: S.get("budget") / 100})),
      h("label", {for: "portions"}, "Servings to prep a week", h("input", {id: "portions", type: "number", value: S.get("portions")})),
      h("label", {for: "w-days"}, "Workouts a week", sel("w-days", [1, 2, 3, 4, 5, 6].map(n => [n, `${n} day${n > 1 ? "s" : ""}`]), w.days)),
      h("label", {for: "w-min"}, "Minutes a workout", sel("w-min", [20, 30, 40, 50, 60].map(n => [n, `${n} min`]), w.minutes)),
      h("label", {}, " ", h("button", {class: "btn", text: first ? "Get started" : "Save"})));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const v = titan.validate(form, {age: s => +s >= 13 && +s <= 100 && Number.isInteger(+s) ? "" : "Age must be a whole number from 13 to 100.",
        ...(US() ? {height_ft: s => +s >= 3 && +s <= 8 && Number.isInteger(+s) ? "" : "Feet: a whole number from 3 to 8.", height_in: s => s === "" || (+s >= 0 && +s < 12) ? "" : "Inches: 0 to 11."}
                 : {height_cm: s => +s >= 100 && +s <= 250 ? "" : "Height in cm, 100 to 250."}),
        weight_kg: s => toKg(s) >= 30 && toKg(s) <= 300 ? "" : US() ? "Weight in pounds, 66 to 660." : "Weight in kg, 30 to 300.",
        budget: s => +s >= 5 ? "" : "At least $5.", portions: s => +s >= 1 && +s <= 21 ? "" : "1 to 21 servings."});
      if (!v) return;
      const all = {}; form.querySelectorAll("input[id], select[id]").forEach(el => { all[el.id] = el.value; });
      const cm = US() ? Math.round(((+all.height_ft) * 12 + (+all.height_in || 0)) * 2.54) : +all.height_cm;
      S.set("profile", {name: all.name, sex: all.sex, age: +all.age, height_cm: cm, weight_kg: Math.round(toKg(all.weight_kg) * 10) / 10, goal: all.goal, activity: all.activity, rate: +all.rate});
      S.set("budget", Math.round(+all.budget * 100)); S.set("portions", Math.round(+all.portions));
      S.set("workout", {...S.get("workout"), days: +all["w-days"], minutes: +all["w-min"]});   // equipment is set on the Workouts tab
      titan.toast(first ? "You're all set." : "Saved"); targets().catch(() => {}); goTab("plans");
    });
    main.append(form);
    if (first) return;
    main.append(h("div", {class: "sec"}, h("h2", {text: "When you're free"}), h("button", {class: "seeall", onclick: () => { const f = S.get("free"); f.push(["Sat", "09:00", "10:00"]); S.set("free", f); go("you", null, false); }, text: "Add time"})));
    const free = S.get("free"), fl = h("div", {class: "list"});
    free.forEach((f, i) => {
      const d = h("select", {"aria-label": "Day", style: "width:100px"}, ...DAYS.map(x => { const o = h("option", {text: x}); o.selected = x === f[0]; return o; }));
      const a = h("input", {type: "time", value: f[1], "aria-label": "From"}), b = h("input", {type: "time", value: f[2], "aria-label": "To"});
      [d, a, b].forEach(x => x.addEventListener("change", () => { free[i] = [d.value, a.value, b.value]; S.set("free", free); }));
      fl.append(h("div", {class: "li"}, d, a, b, h("button", {class: "seeall", style: "margin-left:auto", onclick: () => { free.splice(i, 1); S.set("free", free); go("you", null, false); }, text: "Remove"})));
    });
    main.append(fl, h("div", {class: "sec"}, h("h2", {text: "Prices at your store"})));
    const pl = h("div", {class: "list"});
    RECIPES.forEach(r => {
      const inp = h("input", {type: "number", step: "0.01", value: (cost(r) / 100).toFixed(2), "aria-label": `Price of ${r.name}`, style: "max-width:120px"});
      inp.addEventListener("change", () => { const all = S.get("prices"); all[r.id] = Math.round(+inp.value * 100); S.set("prices", all); });
      const ic = h("span", {class: "ic", style: `--c:${colorOf(r)}`, text: r.name[0]}); photo(ic, r);
      pl.append(h("div", {class: "li"}, ic, h("div", {class: "tx"}, h("b", {text: r.name}), h("small", {text: `${r.servings} servings`})), inp));
    });
    main.append(pl);
    const ids = Object.keys(CREDITS);
    main.append(h("div", {class: "sec"}, h("h2", {text: "Photo credits"})), h("div", {class: "credits"}, ids.length ? ids.map(id => { const c = CREDITS[id], r = byId(id);
      return h("p", {}, `${r ? r.name : id}: ${c.artist}, ${c.license}, Wikimedia Commons (`, h("a", {href: c.page, target: "_blank", rel: "noopener", text: "source"}), ")"); }) : h("p", {text: "No photos are packed in this build."})));
  };

  /* ---- start ---- */
  (async () => {
    const load = f => fetch(f).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const [rec, ex, cr] = await Promise.all([load("data/recipes.json"), load("data/exercises.json"), load("photos/credits.json"), S.ready]);
    RECIPES = rec.recipes || []; EXERCISES = ex.exercises || []; CREDITS = cr || {};
    if (S.get("profile")) targets().catch(() => {});
    goTab("plans");
  })();
}
