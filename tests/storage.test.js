import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBackup, makeBackup, defaultData, upgrade } from '../js/storage.js';

test('backup: a freshly made backup passes the check', () => {
  const backup = JSON.parse(JSON.stringify(makeBackup(defaultData(), '2026-10-15')));
  assert.equal(checkBackup(backup), null);
  assert.equal(backup.data.settings.roundTripKm, 32);
});

test('backup: wrong or damaged files are refused', () => {
  assert.match(checkBackup({ hello: 1 }), /doesn't look like/);
  assert.match(checkBackup(null), /doesn't look like/);
  const broken = makeBackup(defaultData());
  broken.data.shifts = 'oops';
  assert.match(checkBackup(broken), /damaged/);
  const badAmount = makeBackup(defaultData());
  badAmount.data.income = [{ amountCents: 12.5 }];
  assert.match(checkBackup(badAmount), /amount/);
});

test('new starting costs: petrol R28.20 and food R100 per work day', () => {
  const d = defaultData();
  assert.equal(d.settings.petrolMode, 'flat');
  assert.equal(d.settings.flatPetrolCents, 2820);
  assert.deepEqual(d.costs.map((c) => [c.name, c.amountCents, c.frequency]), [['Food at work', 10000, 'workday']]);
});

test('upgrade changes old starting values but keeps his own edits', () => {
  const old = (lunchCents, km) => ({ version: 1,
    settings: { petrolMode: 'calculated', litresPer100km: 5, roundTripKm: km, flatPetrolCents: 4800 },
    costs: [{ name: 'Lunch at work', amountCents: lunchCents, frequency: 'workday', active: true }] });
  const a = upgrade(old(8000, 32));
  assert.equal(a.settings.petrolMode, 'flat');
  assert.equal(a.settings.flatPetrolCents, 2820);
  assert.equal(a.costs[0].name, 'Food at work');
  assert.equal(a.costs[0].amountCents, 10000);
  const b = upgrade(old(9000, 40)); // he had changed these himself
  assert.equal(b.settings.petrolMode, 'calculated');
  assert.equal(b.costs[0].amountCents, 9000);
  assert.equal(b.version, 2);
});
