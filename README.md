# My Week

A simple weekly money and schedule planner for Logan, made for his iPhone.
He enters his shifts and pay, and the app takes off savings, petrol, lunch and
other costs so he can see what's left to plan with.

**Open it:** https://shelakejohn.github.io/logan-budget/

## How it's built
- Plain HTML, CSS and JavaScript — no frameworks, nothing to install or build.
- All data is saved only on the phone (browser storage). Use **Settings → Save a backup file** regularly.
- All money maths is in `js/money.js`; amounts are stored as whole cents.
- `sw.js` makes it work offline and always fetch the newest version when online.

## Making changes
- Run the tests: `npm test` (needs Node.js 18 or newer).
- After changing the app, bump the number in `version.json` so open copies show
  "New version available".
