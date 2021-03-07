<script>
  import { onMount, getContext } from "svelte";
  import Chartist from "chartist";
  import { netIncome } from "../data/units";
  // Chartist.Line
  export let fullData;

  const { allYears } = getContext("plansdata");
  const aYearData = (year, values) => values.filter((x) => x.year === year);
  let yearsMap = new Map();
  for (const iterator of allYears) {
    yearsMap.set(iterator, aYearData(iterator, fullData));
  }

  console.log([...yearsMap].map(([year, data]) => netIncome(data)));

  onMount(() => {
    // Initialize a Line chart in the container with the ID chart1
    // chart.on("draw", function (data) {
    var chart = new Chartist.Line(
      ".ct-chart",
      {
        labels: allYears,
        series: [[...yearsMap].map(([year, data]) => netIncome(data))],
      },
      {
        low: 0,
        showArea: false,
        showPoint: true,
        fullWidth: true,
      }
    );

    // chart.on("draw", function (data) {
    //   if (data.type === "line" || data.type === "area") {
    //     data.element.animate({
    //       d: {
    //         begin: 2000 * data.index,
    //         dur: 2000,
    //         from: data.path
    //           .clone()
    //           .scale(1, 0)
    //           .translate(0, data.chartRect.height())
    //           .stringify(),
    //         to: data.path.clone().stringify(),
    //         easing: Chartist.Svg.Easing.easeOutQuint,
    //       },
    //     });
    //   }
    // });
    setTimeout(function () {
      var path = document.querySelector(".ct-series-a path");
      var length = path.getTotalLength();
      console.log(length);
    }, 3000);
  });
</script>

<div class="ct-chart ct-golden-section" id="chart1" />

<style>
  /* .svs {
    border: 1px solid blue;
  } */
</style>
