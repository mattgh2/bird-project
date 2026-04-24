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

  const search = container.append("input")
    .attr("type", "search")
    .attr("placeholder", "Search bird name...")
    .attr("class", "bird-search");

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

  function render(filteredRows) {
    const shown = filteredRows.slice(0, maxRows);

    count.text(
      `Showing ${shown.length.toLocaleString()} of ${filteredRows.length.toLocaleString()} rows`
    );

    const tr = tbody.selectAll("tr")
      .data(shown)
      .join("tr");

    tr.selectAll("td")
      .data(row => columns.map(([_, value]) => value(row)))
      .join("td")
      .text(d => d);
  }

  render(rows);

  search.on("input", event => {
    const q = event.target.value.trim().toLowerCase();

    const filtered = q
      ? rows.filter(d => (d.common_name ?? "").toLowerCase().includes(q))
      : rows;

    render(filtered);
  });

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

    .bird-search {
      box-sizing: border-box;
      width: 100%;
      margin-bottom: 6px;
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
  `);

  return container.node();
}
