# GCQ Billing tools

## billing-setup.html

**Open this file in your browser** (double-click or drag into Chrome/Firefox/Safari).

- No install, no terminal.
- Fill in the form (Firebase project ID, service account JSON, Render URL, Stripe Price IDs).
- Click **Generate configs**.
- Copy each block into **Render** (BILLING_SCHOOLS_JSON) and **Netlify** (environment variables). Optionally paste the Firestore JSON if you set “pending” by hand.

Everything runs in your browser; nothing is sent to any server.

For the full automated flow (including writing “pending” to Firestore), use **`npm run setup-school`** in the project root instead — see **docs/STRIPE_SETUP_SIMPLE.md**.
