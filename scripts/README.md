# Scripts

## set-subscription.js — Create `appConfig/subscription` in Firestore

Use this to create (or overwrite) the subscription document so your school is Elite, or to set a new client’s tier.

### 1. Get a service account key (one time per Firebase project)

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project (e.g. your school’s project).
2. Click the **gear** → **Project settings**.
3. Open the **Service accounts** tab.
4. Click **Generate new private key** → **Generate key**. A JSON file will download.
5. Move that file into your project folder (or keep it somewhere safe).  
   Name it e.g. `my-school-serviceAccount.json`.  
   **Do not commit it** (it’s already in `.gitignore`).

### 2. Install dependencies (once)

From the project root:

```bash
npm install
```

### 3. Run the script

From the project root:

```bash
node scripts/set-subscription.js ./my-school-serviceAccount.json elite
```

- First argument: path to the JSON key file you downloaded.
- Second argument (optional): `starter` | `pro` | `elite`. Default is `elite`.

After it runs, you should see: `Done. Written appConfig/subscription with elite preset to project ...`

### 4. Confirm in the app

Reload your app; it reads `appConfig/subscription` on load. Your school will then be on Elite (all features and no limits).
