# GCQ tools

## Adding a school: the operator console

Every school uses the same site and the same Firebase project; each school's data lives under
its own `artifacts/{schoolId}/public/data`. There is nothing to deploy for a new school.

1. Sign in to the app as the operator and open `#operator` (for example
   `https://great-class-quest-school.pages.dev/#operator`). The first time, the founding school's
   Secretary claims the console once.
2. **Add a school**: name, school code (used in links and family logins; it cannot change),
   plan and optional end date.
3. Send the school the **office setup link** (one use, 7 days) and the **school link + teacher
   code**. The office activates its Secretary account with the link; teachers create their
   accounts on the school link and type the teacher code.
4. Change a plan, suspend or reactivate a school, or issue a new office link or teacher code from
   the same console.

Online payment (Stripe) is optional and off by default: see `functions/.env.example`.

The local onboarding console, the Render billing server and `tools/billing-setup.html` were
retired on 2026-10-06 (they are in git history).

## Hosting notes

- The live site is Cloudflare Pages (`great-class-quest-school.pages.dev`), built from `main` on
  every push:
  - Framework preset: `None`
  - Build command: `node scripts/build-static-site.js`
  - Build output directory: `dist`
- GitHub Pages mirrors it nightly through `.github/workflows/deploy-github-pages.yml` (repository
  Actions secrets `GCQ_*`).
- Both builds write one `config.json` (the shared Firebase project) from the `GCQ_*` values.

## Founding school helpers

- `npm run migrate:secretary-admin` makes a one-use Secretary setup or recovery link for the
  founding school (the operator console never manages the founding school).
- `npm run set-subscription` sets the founding school's plan document with a service-account key.
- Shared code for these and for `scripts/wait-for-firestore-indexes.cjs` is in
  `scripts/lib/schoolAdmin.cjs`.

## Emergency helper: year-end-recovery.html

Open **`tools/year-end-recovery.html`** in a browser when a school year was closed before grades, reports, or certificates were finished.

It signs in with a normal Firebase teacher/admin account, reads the archived closed-year Firestore data, and produces printable per-student grade sheets and certificates without writing anything back to Firestore. Use **Batch Print** to render every filtered student at once, then use the browser print dialog to save a PDF.
