import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import * as L from "npm:leaflet";

const us = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
  .then(r => r.json());

const states = topojson.feature(us, us.objects.states);
const stateFeatures = states.features;
const counties = topojson.feature(us, us.objects.counties);
const countyFeatures = counties.features;

// Inject Leaflet CSS once (npm import gives us JS only)
(() => {
  if (document.querySelector('link[data-leaflet-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.setAttribute("data-leaflet-css", "");
  document.head.appendChild(link);
})();

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

const FIPS_TO_USPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

export function BirdMap(data, options = {}) {
  const loadStateObservations = options.loadStateObservations;
  const onObservationsLoaded = options.onObservationsLoaded;
  const onStateClosed = options.onStateClosed;
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

  // OSM container — shown only while a state is selected.
  const osmContainer = document.createElement("div");
  osmContainer.style.cssText = `
    position: relative;
    z-index: 0;
    width: 100%;
    aspect-ratio: ${width} / ${height};
    display: none;
  `;
  let leafletMap = null;
  let observationLayer = null;
  let currentObservations = null;

  function showOsmForState(feature, observations) {
    const [[w, s], [e, n]] = d3.geoBounds(feature);
    canvas.style.display = "none";
    legend.style.display = "none";
    tooltip.style.display = "none";
    osmContainer.style.display = "block";

    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    const stateBounds = L.latLngBounds([[s, w], [n, e]]);
    leafletMap = L.map(osmContainer, {
      zoomControl: true,
      maxBounds: stateBounds.pad(0.1),
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(leafletMap);
    leafletMap.fitBounds(stateBounds);

    // Inverse mask: world ring as outer, state ring(s) as holes — everything
    // outside the state is painted over so only the state's tiles remain visible.
    const outerRing = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
    const stateRings = [];
    const geom = feature.geometry;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
      stateRings.push(poly[0].map(([lng, lat]) => [lat, lng]));
    }
    L.polygon([outerRing, ...stateRings], {
      stroke: false,
      fillColor: darkMode ? "#0f0f0f" : "#ffffff",
      fillOpacity: 1.0,
      interactive: false,
    }).addTo(leafletMap);
    L.polyline(stateRings, {
      color: darkMode ? "#888" : "#444",
      weight: 1.2,
      opacity: 0.9,
      interactive: false,
    }).addTo(leafletMap);

    renderOsmMarkers(observations);

    // Container just flipped from display:none — re-fit once the browser has
    // laid it out, otherwise Leaflet measures 0×0 and falls back to a world view.
    requestAnimationFrame(() => {
      if (!leafletMap) return;
      leafletMap.invalidateSize();
      leafletMap.fitBounds(stateBounds);
    });
  }

  function hideOsm() {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    observationLayer = null;
    currentObservations = null;
    osmContainer.style.display = "none";
    canvas.style.display = "block";
    legend.style.display = "flex";
  }

  const fmtDate = ts => ts
    ? new Date(Number(ts)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  function renderOsmMarkers(observations, highlightSpecies = null, primaryRow = null) {
    if (!leafletMap) return;
    if (observationLayer) { observationLayer.remove(); observationLayer = null; }
    currentObservations = observations || null;
    if (!observations || !observations.length) return;

    const maxC = Math.max(2, d3.max(observations, d => d.observation_count || 1));
    const radius = d3.scaleSqrt().domain([1, maxC]).range([2, 14]).clamp(true);
    // Canvas renderer scales to tens of thousands of markers; SVG would choke.
    const renderer = L.canvas({ padding: 0.5 });
    const hasHighlight = !!highlightSpecies;

    observationLayer = L.layerGroup();

    // Pass 1: all observations, dimmed when a primary row is selected so the green dot stands out
    const hasPrimary = !!(primaryRow?.lat && primaryRow?.lng);
    for (const d of observations) {
      const count = d.observation_count || 1;
      L.circleMarker([d.lat, d.lng], {
        renderer,
        radius: radius(count),
        color:       hasPrimary ? "#999" : "#7f1d1d",
        fillColor:   hasPrimary ? "#bbb" : "#dc2626",
        fillOpacity: hasPrimary ? 0.12  : 0.45,
        weight:      hasPrimary ? 0.2   : 0.4,
        opacity:     hasPrimary ? 0.35  : 0.75,
      }).bindTooltip(
        `${d.common_name || "—"} · ${count} bird${count === 1 ? "" : "s"}${fmtDate(d.observation_date) ? ` · ${fmtDate(d.observation_date)}` : ""}`,
        { sticky: true }
      ).addTo(observationLayer);
    }

    // Pass 2: primary observation — bright green, largest, always on top
    if (primaryRow?.lat && primaryRow?.lng) {
      const count = primaryRow.observation_count || 1;
      L.circleMarker([primaryRow.lat, primaryRow.lng], {
        renderer,
        radius: radius(count) + 5,
        color:       "#15803d",
        fillColor:   "#22c55e",
        fillOpacity: 0.95,
        weight:      3,
        opacity:     1,
      }).bindTooltip(
        `★ ${primaryRow.common_name || "—"} · ${count} bird${count === 1 ? "" : "s"}${fmtDate(primaryRow.observation_date) ? ` · ${fmtDate(primaryRow.observation_date)}` : ""}`,
        { sticky: true }
      ).addTo(observationLayer);
    }

    observationLayer.addTo(leafletMap);
  }

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Full View";
  backBtn.style.cssText = `
    position:absolute; top:10px; right:10px; display:none;
    padding:5px 14px; font-size:12px; font-family:var(--sans-serif,sans-serif);
    background:${darkMode ? "rgba(30,30,30,0.92)" : "rgba(255,255,255,0.92)"};
    color:${darkMode ? "#eee" : "#222"};
    border:1px solid ${darkMode ? "#555" : "#ccc"};
    border-radius:6px; cursor:pointer; z-index:1001;
    box-shadow:0 1px 4px rgba(0,0,0,0.18);
  `;

  backBtn.addEventListener("click", () => {
    selectedState = null;
    currentCounties = [];
    tooltip.style.display = "none";
    hideOsm();
    backBtn.style.display = "none";
    canvas.style.cursor = "pointer";
    redraw();
    if (onStateClosed) onStateClosed();
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

  container.append(legend, canvas, osmContainer, backBtn, tooltip);

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

  canvas.addEventListener("click", async (event) => {
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
    backBtn.style.display = "block";
    canvas.style.cursor = "wait";

    const stateCode = FIPS_TO_USPS[String(clicked.id).padStart(2, "0")];
    let observations = null;
    if (stateCode && loadStateObservations) {
      try {
        observations = await loadStateObservations(stateCode);
      } catch (err) {
        console.error(`Failed to load observations for ${stateCode}:`, err);
      }
    }

    canvas.style.cursor = "pointer";
    showOsmForState(selectedState, observations);
    if (onObservationsLoaded) onObservationsLoaded(stateCode, observations || []);
  });

  canvas.addEventListener("mousemove", (event) => {
    if (selectedState) { tooltip.style.display = "none"; return; }
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const cx = cssX * (width / rect.width);
    const cy = cssY * (height / rect.height);
    const coords = projection.invert([cx, cy]);
    if (!coords) { tooltip.style.display = "none"; return; }
    const hit = stateFeatures.find(f => d3.geoContains(f, coords));
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

  let currentHighlightSpecies = null;
  let currentPrimaryRow = null;

  container.refreshObservations = async function() {
    if (!selectedState || !loadStateObservations) return;
    const stateCode = FIPS_TO_USPS[String(selectedState.id).padStart(2, "0")];
    if (!stateCode) return;
    try {
      const observations = await loadStateObservations(stateCode);
      renderOsmMarkers(observations, currentHighlightSpecies, currentPrimaryRow);
      if (onObservationsLoaded) onObservationsLoaded(stateCode, observations || []);
    } catch (err) {
      console.error(`Failed to refresh observations for ${stateCode}:`, err);
    }
  };

  container.highlightObservations = function(species, primaryRow) {
    currentHighlightSpecies = species || null;
    currentPrimaryRow = primaryRow || null;
    if (!selectedState || !leafletMap) return;
    renderOsmMarkers(currentObservations, currentHighlightSpecies, currentPrimaryRow);
  };

  return container;
}
