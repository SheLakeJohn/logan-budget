import { formatCents, weeklySummary } from '../money.js';
import { shortLabel } from '../dates.js';
import { esc, weekNavHtml } from '../ui.js';
import { backupReminderHtml, petrolReminderHtml } from './settings.js';
import { actions as moneyActions, SPENDING_CATEGORIES, INCOME_SOURCES } from './money-log.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const labelOf = (list, v) => list.find((x) => x.value === v)?.label ?? v;

// One tappable line of the breakdown. Tapping opens `details` underneath.
function line(sign, label, cents, details, extraClass = '') {
  return `<details class="line ${extraClass}"><summary>
    <span class="line-label"><span class="sign">${sign}</span>${label}</span>
    <span class="line-amount">${formatCents(cents)}</span></summary>
    <div class="line-details">${details}</div></details>`;
}
const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

export function render(app) {
  const { data } = app;
  const s = data.settings;
  const sum = weeklySummary(data, app.weekStart);
  const shiftsLabel = (sh) => `${shortLabel(sh.date)} ${sh.start}–${sh.end}`;

  // Petrol vs other work-day costs (lunch etc.)
  const scooterDays = sum.workDays.items.filter((w) => w.petrol > 0);
  const petrolAmounts = new Set(scooterDays.map((w) => w.petrol));
  const petrolLabel = !scooterDays.length ? 'Petrol'
    : petrolAmounts.size === 1 ? `Petrol <small>(${plural(scooterDays.length, 'shift')} × ${formatCents(scooterDays[0].petrol)})</small>`
      : `Petrol <small>(${plural(scooterDays.length, 'shift')})</small>`;
  const otherWorkday = sum.workDays.total - sum.workDays.petrolTotal;
  const perDayOther = sum.workDays.items[0]?.others ?? [];
  const otherNames = perDayOther.map((o) => o.name.toLowerCase()).join(', ') || 'work-day costs';
  const otherPerDay = perDayOther.reduce((t, o) => t + o.cents, 0);

  const whose = s.payCovers === 'same' ? 'this' : 'last';
  const payDetails = sum.pay.isEstimate
    ? `${sum.pay.alreadyPaidOn
        ? `<p>No wages expected: ${whose} week's shifts were already paid on ${shortLabel(sum.pay.alreadyPaidOn)}.</p>`
        : `<p>Expected: ${plural(sum.pay.expectedShifts, 'shift')} ${whose} week × ${formatCents(sum.pay.dailyPayCents)}
        = ${formatCents(sum.pay.expectedWages)}.</p>`}${sum.pay.items.length ? list(sum.pay.items.map((i) => `${labelOf(INCOME_SOURCES, i.source)}: ${formatCents(i.amountCents)}`)) : ''}
       ${sum.pay.alreadyPaidOn ? '' : '<p class="muted">This is an estimate until you tap "I got paid".</p>'}
       <button class="btn small" data-action="addPay">＋ I got paid</button>`
    : list(sum.pay.items.map((i) => `${labelOf(INCOME_SOURCES, i.source)} (${shortLabel(i.date)}): ${formatCents(i.amountCents)}`));

  const good = sum.left >= 0;
  const hero = `<section class="card hero ${good ? 'good' : 'bad'}">
    <div class="hero-label">Left to plan with</div>
    <div class="hero-amount">${formatCents(sum.left)}</div>
    ${good ? `<div class="hero-note">${sum.pay.isEstimate && sum.pay.total ? 'Based on expected pay' : 'Nice one 👍'}</div>`
      : `<div class="hero-note">Heads up — this week's costs and plans are ${formatCents(-sum.left)} more than your money.
         Maybe move or drop a plan, or check your shifts and pay.</div>`}
  </section>`;

  const lines = [
    sum.startBalance !== null && line('', 'Money at start of week', sum.startBalance,
      '<p>What you had on Monday morning (from the Money tab).</p>'),
    line(sum.startBalance !== null ? '+' : '', `Pay${sum.pay.isEstimate ? ' <span class="tag">expected</span>' : ''}`, sum.pay.total, payDetails),
    sum.savings.total > 0 && line('−', 'Savings', sum.savings.total, '<p>Put away every week (change it on the Costs tab).</p>'),
    line('−', petrolLabel, sum.workDays.petrolTotal, scooterDays.length
      ? list(scooterDays.map((w) => `${shiftsLabel(w.shift)}: ${formatCents(w.petrol)}${w.shift.kmOverride ? ` (${w.shift.kmOverride} km)` : ''}`))
      : '<p>No scooter shifts this week.</p>'),
    otherWorkday > 0 && line('−', `${esc(otherNames[0].toUpperCase() + otherNames.slice(1))} <small>(${plural(sum.workDays.count, 'shift')} × ${formatCents(otherPerDay)})</small>`,
      otherWorkday, list(perDayOther.map((o) => `${esc(o.name)}: ${formatCents(o.cents)} per shift`))),
    sum.fixed.items.some((c) => c.weeklyCents) && line('−', 'Other fixed costs <small>(weekly share)</small>', sum.fixed.total,
      list(sum.fixed.items.map((c) => `${esc(c.name)}: ${formatCents(c.weeklyCents)}`))),
  ].filter(Boolean).join('');

  const after = [
    line('−', 'Already spent', sum.spent.total, sum.spent.items.length
      ? list(sum.spent.items.map((x) => `${shortLabel(x.date)} ${labelOf(SPENDING_CATEGORIES, x.category)}${x.note ? ' · ' + esc(x.note) : ''}: ${formatCents(x.amountCents)}`))
      : '<p>Nothing logged. (Logging is optional.)</p>'),
    line('−', 'Planned', sum.planned.total, sum.planned.items.length
      ? list(sum.planned.items.map((p) => `${shortLabel(p.date)} ${esc(p.title)}: ${formatCents(p.costCents)}`))
      : '<p>No plans with a cost yet.</p>'),
  ].join('');

  return `<h1>Hi Logan 👋</h1>
  ${petrolReminderHtml(app)}
  ${backupReminderHtml(app)}
  ${weekNavHtml(app)}
  ${hero}
  <section class="card breakdown">
    <p class="muted tap-hint">Tap any line to see what's in it.</p>
    ${lines}
    <div class="subtotal ${sum.available >= 0 ? '' : 'neg'}"><span>= Available after base costs</span><b>${formatCents(sum.available)}</b></div>
    ${after}
    <div class="subtotal final ${good ? 'pos' : 'neg'}"><span>= Left to plan with</span><b>${formatCents(sum.left)}</b></div>
  </section>
  ${sum.nextWeekPay === null ? '' : sum.thisWeekPaidOn
    ? `<section class="card next-week">💡 This week's shifts were already paid on <b>${shortLabel(sum.thisWeekPaidOn)}</b>,
       so no pay is expected next week.</section>`
    : `<section class="card next-week">💡 Coming next week: about <b>${formatCents(sum.nextWeekPay)}</b>
    <span class="muted">(${plural(sum.workDays.count, 'shift')} this week × ${formatCents(s.dailyPayCents)})</span></section>`}
  <div class="quick">
    <button class="btn" data-action="addSpending">＋ Log spending</button>
    <button class="btn" data-action="go" data-id="schedule">📅 Schedule</button>
  </div>`;
}

export const actions = {
  addPay: moneyActions.addPay,
  addSpending: moneyActions.addSpending,
};
