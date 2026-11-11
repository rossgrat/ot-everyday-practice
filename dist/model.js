export const EXERCISES = [
  { id: 'due-date', title: 'Find the due date', service: 'phone', skill: 'Finding information', description: 'Read a phone bill and identify when payment is due.', instructions: 'Open your phone bill and find the payment due date. Enter the date in your task panel.', hints: ['Your phone provider keeps bills in Bills & payments.', 'Open the current bill and look for “Payment due”.', 'Enter the payment due date, rather than the bill issue date.'] },
  { id: 'check-funds', title: 'Check available funds', service: 'bank', skill: 'Making a decision', description: 'Check a balance and decide whether it covers a bill.', instructions: 'Find your checking account’s available balance. Enter it in your task panel and decide whether it is enough to pay your phone bill.', hints: ['You can find your accounts in Harbor Bank.', 'Use the available balance, rather than the current balance.', 'Compare the available balance with the amount due on your phone bill.'] },
  { id: 'schedule-payment', title: 'Schedule a payment', service: 'both', skill: 'Following a sequence', description: 'Choose the account, amount, and date for a bill payment.', instructions: 'Schedule exactly one payment for your full phone bill from checking, on or before the due date. Then check the payment details.', hints: ['Find the amount and due date in Cedar Mobile.', 'Choose Pay & transfer in Harbor Bank, or Pay bill in Cedar Mobile.', 'Choose checking, enter the full amount due, and select a date between today and the due date. Review before confirming.'] },
  { id: 'verify-payment', title: 'Verify a payment', service: 'bank', skill: 'Checking your work', description: 'Find a scheduled payment and confirm its details.', instructions: 'A phone payment is already scheduled. Open its confirmation, then enter the amount, payment date, and confirmation number in your task panel.', hints: ['Scheduled payments appear in Harbor Bank’s Payments page.', 'Open the Cedar Mobile payment to view its confirmation.', 'Copy the amount, scheduled date, and confirmation number from that confirmation.'] },
  { id: 'cancel-payment', title: 'Cancel an incorrect payment', service: 'bank', skill: 'Recovering from a mistake', description: 'Compare a payment with a bill and cancel the wrong amount.', instructions: 'Your scheduled phone payment has an incorrect amount. Compare it with your current bill, then cancel that payment. You do not need to schedule a replacement.', hints: ['Check your current phone bill in Cedar Mobile.', 'Open the scheduled Cedar Mobile payment in Harbor Bank.', 'Compare the two amounts, then choose Cancel payment and confirm.'] }
];

export const SCENARIOS = [
  { id: 'A', month: 'November', today: '2026-11-09', dueDate: '2026-11-13', paymentDate: '2026-11-12', bill: 6840, checking: 24050, savings: 126000, pending: 4000 },
  { id: 'B', month: 'December', today: '2026-12-07', dueDate: '2026-12-11', paymentDate: '2026-12-10', bill: 7255, checking: 5610, savings: 94000, pending: 1800 },
  { id: 'C', month: 'January', today: '2027-01-11', dueDate: '2027-01-15', paymentDate: '2027-01-14', bill: 5930, checking: 18575, savings: 152000, pending: 2500 }
];

