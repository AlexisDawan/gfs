// Stockage local (dans le navigateur du téléphone).

const KEY = 'commandes-marche:v1';

export const STATUSES = {
  todo: { label: 'À préparer', short: 'À préparer' },
  ready: { label: 'Prête', short: 'Prête' },
  done: { label: 'Retirée', short: 'Retirée' },
  cancelled: { label: 'Annulée', short: 'Annulée' },
};
export const ACTIVE = ['todo', 'ready'];

export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaults() {
  const p = (name, price, keywords = '') => ({ id: uid(), name, price, keywords });
  return {
    version: 1,
    products: [
      p('Fraise', 5.5),
      p('Abricot', 5.5),
      p('Framboise', 6),
      p('Figue', 6),
      p('Fraise-rhubarbe', 6, 'fraise rhubarbe'),
      p('Orange amère', 6, 'marmelade, orange'),
    ],
    markets: [
      { id: uid(), name: 'Marché du samedi', day: 6, keywords: '' },
    ],
    orders: [],
    draft: '',
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Lecture impossible', e);
  }
  return defaults();
}

let persistAsked = false;
export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée.");
    return;
  }
  // Demande au navigateur de ne pas effacer ces données pour libérer de la place.
  if (!persistAsked && navigator.storage && navigator.storage.persist) {
    persistAsked = true;
    navigator.storage.persist().catch(() => {});
  }
}

export function orderTotal(order) {
  return order.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
}

// 'paid' | 'partial' | 'unpaid'
export function paymentState(order) {
  const total = orderTotal(order);
  const paid = Number(order.paid) || 0;
  if (total > 0 && paid >= total - 0.001) return 'paid';
  if (paid > 0) return 'partial';
  return total > 0 ? 'unpaid' : 'paid';
}
