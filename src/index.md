---
toc: false
---
```js
    import {BirdMap} from "./components/birdmap.js";
    const db = await DuckDBClient.of({
        birds: FileAttachment("data/birds.parquet")
    });
    const birds = await db.query(`
      SELECT ROUND(LATITUDE, 1) AS lat, ROUND(LONGITUDE, 1) AS lng, COUNT(*) AS count
      FROM birds
      GROUP BY lat, lng
    `)
```
<div class="hero">
  <h1>bird-vis</h1>
</div>

<div>
  ${BirdMap(birds)}
</div>

<style>
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--sans-serif);
  margin: 4rem 0 8rem;
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
