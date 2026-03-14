# Firestore: allow app to read subscription (Plan: Elite/Pro/Starter)

The app reads the **subscription** tier from Firestore at `appConfig/subscription`.  
The **set-subscription script** (or any Admin SDK script) writes that doc and **bypasses** client rules.  
The **web app** in the browser uses the client SDK, so it must be allowed by your **Firestore Security Rules**.  
**Changing tier (Starter/Pro/Elite) or any feature flag requires an admin action:** run the set-subscription script or manually update the document in the Firebase Console; the client has **read-only** access and cannot write to `appConfig/subscription`.

If the app shows **Plan: Starter** even after you ran the script, the client is probably **not allowed to read** `appConfig/subscription`.

## Add this block to your rules

Insert the following block **inside** `match /databases/{database}/documents { ... }`, right after the opening brace (e.g. before `function isOwner`):

```firestore
    // Allow signed-in users to read subscription (tier). Only Admin/script writes.
    match /appConfig/subscription {
      allow read: if request.auth != null;
      allow write: if false;
    }
```

So the top of your rules file looks like:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Allow signed-in users to read subscription (tier). Only Admin/script writes.
    match /appConfig/subscription {
      allow read: if request.auth != null;
      allow write: if false;
    }

    function isOwner(docData) {
      ...
    }
    ...
```

1. Firebase Console → your project → **Firestore Database** → **Rules**.
2. Paste the `match /appConfig/subscription { ... }` block as above.
3. Click **Publish**.

After that, reload the app; it should show **Plan: Elite** (or Pro/Starter) correctly.
