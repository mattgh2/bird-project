---
toc: false
---
```js
    import {BirdMap} from "./components/map.js";
```

<div class="hero">
  <h1>bird-vis</h1>
</div>


<!-- <div class="grid grid-cols-2" style="grid-auto-rows: 504px;"> -->
<!--   <div class="card">${ -->
<!--     resize((width) => Plot.plot({ -->
<!--       title: "Your awesomeness over time 🚀", -->
<!--       subtitle: "Up and to the right!", -->
<!--       width, -->
<!--       y: {grid: true, label: "Awesomeness"}, -->
<!--       marks: [ -->
<!--         Plot.ruleY([0]), -->
<!--         Plot.lineY(aapl, {x: "Date", y: "Close", tip: true}) -->
<!--       ] -->
<!--     })) -->
<!--   }</div> -->
<!--   <div class="card">${ -->
<!--     resize((width) => Plot.plot({ -->
<!--       title: "How big are penguins, anyway? 🐧", -->
<!--       width, -->
<!--       grid: true, -->
<!--       x: {label: "Body mass (g)"}, -->
<!--       y: {label: "Flipper length (mm)"}, -->
<!--       color: {legend: true}, -->
<!--       marks: [ -->
<!--         Plot.linearRegressionY(penguins, {x: "body_mass_g", y: "flipper_length_mm", stroke: "species"}), -->
<!--         Plot.dot(penguins, {x: "body_mass_g", y: "flipper_length_mm", stroke: "species", tip: true}) -->
<!--       ] -->
<!--     })) -->
<!--   }</div> -->
<!-- </div> -->
<div>
${resize((width) => BirdMap(birds, {width}))}
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
