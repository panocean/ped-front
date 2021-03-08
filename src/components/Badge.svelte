<script>
  export let title = undefined;
  export let value = undefined;
  export let unit = undefined;
</script>

<div class="badge flex-c">
  <p>{title}</p>
  <p>
    <span>{value}</span>
    <span class="unit">{unit}</span>
  </p>
</div>

<style>
  .badge {
    box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.281);
    padding: 5px 5px;
    margin-top: 15px;
    border-radius: 3px;
    margin-bottom: 15px;
  }

  .badge p:nth-child(1) {
    font-size: 9px;
    flex-grow: 1;
    margin-top: unset;
    font-weight: 600;
    background-color: #95e1d3;
    border-radius: 2px;
    padding: 3px 1px;
    line-height: 20px;
  }

  .badge p:nth-child(2) {
    margin-bottom: unset;
  }

  .badge p:nth-child(2) span:nth-child(1) {
    font-size: 30px;
    color: var(--antd);
  }

  .unit {
    font-weight: 100;
    font-size: 13px;
    font-style: italic;
  }
</style>
