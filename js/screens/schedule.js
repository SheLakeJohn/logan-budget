import { formatCents, weeklySummary } from '../money.js';
import { addDays, isInWeek, shortLabel, today, weekDates } from '../dates.js';
import { esc, openForm, toast, weekNavHtml } from '../ui.js';
import { newId } from '../storage.js';
import { openSpendingForm } from './money-log.js';

export function render(app) {
  const { data, weekStart } = app;
  const summary = weeklySummary(data, weekStart);
  const shiftCost = Object.fromEntries(summary.workDays.items.map((w) => [w.shift.id, w.total]));
  const lastWeekHasShifts = data.shifts.some((s) => isInWeek(s.date, addDays(weekStart, -7)));
  const s = data.settings;

  const days = weekDates(weekStart).map((date) => {
    const shifts = data.shifts.filter((x) => x.date === date).sort((a, b) => a.start.localeCompare(b.start));
    const plans = data.plans.filter((x) => x.date === date);
    const [dayName, ...rest] = shortLabel(date).split(' ');
    return `<section class="card day ${date === today() ? 'today' : ''}">
      <div class="day-head">
        <h3>${dayName}<small>${rest.join(' ')}${date === today() ? ' · today' : ''}</small></h3>
        <div class="day-buttons">
          ${shifts.length ? '' : `<button class="btn" data-action="quickShift" data-id="${date}">＋ Work</button>`}
          <button class="btn" data-action="addPlan" data-id="${date}">＋ Plan</button>
        </div>
      </div>
      ${shifts.map((x) => `<button class="item shift" data-action="editShift" data-id="${x.id}">
        <span>🛵 <b>Work</b> ${x.start}–${x.end}${x.driving === false ? ' · no scooter' : ''}
          ${x.kmOverride ? ` · ${x.kmOverride} km` : ''}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>
        <span class="amount">−${formatCents(shiftCost[x.id] ?? 0)}</span></button>`).join('')}
      ${plans.map((p) => `<button class="item plan" data-action="editPlan" data-id="${p.id}">
        <span>⭐ ${esc(p.title)}</span>
        <span class="amount">${p.costCents ? '−' + formatCents(p.costCents) : ''}</span></button>`).join('')}
    </section>`;
  }).join('');

  const pay = s.payCovers === 'same'
    ? `<div><span>Pay for these shifts (this week)</span><b>${formatCents(summary.workDays.count * s.dailyPayCents)}</b></div>`
    : summary.thisWeekPaidOn
      ? `<div><span>Pay for these shifts</span><b>Paid ${shortLabel(summary.thisWeekPaidOn)}</b></div>`
      : `<div><span>Pay for these shifts (comes next week)</span><b>${formatCents(summary.nextWeekPay)}</b></div>`;

  return `<h1>Schedule</h1>
  ${weekNavHtml(app)}
  <section class="card week-facts">
    <div><span>Work days</span><b>${summary.workDays.count}</b></div>
    <div><span>Work-day costs (petrol, food…)</span><b>${formatCents(summary.workDays.total)}</b></div>
    ${pay}
    <div><span>Plans with a cost</span><b>${formatCents(summary.planned.total)}</b></div>
  </section>
  ${lastWeekHasShifts ? '<button class="btn big" data-action="copyLastWeek">⧉ Copy last week\'s shifts</button>' : ''}
  ${days}`;
}

function shiftForm(app, shift) {
  const s = app.data.settings;
  openForm({
    title: 'Work shift',
    fields: [
      { name: 'date', label: 'Date', type: 'date', value: shift.date, required: true },
      { name: 'start', label: 'Start', type: 'time', value: shift.start, required: true },
      { name: 'end', label: 'End', type: 'time', value: shift.end, required: true },
      { name: 'driving', label: '🛵 Riding the scooter (charge petrol)', type: 'toggle', value: shift.driving !== false },
      { name: 'kmOverride', label: 'Different distance this day?', type: 'number', unit: 'km', value: shift.kmOverride,
        placeholder: String(s.roundTripKm), hint: `Leave empty for the usual ${s.roundTripKm} km there and back.` },
      { name: 'note', label: 'Note (optional)', type: 'text', value: shift.note, placeholder: 'e.g. other branch' },
    ],
    onSave: (v) => {
      if (v.end <= v.start) return 'The end time must be after the start time.';
      Object.assign(shift, v, { kmOverride: v.kmOverride || null });
      if (!app.data.shifts.includes(shift)) app.data.shifts.push(shift);
      app.save();
      toast('Shift saved ✓');
    },
    onDelete: app.data.shifts.includes(shift) ? () => {
      app.data.shifts = app.data.shifts.filter((x) => x !== shift);
      app.save();
      toast('Shift deleted');
    } : null,
  });
}

function planForm(app, plan) {
  const isNew = !app.data.plans.includes(plan);
  openForm({
    title: isNew ? 'Add a plan' : 'Plan',
    fields: [
      { name: 'title', label: 'What are you doing?', type: 'text', value: plan.title, placeholder: 'e.g. Movies with friends', required: true },
      { name: 'date', label: 'Date', type: 'date', value: plan.date, required: true },
      { name: 'costCents', label: 'Roughly how much will it cost? (optional)', type: 'money', value: plan.costCents,
        hint: 'This is set aside from your money for the week.' },
    ],
    onSave: (v) => {
      Object.assign(plan, v, { costCents: v.costCents ?? 0 });
      if (isNew) app.data.plans.push(plan);
      app.save();
      toast('Plan saved ✓');
    },
    // Once it has happened, turn it into logged spending so it isn't counted twice.
    extraButton: isNew || !plan.costCents ? null : {
      label: '✓ It happened — log what I spent',
      onClick: () => openSpendingForm(app, {
        date: plan.date, amountCents: plan.costCents, category: 'entertainment', note: plan.title,
      }, () => { app.data.plans = app.data.plans.filter((p) => p !== plan); }),
    },
    onDelete: isNew ? null : () => {
      app.data.plans = app.data.plans.filter((p) => p !== plan);
      app.save();
      toast('Plan deleted');
    },
  });
}

export const actions = {
  quickShift(app, date) {
    const s = app.data.settings;
    app.data.shifts.push({ id: newId(), date, start: s.shiftStart, end: s.shiftEnd, driving: true, kmOverride: null, note: '' });
    app.save();
    toast(`Work added: ${shortLabel(date)}, ${s.shiftStart}–${s.shiftEnd}`);
  },
  editShift: (app, id) => shiftForm(app, app.data.shifts.find((x) => x.id === id)),
  addPlan: (app, date) => planForm(app, { id: newId(), date, title: '', costCents: 0 }),
  editPlan: (app, id) => planForm(app, app.data.plans.find((p) => p.id === id)),
  copyLastWeek(app) {
    const prev = addDays(app.weekStart, -7);
    const taken = new Set(app.data.shifts.filter((x) => isInWeek(x.date, app.weekStart)).map((x) => x.date));
    const copies = app.data.shifts
      .filter((x) => isInWeek(x.date, prev) && !taken.has(addDays(x.date, 7)))
      .map((x) => ({ ...x, id: newId(), date: addDays(x.date, 7) }));
    if (!copies.length) return toast('Nothing to copy — those days already have shifts');
    app.data.shifts.push(...copies);
    app.save();
    toast(`Copied ${copies.length} shift${copies.length > 1 ? 's' : ''} ✓`);
  },
};
