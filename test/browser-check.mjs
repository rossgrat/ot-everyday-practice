export default async function verify(page) {
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const click = action => page.locator(`[data-action="${action}"]`).click();
  const start = async (id, scenario = 'A', hints = true) => {
    await page.locator('[data-action="library"]').first().click();
    await page.locator(`[data-action="setup"][data-id="${id}"]`).click();
    await page.locator('#practice-set').selectOption(scenario);
    if (!hints) await page.locator('input[name="hints"]').uncheck();
    await page.getByRole('button', { name: 'Start session' }).click();
    assert(await page.locator('.toast').count() === 0 || !(await page.locator('.toast').innerText()).includes('not a function'), 'Starting a session must not show a runtime error');
  };
  const complete = async () => {
    await click('check-task');
    assert(await page.locator('.outcome-badge').innerText() === 'Completed', 'Expected a completed session report');
  };
  const pay = async (amount, date, phone = false) => {
    if (phone) {
      await page.locator('[data-action="service"][data-service="phone"]').click();
      await page.locator('[data-action="phone-nav"][data-page="pay"]').first().click();
    } else await page.locator('[data-action="bank-nav"][data-page="pay"]').first().click();
    await page.locator('#payment-amount').fill(amount);
    await page.locator('#payment-date').fill(date);
    await page.getByRole('button', { name: 'Review payment' }).click();
    await click('confirm-payment');
  };

  await page.goto('http://127.0.0.1:4173');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  assert(await page.locator('.exercise-card').count() === 5, 'Expected five exercises');
  await page.getByRole('button', { name: 'Phone account', exact: true }).click();
  assert(await page.locator('.exercise-card').count() === 2, 'Phone filter should include the shared exercise');
  await page.getByRole('button', { name: 'All exercises', exact: true }).click();

  await start('due-date');
  await page.locator('#answer-date').fill('2026-11-09');
  await click('check-task');
  assert(await page.locator('.task-feedback').isVisible(), 'An incorrect due date should allow more practice');
  await click('hint');
  await click('tools');
  await page.locator('[data-action="cue"][data-kind="General reminder"]').click();
  await page.locator('[data-review]').check();
  await page.locator('#session-notes').fill('A written checklist helped.');
  await click('close-modal');
  await page.locator('#answer-date').fill('2026-11-13');
  await complete();
  assert((await page.locator('.report-support').innerText()).includes('Recorded assistance'), 'Assistance must be preserved');
  assert(await page.locator('#report-notes').inputValue() === 'A written checklist helped.', 'Notes must survive session completion');
  const downloaded = page.waitForEvent('download');
  await click('download-report');
  const reportDownload = await downloaded;
  assert(reportDownload.suggestedFilename().endsWith('.txt'), 'Report should download as text');
  let reportContent = '';
  for await (const chunk of await reportDownload.createReadStream()) reportContent += chunk.toString();
  assert(reportContent.includes('A written checklist helped.') && reportContent.includes('Task checks with corrective feedback: 1'), 'Downloaded report must contain observations and feedback counts');
  await page.locator('#report-notes').fill('Checklist retained for the next session.');
  await page.reload();
  await page.getByRole('button', { name: 'Session results', exact: true }).click();
  await page.locator('[data-action="open-report"]').first().click();
  assert(await page.locator('#report-notes').inputValue() === 'Checklist retained for the next session.', 'Report edits must persist after reload');
  results.push('Due date, correction, hints, assistance, notes, download, persistence');

  await start('check-funds', 'B', false);
  assert(await page.locator('[data-action="hint"]').count() === 0, 'Hints should be disabled');
  await page.locator('#answer-balance').fill('56.10');
  await page.locator('#answer-enough').selectOption('no');
  await complete();
  assert((await page.locator('.report-support').innerText()).includes('Assistance not reviewed'), 'No record must not imply independence');
  results.push('Available funds, insufficient balance, disabled hints, unknown assistance');

  await start('schedule-payment');
  await pay('86.40', '2026-11-12');
  await click('check-task');
  assert(await page.locator('.task-feedback').isVisible(), 'Incorrect payment must not pass');
  await click('cancel');
  await click('confirm-cancel');
  assert((await page.locator('.service-content h2').innerText()).includes('canceled'), 'Cancellation must update the receipt');
  await pay('68.40', '2026-11-12', true);
  const confirmationDownload = page.waitForEvent('download');
  await click('download-receipt');
  assert((await confirmationDownload).suggestedFilename().includes('confirmation'), 'Confirmation must download');
  await complete();
  assert((await page.locator('.error-list').innerText()).includes('Recovered'), 'Corrected errors must remain visible');
  results.push('Payment via phone portal, incorrect submission, cancellation, recovery, confirmation download');

  await start('verify-payment');
  await page.getByRole('button', { name: 'View payment HB-1042', exact: true }).click();
  await page.locator('#answer-amount').fill('68.40');
  await page.locator('#answer-payment-date').fill('2026-11-12');
  await page.locator('#answer-confirmation').fill('hb-1042');
  await complete();
  results.push('Verify existing payment amount, date, and confirmation');

  await start('cancel-payment');
  await page.locator('[data-action="service"][data-service="phone"]').click();
  await page.locator('[data-action="phone-nav"][data-page="bill"]').first().click();
  assert((await page.locator('.bill-total').innerText()).includes('$68.40'), 'Phone bill must show expected amount');
  await page.locator('[data-action="service"][data-service="bank"]').click();
  await page.getByRole('button', { name: 'View payment HB-1042', exact: true }).click();
  assert((await page.locator('.large-money').innerText()) === '$86.40', 'Seeded payment should have an incorrect amount');
  await click('cancel');
  await page.getByRole('button', { name: 'Keep payment', exact: true }).click();
  assert((await page.locator('.service-content h2').innerText()).includes('scheduled'), 'Dismissing confirmation must preserve payment');
  await click('cancel');
  await click('confirm-cancel');
  await complete();
  results.push('Compare bill and payment, confirm cancellation, complete cancellation task');

  await start('schedule-payment', 'B');
  await page.locator('[data-action="bank-nav"][data-page="pay"]').first().click();
  await page.locator('#payment-amount').fill('72.55');
  await page.locator('#payment-date').fill('2026-12-10');
  await page.getByRole('button', { name: 'Review payment' }).click();
  assert((await page.locator('#form-error').innerText()).includes('enough available funds'), 'Insufficient funds should prevent submission');
  await page.locator('[data-action="bank-nav"][data-page="transfer"]').click();
  await page.locator('#transfer-amount').fill('16.45');
  await page.getByRole('button', { name: 'Transfer funds', exact: true }).click();
  assert((await page.locator('.account-amount').first().innerText()) === '$72.55', 'Transfer must update available funds exactly');
  await pay('72.55', '2026-12-10');
  await complete();
  results.push('Insufficient funds rejected, transfer funds, schedule after transfer');

  await start('due-date', 'C');
  await page.locator('#answer-date').fill('2027-01-15');
  await click('pause');
  const pausedTimer = await page.locator('[data-timer]').innerText();
  await page.waitForTimeout(1200);
  assert(await page.locator('[data-timer]').innerText() === pausedTimer, 'Timer should stop during a pause');
  assert(await page.locator('#main').getAttribute('inert') !== null, 'Patient controls must be inert when paused');
  await page.reload();
  assert(await page.getByRole('button', { name: 'Resume session' }).isVisible(), 'Active session must be recoverable after reload');
  await page.getByRole('button', { name: 'Resume session' }).click();
  assert(await page.locator('#answer-date').inputValue() === '2027-01-15', 'Answer must survive reload');
  await click('tools');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => document.activeElement.dataset.action === 'tools'), 'Closing therapist tools should restore keyboard focus');
  await click('tools');
  await click('restart');
  await click('confirm-restart');
  assert(await page.locator('#answer-date').inputValue() === '', 'Restart should clear answers');
  await click('tools');
  await click('end-session');
  assert(await page.locator('.outcome-badge').innerText() === 'Not completed', 'Ending an incomplete attempt must preserve its outcome');
  results.push('Pause, resume after reload, saved answer, restart, incomplete outcome');

  await page.locator('[data-action="library"]').first().click();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Library overflow at ${width}px`);
    const unnamed = await page.getByRole('navigation', { name: 'Workspace' }).locator('button').evaluateAll(buttons => buttons.filter(button => !button.getAttribute('aria-label') && !button.innerText.trim()).length);
    assert(unnamed === 0, `Workspace navigation missing accessible names at ${width}px`);
  }
  await start('schedule-payment');
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Practice overflow at ${width}px`);
    assert(await page.locator('.task-panel').isVisible(), 'Task should remain available');
  }
  results.push('Library and patient views fit desktop, tablet landscape, tablet portrait, and mobile');
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  return { passed: results, browserErrors: errors };
}
