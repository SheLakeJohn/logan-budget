// Date helpers. All dates are plain "YYYY-MM-DD" strings, and all maths is
// done in UTC so that time zones and daylight saving can never shift a day.

function toUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = toUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

// Monday of the week containing dateStr (weeks run Monday to Sunday).
export function weekStartOf(dateStr) {
  const day = toUTC(dateStr).getUTCDay(); // 0 = Sunday … 6 = Saturday
  const daysSinceMonday = (day + 6) % 7;
  return addDays(dateStr, -daysSinceMonday);
}

// The 7 dates (Mon–Sun) of the week starting on weekStart.
export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isInWeek(dateStr, weekStart) {
  return dateStr >= weekStart && dateStr <= addDays(weekStart, 6);
}

// South African fuel prices usually change on the first Wednesday of the month.
export function isFirstWednesday(dateStr) {
  const d = toUTC(dateStr);
  return d.getUTCDay() === 3 && d.getUTCDate() <= 7;
}

// Today's date in the phone's own time zone, as "YYYY-MM-DD".
export function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// The most recent first-Wednesday-of-the-month on or before dateStr.
export function lastFirstWednesday(dateStr) {
  let d = dateStr;
  while (!isFirstWednesday(d)) d = addDays(d, -1);
  return d;
}

// "Mon 12 Oct" style label.
export function shortLabel(dateStr) {
  const d = toUTC(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}
