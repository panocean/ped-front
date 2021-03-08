<script>
  export let data;
  export let heading1;
  export let heading2;

  const norMalizeColumn = (text) => text.split("_").map(x => (x.replace(x[0], x[0].toUpperCase()))).join(" ")
</script>

<table class="styled-table">
  <thead>
    <tr class="quicksand">
      <th>{heading1}</th>
      <th>{heading2}</th>
    </tr>
  </thead>
  <tbody>
    {#each Object.entries(data) as [x, y], i}
      {#if i !== 0}
        <tr class="robotomono">
          <td>{norMalizeColumn(x)}</td>
          <td>{y === null ? "-" : y}</td>
        </tr>
      {/if}
    {/each}
  </tbody>
</table>

<style>
  tr{
    font-weight: 600;
  }

  tr th:nth-child(2){
    text-align: right;
  }

  tr td:nth-child(2){
    text-align: right;
  }

  th{
    font-weight: bold;
    font-size: 12px;
  }
  td{
    font-size: 12px;
  }
</style>
