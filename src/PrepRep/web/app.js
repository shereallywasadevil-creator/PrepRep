/* PrepRep (screens by Claude). One week board instead of pages: meals and workouts live on their day.
   The thinking (calories, budget meal prep, groceries, workouts, schedule) is prepwise.py, built step by step by
   Dilan's Local AI; a feature whose function isn't built yet says which step it's waiting for. */
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
  const SVGNS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs, ...kids) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); kids.forEach(k => e.append(k)); return e; };
  function ring(used, total) {
    const r = 23, c = 2 * Math.PI * r, f = svg("circle", {class: "fill", cx: 28, cy: 28, r, "stroke-dasharray": c, "stroke-dashoffset": c});
    const t = svg("text", {x: 28, y: 33, "text-anchor": "middle"}); t.textContent = used;
    const el = svg("svg", {class: "ring", viewBox: "0 0 56 56", role: "img", "aria-label": `${used} of ${total} minutes`},
      svg("defs", {}, svg("linearGradient", {id: "ringgrad", x1: 0, y1: 0, x2: 1, y2: 1}, svg("stop", {offset: "0", "stop-color": "#a78bfa"}), svg("stop", {offset: "1", "stop-color": "#22d3ee"}))),
      svg("circle", {class: "track", cx: 28, cy: 28, r}), f, t);
    setTimeout(() => f.setAttribute("stroke-dashoffset", c * (1 - Math.min(1, used / Math.max(1, total)))), 120);
    return el;
  }
  const money = c => "$" + (c / 100).toFixed(2);
  const iso = d => d.toISOString().slice(0, 10);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  const WORKOUT_DAYS = {1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6]};
  const COLORS = ["#e8b86d", "#9fc98a", "#e59c7f", "#c9b48a", "#8fbfa8", "#d98f6a", "#b5c97a", "#e6a98c"];
  const tilt = i => `--r:${[-1.4, 1, -0.6, 1.3, -1, 0.7][i % 6]}deg`;

  /* ---- the brain (prepwise.py, built by the Local AI) ---- */
  const STEP = {bmr: "s1", start_tdee: "s2", daily_target: "s3", estimate_tdee: "s4", macros: "s5", plan_meals: "s6",
    grocery_list: "s7", build_workout: "s8", schedule: "s9", adherence: "s10"};
  class Missing extends Error {}
  async function brain(fn, ...args) {
    const r = await titan.call("logic", {fn, args});
    if (r && r.missing) throw new Missing(fn);
    if (!r || r.error) throw new Error(r && r.error || "No answer from the brain.");
    return r.ok;
  }
  const waiting = (fn, what) => h("div", {class: "waiting"}, h("b", {text: what}),
    `Your Local AI is still building this part of the brain (step ${STEP[fn] || fn}). It switches on by itself once that step passes.`);
  const oops = (e, what) => e instanceof Missing ? waiting(e.message, what) : h("div", {class: "waiting"}, h("b", {text: what + " didn't work"}), String(e.message || e));
  async function showBrain() {
    const r = await titan.call("brain"), have = (r && r.functions) || [], n = Object.keys(STEP).filter(f => have.includes(f)).length;
    $("brain-bar").style.setProperty("--p", n * 10 + "%");
    $("brain-text").textContent = !r || r.error ? "Brain unreachable" : !r.source ? "Brain not started" : `Brain ${n}/10 built by your AI`;
  }

  /* ---- data ---- */
  const S = titan.store("prepwise", {profile: null, zone: "kitchen", budget: 6000, portions: 10, picks: [], plan: null, pins: {}, got: [],
    workout: {days: 3, equipment: [], minutes: 40}, free: [["Mon", "18:00", "19:30"], ["Wed", "18:00", "19:30"], ["Fri", "18:00", "19:30"], ["Sun", "10:00", "14:00"]],
    weighins: [], done: {}, prices: {}});
  let RECIPES = [], EXERCISES = [], CREDITS = {};
  const byName = n => RECIPES.find(r => r.name === n), byId = id => RECIPES.find(r => r.id === id);
  const cost = r => S.get("prices")[r.id] ?? r.cost_cents;
  const colorOf = r => COLORS[RECIPES.indexOf(r) % COLORS.length];
  const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - todayIdx()); return iso(d); };
  const isDone = id => (S.get("done")[weekKey()] || []).includes(id);
  function setDone(id, on) { const all = S.get("done"), cur = new Set(all[weekKey()] || []); on ? cur.add(id) : cur.delete(id); all[weekKey()] = [...cur]; S.set("done", all); }
  function photo(el, r) { const img = new Image(); img.onload = () => { el.style.backgroundImage = `url(photos/${r.id}.jpg)`; el.textContent = ""; }; img.src = `photos/${r.id}.jpg`; }

  /* the week's meals: the plan's portions spread over lunches and dinners, with anything dragged onto a day pinned there */
  function weekMeals() {
    const plan = S.get("plan"), pins = S.get("pins"), out = DAYS.map(() => []);
    const pool = plan ? plan.recipes.flatMap(n => Array((byName(n) || {}).servings || 0).fill(n)) : [];
    let k = 0;
    for (let d = 0; d < 7; d++) {
      for (const slot of ["Lunch", "Dinner"]) {
        const pinned = pins[`${d}-${slot}`];
        if (pinned && byId(pinned)) out[d].push({slot, r: byId(pinned), pinned: true});
        else if (k < pool.length) out[d].push({slot, r: byName(pool[k++])});
      }
    }
    return out;
  }

  /* ---- the board ---- */
  let workoutPlan = null, placed = [];
  async function draw() {
    const zone = S.get("zone");
    document.body.dataset.zone = zone;
    $("to-kitchen").setAttribute("aria-pressed", String(zone === "kitchen")); $("to-gym").setAttribute("aria-pressed", String(zone === "gym"));
    await (zone === "gym" ? drawGym() : drawKitchen());
  }

  async function drawKitchen() {
    const plan = S.get("plan"), hero = $("hero"), board = $("board");
    hero.replaceChildren(h("h1", {}, "This week's ", h("span", {class: "hl", text: "food"})));
    if (plan) {
      const pct = Math.min(100, Math.round(100 * plan.cost / S.get("budget")));
      hero.append(h("div", {class: "stat"}, h("b", {text: `${money(plan.cost)} of ${money(S.get("budget"))}`}), h("div", {class: "money"}, h("i", {style: `width:${pct}%`}))),
        h("div", {class: "stat"}, h("b", {text: plan.servings}), h("small", {text: "portions prepped"})),
        h("div", {class: "stat"}, h("b", {text: Math.round(plan.protein / plan.servings) + " g"}), h("small", {text: "protein a portion"})));
    } else hero.append(h("p", {class: "note", text: "Open the Pantry, tap + on meals you'd eat, then plan. Or plan right away and PrepRep picks."}));
    hero.append(h("button", {class: "go", onclick: planWeek, text: plan ? "Re-plan my week" : "Plan my week"}));
    const meals = weekMeals();
    board.replaceChildren(...DAYS.map((d, i) => {
      const col = h("section", {class: "col" + (i === todayIdx() ? " today" : ""), style: `--d:${i}`, "aria-label": d},
        h("h3", {}, d, h("small", {text: dateOf(i)})));
      if (!meals[i].length) col.append(h("p", {class: "empty", text: plan ? "Free day: eat what you like." : "Nothing planned yet"}));
      meals[i].forEach(({slot, r, pinned}, k) => {
        const id = `meal-${i}-${slot}`, box = h("input", {type: "checkbox", "aria-label": `Ate ${slot.toLowerCase()} on ${d}`});
        box.checked = isDone(id);
        const ph = h("span", {class: "ph", style: `--c:${colorOf(r)}`, text: r.name[0]}); photo(ph, r);
        const m = h("div", {class: "meal" + (box.checked ? " done" : ""), style: tilt(i + k)}, ph, h("small", {text: slot + (pinned ? " · pinned" : "")}), h("b", {text: r.name}), box);
        box.addEventListener("change", () => { setDone(id, box.checked); m.classList.toggle("done", box.checked); if (box.checked) titan.toast("Logged. Nice."); });
        col.append(m);
      });
      // drop a meal from the Pantry onto a day: it becomes that day's dinner (or lunch if dinner is pinned)
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("over"); });
      col.addEventListener("dragleave", () => col.classList.remove("over"));
      col.addEventListener("drop", e => {
        e.preventDefault(); col.classList.remove("over");
        const rid = e.dataTransfer.getData("text/plain"), r = byId(rid); if (!r) return;
        const pins = S.get("pins"), slot = pins[`${i}-Dinner`] ? "Lunch" : "Dinner"; pins[`${i}-${slot}`] = rid; S.set("pins", pins);
        titan.toast(`${r.name} pinned to ${d} ${slot.toLowerCase()}`); draw();
      });
      return col;
    }));
  }

  async function drawGym() {
    const w = S.get("workout"), hero = $("hero"), board = $("board"), when = WORKOUT_DAYS[w.days] || [];
    const FOCUS = w.days <= 2 ? () => "Full body" : i => ["Push", "Pull", "Legs"][i % 3];
    hero.replaceChildren(h("h1", {text: "Training week"}),
      h("div", {class: "stat"}, h("b", {text: `${w.days}×`}), h("small", {text: "workouts"})),
      h("div", {class: "stat"}, h("b", {text: `${w.days * w.minutes} min`}), h("small", {text: "planned"})),
      h("button", {class: "go", onclick: () => openSheet("you"), text: "Change my training"}));
    try {
      workoutPlan = await brain("build_workout", EXERCISES.map(({name, muscle, equipment, minutes}) => ({name, muscle, equipment, minutes})), w.days, w.equipment, w.minutes);
    } catch (e) { board.replaceChildren(h("div", {style: "grid-column:1/-1"}, oops(e, "Your weekly workout"))); return; }
    placed = await placeWeek(when, FOCUS);
    board.replaceChildren(...DAYS.map((d, i) => {
      const col = h("section", {class: "col" + (i === todayIdx() ? " today" : ""), style: `--d:${i}`, "aria-label": d}, h("h3", {}, d, h("small", {text: dateOf(i)})));
      const wi = when.indexOf(i);
      if (wi < 0) col.append(h("p", {class: "rest", text: "Rest and recover."}));
      else {
        const names = workoutPlan[wi] || [], used = names.reduce((t, n) => t + ((EXERCISES.find(x => x.name === n) || {}).minutes || 0), 0);
        const id = `workout-${i}`, box = h("input", {type: "checkbox", "aria-label": `Did the ${d} workout`}); box.checked = isDone(id);
        box.addEventListener("change", () => { setDone(id, box.checked); if (box.checked) titan.toast("Workout done. Strong."); });
        const at = placed.find(p => p.day === d && p.task.startsWith("Workout"));
        col.append(h("div", {class: "wk"}, h("div", {class: "wkhead"}, ring(used, w.minutes), h("div", {}, h("b", {text: FOCUS(wi)}), h("small", {text: `${names.length} moves · ${used} min`}))),
          at ? h("span", {class: "when", text: `${at.start}–${at.end}`}) : null,
          ...names.map(n => { const ex = EXERCISES.find(x => x.name === n) || {}; return h("div", {class: "ex"}, h("b", {text: n}), h("small", {text: `${ex.minutes} min · ${ex.how || ""}`})); }),
          h("label", {class: "line"}, box, h("span", {text: "Done"}))));
      }
      const prep = placed.find(p => p.day === d && p.task === "Meal prep");
      if (prep) col.append(h("span", {class: "when", text: `${prep.start}–${prep.end} meal prep`}));
      return col;
    }));
  }

  async function placeWeek(when, FOCUS) {
    const order = s => DAYS.indexOf(s[0]) * 1440 + (+s[1].slice(0, 2)) * 60 + (+s[1].slice(3));
    const left = S.get("free").map(f => [...f]).sort((x, y) => order(x) - order(y)), out = [];
    const place = async (task, slots) => {
      const r = await brain("schedule", slots, [task]); if (!r.placed.length) return false;
      const p = r.placed[0]; out.push(p); const s = left.find(x => x[0] === p.day && x[1] <= p.start && x[2] >= p.end); if (s) s[1] = p.end; return true;
    };
    try {
      const w = S.get("workout");
      for (let i = 0; i < when.length; i++) { const t = [`Workout · ${FOCUS(i)}`, w.minutes]; if (!(await place(t, left.filter(x => x[0] === DAYS[when[i]])))) await place(t, left); }
      if (S.get("plan")) await place(["Meal prep", Math.min(240, 30 + 30 * new Set(S.get("plan").recipes).size)], left);
    } catch (e) { /* the schedule step isn't built yet: the board still shows the workouts */ }
    return out;
  }
  function dateOf(i) { const d = new Date(); d.setDate(d.getDate() - todayIdx() + i); return d.getDate(); }

  async function planWeek() {
    const picks = S.get("picks"), pool = (picks.length ? picks.map(byId) : RECIPES).filter(Boolean).slice(0, 8)
      .map(r => ({name: r.name, servings: r.servings, cost_cents: cost(r), protein: r.protein}));
    try {
      const plan = await brain("plan_meals", pool, S.get("budget"), S.get("portions"));
      if (!plan) { titan.toast("Nothing fits that budget. Raise it or prep fewer portions (You).", "warn"); return; }
      S.set("plan", plan); S.set("got", []); titan.toast(`Planned ${plan.servings} portions for ${money(plan.cost)}`); closeSheet(); draw();
    } catch (e) { titan.toast(e instanceof Missing ? "Your AI is still building the meal planner (step s6)." : String(e.message), "warn"); }
  }

  async function showTarget() {
    const p = S.get("profile");
    try {
      const base = await brain("bmr", p.sex, +p.age, +p.height_cm, +p.weight_kg), start = await brain("start_tdee", base, p.activity);
      let burn = start, learned = false;
      try { const log = S.get("weighins").slice(-28).map((w, i) => [i, +w.weight, +w.kcal]); const est = log.length >= 7 ? await brain("estimate_tdee", log) : null; if (est) { burn = est; learned = true; } }
      catch (e) { if (!(e instanceof Missing)) throw e; }
      const target = await brain("daily_target", burn, p.goal, p.sex, +p.rate || 0.5);
      $("kcal").textContent = target.toLocaleString(); $("kcal-note").textContent = learned ? "kcal · learned" : "kcal";
      return {target, burn, learned};
    } catch (e) { $("kcal").textContent = "…"; $("kcal-note").textContent = e instanceof Missing ? "brain building" : "check You"; return null; }
  }

  /* ---- sheets ---- */
  const SHEETS = {};
  let openName = null;
  async function openSheet(name) {
    const d = $("sheet"); openName = name;
    document.querySelectorAll(".dock button").forEach(b => b.setAttribute("aria-expanded", String(b.dataset.sheet === name)));
    $("sheet-body").replaceChildren();
    await SHEETS[name]($("sheet-body"));
    if (!d.open) d.showModal();
  }
  function closeSheet() {
    const d = $("sheet"); if (!d.open) return;
    d.classList.add("closing");
    setTimeout(() => { d.classList.remove("closing"); d.close(); }, 280);
  }
  $("sheet").addEventListener("close", () => { openName = null; document.querySelectorAll(".dock button").forEach(b => b.setAttribute("aria-expanded", "false")); });
  $("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet(); });
  $("sheet").addEventListener("cancel", e => { e.preventDefault(); closeSheet(); });
  $("sheet-close").addEventListener("click", closeSheet);
  document.querySelectorAll(".dock button").forEach(b => b.addEventListener("click", () => openName === b.dataset.sheet ? closeSheet() : openSheet(b.dataset.sheet)));
  const title = t => { $("sheet-title").textContent = t; };

  SHEETS.pantry = async body => {
    title("Pantry");
    body.append(h("p", {class: "note", text: "Tap + on meals you'd eat this week, then plan. Or drag a meal straight onto a day on the board to pin it there."}));
    const shelves = [["Cheap and filling", r => r.tags.includes("budget")], ["High protein", r => r.tags.includes("high-protein")],
      ["Ready in 25 minutes", r => r.minutes <= 25], ["No meat", r => r.tags.includes("vegetarian")], ["Breakfasts", r => r.tags.includes("breakfast")]];
    for (const [name, keep] of shelves) {
      const list = RECIPES.filter(keep); if (!list.length) continue;
      body.append(h("div", {class: "shelf"}, h("h3", {text: name}), h("div", {class: "row", role: "list"}, ...list.map((r, i) => sticker(r, i)))));
    }
    body.append(h("div", {style: "display:flex;gap:12px;align-items:center;margin-top:12px"}, h("button", {class: "go", onclick: planWeek, text: "Plan my week"}),
      h("span", {class: "note", text: `${S.get("picks").length || "No"} meals picked · ${money(S.get("budget"))} budget · ${S.get("portions")} portions`})));
  };
  function sticker(r, i) {
    const on = S.get("picks").includes(r.id), ph = h("div", {class: "ph", style: `--c:${colorOf(r)}`, text: r.name[0]}); photo(ph, r);
    if (r.tags.includes("high-protein")) ph.append(h("span", {class: "tag", text: `${r.protein} g protein`}));
    const pick = h("button", {class: "pick", "aria-pressed": String(on), "aria-label": (on ? "Remove " : "Add ") + r.name, text: "+"});
    const s = h("div", {class: "sticker" + (on ? " on" : ""), style: tilt(i), draggable: "true", role: "listitem"}, ph, pick, h("b", {text: r.name}), h("small", {text: `${r.servings} portions · ${money(cost(r))} · ${r.minutes} min`}));
    s.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", r.id); setTimeout(closeSheet, 60); });
    pick.addEventListener("click", () => {
      const p = new Set(S.get("picks")); p.has(r.id) ? p.delete(r.id) : p.add(r.id); S.set("picks", [...p]);
      document.querySelectorAll(".sticker").forEach(x => { const nm = x.querySelector("b").textContent, y = byName(nm), o = p.has(y.id);
        x.classList.toggle("on", o); const b = x.querySelector(".pick"); b.setAttribute("aria-pressed", String(o)); b.setAttribute("aria-label", (o ? "Remove " : "Add ") + y.name); });
    });
    return s;
  }

  SHEETS.shop = async body => {
    title("Shopping list");
    const plan = S.get("plan");
    if (!plan) { body.append(h("p", {class: "note", text: "Plan your week first and everything you need shows up here, by aisle."})); return; }
    body.append(h("p", {class: "note", text: `About ${money(plan.cost)} for ${plan.servings} portions. Tick things off as they go in the cart.`}));
    try {
      const items = await brain("grocery_list", plan.recipes.map(byName).filter(Boolean).map(r => ({ingredients: r.ingredients})));
      const got = new Set(S.get("got")); let aisle = "";
      items.forEach(it => {
        if (it.aisle !== aisle) { aisle = it.aisle; body.append(h("div", {class: "aisle", text: aisle})); }
        const key = it.item + "|" + it.unit, cb = h("input", {type: "checkbox"}); cb.checked = got.has(key);
        const row = h("label", {class: "line" + (cb.checked ? " done" : "")}, cb, h("span", {text: `${it.item}: ${it.qty} ${it.unit}`}));
        cb.addEventListener("change", () => { cb.checked ? got.add(key) : got.delete(key); S.set("got", [...got]); row.classList.toggle("done", cb.checked); });
        body.append(row);
      });
    } catch (e) { body.append(oops(e, "The combined shopping list")); }
  };

  SHEETS.progress = async body => {
    title("Progress");
    const t = await showTarget();
    if (t) {
      const box = h("div", {style: "display:flex;gap:30px;flex-wrap:wrap;margin:6px 0 10px"},
        h("div", {class: "stat"}, h("b", {text: t.target.toLocaleString() + " kcal"}), h("small", {text: "to eat a day"})),
        h("div", {class: "stat"}, h("b", {text: t.burn.toLocaleString() + " kcal"}), h("small", {text: t.learned ? "you burn (learned from your weigh-ins)" : "you burn (starting estimate)"})));
      try { const m = await brain("macros", t.target, +S.get("profile").weight_kg, S.get("profile").goal);
        box.append(...[["protein", m.protein], ["carbs", m.carbs], ["fat", m.fat]].map(([k, v]) => h("div", {class: "stat"}, h("b", {text: v + " g"}), h("small", {text: k})))); }
      catch (e) { if (!(e instanceof Missing)) box.append(oops(e, "Macros")); }
      body.append(box);
    }
    const form = h("form", {class: "form", novalidate: true},
      h("label", {for: "weight"}, "Weight this morning (kg)", h("input", {id: "weight", type: "number", step: "0.1"})),
      h("label", {for: "kcal-in"}, "Calories eaten yesterday", h("input", {id: "kcal-in", type: "number", step: "10"})),
      h("label", {}, " ", h("button", {class: "go", text: "Save weigh-in"})));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const v = titan.validate(form, {weight: s => +s >= 30 && +s <= 300 ? "" : "Weight in kg, 30 to 300.", "kcal-in": s => +s >= 500 && +s <= 8000 ? "" : "A rough number, 500 to 8000."});
      if (!v) return;
      const log = S.get("weighins").filter(w => w.date !== iso(new Date())); log.push({date: iso(new Date()), weight: +v.weight, kcal: +v["kcal-in"]}); S.set("weighins", log);
      titan.toast("Saved. Consistency beats perfection."); openSheet("progress"); showTarget();
    });
    body.append(form, h("div", {class: "chart", id: "wchart", style: "margin-top:16px"}));
    const log = S.get("weighins");
    if (log.length < 2) titan.state($("wchart"), "empty", {title: "Two weigh-ins and your trend appears here"});
    else titan.chart($("wchart"), {type: "line", title: "Weight (kg)", data: log.slice(-30).map(w => ({label: w.date.slice(5), value: w.weight}))});
    body.append(h("p", {class: "note", text: log.length >= 7 ? "A week of data: your target now uses your real burn." : `${7 - log.length} more weigh-in${7 - log.length === 1 ? "" : "s"} until PrepRep learns your real burn.`}));
    const wk = S.get("done")[weekKey()] || [], when = WORKOUT_DAYS[S.get("workout").days] || [], planned = [];
    weekMeals().forEach((ms, d) => ms.forEach(m => planned.push(`meal-${d}-${m.slot}`))); when.forEach(d => planned.push(`workout-${d}`));
    try { const pct = await brain("adherence", planned, wk); if (pct != null) body.append(h("p", {}, h("b", {text: `This week so far: ${pct}% of your plan done.`}))); } catch (e) { /* step 10 not built yet */ }
  };

  SHEETS.you = async (body, first) => {
    title(first ? "Welcome" : "You");
    const p = S.get("profile") || {sex: "male", age: "", height_cm: "", weight_kg: "", goal: "lose", activity: "light", rate: 0.5, name: ""}, w = S.get("workout");
    const sel = (id, opts, val) => h("select", {id}, ...opts.map(([v, t]) => { const o = h("option", {value: v, text: t}); o.selected = String(v) === String(val); return o; }));
    const form = h("form", {class: "form", novalidate: true},
      h("label", {for: "name"}, "First name (optional)", h("input", {id: "name", value: p.name || ""})),
      h("label", {for: "sex"}, "Body (for the calorie formula)", sel("sex", [["male", "Male"], ["female", "Female"]], p.sex)),
      h("label", {for: "age"}, "Age", h("input", {id: "age", type: "number", value: p.age})),
      h("label", {for: "height_cm"}, "Height (cm)", h("input", {id: "height_cm", type: "number", value: p.height_cm})),
      h("label", {for: "weight_kg"}, "Weight (kg)", h("input", {id: "weight_kg", type: "number", step: "0.1", value: p.weight_kg})),
      h("label", {for: "goal"}, "Goal", sel("goal", [["lose", "Lose fat"], ["maintain", "Stay the same"], ["gain", "Build muscle"]], p.goal)),
      h("label", {for: "activity"}, "Daily activity", sel("activity", [["sedentary", "Mostly sitting"], ["light", "Light (some walking)"], ["moderate", "On my feet / training 3x"], ["active", "Training most days"], ["very", "Physical job + training"]], p.activity)),
      h("label", {for: "rate"}, "If losing: how fast", sel("rate", [[0.25, "Gently (0.25 kg/wk)"], [0.5, "Steady (0.5 kg/wk)"], [0.75, "Faster (0.75 kg/wk)"]], p.rate)),
      h("label", {for: "budget"}, "Weekly grocery budget ($)", h("input", {id: "budget", type: "number", value: S.get("budget") / 100})),
      h("label", {for: "portions"}, "Portions to prep a week", h("input", {id: "portions", type: "number", value: S.get("portions")})),
      h("label", {for: "w-days"}, "Workouts a week", sel("w-days", [1, 2, 3, 4, 5, 6].map(n => [n, `${n} day${n > 1 ? "s" : ""}`]), w.days)),
      h("label", {for: "w-min"}, "Minutes a workout", sel("w-min", [20, 30, 40, 50, 60].map(n => [n, `${n} min`]), w.minutes)),
      h("label", {for: "eq"}, "Equipment", sel("eq", [["", "Just my body"], ["dumbbells", "Dumbbells"], ["dumbbells,barbell", "Dumbbells + barbell"]], w.equipment.join(","))),
      h("label", {}, " ", h("button", {class: "go", text: first ? "Start" : "Save"})));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const v = titan.validate(form, {age: s => +s >= 13 && +s <= 100 && Number.isInteger(+s) ? "" : "Age must be a whole number from 13 to 100.",
        height_cm: s => +s >= 100 && +s <= 250 ? "" : "Height in cm, 100 to 250.", weight_kg: s => +s >= 30 && +s <= 300 ? "" : "Weight in kg, 30 to 300.",
        budget: s => +s >= 5 ? "" : "At least $5.", portions: s => +s >= 1 && +s <= 21 ? "" : "1 to 21 portions."});
      if (!v) return;
      const all = {}; form.querySelectorAll("input[id], select[id]").forEach(el => { all[el.id] = el.value; });
      S.set("profile", {name: all.name, sex: all.sex, age: +all.age, height_cm: +all.height_cm, weight_kg: +all.weight_kg, goal: all.goal, activity: all.activity, rate: +all.rate});
      S.set("budget", Math.round(+all.budget * 100)); S.set("portions", Math.round(+all.portions));
      S.set("workout", {days: +all["w-days"], minutes: +all["w-min"], equipment: all.eq ? all.eq.split(",") : []});
      titan.toast(first ? "All set. Here's your week." : "Saved"); closeSheet(); showTarget(); draw();
    });
    body.append(form);
    if (first) return;
    const slots = h("div", {class: "slots"}, h("h3", {class: "aisle", text: "When you're free (for workouts and meal prep)"}));
    const free = S.get("free");
    free.forEach((f, i) => {
      const d = h("select", {"aria-label": "Day"}, ...DAYS.map(x => { const o = h("option", {text: x}); o.selected = x === f[0]; return o; }));
      const a = h("input", {type: "time", value: f[1], "aria-label": "From"}), b = h("input", {type: "time", value: f[2], "aria-label": "To"});
      [d, a, b].forEach(x => x.addEventListener("change", () => { free[i] = [d.value, a.value, b.value]; S.set("free", free); }));
      slots.append(h("div", {class: "line"}, d, a, b, h("button", {class: "x", "aria-label": "Remove this time", onclick: () => { free.splice(i, 1); S.set("free", free); openSheet("you"); }, text: "×"})));
    });
    slots.append(h("button", {style: "margin-top:10px", onclick: () => { free.push(["Sat", "09:00", "10:00"]); S.set("free", free); openSheet("you"); }, text: "Add free time"}));
    body.append(slots);
    const prices = h("div", {}, h("h3", {class: "aisle", text: "Prices at your store (per batch)"}));
    RECIPES.forEach(r => {
      const inp = h("input", {type: "number", step: "0.01", value: (cost(r) / 100).toFixed(2), "aria-label": `Price of ${r.name}`, style: "max-width:120px"});
      inp.addEventListener("change", () => { const all = S.get("prices"); all[r.id] = Math.round(+inp.value * 100); S.set("prices", all); });
      prices.append(h("label", {class: "line"}, h("span", {style: "flex:1", text: r.name}), inp));
    });
    body.append(prices);
    const cred = h("div", {class: "credits"}, h("h3", {class: "aisle", text: "Photo credits"}));
    const ids = Object.keys(CREDITS);
    if (!ids.length) cred.append(h("p", {text: "No photos are packed in this build."}));
    ids.forEach(id => { const c = CREDITS[id], r = byId(id); cred.append(h("p", {}, `${r ? r.name : id}: ${c.artist}, ${c.license}, Wikimedia Commons (`, h("a", {href: c.page, target: "_blank", rel: "noopener", text: "source"}), ")")); });
    body.append(cred);
  };

  /* ---- the flip ---- */
  const flip = z => { if (S.get("zone") === z) return; S.set("zone", z); draw(); };
  $("to-kitchen").addEventListener("click", () => flip("kitchen"));
  $("to-gym").addEventListener("click", () => flip("gym"));
  document.addEventListener("keydown", e => { if (e.key === "Tab" && e.ctrlKey) { e.preventDefault(); flip(S.get("zone") === "gym" ? "kitchen" : "gym"); } });

  /* ---- start ---- */
  (async () => {
    const load = f => fetch(f).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const [rec, ex, cr] = await Promise.all([load("data/recipes.json"), load("data/exercises.json"), load("photos/credits.json"), S.ready]);
    RECIPES = rec.recipes || []; EXERCISES = ex.exercises || []; CREDITS = cr || {};
    showBrain(); setInterval(showBrain, 60000);
    if (!S.get("profile")) {
      document.body.dataset.zone = "kitchen";
      $("hero").replaceChildren(h("h1", {}, "Hey. Let's set up your ", h("span", {class: "hl", text: "week"}), "."));
      $("board").replaceChildren();
      $("sheet-body").replaceChildren(); await SHEETS.you($("sheet-body"), true); $("sheet").showModal();
      return;
    }
    showTarget(); draw();
  })();
}
