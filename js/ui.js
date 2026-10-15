// Small building blocks shared by every screen: pop-up forms, messages, etc.

import { parseRandToCents } from './money.js';
import { addDays, shortLabel, today, weekStartOf } from './dates.js';

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Cents -> what goes in a text box: 3000 -> "30", 4850 -> "48.50".
function centsToInput(cents) {
  if (cents === null || cents === undefined) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function fieldHtml(f) {
  const id = 'f-' + f.name;
  const label = `<label class="field-label" for="${id}">${esc(f.label)}</label>`;
  const hint = f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : '';
  switch (f.type) {
    case 'money':
      return `<div class="field">${label}<div class="money-input"><span>R</span>
        <input id="${id}" name="${f.name}" type="text" inputmode="decimal" autocomplete="off"
          value="${esc(centsToInput(f.value))}" placeholder="${esc(f.placeholder ?? '0')}"></div>${hint}</div>`;
    case 'number':
      return `<div class="field">${label}<div class="money-input"><input id="${id}" name="${f.name}" type="text"
        inputmode="decimal" autocomplete="off" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder ?? '')}">
        ${f.unit ? `<span>${esc(f.unit)}</span>` : ''}</div>${hint}</div>`;
    case 'choice':
      return `<div class="field"><div class="field-label">${esc(f.label)}</div><div class="choices">${
        f.options.map((o) => `<label class="choice"><input type="radio" name="${f.name}" value="${esc(o.value)}"
          ${o.value === f.value ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')
      }</div>${hint}</div>`;
    case 'checks': // tick any number of options; value is an array
      return `<div class="field"><div class="field-label">${esc(f.label)}</div>${
        f.options.map((o) => `<label class="check-row"><input type="checkbox" name="${f.name}" value="${esc(o.value)}"
          ${f.value?.includes(o.value) ? 'checked' : ''}><span>${o.label}${o.note ? `<small class="block">${esc(o.note)}</small>` : ''}</span></label>`).join('')
      }${hint}</div>`;
    case 'toggle':
      return `<div class="field"><label class="toggle-row"><span>${esc(f.label)}</span>
        <input type="checkbox" class="switch" name="${f.name}" ${f.value ? 'checked' : ''}></label>${hint}</div>`;
    default: // text, date, time
      return `<div class="field">${label}<input id="${id}" name="${f.name}" type="${f.type || 'text'}"
        value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder ?? '')}" autocomplete="off">${hint}</div>`;
  }
}

function readValues(form, fields) {
  const values = {};
  for (const f of fields) {
    const el = form.elements[f.name];
    if (f.type === 'money') {
      const text = el.value.trim();
      if (text === '') values[f.name] = null;
      else {
        const cents = parseRandToCents(text);
        if (cents === null || cents < 0) return { error: `"${f.label}" doesn't look like an amount.` };
        values[f.name] = cents;
      }
    } else if (f.type === 'number') {
      const text = el.value.trim().replace(',', '.');
      if (text === '') values[f.name] = null;
      else if (!/^\d+(\.\d+)?$/.test(text)) return { error: `"${f.label}" must be a number.` };
      else values[f.name] = Number(text);
    } else if (f.type === 'choice') {
      values[f.name] = form.querySelector(`input[name="${f.name}"]:checked`)?.value ?? null;
    } else if (f.type === 'checks') {
      values[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((x) => x.value);
    } else if (f.type === 'toggle') {
      values[f.name] = el.checked;
    } else {
      values[f.name] = el.value.trim();
    }
    if (f.required && (values[f.name] === null || values[f.name] === '')) {
      return { error: `Please fill in "${f.label}".` };
    }
  }
  return { values };
}

// Opens a pop-up form that slides up from the bottom of the screen.
// onSave(values) can return an error message to keep the form open.
// extraButton: { label, onClick } adds a second button (e.g. "It happened").
// onInput(form, event) runs whenever something in the form changes.
export function openForm({ title, fields, saveLabel = 'Save', onSave, onDelete, extraButton, onInput }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.innerHTML = `<form method="dialog" novalidate>
    <div class="sheet-head"><h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
    ${fields.map(fieldHtml).join('')}
    <div class="form-error" role="alert"></div>
    <button type="submit" class="btn primary big">${esc(saveLabel)}</button>
    ${extraButton ? `<button type="button" class="btn" data-extra>${esc(extraButton.label)}</button>` : ''}
    ${onDelete ? '<button type="button" class="btn danger-text" data-delete>Delete</button>' : ''}
  </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form');
  const close = () => { dialog.close(); dialog.remove(); };

  dialog.querySelector('[data-close]').onclick = close;
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  form.onsubmit = (e) => {
    e.preventDefault();
    const { values, error } = readValues(form, fields);
    const problem = error || onSave(values);
    if (problem) form.querySelector('.form-error').textContent = problem;
    else close();
  };
  if (onInput) ['input', 'change'].forEach((type) => form.addEventListener(type, (e) => onInput(form, e)));
  if (extraButton) {
    dialog.querySelector('[data-extra]').onclick = () => { close(); extraButton.onClick(); };
  }
  if (onDelete) {
    dialog.querySelector('[data-delete]').onclick = () => {
      if (confirm('Delete this? This can\'t be undone.')) { onDelete(); close(); }
    };
  }
  dialog.showModal();
}

// A short message at the bottom of the screen, e.g. "Saved ✓".
export function toast(message) {
  document.querySelectorAll('.toast').forEach((old) => old.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2000);
}

// The "‹ This week ›" bar used on Home and Schedule.
export function weekNavHtml(app) {
  const ws = app.weekStart;
  const current = weekStartOf(today());
  const name = ws === current ? 'This week' : ws === addDays(current, 7) ? 'Next week'
    : ws === addDays(current, -7) ? 'Last week' : 'Week of';
  return `<div class="week-nav">
    <button class="icon-btn" data-action="prevWeek" aria-label="Previous week">‹</button>
    <div class="week-title"><b>${name}</b><span>${shortLabel(ws)} – ${shortLabel(addDays(ws, 6))}</span></div>
    <button class="icon-btn" data-action="nextWeek" aria-label="Next week">›</button>
  </div>
  ${ws !== current ? '<button class="link-btn" data-action="thisWeek">Back to this week</button>' : ''}`;
}
