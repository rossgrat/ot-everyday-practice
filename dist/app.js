import { EXERCISES, SCENARIOS, money, dateLabel, toCents, createSession, act, evaluateTask, summarize } from './model.js';

const app = document.querySelector('#app');
const HISTORY_KEY = 'everyday-practice.history.v1';
const ACTIVE_KEY = 'everyday-practice.active.v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bank: '<path d="m3 9 9-6 9 6M4 10h16M5 20h14M7 11v6m5-6v6m5-6v6M3 21h18"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8m-8 4h6"/>',
  leaf: '<path d="M20 4C9 2 3 7 5 14c2 7 15 6 15-10ZM5 20 16 9"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  transfer: '<path d="M4 7h16m-5-5 5 5-5 5M20 17H4m5-5-5 5 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.file}</svg>`;
const mark = '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const duration = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
const validSession = session => session && EXERCISES.some(item => item.id === session.exerciseId) && session.scenario && Array.isArray(session.events) && Array.isArray(session.payments);
const saved = readStorage(ACTIVE_KEY, null);
const state = {
  screen: 'library', filter: 'all', modal: null, selected: 'schedule-payment',
  session: validSession(saved) && !saved.endedAt ? saved : null,
  history: (Array.isArray(readStorage(HISTORY_KEY, [])) ? readStorage(HISTORY_KEY, []) : []).filter(validSession),
  service: 'bank', bankPage: 'overview', phonePage: 'overview', receiptId: null,
  draft: {}, checkResult: false, reportId: null, toast: '', storageError: false
};

