<script>
  import { onMount, getContext } from "svelte";
  import {
    getAverageProductionSalesVolume,
    getTotalOperatingExpense,
    getTotalSalesRevenue,
    getEbt,
    getTotalTaxes
  } from "../data/units.js";

  // window.addEventListener("resize", function (e) {
  //   console.log("resized");
  // });

  export let fullData;
  const { allYears} = getContext("plansdata")
  const aYearData = (year, values) => values.filter((x) => x.year === year)
  let yearsMap = new Map()
  for (const iterator of allYears) {
    yearsMap.set(iterator, aYearData(iterator, fullData))
  }

  const graphs = [
    {
      key: "Average Daily Sales Volume",
      values: [ ...yearsMap].map(([year, data]) => {
         return { x: year, y: getAverageProductionSalesVolume(data)  }
      })
    },
    {
      key: "Total Sales Revenue",
      values: [ ...yearsMap].map(([year, data]) => {
         return { x: year, y: getTotalSalesRevenue(data)  }
      })
    },
    {
      key: "Total Operating Expense",
      values: [ ...yearsMap].map(([year, data]) => {
         return { x: year, y: getTotalOperatingExpense(data)  }
      })
    },
    {
      key: "Earnings Before Taxes",
      values: [ ...yearsMap].map(([year, data]) => {
         return { x: year, y: getEbt(data)  }
      })
    },
    {
      key: "Total Taxes",
      values: [ ...yearsMap].map(([year, data]) => {
         return { x: year, y: getTotalTaxes(data)  }
      })
    },
  ];


  let graphSlotWidth;
  let graphSlotHeight;



  onMount(() => {
    graphSlotWidth = document.getElementById("graph-col").offsetWidth;
    graphSlotHeight = document.getElementById("graph-col").offsetHeight;
  });

  function plot() {
    // d3.select('svg').remove()
    nv.addGraph({
      generate: function () {
        var width = graphSlotWidth,
          height = graphSlotHeight;

        var chart = nv.models
          .multiBarChart()
          .width(width)
          .height(height)
          .stacked(true);
        chart.dispatch.on("renderEnd", function () {
          console.log("Render Complete");
        });

        var svg = d3.select("#test1 svg").datum(graphs);
        console.log("calling chart");
        svg.transition().duration(0).call(chart);

        return chart;
      },
      callback: function (graph) {
        nv.utils.windowResize(function () {
          var width = graphSlotWidth;
          var height = graphSlotHeight;
          graph.width(width).height(height);

          d3.select("#test1 svg")
            .attr("width", width)
            .attr("height", height)
            .transition()
            .duration(0)
            .call(graph);
        });
      },
    });
  }
  plot();
  window.addEventListener("resize", function () {
    plot();
  });
</script>

<!-- {#key unique} -->
<div id="test1">
  <svg />
</div>

<!-- {/key} -->
<style>
  svg {
    display: block;
  }

  #test1,
  svg {
    margin: 0px;
    padding: 0px;
    width: 100%;
    height: 100%;
    border: rgba(128, 128, 128, 0.178) 1px solid;
    display: flex;
  }
</style>
