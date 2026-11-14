/* PrepRep screens (built by Claude). All the thinking (calories, budget meal prep, groceries, workouts,
   schedule) is done by prepwise.py, which Dilan's Local AI builds step by step. A feature whose function isn't
   built yet shows which step it's waiting for, then switches on by itself once the AI passes that step. */
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

  const SVG = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, ...kids) { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); kids.forEach(k => e.append(k)); return e; }
  function ring(used, total) {
    const r = 26, c = 2 * Math.PI * r, f = svg("circle", {class: "fill", cx: 32, cy: 32, r, "stroke-dasharray": c, "stroke-dashoffset": c});
    const t = svg("text", {x: 32, y: 37, "text-anchor": "middle"}); t.textContent = used;
    const el = svg("svg", {class: "ring", viewBox: "0 0 64 64", role: "img", "aria-label": `${used} of ${total} minutes`},
      svg("defs", {}, svg("linearGradient", {id: "ringgrad", x1: 0, y1: 0, x2: 1, y2: 1}, svg("stop", {offset: "0", "stop-color": "#a78bfa"}), svg("stop", {offset: "1", "stop-color": "#22d3ee"}))),
      svg("circle", {class: "track", cx: 32, cy: 32, r}), f, t);
    requestAnimationFrame(() => requestAnimationFrame(() => f.setAttribute("stroke-dashoffset", c * (1 - Math.min(1, used / Math.max(1, total))))));
    return el;
  }
  const money = c => "$" + (c / 100).toFixed(2);
  const iso = d => d.toISOString().slice(0, 10);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  const WORKOUT_DAYS = {1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6]};
  const COLORS = ["#e8b86d", "#9fc98a", "#e59c7f", "#c9b48a", "#8fbfa8", "#d98f6a", "#b5c97a", "#e6a98c"];

  /* ---- the brain: prepwise.py, built by the Local AI ---- */
  const STEP = {bmr: "s1 · resting calories", start_tdee: "s2 · calories burned", daily_target: "s3 · daily target",
    estimate_tdee: "s4 · learning your real burn", macros: "s5 · protein, fat and carbs", plan_meals: "s6 · budget meal prep",
    grocery_list: "s7 · grocery list", build_workout: "s8 · workouts", schedule: "s9 · weekly schedule", adherence: "s10 · how the week went"};
  class Missing extends Error {}
  async function brain(fn, ...args) {
    const r = await titan.call("logic", {fn, args});
    if (r && r.missing) throw new Missing(fn);
    if (!r || r.error) throw new Error(r && r.error || "No answer from the brain.");
    return r.ok;
  }
  function coming(fn, what) {
    return h("div", {class: "card coming"}, h("h3", {text: what}),
      h("p", {class: "muted", text: `Your Local AI is still building this part of PrepRep's brain (step ${STEP[fn] || fn}). It switches on by itself once that step passes in the Builder.`}));
  }
  function trouble(e) {
    return h("div", {class: "card coming"}, h("h3", {text: "This part didn't work"}), h("p", {class: "muted", text: String(e.message || e)}));
  }
  async function showBrain() {
    const r = await titan.call("brain");
    const have = (r && r.functions) || [], n = Object.keys(STEP).filter(f => have.includes(f)).length;
    $("brain-bar").style.width = (n * 10) + "%";
    $("brain-text").textContent = !r || r.error ? "Brain: " + ((r && r.error) || "not reachable")
      : !r.source ? "Brain: not started. Start the prepwise plan in your Local AI's Builder."
      : `Brain: ${n} of 10 parts built by your Local AI`;
  }

  /* ---- data ---- */
  const S = titan.store("prepwise", {profile: null, budget: 6000, portions: 10, picks: [], plan: null, got: [], workout: {days: 3, equipment: [], minutes: 40},
    free: [["Mon", "18:00", "19:30"], ["Wed", "18:00", "19:30"], ["Fri", "18:00", "19:30"], ["Sun", "10:00", "14:00"]], weighins: [], done: {}, prices: {}});
  let RECIPES = [], EXERCISES = [], CREDITS = {};
  const recipe = id => RECIPES.find(r => r.id === id);
  const cost = r => S.get("prices")[r.id] ?? r.cost_cents;
  const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - todayIdx()); return iso(d); };

  /* ---- navigation ---- */
  let view = "today";
  const VIEWS = {};
  async function show(v) {
    view = v;
    document.body.dataset.zone = ["workouts", "schedule"].includes(v) ? "gym" : "kitchen";
    document.querySelectorAll(".nav").forEach(b => { b.classList.toggle("on", b.dataset.view === v); b.toggleAttribute("aria-current", b.dataset.view === v); });
    const main = $("main"); main.replaceChildren();
    $("planbar").hidden = v !== "meals" || !S.get("picks").length;
    if (!S.get("profile") && v !== "setup") return VIEWS.setup(main, true);
    await VIEWS[v](main);
  }
  document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));

  async function targets() {
    const p = S.get("profile");
    const base = await brain("bmr", p.sex, +p.age, +p.height_cm, +p.weight_kg);
    const start = await brain("start_tdee", base, p.activity);
    let burn = start, learned = false;
    try {
      const log = S.get("weighins").slice(-28).map((w, i) => [i, +w.weight, +w.kcal]);
      const est = log.length >= 7 ? await brain("estimate_tdee", log) : null;
      if (est) { burn = est; learned = true; }
    } catch (e) { if (!(e instanceof Missing)) throw e; }
    const target = await brain("daily_target", burn, p.goal, p.sex, +p.rate || 0.5);
    let mac = null;
    try { mac = await brain("macros", target, +p.weight_kg, p.goal); } catch (e) { if (!(e instanceof Missing)) throw e; }
    return {burn, learned, target, mac};
  }

  /* ---- Today ---- */
  VIEWS.today = async main => {
    const p = S.get("profile"), hour = new Date().getHours();
    main.append(h("h1", {text: (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening") + (p.name ? ", " + p.name : "")}),
      h("p", {class: "lede", text: new Date().toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"}) + ". Here's your day."}));
    const grid = h("div", {class: "grid"}); main.append(grid);
    const cal = h("div", {class: "card"}); grid.append(cal);
    titan.state(cal, "loading", {text: "Working out your calories…"});
    try {
      const t = await targets(); cal.replaceChildren();
      cal.append(h("div", {class: "muted", text: "Eat about"}), h("div", {}, h("span", {class: "big", text: t.target.toLocaleString()}), h("span", {class: "unit", text: "kcal a day"})),
        h("p", {}, h("span", {class: "pill" + (t.learned ? " leaf" : ""), text: t.learned ? `Learned from your weigh-ins: you burn about ${t.burn.toLocaleString()}` : `Starting estimate: you burn about ${t.burn.toLocaleString()}`})),
        t.learned ? null : h("small", {class: "muted", text: "Log your weight and what you ate on the Progress page. After 7 days PrepRep learns your real burn."}));
      if (t.mac) cal.append(h("div", {class: "macros"}, ...[["Protein", t.mac.protein], ["Carbs", t.mac.carbs], ["Fat", t.mac.fat]].map(([k, v]) => h("div", {}, h("b", {text: v + " g"}), h("small", {class: "muted", text: k})))));
    } catch (e) { cal.replaceWith(e instanceof Missing ? coming(e.message, "Your daily calories") : trouble(e)); }

    const wk = S.get("done")[weekKey()] || [];
    const items = [];
    const plan = S.get("plan");
    if (plan) items.push({id: "meals-" + todayIdx(), text: "Eat your prepped meals"});
    const wDays = WORKOUT_DAYS[S.get("workout").days] || [];
    if (wDays.includes(todayIdx())) items.push({id: "workout-" + todayIdx(), text: "Do today's workout"});
    items.push({id: "water-" + todayIdx(), text: "Drink water through the day"});
    const list = h("div", {class: "card"}, h("h2", {text: "Today's checklist"}));
    items.forEach(it => {
      const on = wk.includes(it.id), box = h("input", {type: "checkbox", id: "c-" + it.id});
      box.checked = on;
      const row = h("label", {class: "check" + (on ? " done" : ""), for: "c-" + it.id}, box, h("span", {text: it.text}));
      box.addEventListener("change", () => {
        const all = S.get("done"), cur = new Set(all[weekKey()] || []);
        box.checked ? cur.add(it.id) : cur.delete(it.id);
        all[weekKey()] = [...cur]; S.set("done", all); row.classList.toggle("done", box.checked);
        if (box.checked) titan.toast("Nice. One more thing done.");
      });
      list.append(row);
    });
    grid.append(list);
    const planned = [];
    for (let d = 0; d < 7; d++) { if (plan) planned.push("meals-" + d); if (wDays.includes(d)) planned.push("workout-" + d); planned.push("water-" + d); }
    try {
      const pct = await brain("adherence", planned, wk);
      list.append(h("p", {class: "muted", style: "margin:12px 0 0", text: pct == null ? "" : `This week so far: ${pct}% of your plan done.`}));
    } catch (e) { /* step 10 not built yet: the checklist still works */ }

    const prep = h("div", {class: "card"}, h("h2", {text: "This week's meal prep"}));
    if (plan) {
      prep.append(h("p", {class: "muted", text: `${plan.servings} portions · ${money(plan.cost)} of your ${money(S.get("budget"))} budget`}));
      [...new Set(plan.recipes)].forEach(n => prep.append(h("div", {class: "check"}, h("span", {text: `${n} × ${plan.recipes.filter(x => x === n).length}`}))));
    } else prep.append(h("p", {class: "muted", text: "No plan yet."}), h("button", {class: "soft", onclick: () => show("meals"), text: "Build your meal prep"}));
    grid.append(prep);
  };

  /* ---- Meal prep ---- */
  function foodCard(r, i) {
    const picked = S.get("picks").includes(r.id);
    const img = h("img", {src: `photos/${r.id}.jpg`, alt: "", loading: "lazy"});
    const mono = h("span", {class: "mono", "aria-hidden": "true", text: r.name[0]});
    img.addEventListener("load", () => mono.remove()); img.addEventListener("error", () => img.remove());
    const card = h("div", {class: "food" + (picked ? " picked" : "")},
      h("div", {class: "pic", style: `--c:${COLORS[i % COLORS.length]}`}, mono, img,
        r.tags.includes("high-protein") ? h("span", {class: "badge", text: `${r.protein} g protein`}) : null,
        h("button", {class: "add", "aria-label": (picked ? "Remove " : "Add ") + r.name, "aria-pressed": String(picked), text: "+"})),
      h("b", {text: r.name}), h("small", {text: `${r.servings} portions · ${money(cost(r))} · ${r.minutes} min`}));
    card.querySelector(".add").addEventListener("click", e => { e.stopPropagation(); togglePick(r.id); });
    return card;
  }
  function togglePick(id) {
    const p = new Set(S.get("picks")); p.has(id) ? p.delete(id) : p.add(id); S.set("picks", [...p]);
    document.querySelectorAll(".food").forEach(c => {
      const btn = c.querySelector(".add"), name = c.querySelector("b").textContent, r = RECIPES.find(x => x.name === name);
      const on = p.has(r.id); c.classList.toggle("picked", on); btn.setAttribute("aria-pressed", String(on)); btn.setAttribute("aria-label", (on ? "Remove " : "Add ") + r.name);
    });
    drawPlanbar();
  }
  function drawPlanbar() {
    const picks = S.get("picks"), bar = $("planbar");
    bar.hidden = view !== "meals" || !picks.length;
    $("plan-thumbs").replaceChildren(...picks.slice(0, 5).map(id => { const i = RECIPES.findIndex(r => r.id === id);
      return h("span", {style: `--c:${COLORS[i % COLORS.length]};background-image:url(photos/${id}.jpg)`}); }));
    $("plan-count").textContent = `${picks.length} picked`;
  }
  $("plan-go").addEventListener("click", () => planWeek());
  async function planWeek() {
    const picks = S.get("picks"), pool = (picks.length ? picks.map(recipe) : RECIPES).slice(0, 8)
      .map(r => ({name: r.name, servings: r.servings, cost_cents: cost(r), protein: r.protein}));
    const out = $("plan-result");
    if (out) titan.state(out, "loading", {text: "Fitting your week into your budget…"});
    try {
      const plan = await brain("plan_meals", pool, S.get("budget"), S.get("portions"));
      S.set("plan", plan);
      if (!plan) titan.toast("Nothing fits that budget. Try more money or fewer portions.", "warn");
      else titan.toast(`Planned: ${plan.servings} portions for ${money(plan.cost)}`);
      if (view === "meals") show("meals");
    } catch (e) {
      if (out) out.replaceChildren(e instanceof Missing ? coming(e.message, "Budget meal planning") : trouble(e));
      else titan.toast(e instanceof Missing ? "Your AI is still building the meal planner (step s6)." : String(e.message), "warn");
    }
  }
  VIEWS.meals = async main => {
    main.append(h("h1", {}, "Build your ", h("span", {class: "hl", text: "meal prep"})),
      h("p", {class: "lede", text: "Tap + on meals you'd eat this week (or none, and PrepRep picks from everything). Set your budget and how many portions you need, then plan."}));
    const budget = h("input", {id: "budget", type: "number", min: "5", step: "1", value: String(S.get("budget") / 100)});
    const portions = h("input", {id: "portions", type: "number", min: "1", max: "21", value: String(S.get("portions"))});
    budget.addEventListener("change", () => S.set("budget", Math.max(500, Math.round(+budget.value * 100))));
    portions.addEventListener("change", () => S.set("portions", Math.min(21, Math.max(1, Math.round(+portions.value)))));
    main.append(h("div", {class: "card form", style: "max-width:720px"},
      h("label", {for: "budget"}, "Weekly grocery budget ($)", budget),
      h("label", {for: "portions"}, "Portions to prep (lunches + dinners)", portions),
      h("label", {}, " ", h("button", {class: "primary", onclick: planWeek, text: "Plan my week"}))));
    const res = h("div", {id: "plan-result", style: "margin-top:18px"}); main.append(res);
    const plan = S.get("plan");
    if (plan) {
      const pct = Math.min(100, Math.round(100 * plan.cost / S.get("budget")));
      res.append(h("div", {class: "card", style: "max-width:720px"},
        h("h2", {text: "Your week"}), h("div", {class: "meter"}, h("i", {style: `width:${pct}%`})),
        h("p", {class: "muted", text: `${money(plan.cost)} of ${money(S.get("budget"))} · ${plan.servings} portions · ${plan.protein} g protein in total`}),
        ...[...new Set(plan.recipes)].map(n => h("div", {class: "check"}, h("span", {text: `Cook ${n} × ${plan.recipes.filter(x => x === n).length}`}))),
        h("button", {class: "soft", style: "margin-top:10px", onclick: () => show("groceries"), text: "See the grocery list"})));
    }
    const rows = [["Fits a tight budget", r => r.tags.includes("budget")], ["High protein", r => r.tags.includes("high-protein")],
      ["Ready in 25 minutes", r => r.minutes <= 25], ["Vegetarian", r => r.tags.includes("vegetarian")], ["Breakfasts", r => r.tags.includes("breakfast")]];
    for (const [title, keep] of rows) {
      const list = RECIPES.filter(keep); if (!list.length) continue;
      main.append(h("div", {class: "row-head"}, h("h2", {text: title})),
        h("div", {class: "strip", role: "list", "aria-label": title}, ...list.map(r => foodCard(r, RECIPES.indexOf(r)))));
    }
    main.append(h("p", {class: "credits", text: "Prices are rough US estimates; change them on the You page. Photo credits are on the You page too."}));
    drawPlanbar();
  };

  /* ---- Groceries ---- */
  VIEWS.groceries = async main => {
    main.append(h("h1", {}, "The ", h("span", {class: "hl", text: "shopping list"})));
    const plan = S.get("plan");
    if (!plan) { main.append(h("p", {class: "lede", text: "Plan your meal prep first, and your shopping list appears here."}), h("button", {class: "primary", onclick: () => show("meals"), text: "Build your meal prep"})); return; }
    main.append(h("p", {class: "lede", text: `Everything for this week's prep in one list, by aisle. About ${money(plan.cost)} in total.`}));
    const box = h("div", {class: "card", style: "max-width:720px"}); main.append(box);
    try {
      const batches = plan.recipes.map(n => RECIPES.find(r => r.name === n)).filter(Boolean).map(r => ({ingredients: r.ingredients}));
      const items = await brain("grocery_list", batches);
      const got = new Set(S.get("got")); let aisle = "";
      items.forEach((it, i) => {
        if (it.aisle !== aisle) { aisle = it.aisle; box.append(h("div", {class: "aisle"}, h("h3", {text: aisle}))); }
        const id = `g-${i}`, key = it.item + "|" + it.unit, cb = h("input", {type: "checkbox", id});
        cb.checked = got.has(key);
        const row = h("label", {class: "check" + (cb.checked ? " done" : ""), for: id}, cb, h("span", {text: `${it.item}: ${it.qty} ${it.unit}`}));
        cb.addEventListener("change", () => { cb.checked ? got.add(key) : got.delete(key); S.set("got", [...got]); row.classList.toggle("done", cb.checked); });
        box.append(row);
      });
      main.append(h("button", {class: "soft", style: "margin-top:14px", onclick: () => { S.set("got", []); show("groceries"); }, text: "Start a fresh list"}));
    } catch (e) { box.replaceWith(e instanceof Missing ? coming(e.message, "Your combined grocery list") : trouble(e)); }
  };

  /* ---- Workouts ---- */
  VIEWS.workouts = async main => {
    const w = S.get("workout");
    main.append(h("h1", {text: "Workouts"}), h("p", {class: "lede", text: "Pick how often, how long, and what you have. PrepRep builds the week around it."}));
    const days = h("select", {id: "w-days"}, ...[1, 2, 3, 4, 5, 6].map(n => { const o = h("option", {value: n, text: `${n} day${n > 1 ? "s" : ""} a week`}); o.selected = n === w.days; return o; }));
    const mins = h("select", {id: "w-min"}, ...[20, 30, 40, 50, 60].map(n => { const o = h("option", {value: n, text: `${n} minutes`}); o.selected = n === w.minutes; return o; }));
    const eq = ["dumbbells", "barbell"].map(k => { const c = h("input", {type: "checkbox", id: "eq-" + k}); c.checked = w.equipment.includes(k); return [k, c]; });
    const save = () => { S.set("workout", {days: +days.value, minutes: +mins.value, equipment: eq.filter(([, c]) => c.checked).map(([k]) => k)}); show("workouts"); };
    [days, mins, ...eq.map(([, c]) => c)].forEach(x => x.addEventListener("change", save));
    main.append(h("div", {class: "card form", style: "max-width:860px"}, h("label", {for: "w-days"}, "How often", days), h("label", {for: "w-min"}, "How long", mins),
      h("div", {}, h("b", {style: "font-size:14px", text: "Equipment you have"}), ...eq.map(([k, c]) => h("label", {class: "check", for: "eq-" + k, style: "font-weight:500"}, c, h("span", {text: k}))))));
    const out = h("div", {class: "grid", style: "margin-top:20px"}); main.append(out);
    try {
      const plan = await brain("build_workout", EXERCISES.map(({name, muscle, equipment, minutes}) => ({name, muscle, equipment, minutes})), w.days, w.equipment, w.minutes);
      const when = WORKOUT_DAYS[w.days];
      const FOCUS = w.days <= 2 ? () => "Full body" : i => ["Push", "Pull", "Legs"][i % 3];
      plan.forEach((names, i) => {
        const used = names.reduce((t, n) => t + ((EXERCISES.find(x => x.name === n) || {}).minutes || 0), 0);
        out.append(h("div", {class: "card day"},
          h("div", {class: "dayhead"}, ring(used, w.minutes), h("div", {}, h("h2", {text: `${DAYS[when[i]]} · ${FOCUS(i)}`}), h("small", {text: `${names.length} exercise${names.length === 1 ? "" : "s"} · ${used} of ${w.minutes} min`}))),
          names.length ? names.map((n, k) => { const ex = EXERCISES.find(x => x.name === n) || {};
              return h("div", {class: "ex"}, h("span", {class: "n", text: k + 1}), h("div", {}, h("b", {text: n}), h("small", {text: ex.how || ""})), h("span", {class: "t", text: `${ex.minutes} min`})); })
            : h("p", {class: "muted", text: "Nothing fits. Try more minutes or more equipment."})));
      });
    } catch (e) { out.replaceWith(e instanceof Missing ? coming(e.message, "Your weekly workout") : trouble(e)); }
  };

  /* ---- Schedule ---- */
  VIEWS.schedule = async main => {
    main.append(h("h1", {text: "Your training week"}), h("p", {class: "lede", text: "Tell PrepRep when you're free. It fits your workouts and meal prep in, in order of priority."}));
    const free = S.get("free"), ed = h("div", {class: "card", style: "max-width:720px"}, h("h2", {text: "Free time"}));
    free.forEach((f, i) => {
      const d = h("select", {"aria-label": "Day"}, ...DAYS.map(x => { const o = h("option", {text: x}); o.selected = x === f[0]; return o; }));
      const a = h("input", {type: "time", value: f[1], "aria-label": "From"}), b = h("input", {type: "time", value: f[2], "aria-label": "To"});
      const upd = () => { free[i] = [d.value, a.value, b.value]; S.set("free", free); show("schedule"); };
      [d, a, b].forEach(x => x.addEventListener("change", upd));
      ed.append(h("div", {class: "check"}, d, a, b, h("button", {class: "linkish", "aria-label": "Remove this slot", onclick: () => { free.splice(i, 1); S.set("free", free); show("schedule"); }, text: "Remove"})));
    });
    ed.append(h("button", {class: "soft", style: "margin-top:8px", onclick: () => { free.push(["Sat", "09:00", "10:00"]); S.set("free", free); show("schedule"); }, text: "Add free time"}));
    main.append(ed);
    const w = S.get("workout"), when = WORKOUT_DAYS[w.days] || [];
    const FOCUS = w.days <= 2 ? () => "Full body" : i => ["Push", "Pull", "Legs"][i % 3];
    const order = s => DAYS.indexOf(s[0]) * 1440 + (+s[1].slice(0, 2)) * 60 + (+s[1].slice(3));
    let left = [...free].map(f => [...f]).sort((x, y) => order(x) - order(y));
    const weekBox = h("div", {style: "margin-top:20px"}); main.append(weekBox);
    try {
      // each workout goes on its own day first; only if that day is full does it go anywhere else
      const placed = [], unplaced = [];
      const place = async (task, slots) => {
        const r = await brain("schedule", slots, [task]);
        if (!r.placed.length) return false;
        const p = r.placed[0]; placed.push(p);
        const s = left.find(x => x[0] === p.day && x[1] <= p.start && x[2] >= p.end); if (s) s[1] = p.end;
        return true;
      };
      for (let i = 0; i < when.length; i++) {
        const task = [`Workout · ${FOCUS(i)}`, w.minutes];
        if (!(await place(task, left.filter(x => x[0] === DAYS[when[i]]))) && !(await place(task, left))) unplaced.push(task[0]);
      }
      if (S.get("plan")) { const t = ["Meal prep", Math.min(240, 30 + 30 * new Set(S.get("plan").recipes).size)]; if (!(await place(t, left))) unplaced.push(t[0]); }
      const r = {placed, unplaced};
      weekBox.append(h("div", {class: "week"}, ...DAYS.map((d, i) => h("div", {class: i === todayIdx() ? "today" : null}, h("h3", {text: i === todayIdx() ? d + " · today" : d}),
        ...r.placed.filter(p => p.day === d).map(p => h("div", {class: "slot" + (p.task === "Meal prep" ? " prep" : ""), text: `${p.start}–${p.end} ${p.task}`}))))));
      if (r.unplaced.length) weekBox.append(h("p", {}, h("span", {class: "pill warn", text: `Didn't fit: ${r.unplaced.join(", ")}. Add more free time.`})));
    } catch (e) { weekBox.replaceWith(e instanceof Missing ? coming(e.message, "Your weekly schedule") : trouble(e)); }
  };

  /* ---- Progress ---- */
  VIEWS.progress = async main => {
    main.append(h("h1", {}, "Your ", h("span", {class: "hl", text: "progress"})), h("p", {class: "lede", text: "Weigh in each morning and note roughly what you ate. Daily weight jumps around (water, salt); PrepRep looks at the trend."}));
    const form = h("form", {class: "card form", style: "max-width:720px", novalidate: true},
      h("label", {for: "weight"}, "Weight (kg)", h("input", {id: "weight", type: "number", step: "0.1"})),
      h("label", {for: "kcal"}, "Calories eaten yesterday", h("input", {id: "kcal", type: "number", step: "10"})),
      h("label", {}, " ", h("button", {class: "primary", text: "Save weigh-in"})));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const v = titan.validate(form, {weight: s => +s >= 30 && +s <= 300 ? "" : "Enter your weight in kg (30-300).", kcal: s => +s >= 500 && +s <= 8000 ? "" : "Enter a rough calorie number (500-8000)."});
      if (!v) return;
      const log = S.get("weighins").filter(w => w.date !== iso(new Date()));
      log.push({date: iso(new Date()), weight: +v.weight, kcal: +v.kcal}); S.set("weighins", log);
      titan.toast("Saved. Consistency beats perfection."); show("progress");
    });
    main.append(form);
    const log = S.get("weighins");
    const card = h("div", {class: "card", style: "margin-top:18px"}, h("h2", {text: "Weight trend"}), h("div", {class: "chart", id: "wchart"})); main.append(card);
    if (log.length < 2) titan.state($("wchart"), "empty", {title: "Two weigh-ins and your trend appears here"});
    else titan.chart($("wchart"), {type: "line", title: "Weight (kg)", data: log.slice(-30).map(w => ({label: w.date.slice(5), value: w.weight}))});
    card.append(h("p", {class: "muted", text: log.length >= 7 ? "You have a week of data, so your calorie target now uses your real burn." : `${Math.max(0, 7 - log.length)} more day${7 - log.length === 1 ? "" : "s"} of weigh-ins until PrepRep learns your real burn.`}));
  };

  /* ---- You (setup) ---- */
  VIEWS.setup = async (main, first) => {
    const p = S.get("profile") || {sex: "male", age: "", height_cm: "", weight_kg: "", goal: "lose", activity: "light", rate: 0.5, name: ""};
    main.append(h("h1", {text: first ? "Welcome to PrepRep" : "You"}),
      h("p", {class: "lede", text: first ? "A few details and PrepRep works out your calories, meals and workouts. Everything stays on this PC." : "Change anything here; every page updates."}));
    const sel = (id, opts, val) => h("select", {id}, ...opts.map(([v, t]) => { const o = h("option", {value: v, text: t}); o.selected = String(v) === String(val); return o; }));
    const form = h("form", {class: "card form", novalidate: true},
      h("label", {for: "name"}, "First name (optional)", h("input", {id: "name", value: p.name || ""})),
      h("label", {for: "sex"}, "Body (for the calorie formula)", sel("sex", [["male", "Male"], ["female", "Female"]], p.sex)),
      h("label", {for: "age"}, "Age", h("input", {id: "age", type: "number", value: p.age})),
      h("label", {for: "height_cm"}, "Height (cm)", h("input", {id: "height_cm", type: "number", value: p.height_cm})),
      h("label", {for: "weight_kg"}, "Weight (kg)", h("input", {id: "weight_kg", type: "number", step: "0.1", value: p.weight_kg})),
      h("label", {for: "goal"}, "Goal", sel("goal", [["lose", "Lose fat"], ["maintain", "Stay the same"], ["gain", "Build muscle"]], p.goal)),
      h("label", {for: "activity"}, "Daily activity", sel("activity", [["sedentary", "Mostly sitting"], ["light", "Light (some walking)"], ["moderate", "Moderate (on my feet / training 3x)"], ["active", "Active (training most days)"], ["very", "Very active (physical job + training)"]], p.activity)),
      h("label", {for: "rate"}, "If losing: how fast", sel("rate", [[0.25, "Gently (0.25 kg/week)"], [0.5, "Steady (0.5 kg/week)"], [0.75, "Faster (0.75 kg/week)"]], p.rate)),
      h("label", {}, " ", h("button", {class: "primary", text: first ? "Start" : "Save"})));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const v = titan.validate(form, {age: s => +s >= 13 && +s <= 100 && Number.isInteger(+s) ? "" : "Age must be a whole number from 13 to 100.",
        height_cm: s => +s >= 100 && +s <= 250 ? "" : "Height in cm, 100 to 250.", weight_kg: s => +s >= 30 && +s <= 300 ? "" : "Weight in kg, 30 to 300."});
      if (!v) return;
      const all = {}; form.querySelectorAll("input[id], select[id]").forEach(el => { all[el.id] = el.value; });
      S.set("profile", {...all, ...v, rate: +all.rate}); titan.toast(first ? "All set. Here's your day." : "Saved"); show("today");
    });
    main.append(form);
    if (+p.age && +p.age < 18) main.append(h("p", {class: "muted", text: "Under 18: PrepRep never sets a target below the safe floor, and it's worth checking calorie goals with a doctor while you're still growing."}));
    if (first) return;
    const prices = h("div", {class: "card", style: "margin-top:18px"}, h("h2", {text: "Prices at your store"}), h("p", {class: "muted", text: "Change any batch price to match where you shop. Meal plans use these."}));
    RECIPES.forEach(r => {
      const inp = h("input", {type: "number", step: "0.01", value: (cost(r) / 100).toFixed(2), id: "price-" + r.id, style: "max-width:120px"});
      inp.addEventListener("change", () => { const all = S.get("prices"); all[r.id] = Math.round(+inp.value * 100); S.set("prices", all); });
      prices.append(h("label", {class: "check", for: "price-" + r.id}, h("span", {style: "flex:1", text: r.name}), inp));
    });
    main.append(prices);
    const cred = h("div", {class: "card credits", style: "margin-top:18px"}, h("h2", {text: "Photo credits"}));
    const ids = Object.keys(CREDITS);
    if (!ids.length) cred.append(h("p", {text: "No photos are packed in this build yet."}));
    ids.forEach(id => { const c = CREDITS[id], r = recipe(id);
      cred.append(h("p", {}, `${r ? r.name : id}: photo by ${c.artist}, ${c.license}, via Wikimedia Commons (`, h("a", {href: c.page, target: "_blank", rel: "noopener", text: "source"}), ")")); });
    main.append(cred);
  };

  /* ---- start ---- */
  (async () => {
    titan.state($("main"), "loading", {text: "Opening PrepRep…"});
    const load = f => fetch(f).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const [rec, ex, cr] = await Promise.all([load("data/recipes.json"), load("data/exercises.json"), load("photos/credits.json"), S.ready]);
    RECIPES = rec.recipes || []; EXERCISES = ex.exercises || []; CREDITS = cr || {};
    showBrain(); setInterval(showBrain, 60000);
    show(S.get("profile") ? "today" : "setup");
  })();
}
