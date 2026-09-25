import { parseOrder, normalize } from './parser.js';
import * as S from './store.js';
import { addDays, toISODate, todayISO, daysFromToday, formatShort, formatRelative } from './dates.js';

const state = S.load();
let view = 'home';
let homeDraft = null;
const ordersUI = { status: 'active', group: 'date', q: '' };
const prodUI = { date: 'all', includeReady: false };

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const moneyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eur = (n) => moneyFmt.format(n || 0);
const num = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const decimalStr = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '');
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function persist() {
  S.save(state);
  updateBadges();
}

const marketById = (id) => state.markets.find((m) => m.id === id);
const productById = (id) => state.products.find((p) => p.id === id);

/* ---------- Navigation ---------- */

const TITLES = { home: 'Nouvelle commande', orders: 'Commandes', production: 'Production', settings: 'Réglages' };

function go(v) {
  view = v;
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  $('#title').textContent = TITLES[v];
  render();
  window.scrollTo(0, 0);
}

function render() {
  const root = $('#view');
  if (view === 'home') renderHome(root);
  else if (view === 'orders') renderOrders(root);
  else if (view === 'production') renderProduction(root);
  else renderSettings(root);
}

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) go(b.dataset.view);
});

/* ---------- Toast (avec « Annuler ») ---------- */

let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Annuler</button>' : ''}`;
  el.classList.add('show');
  if (undo) {
    el.querySelector('button').onclick = () => {
      undo();
      el.classList.remove('show');
    };
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 3000);
}

/* ---------- Rappels ---------- */

function computeReminders() {
  const today = todayISO();
  const active = state.orders.filter((o) => S.ACTIVE.includes(o.status));
  return {
    overdue: active.filter((o) => o.pickupDate && o.pickupDate < today),
    toPrepare: active.filter((o) => o.status === 'todo' && o.pickupDate && o.pickupDate >= today && daysFromToday(o.pickupDate) <= 1),
    readyToday: active.filter((o) => o.status === 'ready' && o.pickupDate === today),
    noDate: active.filter((o) => !o.pickupDate),
    unpaid: state.orders.filter((o) => o.status === 'done' && S.paymentState(o) !== 'paid'),
  };
}

function updateBadges() {
  const r = computeReminders();
  const urgent = r.overdue.length + r.toPrepare.length;
  const active = state.orders.filter((o) => S.ACTIVE.includes(o.status)).length;
  const b = $('#badge-orders');
  b.textContent = active || '';
  b.hidden = !active;
  const h = $('#badge-home');
  h.textContent = urgent || '';
  h.hidden = !urgent;
  if ('setAppBadge' in navigator) {
    (urgent ? navigator.setAppBadge(urgent) : navigator.clearAppBadge()).catch(() => {});
  }
}

/* ---------- Carte commande ---------- */

