import { dueWorkWeek, earnedForWeek, formatCents, paymentFor, wageCovers, weeklySummary } from '../money.js';
import { addDays, isInWeek, shortLabel, today, weekStartOf } from '../dates.js';
import { esc, openForm, toast, weekNavHtml } from '../ui.js';
import { newId } from '../storage.js';

export const INCOME_SOURCES = [
  { value: 'wages', label: '💵 Wages' },
  { value: 'tips', label: '🪙 Tips' },
  { value: 'overtime', label: '⏱️ Overtime' },
  { value: 'other', label: '📦 Other' },
];
const label = (list, value) => list.find((x) => x.value === value)?.label ?? value;

// New entries default to today if you're looking at this week, otherwise Monday.
const defaultDate = (app) => (isInWeek(today(), app.weekStart) ? today() : app.weekStart);

export const SPENDING_CATEGORIES = [
  { value: 'food', label: '🍔 Food' },
  { value: 'entertainment', label: '🎉 Fun' },
  { value: 'clothes', label: '👕 Clothes' },
  { value: 'other', label: '📦 Other' },
];

// Add or edit one bit of spending. `afterSave` runs once it's saved
// (used to remove a plan once it has been turned into spending).
export function openSpendingForm(app, entry = {}, afterSave) {
  const existing = app.data.spending.find((x) => x.id === entry.id);
  openForm({
    title: existing ? 'Spending' : 'Log spending',
    fields: [
      { name: 'amountCents', label: 'How much?', type: 'money', value: entry.amountCents, required: true },
      { name: 'category', label: 'What on?', type: 'choice', value: entry.category ?? 'food', options: SPENDING_CATEGORIES },
      { name: 'date', label: 'Date', type: 'date', value: entry.date, required: true },
      { name: 'note', label: 'Note (optional)', type: 'text', value: entry.note },
    ],
    onSave: (v) => {
      if (existing) Object.assign(existing, v);
      else app.data.spending.push({ id: newId(), ...v });
      afterSave?.();
      app.save();
      toast('Spending saved ✓');
    },
    onDelete: existing ? () => {
      app.data.spending = app.data.spending.filter((x) => x !== existing);
      app.save();
      toast('Deleted');
    } : null,
  });
}

// "Which weeks of work does this pay cover?" — the last few weeks up to this one.
function weekOptions(app, entry) {
  const data = app.data;
  const payWeek = weekStartOf(entry.date);
  const covers = Array.isArray(entry.covers) ? entry.covers : [];
  const options = [];
  for (let i = 4; i >= 0; i--) {
    const w = addDays(payWeek, -7 * i);
    const earned = earnedForWeek(data, w);
    const paidBy = paymentFor(data, w, entry.id);
    if (!earned.shifts && !covers.includes(w) && w !== dueWorkWeek(data.settings, payWeek)) continue;
    options.push({
      value: w,
      label: `Week of <b>${shortLabel(w)}</b> — ${earned.shifts} shift${earned.shifts === 1 ? '' : 's'}, ${formatCents(earned.cents)}`,
      note: paidBy ? `Already paid on ${shortLabel(paidBy.date)}` : (w === payWeek ? 'This week (paid early)' : ''),
      cents: earned.cents,
    });
  }
  return options;
}

// Logging wages: amount + which work weeks it pays for.
function wagesForm(app, entry) {
  const existing = app.data.income.includes(entry);
  const options = weekOptions(app, entry);
  openForm({
    title: existing ? 'Pay' : 'I got paid',
    fields: [
      { name: 'covers', label: 'Which weeks of work is this pay for?', type: 'checks', value: entry.covers, options,
        hint: 'Paid late or for more than one week? Tick all the weeks it covers.' },
      { name: 'amountCents', label: 'How much did you get?', type: 'money', value: entry.amountCents, required: true,
        hint: 'Filled in from your shifts — change it if the real amount was different.' },
      { name: 'date', label: 'Date received', type: 'date', value: entry.date, required: true },
      { name: 'note', label: 'Note (optional)', type: 'text', value: entry.note },
    ],
    // Keep the amount in step with the ticked weeks, until he types his own amount.
    onInput: (form, e) => {
      if (e.target.name === 'amountCents') { form.dataset.amountTyped = '1'; return; }
      if (e.target.name !== 'covers' || form.dataset.amountTyped || existing) return;
      const ticked = [...form.querySelectorAll('input[name=covers]:checked')].map((x) => x.value);
      const cents = options.filter((o) => ticked.includes(o.value)).reduce((t, o) => t + o.cents, 0);
      form.elements.amountCents.value = cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100);
    },
    onSave: (v) => {
      Object.assign(entry, v, { source: 'wages' });
      if (!existing) app.data.income.push(entry);
      app.save();
      toast('Pay saved ✓');
    },
    onDelete: existing ? () => {
      app.data.income = app.data.income.filter((x) => x !== entry);
      app.save();
      toast('Deleted');
    } : null,
  });
}

