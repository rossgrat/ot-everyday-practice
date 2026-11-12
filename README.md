# OT Everyday Practice

[Open the practice website](https://ross.grattafiori.dev/ot-everyday-practice/).

Therapist-led digital life-skills exercises using a fictional bank and phone provider.
Practice reading bills, checking funds, scheduling payments, checking confirmations, and canceling incorrect payments.
All account details and transactions are made up.

## Run locally

Use Node.js 26.13.0. There are no dependencies to install.

```sh
npm start
```

Open `http://127.0.0.1:4173`. Set `PORT` to change the port.
Run `npm test` for the outcome tests.
Serve [dist](dist) over HTTP; opening `index.html` directly does not support its JavaScript modules.
The [Pages workflow](.github/workflows/pages.yml) checks and publishes `dist` on pushes to `main`.

## Use and records

Read the [session guide](docs/sessions.md) for practice sets, assistance records, reports, and timing.
Records stay in this browser's local storage. Clearing site data removes them.
There are no patient accounts, analytics, cloud storage, or real financial connections.
Download reports before leaving if storage fails, and keep personal details out of observations.

Task completion does not establish independence, a diagnosis, or a standardized clinical score.
Missing assistance records are labeled `Assistance not reviewed`.
