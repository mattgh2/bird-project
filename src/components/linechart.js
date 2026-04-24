import * as d3 from "npm:d3";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function LineChart(speciesMonthData) {
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Auto-detect the count column — anything that isn't species or month
  const sample = speciesMonthData[0];
  const countKey = sample
    ? Object.keys(sample).find(k => k !== "species" && k !== "month") ?? "obvcount"
    : "obvcount";
  console.log("[LineChart] sample row:", sample, "→ using count key:", countKey);

  const container = document.createElement("div");
  container.style.cssText = "width:100%;height:100%;box-sizing:border-box;overflow:hidden;font-family:var(--sans-serif,sans-serif);";

  const svg = d3.select(container).append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block");

  const g = svg.append("g");

  const placeholder = svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .attr("fill", darkMode ? "#666" : "#aaa")
    .text("Select a species from the table");

  const margin = { top: 34, right: 18, bottom: 52, left: 64 };

  // Dimensions tracked by ResizeObserver so they're never stale
  let W = 0, H = 0;

  function positionPlaceholder() {
    placeholder.attr("x", W / 2).attr("y", H / 2);
  }

  function draw(speciesName) {
    if (!speciesName || W === 0 || H === 0) return;

    placeholder.style("display", "none");
    g.selectAll("*").remove();

    const rows = speciesMonthData
      .filter(d => d.species === speciesName)
      .map(d => ({ month: Number(d.month), count: Number(d[countKey]) }))
      .filter(d => !isNaN(d.month) && !isNaN(d.count))
      .sort((a, b) => a.month - b.month);

    if (!rows.length) {
      placeholder.style("display", null).text("No monthly data for this species");
      positionPlaceholder();
      return;
    }

    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    g.attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([1, 12])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.count)])
      .nice()
      .range([innerH, 0]);

    const lineColor = darkMode ? "#5b8dd9" : "#2563eb";

    // Y axis with grid lines
    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick line")
        .attr("stroke", darkMode ? "#333" : "#eee"))
      .call(ax => ax.selectAll("text")
        .attr("font-size", 10)
        .attr("fill", darkMode ? "#aaa" : "#666"));

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x)
        .ticks(12)
        .tickFormat(m => MONTH_LABELS[m - 1])
        .tickSize(0))
      .call(ax => ax.select(".domain").attr("stroke", darkMode ? "#555" : "#ccc"))
      .call(ax => ax.selectAll("text")
        .attr("font-size", 10)
        .attr("dy", "1.2em")
        .attr("fill", darkMode ? "#ccc" : "#444"));

    // Line
    const line = d3.line()
      .x(d => x(d.month))
      .y(d => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(rows)
      .attr("fill", "none")
      .attr("stroke", lineColor)
      .attr("stroke-width", 2)
      .attr("d", line);

    // Dots
    g.selectAll("circle")
      .data(rows)
      .join("circle")
        .attr("cx", d => x(d.month))
        .attr("cy", d => y(d.count))
        .attr("r", 3.5)
        .attr("fill", lineColor)
        .attr("stroke", darkMode ? "#1a1a1a" : "#fff")
        .attr("stroke-width", 1.5);

    const labelColor = darkMode ? "#aaa" : "#555";

    // Chart title (sits above the plot area, in SVG coords before the g transform)
    svg.selectAll(".chart-title").remove();
    svg.append("text")
      .attr("class", "chart-title")
      .attr("x", W / 2)
      .attr("y", 14)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "hanging")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("fill", labelColor)
      .text("Month vs Species Observation Count");

    // X-axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 44)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", labelColor)
      .text("Month");

    // Y-axis label
    g.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -(innerH / 2))
      .attr("y", -52)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "hanging")
      .attr("font-size", 11)
      .attr("fill", labelColor)
      .text("Observation Count");
  }

  const ro = new ResizeObserver(entries => {
    const rect = entries[0].contentRect;
    W = rect.width;
    H = rect.height;
    if (container._currentSpecies) draw(container._currentSpecies);
    else positionPlaceholder();
  });
  ro.observe(container);

  container.setSpecies = function(speciesName) {
    container._currentSpecies = speciesName || null;
    if (!speciesName) {
      g.selectAll("*").remove();
      svg.selectAll(".chart-title").remove();
      placeholder.style("display", null).text("Select a species from the table");
      positionPlaceholder();
    } else {
      draw(speciesName);
    }
  };

  return container;
}
