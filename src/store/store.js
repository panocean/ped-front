import { writable } from "svelte/store";
import {
  getAllPlans
} from "../data/queries";

const genericData = () => new Promise(resolve => resolve([]))

export const psVolume = writable(
  genericData()
);


export const revenue = writable(genericData());
export const expense = writable(genericData());
export const budget = writable(genericData());
export const plans = writable(getAllPlans());

export const  productionSalesVolume = writable(0);
export const totalSalesRevenue = writable(0);
export const  totalOperatingExpense = writable(0);
export const ebt = writable(0);
export const yearParam = writable(0);