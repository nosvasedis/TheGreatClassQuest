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
   - Field names and values must match (see **Feature flags and tiers** below).
   - **Changing tier later:** Update the document by re-pasting the desired `config/tiers/*.json` contents, or use the Node script that writes via the Admin SDK (see docs/FIRESTORE_RULES_APPCONFIG.md). The web app cannot write to `appConfig/subscription`; only an admin or script can.

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

## Feature flags and tiers

The `appConfig/subscription` document is the single source of truth for plan limits and feature flags. The app reads it at load (see `utils/subscription.js`). The presets in **`config/tiers/`** define what each plan includes:

| Flag | Starter | Pro | Elite | Notes |
|------|---------|-----|------|------|
| `tier` | `starter` | `pro` | `elite` | Display name / logic |
| `maxTeachers` | 3 | 10 | null (unlimited) | School-wide |
| `maxClasses` | 6 | 30 | null (unlimited) | Per school |
| `guilds` | false | true | true | Guilds tab, sorting quiz |
| `calendar` | false | true | true | Calendar & Day Planner |
| `schoolYearPlanner` | false | true | true | Holidays, class end dates |
| `scholarScroll` | false | true | true | Scholar's Scroll tab |
| `storyWeavers` | false | true | true | Story Weavers / reward ideas tab |
| `adventureLog` | false | true | true | Full Adventure Log (diary, Hall of Heroes) |
| `advancedAttendance` | false | true | true | Attendance Chronicle (month view) |
| `makeupTracking` | false | true | true | Reserved for make-up lesson tracking |
| `eliteAI` | false | false | true | AI: Oracle, log summaries, story images, shop generator, etc. |
| `earlyAccess` | false | false | true | Early-access experiments |
| `prioritySupport` | false | false | true | Priority support |

Adding or changing a tier (e.g. from Starter to Pro) requires updating the Firestore document; the client app has **read-only** access. Use the Admin SDK script or paste the JSON from the matching `config/tiers/*.json` file.

## Your school (Elite)

For your own deployment, create the `appConfig/subscription` document with the contents of **`config/tiers/elite.json`**. No code change needed.