// Tips, overtime and other one-off money.
function incomeForm(app, entry) {
  const existing = app.data.income.includes(entry);
  openForm({
    title: 'Money in',
    fields: [
      { name: 'amountCents', label: 'How much?', type: 'money', value: entry.amountCents, required: true },
      { name: 'source', label: 'What is it?', type: 'choice', value: entry.source ?? 'tips', options: INCOME_SOURCES.filter((x) => x.value !== 'wages') },
      { name: 'date', label: 'Date received', type: 'date', value: entry.date, required: true },
      { name: 'note', label: 'Note (optional)', type: 'text', value: entry.note },
    ],
    onSave: (v) => {
      Object.assign(entry, v);
      if (!existing) app.data.income.push(entry);
      app.save();
      toast('Saved ✓');
    },
    onDelete: existing ? () => {
      app.data.income = app.data.income.filter((x) => x !== entry);
      app.save();
      toast('Deleted');
    } : null,
  });
}

const weeksText = (app, x) => 'for ' + wageCovers(x, app.data.settings).map((w) => `wk of ${shortLabel(w).slice(4)}`).join(' + ');

const entryRow = (action, x, title, sign) => `<button class="row" data-action="${action}" data-id="${x.id}">
  <span>${title}<small class="block">${shortLabel(x.date)}${x.note ? ' · ' + esc(x.note) : ''}</small></span>
  <span class="row-value">${sign}${formatCents(x.amountCents)} <span class="chev">›</span></span></button>`;

export function render(app) {
  const { data, weekStart } = app;
  const sum = weeklySummary(data, weekStart);
  const income = data.income.filter((x) => isInWeek(x.date, weekStart)).sort((a, b) => a.date.localeCompare(b.date));
  const spending = data.spending.filter((x) => isInWeek(x.date, weekStart)).sort((a, b) => a.date.localeCompare(b.date));
  const start = sum.startBalance;
  const whose = data.settings.payCovers === 'same' ? 'this week' : 'last week';

  return `<h1>Money</h1>
  ${weekNavHtml(app)}

  <section class="card">
    <h2>👛 Money at the start of the week</h2>
    <p class="muted">Optional. What you had on Monday morning (bank + cash). Handy if you don't log every bit of spending.</p>
    <button class="row" data-action="editStart"><span>On Monday I had</span>
      <span class="row-value">${start === null ? '<span class="muted">Tap to add</span>' : formatCents(start)}
      <span class="chev">›</span></span></button>
  </section>

  <section class="card">
    <h2>💵 Money in</h2>
    ${sum.pay.isEstimate ? (sum.pay.alreadyPaidOn
      ? `<p class="estimate">No pay expected this week — ${whose}'s shifts were already paid on <b>${shortLabel(sum.pay.alreadyPaidOn)}</b>.</p>`
      : `<p class="estimate">Expected pay: <b>${formatCents(sum.pay.expectedWages)}</b>
      <span class="muted">(${sum.pay.expectedShifts} shift${sum.pay.expectedShifts === 1 ? '' : 's'} ${whose} × ${formatCents(sum.pay.dailyPayCents)})</span><br>
      <span class="muted">When it arrives, tap "I got paid" so the real amount is used.</span></p>`) : ''}
    ${income.map((x) => entryRow('editIncome', x, label(INCOME_SOURCES, x.source)
      + (x.source === 'wages' ? ` <small>${weeksText(app, x)}</small>` : ''), '+')).join('')}
    <button class="btn primary big" data-action="addPay">＋ I got paid</button>
    <button class="btn" data-action="addIncome">＋ Tips or other money</button>
  </section>

  <section class="card">
    <h2>🧾 Spending</h2>
    <p class="muted">Optional — log what you spend to keep a record.</p>
    ${spending.map((x) => entryRow('editSpending', x, label(SPENDING_CATEGORIES, x.category), '−')).join('')}
    ${spending.length ? `<div class="total-row"><span>Spent this week</span><b>${formatCents(sum.spent.total)}</b></div>` : ''}
    <button class="btn big" data-action="addSpending">＋ Log spending</button>
  </section>`;
}

export const actions = {
  addPay(app) {
    // Start with the normal week ticked, unless it's already been paid.
    const date = defaultDate(app);
    const due = dueWorkWeek(app.data.settings, weekStartOf(date));
    const covers = paymentFor(app.data, due) ? [] : [due];
    const cents = covers.length ? earnedForWeek(app.data, due).cents : 0;
    wagesForm(app, { id: newId(), date, source: 'wages', covers, amountCents: cents || null });
  },
  addIncome: (app) => incomeForm(app, { id: newId(), date: defaultDate(app), source: 'tips' }),
  editIncome(app, id) {
    const entry = app.data.income.find((x) => x.id === id);
    if (entry.source !== 'wages') return incomeForm(app, entry);
    if (!Array.isArray(entry.covers)) entry.covers = wageCovers(entry, app.data.settings);
    wagesForm(app, entry);
  },
  addSpending: (app) => openSpendingForm(app, { date: defaultDate(app) }),
  editSpending: (app, id) => openSpendingForm(app, app.data.spending.find((x) => x.id === id)),
  editStart(app) {
    const current = app.data.startBalances[app.weekStart] ?? null;
    openForm({
      title: 'Money on Monday morning',
      fields: [{ name: 'cents', label: `On ${shortLabel(app.weekStart)} I had`, type: 'money', value: current,
        hint: 'Leave empty to remove it.' }],
      onSave: ({ cents }) => {
        if (cents === null) delete app.data.startBalances[app.weekStart];
        else app.data.startBalances[app.weekStart] = cents;
        app.save();
        toast('Saved ✓');
      },
    });
  },
};
