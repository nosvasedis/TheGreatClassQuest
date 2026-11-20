# Moving the database (and the files) to Europe: the plan

Status: **plan only, nothing changed yet** (2026-11-20). The tooling described in step 6 is
the next piece of work. Every number below was measured on production that afternoon. They
are a snapshot for sizing: lessons keep adding stars, diary pages and pictures, so the move
tool counts, dumps and hashes the live data at the moment of the move, and only that is
compared 1:1.

## 1. Why

The functions run in Belgium (`europe-west1`), but the database is in the USA (`nam5`) and the
files are in Iowa (`us-central1`). Every time a function reads or writes, the request crosses
the Atlantic (~0.1 s, measured ~0.55–0.7 s per read from Greece). A function that touches the
database several times waits for each trip. With the database in Europe, a function's reads
take milliseconds, and the app itself, which talks to Firestore directly, also stops crossing
the ocean for every screen.

## 2. What there is to move

| | Today |
|---|---|
| Firestore documents | **11,741** (about 7 MB as JSON), 46 collections + 5 kinds of subcollection |
| Composite indexes | 26 collection groups (`firestore.indexes.json`); no TTL policies |
| Use | ~23,000 reads and ~1,000 writes a day (free tier: 50,000 / 20,000) |
| Backups / point-in-time recovery / delete protection | none / off / off |
| Storage files | **1,796 files, 307 MB**, bucket `the-great-class-quest.firebasestorage.app` |
| Storage downloads | 0.63 GB a month |
| Picture links saved in documents | **1,760 links in 1,389 documents**, 21 kinds of field, all `firebasestorage.googleapis.com/v0/b/<bucket>/o/…?alt=media&token=…` |
| Inline `data:` pictures | 23 (left as they are) |

The picture links live in: `shop_items.image` (857), `adventure_logs.imageUrl` (232),
`students.avatar` (140), ceremony snapshots (avatars in 5 places plus `sourceFingerprint`),
Quiz of the Week (avatars, question pictures, prize), `student_scores` (`inventory[].image`,
`familiar.spriteSheets[]`), `parent_snapshots` (avatar, satchel), stories (`chapters`,
`story_history`, `story_data.currentImageUrl`, `completed_stories.coverImageUrl`).

## 3. Google's rules that shape the plan

1. **A Firestore database cannot change location.** It has to be a new database filled with a
   copy of the data.
2. **Only one database per project is free:** the first one created. If that one is deleted,
   the *next database created* becomes the free one. So a new database made beside today's
   would be **paid forever**, even after the old one is deleted.
3. **A database name can be reused 5 minutes after it is deleted.**
4. **Export/import is exact:** document IDs, every field type and server timestamps are kept.
   Import does not fire triggers, and builds the indexes defined in the database at import time.
   An export is **not** a frozen snapshot, so writes must be stopped while it runs.
5. A Firestore trigger must be **created again** after its database is deleted, even if the
   new one has the same name.
6. **Free storage exists only in US buckets** (`us-central1`, `us-east1`, `us-west1`). A bucket
   in Europe is paid from the first byte.

## 4. The recommended way: same name, new place

**Database:** export the data → delete `(default)` → create `(default)` again in Europe → import.

- **It stays free.** The new `(default)` is created right after the old one is deleted, so it
  takes over the free tier (rule 2).
- **No code changes.** The app, the functions, the AI proxy worker, the storage proxy worker
  and the scripts all talk to `(default)` and keep working unchanged.
- **The cost:** a planned break of about 45–60 minutes, at night. For a few minutes the data
  exists only in the export copies, and section 5 covers that.

The alternative, a second database named e.g. `gcq-eu` with a client switch, would mean zero
downtime and the old database kept as a fallback. But it is paid forever (about $0.50/month
today, rising with each school), and every file that names the database would change: the
app, the functions, both workers, the rules deploy and the scripts. That's not recommended.

### Which location (your choice)

