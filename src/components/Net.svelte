<script>
  import { onMount } from "svelte";
  //   import Chartist from "chartist";
  import Chartist from "chartist";

  // Chartist.Line

  onMount(() => {
    // Initialize a Line chart in the container with the ID chart1
    let chart = new Chartist.Line(
      "#chart1",
      {
        labels: [1, 2, 3, 4],
        series: [[100, 120, 180, 200]],
      },
      {
        low: 0,
        showArea: true,
        showPoint: false,
      }
    );

    // Initialize a Line chart in the container with the ID chart2
    // new Chartist.Bar("#chart2", {
    //   labels: [1, 2, 3, 4],
    //   series: [[5, 2, 8, 3]],
    // });

    chart.on("draw", function (data) {
      var chart = new Chartist.Line('.ct-chart', {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  series: [
    [1, 5, 2, 5, 4, 3],
    [2, 3, 4, 8, 1, 2],
    [5, 4, 3, 2, 1, 0.5]
  ]
}, {
  low: 0,
  showArea: true,
  showPoint: false,
  fullWidth: true
});

chart.on('draw', function(data) {
  if(data.type === 'line' || data.type === 'area') {
    data.element.animate({
      d: {
        begin: 2000 * data.index,
        dur: 2000,
        from: data.path.clone().scale(1, 0).translate(0, data.chartRect.height()).stringify(),
        to: data.path.clone().stringify(),
        easing: Chartist.Svg.Easing.easeOutQuint
      }
    });
  }
});

    });
  });
</script>

<div class="ct-chart ct-golden-section" id="chart1" />

<style>
  /* .svs {
    border: 1px solid blue;
  } */
</style>
