// Dates « locales » au format AAAA-MM-JJ (pas de fuseau horaire).

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function toISODate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function daysFromToday(iso) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((fromISODate(iso) - today) / 86400000);
}

const shortFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function formatShort(iso) {
  return shortFmt.format(fromISODate(iso));
}

// « Aujourd'hui », « Demain », « samedi 27 septembre »
export function formatRelative(iso) {
  const d = daysFromToday(iso);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d === -1) return 'Hier';
  const s = longFmt.format(fromISODate(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
