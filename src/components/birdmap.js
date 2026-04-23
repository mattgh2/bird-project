import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

const us = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
  .then(r => r.json());

const states = topojson.feature(us, us.objects.states);

export function BirdMap(data) {
  const width = 960;
  const height = 600;
  const projection = d3.geoAlbersUsa().fitSize([width, height], states);
  const path = d3.geoPath(projection);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = "100%";
  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");

  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const borderColor = darkMode ? "#fff" : "#000";

  // Draw state outlines
  ctx.beginPath();
  path.context(ctx)(states);
  ctx.fillStyle = "#d0d0d0";
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Scale dot opacity by count
  const maxCount = d3.max(data, d => d.count);
  const opacity = d3.scaleLinear().domain([1, maxCount]).range([0.3, 0.9]).clamp(true);

  // Draw aggregated bins
  for (const d of data) {
    const p = projection([d.lng, d.lat]);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(30, 100, 200, ${opacity(d.count)})`;
    ctx.fill();
  }

  return canvas;
}
