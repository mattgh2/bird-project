import * as d3 from "npm:d3";
import {DuckDBClient} from "npm:@observablehq/duckdb";

export function testview(data, maxRows = 1000) {
  const parseDate = d => new Date(Number(d.observation_date));
  const formatDate = d3.utcFormat("%b %d, %Y");

  const rows = [...data].sort(
    (a, b) => Number(a.observation_date) - Number(b.observation_date)
  );

  const container = d3.create("div")
    .attr("class", "bird-table-wrap");

  const controlRow = container.append("div")
    .attr("class", "bird-controls");

  const search = controlRow.append("input")
    .attr("type", "search")
    .attr("placeholder", "Search bird name...")
    .attr("class", "bird-search");

  const dayWrap = controlRow.append("div")
    .attr("class", "bird-day-wrap");

  const dayLabel = dayWrap.append("span")
    .attr("class", "bird-day-label")
    .text("All days");

  const daySlider = dayWrap.append("input")
    .attr("type", "range")
    .attr("class", "bird-day-slider")
    .attr("min", 0)
    .attr("max", 31)
    .attr("value", 0)
    .attr("step", 1);

  const count = container.append("div")
    .attr("class", "bird-count");

  const tableBox = container.append("div")
    .attr("class", "bird-table-box");

  const table = tableBox.append("table")
    .attr("class", "bird-table");

  const thead = table.append("thead");
  const tbody = table.append("tbody");

  const columns = [
    ["Date", d => formatDate(parseDate(d))],
    ["Common Name", d => d.common_name ?? ""],
    ["Scientific Name", d => d.scientific_name ?? ""],
    ["Observation Count", d => d.observation_count ?? ""],
    ["State", d => d.state ?? ""],
    ["County", d => d.county ?? ""],
    ["Locality", d => d.locality ?? ""],
    ["Latitude", d => d.lat?.toFixed?.(4) ?? d.lat ?? ""],
    ["Longitude", d => d.lng?.toFixed?.(4) ?? d.lng ?? ""],
    ["Duration Minutes", d => d.duration_minutes?.toString?.() ?? ""]
  ];

  thead.append("tr")
    .selectAll("th")
    .data(columns)
    .join("th")
    .text(d => d[0]);

  let selectedName = null;
  let selectedDay = 0; // 0 = all days

  function render(filteredRows) {
    const shown = filteredRows.slice(0, maxRows);

    count.text(
      `Showing ${shown.length.toLocaleString()} of ${filteredRows.length.toLocaleString()} rows`
    );

    const tr = tbody.selectAll("tr")
      .data(shown)
      .join("tr")
      .classed("bird-row-selected", d => d.common_name === selectedName)
      .style("cursor", "pointer")
      .on("click", function(event, d) {
        const name = d.common_name ?? null;
        selectedName = selectedName === name ? null : name;
        tbody.selectAll("tr").classed("bird-row-selected", row => row.common_name === selectedName);
        if (node.onSelect) node.onSelect(selectedName);
      });

    tr.selectAll("td")
      .data(row => columns.map(([_, value]) => value(row)))
      .join("td")
      .text(d => d);
  }

  let baseRows = rows;

  function applyFilters() {
    const q = search.property("value").trim().toLowerCase();
    let filtered = baseRows;
    if (selectedDay > 0) {
      filtered = filtered.filter(d => new Date(Number(d.observation_date)).getUTCDate() === selectedDay);
    }
    if (q) filtered = filtered.filter(d => (d.common_name ?? "").toLowerCase().includes(q));
    render(filtered);
  }

  render(baseRows);

  search.on("input", applyFilters);

  daySlider.on("input", function() {
    selectedDay = +this.value;
    dayLabel.text(selectedDay === 0 ? "All days" : `Day ${selectedDay}`);
    applyFilters();
  });

  const node = container.node();
  node.update = function(newRows) {
    baseRows = [...newRows].sort((a, b) => Number(a.observation_date) - Number(b.observation_date));
    applyFilters();
  };

  container.append("style").text(`
    .bird-table-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      font: 14px var(--sans-serif, sans-serif);
      color: var(--theme-foreground, #111);
      background: var(--theme-background, #fff);
    }

    .bird-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .bird-search {
      flex: 1 1 0;
      min-width: 0;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid var(--theme-foreground-fainter, #ccc);
      border-radius: 6px;
      background: var(--theme-background, #fff);
      color: var(--theme-foreground, #111);
      outline: none;
    }

    .bird-search:focus {
      border-color: var(--theme-foreground-muted, #888);
    }

    .bird-day-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      width: 120px;
    }

    .bird-day-label {
      font-size: 11px;
      color: var(--theme-foreground-muted, #888);
      white-space: nowrap;
    }

    .bird-day-slider {
      width: 100%;
      cursor: pointer;
    }

    .bird-count {
      margin-bottom: 6px;
      font-size: 12px;
      color: var(--theme-foreground-muted, #666);
    }

    .bird-table-box {
      flex: 1 1 0;
      min-height: 0;
      overflow: auto;
      border: 1px solid var(--theme-foreground-fainter, #d0d0d0);
      border-radius: 8px;
      background: var(--theme-background, #fff);
    }

    .bird-table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
    }

    .bird-table tbody tr {
      background: var(--theme-background, #fff);
    }

    .bird-table th,
    .bird-table td {
      padding: 4px 10px;
      border-bottom: 1px solid var(--theme-foreground-fainter, #ddd);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      color: var(--theme-foreground, #111);
    }

    .bird-table th {
      position: sticky;
      top: 0;
      background: var(--theme-background-alt, #f3f3f3);
      color: var(--theme-foreground, #111);
      font-weight: 700;
      z-index: 1;
    }

    .bird-table tbody tr:hover {
      background: var(--theme-background-alt, #f5f5f5);
    }

    .bird-row-selected, .bird-row-selected:hover {
      background: rgba(220, 30, 30, 0.12) !important;
    }
  `);

  return node;
}
