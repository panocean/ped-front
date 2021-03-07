const url = "https://ped-back.herokuapp.com"




export async function getProductionSalesVolumePerYear(data = {}) {
  try {
    let response = await fetch(`${url}/plans/year/salesvolume`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if(!response.ok) throw new Error('Network response was not ok');
    let output = await response.json();
    // console.log(output)
    return output;
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

export async function getRevenuePerYear(data = {}) {
  try {
    let response = await fetch(`${url}/plans/year/revenue`, {
      method: 'POST',
      cache: "no-cache",
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if(!response.ok) throw new Error('Network response was not ok');
    let output = await response.json();
    // console.log(output)
    return output;
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

export async function getExpensePerYear(data = {}) {
  try {
    let response = await fetch(`${url}/plans/year/expense`, {
      method: 'POST',
      cache: "no-cache",
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if(!response.ok) throw new Error('Network response was not ok');
    let output = await response.json();
    // console.log(output)
    return output;
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

export async function getBudgetCostPerYear(data = {}) {
  try {
    let response = await fetch(`${url}/plans/year/budget`, {
      method: 'POST',
      cache: "no-cache",
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if(!response.ok) throw new Error('Network response was not ok');
    let output = await response.json();
    // console.log(output)
    return output;
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

export async function getAllPlans() {
  try {
    let response = await fetch(`${url}/plans`, {
      method: 'GET',
      cache: "no-cache",
      headers: {
        'Content-type': 'application/json'
      },
      // body: JSON.stringify(data)
    });
    if(!response.ok) throw new Error('Network response was not ok');
    let output = await response.json();
    // console.log(output)
    return output;
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

export async function getTaxPerYear(data = {}) {
  try {
    let response = await fetch(`${url}/plans/year/tax`, {
      method: 'POST',
      cache: "no-cache",
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if(!response.ok) throw new Error('Network response was not ok');
    let output = await response.json();
    // console.log(output)
    return output;
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}
