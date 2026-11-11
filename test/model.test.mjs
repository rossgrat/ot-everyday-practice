import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, SCENARIOS, createSession, act, evaluateTask, summarize, toCents } from '../dist/model.js';

const payment = session => ({ payee: 'Cedar Mobile', account: 'checking', amount: session.scenario.bill, date: session.scenario.paymentDate });
function scheduleAndView(session) {
  let next = session;
  if (next.checking < next.scenario.bill) next = act(next, 'transfer', { from: 'savings', to: 'checking', amount: next.scenario.bill - next.checking });
  next = act(next, 'schedule', payment(next));
  return act(next, 'view-receipt', { id: next.payments.at(-1).id });
}

for (const scenario of SCENARIOS) {
  for (const exercise of EXERCISES) {
    test(`${exercise.id} can be completed in practice set ${scenario.id}`, () => {
      let session = createSession(exercise.id, scenario.id, true, 1000);
      assert.equal(evaluateTask(session).complete, false);
      if (exercise.id === 'due-date') session = act(session, 'answer', { dueDate: scenario.dueDate });
      if (exercise.id === 'check-funds') session = act(session, 'answer', { balance: String(session.checking / 100), enough: session.checking >= scenario.bill ? 'yes' : 'no' });
      if (exercise.id === 'schedule-payment') session = scheduleAndView(session);
      if (exercise.id === 'verify-payment') {
        const p = session.payments[0];
        session = act(session, 'view-receipt', { id: p.id });
        session = act(session, 'answer', { amount: String(p.amount / 100), paymentDate: p.date, confirmation: ' hb-1042 ' });
      }
      if (exercise.id === 'cancel-payment') session = act(session, 'cancel', { id: session.payments[0].id });
      assert.equal(evaluateTask(session).complete, true);
      assert.equal(summarize(session).support, 'Assistance not reviewed');
    });
  }
}

test('correct payment amount alone is insufficient', () => {
  for (const change of [{ payee: 'City Electric' }, { account: 'savings' }, { date: '2026-11-14' }, { amount: 6841 }]) {
    let session = createSession('schedule-payment');
    session = act(session, 'schedule', { ...payment(session), ...change });
    session = act(session, 'view-receipt', { id: session.payments[0].id });
    assert.equal(evaluateTask(session).complete, false);
    assert.equal(summarize(session).errors.length, 1);
  }
});

test('a duplicate blocks completion and cancellation restores it while preserving history', () => {
  let session = scheduleAndView(createSession('schedule-payment'));
  session = act(session, 'schedule', payment(session));
  assert.equal(evaluateTask(session).complete, false);
  assert.equal(summarize(session).errors.length, 1);
  session = act(session, 'cancel', { id: session.payments.at(-1).id });
  assert.equal(evaluateTask(session).complete, true);
  assert.equal(summarize(session).errors[0].recovered, true);
  assert.equal(session.payments.length, 2);
});

test('feedback distinguishes a correct amount from an incorrect funding account', () => {
  let session = createSession('schedule-payment');
  session = act(session, 'schedule', { ...payment(session), account: 'savings' });
  const result = evaluateTask(session);
  assert.equal(result.complete, false);
  assert.equal(result.checks.find(check => check.label.startsWith('Full bill amount')).met, true);
  assert.equal(result.checks.find(check => check.label.startsWith('Checking account')).met, false);
});

test('a wrong submission can be corrected and remains in the results', () => {
  let session = createSession('schedule-payment');
  session = act(session, 'schedule', { ...payment(session), amount: 8640 });
  session = act(session, 'cancel', { id: session.payments[0].id });
  session = scheduleAndView(session);
  assert.equal(evaluateTask(session).complete, true);
  assert.equal(summarize(session).errors.length, 1);
  assert.equal(summarize(session).errors[0].recovered, true);
});

test('a correct payment must have its confirmation displayed', () => {
  let session = createSession('schedule-payment');
  session = act(session, 'schedule', payment(session));
  assert.equal(evaluateTask(session).complete, false);
  session = act(session, 'view-receipt', { id: session.payments[0].id });
  assert.equal(evaluateTask(session).complete, true);
});

test('verification requires correct answers and preserves the scheduled payment', () => {
  let session = createSession('verify-payment');
  session = act(session, 'answer', { amount: '68.40', paymentDate: '2026-11-12', confirmation: 'HB-1042' });
  assert.equal(evaluateTask(session).complete, false);
  session = act(session, 'view-receipt', { id: 'HB-1042' });
  assert.equal(evaluateTask(session).complete, true);
  session = act(session, 'cancel', { id: 'HB-1042' });
  assert.equal(evaluateTask(session).complete, false);
});

