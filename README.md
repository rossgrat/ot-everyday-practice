# OT Everyday Practice

A practice website for therapist-led digital life skills. It includes a fictional bank, a fictional phone provider, five exercises, optional hints, assistance records, and session reports. All account details and transactions are made up.

[Open the practice website](https://ross.grattafiori.dev/ot-everyday-practice/).

## Run

Use Node.js **26.13.0**. There are no dependencies to install.

```sh
npm start
```

Open **http://127.0.0.1:4173**. Set `PORT` to use another port.

```sh
npm test
```

The deployable website is the `dist` directory. Serve it with any static HTTP server. Open it over HTTP rather than opening `index.html` directly, because the app uses JavaScript modules.

## GitHub Pages

The app can run as a GitHub Pages project site. Asset and module URLs are relative, so the same files work under a repository subpath. There is no server build or dependency installation.

1. Put this project directory at the root of the chosen GitHub repository, with `dist`, `test`, and `.github` alongside `package.json`.
2. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source.
3. Push to `main`, or run **Deploy GitHub Pages** from the Actions tab.
4. Open the deployment URL shown in the workflow's `github-pages` environment.

The workflow checks JavaScript syntax and runs the outcome tests before uploading only `dist`. Reports, local browser records, and preview artifacts are not deployed. Updates pushed to `main` deploy automatically after checks pass.

GitHub Pages publishes a public website in the usual configuration, including when the source repository is private. A private repository requires a plan that supports Pages. See [GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [custom workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Workflow actions are pinned to the commit IDs for these releases:

| Action | Release |
| --- | --- |
| Checkout | [7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) |
| Setup Node.js | [7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) |
| Configure Pages | [6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0) |
| Upload Pages artifact | [5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) |
| Deploy Pages | [5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) |

## Exercises

1. **Find the due date:** read the phone bill and enter its due date.
2. **Check available funds:** identify the available checking balance and whether it covers the bill.
3. **Schedule a payment:** pay the full phone bill from checking by the due date, without extra active payments, and open its confirmation.
4. **Verify a payment:** open an existing confirmation and enter the amount, date, and confirmation number.
5. **Cancel an incorrect payment:** compare a seeded incorrect payment with the phone bill, then cancel it.

Three practice sets change dates, amounts, and balances. In set B, scheduling requires transferring funds from savings to checking. The date beside the task is the scenario date, regardless of the actual calendar date.

## Session controls

- Choose a practice set and whether hints are available before starting.
- Switch between Harbor Bank and Cedar Mobile throughout the exercise. Payments appear in both services.
- Use **Therapist tools** to record assistance, review assistance records, add observations, restart, or end a session.
- Pause for breaks. Paused time does not count toward active time.
- **Check task** completes a successful session or lists outstanding criteria while allowing more practice.
- End an incomplete session from Therapist tools to preserve its results.
- Download a text report, save a payment confirmation, or print a session summary.

## Data and limits

An active session and up to 50 recent ended sessions are saved in this browser's local storage. Clearing site data removes those records. A browser storage failure does not prevent practice, but records should be downloaded before leaving. There are no patient accounts, cloud storage, analytics, external requests, or real financial connections. Observations should describe exercises without personal details.

The app records requested hints, corrective feedback from unsuccessful task checks, and therapist-entered assistance. Missing assistance records are labeled **Assistance not reviewed**. Task completion does not establish independence, a diagnosis, or a standardized clinical score.

Submitted payment mistakes are tracked in scheduling exercises. Corrections remain in the event history. Scheduled payments do not become paid or debit balances; transfers change available balances. There is no simulation of payment settlement or future income.

The session timer excludes explicit pauses. A session can be resumed after reload; time away continues to count unless the therapist pauses first. Returning to the exercise library pauses the session.

## Structure

- `dist/model.js`: exercise definitions, practice sets, session actions, and outcome checks.
- `dist/app.js`: interface, local storage, and report downloads.
- `dist/styles.css`: responsive layouts and print styles.
- `test/model.test.mjs`: scenario completion, error recovery, funds, dates, timing, and assistance checks.
- `test/browser-check.mjs`: an exported Playwright check function. Pass a Playwright `page` to run the browser walkthrough against the local server. It clears the test browser's local storage before running.
- `server.mjs`: local static server.
- `.github/workflows/pages.yml`: test and deploy the static app to GitHub Pages.
