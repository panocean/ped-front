<script>
  import { onMount } from "svelte";

  // Wrapping in nv.addGraph allows for '0 timeout render', stores rendered charts in nv.graphs,
  // and may do more in the future... it's NOT required
  window.addEventListener('resize', function(e){
    console.log("resized")
  })

  const ped = [
    {
      key: "Average Daily Sales Volume",
      values: [
        { x: 2021, y: 32 },
        { x: 2022, y: 27 },
        { x: 2023, y: 24 },
        { x: 2024, y: 22 },
      ],
    },
    {
      key: "Total Sales Revenue",
      values: [
        { x: 2021, y: 419 },
        { x: 2022, y: 359 },
        { x: 2023, y: 323 },
        { x: 2024, y: 288 },
      ],
    },
    {
      key: "Total Operating Expense",
      values: [
        { x: 2021, y: 190 },
        { x: 2022, y: 174 },
        { x: 2023, y: 168 },
        { x: 2024, y: 162 },
      ],
    },
    {
      key: "Earnings Before Taxes",
      values: [
        { x: 2021, y: 205 },
        { x: 2022, y: 163 },
        { x: 2023, y: 139 },
        { x: 2024, y: 114 },
      ],
    },
  ];

  let graphSlotWidth;
  let graphSlotHeight;

  let unique = {};

  window.onresize = () => {
    unique = {};
  };

  onMount(() => {
    graphSlotWidth = document.getElementById("graph-col").offsetWidth;
    graphSlotHeight = document.getElementById("graph-col").offsetHeight;
  });

  // const graphSlotWidth = document.getElementById("graph-col").offsetWidth
  // const graphSlotHeight = document.getElementById("graph-col").offsetHeight
  function plot(){
    d3.select('svg').remove()
    nv.addGraph({
    generate: function () {
      var width = nv.utils.windowSize().width,
        height = nv.utils.windowSize().height;
      // var width = graphSlotWidth - 300,
      //   height = graphSlotHeight - 100;
      // var width = 400;
      //   height =  600;

      var chart = nv.models
        .multiBarChart()
        .width(width)
        .height(height)
        .stacked(true);
      chart.dispatch.on("renderEnd", function () {
        console.log("Render Complete");
      });

      var svg = d3.select("#test1 svg").datum(ped);
      console.log("calling chart");
      svg.transition().duration(0).call(chart);

      return chart;
    },
    callback: function (graph) {
      nv.utils.windowResize(function () {
        // var width = nv.utils.windowSize().width;
        // var height = nv.utils.windowSize().height;
        var width = graphSlotWidth;
        var height = graphSlotHeight;
        graph.width(width).height(height);

        d3.select("#test1 svg")
        //  .classed("svg-container", true)
        //   .attr("preserveAspectRatio", "xMinYMin meet")
        //   .attr("viewBox", "0 0 600 00")
        //   .classed("svg-content-responsive", true)
          .attr("width", width)
          .attr("height", height)
          .transition()
          .duration(0)
          .call(graph);
      });
    },
  });
  }
  plot()
  window.addEventListener('resize', function(){
    plot()
  })

  
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
