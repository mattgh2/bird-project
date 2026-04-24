import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

const us = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
  .then(r => r.json());

const states = topojson.feature(us, us.objects.states);
const stateFeatures = states.features;

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

  container.append(canvas, backBtn);

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

  function drawPoints(pointData) {
    if (!pointData || !pointData.length) return;
    const maxCount = Math.max(...pointData.map(d => d.count));
    const rScale = d3.scaleSqrt().domain([1, maxCount]).range([2, 10]);
    for (const d of pointData) {
      const p = projection([d.lng_bin, d.lat_bin]);
      if (!p) continue;
      const opacity = 0.2 + 0.7 * (d.count / maxCount);
      ctx.beginPath();
      ctx.arc(p[0], p[1], rScale(d.count), 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(30, 100, 200, ${opacity})`;
      ctx.fill();
    }
  }

  function redraw() {
    drawBase();
    if (highlightPoints && highlightPoints.length) {
      const maxCount = Math.max(...highlightPoints.map(d => d.count));
      const rScale = d3.scaleSqrt().domain([1, maxCount]).range([3, 12]);
      for (const d of highlightPoints) {
        const p = projection([d.lng_bin, d.lat_bin]);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p[0], p[1], rScale(d.count), 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(220, 30, 30, ${0.5 + 0.5 * (d.count / maxCount)})`;
        ctx.fill();
      }
      if (primaryPoint) {
        const p = projection([primaryPoint.lng_bin, primaryPoint.lat_bin]);
        if (p) {
          const r = Math.max(rScale(primaryPoint.count), 6);
          ctx.beginPath();
          ctx.arc(p[0], p[1], r + 2, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(255, 255, 255, 0.85)`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(30, 190, 30, 0.95)`;
          ctx.fill();
        }
      }
    } else {
      drawPoints(getDisplayPoints());
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
