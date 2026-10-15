import { formatCents, petrolCostCents, petrolPriceOn } from '../money.js';
import { today, shortLabel, lastFirstWednesday, daysBetween, weekStartOf } from '../dates.js';
import { esc, openForm, toast } from '../ui.js';
import { checkBackup, defaultData, makeBackup, upgrade } from '../storage.js';

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

const isInstalled = () => window.navigator.standalone === true
  || window.matchMedia?.('(display-mode: standalone)').matches;

function ago(date) {
  const days = daysBetween(date, today());
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

// Gentle reminder on Home when there's data worth protecting and no recent backup.
export function backupReminderHtml(app) {
  const d = app.data;
  const entries = d.shifts.length + d.income.length + d.spending.length + d.plans.length;
  const stale = !d.lastBackup || daysBetween(d.lastBackup, today()) > 14;
  if (entries < 10 || !stale) return '';
  return `<div class="banner">💾 <b>Time for a backup?</b> ${d.lastBackup ? `Your last one was ${ago(d.lastBackup)}.`
    : 'You haven\'t saved one yet.'} It only takes a few seconds.
    <div class="banner-buttons"><button class="btn small" data-action="exportBackup">Save a backup file</button></div></div>`;
}

export async function exportBackup(app) {
  const json = JSON.stringify(makeBackup(app.data), null, 1);
  const name = `my-week-backup-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Week backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  } catch (e) {
    if (e.name === 'AbortError') return; // he closed the share sheet
    toast('⚠️ Could not save the backup');
    return;
  }
  app.data.lastBackup = today();
  app.save();
  toast('Backup saved ✓');
}

export function importBackup(app) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    let backup;
    try { backup = JSON.parse(await file.text()); } catch { backup = null; }
    const problem = checkBackup(backup);
    if (problem) return alert(problem);
    const when = backup.exportedOn ? ` from ${shortLabel(backup.exportedOn)}` : '';
    if (!confirm(`Restore the backup${when}? This replaces everything currently in the app on this phone.`)) return;
    const fresh = defaultData();
    app.data = upgrade({ ...fresh, ...backup.data, settings: { ...fresh.settings, ...backup.data.settings } });
    app.data.lastBackup = backup.exportedOn ?? app.data.lastBackup;
    app.save();
    toast('Backup restored ✓');
  };
  input.click();
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
    ${s.petrolMode === 'flat' ? `<p class="muted">Not used at the moment — petrol is a fixed ${formatCents(s.flatPetrolCents)} per work day
      (change it on the Costs tab).</p>` : ''}
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

  <section class="card" id="backup">
    <h2>💾 Backup</h2>
    <p class="muted">Your info is only saved on this phone. Save a backup file now and then (e.g. to iCloud Drive,
      Google Drive or WhatsApp to yourself) so nothing is lost if the phone is reset or changed.</p>
    <p>Last backup: <b>${app.data.lastBackup ? `${shortLabel(app.data.lastBackup)} (${ago(app.data.lastBackup)})` : 'never'}</b></p>
    <button class="btn primary big" data-action="exportBackup">⬆️ Save a backup file</button>
    <button class="btn" data-action="importBackup">⬇️ Restore from a backup file</button>
  </section>

  <section class="card">
    <h2>🧹 Start fresh</h2>
    <p class="muted">Clears your shifts, plans, pay, spending and start-of-week amounts. Your settings
      (petrol, scooter, pay per day) and costs list stay, unless you choose to reset those too.</p>
    <button class="btn danger" data-action="startFresh">Clear my data…</button>
  </section>

  ${isInstalled() ? '' : `<section class="card">
    <h2>📲 Put this app on your home screen</h2>
    <ol class="steps">
      <li>Open this page in <b>Safari</b>.</li>
      <li>Tap the <b>Share</b> button (the square with an arrow ⬆️).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
    </ol>
  </section>`}
  <p class="muted center">My Week · version ${esc(app.version ?? '')}</p>`;
}

export const actions = {
  importBackup: (app) => importBackup(app),
  startFresh(app) {
    openForm({
      title: 'Start fresh?',
      fields: [
        { name: 'everything', label: 'Also reset settings and costs to how they started', type: 'toggle', value: false,
          hint: 'Petrol R28.20 a work day, R430 a day, food R100 a work day, savings empty.' },
        { name: 'sure', label: 'Type CLEAR to confirm', type: 'text', placeholder: 'CLEAR',
          hint: 'This can\'t be undone. Save a backup first if you might want this info later.' },
      ],
      saveLabel: 'Clear data',
      onSave: ({ everything, sure }) => {
        if (sure.toUpperCase() !== 'CLEAR') return 'Type CLEAR in the box to confirm.';
        const fresh = defaultData();
        app.data = everything ? fresh : {
          ...fresh, settings: app.data.settings, costs: app.data.costs, lastBackup: app.data.lastBackup,
        };
        app.weekStart = weekStartOf(today());
        app.save();
        toast('All cleared — fresh start ✓');
      },
    });
  },
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
