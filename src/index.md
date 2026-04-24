---
toc: false
---
```js
    import {BirdMap} from "./components/birdmap.js";
    import {testview} from "./components/testview.js";

    // full data with binning to reduce size.
    const birds_agg = await FileAttachment("data/birds-agg.parquet").parquet();
    const birds_clean = birds_agg.toArray().map(d => d.toJSON());

    // No aggregation, but limited to 10k samples
    const birds_raw = await FileAttachment("data/birds.parquet").parquet();
    const birds_raw_clean = birds_raw.toArray().map(d => d.toJSON());

    // full data with binning specifically for display of each month.
    const birds_month_bins = await FileAttachment("data/birds-month-bin.parquet").parquet();
    const birds_month_clean = birds_month_bins.toArray().map(d => d.toJSON());

    // Aggregate raw rows into {lat_bin, lng_bin, count} for the map
    function aggregateForMap(rows) {
      const bins = new Map();
      for (const d of rows) {
        const lat = Number(d.lat);
        const lng = Number(d.lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;
        const lat_bin = Math.round(lat);
        const lng_bin = Math.round(lng);
        const key = `${lat_bin},${lng_bin}`;
        bins.set(key, (bins.get(key) || 0) + (Number(d.observation_count) || 1));
      }
      return Array.from(bins, ([key, count]) => {
        const [lat_bin, lng_bin] = key.split(",").map(Number);
        return {lat_bin, lng_bin, count};
      });
    }

    // Unique sorted months derived from raw data
    const uniqueMonths = [...new Map(
      birds_raw_clean.flatMap(d => {
        const t = Number(d.observation_date);
        if (!t || isNaN(t)) return [];
        const dt = new Date(t);
        const year = dt.getUTCFullYear();
        const month = dt.getUTCMonth();
        const key = `${year}-${month}`;
        return [[key, {
          year, month,
          ts: Date.UTC(year, month, 1),
          endTs: Date.UTC(year, month + 1, 1)
        }]];
      })
    ).values()].sort((a, b) => a.ts - b.ts);

    // Map canvas — initially shows all pre-aggregated data
    const mapCanvas = BirdMap(birds_clean);
    const tableNode = testview(birds_raw_clean, 1000);

    let currentRaw = birds_raw_clean;
    let currentSelection = null;
    let currentSelectedRow = null;

    function refreshHighlight() {
      if (!currentSelection) { mapCanvas.highlight(null, null); return; }
      const pts = aggregateForMap(currentRaw.filter(d => d.common_name === currentSelection));
      const primaryPts = currentSelectedRow ? aggregateForMap([currentSelectedRow]) : null;
      const primary = primaryPts && primaryPts.length ? primaryPts[0] : null;
      mapCanvas.highlight(pts, primary);
    }

    tableNode.onSelect = (commonName, row) => {
      currentSelection = commonName;
      currentSelectedRow = row;
      refreshHighlight();
    };

    // Month slider widget
    const dateSliderNode = (() => {
      const fmtMonth = ts => new Date(ts).toLocaleDateString("en-US", {
        month: "long", year: "numeric", timeZone: "UTC"
      });
      const fmtShort = ts => new Date(ts).toLocaleDateString("en-US", {
        month: "short", year: "numeric", timeZone: "UTC"
      });

      const style = document.createElement("style");
      style.textContent = `
        .bds-wrap {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 7px 16px 10px; box-sizing: border-box;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          border-top: 1px solid rgba(0,0,0,0.07);
          font-family: var(--sans-serif, sans-serif);
          display: flex; flex-direction: column; gap: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .bds-wrap {
            background: rgba(12,12,12,0.82);
            border-top-color: rgba(255,255,255,0.07);
          }
        }
        .bds-header { display:flex; justify-content:space-between; align-items:baseline; }
        .bds-label { font-size:13px; font-weight:600; color:var(--theme-foreground,#111); }
        .bds-btn { font-size:11px; color:var(--theme-foreground-muted,#888); cursor:pointer; text-decoration:underline; border:none; background:none; padding:0; }
        .bds-slider { width:100%; cursor:pointer; }
        .bds-ends { display:flex; justify-content:space-between; font-size:11px; color:var(--theme-foreground-muted,#888); }
        .bds-count { font-size:11px; color:var(--theme-foreground-muted,#888); text-align:center; }
      `;
      document.head.appendChild(style);

      const wrap = document.createElement("div");
      wrap.className = "bds-wrap";

      const header = document.createElement("div");
      header.className = "bds-header";

      const label = document.createElement("span");
      label.className = "bds-label";

      const btn = document.createElement("button");
      btn.className = "bds-btn";

      header.append(label, btn);

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "bds-slider";
      slider.min = 0;
      slider.max = Math.max(0, uniqueMonths.length - 1);
      slider.value = 0;
      slider.step = 1;

      const ends = document.createElement("div");
      ends.className = "bds-ends";
      if (uniqueMonths.length) {
        ends.innerHTML = `<span>${fmtShort(uniqueMonths[0].ts)}</span><span>${fmtShort(uniqueMonths[uniqueMonths.length - 1].ts)}</span>`;
      }

      const countEl = document.createElement("div");
      countEl.className = "bds-count";

      let showingAll = true;

      function applyAll() {
        showingAll = true;
        label.textContent = "All months";
        btn.textContent = "Filter by month ›";
        mapCanvas.update(birds_clean);
        tableNode.update(birds_raw_clean);
        currentRaw = birds_raw_clean;
        refreshHighlight();
      }

      function applyMonth(idx) {
        showingAll = false;
        const {ts, endTs, month} = uniqueMonths[idx];
        label.textContent = fmtMonth(ts);
        btn.textContent = "Show all";
        // uniqueMonths uses 0-indexed getUTCMonth(); birds_month_clean uses 1-indexed
        const monthNum = month + 1; 
        const filtered = birds_month_clean.filter(d => Number(d.month) === monthNum);
        mapCanvas.update(filtered);
        const rawFiltered = birds_raw_clean.filter(d => {
          const t = Number(d.observation_date);
          return t >= ts && t < endTs;
        });
        tableNode.update(rawFiltered);
        currentRaw = rawFiltered;
        refreshHighlight();
      }

      applyAll();

      slider.addEventListener("input", () => applyMonth(Number(slider.value)));

      btn.addEventListener("click", () => {
        if (showingAll) applyMonth(Number(slider.value));
        else applyAll();
      });

      wrap.append(header, slider, ends, countEl);
      return wrap;
    })();
```

<div class="hero">
  <h1>bird-vis</h1>
</div>
<div class="main">
    <div class="main-left"> 
        <div class="main-left-top"> 
        ${mapCanvas}
        ${dateSliderNode}
        </div>
        <div class="main-left-bottom"> 
        </div>
    </div>
    <div class="main-right"> 
        <div class="main-right-top"> 
        </div>
        <div class="main-right-middle"> 
        </div>
        <div class="main-right-bottom"> 
        </div>
    </div>
</div>
<div class="below-main full-width-output">
    ${tableNode}
</div>

<style>
    body, html {
        margin: 0 !important;
        padding: 0 !important;
    }

    .observablehq-pre-container {
        display: none;
    }

    #observablehq, #observablehq-center, #observablehq-main {
        max-width: none !important;
        width: 100vw !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    #observablehq-main {
        display: flex;
        flex-direction: column;
    }

    footer {
        display: none;
    }

    footer#observablehq-footer {
        display: none;
    }

    #observablehq-sidebar {
        display: none;
        margin-left: -100vw;
    }

    #observablehq-sidebar-toggle {
        margin: 0;
        margin-left: -100vw;
        padding: 0;
        display: none;
    }

    .below-main, .main {
        width: 95vw;
        margin-left: 2%;
    }
    .below-main {
        height: 40vh;
<<<<<<< HEAD
        /* background-color: pink; */
=======
        background-color: var(--theme-background-alt, #f8f8f8);
>>>>>>> 0028557737f43f446eb487c498faea26298bfeef
        margin-top: 2%;
        border: 1px solid var(--theme-foreground-fainter, #e0e0e0);
        border-radius: 20px;
        overflow: hidden;
        box-sizing: border-box;
    }

    .main {
        height: 125vh;
        display: flex;
        gap: 2%;
    }

    .main-left {
        width: 65%;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 2%;
    }

    .main-right {
        display: flex;
        flex-direction: column;
        width: 35%;
        height: 100%;
        gap: 2%;
    }

    .main-left-top, .main-left-bottom,
    .main-right-top, .main-right-middle, .main-right-bottom {
        border: 1px solid var(--theme-foreground-fainter, #e0e0e0);
        border-radius: 12px;
        background-color: var(--theme-background-alt, #f8f8f8);
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        overflow: hidden;
    }

    .main-left-top {
        width: 100%;
        height: 75%;
        position: relative;
    }

    .main-left-bottom {
        width: 100%;
        height: 25%;
    }

    .main-right-top, .main-right-middle, .main-right-bottom {
        width: 100%;
        height: 33%;
    }

    .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: var(--sans-serif);
        margin: 4rem 0 8rem;
        margin-bottom: 0;
        text-wrap: balance;
        text-align: center;
    }

    .hero h1 {
        margin: 1rem 0;
        padding: 1rem 0;
        max-width: none;
        font-size: 14vw;
        font-weight: 900;
        line-height: 1;
        background: linear-gradient(30deg, var(--theme-foreground-focus), currentColor);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .hero h2 {
        margin: 0;
        max-width: 34em;
        font-size: 20px;
        font-style: initial;
        font-weight: 500;
        line-height: 1.5;
        color: var(--theme-foreground-muted);
    }


    @media (min-width: 640px) {
        .hero h1 {
            font-size: 90px;
      }
    }

</style>
```