function sortOrders(list, desc = false) {
  return [...list].sort((a, b) => {
    const da = a.pickupDate || '9999';
    const db = b.pickupDate || '9999';
    if (da !== db) return desc ? db.localeCompare(da) : da.localeCompare(db);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

function paymentLabel(o) {
  const total = S.orderTotal(o);
  const st = S.paymentState(o);
  if (st === 'paid') return total ? '<span class="pay pay-paid">Payée</span>' : '';
  if (st === 'partial') return `<span class="pay pay-partial">Acompte ${eur(o.paid)} · reste ${eur(total - o.paid)}</span>`;
  return '<span class="pay pay-unpaid">À payer</span>';
}

function orderCard(o) {
  const market = marketById(o.marketId);
  const late = S.ACTIVE.includes(o.status) && o.pickupDate && o.pickupDate < todayISO();
  const meta = [
    o.pickupDate ? `<span class="${late ? 'late' : ''}">${esc(formatRelative(o.pickupDate))}${late ? ' · en retard' : ''}</span>` : '<span class="muted">Sans date</span>',
    market ? `<span>${esc(market.name)}</span>` : '',
  ].filter(Boolean).join('<span class="dot">·</span>');
  const next = o.status === 'todo' ? 'Marquer prête' : o.status === 'ready' ? 'Marquer retirée' : '';
  const canCash = o.status !== 'cancelled' && S.paymentState(o) !== 'paid';
  return `
  <article class="order status-${o.status}" data-id="${o.id}">
    <div class="order-head">
      <div class="who">
        <strong>${esc(o.client || 'Client sans nom')}</strong>
        ${o.phone ? `<a class="phone" href="tel:${esc(o.phone.replace(/\s/g, ''))}">${esc(o.phone)}</a>` : ''}
      </div>
      <span class="pill pill-${o.status}">${S.STATUSES[o.status].label}</span>
    </div>
    <div class="order-meta">${meta}</div>
    <ul class="order-items">
      ${o.items.map((it) => `<li><b>${it.qty}</b> × ${esc(it.name)}</li>`).join('') || '<li class="muted">Aucun produit</li>'}
    </ul>
    ${o.notes ? `<p class="order-notes">${esc(o.notes)}</p>` : ''}
    <div class="order-foot">
      <span class="total">${eur(S.orderTotal(o))}</span>
      ${paymentLabel(o)}
    </div>
    <div class="order-actions">
      ${next ? `<button type="button" class="btn small primary" data-action="next">${next}</button>` : ''}
      ${canCash ? '<button type="button" class="btn small" data-action="cash">Encaisser</button>' : ''}
      <button type="button" class="btn small ghost" data-action="edit">Modifier</button>
    </div>
  </article>`;
}

function handleOrderAction(e) {
  const btn = e.target.closest('[data-action]');
  const card = btn && btn.closest('.order');
  if (!card) return false;
  const o = state.orders.find((x) => x.id === card.dataset.id);
  if (!o) return false;
  const before = { ...o };
  const undo = () => {
    Object.assign(o, before);
    persist();
    render();
  };
  if (btn.dataset.action === 'next') {
    o.status = o.status === 'todo' ? 'ready' : 'done';
    o.updatedAt = new Date().toISOString();
    persist();
    render();
    toast(`${o.client || 'Commande'} : ${S.STATUSES[o.status].label.toLowerCase()}`, undo);
  } else if (btn.dataset.action === 'cash') {
    o.paid = S.orderTotal(o);
    persist();
    render();
    toast(`${eur(o.paid)} encaissés`, undo);
  } else if (btn.dataset.action === 'edit') {
    openEditor(o);
  }
  return true;
}

$('#view').addEventListener('click', (e) => {
  if (e.target.closest('.order')) handleOrderAction(e);
});

/* ---------- Formulaire de commande ---------- */

function blankDraft() {
  return { client: '', phone: '', pickupDate: '', marketId: '', items: [], paid: 0, notes: '', status: 'todo', raw: '' };
}

function dateChips(draft) {
  const today = new Date();
  const chips = [
    { label: "Aujourd'hui", date: todayISO() },
    { label: 'Demain', date: toISODate(addDays(today, 1)) },
  ];
  for (const m of state.markets) {
    if (m.day === '' || m.day == null) continue;
    const diff = (+m.day - today.getDay() + 7) % 7;
    chips.push({ label: `${formatShort(toISODate(addDays(today, diff)))} · ${m.name}`, date: toISODate(addDays(today, diff)), marketId: m.id });
  }
  return chips.map((c, i) => {
    const on = draft.pickupDate === c.date && (!c.marketId || draft.marketId === c.marketId);
    return `<button type="button" class="chip${on ? ' on' : ''}" data-action="date-chip" data-i="${i}">${esc(c.label)}</button>`;
  }).join('');
}

function chipData(i) {
  const today = new Date();
  const list = [{ date: todayISO() }, { date: toISODate(addDays(today, 1)) }];
  for (const m of state.markets) {
    if (m.day === '' || m.day == null) continue;
    const diff = (+m.day - today.getDay() + 7) % 7;
    list.push({ date: toISODate(addDays(today, diff)), marketId: m.id });
  }
  return list[i];
}

function itemRow(it, i) {
  const known = it.productId && productById(it.productId);
  const options = state.products.map((p) => `<option value="${p.id}"${p.id === it.productId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  return `
  <div class="item-row${known ? '' : ' unknown'}" data-idx="${i}">
    <div class="item-product">
      <select data-field="productId" aria-label="Produit">
        ${options}
        <option value=""${known ? '' : ' selected'}>Autre produit…</option>
      </select>
      ${known ? '' : `<input data-field="name" value="${esc(it.name)}" placeholder="Nom du produit" aria-label="Nom du produit">`}
    </div>
    <div class="item-controls">
      <div class="stepper">
        <button type="button" data-action="qty-dec" aria-label="Moins">−</button>
        <input data-field="qty" type="number" min="0" inputmode="numeric" value="${it.qty}" aria-label="Quantité">
        <button type="button" data-action="qty-inc" aria-label="Plus">+</button>
      </div>
      <label class="price"><input data-field="unitPrice" type="text" inputmode="decimal" value="${decimalStr(it.unitPrice)}" placeholder="0" aria-label="Prix unitaire"><span>€/u</span></label>
      <button type="button" class="icon-btn" data-action="remove-item" aria-label="Retirer la ligne">✕</button>
    </div>
    ${!known && it.name ? `<button type="button" class="link" data-action="add-to-catalog">+ Ajouter « ${esc(it.name)} » au catalogue</button>` : ''}
  </div>`;
}

/**
 * Monte le formulaire dans `container`. `draft` est modifié en place.
 * opts: { mode: 'new'|'edit', warnings, onSave(draft), onCancel(), onDelete() }
 */
function mountForm(container, draft, opts) {
  const markets = state.markets.map((m) => `<option value="${m.id}"${m.id === draft.marketId ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
  const clients = [...new Set(state.orders.map((o) => o.client).filter(Boolean))];
  const statusOptions = Object.entries(S.STATUSES).map(([k, v]) => `<option value="${k}"${k === draft.status ? ' selected' : ''}>${v.label}</option>`).join('');
  container.innerHTML = `
  <form class="order-form" novalidate>
    ${opts.warnings && opts.warnings.length ? `<ul class="warnings">${opts.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    <div class="grid2">
      <label>Client<input name="client" value="${esc(draft.client)}" autocomplete="off" list="clients-list" placeholder="Nom"></label>
      <label>Téléphone<input name="phone" type="tel" inputmode="tel" value="${esc(draft.phone)}" placeholder="06…"></label>
    </div>
    <datalist id="clients-list">${clients.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="grid2">
      <label>Retrait le<input name="pickupDate" type="date" value="${esc(draft.pickupDate)}"></label>
      <label>Marché / lieu<select name="marketId"><option value="">—</option>${markets}</select></label>
    </div>
    <div class="chips">${dateChips(draft)}</div>
    <fieldset class="items">
      <legend>Produits</legend>
      <div class="items-list"></div>
      <button type="button" class="btn small ghost" data-action="add-item">+ Ajouter un produit</button>
    </fieldset>
    <div class="totals">
      <div>Total <strong class="js-total"></strong></div>
      <div class="js-rest muted"></div>
    </div>
    <label>Déjà payé
      <div class="pay-row">
        <span class="price"><input name="paid" type="text" inputmode="decimal" value="${decimalStr(draft.paid)}" placeholder="0"><span>€</span></span>
        <button type="button" class="chip" data-action="paid-none">Rien</button>
        <button type="button" class="chip" data-action="paid-all">Tout</button>
      </div>
    </label>
    ${opts.mode === 'edit' ? `<label>Statut<select name="status">${statusOptions}</select></label>` : ''}
    <label>Notes<textarea name="notes" rows="2" placeholder="Ex. : sans étiquette, cadeau…">${esc(draft.notes)}</textarea></label>
    ${draft.raw ? `<details class="raw"><summary>Message d'origine</summary><p>${esc(draft.raw)}</p></details>` : ''}
    <p class="form-error" hidden></p>
    <div class="form-actions">
      <button type="submit" class="btn primary">${opts.mode === 'edit' ? 'Enregistrer' : 'Enregistrer la commande'}</button>
      <button type="button" class="btn ghost" data-action="cancel">Annuler</button>
      ${opts.mode === 'edit' ? '<button type="button" class="btn danger ghost" data-action="delete">Supprimer</button>' : ''}
    </div>
  </form>`;

  const form = container.querySelector('form');
  const list = form.querySelector('.items-list');
  const renderItems = () => {
    list.innerHTML = draft.items.map(itemRow).join('') || '<p class="muted empty-items">Aucun produit pour l’instant.</p>';
    updateTotals();
  };
  const updateTotals = () => {
    const total = S.orderTotal(draft);
    // « payé » / « Tout » : le montant payé suit le total tant qu'on modifie la commande
    if (draft.paidFull) {
      draft.paid = total;
      form.elements.paid.value = decimalStr(total);
    }
    form.querySelector('.js-total').textContent = eur(total);
    const rest = total - (draft.paid || 0);
    form.querySelector('.js-rest').textContent = draft.paid > 0 ? (rest > 0.001 ? `Reste ${eur(rest)}` : 'Payée') : '';
  };
  renderItems();

  form.oninput = (e) => {
    const t = e.target;
    const row = t.closest('.item-row');
    if (row) {
      const it = draft.items[+row.dataset.idx];
      const f = t.dataset.field;
      if (f === 'qty') it.qty = Math.max(0, parseInt(t.value, 10) || 0);
      else if (f === 'unitPrice') it.unitPrice = num(t.value);
      else if (f === 'name') it.name = t.value;
      updateTotals();
      return;
    }
    if (t.name === 'paid') { draft.paid = num(t.value); draft.paidFull = false; updateTotals(); }
    else if (t.name && t.name in draft) draft[t.name] = t.value;
  };

  form.onchange = (e) => {
    const t = e.target;
    const row = t.closest('.item-row');
    if (row && t.dataset.field === 'productId') {
      const it = draft.items[+row.dataset.idx];
      const p = productById(t.value);
      if (p) Object.assign(it, { productId: p.id, name: p.name, unitPrice: Number(p.price) || 0 });
      else Object.assign(it, { productId: null });
      renderItems();
    } else if (row && t.dataset.field === 'name') {
      renderItems();
    } else if (t.name === 'client' && !draft.phone) {
      // Client connu : on reprend son téléphone
      const key = normalize(t.value.trim());
      const prev = [...state.orders].reverse().find((o) => o.phone && normalize(o.client || '') === key);
      if (prev) { draft.phone = prev.phone; form.elements.phone.value = prev.phone; }
    } else if (t.name === 'marketId' && !draft.pickupDate) {
      const m = marketById(t.value);
      if (m && m.day !== '' && m.day != null) {
        const today = new Date();
        draft.pickupDate = toISODate(addDays(today, (+m.day - today.getDay() + 7) % 7));
        form.elements.pickupDate.value = draft.pickupDate;
      }
    }
  };

  form.onclick = (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const row = b.closest('.item-row');
    const it = row && draft.items[+row.dataset.idx];
    switch (b.dataset.action) {
      case 'add-item': {
        const p = state.products[0];
        draft.items.push(p ? { productId: p.id, name: p.name, qty: 1, unitPrice: Number(p.price) || 0 } : { productId: null, name: '', qty: 1, unitPrice: 0 });
        renderItems();
        break;
      }
      case 'remove-item': draft.items.splice(+row.dataset.idx, 1); renderItems(); break;
      case 'qty-inc': it.qty += 1; row.querySelector('[data-field=qty]').value = it.qty; updateTotals(); break;
      case 'qty-dec': it.qty = Math.max(0, it.qty - 1); row.querySelector('[data-field=qty]').value = it.qty; updateTotals(); break;
      case 'add-to-catalog': {
        const p = { id: S.uid(), name: it.name.trim(), price: it.unitPrice || 0, keywords: '' };
        state.products.push(p);
        persist();
        Object.assign(it, { productId: p.id, name: p.name });
        mountForm(container, draft, { ...opts, warnings: (opts.warnings || []).filter((w) => !w.includes(it.name)) });
        toast(`« ${p.name} » ajouté au catalogue`);
        break;
      }
      case 'date-chip': {
        const c = chipData(+b.dataset.i);
        draft.pickupDate = c.date;
        if (c.marketId) draft.marketId = c.marketId;
        mountForm(container, draft, opts);
        break;
      }
      case 'paid-none': draft.paid = 0; draft.paidFull = false; form.elements.paid.value = ''; updateTotals(); break;
      case 'paid-all': draft.paidFull = true; updateTotals(); break;
      case 'cancel': opts.onCancel(); break;
      case 'delete': opts.onDelete(); break;
      default:
    }
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    draft.items = draft.items
      .map((i) => ({ ...i, name: (i.name || '').trim() }))
      .filter((i) => i.qty > 0 && i.name);
    const err = form.querySelector('.form-error');
    if (!draft.items.length) {
      err.textContent = 'Ajoute au moins un produit.';
      err.hidden = false;
      renderItems();
      return;
    }
    draft.client = draft.client.trim();
    draft.phone = draft.phone.trim();
    if (draft.paidFull) draft.paid = S.orderTotal(draft);
    delete draft.paidFull;
    opts.onSave(draft);
  };
}

/* ---------- Vue : Nouvelle commande + rappels ---------- */

function renderHome(root) {
  root.innerHTML = `
  <section class="card compose">
    <label for="msg" class="compose-label">Écris ou dicte la commande</label>
    <textarea id="msg" rows="4" placeholder="Ex. : Marie Dupont 06 12 34 56 78, 2 fraise 1 abricot pour samedi, acompte 5 €">${esc(state.draft || '')}</textarea>
    <div class="row">
      <button type="button" class="btn primary" id="analyze">Analyser</button>
      <button type="button" class="btn ghost" id="manual">Saisie manuelle</button>
    </div>
    <p class="hint">Astuce : touche le micro du clavier pour dicter. Le nom, le téléphone, les produits, la date, le marché et l’acompte sont reconnus.</p>
  </section>
  <section id="draft-zone"></section>
  <section class="reminders" id="reminders"></section>`;

  const msg = $('#msg');
  msg.addEventListener('input', () => { state.draft = msg.value; S.save(state); });
  msg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze(); });
  $('#analyze').onclick = analyze;
  $('#manual').onclick = () => { homeDraft = { draft: blankDraft(), warnings: [] }; showHomeDraft(); };

  if (homeDraft) showHomeDraft();
  renderReminders($('#reminders'));
}

function analyze() {
  const text = $('#msg').value.trim();
  if (!text) { $('#manual').click(); return; }
  const r = parseOrder(text, state);
  const draft = {
    ...blankDraft(),
    client: r.client,
    phone: r.phone,
    pickupDate: r.pickupDate,
    marketId: r.marketId,
    items: r.items,
    notes: r.notes,
    raw: text,
  };
  draft.paid = r.paid;
  draft.paidFull = r.paidFull;
  if (!draft.phone && draft.client) {
    const key = normalize(draft.client);
    const prev = [...state.orders].reverse().find((o) => o.phone && normalize(o.client || '') === key);
    if (prev) draft.phone = prev.phone;
  }
  homeDraft = { draft, warnings: r.warnings };
  showHomeDraft();
}

function showHomeDraft() {
  const zone = $('#draft-zone');
  zone.className = 'card draft';
  mountForm(zone, homeDraft.draft, {
    mode: 'new',
    warnings: homeDraft.warnings,
    onCancel: () => { homeDraft = null; zone.innerHTML = ''; zone.className = ''; },
    onSave: (d) => {
      const order = { ...d, id: S.uid(), createdAt: new Date().toISOString(), status: 'todo' };
      state.orders.push(order);
      state.draft = '';
      homeDraft = null;
      persist();
      render();
      toast(`Commande enregistrée${order.client ? ' pour ' + order.client : ''}`, () => {
        state.orders = state.orders.filter((o) => o.id !== order.id);
        persist();
        render();
      });
      $('#msg').focus();
    },
  });
  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function reminderBlock(title, tone, orders, desc) {
  if (!orders.length) return '';
  return `
  <details class="reminder tone-${tone}" open>
    <summary><span class="count">${orders.length}</span> ${esc(title)}</summary>
    ${desc ? `<p class="muted small">${esc(desc)}</p>` : ''}
    <div class="order-list">${sortOrders(orders).map(orderCard).join('')}</div>
  </details>`;
}

function renderReminders(el) {
  const r = computeReminders();
  const upcoming = sortOrders(state.orders.filter((o) => o.status === 'todo' && o.pickupDate && daysFromToday(o.pickupDate) > 1));
  const nextDate = upcoming[0] && upcoming[0].pickupDate;
  const nextCount = nextDate ? upcoming.filter((o) => o.pickupDate === nextDate).length : 0;
  const blocks = [
    reminderBlock('pas encore retirées', 'danger', r.overdue, 'La date de retrait est passée.'),
    reminderBlock("à préparer pour aujourd'hui ou demain", 'warn', r.toPrepare),
    reminderBlock("prêtes, à remettre aujourd'hui", 'ok', r.readyToday),
    reminderBlock('retirées mais pas entièrement payées', 'warn', r.unpaid),
    reminderBlock('sans date de retrait', 'info', r.noDate),
  ].join('');
  el.innerHTML = `
    <h2>Rappels</h2>
    ${blocks || '<p class="empty">Rien d’urgent. Tout est à jour.</p>'}
    ${nextDate ? `<button type="button" class="card next-market" data-goto="production" data-date="${nextDate}">
        <span>Ensuite : <b>${esc(formatRelative(nextDate))}</b> · ${plural(nextCount, 'commande', 'commandes')} à préparer</span>
        <span class="arrow">Voir la production →</span>
      </button>` : ''}`;
  const nm = el.querySelector('.next-market');
  if (nm) nm.onclick = () => { prodUI.date = nm.dataset.date; go('production'); };
}

/* ---------- Vue : Commandes ---------- */

const STATUS_FILTERS = [
  ['active', 'En cours', (o) => S.ACTIVE.includes(o.status)],
  ['todo', 'À préparer', (o) => o.status === 'todo'],
  ['ready', 'Prêtes', (o) => o.status === 'ready'],
  ['done', 'Retirées', (o) => o.status === 'done'],
  ['cancelled', 'Annulées', (o) => o.status === 'cancelled'],
  ['all', 'Toutes', () => true],
];

function renderOrders(root) {
  root.innerHTML = `
  <div class="toolbar">
    <input type="search" id="q" placeholder="Rechercher un client, un produit…" value="${esc(ordersUI.q)}">
    <div class="seg" role="group" aria-label="Regrouper par">
      ${[['date', 'Par date'], ['market', 'Par marché'], ['status', 'Par statut']].map(([k, l]) => `<button type="button" data-group="${k}" aria-pressed="${ordersUI.group === k}">${l}</button>`).join('')}
    </div>
    <div class="chips" id="status-chips"></div>
  </div>
  <div id="order-groups"></div>`;
  $('#q').addEventListener('input', (e) => { ordersUI.q = e.target.value; renderOrderList(); });
  root.querySelector('.seg').onclick = (e) => {
    const b = e.target.closest('[data-group]');
    if (b) { ordersUI.group = b.dataset.group; renderOrders(root); }
  };
  $('#status-chips').onclick = (e) => {
    const b = e.target.closest('[data-status]');
    if (b) { ordersUI.status = b.dataset.status; renderOrderList(); }
  };
  renderOrderList();
}

function renderOrderList() {
  const q = normalize(ordersUI.q.trim());
  const matches = (o) => !q || normalize([o.client, o.phone, o.notes, ...o.items.map((i) => i.name), marketById(o.marketId)?.name].join(' ')).includes(q);
  const searched = state.orders.filter(matches);
  $('#status-chips').innerHTML = STATUS_FILTERS.map(([k, l, f]) =>
    `<button type="button" class="chip${ordersUI.status === k ? ' on' : ''}" data-status="${k}">${l} <span class="n">${searched.filter(f).length}</span></button>`).join('');

  const filter = STATUS_FILTERS.find(([k]) => k === ordersUI.status)[2];
  const list = sortOrders(searched.filter(filter), ['done', 'cancelled', 'all'].includes(ordersUI.status));
  const el = $('#order-groups');
  if (!list.length) {
    el.innerHTML = `<p class="empty">${state.orders.length ? 'Aucune commande ne correspond.' : 'Aucune commande pour l’instant. Saisis ta première commande dans l’onglet « Saisir ».'}</p>`;
    return;
  }

  const groups = new Map();
  const today = todayISO();
  for (const o of list) {
    let key;
    let label;
    if (ordersUI.group === 'date') {
      key = o.pickupDate || 'zz';
      label = o.pickupDate ? formatRelative(o.pickupDate) + (o.pickupDate < today ? ' (passée)' : '') : 'Sans date';
    } else if (ordersUI.group === 'market') {
      const m = marketById(o.marketId);
      key = m ? m.id : 'zz';
      label = m ? m.name : 'Sans marché';
    } else {
      key = Object.keys(S.STATUSES).indexOf(o.status);
      label = S.STATUSES[o.status].label;
    }
    if (!groups.has(key)) groups.set(key, { label, orders: [] });
    groups.get(key).orders.push(o);
  }
  const keys = [...groups.keys()];
  if (ordersUI.group === 'status') keys.sort((a, b) => a - b);
  if (ordersUI.group === 'market') keys.sort((a, b) => (a === 'zz') - (b === 'zz') || groups.get(a).label.localeCompare(groups.get(b).label));
  el.innerHTML = keys.map((k) => {
    const g = groups.get(k);
    const total = g.orders.reduce((s, o) => s + S.orderTotal(o), 0);
    return `
    <section class="group">
      <h3>${esc(g.label)} <span class="muted">${plural(g.orders.length, 'commande', 'commandes')} · ${eur(total)}</span></h3>
      <div class="order-list">${g.orders.map(orderCard).join('')}</div>
    </section>`;
  }).join('');
}

/* ---------- Édition (fenêtre) ---------- */

function openEditor(order) {
  const dlg = $('#editor');
  const draft = JSON.parse(JSON.stringify(order));
  const close = () => dlg.close();
  mountForm($('#editor-body'), draft, {
    mode: 'edit',
    onCancel: close,
    onSave: (d) => {
      Object.assign(order, d, { updatedAt: new Date().toISOString() });
      persist();
      close();
      render();
      toast('Commande modifiée');
    },
    onDelete: () => {
      if (!confirm(`Supprimer la commande de ${order.client || 'ce client'} ?`)) return;
      const idx = state.orders.indexOf(order);
      state.orders.splice(idx, 1);
      persist();
      close();
      render();
      toast('Commande supprimée', () => { state.orders.splice(idx, 0, order); persist(); render(); });
    },
  });
  dlg.showModal();
  $('#editor-body').scrollTop = 0;
}
$('#editor-close').onclick = () => $('#editor').close();
$('#editor').addEventListener('click', (e) => { if (e.target.id === 'editor') e.target.close(); });

/* ---------- Vue : Production ---------- */

function aggregate(orders) {
  const map = new Map();
  for (const o of orders) {
    for (const it of o.items) {
      const p = it.productId && productById(it.productId);
      const key = p ? p.id : 'n:' + normalize(it.name);
      if (!map.has(key)) map.set(key, { name: p ? p.name : it.name, qty: 0, amount: 0, order: p ? state.products.indexOf(p) : 9999 });
      const row = map.get(key);
      row.qty += Number(it.qty) || 0;
      row.amount += (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
    }
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function prodTable(title, orders) {
  const rows = aggregate(orders);
  const units = rows.reduce((s, r) => s + r.qty, 0);
  const amount = rows.reduce((s, r) => s + r.amount, 0);
  return `
  <section class="card prod">
    <h3>${title}</h3>
    <table>
      <thead><tr><th>Produit</th><th class="num">Quantité</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num"><b>${r.qty}</b></td></tr>`).join('')}</tbody>
    </table>
    <p class="muted small">${plural(orders.length, 'commande', 'commandes')} · ${plural(units, 'article', 'articles')} · ${eur(amount)}</p>
  </section>`;
}

function renderProduction(root) {
  const statuses = prodUI.includeReady ? ['todo', 'ready'] : ['todo'];
  const pool = state.orders.filter((o) => statuses.includes(o.status));
  const dates = [...new Set(pool.map((o) => o.pickupDate || ''))].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
  if (prodUI.date !== 'all' && !dates.includes(prodUI.date)) prodUI.date = 'all';
  const today = todayISO();

  const selected = prodUI.date === 'all' ? pool : pool.filter((o) => (o.pickupDate || '') === prodUI.date);
  const groups = new Map();
  for (const o of sortOrders(selected)) {
    const key = (o.pickupDate || '') + '|' + (o.marketId || '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  const groupTitle = (key) => {
    const [d, m] = key.split('|');
    const market = marketById(m);
    return `${d ? esc(formatRelative(d)) + (d < today ? ' <span class="late">(en retard)</span>' : '') : 'Sans date'}${market ? ` <span class="muted">· ${esc(market.name)}</span>` : ''}`;
  };

  root.innerHTML = `
  <div class="toolbar">
    <div class="chips">
      <button type="button" class="chip${prodUI.date === 'all' ? ' on' : ''}" data-date="all">Tout à venir</button>
      ${dates.map((d) => `<button type="button" class="chip${prodUI.date === d ? ' on' : ''}${d && d < today ? ' late' : ''}" data-date="${d}">${d ? esc(formatShort(d)) : 'Sans date'} <span class="n">${pool.filter((o) => (o.pickupDate || '') === d).length}</span></button>`).join('')}
    </div>
    <label class="check"><input type="checkbox" id="incl-ready"${prodUI.includeReady ? ' checked' : ''}> Inclure les commandes déjà prêtes</label>
  </div>
  ${!selected.length ? '<p class="empty">Rien à préparer.</p>' : `
    ${groups.size > 1 ? prodTable('Total', selected) : ''}
    ${[...groups.entries()].map(([k, os]) => prodTable(groupTitle(k), os)).join('')}
  `}`;
  root.querySelector('.chips').onclick = (e) => {
    const b = e.target.closest('[data-date]');
    if (b) { prodUI.date = b.dataset.date; renderProduction(root); }
  };
  $('#incl-ready').onchange = (e) => { prodUI.includeReady = e.target.checked; renderProduction(root); };
}

/* ---------- Vue : Réglages ---------- */

function renderSettings(root) {
  const dayOptions = (sel) => `<option value=""${sel === '' || sel == null ? ' selected' : ''}>Pas de jour fixe</option>` +
    S.WEEKDAYS.map((d, i) => `<option value="${i}"${sel !== '' && sel != null && +sel === i ? ' selected' : ''}>${d}</option>`).join('');
  const old = state.orders.filter((o) => ['done', 'cancelled'].includes(o.status) && daysFromToday((o.updatedAt || o.createdAt).slice(0, 10)) < -30);
  root.innerHTML = `
  <section class="card settings" data-list="products">
    <h2>Mes produits</h2>
    <p class="muted small">Le prix sert au calcul du total. « Autres noms » : les mots que tu utilises dans tes messages (séparés par des virgules).</p>
    ${state.products.map((p, i) => `
      <div class="set-row" data-i="${i}">
        <input data-f="name" value="${esc(p.name)}" placeholder="Nom" aria-label="Nom du produit">
        <span class="price"><input data-f="price" type="text" inputmode="decimal" value="${decimalStr(p.price)}" placeholder="0" aria-label="Prix"><span>€</span></span>
        <input data-f="keywords" class="wide" value="${esc(p.keywords)}" placeholder="Autres noms (facultatif)" aria-label="Autres noms">
        <button type="button" class="icon-btn" data-del aria-label="Supprimer ${esc(p.name)}">✕</button>
      </div>`).join('')}
    <button type="button" class="btn small ghost" data-add>+ Ajouter un produit</button>
  </section>

  <section class="card settings" data-list="markets">
    <h2>Mes marchés et lieux de retrait</h2>
    <p class="muted small">Avec un jour fixe, « samedi » dans un message choisit automatiquement le bon marché, et inversement.</p>
    ${state.markets.map((m, i) => `
      <div class="set-row" data-i="${i}">
        <input data-f="name" value="${esc(m.name)}" placeholder="Nom" aria-label="Nom du marché">
        <select data-f="day" aria-label="Jour">${dayOptions(m.day)}</select>
        <input data-f="keywords" class="wide" value="${esc(m.keywords)}" placeholder="Autres noms (ex. : vannes, place des Lices)" aria-label="Autres noms">
        <button type="button" class="icon-btn" data-del aria-label="Supprimer ${esc(m.name)}">✕</button>
      </div>`).join('')}
    <button type="button" class="btn small ghost" data-add>+ Ajouter un marché</button>
  </section>

  <section class="card">
    <h2>Comment écrire un message</h2>
    <ul class="examples">
      <li><code>Marie Dupont 06 12 34 56 78, 2 fraise 1 abricot pour samedi, acompte 5 €</code></li>
      <li><code>Mme Martin : fraises x3, abricots 2, retrait le 12/10, payé</code></li>
      <li><code>Paul deux pots de framboise demain. Note : pour un cadeau</code></li>
    </ul>
    <p class="muted small">Tu peux toujours corriger avant d’enregistrer. Un produit inconnu est signalé et peut être ajouté au catalogue en un clic.</p>
  </section>

  <section class="card">
    <h2>Données</h2>
    <p class="small">${plural(state.orders.length, 'commande enregistrée', 'commandes enregistrées')} sur cet appareil. Les données restent uniquement dans ce navigateur : ne vide pas ses données de navigation.</p>
    <div class="row">
      <button type="button" class="btn small ghost" id="purge"${old.length ? '' : ' disabled'}>Archiver ${old.length ? `les ${old.length} ` : 'les '}commandes terminées depuis plus de 30 jours</button>
      <button type="button" class="btn small danger ghost" id="wipe">Tout effacer</button>
    </div>
  </section>`;

  root.querySelectorAll('.settings').forEach((sec) => {
    const arr = state[sec.dataset.list];
    sec.onchange = (e) => {
      const row = e.target.closest('.set-row');
      if (!row) return;
      const f = e.target.dataset.f;
      const item = arr[+row.dataset.i];
      item[f] = f === 'price' ? num(e.target.value) : f === 'day' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value.trim();
      persist();
    };
    sec.onclick = (e) => {
      if (e.target.closest('[data-add]')) {
        arr.push(sec.dataset.list === 'products' ? { id: S.uid(), name: '', price: 0, keywords: '' } : { id: S.uid(), name: '', day: '', keywords: '' });
        persist();
        renderSettings(root);
        const rows = root.querySelectorAll(`[data-list=${sec.dataset.list}] .set-row`);
        rows[rows.length - 1].querySelector('input').focus();
      } else if (e.target.closest('[data-del]')) {
        const i = +e.target.closest('.set-row').dataset.i;
        const removed = arr.splice(i, 1)[0];
        persist();
        renderSettings(root);
        toast(`« ${removed.name || 'Sans nom'} » supprimé`, () => { arr.splice(i, 0, removed); persist(); renderSettings(root); });
      }
    };
  });
  $('#purge').onclick = () => {
    if (!confirm(`Supprimer définitivement ${plural(old.length, 'commande terminée', 'commandes terminées')} depuis plus de 30 jours ?`)) return;
    const ids = new Set(old.map((o) => o.id));
    state.orders = state.orders.filter((o) => !ids.has(o.id));
    persist();
    renderSettings(root);
  };
  $('#wipe').onclick = () => {
    if (!confirm('Effacer TOUTES les commandes de cet appareil ? Cette action est définitive.')) return;
    state.orders = [];
    persist();
    renderSettings(root);
    toast('Toutes les commandes ont été effacées');
  };
}

/* ---------- Démarrage ---------- */

// Rafraîchit les rappels quand on revient sur l'appli (changement de jour, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$('#editor').open && !homeDraft) { render(); updateBadges(); }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

updateBadges();
go('home');
