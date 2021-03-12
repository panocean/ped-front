<script>
  import { onMount, getContext } from "svelte";
  import {
    netIncome
  } from "../data/units.js";

 

  export let fullData;
  const { allYears } = getContext("plansdata");

  const aYearData = (year, values) => values.filter((x) => x.year === year);
  let yearsMap = new Map();
  for (const iterator of allYears) {
    yearsMap.set(iterator, aYearData(iterator, fullData));
  }

  const graphs = [
    {
      key: "Net Income",
      values: [...yearsMap].map(([year, data]) => {
        return { x: year, y: netIncome(data) };
      }),
    },
  ];

  console.log("netincome", graphs)

  nv.addGraph(function () {
    var chart = nv.models
      .lineChart()
      .margin({ left: 70 }) //Adjust chart margins to give the x-axis some breathing room.
      .useInteractiveGuideline(true) //We want nice looking tooltips and a guideline!
      // .transitionDuration(350) //how fast do you want the lines to transition?
      .showLegend(true) //Show the legend, allowing users to turn on/off line series.
      .showYAxis(true) //Show the y-axis
      .showXAxis(true); //Show the x-axis
    chart.xAxis //Chart x-axis settings
      .axisLabel("Year")
      // .tickFormat(d3.format(",r"));

    chart.yAxis //Chart y-axis settings
      .axisLabel("Income (us$/m)")
      .tickFormat(d3.format(".02f"));

    /* Done setting the chart up? Time to render it!*/
    // var myData = sinAndCos(); //You need data...

    d3.select("#chart svg") //Select the <svg> element you want to render the chart in.
      .datum(graphs) //Populate the <svg> element with chart data...
      .call(chart); //Finally, render the chart!

    //Update the chart when window resizes.
    nv.utils.windowResize(function () {
      chart.update();
    });
    return chart;
  });
</script>

<!-- {#key unique} -->
<div id="chart">
  <svg />
</div>

<!-- {/key} -->
<style>
  svg {
    display: block;
  }

  #chart,
  svg {
    margin: 0px;
    padding: 0px;
    /* width: 100%; */
    height: 90%;
    border: rgba(206, 145, 145, 0.178) 1px solid;
    /* background-color: #383e56; */
    display: flex;
  }
</style>