test('funds exercise compares available balance rather than current balance', () => {
  let session = createSession('check-funds', 'B');
  session = act(session, 'answer', { balance: String((session.checking + session.scenario.pending) / 100), enough: 'yes' });
  assert.equal(evaluateTask(session).complete, false);
  session = act(session, 'answer', { balance: '56.10', enough: 'no' });
  assert.equal(evaluateTask(session).complete, true);
  session = act(session, 'transfer', { from: 'savings', to: 'checking', amount: 5000 });
  assert.equal(evaluateTask(session).complete, false);
  session = act(session, 'answer', { balance: '106.10', enough: 'yes' });
  assert.equal(evaluateTask(session).complete, true);
});

test('invalid or overdrawn transfers do not change balances', () => {
  const session = createSession('schedule-payment');
  for (const payload of [{ from: 'checking', to: 'checking', amount: 100 }, { from: 'savings', to: 'checking', amount: -1 }, { from: 'checking', to: 'savings', amount: session.checking + 1 }, { from: 'savings', to: 'checking', amount: 0.5 }]) {
    assert.throws(() => act(session, 'transfer', payload));
  }
  assert.equal(session.checking, 24050);
  assert.equal(session.events.length, 0);
});

test('invalid dates, amounts, and insufficient funds are rejected before submission', () => {
  const session = createSession('schedule-payment');
  for (const change of [{ date: '2026-11-08' }, { date: '2026-02-30' }, { date: '2026-11-31' }, { date: '' }, { amount: -1 }, { amount: 0 }, { amount: 0.5 }, { amount: 25000 }]) {
    assert.throws(() => act(session, 'schedule', { ...payment(session), ...change }));
  }
  assert.equal(session.payments.length, 0);
});

test('scheduled payments do not become paid or debit available funds', () => {
  const session = scheduleAndView(createSession('schedule-payment'));
  assert.equal(session.payments[0].status, 'scheduled');
  assert.equal(session.checking, session.scenario.checking);
});

test('decimal inputs retain cents and reject malformed values', () => {
  assert.equal(toCents('68.40'), 6840);
  assert.equal(toCents('72.55'), 7255);
  assert.equal(toCents('.50'), 50);
  for (const value of ['', '-1', '1.001', '1e2', 'NaN', 'Infinity', '1 dollar']) assert.equal(toCents(value), null);
});

test('timing excludes pauses, including a session ended during a pause', () => {
  let session = createSession('due-date', 'A', true, 1000);
  session = act(session, 'pause', {}, 3000);
  assert.equal(summarize(session, 7000).durationMs, 2000);
  assert.throws(() => act(session, 'answer', { dueDate: session.scenario.dueDate }, 7000));
  session = act(session, 'resume', {}, 8000);
  session = act(session, 'pause', {}, 10000);
  session = act(session, 'finish', {}, 15000);
  assert.equal(summarize(session).durationMs, 4000);
});

test('assistance is never inferred to be independent from a missing record', () => {
  let session = createSession('due-date');
  assert.equal(summarize(session).support, 'Assistance not reviewed');
  session = act(session, 'review', { reviewed: true });
  assert.equal(summarize(session).support, 'No assistance recorded; reviewed');
  session = act(session, 'cue', { kind: 'General reminder' });
  assert.equal(summarize(session).support, 'Recorded assistance');
  assert.equal(summarize(session).cues.length, 1);
});

test('hints respect setup choice and cannot be counted more than three times', () => {
  assert.throws(() => act(createSession('due-date', 'A', false), 'hint'));
  let session = createSession('due-date');
  for (let i = 0; i < 5; i++) session = act(session, 'hint');
  assert.equal(summarize(session).hints, 3);
  assert.equal(summarize(session).support, 'Recorded assistance');
});

test('corrective feedback is recorded as support even when optional hints are off', () => {
  let session = createSession('due-date', 'A', false);
  session = act(session, 'task-check');
  session = act(session, 'review', { reviewed: true });
  assert.equal(summarize(session).feedback, 1);
  assert.equal(summarize(session).support, 'Recorded assistance');
});

test('canceling an extra payment allows recovery in the cancellation exercise', () => {
  let session = createSession('cancel-payment');
  session = act(session, 'schedule', payment(session));
  session = act(session, 'cancel', { id: 'HB-1042' });
  assert.equal(evaluateTask(session).complete, false);
  session = act(session, 'cancel', { id: 'HB-1043' });
  assert.equal(evaluateTask(session).complete, true);
});

test('ended sessions allow observation edits but prevent practice mutations', () => {
  let session = act(createSession('due-date'), 'finish');
  assert.throws(() => act(session, 'answer', { dueDate: session.scenario.dueDate }));
  session = act(session, 'notes', { notes: 'Checklist was useful.' });
  session = act(session, 'review', { reviewed: true });
  assert.equal(session.notes, 'Checklist was useful.');
  assert.equal(session.reviewed, true);
});

test('restarting from a fresh fixture never inherits prior transactions', () => {
  const old = scheduleAndView(createSession('schedule-payment'));
  const fresh = createSession(old.exerciseId, old.scenario.id);
  assert.equal(fresh.payments.length, 0);
  assert.equal(fresh.events.length, 0);
  assert.equal(evaluateTask(fresh).complete, false);
});
