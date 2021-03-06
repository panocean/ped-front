<script>
  import {    
    psVolume,
    revenue,
    expense,
    budget,
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
  import "chartist/dist/chartist.min.css";
 
  import {
    getProductionSalesVolumePerYear,
    getRevenuePerYear,
    getExpensePerYear,
    getBudgetCostPerYear,
  } from "./data/queries.js";

  let dataParam;



  $: onMount(async () => {
    let data = await $plans;
    dataParam = plansContext(data)[0];
    yearParam.set(dataParam);

    psVolume.set(getProductionSalesVolumePerYear({ year: dataParam }));
    revenue.set(getRevenuePerYear({ year: dataParam }));
    expense.set(getExpensePerYear({ year: dataParam }));
    budget.set(getBudgetCostPerYear({ year: dataParam }));
  });

  const changeParam = (e) => {
    dataParam = e.detail.param;
    yearParam.set(dataParam);
    psVolume.set(getProductionSalesVolumePerYear({ year: dataParam }));
    revenue.set(getRevenuePerYear({ year: dataParam }));
    expense.set(getExpensePerYear({ year: dataParam }));
    budget.set(getBudgetCostPerYear({ year: dataParam }));
  };
</script>

<Nav />

<div class="app-header r-mono flex-c center-first">
  <div>
    <span>NEPL CONSOLIDATED PLAN</span>
  </div>
</div>
{#await $plans then data}
  <span style="display:none;"
    >{setContext("plansdata", {
      allYears: plansContext(data),
      fullData: data,
    })}</span
  >
  <main class="flex-r">
    <section class="middle flex-c" >
      <Card>
          <!-- this is text graph with text data  -->
        <TopTable/>
      </Card>
      <Divider margin=20px />
      <hr />
      <Card>
        <!-- this is text graph  -->
      <Net />
      </Card>
    </section>
    <Sider on:senddataparam={changeParam} />
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
    </section>
  </main>
{/await}

<style>
  .app-header {
    background-color: white;
    color: #1f2937;
    margin: unset;
    height: 30px;
    padding-left: 15px;
    font-size: 10px;
    box-shadow: 0px 1px 1px 0px rgb(0 0 0 / 28%);
  }

  .app-header span {
    margin-left: 20px;
  }

  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  main section {
    height: 90vh;
  }

  .middle {
    flex: 3;
    background-color: white;
    border-radius: 4px;
    margin-right: 10px;
    padding: 10px 
  }

  .last {
    flex: 2;
    border-radius: 4px;
    margin-left: 7px;
    background-color: white;
    padding: 5px 20px;
  }

  hr{
    color: red;
    height: 1rem;
    height: 0.09rem;
    border: none;
    margin: unset;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
