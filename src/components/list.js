import * as d3 from "npm:d3";
import {DuckDBClient} from "npm:@observablehq/duckdb";

export async function testview(data) {

    const db = await DuckDBClient.of({
        birds: data
    });
    const birds = await db.query("SELECT * FROM birds");

    return birds;

    const svg = d3.create("svg")
        .attr("width", 600)
        .attr("height", 600);

    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", 200)
        .attr("y", 200)
        .attr("width", 10)
        .attr("height", 10)
        .style("fill", "red")

    return svg.node();
}

