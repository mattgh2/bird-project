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

  let currentPoints = data;
  let highlightPoints = null;

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
    } else {
      drawPoints(currentPoints);
    }
  }

  redraw();

  canvas.update = function(pointData) {
    currentPoints = pointData;
    redraw();
  };

  canvas.highlight = function(pointData) {
    highlightPoints = pointData;
    redraw();
  };

  return canvas;
}
