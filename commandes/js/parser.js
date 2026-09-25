// Analyse d'un message de commande libre, par règles simples (sans IA).
// Exemple : « Marie Dupont 06 12 34 56 78 2 fraise 1 abricot pour samedi à Vannes, acompte 5€ »

import { addDays, toISODate, fromISODate } from './dates.js';

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  ['janvier', 'janv', 'jan'], ['fevrier', 'fevr', 'fev'], ['mars', 'mar'], ['avril', 'avr'],
  ['mai'], ['juin'], ['juillet', 'juil'], ['aout'], ['septembre', 'sept', 'sep'],
  ['octobre', 'oct'], ['novembre', 'nov'], ['decembre', 'dec'],
];
const NUMBER_WORDS = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8,
  neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, douzaine: 12,
};
// Mots retirés du flux avant de chercher les produits.
const DROP = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'et', 'a', 'au', 'aux', 'en', 'avec', 'plus']);
// Mots qui peuvent séparer une quantité de son produit : « 2 pots de fraise ».
const FILLER = new Set([
  'pot', 'bocal', 'bocaux', 'confiture', 'confit', 'petit', 'petite', 'grand', 'grande',
  'gros', 'grosse', 'moyen', 'moyenne', 'format', 'taille', 'pack', 'boite', 'bouteille', 'sachet',
]);
// Mots qui ne font jamais partie d'un nom de client.
const NAME_STOP = new Set([
  'commande', 'commandes', 'cde', 'cmd', 'nouvelle', 'pour', 'veut', 'voudrait', 'souhaite',
  'prend', 'prendra', 'reserve', 'tel', 'telephone', 'portable', 'mobile', 'numero', 'num',
  'retrait', 'livraison', 'recupere', 'recuperer', 'passe', 'passera', 'vient', 'viendra',
  'le', 'la', 'les', 'et', 'avec', 'de', 'du', 'des', 'a', 'au', 'aux', 'ce', 'cette',
  'demain', 'aujourd', 'aujourdhui', 'hui', 'apres', 'semaine', 'prochain', 'prochaine',
  'marche', 'x', 'merci', 'bonjour', 'bonsoir', 'svp', 'stp', 'ok', 'aussi', 'encore',
  ...DAYS, ...MONTHS.flat(), ...Object.keys(NUMBER_WORDS), ...FILLER,
]);
const LEADING_STRIP = new Set(['commande', 'cde', 'cmd', 'nouvelle', 'pour', 'de', 'la', 'part', 'client', 'cliente', 'nom']);

const DAY_RE = DAYS.join('|');
const MONTH_RE = MONTHS.flat().sort((a, b) => b.length - a.length).join('|');

// Normalise caractère par caractère pour garder les mêmes positions que le texte d'origine.
export function normalize(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '’' || c === '‘' || c === '`' || c === 'ʼ') { out += "'"; continue; }
    const n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += n.length === 1 ? n : (n[0] || ' ');
  }
  return out;
}

// « fraises » -> « fraise », « abricots » -> « abricot » (appliqué des deux côtés, donc cohérent).
export function singular(t) {
  if (t in NUMBER_WORDS) return t; // « deux », « trois »
  return t.length > 3 && /[sx]$/.test(t) && !/^\d/.test(t) ? t.slice(0, -1) : t;
}

export function phraseTokens(s) {
  return (normalize(s).match(/[a-z0-9œæ]+/g) || []).map(singular).filter((t) => !DROP.has(t));
}

function productPhrases(product) {
  const phrases = [product.name, ...splitKeywords(product.keywords)];
  return phrases
    .map((p) => {
      const all = phraseTokens(p);
      const core = all.filter((t) => !FILLER.has(t));
      return core.length ? core : all;
    })
    .filter((p) => p.length);
}

function marketPhrases(market) {
  const phrases = [market.name, ...splitKeywords(market.keywords)];
  const out = [];
  for (const p of phrases) {
    const toks = (normalize(p).match(/[a-z0-9œæ]+/g) || []);
    if (!toks.length) continue;
    out.push(toks);
    // « Marché de Vannes » -> aussi « vannes »
    const core = toks.filter((t) => !['marche', 'de', 'du', 'des', 'd', 'la', 'le', 'les', 'place'].includes(t));
    if (core.length && core.length !== toks.length) out.push(core);
  }
  return out;
}

