---
toc: false
---
```js
    import {BirdMap} from "./components/birdmap.js";
    import {testview} from "./components/testview.js";
    import {StateBarChart} from "./components/statebarchart.js";
    import {LineChart} from "./components/linechart.js";
    import {HeatMap} from "./components/heatmap.js";

    // full data with spatial binning to reduce size.
    const birds_agg = await FileAttachment("data/birds-agg.parquet").parquet();
    const birds_clean = birds_agg.toArray().map(d => d.toJSON());
    console.log(birds_clean.length)

    // No aggregation, but limited to 10k samples
    const birds_raw = await FileAttachment("data/birds.parquet").parquet();
    const birds_raw_clean = birds_raw.toArray().map(d => d.toJSON());

    // full data with binning specifically for display of each month.
    const birds_month_bins = await FileAttachment("data/birds-month-bin.parquet").parquet();
    const birds_month_clean = birds_month_bins.toArray().map(d => d.toJSON());

    // List of all species
    const species = await FileAttachment("data/birds-species.parquet").parquet();
    const species_clean = species.toArray().map(d => d.toJSON());

    // Lists species x state -> bar chart
    const species_state = await FileAttachment("data/birds-species-state.parquet").parquet();
    const species_state_clean = species_state.toArray().map(d => d.toJSON());

    // (month x count) for line chart
    const species_month_obvcount = await FileAttachment("data/birds-species-month-obvcount.parquet").parquet();
    const species_month_obvcount_clean = species_month_obvcount.toArray().map(d => d.toJSON());

    // (state x month -> count) for heatmap
    const state_month_obvcount = await FileAttachment("data/birds-state-month-obvcount.parquet").parquet();
    const state_month_obvcount_clean = state_month_obvcount.toArray().map(d => d.toJSON());


    // Aggregate raw rows into {lat_bin, lng_bin, count, avg_flock} for the map
    const BIN_SIZE = 0.5;
    function aggregateForMap(rows) {
      const bins = new Map();
      for (const d of rows) {
        const lat = Number(d.lat);
        const lng = Number(d.lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;
        const lat_bin = Math.floor(lat / BIN_SIZE) * BIN_SIZE + BIN_SIZE / 2;
        const lng_bin = Math.floor(lng / BIN_SIZE) * BIN_SIZE + BIN_SIZE / 2;
        const key = `${lat_bin},${lng_bin}`;
        const entry = bins.get(key) || {sum: 0, flockSum: 0, n: 0};
        const obs = Number(d.observation_count) || 1;
        entry.sum += obs;
        entry.flockSum += obs;
        entry.n += 1;
        bins.set(key, entry);
      }
      return Array.from(bins, ([key, {sum, flockSum, n}]) => {
        const [lat_bin, lng_bin] = key.split(",").map(Number);
        return {lat_bin, lng_bin, count: sum, avg_flock: flockSum / n};
      });
    }

    // Date timeline — compute day-level range from raw data
    const ONE_DAY = 86400000;
    const allTimestamps = birds_raw_clean
      .map(d => Number(d.observation_date))
      .filter(t => t && !isNaN(t));
    const startDay = (() => {
      const d = new Date(Math.min(...allTimestamps));
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    })();
    const endDay = (() => {
      const d = new Date(Math.max(...allTimestamps));
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    })();
    const totalDays = Math.round((endDay - startDay) / ONE_DAY);

    // Map canvas — initially shows all pre-aggregated data
    const mapCanvas = BirdMap(birds_clean);
    const tableNode = testview(birds_raw_clean, 1000);
    const barChartNode = StateBarChart(species_clean, species_state_clean);
    const lineChartNode = LineChart(species_month_obvcount_clean);
    const heatMapNode = HeatMap(state_month_obvcount_clean);

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
      lineChartNode.setSpecies(commonName);
    };

    // Date slider widget — day-level granularity
    const dateSliderNode = (() => {
      const fmtFull = ts => new Date(ts).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
      });
      const fmtShort = ts => new Date(ts).toLocaleDateString("en-US", {
        month: "short", year: "numeric", timeZone: "UTC"
      });
      const fmtMonth = ts => new Date(ts).toLocaleDateString("en-US", {
        month: "long", year: "numeric", timeZone: "UTC"
      });

      const style = document.createElement("style");
      style.textContent = `
        .bds-wrap {
          padding: 10px 16px 8px; box-sizing: border-box;
          font-family: var(--sans-serif, sans-serif);
          display: flex; flex-direction: column; gap: 6px;
        }
        .bds-header {
          display: flex; justify-content: space-between; align-items: center;
        }
        .bds-label {
          font-size: 15px; font-weight: 700;
          color: var(--theme-foreground, #111);
        }
        .bds-controls {
          display: flex; gap: 6px; align-items: center;
        }
        .bds-btn {
          font-size: 11px; padding: 3px 10px; border-radius: 4px; cursor: pointer;
          border: 1px solid var(--theme-foreground-fainter, #ccc);
          background: var(--theme-background, #fff);
          color: var(--theme-foreground-muted, #555);
          font-family: inherit; transition: background 0.15s;
        }
        .bds-btn:hover { background: var(--theme-foreground-fainter, #eee); }
        .bds-btn.active {
          background: var(--theme-foreground, #111);
          color: var(--theme-background, #fff);
          border-color: var(--theme-foreground, #111);
        }
        .bds-track-wrap {
          position: relative; padding: 14px 0;
        }
        .bds-track {
          position: relative; height: 6px; border-radius: 3px;
          background: var(--theme-foreground-fainter, #ddd);
          cursor: pointer;
        }
        .bds-fill {
          position: absolute; top: 0; left: 0; bottom: 0;
          border-radius: 3px;
          background: var(--theme-foreground-focus, #3b82f6);
          pointer-events: none;
        }
        .bds-thumb {
          position: absolute; top: 50%;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--theme-foreground-focus, #3b82f6);
          border: 2px solid var(--theme-background, #fff);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .bds-tick {
          position: absolute; top: -10px; width: 1px; height: 8px;
          background: var(--theme-foreground-fainter, #aaa);
          pointer-events: none;
        }
        .bds-tick-label {
          position: absolute; top: 12px;
          font-size: 9px; color: var(--theme-foreground-muted, #999);
          transform: translateX(-50%); white-space: nowrap;
          pointer-events: none;
        }
        .bds-ends {
          display: flex; justify-content: space-between;
          font-size: 10px; color: var(--theme-foreground-muted, #888);
        }
      `;
      document.head.appendChild(style);

      const wrap = document.createElement("div");
      wrap.className = "bds-wrap";

      // Header: date label + controls
      const header = document.createElement("div");
      header.className = "bds-header";

      const label = document.createElement("span");
      label.className = "bds-label";

      const controls = document.createElement("div");
      controls.className = "bds-controls";

      const btnMonth = document.createElement("button");
      btnMonth.className = "bds-btn";
      btnMonth.textContent = "Month";

      const btnDay = document.createElement("button");
      btnDay.className = "bds-btn";
      btnDay.textContent = "Day";

      const btnAll = document.createElement("button");
      btnAll.className = "bds-btn active";
      btnAll.textContent = "All";

      controls.append(btnAll, btnMonth, btnDay);
      header.append(label, controls);

      // Custom slider track with month tick marks
      const trackWrap = document.createElement("div");
      trackWrap.className = "bds-track-wrap";

      const track = document.createElement("div");
      track.className = "bds-track";

      const fill = document.createElement("div");
      fill.className = "bds-fill";

      const thumb = document.createElement("div");
      thumb.className = "bds-thumb";

      // Generate month boundary ticks on the track
      const rangeStart = new Date(startDay);
      let tickDate = new Date(Date.UTC(
        rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1
      ));
      while (tickDate.getTime() <= endDay) {
        const dayOffset = Math.round((tickDate.getTime() - startDay) / ONE_DAY);
        const pct = (dayOffset / totalDays) * 100;
        if (pct > 2 && pct < 98) {
          const tick = document.createElement("div");
          tick.className = "bds-tick";
          tick.style.left = pct + "%";
          const tickLabel = document.createElement("span");
          tickLabel.className = "bds-tick-label";
          tickLabel.style.left = pct + "%";
          tickLabel.textContent = tickDate.toLocaleDateString("en-US", {
            month: "short", timeZone: "UTC"
          });
          track.append(tick, tickLabel);
        }
        tickDate = new Date(Date.UTC(
          tickDate.getUTCFullYear(), tickDate.getUTCMonth() + 1, 1
        ));
      }

      track.append(fill, thumb);
      trackWrap.append(track);

      // End labels
      const ends = document.createElement("div");
      ends.className = "bds-ends";
      ends.innerHTML = `<span>${fmtShort(startDay)}</span><span>${fmtShort(endDay)}</span>`;

      // Drag logic
      let sliderValue = 0;
      let dragging = false;

      function updateThumb() {
        const pct = (sliderValue / totalDays) * 100;
        thumb.style.left = pct + "%";
        fill.style.width = pct + "%";
      }

      function setValueFromEvent(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = track.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        sliderValue = Math.round(frac * totalDays);
        updateThumb();
        if (mode === "all") mode = "month";
        applySlider();
      }

      track.addEventListener("mousedown", e => { dragging = true; setValueFromEvent(e); });
      document.addEventListener("mousemove", e => { if (dragging) setValueFromEvent(e); });
      document.addEventListener("mouseup", () => { dragging = false; });
      track.addEventListener("touchstart", e => { dragging = true; setValueFromEvent(e); }, {passive: true});
      document.addEventListener("touchmove", e => { if (dragging) setValueFromEvent(e); }, {passive: true});
      document.addEventListener("touchend", () => { dragging = false; });

      updateThumb();

      // --- State ---
      let mode = "all"; // "all" | "month" | "day"

      function setActiveBtn(active) {
        btnAll.classList.toggle("active", active === "all");
        btnMonth.classList.toggle("active", active === "month");
        btnDay.classList.toggle("active", active === "day");
      }

      function applyAll() {
        mode = "all";
        setActiveBtn("all");
        label.textContent = "All dates";
        mapCanvas.update(birds_clean);
        tableNode.update(birds_raw_clean);
        barChartNode.update(null);
        currentRaw = birds_raw_clean;
        refreshHighlight();
      }

      function applyMonth(dayIdx) {
        mode = "month";
        setActiveBtn("month");
        const dayTs = startDay + dayIdx * ONE_DAY;
        const d = new Date(dayTs);
        const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
        const monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
        label.textContent = fmtMonth(monthStart);
        // Use pre-aggregated month data for the map
        const monthNum = d.getUTCMonth() + 1;
        const filtered = birds_month_clean.filter(r => Number(r.month) === monthNum);
        mapCanvas.update(filtered);
        const rawFiltered = birds_raw_clean.filter(r => {
          const t = Number(r.observation_date);
          return t >= monthStart && t < monthEnd;
        });
        tableNode.update(rawFiltered);
        barChartNode.update(rawFiltered);
        currentRaw = rawFiltered;
        refreshHighlight();
      }

      function applyDay(dayIdx) {
        mode = "day";
        setActiveBtn("day");
        const dayTs = startDay + dayIdx * ONE_DAY;
        const nextDayTs = dayTs + ONE_DAY;
        label.textContent = fmtFull(dayTs);
        const rawFiltered = birds_raw_clean.filter(r => {
          const t = Number(r.observation_date);
          return t >= dayTs && t < nextDayTs;
        });
        const mapData = aggregateForMap(rawFiltered);
        mapCanvas.update(mapData);
        tableNode.update(rawFiltered);
        barChartNode.update(rawFiltered);
        currentRaw = rawFiltered;
        refreshHighlight();
      }

      function applySlider() {
        if (mode === "month") applyMonth(sliderValue);
        else if (mode === "day") applyDay(sliderValue);
      }

      applyAll();

      btnAll.addEventListener("click", applyAll);
      btnMonth.addEventListener("click", () => {
        mode = "month";
        applySlider();
      });
      btnDay.addEventListener("click", () => {
        mode = "day";
        applySlider();
      });

      wrap.append(header, trackWrap, ends);
      return wrap;
    })();
```

<div class="hero">
  <h1>bird-vis</h1>
</div>
<div class="main">
    <div class="main-left"> 
        <div class="main-left-top"> 
            <div class="main-left-map">${mapCanvas}</div>
            <div class="main-left-slider">${dateSliderNode}</div>
        </div>
        <div class="main-left-bottom"> 
        ${barChartNode}
        </div>
    </div>
    <div class="main-right"> 
        <div class="main-right-middle"> 
        ${heatMapNode}
        </div>
        <div class="main-right-bottom"> 
        ${lineChartNode}
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
        /* background-color: pink; */
        background-color: var(--theme-background-alt, #f8f8f8);
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
    .main-right-middle, .main-right-bottom {
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
        display: flex;
        flex-direction: column;
    }

    .main-left-map {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .main-left-slider {
        flex: 0 0 auto;
        border-top: 1px solid var(--theme-foreground-fainter, #e0e0e0);
    }

    .main-left-bottom {
        width: 100%;
        height: 25%;
    }

    .main-right-middle, .main-right-bottom {
        width: 100%;
        height: 49%;
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

