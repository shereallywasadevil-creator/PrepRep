/* Titan part: chart. Bar and line charts as SVG at real pixel size, redrawn when the box resizes, with
   direct labels and an accessible description. No library needed.
     titan.chart(box, {type: "bar", data: [{label: "Mon", value: 3}, ...], title: "Lessons per day"});
     titan.chart(box, {type: "line", data: [...], format: v => v + "%"});
   The box needs a height (CSS). Colours come from the theme tokens. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  function chart(box, o) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", (o.title || "Chart") + ": " + o.data.map(d => d.label + " " + d.value).join(", "));
    svg.style.width = "100%"; svg.style.height = "100%"; svg.style.display = "block";
    box.replaceChildren(svg);
    const fmt = o.format || (v => String(v));
    const mk = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text != null) e.textContent = text; svg.append(e); return e; };
    function draw() {
      const W = box.clientWidth || 300, H = box.clientHeight || 200, pad = {l: 8, r: 8, t: 22, b: 26};
      svg.replaceChildren(); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const max = Math.max(1, ...o.data.map(d => d.value)), n = o.data.length || 1;
      const x = i => pad.l + (W - pad.l - pad.r) * (o.type === "line" ? (n === 1 ? 0.5 : i / (n - 1)) : (i + 0.5) / n);
      const y = v => pad.t + (H - pad.t - pad.b) * (1 - v / max);
      mk("line", {x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), stroke: "var(--rule,#25323a)"});
      if (o.type === "line") {
        mk("polyline", {points: o.data.map((d, i) => x(i) + "," + y(d.value)).join(" "), fill: "none", stroke: "var(--accent,#ff5a4e)", "stroke-width": 2.5, "stroke-linejoin": "round"});
        o.data.forEach((d, i) => mk("circle", {cx: x(i), cy: y(d.value), r: 3.5, fill: "var(--accent,#ff5a4e)"}));
      } else {
        const bw = Math.max(4, (W - pad.l - pad.r) / n * 0.62);
        o.data.forEach((d, i) => mk("rect", {x: x(i) - bw / 2, y: y(d.value), width: bw, height: Math.max(0, y(0) - y(d.value)), rx: 4, fill: "var(--accent,#ff5a4e)"}));
      }
      const step = W < 520 ? Math.ceil(n / 6) : 1;
      o.data.forEach((d, i) => {
        if (i % step) return;
        mk("text", {x: x(i), y: H - 8, "text-anchor": "middle", "font-size": 12, fill: "var(--dim,#93a4ac)"}, d.label);
        mk("text", {x: x(i), y: y(d.value) - 6, "text-anchor": "middle", "font-size": 12, fill: "var(--ink,#eef3f5)"}, fmt(d.value));
      });
    }
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(box);
    return {redraw: draw};
  }
  window.titan = Object.assign(window.titan || {}, {chart});
})();
