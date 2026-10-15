import { formatCents, shiftPetrolCents, weeklyShareCents } from '../money.js';
import { today } from '../dates.js';
import { esc, openForm, toast } from '../ui.js';
import { newId } from '../storage.js';

const FREQUENCIES = [
  { value: 'workday', label: 'Each work day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const freqLabel = (f) => ({ workday: 'per work day', weekly: 'per week', monthly: 'per month', yearly: 'per year' }[f]);

function costRow(c) {
  const weekly = c.frequency === 'workday' || c.frequency === 'weekly' ? ''
    : `<span class="muted"> ≈ ${formatCents(weeklyShareCents(c.amountCents, c.frequency))}/week</span>`;
  return `<button class="row ${c.active ? '' : 'paused'}" data-action="editCost" data-id="${c.id}">
    <span>${esc(c.name)}${c.active ? '' : ' <span class="tag">Paused</span>'}</span>
    <span class="row-value">${formatCents(c.amountCents)} <small>${freqLabel(c.frequency)}</small>${weekly}
    <span class="chev">›</span></span></button>`;
}

export function render(app) {
  const { settings: s, costs } = app.data;
  const petrol = shiftPetrolCents({ date: today(), driving: true }, s);
  const workday = costs.filter((c) => c.frequency === 'workday');
  const regular = costs.filter((c) => c.frequency !== 'workday');
  const perWorkDay = petrol + workday.filter((c) => c.active).reduce((t, c) => t + c.amountCents, 0);
  const regularWeekly = regular.filter((c) => c.active)
    .reduce((t, c) => t + weeklyShareCents(c.amountCents, c.frequency), 0);
  const everyWeek = (s.weeklySavingsCents || 0) + regularWeekly;

  return `<h1>My costs</h1>
  <p class="intro">These come off automatically every week, so you can see what's really yours to spend.</p>

  <section class="card">
    <h2>🐷 Savings</h2>
    <button class="row" data-action="editSavings"><span>Put away every week</span>
      <span class="row-value">${s.weeklySavingsCents ? formatCents(s.weeklySavingsCents) : '<span class="muted">Tap to set</span>'}
      <span class="chev">›</span></span></button>
  </section>

  <section class="card">
    <h2>🛵 Every work day</h2>
    <button class="row" data-action="go" data-id="settings"><span>Petrol <span class="muted">(automatic)</span></span>
      <span class="row-value">${formatCents(petrol)} <span class="chev">›</span></span></button>
    ${workday.map(costRow).join('')}
    <div class="total-row"><span>Each work day costs</span><b>${formatCents(perWorkDay)}</b></div>
  </section>

  <section class="card">
    <h2>📄 Other regular costs</h2>
    ${regular.length ? regular.map(costRow).join('') : '<p class="muted">None yet — e.g. phone, insurance, licence.</p>'}
  </section>

  <button class="btn primary big" data-action="addCost">＋ Add a cost</button>

  <section class="card summary-card">
    <div class="total-row"><span>Every week (savings + regular costs)</span><b>${formatCents(everyWeek)}</b></div>
    <div class="total-row"><span>Plus for each work day</span><b>${formatCents(perWorkDay)}</b></div>
  </section>`;
}

function costForm(app, cost) {
  const isNew = !cost;
  openForm({
    title: isNew ? 'Add a cost' : 'Edit cost',
    fields: [
      { name: 'name', label: 'What is it?', type: 'text', value: cost?.name, placeholder: 'e.g. Phone contract', required: true },
      { name: 'amountCents', label: 'Amount', type: 'money', value: cost?.amountCents, required: true },
      { name: 'frequency', label: 'How often?', type: 'choice', value: cost?.frequency ?? 'monthly', options: FREQUENCIES },
      { name: 'active', label: 'Include this cost', type: 'toggle', value: cost?.active ?? true,
        hint: 'Switch off to pause a cost without deleting it.' },
    ],
    onSave: (v) => {
      if (isNew) app.data.costs.push({ id: newId(), ...v });
      else Object.assign(cost, v);
      app.save();
      toast('Saved ✓');
    },
    onDelete: isNew ? null : () => {
      app.data.costs = app.data.costs.filter((c) => c.id !== cost.id);
      app.save();
      toast('Deleted');
    },
  });
}

export const actions = {
  addCost: (app) => costForm(app),
  editCost: (app, id) => costForm(app, app.data.costs.find((c) => c.id === id)),
  editSavings(app) {
    const s = app.data.settings;
    openForm({
      title: 'Weekly savings',
      fields: [{ name: 'cents', label: 'Amount to put away every week', type: 'money', value: s.weeklySavingsCents || null,
        hint: 'Leave empty for no savings. You can change this any time.' }],
      onSave: ({ cents }) => { s.weeklySavingsCents = cents ?? 0; app.save(); toast('Saved ✓'); },
    });
  },
};
