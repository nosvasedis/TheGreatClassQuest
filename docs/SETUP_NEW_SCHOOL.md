# Set up a new school (GCQ)

Use this checklist when onboarding a new φροντιστήριο. Goal: under 90 minutes.

## How config works (your school stays safe)

- **Your school (e.g. GitHub Pages):** The app loads **bootstrap.js**, which tries to load `config.json`. You **don’t** deploy `config.json`, so that request fails and the app uses the **hardcoded** Firebase config in **constants.js** — exactly as today. No change.
- **New schools (Netlify):** You create **one Netlify site per school**, same repo and branch. You set **environment variables** for that school’s Firebase project. The build runs **scripts/write-config.js**, which writes **config.json** from those env vars. The app loads that and uses it. So one codebase, many sites, each with its own Firebase.

## Before you start

- Agree on tier with the client (Starter / Pro / Elite).
- You will create a **new Firebase project** for this school (one project per school).

## Steps (recommended: Netlify, same repo)

1. **Create Firebase project** (Firebase Console, Spark plan is free). Copy the project’s config (Project settings → Your apps → config object).

2. **In Netlify:** New site from Git → this repo, branch **main** (or your stable branch). Site name e.g. `gcq-school-mytown`.

3. **Set environment variables** for that site (Site settings → Environment variables). Add:
   - `GCQ_FIREBASE_API_KEY`
   - `GCQ_FIREBASE_AUTH_DOMAIN`
   - `GCQ_FIREBASE_PROJECT_ID`
   - `GCQ_FIREBASE_STORAGE_BUCKET`
   - `GCQ_FIREBASE_MESSAGING_SENDER_ID`
   - `GCQ_FIREBASE_APP_ID`
   - `GCQ_FIREBASE_MEASUREMENT_ID` (optional)
   Values = that school’s Firebase config. Then trigger a new deploy.

4. **Deploy** runs `node scripts/write-config.js`, which writes `config.json`; the school’s URL now uses that Firebase project.

5. **Create the subscription doc in Firestore** (in **that school’s** Firebase project):
   - In Firebase Console → Firestore → Start collection (if needed).
   - Create a document with path: **`appConfig`** (collection) → **`subscription`** (document ID).
   - Paste the contents of the matching preset from **`config/tiers/`**:
     - `starter.json` → Starter
     - `pro.json` → Pro
     - `elite.json` → Elite
   - Field names and values must match (tier, maxTeachers, maxClasses, guilds, adventureLog, calendar, etc.).

6. **Pro/Elite only:** Configure OpenRouter (or your AI proxy) for this project if needed (API key / spending limit).

7. **Smoke test:** Open the app URL → Sign up as first user → You should see the **setup screen**. Add at least one class, copy the invite link, click “Enter the Quest”. Then test: award a star, open Wallpaper mode.

8. **Onboarding session** with the client (screen-share or on-site): show them the setup flow, then the main app.

9. Send them the **app link** and a short “quick start” note.

## First user experience

When the **first user** signs up and the school has **no classes**, they see the **setup screen** where they can:

- Add classes (name + Quest level).
- Copy the signup link to invite other teachers.
- Click **“Enter the Quest”** (after adding at least one class) to open the main app.

After that, all users (including new signups) go straight to the main app.

## Your school (Elite)

For your own deployment, create the `appConfig/subscription` document with the contents of **`config/tiers/elite.json`**. No code change needed.
