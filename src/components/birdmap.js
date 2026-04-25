import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

const us = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
  .then(r => r.json());

const states = topojson.feature(us, us.objects.states);
const stateFeatures = states.features;

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

// white → teal → dark blue (log-scaled)
const densityColor = d3.scaleSequentialLog(d3.interpolateRgbBasis([
  "#f7fcf0", "#a8ddb5", "#43a2ca", "#0868ac", "#023858"
]));

const flockOpacity = d3.scaleLog().clamp(true);

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
    projection = d3.geoAlbersUsa().fitSize([width, height], states);
    path = d3.geoPath(projection);
    backBtn.style.display = "none";
    canvas.style.cursor = "pointer";
    redraw();
  });

  // --- Legend panel ---
  const legend = document.createElement("div");
  legend.style.cssText = `
    padding:8px 12px;
    font-family:var(--sans-serif,sans-serif); font-size:11px;
    color:${darkMode ? "#ddd" : "#333"};
    line-height:1.4;
    display:flex; gap:24px;
  `;

  // Color ramp legend
  const colorSection = document.createElement("div");
  const colorTitle = document.createElement("div");
  colorTitle.style.cssText = "font-weight:600; margin-bottom:2px;";
  colorTitle.textContent = "Observation Density";

  const rampCanvas = document.createElement("canvas");
  rampCanvas.width = 140;
  rampCanvas.height = 12;
  rampCanvas.style.cssText = "width:140px; height:12px; border-radius:3px; display:block;";

  const colorLabels = document.createElement("div");
  colorLabels.style.cssText = "display:flex; justify-content:space-between; width:140px;";
  const colorMinLabel = document.createElement("span");
  const colorMaxLabel = document.createElement("span");
  colorLabels.append(colorMinLabel, colorMaxLabel);

  colorSection.append(colorTitle, rampCanvas, colorLabels);

  // Opacity legend
  const opacitySection = document.createElement("div");
  const opacityTitle = document.createElement("div");
  opacityTitle.style.cssText = "font-weight:600; margin-bottom:2px;";
  opacityTitle.textContent = "Avg. Flock Size → Opacity";

  const opacitySamples = document.createElement("canvas");
  opacitySamples.width = 140;
  opacitySamples.height = 16;
  opacitySamples.style.cssText = "width:140px; height:16px; display:block;";

  const opacityLabels = document.createElement("div");
  opacityLabels.style.cssText = "display:flex; justify-content:space-between; width:140px;";
  const opacityMinLabel = document.createElement("span");
  const opacityMaxLabel = document.createElement("span");
  opacityLabels.append(opacityMinLabel, opacityMaxLabel);

  opacitySection.append(opacityTitle, opacitySamples, opacityLabels);

  legend.append(colorSection, opacitySection);

  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n < 10 ? n.toFixed(1) : Math.round(n).toString();
  }

  function updateLegend(colorScale, opScale, minCount, maxCount, minFlock, maxFlock, isHighlight) {
    // Draw color ramp
    const rCtx = rampCanvas.getContext("2d");
    rCtx.clearRect(0, 0, 140, 12);
    for (let i = 0; i < 140; i++) {
      const t = i / 139;
      const val = minCount * Math.pow(maxCount / minCount, t);
      rCtx.fillStyle = colorScale(val);
      rCtx.fillRect(i, 0, 1, 12);
    }
    colorMinLabel.textContent = fmtNum(minCount);
    colorMaxLabel.textContent = fmtNum(maxCount);
    colorTitle.textContent = isHighlight ? "Species Density" : "Observation Density";

    // Draw opacity samples — 5 hex cells at increasing opacity
    const oCtx = opacitySamples.getContext("2d");
    oCtx.clearRect(0, 0, 140, 16);
    const midColor = colorScale(Math.sqrt(minCount * maxCount));
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const alpha = 0.35 + 0.65 * t;
      const cx = 14 + i * 28;
      oCtx.globalAlpha = alpha;
      oCtx.beginPath();
      hexPath(oCtx, cx, 8, 7);
      oCtx.fillStyle = midColor;
      oCtx.fill();
    }
    oCtx.globalAlpha = 1;
    opacityMinLabel.textContent = fmtNum(minFlock);
    opacityMaxLabel.textContent = fmtNum(maxFlock);
  }

  container.append(legend, canvas, backBtn);

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
    ctx.strokeStyle = darkMode ? "#aaa" : "#333";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function drawHexLayer(pointData, colorInterp, opacityScale, isHighlight) {
    if (!pointData || !pointData.length) return;
    const cells = hexBin(pointData, projection);
    if (!cells.length) return;

    const counts = cells.map(c => c.count);
    const flocks = cells.map(c => c.avg_flock);
    const minCount = Math.max(1, d3.min(counts));
    const maxCount = d3.max(counts);
    const minFlock = Math.max(1, d3.min(flocks));
    const maxFlock = Math.max(minFlock + 0.01, d3.max(flocks));

    colorInterp.domain([minCount, maxCount]);
    opacityScale.domain([minFlock, maxFlock]).range([0.35, 1]);

    for (const cell of cells) {
      const alpha = opacityScale(Math.max(cell.avg_flock, minFlock));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      hexPath(ctx, cell.cx, cell.cy, HEX_RADIUS);
      ctx.fillStyle = colorInterp(cell.count);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    updateLegend(colorInterp, opacityScale, minCount, maxCount, minFlock, maxFlock, isHighlight);
  }

  // Highlight color ramp (white → orange → dark red)
  const highlightColor = d3.scaleSequentialLog(d3.interpolateRgbBasis([
    "#fff5eb", "#fdae6b", "#e6550d", "#a63603", "#7f2704"
  ]));

  function redraw() {
    drawBase();
    if (highlightPoints && highlightPoints.length) {
      drawHexLayer(highlightPoints, highlightColor, flockOpacity.copy(), true);
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
      drawHexLayer(getDisplayPoints(), densityColor, flockOpacity.copy(), false);
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
    projection = d3.geoAlbersUsa().fitSize([width, height], selectedState);
    path = d3.geoPath(projection);
    backBtn.style.display = "block";
    canvas.style.cursor = "default";
    redraw();
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
