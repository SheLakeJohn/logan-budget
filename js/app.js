// The app's "shell": the tab bar at the bottom, and switching between screens.

import { loadData, saveData } from './storage.js';
import { addDays, today, weekStartOf } from './dates.js';
import { toast } from './ui.js';
import * as home from './screens/home.js';
import * as schedule from './screens/schedule.js';
import * as moneyLog from './screens/money-log.js';
import * as costs from './screens/costs.js';
import * as settings from './screens/settings.js';

const screens = { home, schedule, money: moneyLog, costs, settings };

const app = {
  data: loadData(),
  tab: 'home',
  weekStart: weekStartOf(today()),

  save() {
    if (!saveData(this.data)) toast('⚠️ Could not save — is the phone storage full?');
    this.render();
  },

  go(tab) {
    this.tab = tab;
    window.scrollTo(0, 0);
    this.render();
  },

  render() {
    const screen = screens[this.tab];
    document.getElementById('screen').innerHTML = screen.render(this);
    document.querySelectorAll('.tabbar button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === this.tab);
    });
  },
};

// One click handler for the whole app: any element with data-action="x"
// calls the current screen's actions.x (or a shared one below).
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar button');
  if (tabBtn) return app.go(tabBtn.dataset.tab);

  const el = e.target.closest('[data-action]');
  if (!el || el.closest('dialog')) return;
  const name = el.dataset.action;
  const handler = screens[app.tab].actions?.[name] || sharedActions[name];
  if (handler) handler(app, el.dataset.id, el);
});

const sharedActions = {
  go: (app, tab) => app.go(tab),
  prevWeek: (app) => { app.weekStart = addDays(app.weekStart, -7); app.render(); },
  nextWeek: (app) => { app.weekStart = addDays(app.weekStart, 7); app.render(); },
  thisWeek: (app) => { app.weekStart = weekStartOf(today()); app.render(); },
  updatePetrol: (app) => settings.openPetrolPriceForm(app),
  confirmPetrol: (app) => settings.confirmPetrolPrice(app),
  exportBackup: (app) => settings.exportBackup(app),
};

app.render();

// Ask the phone to keep our data safe from automatic clean-ups (where supported).
navigator.storage?.persist?.().catch(() => {});

// "New version available": compare version.json now with what it was when the
// app opened. Checked whenever the app comes back to the screen.
async function fetchVersion() {
  try { return (await (await fetch('version.json', { cache: 'no-store' })).json()).version; } catch { return null; }
}
fetchVersion().then((v) => { app.version = v; app.render(); });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !app.version || document.querySelector('.update-bar')) return;
  const latest = await fetchVersion();
  if (latest && latest !== app.version) {
    const bar = document.createElement('button');
    bar.className = 'update-bar';
    bar.textContent = '✨ New version available — tap to update';
    bar.onclick = () => location.reload();
    document.body.appendChild(bar);
  }
});

// Offline support + always-fresh updates (see sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Offline mode not available', e));
}