function persist() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 50)));
    if (state.session && !state.session.endedAt) localStorage.setItem(ACTIVE_KEY, JSON.stringify(state.session));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { state.storageError = true; }
}
function update(type, payload = {}) {
  state.session = act(state.session, type, payload);
  if (state.session.endedAt) {
    const index = state.history.findIndex(item => item.id === state.session.id);
    if (index >= 0) state.history[index] = state.session;
    else state.history.unshift(state.session);
  }
  persist();
}
function announce(message) { document.querySelector('#announcer').textContent = message; }
function toast(message) {
  state.toast = message; announce(message);
  setTimeout(() => { if (state.toast === message) { state.toast = ''; document.querySelector('.toast')?.remove(); } }, 5000);
}
function exercise(session = state.session) { return EXERCISES.find(item => item.id === session?.exerciseId); }
function navigate(screen) {
  if (state.screen === 'practice' && screen !== 'practice' && state.session && !state.session.endedAt && !state.session.pausedAt) update('pause');
  state.screen = screen; state.modal = null; render(); document.querySelector('#main')?.focus({ preventScroll: true });
}
function startSession(id, scenarioId, hintsEnabled) {
  if (state.session && !state.session.endedAt) update('finish');
  state.session = createSession(id, scenarioId, hintsEnabled);
  state.screen = 'practice'; state.modal = null; state.service = id === 'due-date' ? 'phone' : 'bank';
  state.bankPage = 'overview'; state.phonePage = 'overview'; state.receiptId = null; state.checkResult = false; state.draft = {};
  persist(); render(); document.querySelector('#main')?.focus({ preventScroll: true });
}
function finish() { update('finish'); state.reportId = state.session.id; state.screen = 'report'; state.modal = null; render(); document.querySelector('#main')?.focus({ preventScroll: true }); }
function shell(content, title) {
  const completed = state.history.filter(item => evaluateTask(item).complete).length;
  return `<div class="workspace-layout"><aside class="sidebar"><a class="brand" href="#" data-action="library">${mark}<span>everyday<span class="brand-second">practice</span></span></a><div class="workspace-label">THERAPY WORKSPACE</div><nav class="workspace-nav" aria-label="Workspace"><button aria-label="Exercise library" data-action="library" class="${state.screen === 'library' ? 'active' : ''}">${icon('grid')}<span>Exercise library</span><span class="nav-count">5</span></button><button aria-label="Session results" data-action="results" class="${['results', 'report'].includes(state.screen) ? 'active' : ''}">${icon('file')}<span>Session results</span>${state.history.length ? `<span class="nav-count">${state.history.length}</span>` : ''}</button><button aria-label="How it works" data-action="guide" class="${state.screen === 'guide' ? 'active' : ''}">${icon('help')}<span>How it works</span></button></nav><div class="sidebar-bottom"><div class="small-leaf">${icon('leaf', 25)}</div><p>Small steps.<br>Everyday possibilities.</p><div class="sidebar-divider"></div><span>${completed} completed session${completed === 1 ? '' : 's'}</span><small>Saved in this browser</small></div></aside><div class="workspace"><header class="workspace-header"><div class="breadcrumb">Workspace <span>/</span> <strong>${title}</strong></div><span class="fiction-pill">${icon('shield', 15)} Fictional data only</span></header><main id="main" class="workspace-main" tabindex="-1">${content}</main><footer class="workspace-footer"><span>Everyday Practice</span><span>${state.storageError ? 'Browser storage unavailable. Download results to keep them.' : 'Session records stay in this browser.'}</span></footer></div></div>`;
}
function library() {
  const cards = EXERCISES.filter(item => state.filter === 'all' || item.service === state.filter || item.service === 'both');
  return shell(`<div class="page-intro"><div><div class="eyebrow">EXERCISE LIBRARY</div><h1>Practice for<br><em>everyday life.</em></h1><p>A familiar place to build confidence with digital tasks.<br>Choose an exercise and make it your patient’s next small step.</p></div><div class="intro-illustration" aria-hidden="true"><div class="illus-sheet"><span></span><i></i><i></i><i></i><b>${icon('check', 24)}</b></div><div class="illus-bank">${icon('bank', 36)}</div><div class="illus-phone">${icon('phone', 30)}</div><div class="illus-dot"></div></div></div>${state.session && !state.session.endedAt ? `<div class="resume-banner"><div class="round-icon">${icon('pause')}</div><div><strong>A session is in progress</strong><span>${exercise().title} · Practice set ${state.session.scenario.id}</span></div><button class="button primary" data-action="resume">Resume session ${icon('arrow', 17)}</button></div>` : ''}<div class="library-meta"><div><strong>5</strong><span>focused exercises</span></div><div><strong>2</strong><span>fictional services</span></div><div>${icon('reset', 21)}<span>Repeat, reset, and try again</span></div></div><div class="section-top"><div class="filter-tabs" role="group" aria-label="Filter exercises">${[['all', 'All exercises'], ['bank', 'Banking'], ['phone', 'Phone account']].map(([key, label]) => `<button data-action="filter" data-value="${key}" class="${state.filter === key ? 'selected' : ''}" aria-pressed="${state.filter === key}">${label}</button>`).join('')}</div><span class="muted small">Therapist-led · Self-paced</span></div><div class="exercise-grid">${cards.map(item => { const index = EXERCISES.indexOf(item); return `<article class="exercise-card"><div class="card-top"><div class="exercise-icon ${item.service === 'phone' ? 'peach' : ''}">${icon(['file', 'bank', 'transfer', 'eye', 'reset'][index], 25)}</div><span class="exercise-number">0${index + 1}</span></div><div class="service-label">${item.service === 'phone' ? 'CEDAR MOBILE' : item.service === 'both' ? 'BANKING + PHONE ACCOUNT' : 'HARBOR BANK'}</div><h2>${item.title}</h2><p>${item.description}</p><div class="skill-tag">${item.skill}</div><button class="card-action" data-action="setup" data-id="${item.id}" aria-label="Set up ${item.title}">Set up exercise ${icon('arrow', 18)}</button></article>`; }).join('')}<aside class="library-note"><div class="note-icon">${icon('leaf', 27)}</div><h2>Progress has<br>many forms.</h2><p>A correct decision. A useful checklist. A mistake noticed and corrected.</p><p>Record the outcome and the support that helped.</p><button class="text-button" data-action="guide">About the exercises ${icon('arrow', 17)}</button></aside></div>`, 'Exercise library');
}
function setupModal() {
  const item = EXERCISES.find(value => value.id === state.selected);
  return `<div class="modal-heading"><div><div class="eyebrow">SESSION SETUP</div><h2>${item.title}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close setup">${icon('close')}</button></div><p class="muted">${item.description}</p><form data-form="setup"><label for="practice-set">Practice set</label><select id="practice-set" name="scenario">${SCENARIOS.map(s => `<option value="${s.id}">Set ${s.id} · ${s.month} · ${money(s.bill)} bill</option>`).join('')}</select><p class="field-help">Each set changes the bill, balance, and dates. All dates belong to the fictional scenario.</p><label class="checkbox-row"><input type="checkbox" name="hints" checked><span><strong>Make hints available</strong><small>The patient can request up to three hints. Each is recorded.</small></span></label><div class="task-preview"><span class="eyebrow">PATIENT INSTRUCTIONS</span><p>${item.instructions}</p></div>${state.session && !state.session.endedAt ? '<p class="notice">Starting this exercise will end and save the session in progress.</p>' : ''}<div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">Back to library</button><button class="button primary" type="submit">Start session ${icon('arrow', 17)}</button></div></form>`;
}
function paymentList(session, heading = 'Scheduled payments') {
  return `<div class="panel-heading"><h3>${heading}</h3><span class="small muted">${session.payments.filter(p => p.status === 'scheduled').length} scheduled</span></div>${session.payments.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Recipient</th><th>Date</th><th>Amount</th><th>Status</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>${session.payments.map(p => `<tr><td><strong>${esc(p.payee)}</strong><small>${p.account === 'checking' ? 'Checking •• 4821' : 'Savings •• 9016'}</small></td><td>${dateLabel(p.date)}</td><td class="money-text">${money(p.amount)}</td><td><span class="status ${p.status === 'canceled' ? 'neutral' : ''}">${p.status === 'canceled' ? 'Canceled' : 'Scheduled'}</span></td><td><button class="text-button" data-action="receipt" data-id="${p.id}" aria-label="View payment ${p.id}">Details ${icon('chevron', 14)}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-inline">No payments scheduled. Your next payment will appear here.</div>'}`;
}
function bankOverview(session) {
  const priorDate = days => dateLabel(new Date(Date.parse(session.scenario.today) - days * 86400000).toISOString().slice(0, 10));
  return `<div class="service-page-title"><div><span class="eyebrow">YOUR ACCOUNTS</span><h2>Good morning, Alex.</h2><p>Here’s an overview of your money.</p></div><button class="button bank-button" data-action="bank-nav" data-page="pay">${icon('plus', 17)} Make a payment</button></div><div class="account-grid"><article class="account-card"><div class="account-title"><span>Everyday Checking</span><span>•• 4821</span></div><span class="account-amount">${money(session.checking)}</span><span class="small">Available balance</span><div class="account-detail">Current balance <strong>${money(session.checking + session.scenario.pending)}</strong></div><div class="small muted">${money(session.scenario.pending)} in pending card transactions</div></article><article class="account-card savings"><div class="account-title"><span>Everyday Savings</span><span>•• 9016</span></div><span class="account-amount">${money(session.savings)}</span><span class="small">Available balance</span><div class="account-detail">Put money where you need it.<button class="text-button" data-action="bank-nav" data-page="transfer">Transfer ${icon('arrow', 15)}</button></div></article></div><section class="white-panel">${paymentList(session)}</section><section class="white-panel"><div class="panel-heading"><h3>Recent checking transactions</h3><span class="small muted">Fictional account activity</span></div><div class="transaction"><div class="transaction-icon">${icon('file', 17)}</div><div><strong>Neighborhood Market</strong><small>Card purchase · ${priorDate(3)}</small></div><strong>−$42.60</strong></div><div class="transaction"><div class="transaction-icon">${icon('transfer', 17)}</div><div><strong>Payroll deposit</strong><small>Direct deposit · ${priorDate(4)}</small></div><strong class="positive">+$850.00</strong></div></section>`;
}
function paymentForm(session, isPhone) {
  const d = state.draft;
  return `<div class="service-page-title"><div><span class="eyebrow">${isPhone ? 'CEDAR MOBILE' : 'PAY & TRANSFER'}</span><h2>Make a payment</h2><p>Enter the details, then review before confirming.</p></div></div><form data-form="payment" class="service-form white-panel"><label for="payee">Recipient</label><select id="payee" name="payee" data-draft="payee" ${isPhone ? 'aria-describedby="cedar-payee-help"' : ''}><option value="Cedar Mobile" ${d.payee === 'Cedar Mobile' || !d.payee ? 'selected' : ''}>Cedar Mobile · Phone bill</option>${isPhone ? '' : `<option value="City Electric" ${d.payee === 'City Electric' ? 'selected' : ''}>City Electric · Electricity</option>`}</select>${isPhone ? '<p id="cedar-payee-help" class="field-help">This payment is for your Cedar Mobile account.</p>' : ''}<label for="funding-account">Pay from</label><select id="funding-account" name="account" data-draft="account"><option value="checking" ${d.account !== 'savings' ? 'selected' : ''}>Checking •• 4821 — ${money(session.checking)} available</option><option value="savings" ${d.account === 'savings' ? 'selected' : ''}>Savings •• 9016 — ${money(session.savings)} available</option></select><div class="form-grid"><div><label for="payment-amount">Amount ($)</label><input id="payment-amount" name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" required data-draft="amount" value="${esc(d.amount ?? '')}" placeholder="0.00"></div><div><label for="payment-date">Payment date</label><input id="payment-date" name="date" type="date" min="${session.scenario.today}" required data-draft="date" value="${esc(d.date ?? '')}"></div></div><div class="form-error" role="alert" id="form-error"></div><button type="submit" class="button ${isPhone ? 'phone-button' : 'bank-button'}">Review payment ${icon('arrow', 17)}</button></form>`;
}
function reviewPayment() {
  const d = state.review;
  return `<div class="service-page-title"><div><span class="eyebrow">ONE MORE STEP</span><h2>Review your payment</h2><p>Check the details before you schedule it.</p></div></div><section class="white-panel review-panel"><dl class="detail-list"><div><dt>Recipient</dt><dd>${esc(d.payee)}</dd></div><div><dt>From account</dt><dd>${d.account === 'checking' ? 'Checking •• 4821' : 'Savings •• 9016'}</dd></div><div><dt>Amount</dt><dd class="large-money">${money(d.amount)}</dd></div><div><dt>Payment date</dt><dd>${dateLabel(d.date)}</dd></div></dl><p class="muted small">This will create a scheduled payment. You can cancel it from payment details.</p><div id="form-error" class="form-error" role="alert"></div><div class="button-row"><button class="button secondary" data-action="edit-payment">Edit details</button><button class="button bank-button" data-action="confirm-payment">Confirm payment ${icon('check', 17)}</button></div></section>`;
}
function receipt(session) {
  const p = session.payments.find(item => item.id === state.receiptId);
  if (!p) return '<p>Payment not found.</p>';
  return `<div class="service-page-title"><div><span class="eyebrow">PAYMENT DETAILS</span><h2>${p.status === 'canceled' ? 'Payment canceled' : 'Your payment is scheduled'}</h2><p>${p.status === 'canceled' ? 'This payment will not be processed.' : 'Scheduled does not mean paid. Keep this confirmation for your records.'}</p></div><div class="receipt-check ${p.status === 'canceled' ? 'canceled' : ''}">${icon(p.status === 'canceled' ? 'close' : 'check', 27)}</div></div><section class="white-panel review-panel"><dl class="detail-list"><div><dt>Recipient</dt><dd>${esc(p.payee)}</dd></div><div><dt>From account</dt><dd>${p.account === 'checking' ? 'Checking •• 4821' : 'Savings •• 9016'}</dd></div><div><dt>Amount</dt><dd class="large-money">${money(p.amount)}</dd></div><div><dt>Payment date</dt><dd>${dateLabel(p.date)}</dd></div><div><dt>Confirmation number</dt><dd class="confirmation">${p.id}</dd></div><div><dt>Status</dt><dd><span class="status ${p.status === 'canceled' ? 'neutral' : ''}">${p.status === 'canceled' ? 'Canceled' : 'Scheduled'}</span></dd></div></dl><div class="button-row"><button class="button secondary" data-action="download-receipt">${icon('download', 17)} Save confirmation</button>${p.status === 'scheduled' ? `<button class="button danger-outline" data-action="cancel" data-id="${p.id}">Cancel payment</button>` : ''}</div></section>`;
}
function transferForm(session) {
  return `<div class="service-page-title"><div><span class="eyebrow">BETWEEN YOUR ACCOUNTS</span><h2>Transfer money</h2><p>Move available funds between checking and savings.</p></div></div><form data-form="transfer" class="white-panel service-form"><label for="transfer-from">From</label><select id="transfer-from" name="from"><option value="savings">Savings •• 9016 — ${money(session.savings)}</option><option value="checking">Checking •• 4821 — ${money(session.checking)}</option></select><label for="transfer-to">To</label><select id="transfer-to" name="to"><option value="checking">Checking •• 4821</option><option value="savings">Savings •• 9016</option></select><label for="transfer-amount">Amount ($)</label><input id="transfer-amount" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="0.00" required><div id="form-error" class="form-error" role="alert"></div><button class="button bank-button" type="submit">Transfer funds ${icon('transfer', 17)}</button></form>`;
}
function bank(session) {
  const page = state.bankPage;
  const content = page === 'overview' ? bankOverview(session) : page === 'pay' ? paymentForm(session, false) : page === 'review' ? reviewPayment() : page === 'receipt' ? receipt(session) : page === 'transfer' ? transferForm(session) : `<div class="service-page-title"><div><span class="eyebrow">YOUR ACTIVITY</span><h2>Payments</h2><p>Review scheduled and canceled payments.</p></div><button class="button bank-button" data-action="bank-nav" data-page="pay">Make a payment</button></div><section class="white-panel">${paymentList(session, 'Payment history')}</section>`;
  return `<div class="bank-site"><header class="service-header"><span class="service-brand">${icon('bank', 27)} harbor<span>bank</span></span><span class="service-user">Alex Morgan <span class="avatar">AM</span></span></header><nav class="service-nav" aria-label="Harbor Bank">${[['overview', 'Overview'], ['payments', 'Payments'], ['pay', 'Pay & transfer']].map(([key, label]) => `<button class="${page === key || key === 'pay' && ['review', 'transfer'].includes(page) ? 'selected' : ''}" data-action="bank-nav" data-page="${key}">${label}</button>`).join('')}<button class="${page === 'transfer' ? 'selected' : ''}" data-action="bank-nav" data-page="transfer">Transfer money</button></nav><div class="service-content">${content}</div><footer class="service-footer">Harbor Bank is a fictional practice service. No real money moves.</footer></div>`;
}
function phone(session) {
  const s = session.scenario;
  const phoneSession = { ...session, payments: session.payments.filter(p => p.payee === 'Cedar Mobile') };
  const active = phoneSession.payments.filter(p => p.status === 'scheduled');
  const page = state.phonePage;
  let content;
  if (page === 'pay') content = paymentForm(session, true);
  else if (page === 'review') content = reviewPayment();
  else if (page === 'receipt') content = receipt(session);
  else if (page === 'bill') content = `<div class="service-page-title"><div><span class="eyebrow">BILLS & PAYMENTS</span><h2>Your ${s.month} bill</h2><p>Account •• 7742 · Alex Morgan</p></div><button class="button phone-button" data-action="phone-nav" data-page="pay">Pay bill ${icon('arrow', 17)}</button></div><section class="white-panel bill-sheet"><div class="bill-header"><span class="cedar-wordmark">cedar<span>mobile</span></span><div>Bill issued<strong>${dateLabel(s.today)}</strong></div></div><div class="bill-total"><div><span>Total amount due</span><strong>${money(s.bill)}</strong></div><div><span>Payment due</span><strong>${dateLabel(s.dueDate)}</strong></div></div><h3>Charges this month</h3><div class="bill-line"><span>Everyday mobile plan</span><span>${money(s.bill - 545)}</span></div><div class="bill-line"><span>Taxes and service fees</span><span>$5.45</span></div><div class="bill-line total"><strong>Total amount due</strong><strong>${money(s.bill)}</strong></div><p class="muted small">Scheduled payments appear below and remain unpaid until processed.</p></section><section class="white-panel">${paymentList(phoneSession, 'Payment activity')}</section>`;
  else content = `<div class="service-page-title"><div><span class="eyebrow">YOUR MOBILE ACCOUNT</span><h2>Hello, Alex.</h2><p>A little clarity for your everyday connection.</p></div><span class="status neutral">Account active</span></div><div class="phone-overview"><section class="phone-bill-card"><span class="eyebrow">${s.month.toUpperCase()} BILL</span><span class="phone-amount">${money(s.bill)}</span><span>Amount due · ${dateLabel(s.dueDate)}</span>${active.length ? `<div class="scheduled-note">${icon('clock', 17)} ${active.length} payment${active.length === 1 ? '' : 's'} scheduled · not yet paid</div>` : '<div class="scheduled-note">No payment scheduled</div>'}<div class="button-row"><button class="button phone-button" data-action="phone-nav" data-page="pay">Pay bill ${icon('arrow', 17)}</button><button class="button phone-secondary" data-action="phone-nav" data-page="bill">View bill</button></div></section><section class="phone-plan"><div class="exercise-icon peach">${icon('phone', 26)}</div><h3>Everyday mobile</h3><p>Unlimited calls & texts<br>15 GB monthly data</p><span class="small muted">Line ending in 0148</span><div class="data-meter"><span></span></div><span class="small">6.2 GB of 15 GB used</span></section></div><section class="white-panel">${paymentList(phoneSession, 'Recent payment activity')}</section>`;
  return `<div class="phone-site"><header class="service-header"><span class="service-brand cedar">${icon('leaf', 28)} cedar<span>mobile</span></span><span class="service-user">Alex Morgan <span class="avatar">AM</span></span></header><nav class="service-nav" aria-label="Cedar Mobile"><button class="${page === 'overview' ? 'selected' : ''}" data-action="phone-nav" data-page="overview">Overview</button><button class="${page === 'bill' ? 'selected' : ''}" data-action="phone-nav" data-page="bill">Bills & payments</button></nav><div class="service-content">${content}</div><footer class="service-footer">Cedar Mobile is a fictional practice service. All account details are made up.</footer></div>`;
}
function answerFields(session) {
  const a = session.answers;
  if (session.exerciseId === 'due-date') return `<label for="answer-date">Payment due date</label><input id="answer-date" name="dueDate" data-answer type="date" value="${esc(a.dueDate)}">`;
  if (session.exerciseId === 'check-funds') return `<label for="answer-balance">Available checking balance ($)</label><input id="answer-balance" name="balance" data-answer type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${esc(a.balance)}"><label for="answer-enough">Enough to pay the phone bill?</label><select id="answer-enough" name="enough" data-answer><option value="">Choose an answer</option><option value="yes" ${a.enough === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${a.enough === 'no' ? 'selected' : ''}>No</option></select>`;
  if (session.exerciseId === 'verify-payment') return `<label for="answer-amount">Scheduled amount ($)</label><input id="answer-amount" name="amount" data-answer type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${esc(a.amount)}"><label for="answer-payment-date">Scheduled payment date</label><input id="answer-payment-date" name="paymentDate" data-answer type="date" value="${esc(a.paymentDate)}"><label for="answer-confirmation">Confirmation number</label><input id="answer-confirmation" name="confirmation" data-answer placeholder="HB-0000" autocomplete="off" value="${esc(a.confirmation)}">`;
  return `<div class="task-footnote">${icon('eye', 17)}<span>Your actions in the practice services will be checked.</span></div>`;
}
function taskPanel(session) {
  const item = exercise();
  const hints = session.events.filter(event => event.type === 'hint').length;
  const result = evaluateTask(session);
  return `<aside class="task-panel"><div class="task-panel-top"><span class="eyebrow">YOUR TASK</span><span class="task-index">0${EXERCISES.indexOf(item) + 1}</span></div><h2>${item.title}</h2><p class="task-instruction">${item.instructions}</p><div class="practice-date">${icon('clock', 16)}<span>Practice date<strong>${dateLabel(session.scenario.today)}</strong></span></div><div class="answer-fields">${answerFields(session)}</div>${state.checkResult ? `<div class="task-feedback" role="status"><strong>There’s still something to check.</strong><ul>${result.checks.filter(c => !c.met).map(c => `<li>${c.label}</li>`).join('')}</ul><span>Keep practicing, or ask your therapist for support.</span></div>` : ''}<button class="button primary full-width" data-action="check-task">Check task ${icon('check', 18)}</button><p class="small muted check-help">Unsuccessful checks provide feedback and are recorded. You can keep practicing.</p>${session.hintsEnabled ? `<div class="hints-section"><button class="hint-button" data-action="hint" ${hints >= 3 ? 'disabled' : ''}>${icon('help', 18)} ${hints ? hints < 3 ? 'Show next hint' : 'All hints shown' : 'I’d like a hint'} <span>${hints}/3</span></button>${hints ? `<ol class="hint-list">${item.hints.slice(0, hints).map(h => `<li>${h}</li>`).join('')}</ol>` : '<p class="small muted">Hints are optional and recorded.</p>'}</div>` : '<div class="hints-section small muted">Hints are turned off for this session. You can ask your therapist for help.</div>'}</aside>`;
}
function practice() {
  const s = state.session;
  return `<div class="practice-layout"><header class="practice-header"><a href="#" class="brand compact" data-action="library">${mark}<span>everyday<span class="brand-second">practice</span></span></a><div class="session-title"><strong>${exercise().title}</strong><span>Practice set ${s.scenario.id} <i>·</i> <span data-timer>${duration(summarize(s).durationMs)}</span></span></div><div class="session-controls"><button class="button secondary compact-button" data-action="${s.pausedAt ? 'unpause' : 'pause'}">${icon(s.pausedAt ? 'play' : 'pause', 16)} ${s.pausedAt ? 'Resume' : 'Pause'}</button><button class="button secondary compact-button" data-action="tools">${icon('file', 16)} <span>Therapist tools</span></button></div></header><div class="practice-topline"><span><i class="live-dot"></i> PRACTICE SESSION</span><span>${icon('shield', 14)} All accounts, bills, and transactions are fictional</span></div><main id="main" class="practice-main" tabindex="-1" ${s.pausedAt ? 'inert' : ''}><div class="practice-browser"><div class="browser-tabs" role="group" aria-label="Practice services"><button class="${state.service === 'bank' ? 'selected' : ''}" data-action="service" data-service="bank">${icon('bank', 17)} Harbor Bank</button><button class="${state.service === 'phone' ? 'selected' : ''}" data-action="service" data-service="phone">${icon('phone', 17)} Cedar Mobile</button></div><div class="browser-address">${icon('lock', 13)} <span>${state.service === 'bank' ? 'harbor-bank.example' : 'cedar-mobile.example'}</span><span class="address-label">Practice website</span></div>${state.service === 'bank' ? bank(s) : phone(s)}</div>${taskPanel(s)}</main>${s.pausedAt ? `<div class="pause-overlay"><div class="pause-card"><div class="exercise-icon">${icon('pause', 28)}</div><h2>Take your time.</h2><p>The session is paused. The activity timer has stopped.</p><button class="button primary" data-action="unpause">Resume session ${icon('play', 16)}</button></div></div>` : ''}</div>`;
}
function toolsModal() {
  const s = state.session;
  const cues = s.events.filter(item => item.type === 'cue');
  return `<div class="modal-heading"><div><div class="eyebrow">THERAPIST TOOLS</div><h2>Support & observations</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close therapist tools">${icon('close')}</button></div><p class="muted">Record support given outside the app. Each entry is timestamped.</p><div class="cue-buttons">${['General reminder', 'Specific instruction', 'Hands-on assistance'].map(kind => `<button class="button secondary" data-action="cue" data-kind="${kind}">${icon('plus', 16)} ${kind}<span>${cues.filter(c => c.detail.kind === kind).length}</span></button>`).join('')}</div><label class="checkbox-row"><input type="checkbox" data-review ${s.reviewed ? 'checked' : ''}><span><strong>Additional assistance reviewed</strong><small>I have recorded any assistance given outside the app. Leave unchecked if unknown.</small></span></label><label for="session-notes">Session observations</label><textarea id="session-notes" data-session-notes rows="3" placeholder="What helped? What would you practice next? Avoid personal details.">${esc(s.notes)}</textarea><p class="field-help">Saved in this browser as you type.</p><div class="modal-actions tools-actions"><button class="text-button danger-text" data-action="restart">${icon('reset', 16)} Restart exercise</button><button class="button primary" data-action="end-session">End & view results ${icon('arrow', 16)}</button></div>`;
}
function results() {
  return shell(`<div class="page-heading"><div class="eyebrow">SESSION RESULTS</div><h1>A record of the small steps.</h1><p>Exercise outcomes, corrections, and the support that helped.</p></div>${state.history.length ? `<div class="results-list">${state.history.map(s => { const summary = summarize(s); return `<button class="result-row" data-action="open-report" data-id="${s.id}"><div class="exercise-icon ${summary.complete ? '' : 'peach'}">${icon(summary.complete ? 'check' : 'file', 22)}</div><div class="result-title"><strong>${exercise(s).title}</strong><span>${new Date(s.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · Set ${s.scenario.id}</span></div><span class="result-support">${summary.support}</span><span class="status ${summary.complete ? '' : 'neutral'}">${summary.outcome}</span>${icon('chevron', 18)}</button>`; }).join('')}</div>` : `<div class="empty-state"><div class="exercise-icon">${icon('file', 30)}</div><h2>Your first session starts here.</h2><p>Complete or end an exercise to see its results here.</p><button class="button primary" data-action="library">Explore exercises ${icon('arrow', 17)}</button></div>`}<p class="small muted storage-note">Up to 50 recent sessions are saved on this browser. Download a report to keep a separate copy.</p>`, 'Session results');
}
function eventLabel(item) {
  const d = item.detail;
  return ({ 'payment-scheduled': `${d.payee}: ${money(d.amount)} from ${d.account} · ${d.date ? dateLabel(d.date) : ''} · ${d.id}`, 'payment-canceled': `Canceled payment ${d.id}`, 'transfer': `Transferred ${money(d.amount)} from ${d.from} to ${d.to}`, 'receipt-viewed': `Opened confirmation ${d.id}`, hint: `Hint ${d.level} requested`, cue: d.kind, paused: 'Session paused', resumed: 'Session resumed', finished: 'Session ended', 'task-checked': d.complete ? 'Task check: completed' : 'Task check: needs attention' })[item.type] ?? item.type;
}
function report() {
  const s = state.history.find(item => item.id === state.reportId);
  if (!s) { state.screen = 'results'; return results(); }
  const summary = summarize(s);
  return shell(`<button class="text-button back-button no-print" data-action="results">← All session results</button><div class="report-heading"><div><div class="eyebrow">SESSION SUMMARY · PRACTICE SET ${s.scenario.id}</div><h1>${exercise(s).title}</h1><p>${new Date(s.startedAt).toLocaleString()} · Practice date ${dateLabel(s.scenario.today)}</p></div><span class="outcome-badge ${summary.complete ? '' : 'incomplete'}">${icon(summary.complete ? 'check' : 'file', 20)} ${summary.outcome}</span></div><div class="report-metrics"><div><span>Active time</span><strong>${duration(summary.durationMs)}</strong><small>Pauses excluded</small></div><div><span>App support</span><strong>${summary.hints + summary.feedback}</strong><small>${summary.hints} hints · ${summary.feedback} checks with feedback</small></div><div><span>Therapist assistance</span><strong>${summary.cues.length}</strong><small>Recorded outside the app</small></div><div><span>Submitted payment errors</span><strong>${s.exerciseId === 'schedule-payment' ? summary.errors.length : '—'}</strong><small>${s.exerciseId === 'schedule-payment' ? 'Corrections shown below' : 'Tracked for scheduling exercises'}</small></div></div><div class="report-columns"><section class="white-panel"><div class="panel-heading"><h2>Task outcome</h2></div><ul class="check-list">${summary.checks.map(c => `<li class="${c.met ? 'met' : 'unmet'}">${icon(c.met ? 'check' : 'close', 18)}<span>${c.label}</span></li>`).join('')}</ul>${Object.keys(s.answers).length ? `<h3 class="minor-heading">Submitted answers</h3><dl class="detail-list compact-details">${Object.entries(s.answers).filter(([, v]) => v !== '').map(([key, value]) => `<div><dt>${({ dueDate: 'Due date', balance: 'Available balance ($)', enough: 'Enough funds?', amount: 'Payment amount ($)', paymentDate: 'Payment date', confirmation: 'Confirmation number' })[key] ?? esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : ''}${summary.errors.length ? `<h3 class="minor-heading">Submitted errors & recovery</h3><ul class="error-list">${summary.errors.map(e => `<li>${e.text}<span class="status ${e.recovered ? '' : 'neutral'}">${e.recovered ? 'Recovered' : 'Not recovered'}</span></li>`).join('')}</ul>` : ''}<p class="report-support">${icon('help', 17)} ${summary.support}</p></section><section class="white-panel report-observations"><div class="panel-heading"><h2>Therapist observations</h2></div><label class="checkbox-row"><input type="checkbox" data-report-review data-id="${s.id}" ${s.reviewed ? 'checked' : ''}><span><strong>Additional assistance reviewed</strong><small>All assistance outside the app has been recorded. Leave unchecked if unknown.</small></span></label><label for="report-notes">Session observations</label><textarea id="report-notes" data-report-notes data-id="${s.id}" rows="5" placeholder="Record useful strategies, support needs, and next steps. Avoid personal details.">${esc(s.notes)}</textarea><p class="field-help">Saved in this browser as you type.</p>${summary.cues.length ? `<ul class="support-list">${summary.cues.map(c => `<li>${c.detail.kind}</li>`).join('')}</ul>` : ''}</section></div><section class="white-panel"><div class="panel-heading"><h2>Session activity</h2><span class="small muted">${s.events.length} recorded events</span></div><ol class="timeline">${s.events.map(item => `<li><time>${new Date(item.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>${esc(eventLabel(item))}</span></li>`).join('')}</ol></section><div class="report-actions no-print"><button class="button secondary" data-action="download-report" data-id="${s.id}">${icon('download', 17)} Download report</button><button class="button secondary" data-action="print">${icon('print', 17)} Print summary</button><button class="button primary" data-action="setup" data-id="${s.exerciseId}">Practice again ${icon('arrow', 17)}</button></div><p class="report-disclaimer">This report describes performance in a fictional practice exercise. It is not a standardized assessment or a determination of real-world independence.</p>`, 'Session results');
}
function guide() {
  return shell(`<div class="page-heading"><div class="eyebrow">HOW IT WORKS</div><h1>Make room for practice.</h1><p>Realistic tasks. Fictional services. Support when it’s needed.</p></div><div class="guide-grid">${[['01', 'Choose a meaningful task', 'Select an exercise and a practice set. Decide whether hints should be available. Each session starts with fresh fictional accounts and payments.'], ['02', 'Let the patient explore', 'The task stays beside the practice services. The patient can switch between Harbor Bank and Cedar Mobile and take any valid route.'], ['03', 'Record what helped', 'Use Therapist tools to record general reminders, specific instructions, or hands-on assistance. Pause for breaks; paused time is excluded.'], ['04', 'Review the outcome', 'Check the task when ready, or end it at any point. Review completion, submitted payment errors, recovery, hints, and therapist observations.']].map(([n, title, text]) => `<article class="white-panel guide-card"><span class="eyebrow">${n}</span><h2>${title}</h2><p>${text}</p></article>`).join('')}</div><section class="guide-details white-panel"><h2>A few things to know</h2><p><strong>Dates belong to the scenario.</strong> The practice date appears beside the task. It does not follow today’s calendar.</p><p><strong>A scheduled payment is not a paid bill.</strong> Payments remain scheduled until canceled. No real transactions take place.</p><p><strong>Support is part of the record.</strong> A completed task is kept separate from assistance. “No assistance recorded” is only shown as reviewed after the therapist confirms it.</p><p><strong>Records stay on this browser.</strong> There are no patient accounts or cloud synchronization. Download reports you want to keep.</p><p><strong>These are practice exercises.</strong> Results describe the session and do not establish a diagnosis or real-world independence.</p></section><button class="button primary" data-action="library">Choose an exercise ${icon('arrow', 17)}</button>`, 'How it works');
}
function renderModal() {
  if (state.modal === 'setup') return setupModal();
  if (state.modal === 'tools') return toolsModal();
  if (state.modal === 'cancel') {
    const p = state.session.payments.find(item => item.id === state.cancelId);
    return `<div class="modal-heading"><h2>Cancel this payment?</h2><button class="icon-button" data-action="close-modal" aria-label="Close cancellation">${icon('close')}</button></div><p>${money(p.amount)} to ${esc(p.payee)}, scheduled for ${dateLabel(p.date)}.</p><p class="muted">The payment will stay in your history with a canceled status.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Keep payment</button><button class="button danger" data-action="confirm-cancel">Cancel payment</button></div>`;
  }
  if (state.modal === 'restart') return `<div class="modal-heading"><h2>Start a fresh attempt?</h2><button class="icon-button" data-action="close-modal" aria-label="Close restart">${icon('close')}</button></div><p>Your current attempt will be ended and saved. The exercise will restart with its original balances and payments.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Keep practicing</button><button class="button primary" data-action="confirm-restart">Restart exercise</button></div>`;
  return '';
}
function render() {
  const previous = document.activeElement;
  const inDialog = Boolean(previous?.closest('dialog'));
  let selector = previous?.id ? '#' + CSS.escape(previous.id) : previous?.dataset.action ? '[data-action="' + CSS.escape(previous.dataset.action) + '"]' : previous?.matches('[data-report-review]') ? '[data-report-review]' : '';
  for (const key of ['id', 'kind', 'page', 'service', 'value']) if (selector && previous?.dataset[key]) selector += '[data-' + key + '="' + CSS.escape(previous.dataset[key]) + '"]';
  if (state.modal && !inDialog) state.returnFocus = selector;
  app.innerHTML = (state.screen === 'practice' && state.session ? practice() : state.screen === 'results' ? results() : state.screen === 'report' ? report() : state.screen === 'guide' ? guide() : library()) + (state.modal ? `<dialog id="modal" aria-label="${state.modal === 'setup' ? 'Set up exercise' : state.modal === 'tools' ? 'Therapist tools' : 'Confirm action'}">${renderModal()}</dialog>` : '') + (state.toast ? `<div class="toast" role="status">${icon('check', 17)}<span>${esc(state.toast)}</span><button class="icon-button" data-action="dismiss-toast" aria-label="Dismiss notification">${icon('close', 16)}</button></div>` : '');
  const dialog = document.querySelector('#modal');
  if (dialog) { dialog.showModal(); dialog.addEventListener('cancel', e => { e.preventDefault(); state.modal = null; render(); }); }
  if (!dialog || inDialog) {
    const focusTarget = (selector && app.querySelector(selector)) || (!dialog && state.returnFocus && app.querySelector(state.returnFocus)) || null;
    focusTarget?.focus({ preventScroll: true });
  }
}


function saveFile(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function reportText(session) {
  const summary = summarize(session);
  return ['EVERYDAY PRACTICE — SESSION REPORT', exercise(session).title, `Session: ${new Date(session.startedAt).toLocaleString()}`, `Practice set: ${session.scenario.id} | Practice date: ${session.scenario.today}`, `Outcome: ${summary.outcome}`, `Active time: ${duration(summary.durationMs)} (pauses excluded)`, `Hints: ${summary.hints}`, `Task checks with corrective feedback: ${summary.feedback}`, `Therapist assistance entries: ${summary.cues.length}`, `Assistance: ${summary.support}`, '', 'TASK CRITERIA', ...summary.checks.map(c => `${c.met ? 'Met' : 'Not met'}: ${c.label}`), '', 'ANSWERS', ...Object.entries(session.answers).map(([key, value]) => `${key}: ${value}`), '', 'SUBMITTED PAYMENT ERRORS', ...(summary.errors.length ? summary.errors.map(e => `${e.text}: ${e.recovered ? 'recovered' : 'not recovered'}`) : ['None recorded for scheduling exercise, or not applicable.']), '', 'THERAPIST OBSERVATIONS', session.notes || 'None recorded.', '', 'ACTIVITY', ...session.events.map(e => `${new Date(e.at).toLocaleTimeString()} — ${eventLabel(e)}`), '', 'This report describes a fictional practice exercise. It is not a standardized assessment or a determination of real-world independence.'].join('\n');
}
function openReceipt(id) {
  update('view-receipt', { id }); state.receiptId = id;
  if (state.service === 'bank') state.bankPage = 'receipt'; else state.phonePage = 'receipt';
}
app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  event.preventDefault();
  const action = button.dataset.action;
  try {
    if (['library', 'results', 'guide'].includes(action)) { navigate(action); return; }
    if (action === 'filter') state.filter = button.dataset.value;
    if (action === 'setup') { state.selected = button.dataset.id; state.modal = 'setup'; }
    if (action === 'close-modal') state.modal = null;
    if (action === 'resume') { if (state.session.pausedAt) update('resume'); state.screen = 'practice'; }
    if (action === 'service') state.service = button.dataset.service;
    if (action === 'bank-nav') { state.bankPage = button.dataset.page; state.checkResult = false; }
    if (action === 'phone-nav') { state.phonePage = button.dataset.page; state.checkResult = false; }
    if (action === 'receipt') openReceipt(button.dataset.id);
    if (action === 'edit-payment') { if (state.service === 'bank') state.bankPage = 'pay'; else state.phonePage = 'pay'; }
    if (action === 'confirm-payment') { update('schedule', state.review); openReceipt(state.session.payments.at(-1).id); state.draft = {}; toast('Payment scheduled. Review the confirmation details.'); }
    if (action === 'cancel') { state.cancelId = button.dataset.id; state.modal = 'cancel'; }
    if (action === 'confirm-cancel') { update('cancel', { id: state.cancelId }); state.modal = null; toast('Payment canceled. Its history has been kept.'); }
    if (action === 'hint') { update('hint'); announce('A hint has been added to your task panel.'); }
    if (action === 'tools') state.modal = 'tools';
    if (action === 'cue') { update('cue', { kind: button.dataset.kind }); toast(`${button.dataset.kind} recorded.`); }
    if (action === 'pause') update('pause');
    if (action === 'unpause') update('resume');
    if (action === 'check-task') { update('task-check'); if (evaluateTask(state.session).complete) { finish(); return; } state.checkResult = true; announce('The task needs attention. Review the task panel for details.'); }
    if (action === 'end-session') { finish(); return; }
    if (action === 'restart') state.modal = 'restart';
    if (action === 'confirm-restart') { const s = state.session; startSession(s.exerciseId, s.scenario.id, s.hintsEnabled); return; }
    if (action === 'open-report') { state.reportId = button.dataset.id; navigate('report'); return; }
    if (action === 'download-report') { const s = state.history.find(item => item.id === button.dataset.id); saveFile(`everyday-practice-${s.id}.txt`, reportText(s)); toast('Session report downloaded.'); }
    if (action === 'download-receipt') { const p = state.session.payments.find(item => item.id === state.receiptId); saveFile(`practice-confirmation-${p.id}.txt`, `HARBOR BANK / CEDAR MOBILE — FICTIONAL PRACTICE CONFIRMATION\n\nRecipient: ${p.payee}\nAmount: ${money(p.amount)}\nFrom: ${p.account}\nPayment date: ${p.date}\nConfirmation: ${p.id}\nStatus: ${p.status}\n\nNo real money moves.`); toast('Practice confirmation downloaded.'); }
    if (action === 'print') { window.print(); return; }
    if (action === 'dismiss-toast') state.toast = '';
    render();
  } catch (error) { const target = document.querySelector('#form-error'); if (target) target.textContent = error.message; else { state.toast = error.message; render(); } announce(error.message); }
});
app.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  try {
    if (form.dataset.form === 'setup') { startSession(state.selected, data.get('scenario'), data.has('hints')); return; }
    if (form.dataset.form === 'payment') {
      const payload = { payee: data.get('payee'), account: data.get('account'), amount: toCents(data.get('amount')), date: data.get('date') };
      act(state.session, 'schedule', payload);
      state.review = payload;
      if (state.service === 'bank') state.bankPage = 'review'; else state.phonePage = 'review';
    }
    if (form.dataset.form === 'transfer') { update('transfer', { from: data.get('from'), to: data.get('to'), amount: toCents(data.get('amount')) }); state.bankPage = 'overview'; toast('Transfer complete. Your available balances have been updated.'); }
    render();
  } catch (error) { document.querySelector('#form-error').textContent = error.message; announce(error.message); }
});
app.addEventListener('input', event => {
  const input = event.target;
  if (input.matches('[data-answer]')) { update('answer', { [input.name]: input.value }); state.checkResult = false; }
  if (input.dataset.draft) state.draft[input.dataset.draft] = input.value;
  if (input.matches('[data-session-notes]')) update('notes', { notes: input.value });
  if (input.matches('[data-report-notes]')) {
    const index = state.history.findIndex(s => s.id === input.dataset.id);
    state.history[index] = act(state.history[index], 'notes', { notes: input.value }); persist();
  }
});
app.addEventListener('change', event => {
  const input = event.target;
  if (input.matches('[data-review]')) { update('review', { reviewed: input.checked }); announce('Assistance review updated.'); }
  if (input.matches('[data-report-review]')) {
    const index = state.history.findIndex(s => s.id === input.dataset.id);
    state.history[index] = act(state.history[index], 'review', { reviewed: input.checked }); persist(); render();
  }
});
setInterval(() => { const timer = document.querySelector('[data-timer]'); if (timer && state.session) timer.textContent = duration(summarize(state.session).durationMs); }, 1000);
render();
