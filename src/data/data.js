// 0: {_id: "603185377644bebddd1d233e", year: 2021, production_sales_volume: {…}, __v: 0, revenue: {…}, …}
// 1: {_id: "603187da7644bebddd1d2353", year: 2022, production_sales_volume: {…}, __v: 0, revenue: {…}, …}
// 2: {_id: "603189b97644bebddd1d2368", year: 2023, production_sales_volume: {…}, __v: 0, revenue: {…}, …}
// 3: {_id: "60318dad7644bebddd1d237d", year: 2024, production_sales_volume: {…}, __v: 0, revenue: {…}, …}

export const getProductionSalesVolumePerYear = (year, data) => {
   let reducedArray = data.filter(entry => entry.year === year )
   return reducedArray[0].production_sales_volume
}

export const getRevenuePerYear = (year, data) => {
  let reducedArray = data.filter(entry => entry.year === year )
   return reducedArray[0].revenue
}

export const getExpensePerYear = (year, data) => {
  let reducedArray = data.filter(entry => entry.year === year )
   return reducedArray[0].operating_expenses
}

export const getBudgetCostPerYear = (year, data) => {
  let reducedArray = data.filter(entry => entry.year === year )
   return reducedArray[0].budget_cost_ratios
}

export const getTaxPerYear = (year, data) => {
  let reducedArray = data.filter(entry => entry.year === year )
   return reducedArray[0].taxes
}