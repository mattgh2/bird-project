import * as d3 from "npm:d3";

export function StateBarChart(speciesClean, speciesStateClean) {
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const container = document.createElement("div");
  container.style.cssText = "width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;font-family:var(--sans-serif,sans-serif);";

  // --- Selector row ---
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px 4px;flex-shrink:0;";

  const label = document.createElement("label");
  label.textContent = "Species";
  label.style.cssText = "font-size:12px;font-weight:600;color:var(--theme-foreground-muted,#888);white-space:nowrap;";

  const select = document.createElement("select");
  select.style.cssText = `
    font-size:12px; padding:3px 6px; border-radius:5px; border:1px solid ${darkMode ? "#555" : "#ccc"};
    background:${darkMode ? "#222" : "#fff"}; color:${darkMode ? "#eee" : "#111"};
    cursor:pointer; flex:1; min-width:0;
  `;

  // Derive species names — species_clean rows may use common_name or species
  const nameKey = speciesClean.length && "common_name" in speciesClean[0] ? "common_name" : "species";
  const speciesNames = [...new Set(speciesClean.map(d => d[nameKey]))].filter(Boolean).sort();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— select a species —";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  for (const name of speciesNames) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }

  header.append(label, select);
  container.appendChild(header);

  // --- SVG chart area ---
  const svgWrap = document.createElement("div");
  svgWrap.style.cssText = "flex:1;min-height:0;overflow-x:auto;overflow-y:hidden;padding:0 8px 8px;box-sizing:border-box;";
  container.appendChild(svgWrap);

  const svg = d3.select(svgWrap).append("svg")
    .attr("height", "100%")
    .style("display", "block")
    .style("min-width", "100%");

  const g = svg.append("g");

  const empty = svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .attr("fill", darkMode ? "#666" : "#aaa")
    .text("Select a species to view state distribution");

  let currentData = speciesStateClean;

  function aggregateFromRaw(rawRows) {
    const bins = new Map();
    for (const d of rawRows) {
      if (!d.common_name || !d.state) continue;
      const key = `${d.common_name}\0${d.state}`;
      bins.set(key, (bins.get(key) || 0) + (Number(d.observation_count) || 1));
    }
    return Array.from(bins, ([key, count]) => {
      const [species, state] = key.split("\0");
      return { species, state, count };
    });
  }

  function draw(speciesName) {
    empty.style("display", "none");

    const rows = currentData
      .filter(d => d.species === speciesName)
      .map(d => ({ state: String(d.state), count: Number(d.count) }))
      .sort((a, b) => b.count - a.count);

    if (!rows.length) {
      g.selectAll("*").remove();
      empty.style("display", null).text("No data for this species");
      return;
    }

    const wrapRect = svgWrap.getBoundingClientRect();
    const H = wrapRect.height || 200;

    const margin = { top: 8, right: 16, bottom: 54, left: 44 };
    const barStep = 18;
    const innerW = rows.length * barStep;
    const W = innerW + margin.left + margin.right;
    const innerH = H - margin.top - margin.bottom;

    svg.attr("width", Math.max(W, wrapRect.width || 0));
    g.attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
      .domain(rows.map(d => d.state))
      .range([0, innerW])
      .padding(0.35);

    const y = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.count)])
      .nice()
      .range([innerH, 0]);

    const color = darkMode ? "#5b8dd9" : "#2563eb";

    g.selectAll("*").remove();

    // Bars
    g.selectAll("rect")
      .data(rows)
      .join("rect")
        .attr("x", d => x(d.state))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => innerH - y(d.count))
        .attr("fill", color)
        .attr("rx", 2);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(ax => ax.select(".domain").attr("stroke", darkMode ? "#555" : "#ccc"))
      .call(ax => ax.selectAll("text")
        .attr("transform", "rotate(-50)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.4em")
        .attr("dy", "0.6em")
        .attr("font-size", Math.max(8, Math.min(11, Math.floor(innerW / rows.length) - 1)))
        .attr("fill", darkMode ? "#ccc" : "#444"));

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick line")
        .attr("stroke", darkMode ? "#333" : "#eee"))
      .call(ax => ax.selectAll("text")
        .attr("font-size", 10)
        .attr("fill", darkMode ? "#aaa" : "#666"));
  }

  // Position the "select a species" message centered
  function positionEmpty() {
    const wrapRect = svgWrap.getBoundingClientRect();
    const W = wrapRect.width || 600;
    const H = wrapRect.height || 200;
    empty.attr("x", W / 2).attr("y", H / 2);
  }

  const ro = new ResizeObserver(() => {
    if (select.value) draw(select.value);
    else positionEmpty();
  });
  ro.observe(container);

  select.addEventListener("change", () => draw(select.value));

  positionEmpty();

  container.update = function(rawRows) {
    currentData = rawRows == null ? speciesStateClean : aggregateFromRaw(rawRows);
    if (select.value) draw(select.value);
  };

  return container;
}
