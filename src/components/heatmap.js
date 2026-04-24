import * as d3 from "npm:d3";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function HeatMap(stateMonthData) {
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const parsed = stateMonthData.map(d => ({
    state: String(d.state),
    month: Number(d.month),
    count: Number(d.observation_count)
  })).filter(d => !isNaN(d.month) && !isNaN(d.count));

  const states = [...new Set(parsed.map(d => d.state))].sort();
  const lookup = new Map(parsed.map(d => [`${d.state}\0${d.month}`, d.count]));
  const maxCount = d3.max(parsed, d => d.count) || 1;

  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxCount]);
  const fmt = d3.format(",");
  const textColor = darkMode ? "#aaa" : "#555";

  // --- Root container ---
  const container = document.createElement("div");
  container.style.cssText = "width:100%;height:100%;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;font-family:var(--sans-serif,sans-serif);";

  // --- Header: title + legend ---
  const header = document.createElement("div");
  header.style.cssText = "flex-shrink:0;padding:8px 12px 4px;";

  const titleEl = document.createElement("div");
  titleEl.textContent = "State × Month vs Observation Count";
  titleEl.style.cssText = `font-size:11px;font-weight:600;color:${textColor};text-align:center;margin-bottom:4px;`;
  header.appendChild(titleEl);

  // Legend SVG — rebuilt on resize
  let legendNode = null;
  function buildLegend(W) {
    if (legendNode) legendNode.remove();
    const gradId = "hm-legend-grad";
    const barW = Math.min(160, Math.max(80, W * 0.55));
    const barX = (W - barW) / 2;
    const lH = 22;

    const svg = d3.create("svg").attr("width", "100%").attr("height", lH).style("display", "block");
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("x2", "100%");
    for (const t of d3.range(0, 1.05, 0.1)) {
      grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", colorScale(t * maxCount));
    }
    svg.append("rect").attr("x", barX).attr("y", 2).attr("width", barW).attr("height", 10).attr("fill", `url(#${gradId})`).attr("rx", 2);

    const tickColor = darkMode ? "#888" : "#777";
    for (const [anchor, value, offset] of [["start", 0, 0], ["middle", maxCount / 2, barW / 2], ["end", maxCount, barW]]) {
      svg.append("text").attr("x", barX + offset).attr("y", lH - 1)
        .attr("text-anchor", anchor).attr("font-size", 9).attr("fill", tickColor)
        .text(fmt(Math.round(value)));
    }

    legendNode = svg.node();
    header.appendChild(legendNode);
  }

  container.appendChild(header);

  // --- Scrollable chart area ---
  const chartWrap = document.createElement("div");
  chartWrap.style.cssText = "flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;";
  container.appendChild(chartWrap);

  const leftMargin = 72;
  const topMargin = 18;
  const cellH = 13;
  const rightMargin = 6;

  let currentW = 0;

  function buildChart(W) {
    chartWrap.innerHTML = "";
    const cellW = Math.max(6, (W - leftMargin - rightMargin) / 12);
    const svgW = leftMargin + 12 * cellW + rightMargin;
    const svgH = topMargin + states.length * cellH + 2;

    const svg = d3.select(chartWrap).append("svg")
      .attr("width", svgW)
      .attr("height", svgH)
      .style("display", "block");

    const g = svg.append("g").attr("transform", `translate(${leftMargin},${topMargin})`);

    // Month column headers
    for (let m = 1; m <= 12; m++) {
      g.append("text")
        .attr("x", (m - 1) * cellW + cellW / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", textColor)
        .text(MONTH_LABELS[m - 1]);
    }

    // State rows
    states.forEach((state, si) => {
      const y = si * cellH;

      g.append("text")
        .attr("x", -4)
        .attr("y", y + cellH / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", 9)
        .attr("fill", textColor)
        .text(state);

      for (let m = 1; m <= 12; m++) {
        const count = lookup.get(`${state}\0${m}`) ?? 0;
        g.append("rect")
          .attr("x", (m - 1) * cellW)
          .attr("y", y)
          .attr("width", cellW - 1)
          .attr("height", cellH - 1)
          .attr("fill", count === 0 ? (darkMode ? "#222" : "#f0f0f0") : colorScale(count))
          .attr("rx", 1);
      }
    });
  }

  const ro = new ResizeObserver(entries => {
    const W = entries[0].contentRect.width;
    if (W === currentW || W === 0) return;
    currentW = W;
    buildLegend(W);
    buildChart(W);
  });
  ro.observe(container);

  return container;
}