export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const dateLabel = date => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export function toCents(value) {
  const input = String(value).trim();
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(input)) return null;
  const cents = Math.round(Number(input) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function createSession(exerciseId, scenarioId = 'A', hintsEnabled = true, now = Date.now()) {
  const exercise = EXERCISES.find(item => item.id === exerciseId);
  const scenario = SCENARIOS.find(item => item.id === scenarioId);
  if (!exercise || !scenario) throw new Error('Choose an exercise and practice set.');
  const payments = [];
  if (exerciseId === 'verify-payment' || exerciseId === 'cancel-payment') {
    payments.push({ id: 'HB-1042', payee: 'Cedar Mobile', account: 'checking', amount: scenario.bill + (exerciseId === 'cancel-payment' ? 1800 : 0), date: scenario.paymentDate, status: 'scheduled', seeded: true });
  }
  return { id: `session-${now}`, exerciseId, scenario: structuredClone(scenario), hintsEnabled, startedAt: now, endedAt: null, pausedAt: null, pausedMs: 0, checking: scenario.checking, savings: scenario.savings, payments, events: [], answers: {}, reviewed: false, notes: '', nextPayment: 1043 };
}

const event = (session, type, detail, now) => session.events.push({ type, detail, at: now });

export function act(previous, type, payload = {}, now = Date.now()) {
  const session = structuredClone(previous);
  if (session.endedAt && !['notes', 'review'].includes(type)) throw new Error('This session has ended. Start a new session to practice again.');
  if (session.pausedAt && !['resume', 'finish', 'notes', 'review', 'cue'].includes(type)) throw new Error('Resume the session to continue.');
  if (type === 'schedule') {
    const { payee, account, amount, date } = payload;
    if (!['Cedar Mobile', 'City Electric'].includes(payee)) throw new Error('Choose a recipient.');
    if (!['checking', 'savings'].includes(account)) throw new Error('Choose a funding account.');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter an amount greater than $0.00, with no more than two decimal places.');
    if (amount > session[account]) throw new Error('This account does not have enough available funds. Choose another account or transfer funds first.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || date < session.scenario.today) throw new Error('Choose a valid payment date on or after the practice date.');
    const payment = { id: `HB-${session.nextPayment++}`, payee, account, amount, date, status: 'scheduled', seeded: false };
    session.payments.push(payment);
    event(session, 'payment-scheduled', structuredClone(payment), now);
  } else if (type === 'cancel') {
    const payment = session.payments.find(item => item.id === payload.id);
    if (!payment || payment.status !== 'scheduled') throw new Error('Choose a scheduled payment to cancel.');
    payment.status = 'canceled';
    event(session, 'payment-canceled', { id: payment.id, amount: payment.amount }, now);
  } else if (type === 'transfer') {
    const { from, to, amount } = payload;
    if (!['checking', 'savings'].includes(from) || !['checking', 'savings'].includes(to) || from === to) throw new Error('Choose two different accounts.');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a transfer amount greater than $0.00.');
    if (amount > session[from]) throw new Error('The transfer exceeds the available balance.');
    session[from] -= amount;
    session[to] += amount;
    event(session, 'transfer', { from, to, amount }, now);
  } else if (type === 'answer') {
    session.answers = { ...session.answers, ...payload };
  } else if (type === 'view-receipt') {
    if (!session.payments.some(item => item.id === payload.id)) throw new Error('Payment not found.');
    event(session, 'receipt-viewed', { id: payload.id }, now);
  } else if (type === 'hint') {
    if (!session.hintsEnabled) throw new Error('Hints are disabled for this session.');
    const count = session.events.filter(item => item.type === 'hint').length;
    if (count < 3) event(session, 'hint', { level: count + 1 }, now);
  } else if (type === 'cue') {
    if (!['General reminder', 'Specific instruction', 'Hands-on assistance'].includes(payload.kind)) throw new Error('Choose an assistance type.');
    event(session, 'cue', { kind: payload.kind }, now);
  } else if (type === 'pause') {
    if (!session.pausedAt) { session.pausedAt = now; event(session, 'paused', {}, now); }
  } else if (type === 'resume') {
    if (session.pausedAt) { session.pausedMs += now - session.pausedAt; session.pausedAt = null; event(session, 'resumed', {}, now); }
  } else if (type === 'finish') {
    if (session.pausedAt) { session.pausedMs += now - session.pausedAt; session.pausedAt = null; }
    session.endedAt = now;
    event(session, 'finished', {}, now);
  } else if (type === 'review') {
    session.reviewed = Boolean(payload.reviewed);
  } else if (type === 'notes') {
    session.notes = String(payload.notes).slice(0, 4000);
  } else if (type === 'task-check') {
    event(session, 'task-checked', { complete: evaluateTask(session).complete }, now);
  } else {
    throw new Error('Unknown session action.');
  }
  return session;
}

export function evaluateTask(session) {
  const { scenario, answers, payments, exerciseId } = session;
  let checks = [];
  if (exerciseId === 'due-date') checks = [{ label: 'Correct bill due date', met: answers.dueDate === scenario.dueDate }];
  if (exerciseId === 'check-funds') checks = [
    { label: 'Correct current available checking balance', met: toCents(answers.balance ?? '') === session.checking },
    { label: 'Correct decision about covering the phone bill', met: answers.enough === (session.checking >= scenario.bill ? 'yes' : 'no') }
  ];
  if (exerciseId === 'schedule-payment') {
    const active = payments.filter(item => item.status === 'scheduled');
    const mobilePayments = active.filter(item => item.payee === 'Cedar Mobile');
    const target = mobilePayments.length === 1 ? mobilePayments[0] : null;
    checks = [
      { label: 'Exactly one active payment, to Cedar Mobile', met: active.length === 1 && active[0].payee === 'Cedar Mobile' },
      { label: `Full bill amount: ${money(scenario.bill)}`, met: Boolean(target && target.amount === scenario.bill) },
      { label: 'Checking account and a date on or before the due date', met: Boolean(target && target.account === 'checking' && target.date >= scenario.today && target.date <= scenario.dueDate) },
      { label: 'Payment confirmation opened', met: Boolean(target && session.events.some(item => item.type === 'receipt-viewed' && item.detail.id === target.id)) },
      { label: 'Checking has enough available funds', met: session.checking >= scenario.bill }
    ];
  }
  if (exerciseId === 'verify-payment') {
    const payment = payments.find(item => item.seeded);
    checks = [
      { label: 'Correct payment amount', met: toCents(answers.amount ?? '') === payment.amount },
      { label: 'Correct scheduled payment date', met: answers.paymentDate === payment.date },
      { label: 'Correct confirmation number', met: String(answers.confirmation ?? '').trim().toUpperCase() === payment.id },
      { label: 'Payment confirmation opened', met: session.events.some(item => item.type === 'receipt-viewed' && item.detail.id === payment.id) },
      { label: 'Scheduled payment left unchanged', met: payment.status === 'scheduled' && payments.length === 1 }
    ];
  }
  if (exerciseId === 'cancel-payment') checks = [
    { label: 'Incorrect scheduled payment canceled', met: payments.some(item => item.seeded && item.status === 'canceled') },
    { label: 'No extra payments left scheduled', met: payments.every(item => item.seeded || item.status === 'canceled') }
  ];
  return { complete: checks.length > 0 && checks.every(item => item.met), checks };
}

export function summarize(session, now = Date.now()) {
  const outcome = evaluateTask(session);
  const hints = session.events.filter(item => item.type === 'hint').length;
  const cues = session.events.filter(item => item.type === 'cue');
  const feedback = session.events.filter(item => item.type === 'task-checked' && !item.detail.complete).length;
  const errors = [];
  if (session.exerciseId === 'schedule-payment') {
    const activeIds = new Set();
    for (const item of session.events) {
      if (item.type === 'payment-canceled') activeIds.delete(item.detail.id);
      if (item.type !== 'payment-scheduled') continue;
      const p = item.detail;
      if (p.payee !== 'Cedar Mobile' || p.account !== 'checking' || p.amount !== session.scenario.bill || p.date > session.scenario.dueDate) errors.push({ text: `Incorrect payment submitted (${p.id})`, recovered: session.payments.find(payment => payment.id === p.id)?.status === 'canceled' });
      if (activeIds.size > 0) errors.push({ text: `Additional payment submitted (${p.id})`, recovered: session.payments.filter(payment => payment.status === 'scheduled').length <= 1 });
      activeIds.add(p.id);
    }
  }
  const activePause = session.pausedAt ? (session.endedAt ?? now) - session.pausedAt : 0;
  const durationMs = Math.max(0, (session.endedAt ?? now) - session.startedAt - session.pausedMs - activePause);
  const support = hints || cues.length || feedback ? 'Recorded assistance' : session.reviewed ? 'No assistance recorded; reviewed' : 'Assistance not reviewed';
  return { ...outcome, hints, cues, feedback, errors, durationMs, support, outcome: outcome.complete ? 'Completed' : 'Not completed' };
}
