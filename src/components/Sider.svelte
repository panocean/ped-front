<script>
  import Measure from "./Measures.svelte";
</script>


  <section class="sider">
    <Measure on:senddataparam />
  </section>


<style>
  .sider {
    flex: 1;
    text-align: left;
    margin-right: 10px;
    background-color: white;
    border-radius: 4px;
    padding: 10px;
  }

</style>
