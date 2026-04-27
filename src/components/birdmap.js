import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

const us = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
  .then(r => r.json());

const states = topojson.feature(us, us.objects.states);
const stateFeatures = states.features;
const counties = topojson.feature(us, us.objects.counties);
const countyFeatures = counties.features;

// --- Hex grid utilities (pointy-top) ---
const HEX_RADIUS = 7;
const SQRT3 = Math.sqrt(3);

function pixelToAxial(x, y) {
  const q = (SQRT3 / 3 * x - y / 3) / HEX_RADIUS;
  const r = (2 / 3 * y) / HEX_RADIUS;
  return hexRound(q, r);
}

function axialToPixel(q, r) {
  const x = HEX_RADIUS * (SQRT3 * q + SQRT3 / 2 * r);
  const y = HEX_RADIUS * (3 / 2 * r);
  return [x, y];
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

function hexPath(ctx, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Bin projected points into hex cells
function hexBin(pointData, projection) {
  const bins = new Map();
  for (const d of pointData) {
    const p = projection([d.lng_bin, d.lat_bin]);
    if (!p) continue;
    const [q, r] = pixelToAxial(p[0], p[1]);
    const key = `${q},${r}`;
    const entry = bins.get(key);
    if (entry) {
      entry.count += d.count;
      entry.flockSum += (d.avg_flock || 1) * d.count;
      entry.totalObs += d.count;
    } else {
      bins.set(key, {
        q, r,
        count: d.count,
        flockSum: (d.avg_flock || 1) * d.count,
        totalObs: d.count,
      });
    }
  }
  const result = [];
  for (const cell of bins.values()) {
    const [cx, cy] = axialToPixel(cell.q, cell.r);
    result.push({
      cx, cy,
      count: cell.count,
      avg_flock: cell.flockSum / cell.totalObs,
    });
  }
  return result;
}

// Bivariate palette: bilinear interpolation in Lab space between 4 corners.
// (td, tf) ∈ [0,1]² where td = density, tf = flock size.
function makeBivariate(c00, c10, c01, c11) {
  return (td, tf) => {
    const top = d3.interpolateLab(c00, c10)(td);
    const bot = d3.interpolateLab(c01, c11)(td);
    return d3.interpolateLab(top, bot)(tf);
  };
}

// Stevens-style pink/blue: density →, flock ↑
const densityBivariate = makeBivariate(
  "#c8c8c8", "#2f6f80",  // low flock:  mid-gray → deep teal
  "#a73838", "#1f2a6b"   // high flock: dark rose → deep indigo
);

// Highlight palette: yellow/orange axis × purple axis
const highlightBivariate = makeBivariate(
  "#fff5eb", "#e6550d",  // low flock:  cream → red-orange
  "#9e9ac8", "#3f007d"   // high flock: light purple → deep purple
);

export function BirdMap(data) {
  const width = 960;
  const height = 600;

  let selectedState = null;
  let currentPoints = data;
  let highlightPoints = null;
  let primaryPoint = null;

  let projection = d3.geoAlbersUsa().fitSize([width, height], states);
  let path = d3.geoPath(projection);

  const container = document.createElement("div");
  container.style.cssText = "position:relative;width:100%;";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.display = "block";
  canvas.style.cursor = "pointer";

  const ctx = canvas.getContext("2d");
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Full View";
  backBtn.style.cssText = `
    position:absolute; top:10px; right:10px; display:none;
    padding:5px 14px; font-size:12px; font-family:var(--sans-serif,sans-serif);
    background:${darkMode ? "rgba(30,30,30,0.92)" : "rgba(255,255,255,0.92)"};
    color:${darkMode ? "#eee" : "#222"};
    border:1px solid ${darkMode ? "#555" : "#ccc"};
    border-radius:6px; cursor:pointer; z-index:10;
    box-shadow:0 1px 4px rgba(0,0,0,0.18);
  `;

  backBtn.addEventListener("click", () => {
    selectedState = null;
    currentCounties = [];
    tooltip.style.display = "none";
    projection = d3.geoAlbersUsa().fitSize([width, height], states);
    path = d3.geoPath(projection);
    backBtn.style.display = "none";
    canvas.style.cursor = "pointer";
    redraw();
  });

  let currentCounties = [];

  const tooltip = document.createElement("div");
  tooltip.style.cssText = `
    position:absolute; pointer-events:none; display:none;
    background:rgba(0,0,0,0.82); color:#fff;
    padding:3px 8px; border-radius:4px;
    font-family:var(--sans-serif,sans-serif); font-size:11px;
    white-space:nowrap; z-index:20;
    transform:translate(-50%, calc(-100% - 8px));
  `;

  // --- Legend panel ---
  const legend = document.createElement("div");
  legend.style.cssText = `
    padding:8px 12px;
    font-family:var(--sans-serif,sans-serif); font-size:11px;
    color:${darkMode ? "#ddd" : "#333"};
    line-height:1.4;
    display:flex; gap:24px;
  `;

  // Bivariate legend: title + 2D color square with axis labels around it
  const bivSection = document.createElement("div");

  const bivTitle = document.createElement("div");
  bivTitle.style.cssText = "font-weight:600; margin-bottom:6px;";
  bivTitle.textContent = "Density (→) × Flock (↑)";

  const PALETTE_PX = 80;
  const bivBox = document.createElement("div");
  bivBox.style.cssText = `position:relative; width:${PALETTE_PX + 36}px; height:${PALETTE_PX + 18}px;`;

  const flockLabel = document.createElement("div");
  flockLabel.style.cssText = `position:absolute; left:0; top:0; height:${PALETTE_PX}px; width:14px; font-size:9px; font-weight:600; writing-mode:vertical-rl; transform:rotate(180deg); display:flex; align-items:center; justify-content:center;`;
  flockLabel.textContent = "Flock";

  const yMaxNum = document.createElement("span");
  yMaxNum.style.cssText = "position:absolute; left:16px; top:-2px; font-size:9px;";
  const yMinNum = document.createElement("span");
  yMinNum.style.cssText = `position:absolute; left:16px; top:${PALETTE_PX - 10}px; font-size:9px;`;

  const paletteCanvas = document.createElement("canvas");
  paletteCanvas.width = PALETTE_PX;
  paletteCanvas.height = PALETTE_PX;
  paletteCanvas.style.cssText = `position:absolute; left:36px; top:0; width:${PALETTE_PX}px; height:${PALETTE_PX}px; border-radius:3px; display:block;`;

  const xMinNum = document.createElement("span");
  xMinNum.style.cssText = `position:absolute; left:34px; top:${PALETTE_PX + 2}px; font-size:9px;`;
  const xMaxNum = document.createElement("span");
  xMaxNum.style.cssText = `position:absolute; right:0; top:${PALETTE_PX + 2}px; font-size:9px;`;

  bivBox.append(flockLabel, yMaxNum, yMinNum, paletteCanvas, xMinNum, xMaxNum);
  bivSection.append(bivTitle, bivBox);

  legend.append(bivSection);

  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n < 10 ? n.toFixed(1) : Math.round(n).toString();
  }

  function updateLegend(colorFn, minCount, maxCount, minFlock, maxFlock, isHighlight) {
    const pCtx = paletteCanvas.getContext("2d");
    pCtx.clearRect(0, 0, PALETTE_PX, PALETTE_PX);
    for (let x = 0; x < PALETTE_PX; x++) {
      const td = x / (PALETTE_PX - 1);
      for (let y = 0; y < PALETTE_PX; y++) {
        const tf = 1 - y / (PALETTE_PX - 1);
        pCtx.fillStyle = colorFn(td, tf);
        pCtx.fillRect(x, y, 1, 1);
      }
    }
    yMaxNum.textContent = fmtNum(maxFlock);
    yMinNum.textContent = fmtNum(minFlock);
    xMinNum.textContent = fmtNum(minCount);
    xMaxNum.textContent = fmtNum(maxCount);
    bivTitle.textContent = isHighlight ? "Species (→) × Flock (↑)" : "Density (→) × Flock (↑)";
  }

  container.append(legend, canvas, backBtn, tooltip);

  function getDisplayPoints() {
    if (!selectedState || !currentPoints) return currentPoints;
    return currentPoints.filter(d => d3.geoContains(selectedState, [d.lng_bin, d.lat_bin]));
  }

  function drawBase() {
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    path.context(ctx)(states);
    ctx.fillStyle = darkMode ? "#2a2a2a" : "#d0d0d0";
    ctx.fill();
  }

  function drawBorders() {
    if (selectedState) {
      const statePrefix = String(selectedState.id).padStart(2, "0");
      ctx.beginPath();
      for (const f of countyFeatures) {
        if (String(f.id).padStart(5, "0").startsWith(statePrefix)) path.context(ctx)(f);
      }
      ctx.strokeStyle = "#b5b5b5";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.beginPath();
    path.context(ctx)(states);
    ctx.strokeStyle = "#9a9a9a";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  function drawHexLayer(pointData, colorFn, isHighlight) {
    if (!pointData || !pointData.length) return;
    const cells = hexBin(pointData, projection);
    if (!cells.length) return;

    const counts = cells.map(c => c.count);
    const flocks = cells.map(c => c.avg_flock);
    const minCount = Math.max(1, d3.min(counts));
    const maxCount = d3.max(counts);
    const minFlock = Math.max(1, d3.min(flocks));
    const maxFlock = Math.max(minFlock + 0.01, d3.max(flocks));

    const logMinC = Math.log(minCount);
    const logRangeC = Math.log(maxCount) - logMinC || 1;
    const logMinF = Math.log(minFlock);
    const logRangeF = Math.log(maxFlock) - logMinF || 1;

    for (const cell of cells) {
      const td = (Math.log(Math.max(cell.count, minCount)) - logMinC) / logRangeC;
      const tf = (Math.log(Math.max(cell.avg_flock, minFlock)) - logMinF) / logRangeF;
      ctx.beginPath();
      hexPath(ctx, cell.cx, cell.cy, HEX_RADIUS);
      ctx.fillStyle = colorFn(td, tf);
      ctx.fill();
    }

    updateLegend(colorFn, minCount, maxCount, minFlock, maxFlock, isHighlight);
  }

  function redraw() {
    drawBase();
    if (highlightPoints && highlightPoints.length) {
      drawHexLayer(highlightPoints, highlightBivariate, true);
      drawBorders();
      if (primaryPoint) {
        const p = projection([primaryPoint.lng_bin, primaryPoint.lat_bin]);
        if (p) {
          ctx.beginPath();
          hexPath(ctx, p[0], p[1], HEX_RADIUS + 3);
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fill();
          ctx.beginPath();
          hexPath(ctx, p[0], p[1], HEX_RADIUS + 1);
          ctx.fillStyle = "rgba(30, 190, 30, 0.95)";
          ctx.fill();
        }
      }
    } else {
      drawHexLayer(getDisplayPoints(), densityBivariate, false);
      drawBorders();
    }
  }

  redraw();

  canvas.addEventListener("click", (event) => {
    if (selectedState) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const coords = projection.invert([x, y]);
    if (!coords) return;
    const clicked = stateFeatures.find(f => d3.geoContains(f, coords));
    if (!clicked) return;

    selectedState = clicked;
    const statePrefix = String(selectedState.id).padStart(2, "0");
    currentCounties = countyFeatures.filter(f => String(f.id).padStart(5, "0").startsWith(statePrefix));
    projection = d3.geoAlbersUsa().fitSize([width, height], selectedState);
    path = d3.geoPath(projection);
    backBtn.style.display = "block";
    canvas.style.cursor = "default";
    redraw();
  });

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const cx = cssX * (width / rect.width);
    const cy = cssY * (height / rect.height);
    const coords = projection.invert([cx, cy]);
    if (!coords) { tooltip.style.display = "none"; return; }
    const pool = selectedState ? currentCounties : stateFeatures;
    const hit = pool.find(f => d3.geoContains(f, coords));
    if (!hit) { tooltip.style.display = "none"; return; }
    tooltip.textContent = hit.properties.name;
    tooltip.style.left = (canvas.offsetLeft + cssX) + "px";
    tooltip.style.top = (canvas.offsetTop + cssY) + "px";
    tooltip.style.display = "block";
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });

  container.update = function(pointData) {
    currentPoints = pointData;
    redraw();
  };

  container.highlight = function(pointData, primary = null) {
    highlightPoints = pointData;
    primaryPoint = primary;
    redraw();
  };

  return container;
}