| | `europe-west1` (Belgium) | `eur3` (Belgium + Netherlands) |
|---|---|---|
| Speed for the functions | best: same region as the functions | almost the same |
| Survives a whole region going down | no (copies across zones in Belgium) | yes (like today's `nam5`) |
| Uptime promise | 99.99% | 99.999% |
| Price above the free tier | lower | higher |
| Free tier | yes | yes |

Recommendation: **`europe-west1`**. It is the fastest and cheapest, and for a school app the
99.99% promise is plenty. Choose `eur3` if you want the same "multi-region" safety as today.

### Files: move them, or leave them where they are?

Moving the files does much less for speed than moving the database. Pictures are fetched once,
then the browser and the app's own picture cache keep them. It also ends "free":

| | Stay in `us-central1` | Move to `europe-west1` |
|---|---|---|
| Cost today | $0 (inside Always Free) | about $0.10/month (storage $0.006 + downloads $0.08 + operations) |
| Cost at 10 schools | probably still $0 | about $1/month |
| Speed | first view of a picture ~0.1–0.2 s slower | first view faster; later views are cached either way |
| Work | none | new bucket, copy 1,796 files, rewrite 1,760 links, code changes |

Recommendation: **move the database first, and leave the files for now.** The files can follow
later on their own night with the plan in section 7, and nothing in the database move depends
on them.

## 5. Keeping the data 1:1: the safety design

Nothing is deleted until the data exists in **three independent, verified copies**:

1. **The managed export** (Google's own format) in a new bucket in the US.
2. **A second copy of that export** in a bucket in Europe (another region, another bucket).
3. **Our own full dump.** Every document is written as JSON that keeps the exact types
   (Timestamp, reference, bytes, GeoPoint, nested maps and arrays), plus a SHA-256 of each
   document and a manifest (paths, counts, update times). It is saved on your computer and in
   the European bucket.

Then the same tool that wrote the dump checks the new database **document by document**:
every path present, nothing extra, and every hash equal. "1:1" is proven, not assumed.

Before the real night, a **rehearsal**: import the export into a temporary database
`gcq-move-rehearsal` in the target location, run the 1:1 check against the live database,
then delete it. This costs a few cents (rule 2: it is a second database) and proves that the
export, the cross-region import and the checker all work, before anything is deleted.

**Stopping writes during the move:**
- Before the export, deploy **"read-only" security rules** (all reads as today, every write
  refused). The app shows its normal "could not save" message, so nothing is half-saved and
  nothing is written after the export.
- Functions use the admin SDK and are not stopped by rules. The window is set between the
  nightly jobs (00:10 / 02:30 / 04:30 Athens). Before deleting, the tool lists every
  document's update time again and stops if anything changed since the export started.
- **Phones and laptops** keep an offline copy of the data (`persistentLocalCache`). An app
  update shipped **before** the night clears that local copy once when the database changes,
  so no device can resend old data or hold a stale view. It re-downloads in seconds.

**Rollback** at any point before the rules are reopened: delete the new `(default)`, create it
again in `nam5`, import the same export (already proven by the rehearsal), reopen the rules.
That puts everything back as it was, still free.

## 6. The night, step by step (what the tool will run)

`npm run data:move -- --check` (any time, changes nothing), `-- --rehearse`, `-- --go`,
`-- --rollback`. Every step stops on the first surprise.

| # | Step | Approx. time | App |
|---|---|---|---|
| 0 | Checks: login, counts, buckets, the cache-reset update is live, rehearsal passed | 2 min | normal |
| 1 | Deploy read-only rules; wait for in-flight writes | 2 min | read-only |
| 2 | Full dump + hashes (copy 3) | 3–5 min | read-only |
| 3 | Managed export (copy 1), copy to Europe (copy 2), compare file lists | 5–10 min | read-only |
| 4 | Re-list update times: nothing changed since step 2 | 1 min | read-only |
| 5 | Delete `(default)` in `nam5`; wait 5+ minutes | 6 min | **offline** |
| 6 | Create `(default)` in Europe; deploy indexes + read-only rules | 3–5 min | **offline** |
| 7 | Import; wait for the indexes to be ready | 5–10 min | **offline** |
| 8 | 1:1 check against the dump (every path, every hash) | 3–5 min | read-only |
| 9 | Re-create the `reconcileSpecialQuestEffects` trigger | 3 min | read-only |
| 10 | Deploy the normal rules; smoke test (sign in, award a star, Family Portal) | 5 min | normal |

Offline for about 15–20 minutes and read-only for about 45–60, done at night. The data is
small, so export and import are quick.

## 7. Moving the files later (if you decide to)

1. Create bucket `the-great-class-quest-eu` in `europe-west1` and link it to Firebase. Same
   CORS settings, uniform access, storage rules deployed to both buckets (`firebase.json`
   storage targets).
2. Copy all files bucket-to-bucket. Metadata is kept: `firebaseStorageDownloadTokens`,
   `Cache-Control`, `contentType`. Check every file's size, CRC32C and token against the
   original.
3. Rewrite the links with the same "read-only + dump + verify" pattern. In every string field,
   `/v0/b/the-great-class-quest.firebasestorage.app/` becomes `/v0/b/the-great-class-quest-eu/`.
   The tokens stay the same, so every new link works at once. `sourceFingerprint` is rewritten
   the same way, so it stays consistent.
4. Code: `constants.js` + `scripts/write-config.js` (`storageBucket`), the functions'
   `storage.bucket()` / `getStorage().bucket()` get an explicit bucket name, the storage proxy
   worker (`FIREBASE_STORAGE_BUCKET` + allowlist), `scripts/migrate-avatars.cjs`,
   `tools/year-end-recovery.html`. The service worker's picture cache matches any bucket
   already.
5. Keep the old bucket untouched for 30+ days (old links in browser caches, the PWA picture
   cache, shared PDFs), then delete it.

## 8. What I need from you

1. **Location:** `europe-west1` (recommended) or `eur3`.
2. **Files:** leave them in the US for now (recommended), or move them too, on a separate night.
3. **When:** a night for the rehearsal (no downtime) and a night for the move (about an hour,
   ideally 21:30–23:30 on a Friday or Saturday).

## 9. What gets built next (before any move)

- `scripts/migrate-data-europe.cjs` + pure `scripts/lib/dataMovePlan.cjs`: the steps above, with
  `--check / --rehearse / --go / --rollback` and a log file, like `npm run functions:gen2`.
- `scripts/lib/firestoreDump.cjs`: a dump that keeps exact types, per-document hashes and the
  1:1 checker, with unit tests for every Firestore type plus an emulator round-trip test
  (dump → wipe → import → check).
- `firestore.readonly.rules`: the read-only rules used during the move, with emulator tests
  that reads still work and every write is refused.
- App: a one-time local cache reset when `DATA_EPOCH` changes (`firebase.js`), shipped and live
  before the night.
- Storage tooling, only if section 4 says "move".
