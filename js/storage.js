// Saves and loads all of Logan's data on the phone itself (browser storage).
// Nothing is ever sent to the internet.

import { today } from './dates.js';

const KEY = 'logan-budget-v1';

export function defaultData() {
  return {
    version: 1,
    settings: {
      petrolPrices: [{ from: today(), cents: 3000 }],
      litresPer100km: 5,
      roundTripKm: 32,
      petrolMode: 'calculated', // or 'flat'
      flatPetrolCents: 4800,
      dailyPayCents: 43000,
      payCovers: 'previous', // or 'same'
      weeklySavingsCents: 0,
      shiftStart: '08:00',
      shiftEnd: '17:00',
    },
    costs: [
      { id: newId(), name: 'Lunch at work', amountCents: 8000, frequency: 'workday', active: true },
    ],
    shifts: [],
    plans: [],
    income: [],
    spending: [],
    startBalances: {},
  };
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const fresh = defaultData();
      // Fill in anything added in newer versions of the app.
      return { ...fresh, ...saved, settings: { ...fresh.settings, ...saved.settings } };
    }
  } catch (e) {
    console.error('Could not load saved data', e);
  }
  return defaultData();
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Could not save data', e);
    return false;
  }
}
