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
- prepares the Netlify environment variables

## Older helper: billing-setup.html

You can still open **`tools/billing-setup.html`** directly in the browser if you only want a quick copy-paste generator.

That older helper does **not** do the full automatic setup. It only prepares values for manual copy-paste.
