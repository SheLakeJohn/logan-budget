// The app's "shell": the tab bar at the bottom, and switching between screens.

import { loadData, saveData } from './storage.js';
import { today, weekStartOf } from './dates.js';
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
  updatePetrol: (app) => settings.openPetrolPriceForm(app),
  confirmPetrol: (app) => settings.confirmPetrolPrice(app),
};

app.render();
