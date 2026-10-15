// ALL money calculations for the app live in this one file.
//
// Every amount of money is stored as a whole number of cents
// (R48.00 is stored as 4800) so there are never rounding surprises.

import { addDays, isInWeek, weekStartOf } from './dates.js';

// ---------------------------------------------------------------------------
// Reading and showing amounts
// ---------------------------------------------------------------------------

// Turns what someone types ("R1 234,50", "30", "48.5") into cents.
// Returns null if it isn't a valid amount.
export function parseRandToCents(text) {
  if (text === null || text === undefined) return null;
  let s = String(text).trim().replace(/^R/i, '').replace(/[\s ]/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, ''); // "1,234.50"
  else s = s.replace(',', '.'); // "48,50"
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null;
  const negative = s.startsWith('-');
  const [rands, cents = ''] = s.replace('-', '').split('.');
  const value = Number(rands) * 100 + Number(cents.padEnd(2, '0'));
  return negative ? -value : value;
}

// Turns cents into friendly text: 172000 -> "R1,720", 4850 -> "R48.50".
export function formatCents(cents) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100);
  const rest = abs % 100;
  const randsText = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const text = 'R' + randsText + (rest ? '.' + String(rest).padStart(2, '0') : '');
  return negative ? '−' + text : text;
}

// ---------------------------------------------------------------------------
// Petrol
// ---------------------------------------------------------------------------

// Cost of one trip: km × (litres per 100km ÷ 100) × price per litre.
// km and L/100km can have decimals; the answer is rounded to the nearest cent.
export function petrolCostCents(km, litresPer100km, pricePerLitreCents) {
  return Math.round((km * litresPer100km * pricePerLitreCents) / 100);
}

// The petrol price that applied on a given date. settings.petrolPrices is a
// list of { from: "YYYY-MM-DD", cents } so old weeks keep their old price.
export function petrolPriceOn(settings, dateStr) {
  const prices = [...(settings.petrolPrices || [])].sort((a, b) => a.from.localeCompare(b.from));
  let current = prices.length ? prices[0].cents : 0;
  for (const p of prices) if (p.from <= dateStr) current = p.cents;
  return current;
}

// Petrol for one shift. No petrol if he isn't driving that day.
export function shiftPetrolCents(shift, settings) {
  if (shift.driving === false) return 0;
  if (settings.petrolMode === 'flat') return settings.flatPetrolCents || 0;
  const km = shift.kmOverride ?? settings.roundTripKm;
  return petrolCostCents(km, settings.litresPer100km, petrolPriceOn(settings, shift.date));
}

// ---------------------------------------------------------------------------
// Fixed costs
// ---------------------------------------------------------------------------

// Weekly share of a cost. Monthly × 12 ÷ 52, yearly ÷ 52.
// "workday" costs (like lunch) are charged per shift instead, so return 0 here.
export function weeklyShareCents(amountCents, frequency) {
  switch (frequency) {
    case 'weekly': return amountCents;
    case 'monthly': return Math.round((amountCents * 12) / 52);
    case 'yearly': return Math.round(amountCents / 52);
    case 'workday': return 0;
    default: throw new Error('Unknown frequency: ' + frequency);
  }
}

// ---------------------------------------------------------------------------
// The weekly summary (the home screen)
// ---------------------------------------------------------------------------

const sum = (list, pick) => list.reduce((total, x) => total + pick(x), 0);

// ---------------------------------------------------------------------------
// Wages: which work weeks a payment covers
// ---------------------------------------------------------------------------

// The work week whose pay normally arrives in the week starting payWeek.
export function dueWorkWeek(settings, payWeek) {
  return settings.payCovers === 'same' ? payWeek : addDays(payWeek, -7);
}

// The work weeks (Mondays) a wages entry pays for. Entries saved before this
// was tracked are assumed to be the normal week.
export function wageCovers(entry, settings) {
  return Array.isArray(entry.covers) ? entry.covers : [dueWorkWeek(settings, weekStartOf(entry.date))];
}

// The wages entry that paid for a work week, or null if it's unpaid.
// `exceptId` lets the pay form ignore the entry being edited.
export function paymentFor(data, workWeek, exceptId = null) {
  return (data.income || []).find((i) => i.source === 'wages' && i.id !== exceptId
    && wageCovers(i, data.settings).includes(workWeek)) ?? null;
}