export function splitKeywords(s) {
  return String(s || '').split(/[,;]/).map((k) => k.trim()).filter(Boolean);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseNumberToken(t) {
  if (/^\d{1,3}$/.test(t)) return { n: parseInt(t, 10), explicit: false };
  let m = t.match(/^x(\d{1,3})$/) || t.match(/^(\d{1,3})x$/);
  if (m) return { n: parseInt(m[1], 10), explicit: true };
  if (t in NUMBER_WORDS) return { n: NUMBER_WORDS[t], explicit: false };
  return null;
}

function parseAmount(s) {
  return Math.round(parseFloat(s.replace(',', '.')) * 100) / 100;
}

// Prochaine occurrence d'un jour de semaine ; le même jour renvoie la semaine suivante.
export function nextWeekday(today, weekday) {
  const diff = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

function makeDate(today, day, month, year) {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  let y = year;
  if (y == null) {
    y = today.getFullYear();
    const candidate = new Date(y, month, day);
    if (candidate < addDays(today, -60)) y += 1;
  } else if (y < 100) {
    y += 2000;
  }
  const d = new Date(y, month, day);
  if (d.getMonth() !== month) return null; // 31/02 etc.
  return d;
}

/**
 * @param {string} text  message libre
 * @param {{products: Array, markets: Array}} settings
 * @param {Date} [today]
 */
export function parseOrder(text, settings, today = new Date()) {
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const src = String(text || '').normalize('NFC');
  const orig = src.split('');
  const norm = normalize(src).split('');
  const cur = () => norm.join('');
  const blank = (s, e) => {
    for (let i = s; i < e; i++) {
      if (orig[i] !== '\n') { orig[i] = ' '; norm[i] = ' '; }
    }
  };
  const each = (re, fn) => {
    const matches = [...cur().matchAll(re)];
    for (const m of matches) {
      if (fn(m) !== false) blank(m.index, m.index + m[0].length);
    }
  };

  const products = settings.products || [];
  const markets = settings.markets || [];
  const result = {
    client: '', phone: '', pickupDate: '', marketId: '', items: [],
    paid: 0, paidFull: false, notes: '', warnings: [],
  };

  // 1. Notes : « note : sans sucre ajouté »
  each(/(?:^|[\s,;.])(?:note|notes|remarque|rq|nb|info)\s*:\s*([^\n]*)/g, (m) => {
    const start = m.index + m[0].length - m[1].length;
    result.notes = src.slice(start, m.index + m[0].length).trim();
  });

  // 2. Nom explicite : « nom : Marie Dupont »
  let explicitName = '';
  each(/(?:^|[\s,;.])(?:nom|client|cliente)\s*:\s*([^\n,;]+)/g, (m) => {
    const start = m.index + m[0].length - m[1].length;
    explicitName = src.slice(start, m.index + m[0].length).trim();
  });

  // 3. Téléphone
  each(/(?:(?:\+|00)33[\s.\-]?(?:\(0\))?|(?<![\d])0)[1-9](?:[\s.\-]?\d{2}){4}(?!\d)/g, (m) => {
    if (result.phone) return false;
    let digits = m[0].replace(/\D/g, '');
    if (digits.startsWith('0033')) digits = '0' + digits.slice(4);
    else if (digits.startsWith('33')) digits = '0' + digits.slice(2);
    if (digits.length === 11 && digits.startsWith('00')) digits = digits.slice(1);
    result.phone = digits.replace(/(\d{2})(?=\d)/g, '$1 ');
  });
  each(/\b(?:tel|telephone|portable|mobile|numero|num)\b\s*:?/g, () => true);

  // 4. Paiement
  const amount = '(\\d+(?:[.,]\\d{1,2})?)';
  const euro = '\\s*(?:€|eur(?:os?)?\\b)?';
  let paid = null;
  each(/\b(?:non|pas|rien)\s+(?:encore\s+)?(?:paye|payee|regle|reglee)s?\b/g, () => { paid = 0; });
  each(new RegExp(`\\b(?:acompte|avance|arrhes|deja\\s+paye|deja\\s+regle|a\\s+paye|a\\s+regle|a\\s+verse|payee?|reglee?|versee?|paiement|encaisse)\\s*(?:de\\s+|:\\s*)?${amount}${euro}`, 'g'), (m) => {
    paid = (paid || 0) + parseAmount(m[1]);
  });
  each(new RegExp(`${amount}\\s*(?:€|eur(?:os?)?\\b)\\s*(?:d\\s*'\\s*(?:acompte|avance)|d\\s+(?:acompte|avance)|(?:deja\\s+)?(?:paye|payes|regle|verse|encaisse)s?\\b)`, 'g'), (m) => {
    paid = (paid || 0) + parseAmount(m[1]);
  });
  each(/\b(?:deja\s+)?(?:paye|payee|regle|reglee|paiement\s+ok|encaisse)\b/g, () => {
    if (paid == null) result.paidFull = true;
  });
  if (paid != null) result.paid = paid;
  // Autres montants : on les ignore pour qu'ils ne deviennent pas des quantités.
  each(new RegExp(`${amount}\\s*(?:€|eur(?:os?)?\\b)`, 'g'), () => true);

  // 5. Date de retrait
  const productTokens = new Set(products.flatMap(productPhrases).flat());
  let date = null;
  const setDate = (d) => { if (!date && d) { date = d; return true; } return false; };
  each(/\bapres[\s-]*demain\b/g, () => setDate(addDays(today, 2)));
  each(/\b(?:aujourd\s*'?\s*hui|ce\s+soir|ce\s+jour)\b/g, () => setDate(today));
  each(/\bdemain\b/g, () => setDate(addDays(today, 1)));
  each(new RegExp(`\\b(?:(?:${DAY_RE})\\s+)?(?:le\\s+)?(\\d{1,2})\\s*[/.\\-]\\s*(\\d{1,2})(?:\\s*[/.\\-]\\s*(\\d{2,4}))?\\b`, 'g'), (m) =>
    setDate(makeDate(today, +m[1], +m[2] - 1, m[3] ? +m[3] : null)));
  each(new RegExp(`\\b(?:(?:${DAY_RE})\\s+)?(?:le\\s+)?(1er|\\d{1,2})\\s+(${MONTH_RE})\\.?(?:\\s+(\\d{4}))?\\b`, 'g'), (m) => {
    const month = MONTHS.findIndex((names) => names.includes(m[2]));
    return setDate(makeDate(today, m[1] === '1er' ? 1 : +m[1], month, m[3] ? +m[3] : null));
  });
  // « samedi 27 », « pour le 12 » — mais pas « samedi 3 fraises »
  const dayOfMonth = (m) => {
    const next = m[3] ? singular(m[3]) : '';
    if (next && (productTokens.has(next) || FILLER.has(next) || next === 'x')) return false;
    const day = m[2] === '1er' ? 1 : +m[2];
    let d = makeDate(today, day, today.getMonth(), today.getFullYear());
    if (!d || d < today) {
      const nextMonth = addDays(new Date(today.getFullYear(), today.getMonth(), 1), 32);
      d = makeDate(today, day, nextMonth.getMonth(), nextMonth.getFullYear());
    }
    if (!setDate(d)) return false;
    // ne blanchir que « samedi 27 », pas le mot suivant
    blank(m.index, m.index + m[0].indexOf(m[2], m[1].length) + m[2].length);
    return false;
  };
  each(new RegExp(`\\b(${DAY_RE})\\s+(1er|\\d{1,2})\\b(?:\\s+([a-z]+))?`, 'g'), dayOfMonth);
  each(/\b((?:pour\s+)?le)\s+(1er|\d{1,2})\b(?:\s+([a-z]+))?/g, dayOfMonth);
  each(new RegExp(`\\b(?:ce\\s+|cette\\s+)?(${DAY_RE})(?:\\s+(?:prochain|prochaine|qui\\s+vient))?\\b`, 'g'), (m) =>
    setDate(nextWeekday(today, DAYS.indexOf(m[1]))));
  if (date) result.pickupDate = toISODate(date);

  // 6. Marché
  const mPhrases = markets
    .flatMap((mk) => marketPhrases(mk).map((toks) => ({ mk, toks })))
    .sort((a, b) => b.toks.join(' ').length - a.toks.join(' ').length);
  for (const { mk, toks } of mPhrases) {
    const re = new RegExp(
      `(?:\\b(?:au|a|sur\\s+le)\\s+)?(?:\\bmarche(?:\\s+(?:de|du|des)\\s+|\\s+d\\s*'\\s*|\\s+))?\\b${toks.map(escapeRe).join("[\\s'\\-]+")}s?\\b`,
      'g',
    );
    let found = false;
    each(re, () => { if (found) return false; found = true; return true; });
    if (found) { result.marketId = mk.id; break; }
  }

  // 7. Produits
  const tokens = [];
  for (const m of cur().matchAll(/[a-z0-9œæ]+/g)) {
    const t = singular(m[0]);
    if (DROP.has(t)) continue;
    tokens.push({ t, start: m.index, end: m.index + m[0].length, used: false });
  }
  const patterns = products
    .flatMap((p) => productPhrases(p).map((toks) => ({ p, toks })))
    .sort((a, b) => b.toks.length - a.toks.length);

  const found = [];
  let qtyBefore = null; // style détecté : « 2 fraise » (avant) ou « fraise 2 » (après)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].used) continue;
    const hit = patterns.find(({ toks }) => toks.every((t, k) => tokens[i + k] && !tokens[i + k].used && tokens[i + k].t === t));
    if (!hit) continue;
    const n = hit.toks.length;
    for (let k = 0; k < n; k++) tokens[i + k].used = true;

    // quantité avant
    let before = null;
    let j = i - 1;
    while (j >= 0 && !tokens[j].used && FILLER.has(tokens[j].t)) j--;
    if (j >= 0 && !tokens[j].used) {
      const num = parseNumberToken(tokens[j].t);
      if (num) before = { idx: j, ...num };
    }
    // quantité après : « fraise x2 », « fraise 2 »
    let after = null;
    let k = i + n;
    if (tokens[k] && !tokens[k].used && (tokens[k].t === 'x' || tokens[k].t === 'fois')) {
      const num = tokens[k + 1] && !tokens[k + 1].used && parseNumberToken(tokens[k + 1].t);
      if (num) after = { idx: k + 1, extra: k, n: num.n, explicit: true };
    } else if (tokens[k] && !tokens[k].used) {
      const num = parseNumberToken(tokens[k].t);
      if (num) after = { idx: k, ...num };
    }

    if (qtyBefore == null && (before || after)) qtyBefore = !!before;
    let use = null;
    if (after && after.explicit) use = after;
    else if (qtyBefore === false) use = after || before;
    else use = before || null;

    let qty = 1;
    if (use) {
      qty = use.n;
      tokens[use.idx].used = true;
      if (use.extra != null) tokens[use.extra].used = true;
    }
    found.push({ product: hit.p, qty });
    i += n - 1;
  }

  // Quantités suivies d'un mot inconnu : « 3 miel » -> ligne libre à vérifier
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.used) continue;
    const num = parseNumberToken(tk.t);
    // « une amie » ou « sept » (mois) ne sont pas des quantités fiables ici
    if (!num || (tk.t in NUMBER_WORDS && !/^(deux|trois|quatre|cinq|six|huit|neuf|dix|douze)$/.test(tk.t))) continue;
    let j = i + 1;
    while (tokens[j] && !tokens[j].used && FILLER.has(tokens[j].t)) j++;
    const words = [];
    while (tokens[j] && !tokens[j].used && !parseNumberToken(tokens[j].t) && !NAME_STOP.has(tokens[j].t) && words.length < 3) {
      words.push(tokens[j]);
      j++;
    }
    if (!words.length) continue;
    const name = src.slice(words[0].start, words[words.length - 1].end);
    tk.used = true;
    words.forEach((w) => { w.used = true; });
    found.push({ product: null, name: name.charAt(0).toUpperCase() + name.slice(1), qty: num.n });
    result.warnings.push(`Produit inconnu : « ${name} »`);
  }

  for (const tk of tokens) if (tk.used) blank(tk.start, tk.end);

  // regroupe les doublons
  for (const f of found) {
    const key = f.product ? f.product.id : 'libre:' + normalize(f.name);
    const existing = result.items.find((it) => (it.productId || 'libre:' + normalize(it.name)) === key);
    if (existing) existing.qty += f.qty;
    else result.items.push({
      productId: f.product ? f.product.id : null,
      name: f.product ? f.product.name : f.name,
      qty: f.qty,
      unitPrice: f.product ? Number(f.product.price) || 0 : 0,
    });
  }

  // 8. Nom du client : premiers mots restants du message
  result.client = explicitName || extractName(orig.join(''));

  // 9. Déductions marché <-> date
  const market = markets.find((mk) => mk.id === result.marketId);
  if (market && !result.pickupDate && market.day !== '' && market.day != null) {
    result.pickupDate = toISODate(nextWeekday(today, +market.day));
  }
  if (!market && result.pickupDate) {
    const wd = fromISODate(result.pickupDate).getDay();
    const same = markets.filter((mk) => mk.day !== '' && mk.day != null && +mk.day === wd);
    if (same.length === 1) result.marketId = same[0].id;
  }

  if (!result.items.length) result.warnings.push('Aucun produit reconnu');
  if (!result.client) result.warnings.push('Nom du client non trouvé');
  if (!result.pickupDate) result.warnings.push('Date de retrait non trouvée');
  return result;
}

function extractName(text) {
  const words = [];
  const re = /([\p{L}][\p{L}'’.\-]*)|([,:;\n()]+)|( {3,})/gu;
  let m;
  let started = false;
  while ((m = re.exec(text))) {
    if (m[2] || m[3]) {
      if (words.length) break;
      continue;
    }
    const w = m[1].replace(/[.'’\-]+$/, '');
    const n = singular(normalize(w));
    if (!started && LEADING_STRIP.has(n)) continue;
    started = true;
    if (NAME_STOP.has(n) || NAME_STOP.has(normalize(w))) {
      if (words.length) break;
      continue;
    }
    words.push(w);
    if (words.length >= 4) break;
  }
  let name = words.join(' ');
  if (name && name === name.toLowerCase()) {
    name = name.replace(/(^|[\s\-'])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  }
  return name;
}
