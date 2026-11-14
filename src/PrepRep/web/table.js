/* Titan part: table. A sortable, searchable data table built safely from data (no innerHTML).
     titan.table(box, {columns: [{key: "team", label: "Team"}, {key: "wins", label: "Wins", num: true}],
                       rows: [{team: "Bulls", wins: 9}], search: true, empty: "No games yet"});
   Headers are real buttons (keyboard works) and announce their order with aria-sort.
   Returns {update(rows)} to redraw with new data. */
(function () {
  "use strict";
  let styled = false;
  function table(box, o) {
    if (!styled) {
      const st = document.createElement("style");
      st.textContent = ".t-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.t-table th,.t-table td{padding:8px 10px;border-bottom:1px solid var(--rule,#25323a);text-align:left}" +
        ".t-table .num{text-align:right}.t-table th button{all:unset;cursor:pointer;font-weight:600;color:var(--dim,#93a4ac)}.t-table th button:focus-visible{outline:2px solid var(--accent,#ff5a4e)}" +
        ".t-table tbody tr:hover{background:var(--raised,#1c262b)}.t-wrap{overflow-x:auto}.t-search{margin-bottom:10px;width:min(100%,320px)}";
      document.head.append(st); styled = true;
    }
    let rows = o.rows || [], sortKey = null, dir = 1, query = "";
    const wrap = document.createElement("div");
    const search = document.createElement("input");
    if (o.search) { search.type = "search"; search.className = "t-search"; search.placeholder = "Search…"; search.setAttribute("aria-label", "Search the table"); wrap.append(search); }
    const scroll = document.createElement("div"); scroll.className = "t-wrap";
    const tbl = document.createElement("table"); tbl.className = "t-table";
    const thead = document.createElement("thead"), tbody = document.createElement("tbody");
    tbl.append(thead, tbody); scroll.append(tbl); wrap.append(scroll); box.replaceChildren(wrap);
    const hr = document.createElement("tr");
    const ths = o.columns.map(c => {
      const th = document.createElement("th"); if (c.num) th.className = "num"; th.setAttribute("aria-sort", "none");
      const b = document.createElement("button"); b.textContent = c.label;
      b.addEventListener("click", () => { dir = sortKey === c.key ? -dir : 1; sortKey = c.key; draw(); });
      th.append(b); hr.append(th); return th;
    });
    thead.append(hr);
    search.addEventListener("input", () => { query = search.value.trim().toLowerCase(); draw(); });
    function draw() {
      ths.forEach((th, i) => th.setAttribute("aria-sort", o.columns[i].key === sortKey ? (dir > 0 ? "ascending" : "descending") : "none"));
      let list = rows.filter(r => !query || o.columns.some(c => String(r[c.key] ?? "").toLowerCase().includes(query)));
      if (sortKey) list = list.slice().sort((a, b) => { const x = a[sortKey], y = b[sortKey]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir; });
      tbody.replaceChildren();
      if (!list.length) { const tr = document.createElement("tr"), td = document.createElement("td"); td.colSpan = o.columns.length; td.className = "muted"; td.textContent = query ? "No matches" : (o.empty || "No rows yet"); tr.append(td); tbody.append(tr); return; }
      list.forEach(r => { const tr = document.createElement("tr"); o.columns.forEach(c => { const td = document.createElement("td"); if (c.num) td.className = "num"; td.textContent = c.format ? c.format(r[c.key], r) : String(r[c.key] ?? ""); tr.append(td); }); tbody.append(tr); });
    }
    draw();
    return {update(newRows) { rows = newRows || []; draw(); }};
  }
  window.titan = Object.assign(window.titan || {}, {table});
})();
