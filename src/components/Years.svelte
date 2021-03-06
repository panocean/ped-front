<script>
  import { getContext, onMount } from "svelte";
  // import { psVolume, revenue, expense, budget, plans } from "../store/store";
  import { createEventDispatcher } from "svelte";

  const { allYears } = getContext("plansdata");
  const dispatch = createEventDispatcher();
  let checkedVal;
  let dataParam;

  const checkThenSendVal = (data) => {
     checkedVal = data;
     dataParam = allYears[checkedVal];
     dispatch('senddataparam', {param: dataParam})
  }

  onMount(()=>{
    checkedVal = 0;
    dataParam = allYears[0];
  })
</script>

{#each allYears as val,i}
  <label class="container"
    >{val}
    <input type="checkbox" checked={checkedVal === i? "checked": ''}  on:click={() => checkThenSendVal(i)}/>
    <span class="checkmark" />
  </label>
{/each}

<style>
  label {
    background: rgba(128, 128, 128, 0.075);
  }

  label:hover {
    border-right: 0.04rem solid rgba(128, 128, 128, 0.13);
  }
</style>
