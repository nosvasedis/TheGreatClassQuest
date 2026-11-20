# Moving the Cloud Functions to 2nd gen and Node.js 24

Google offers Node.js 24 only for **2nd gen** functions. All of ours except one were 1st gen,
so the move is: each function is replaced by a 2nd gen function **with the same name and the
same address**. The app, the Family Portal and Stripe keep calling the same URLs. Nothing in
the app changes, and nothing needs to be pushed for this.

## What stays the same

- **Behaviour:** same names, memory, timeouts, secrets and schedules. The script checked all 61
  functions against production one by one.
- **Addresses:** `https://europe-west1-the-great-class-quest.cloudfunctions.net/<name>`, including
  the Stripe webhook registered in Stripe.

## What gets faster

Chosen from 30 days of real use: about 2,000 calls and 3,600 busy seconds a month. More than
half of the calls are the sign-in screen's school check.

- **A full CPU per instance** (1st gen gave a 1 GB function 0.58 of one). Waking up and the
  work itself run about 70% faster.
- **Light calls share a warm instance** (up to 16 at once). When many people open the app
  together, one instance answers them all instead of each person waiting for a new one to
  wake. Heavy work (pictures, portraits, exports, purges, the Market and the nightly jobs)
  keeps an instance to itself.
- **Firestore over REST.** A function that has been asleep reaches the database sooner.
- **Unchanged and still fast:** permission reads in parallel, libraries loaded only when needed.

## Cost: still free

- Nothing is kept warm. A function costs nothing while nobody uses it.
- Today's use is about **2% of the monthly free allowance** (180,000 vCPU-seconds, 360,000
  GiB-seconds, 2 million requests). About 50 times more use still costs nothing.
- **Cost cap:** at most 20 instances per function, so even a runaway client cannot run up a bill.
- **The same few cents as today:** the 4th Cloud Scheduler job ($0.10/month; 3 are free) and
  stored function images (about 0.5 GB, cleaned after 1 day).
- Cloud Build: 2,500 build-minutes a month are free, and a full deploy uses roughly 60–120.

## Why there is still some lag, and the next step

The database (`nam5`, USA) and file storage (`us-central1`) are in the USA, while the
functions are in Belgium (`europe-west1`). Each database step a function takes crosses the
Atlantic (~0.1 s). This is not part of tonight:

- A Firestore database **cannot be moved**. Moving it means a new database, a full
  export/import with the app frozen, new rules and indexes, and pointing every screen at it.
  Storage would need a new bucket and every saved picture link rewritten. That is a planned
  project with a maintenance window, not something to add to tonight.
- A simpler option, later: run the functions in `us-central1`, next to the data. A new region
  can run beside the old one, so the switch needs no downtime. It needs an app update (the
  region setting) and a new webhook address in Stripe. It only helps the calls that touch the
  database many times, so measure first.

## Tonight: one command

1. Open a terminal in the project folder.
2. Run this one command:

   ```powershell
   npm run functions:gen2
   ```

3. Wait 2–3 minutes for the checks (nothing is changed yet).
4. The same window then shows the plan and asks **Type MIGRATE to start:**. Type `MIGRATE` in
   that window and press Enter. It is an answer to the question, not a second command.

That's it. It takes about **30–45 minutes**. Leave the window open.

**When:** start by **22:45 Athens time**. The script refuses to start between 23:30 and 05:00,
because the nightly Market jobs run at 00:10, 02:30 and 04:30.

### What it does

0. `reconcileSpecialQuestEffects` (already 2nd gen) moves to Node.js 24, with no downtime.
1. **Canary:** three functions nobody waits on (`getOperatorStatus`, `previewYearRollover`,
   `backfillSchoolYearData`). This proves the new setup works in production.
2. **Nightly jobs:** the Market jobs, the former-student tidy-up and the Stripe summer pause. It
   checks the new Cloud Scheduler jobs exist and removes the old ones.
3. **Payments:** the Stripe webhook and checkout/portal. While the webhook is down, Stripe keeps
   retrying for 3 days, so no payment is lost.
4–6. **The other callables**, in three batches.

For each batch: delete the 1st gen functions → deploy the 2nd gen ones (up to 3 tries) → check
they are 2nd gen on Node.js 24 → call each address with a plain GET, which never runs the
function's code: a callable must answer 400, the webhook 405. A batch's functions are offline
for about 5 minutes. Anyone who uses one of them then sees an error and can simply try again.

### If it stops

If any step of a batch fails, the script **puts that batch back on 1st gen at once** and
stops. Everything then works: earlier batches on 2nd gen, the rest still on 1st gen. The
message says what failed, and the log file path is printed at the start and the end. Running
`npm run functions:gen2` again later continues with what is still 1st gen.

### Undo everything

```powershell
npm run functions:gen2 -- --rollback
```

This puts every function back on 1st gen / Node.js 22, batch by batch. The 1st gen copy is the current commit with only the 2nd gen move reversed, so later work on the functions (such as the Family Portal changes) is kept
(type `ROLLBACK`). The code in the folder stays the 2nd gen version, so revert it with git
before the next normal deploy.

## Afterwards

- In the app: open Home, award a star, open the Family Portal and the School Office. If those
  work, the callables do.
- Tomorrow morning, check that the Market restocked (00:10 job) and that the function logs show
  no errors:

  ```powershell
  node node_modules/firebase-tools/lib/bin/firebase.js functions:log --project the-great-class-quest
  ```

- From now on, `npm run deploy:functions` deploys 2nd gen as usual.
- Before tonight, `npm run deploy:functions` with the new code refuses to deploy and changes
  nothing (Google can't switch generations in place). Use `npm run functions:gen2` instead.

## Checks only, any time

```powershell
npm run functions:gen2 -- --check
```

The same checks as step 3, then the plan. Nothing is changed.
