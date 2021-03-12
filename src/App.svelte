<script>
  import {
    psVolume,
    revenue,
    expense,
    budget,
    tax,
    plans,
    yearParam,
  } from "./store/store";
  import { plansContext } from "./util/util.js";
  import PlanTables from "./components/PlanTables.svelte";
  import Nav from "./components/Nav.svelte";
  import { setContext, onMount } from "svelte";
  import Divider from "./components/Divider.svelte";
  import Sider from "./components/Sider.svelte";
  import TopTable from "./components/TopTable.svelte";
  import Card from "./components/Card.svelte";
  import Net from "./components/Net.svelte";
  // import Net2 from "./components/Net2.svelte";
  import "chartist/dist/chartist.min.css";
  import Loader from "./components/Loader.svelte";

  import {
    getProductionSalesVolumePerYear,
    getRevenuePerYear,
    getExpensePerYear,
    getBudgetCostPerYear,
    getTaxPerYear,
  } from "./data/data";

  let dataParam;
  let data;
  let loading = true;

  $: onMount(async () => {
    setTimeout(() => (loading = false), 3000);
    data = await $plans;
    // console.log("the data", data)
    dataParam = plansContext(data)[0];
    yearParam.set(dataParam);

    psVolume.set(getProductionSalesVolumePerYear(dataParam, data));
    revenue.set(getRevenuePerYear(dataParam, data));
    expense.set(getExpensePerYear(dataParam, data));
    budget.set(getBudgetCostPerYear(dataParam, data));
    tax.set(getTaxPerYear(dataParam, data));
  });

  const changeParam = (e) => {
    dataParam = e.detail.param;
    console.log("onclick", dataParam);
    yearParam.set(dataParam);
    psVolume.set(getProductionSalesVolumePerYear(dataParam, data));
    revenue.set(getRevenuePerYear(dataParam, data));
    expense.set(getExpensePerYear(dataParam, data));
    budget.set(getBudgetCostPerYear(dataParam, data));
    tax.set(getTaxPerYear(dataParam, data));
  };
</script>

<Nav />

<div class="app-header r-mono flex-c center-first">
  <div>
    <span>NEPL CONSOLIDATED PLAN</span>
  </div>
</div>
{#if loading}
  <Loader />
{:else}
  {#await $plans then data}
    <span style="display:none;"
      >{setContext("plansdata", {
        allYears: plansContext(data),
        fullData: data,
      })}</span
    >
    <main class="flex-r">
      <section class="middle flex-c">
        <Card>
          <TopTable fullData={data} />
        </Card>
        <Divider margin="30px" />
        <Card>
          <!-- this is text graph  -->
          <!-- <Net fullData={data} /> -->
          <Net fullData={data} />
        </Card>
      </section>
      <section class="sider">
        <Sider on:senddataparam={changeParam} />
      </section>

      <section class="last flex-c">
        {#await $psVolume then data}
          <PlanTables
            {data}
            heading1={"Production & Sales Volume "}
            heading2={dataParam}
          />
        {/await}
        {#await $revenue then data}
          <PlanTables {data} heading1={"Revenue"} heading2={dataParam} />
        {/await}
        {#await $expense then data}
          <PlanTables
            {data}
            heading1={"Operating Expenses"}
            heading2={dataParam}
          />
        {/await}
        {#await $budget then data}
          <PlanTables
            {data}
            heading1={"Budget & Cost Ratios"}
            heading2={dataParam}
          />
        {/await}
        {#await $tax then data}
          <PlanTables {data} heading1={"Taxes"} heading2={dataParam} />
        {/await}
      </section>
    </main>
  {/await}
{/if}

<style>
  .app-header {
    background-color: white;
    color: #1f2937;
    margin: unset;
    height: 30px;
    padding-left: 15px;
    width: 100%;
    font-size: 10px;
    box-shadow: 0px 1px 1px 0px rgb(0 0 0 / 28%);
  }

  .app-header span {
    margin-left: 20px;
  }

  main {
    /* text-align: center; */
    padding: 1em;
    /* max-width: 240px; */
    margin: 0 auto;
  }

  main section {
    height: auto;
  }

  .middle {
    flex: 2;
    background-color: white;
    border-radius: 4px;
    margin-right: 10px;
    padding: 10px;
  }

  .sider {
    flex: 1;
    text-align: left;
    margin-right: 10px;
    background-color: white;
    border-radius: 4px;
    padding: 10px;
  }

  .last {
    flex: 2;
    border-radius: 4px;
    margin-left: 7px;
    background-color: white;
    padding: 5px 20px;
  }

  /* hr{
    color: red;
    height: 1rem;
    height: 0.09rem;
    border: none;
    margin: unset;
  } */

  /* @media (min-width: 640px) {
    main {
      max-width: none;
    }
  } */

  @media (max-width: 425px) {
    main {
      /* max-width: none; */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    main section {
      width: 70vw;
      margin-bottom: 40px;
    }

    .sider {
      order: -1;
    }
  }
</style>
