export function BirdMap(data, {width} = {}) {
  return Plot.plot({
    width,
    projection: "albers-usa",
    marks: [
      Plot.geo(states),
      Plot.dot(data, {x: "longitude", y: "latitude"})
    ]
  });
}
