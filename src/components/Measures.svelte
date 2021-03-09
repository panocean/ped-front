<script>
  import { onMount } from "svelte";
  import Badge from "./Badge.svelte";
  import Divider from "./Divider.svelte";
  import Years from "./Years.svelte";
  import {
    plans,
    productionSalesVolume,
    totalSalesRevenue,
    totalOperatingExpense,
    totalTaxes,
    ebt,
    yearParam,
  } from "../store/store";

  import {
    getAverageProductionSalesVolume,
    getTotalOperatingExpense,
    getTotalSalesRevenue,
    getEbt,
    getTotalTaxes
  } from "../data/units.js";

  let year;
  let aYearData;
  let fullData;

  $: onMount(async () => {
    let data = await $plans;
    fullData = data;
    year = $yearParam;
    aYearData = data.filter((x) => x.year === year);

    productionSalesVolume.set(getAverageProductionSalesVolume(aYearData));
    totalOperatingExpense.set(getTotalOperatingExpense(aYearData));
    totalSalesRevenue.set(getTotalSalesRevenue(aYearData));
    ebt.set(getEbt(aYearData));
    totalTaxes.set(getTotalTaxes(aYearData));
  });

  const setParam = async (e) => {
    yearParam.set(e.detail.param);
    fullData = await $plans;
    year = $yearParam;

    aYearData = fullData.filter((x) => x.year === year);

    productionSalesVolume.set(getAverageProductionSalesVolume(aYearData));
    totalOperatingExpense.set(getTotalOperatingExpense(aYearData));
    totalSalesRevenue.set(getTotalSalesRevenue(aYearData));
    ebt.set(getEbt(aYearData));
    totalTaxes.set(getTotalTaxes(aYearData));
  };
</script>

<div>
  <span>Plan By Years</span>
  <Divider />
  <section class="inputs">
    <Years on:senddataparam on:senddataparam={setParam} />
  </section>
</div>
<div>
  <Divider />
  <section class="badges">
    <Badge
      title="Average Production Sales Volume"
      value={$productionSalesVolume}
      unit={"kboepd"}
    />
    <Badge
      title="Total Sales Revenue"
      value={$totalSalesRevenue}
      unit={"us$/m"}
    />
    <Badge
      title="Total Operating Expense"
      value={$totalOperatingExpense}
      unit={"us$/m"}
    />
    <Badge title="Earnings Before Taxes" value={$ebt} unit={"us$/m"} />
    <Badge title="Total Taxes" value={$totalTaxes} unit={"us$/m"} />
  </section>
</div>

<style>
    .inputs {
    margin-top: 10px;
  }

   @media (max-width: 425px) {
    main {
      /* max-width: none; */
    }

    .badges{
      /* border: 2px red solid; */
      display: flex;
      flex-wrap: wrap;
      /* justify-content: center; */
      /* align-items: flex-start; */
      text-align: center;
    }
  }
</style>
