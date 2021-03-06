export const getAverageProductionSalesVolume = (thisYear) => {
  const { crude_oil_sales, gas_sales } = thisYear[0].production_sales_volume;
  return crude_oil_sales + gas_sales;
};

export const getTotalSalesRevenue = (thisYear) => {
  const { oil, gas } = thisYear[0].revenue;
  return oil + gas;
};

export const getTotalOperatingExpense = (thisYear) => {
  const {
    royalty_liquids,
    royalty_gas,
    opex_liquids,
    opex_gas,
  } = thisYear[0].operating_expenses;
  return royalty_gas + royalty_liquids + opex_liquids + opex_gas;
};

export const ebidta = (thisYear) => {
  return getTotalSalesRevenue(thisYear) - getTotalOperatingExpense(thisYear);
}

export const totalBugdet = (thisYear) => {
  const { opex, capex } = thisYear[0].budget_cost_ratios;
  return opex + capex;
};

const selfFundingSD = (thisYear) => {
  const { t1_t2_deduction_due } = thisYear[0].budget_cost_ratios;
  return t1_t2_deduction_due - totalBugdet();
};

const unitTechCost = (thisYear) => {
  const { ijdc_t1, ijdc_t2 } = thisYear[0].budget_cost_ratios;
  return ijdc_t1 + ijdc_t2;
};

export const getEbt = (thisYear) => {
  return  ebidta(thisYear) - thisYear[0].budget_cost_ratios.ppta_schedule_used;
}