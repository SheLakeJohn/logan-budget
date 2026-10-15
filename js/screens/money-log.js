import { openForm, toast } from '../ui.js';
import { newId } from '../storage.js';

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

export function render() {
  return `<h1>Money</h1><section class="card"><p class="muted">Coming in step 4: pay and spending.</p></section>`;
}
