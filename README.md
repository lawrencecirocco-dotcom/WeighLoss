# Lighter

A kinder home for your food, movement and weight journey. Built for a Fitbit user who wants one clear daily calorie balance, room for favourite snacks, and encouragement without guilt.

## Run it

Requires Node.js **24.5+** (uses built-in SQLite), npm and a modern browser.

```sh
cd /workspace/WeighLoss
npm ci
npm run dev
```

The web app runs on port 5173 and the private local API on 3001. Open the development app in your browser. The dashboard initially contains **clearly labelled sample data**. Choose **Start my journey**, enter your details, and save your plan to replace the sample entries with your own. Cancelling preserves the sample journey.

For a built private version, first configure a unique `APP_PASSWORD` (12+ characters) and a stable random `DATA_ENCRYPTION_KEY` (32+ characters) in the server environment or ignored `.env`. Production data routes fail closed without both. Do not share these values in chat. For iPhone hosting without commands, use the [guided personal setup](docs/IPHONE-SETUP.md).

For a built version:

```sh
npm run build
npm start
```

The production server serves the app and API together on port 3001 by default, or the host’s configured PORT. No external fonts, database service or integration credentials are needed for manual tracking.

## What works now

- Editable adult profile, starting/current/goal weight, slow/moderate/faster pace, or an optional target date. Shows the required deficit, a bounded plan, approximate weekly loss and goal date.
- Daily calories remaining, recalculated when weight, food or activity changes; over-budget days get supportive copy.
- Food diary with confirmed meal type, date, calories and macros; date navigation, filtering and removal. Meal time defaults to breakfast/lunch/dinner/snack using Adelaide time.
- Manual exercise with conservative estimated calorie credit. Steps from Fitbit or a manual entry.
- Water logging in 250 ml steps and an editable daily reminder goal through the help panel.
- Weight history, time-proportional trend chart, next milestone and estimated final date, visible in the header. Longer trends inform the projected date; estimates are not guarantees.
- Favourite snacks, quick logging, optional AI reasons based on favourites, remaining calories and hunger.
- Evening hunger check-in (1–10), supportive suggestions, optional capped weekly calorie flexibility, and favourite movement choices.
- 7pm **ACST (UTC+9:30, year-round)** in-app/browser reminders while the app is open. Diary dates use Australia/Adelaide, including daylight saving; these are deliberately different clocks.
- Progress-photo upload, viewing, captions and permanent image deletion.
- A friendly Sprout mascot and weekly food-diary wins. No shame, streak punishment or pressure to earn food.
- Durable SQLite storage with browser-storage fallback if the API is unavailable.

## Optional Fitbit connection

