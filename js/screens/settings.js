import { formatCents, petrolCostCents, petrolPriceOn } from '../money.js';
import { today, shortLabel, lastFirstWednesday } from '../dates.js';
import { esc, openForm, toast } from '../ui.js';

const latestPrice = (s) => [...s.petrolPrices].sort((a, b) => a.from.localeCompare(b.from)).at(-1);

// True if a new month's petrol price may have come out since he last updated it.
export function petrolCheckDue(settings, date = today()) {
  return lastFirstWednesday(date) > latestPrice(settings).from;
}

// The yellow "petrol price may have changed" banner (shown on Home and Settings).
export function petrolReminderHtml(app) {
  const s = app.data.settings;
  if (s.petrolMode === 'flat' || !petrolCheckDue(s)) return '';
  return `<div class="banner">
    <div>⛽ <b>Petrol price may have changed</b> (it usually changes on the first Wednesday of the month).
    Still <b>${formatCents(latestPrice(s).cents)}</b> a litre?</div>
    <div class="banner-buttons">
      <button class="btn small" data-action="updatePetrol">Update price</button>
      <button class="btn small ghost" data-action="confirmPetrol">Still the same</button>
    </div></div>`;
}

export function openPetrolPriceForm(app) {
  const s = app.data.settings;
  openForm({
    title: 'Petrol price',
    fields: [
      { name: 'cents', label: 'Price per litre (what you pay at the pump)', type: 'money', value: latestPrice(s).cents, required: true },
      { name: 'from', label: 'Price applies from', type: 'date', value: today(), required: true,
        hint: 'Weeks before this date keep the old price.' },
    ],
    onSave: ({ cents, from }) => {
      if (cents === 0) return 'The price can\'t be R0.';
      s.petrolPrices = s.petrolPrices.filter((p) => p.from !== from);
      s.petrolPrices.push({ from, cents });
      app.save();
      toast('Petrol price saved ✓');
    },
  });
}

export function confirmPetrolPrice(app) {
  const s = app.data.settings;
  const cents = latestPrice(s).cents;
  s.petrolPrices = s.petrolPrices.filter((p) => p.from !== today());
  s.petrolPrices.push({ from: today(), cents });
  app.save();
  toast('Thanks — price confirmed ✓');
}

function row(label, value, action) {
  return `<button class="row" data-action="${action}"><span>${esc(label)}</span>
    <span class="row-value">${esc(value)} <span class="chev">›</span></span></button>`;
}

export function render(app) {
  const s = app.data.settings;
  const price = latestPrice(s);
  const perDay = s.petrolMode === 'flat'
    ? s.flatPetrolCents
    : petrolCostCents(s.roundTripKm, s.litresPer100km, petrolPriceOn(s, today()));
  const history = [...s.petrolPrices].sort((a, b) => b.from.localeCompare(a.from)).slice(0, 4);

  return `<h1>Settings</h1>
  ${petrolReminderHtml(app)}

  <section class="card">
    <h2>⛽ Petrol price</h2>
    <div class="big-number">${formatCents(price.cents)} <small>per litre</small></div>
    <button class="btn primary big" data-action="updatePetrol">Update petrol price</button>
    <details class="history"><summary>Price history</summary>
      <ul>${history.map((p) => `<li>${shortLabel(p.from)}: ${formatCents(p.cents)}</li>`).join('')}</ul>
    </details>
  </section>

  <section class="card">
    <h2>🛵 Scooter</h2>
    ${row('Fuel use', `${s.litresPer100km} L per 100 km`, 'editScooter')}
    ${row('Home → work → home', `${s.roundTripKm} km`, 'editScooter')}
    ${row('Petrol worked out by', s.petrolMode === 'flat' ? 'Fixed amount' : 'Calculation', 'editScooter')}
    <p class="note">Petrol per work day: <b>${formatCents(perDay)}</b>${s.petrolMode === 'flat' ? ''
      : ` <span class="muted">(${s.roundTripKm} km × ${s.litresPer100km} L/100km × ${formatCents(price.cents)})</span>`}</p>
  </section>

  <section class="card">
    <h2>💵 Pay</h2>
    ${row('Pay per day worked', formatCents(s.dailyPayCents), 'editPay')}
    ${row('My pay is for', s.payCovers === 'same' ? 'This week\'s shifts' : 'Last week\'s shifts', 'editPay')}
  </section>

  <section class="card">
    <h2>🕗 Usual work hours</h2>
    ${row('New shifts start at', s.shiftStart, 'editHours')}
    ${row('New shifts end at', s.shiftEnd, 'editHours')}
  </section>

  <section class="card">
    <h2>💾 Backup</h2>
    <p class="muted">Coming in step 6.</p>
  </section>`;
}

export const actions = {
  editScooter(app) {
    const s = app.data.settings;
    openForm({
      title: 'Scooter & petrol',
      fields: [
        { name: 'litresPer100km', label: 'Fuel use', type: 'number', unit: 'L per 100 km', value: s.litresPer100km, required: true },
        { name: 'roundTripKm', label: 'Home → work → home', type: 'number', unit: 'km', value: s.roundTripKm, required: true },
        { name: 'petrolMode', label: 'Work out petrol by', type: 'choice', value: s.petrolMode, options: [
          { value: 'calculated', label: 'Calculation' }, { value: 'flat', label: 'Fixed amount per day' }] },
        { name: 'flatPetrolCents', label: 'Fixed petrol amount per work day', type: 'money', value: s.flatPetrolCents,
          hint: 'Only used if "Fixed amount per day" is picked above.' },
      ],
      onSave: (v) => {
        Object.assign(s, v, { flatPetrolCents: v.flatPetrolCents ?? 0 });
        app.save();
        toast('Saved ✓');
      },
    });
  },

  editPay(app) {
    const s = app.data.settings;
    openForm({
      title: 'Pay',
      fields: [
        { name: 'dailyPayCents', label: 'Pay per day worked', type: 'money', value: s.dailyPayCents, required: true },
        { name: 'payCovers', label: 'When I get paid, it\'s for…', type: 'choice', value: s.payCovers, options: [
          { value: 'previous', label: 'Last week\'s shifts' }, { value: 'same', label: 'This week\'s shifts' }] },
      ],
      onSave: (v) => { Object.assign(s, v); app.save(); toast('Saved ✓'); },
    });
  },

  editHours(app) {
    const s = app.data.settings;
    openForm({
      title: 'Usual work hours',
      fields: [
        { name: 'shiftStart', label: 'Start', type: 'time', value: s.shiftStart, required: true },
        { name: 'shiftEnd', label: 'End', type: 'time', value: s.shiftEnd, required: true },
      ],
      onSave: (v) => { Object.assign(s, v); app.save(); toast('Saved ✓'); },
    });
  },
};
