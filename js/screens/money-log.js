import { formatCents, weeklySummary } from '../money.js';
import { isInWeek, shortLabel, today } from '../dates.js';
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

function incomeForm(app, entry) {
  const existing = app.data.income.includes(entry);
  openForm({
    title: 'Money in',
    fields: [
      { name: 'amountCents', label: 'How much?', type: 'money', value: entry.amountCents, required: true },
      { name: 'source', label: 'What is it?', type: 'choice', value: entry.source ?? 'wages', options: INCOME_SOURCES },
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
    ${sum.pay.isEstimate ? `<p class="estimate">Expected pay: <b>${formatCents(sum.pay.expectedWages)}</b>
      <span class="muted">(${sum.pay.expectedShifts} shift${sum.pay.expectedShifts === 1 ? '' : 's'} ${whose} × ${formatCents(sum.pay.dailyPayCents)})</span><br>
      <span class="muted">When it arrives, tap "I got paid" so the real amount is used.</span></p>` : ''}
    ${income.map((x) => entryRow('editIncome', x, label(INCOME_SOURCES, x.source), '+')).join('')}
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
    const sum = weeklySummary(app.data, app.weekStart);
    incomeForm(app, { id: newId(), date: defaultDate(app), source: 'wages',
      amountCents: sum.pay.isEstimate && sum.pay.expectedWages ? sum.pay.expectedWages : null });
  },
  addIncome: (app) => incomeForm(app, { id: newId(), date: defaultDate(app), source: 'tips' }),
  editIncome: (app, id) => incomeForm(app, app.data.income.find((x) => x.id === id)),
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
