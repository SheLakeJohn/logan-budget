import { formatCents, shiftPetrolCents } from '../money.js';
import { today } from '../dates.js';
import { petrolReminderHtml } from './settings.js';

export function render(app) {
  const { settings: s, costs } = app.data;
  const petrol = shiftPetrolCents({ date: today(), driving: true }, s);
  const perDay = petrol + costs.filter((c) => c.active && c.frequency === 'workday')
    .reduce((t, c) => t + c.amountCents, 0);
  return `<h1>Hi Logan 👋</h1>
  ${petrolReminderHtml(app)}
  <section class="card">
    <h2>Each work day</h2>
    <div class="big-number">${formatCents(perDay)}</div>
    <p class="muted">Petrol ${formatCents(petrol)} + lunch and other work-day costs.
      You earn ${formatCents(s.dailyPayCents)} a day.</p>
  </section>
  <section class="card">
    <h2>Your week</h2>
    <p class="muted">The weekly money summary arrives in step 5. For now, try the <b>Costs</b> and <b>Settings</b> tabs.</p>
  </section>`;
}