1. Register an application with [Fitbit's developer portal](https://dev.fitbit.com/). A compatible Fitbit developer account/API grant is required. Provider availability, scopes and account eligibility must be verified against the current portal before relying on this adapter.
2. Copy `.env.example` to `.env` and fill `FITBIT_CLIENT_ID` and `FITBIT_CLIENT_SECRET` **locally on the server**. Do not put these in frontend variables or commit them.
3. Register the exact `FITBIT_REDIRECT_URI` with the provider. The default development callback is `http://localhost:3001/api/fitbit/callback`; use localhost consistently for the app and callback so the OAuth cookie matches. Set `APP_ORIGIN` to the web app's origin (development port5173, built version3001).
4. Restart the API, choose **Your Fitbit → Connect with Fitbit**, authorize, and choose **Sync my day**. You can disconnect in the same panel.

The adapter exchanges/refreshes OAuth credentials only on the server and imports selected-date steps, total calories out, workouts, recent weight, sleep duration, resting heart rate and nutrition summary. Fitbit tokens are not returned to the browser. **This is daily sync on demand and approximately every 15 minutes while the personal app is open, not a full historical/intraday export or closed-app wearable sync.** Sleep/heart/nutrition data depends on scope, device and provider availability. Provider food summary is stored with the sync response, not automatically duplicated into the app's editable diary.

Fitbit's total already includes workouts; those calories are never added twice. An early-day Fitbit total is compared against baseline full-day maintenance and the higher is used as a **projection**. This prevents the morning budget collapsing to the minimum. A full-day total can update that projection. Normal estimation errors still apply.

Live Fitbit authorization/sync has **not been verified** because credentials were not supplied. Local integration error handling and OAuth-state rejection are tested. The adapter uses Fitbit Web API endpoints and needs a real-account compatibility check; connecting all Fitbit data is beyond this first version.

## Optional AI food and snack estimates

Set `LIGHTER_AI_KEY` in the server `.env` and restart. `OPENAI_API_KEY` is also accepted for conventional self-hosted setups; `LIGHTER_AI_KEY` avoids reserved cloud variable names. Model defaults to `gpt-4.1-mini` and can be changed with `OPENAI_MODEL`.

- **Log food → upload/take photo → Estimate with AI** fills editable food/macros. Nothing is logged until **Confirm & log meal**. Portions and ingredients hidden from a camera cannot be reliably measured: this is an estimate, never an exact calorie count.
- **Evening check-in → Personalise with AI** requests explanations using only saved favourites, hunger and budget. Returned foods must match known favourite IDs and individually fit the current budget. Alternatives are not a recommendation to eat all suggestions.
- Manual entry and deterministic budget-filtered favourites work without AI. There is no fake AI response or fake connected Fitbit state.

Using these controls sends the selected meal image, or favourite names/budget/hunger respectively, to OpenAI. Body-progress photos are stored locally and are **not** sent to AI. No background AI requests are made. Live provider calls were not tested without credentials; server tests use a stub to check AI output validation.

## Calorie model and weekly flexibility

The starting model is Mifflin–St Jeor multiplied by your usual activity. Paces request250/500/750 kcal deficits, limited to25% maintenance and adult daily intake floors (female1200/male1500). A preferred date calculates the requested deficit from remaining kilograms using the approximate7700 kcal/kg model. If too fast, a gentler deficit and later date are shown. Under-18 and underweight-goal deficit plans are blocked. These are broad guardrails, not personalised medical recommendations; pregnancy, breastfeeding, medical conditions or disordered-eating history need clinician guidance.

Manual workout calories are estimated with METs; only50% is credited, capped at500kcal/day. Set usual activity realistically: these manual entries should represent extra movement, not exercise already assumed by the activity level. With Fitbit, manual credit is zero to avoid adding the same exercise twice. Food does not need to be earned through exercise.

Weekly flexibility comes only from explicitly completed food diaries in the previous six days, never missing logs or future days. Very low intake earns no credit. Actual used amounts are subtracted before a200kcal daily cap. Completing a day saves its target including any allowance used; later overspending offsets savings. Today's allowance is reserved once, rather than changing as you log dinner. This supports flexibility, not intentionally skipping meals. The water default is a configurable reminder, not a prescribed optimal intake.

## Privacy and deployment boundary

This version is **single-owner**. Local development remains available for sample/manual tracking; a hosted copy requires HTTPS, an owner password and a stable encryption key. The [Render blueprint](render.yaml) prepares a paid personal service with persistent storage; no account, service, payment or public address has been created automatically. Review current pricing before choosing a plan. Publishing the Codex environment does not deploy the website.

Hosted API routes, photos and OAuth actions require an HttpOnly session cookie. Passwords use scrypt verification and failed attempts are limited. Saved Fitbit tokens and provider credentials use AES-GCM encryption. You can enter provider keys directly in the signed-in **connection guide** instead of editing `.env`; they are never returned to the browser. Hosted health records are not backed up in localStorage or service-worker caches. Only public app-shell assets are cached. The login session lasts seven days; sign out on shared devices.

SQLite records and progress images live in the server data directory. They are not individually encrypted by this app; use appropriate hosting and protect backups. The stable encryption key is necessary to recover saved provider connections—do not rotate it casually. Progress-photo deletion removes the image file; full export/deletion is still a separate task. Backups, provider availability and ongoing hosting costs remain the owner's responsibility.

The default development API binds127.0.0.1; do not publicly expose unauthenticated development mode. The prepared production host binds the configured interface with strict origin/hostname checks and private authentication. This is not a multi-user product. Closed-phone push reminders and mobile Health Connect integration remain additional work. See [personal data information](public/privacy.html) and [personal-use information](public/terms.html), published as real pages when hosted.

## Development checks

```sh
npm test             # Actual calorie-engine and API integration tests
npm run test:e2e     # Chromium end-to-end journey; starts app if needed
npm run build        # TypeScript + production bundle
```

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for a different system installation. They exercise manual food confirmation, persistence, water, plans, weigh-ins, photo upload, hunger, favourites and mobile navigation, then restore the original app state. API tests use temporary databases, not your records. Node SQLite may print an experimental-feature warning.

Cloud command sandboxes that block local sockets may need their supported elevated execution for development servers and browser/API integration tests. Keep the configured proxy and CA trust. Scripts enable Node24's `NODE_USE_ENV_PROXY` for external integration calls. Required optional outbound domains: `www.fitbit.com`, `api.fitbit.com`, `api.openai.com`. Package installation uses `registry.npmjs.org`. No live provider authorization is implied by passing local tests.
