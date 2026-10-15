import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBackup, makeBackup, defaultData } from '../js/storage.js';

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
