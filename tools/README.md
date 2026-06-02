# GCQ onboarding tools

## Recommended: onboarding console

Run this from the project root:

```bash
npm run onboarding-console
```

Then open the local address shown in the terminal, usually:

```text
http://127.0.0.1:3020
```

This is the main noob-friendly setup quest. It:

- saves the school in your local billing records
- stores the Firebase key safely on your machine
- checks that Cloud Firestore is enabled
- deploys the repo's Firestore rules
- writes the school subscription as `pending`
- checks and creates Firestore indexes
- checks Firebase Storage and deploys Storage rules when a bucket exists
- rebuilds the Render billing JSON
- prepares the hosting values for Netlify, GitHub Pages, and Cloudflare Pages

## Hosting notes

- Netlify uses `netlify.toml` and the shared static build command `node scripts/build-static-site.js`.
- GitHub Pages uses the included workflow at `.github/workflows/deploy-github-pages.yml` and expects the `GCQ_*` values as repository Actions secrets.
- Cloudflare Pages should use:
  - Framework preset: `None`
  - Build command: `node scripts/build-static-site.js`
  - Build output directory: `dist`
- All three hosting targets generate the same school-specific `config.json` from the `GCQ_*` values during build.

## Older helper: billing-setup.html

You can still open **`tools/billing-setup.html`** directly in the browser if you only want a quick copy-paste generator.

That older helper does **not** do the full automatic setup. It only prepares values for manual copy-paste.