// What a work week earns: its shifts × pay per day.
export function earnedForWeek(data, workWeek) {
  const count = (data.shifts || []).filter((x) => isInWeek(x.date, workWeek)).length;
  return { shifts: count, cents: count * (data.settings.dailyPayCents || 0) };
}

// Builds every number on the home screen for the week starting weekStart
// (a Monday). Each line carries `items` so tapping it can show the detail.
export function weeklySummary(data, weekStart) {
  const { settings } = data;
  const inWeek = (x) => isInWeek(x.date, weekStart);

  const shifts = (data.shifts || []).filter(inWeek).sort((a, b) => a.date.localeCompare(b.date));
  const income = (data.income || []).filter(inWeek);
  const spending = (data.spending || []).filter(inWeek);
  const plans = (data.plans || []).filter((p) => inWeek(p) && p.costCents > 0);
  const activeCosts = (data.costs || []).filter((c) => c.active !== false);

  // Money at the start of the week (optional).
  const startBalance = data.startBalances?.[weekStart] ?? null;

  // Pay. Wages normally arrive for the PREVIOUS week's shifts (unless the
  // setting says otherwise). Until he logs actual wages, we show the expected
  // amount — or nothing, if that week was already paid (e.g. paid early/late
  // together with another week).
  const daily = settings.dailyPayCents || 0;
  const dueWeek = dueWorkWeek(settings, weekStart);
  const due = earnedForWeek(data, dueWeek);
  const alreadyPaidBy = paymentFor(data, dueWeek);
  const expectedWages = alreadyPaidBy ? 0 : due.cents;
  const wagesLogged = income.filter((i) => i.source === 'wages');
  const otherIncome = income.filter((i) => i.source !== 'wages');
  const wagesAreActual = wagesLogged.length > 0;
  const wages = wagesAreActual ? sum(wagesLogged, (i) => i.amountCents) : expectedWages;
  const pay = {
    total: wages + sum(otherIncome, (i) => i.amountCents),
    isEstimate: !wagesAreActual,
    dueWeek,
    expectedShifts: due.shifts,
    alreadyPaidOn: alreadyPaidBy?.date ?? null,
    dailyPayCents: daily,
    expectedWages,
    items: wagesAreActual ? income : otherIncome,
  };

  // Savings come off first.
  const savings = { total: settings.weeklySavingsCents || 0 };

  // Work-day costs: petrol for each shift (if driving) + per-work-day costs like lunch.
  const workdayCosts = activeCosts.filter((c) => c.frequency === 'workday');
  const workdayItems = shifts.map((s) => {
    const petrol = shiftPetrolCents(s, settings);
    const others = workdayCosts.map((c) => ({ name: c.name, cents: c.amountCents }));
    return { shift: s, petrol, others, total: petrol + sum(others, (o) => o.cents) };
  });
  const workDays = {
    count: shifts.length,
    petrolTotal: sum(workdayItems, (w) => w.petrol),
    total: sum(workdayItems, (w) => w.total),
    items: workdayItems,
  };

  // Other fixed costs (weekly / monthly / yearly), shown as a weekly share.
  const fixedItems = activeCosts
    .filter((c) => c.frequency !== 'workday')
    .map((c) => ({ ...c, weeklyCents: weeklyShareCents(c.amountCents, c.frequency) }));
  const fixed = { total: sum(fixedItems, (c) => c.weeklyCents), items: fixedItems };

  const available = (startBalance ?? 0) + pay.total - savings.total - workDays.total - fixed.total;

  const spent = { total: sum(spending, (s) => s.amountCents), items: spending };
  const planned = { total: sum(plans, (p) => p.costCents), items: plans };

  const left = available - spent.total - planned.total;

  // What next week's pay should be, based on this week's shifts
  // (nothing if this week's shifts have already been paid).
  const thisWeekPaidBy = settings.payCovers === 'same' ? null : paymentFor(data, weekStart);
  const nextWeekPay = settings.payCovers === 'same' ? null : thisWeekPaidBy ? 0 : shifts.length * daily;
  const thisWeekPaidOn = thisWeekPaidBy?.date ?? null;

  return { weekStart, startBalance, pay, savings, workDays, fixed, available, spent, planned, left, nextWeekPay, thisWeekPaidOn };
}
