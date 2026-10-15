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

// ---- Backup file -----------------------------------------------------------

// Checks a backup file before it replaces everything. Returns an error
// message, or null if it looks fine.
export function checkBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.app !== 'my-week') return 'This doesn\'t look like a My Week backup file.';
  const d = obj.data;
  if (!d || typeof d.settings !== 'object') return 'The backup file is missing its settings.';
  for (const key of ['costs', 'shifts', 'plans', 'income', 'spending']) {
    if (!Array.isArray(d[key])) return `The backup file is damaged (${key}).`;
  }
  const amounts = [...d.costs, ...d.income, ...d.spending].map((x) => x.amountCents);
  if (amounts.some((a) => !Number.isInteger(a))) return 'The backup file has an amount that isn\'t valid.';
  return null;
}

export function makeBackup(data, date = today()) {
  return { app: 'my-week', exportedOn: date, data };
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
