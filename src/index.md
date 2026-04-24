---
toc: false
---
```js
    import {BirdMap} from "./components/birdmap.js";
    const birds = await FileAttachment("data/birds.parquet").parquet();
```

<div class="hero">
  <h1>bird-vis</h1>
</div>
<div class="main">
    <div class="main-left"> 
        <div class="main-left-top"> 
        <div>
        ${BirdMap(birds)}
        </div>
        </div>
        <div class="main-left-bottom"> 
        </div>
    </div>
    <div class="main-right"> 
        <div class="main-right-top"> 
        </div>
        <div class="main-right-middle"> 
        </div>
        <div class="main-right-bottom"> 
        </div>
    </div>
</div>

<style>
    body, html {
        margin: 0 !important;
        padding: 0 !important;
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

    .main {
        margin-left: 2%;
        width: 95vw;
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
    .main-right-top, .main-right-middle, .main-right-bottom {
        border: 1px solid var(--theme-foreground-fainter, #e0e0e0);
        border-radius: 12px;
        background-color: var(--theme-background-alt, #f8f8f8);
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        overflow: hidden;
    }

    .main-left-top {
        width: 100%;
        height: 75%;
    }

    .main-left-bottom {
        width: 100%;
        height: 25%;
    }

    .main-right-top, .main-right-middle, .main-right-bottom {
        width: 100%;
        height: 33%;
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

