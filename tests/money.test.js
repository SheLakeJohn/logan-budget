import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRandToCents, formatCents, petrolCostCents, petrolPriceOn,
  shiftPetrolCents, weeklyShareCents, weeklySummary,
} from '../js/money.js';
import { weekStartOf, isFirstWednesday } from '../js/dates.js';

const settings = {
  petrolPrices: [{ from: '2026-01-01', cents: 3000 }],
  litresPer100km: 5,
  roundTripKm: 32,
  petrolMode: 'calculated',
  flatPetrolCents: 0,
  dailyPayCents: 43000,
  payCovers: 'previous',
  weeklySavingsCents: 0,
};
const lunch = { id: 'lunch', name: 'Lunch', amountCents: 8000, frequency: 'workday', active: true };
const shift = (date, extra = {}) => ({ id: date, date, start: '08:00', end: '17:00', driving: true, ...extra });

// --- Petrol ---------------------------------------------------------------

test('petrol: 32 km × 5 L/100km × R30.00 = R48.00', () => {
  assert.equal(petrolCostCents(32, 5, 3000), 4800);
});

test('petrol: decimals are rounded to the nearest cent', () => {
  // 32 × 5.3 / 100 × 29.87 = 50.65952 → R50.66
  assert.equal(petrolCostCents(32, 5.3, 2987), 5066);
});

test('petrol: no charge when not driving', () => {
  assert.equal(shiftPetrolCents(shift('2026-10-12', { driving: false }), settings), 0);
});

test('petrol: km override for a different site', () => {
  assert.equal(shiftPetrolCents(shift('2026-10-12', { kmOverride: 50 }), settings), 7500);
});

test('petrol: flat amount per work day', () => {
  const flat = { ...settings, petrolMode: 'flat', flatPetrolCents: 6000 };
  assert.equal(shiftPetrolCents(shift('2026-10-12'), flat), 6000);
});

test('petrol: old weeks keep the old price', () => {
  const s = { ...settings, petrolPrices: [{ from: '2026-09-02', cents: 3000 }, { from: '2026-10-07', cents: 3200 }] };
  assert.equal(petrolPriceOn(s, '2026-10-06'), 3000);
  assert.equal(petrolPriceOn(s, '2026-10-07'), 3200);
  assert.equal(shiftPetrolCents(shift('2026-10-01'), s), 4800);
  assert.equal(shiftPetrolCents(shift('2026-10-08'), s), 5120);
});

// --- Fixed costs ----------------------------------------------------------

test('weekly share: monthly × 12 ÷ 52', () => {
  assert.equal(weeklyShareCents(52000, 'monthly'), 12000); // R520/month → R120/week
  assert.equal(weeklyShareCents(30000, 'monthly'), 6923); // R300/month → R69.23/week
});

test('weekly share: yearly ÷ 52 and weekly unchanged', () => {
  assert.equal(weeklyShareCents(104000, 'yearly'), 2000);
  assert.equal(weeklyShareCents(20000, 'weekly'), 20000);
});

// --- Weekly summary -------------------------------------------------------

const week = '2026-10-12'; // a Monday
const lastWeekShifts = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => shift(d));
const thisWeekShifts = ['2026-10-12', '2026-10-13', '2026-10-14'].map((d) => shift(d));
const baseData = {
  settings,
  costs: [lunch],
  shifts: [...lastWeekShifts, ...thisWeekShifts],
  income: [], spending: [], plans: [], startBalances: {},
};

test('summary: R128 per work day (R48 petrol + R80 lunch)', () => {
  const s = weeklySummary(baseData, week);
  assert.equal(s.workDays.count, 3);
  assert.equal(s.workDays.items[0].total, 12800);
  assert.equal(s.workDays.petrolTotal, 14400);
  assert.equal(s.workDays.total, 38400);
});

test('summary: expected pay uses LAST week\'s shifts (4 × R430)', () => {
  const s = weeklySummary(baseData, week);
  assert.equal(s.pay.isEstimate, true);
  assert.equal(s.pay.expectedShifts, 4);
  assert.equal(s.pay.total, 172000);
  assert.equal(s.nextWeekPay, 3 * 43000); // this week's 3 shifts, paid next week
});

test('summary: logged wages replace the estimate; tips add on top', () => {
  const data = { ...baseData, income: [
    { date: '2026-10-13', amountCents: 160000, source: 'wages' },
    { date: '2026-10-14', amountCents: 5000, source: 'tips' },
  ] };
  const s = weeklySummary(data, week);
  assert.equal(s.pay.isEstimate, false);
  assert.equal(s.pay.total, 165000);
});

test('summary: the full breakdown adds up', () => {
  const data = {
    ...baseData,
    settings: { ...settings, weeklySavingsCents: 20000 },
    costs: [lunch, { name: 'Phone', amountCents: 52000, frequency: 'monthly', active: true },
      { name: 'Old thing', amountCents: 99900, frequency: 'weekly', active: false }],
    startBalances: { [week]: 35000 },
    spending: [{ date: '2026-10-12', amountCents: 15000, category: 'food' }],
    plans: [{ date: '2026-10-17', title: 'Movies', costCents: 15000 },
      { date: '2026-10-18', title: 'Free walk', costCents: 0 }],
  };
  const s = weeklySummary(data, week);
  // 350 + 1720 − 200 savings − 384 work days − 120 phone = 1366
  assert.equal(s.fixed.total, 12000);
  assert.equal(s.available, 136600);
  // 1366 − 150 spent − 150 planned = 1066
  assert.equal(s.left, 106600);
});

test('summary: negative when costs are more than money', () => {
  const data = { ...baseData, shifts: thisWeekShifts }; // nothing worked last week → no pay
  const s = weeklySummary(data, week);
  assert.equal(s.pay.total, 0);
  assert.equal(s.left, -38400);
});

test('summary: "pay covers this week" setting', () => {
  const s = weeklySummary({ ...baseData, settings: { ...settings, payCovers: 'same' } }, week);
  assert.equal(s.pay.total, 3 * 43000);
  assert.equal(s.nextWeekPay, null);
});

// --- Typing amounts and showing them -----------------------------------------

test('reading typed amounts', () => {
  assert.equal(parseRandToCents('30'), 3000);
  assert.equal(parseRandToCents('R30.00'), 3000);
  assert.equal(parseRandToCents('48,5'), 4850);
  assert.equal(parseRandToCents('R1 234,50'), 123450);
  assert.equal(parseRandToCents('1,234.50'), 123450);
  assert.equal(parseRandToCents('abc'), null);
  assert.equal(parseRandToCents(''), null);
});

test('showing amounts', () => {
  assert.equal(formatCents(172000), 'R1,720');
  assert.equal(formatCents(4850), 'R48.50');
  assert.equal(formatCents(-38400), '−R384');
});

// --- Dates ------------------------------------------------------------------

test('weeks start on Monday', () => {
  assert.equal(weekStartOf('2026-10-15'), '2026-10-12'); // Thursday
  assert.equal(weekStartOf('2026-10-18'), '2026-10-12'); // Sunday
  assert.equal(weekStartOf('2026-10-12'), '2026-10-12'); // Monday
});

test('first Wednesday of the month (petrol reminder)', () => {
  assert.equal(isFirstWednesday('2026-10-07'), true);
  assert.equal(isFirstWednesday('2026-10-14'), false);
  assert.equal(isFirstWednesday('2026-11-04'), true);
});
