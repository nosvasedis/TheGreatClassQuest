# Moving the database (and the files) to Europe: the plan

Status: **tool built and checked against production, the move not run yet** (2026-11-20).
Location decided: `europe-west1`. Files stay in the US for now.

Every number below was measured on production that afternoon. They are a snapshot for sizing:
lessons keep adding stars, diary pages and pictures, so the move tool counts, copies and
fingerprints the live data at the moment of the move, and only that is compared 1:1.

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
| Composite indexes | 64 live (65 in `firestore.indexes.json` after the 2026-11-20 fix, see section 6) + 1 field setting; no TTL policies |
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
- Functions use the admin SDK and are not stopped by rules. The tool **pauses the 4 nightly
  jobs** for the whole move and resumes them at the end. After the export it reads every
  document again and stops, before anything is deleted, if a single fingerprint changed.
- **Phones and laptops** keep an offline copy of the data (`persistentLocalCache`). An app
  update shipped **before** the night clears that local copy once when the database changes,
  so no device can resend old data or hold a stale view. It re-downloads in seconds.

**Rollback** at any point (`npm run data:move -- --rollback`, section 6). Before the delete
step, it only reopens the rules. After it, it creates `(default)` again in `nam5`, imports the
same export, checks it 1:1 and reopens. That puts everything back as it was, still free.

## 6. The tool and the night

Everything is one command: `npm run data:move` (`scripts/migrate-data-europe.cjs`). It keeps
its notes, copies and logs in `%USERPROFILE%\.gcq-data-move\`, so a rerun continues where it
stopped.

```powershell
npm run data:move -- --check
```
Changes nothing. It checks the sign-in, that the database is in `nam5`, a test read, that the
functions are 2nd gen, and the 4 nightly jobs. It checks that every live index is in
`firestore.indexes.json`, compares the live rules with the repo, and compiles the read-only
and normal rules. It also checks that the device cache reset is live on `origin/main`.

```powershell
npm run data:move -- --rehearse
```
No downtime, costs a few cents. It makes the buckets, reads the live database, runs Google's
export, reads it again, makes the European copy, imports it into a temporary database
`gcq-move-rehearsal` in `europe-west1`, and checks every document. Documents that teachers
changed while it ran are allowed to differ. Then it deletes the temporary database and prints
how long each part took. The real move refuses to start without a rehearsal that passed in
the last 14 days.

```powershell
npm run data:move -- --go
```
The real move. Type `MOVE` and it runs these steps:

| # | Step | App |
|---|---|---|
| 1 | Pause the 4 nightly jobs (nothing on the server writes during the move) | normal |
| 2 | Read-only rules; wait 90 s | read-only |
| 3 | Full typed copy + SHA-256 per document (copy 3) | read-only |
| 4 | Google export to `gs://the-great-class-quest-move-us` (copy 1) | read-only |
| 5 | Read everything again: **stop if anything changed** | read-only |
| 6 | Copy the export to `gs://the-great-class-quest-move-eu`, same sizes and checksums (copy 2) | read-only |
| 7 | Upload the typed copy to the European bucket too | read-only |
| 8 | **Delete `(default)` in `nam5`** | offline |
| 9 | Create `(default)` in `europe-west1` (waits out Google's 5 minutes) | offline |
| 10 | Indexes + read-only rules; wait until every index is ready | offline |
| 11 | Import from the European copy; wait for the indexes | offline |
| 12 | 1:1 check: every document's fingerprint equal to copy 3, **or it stays read-only** | read-only |
| 13 | Re-create the `reconcileSpecialQuestEffects` trigger for the new database | read-only |
| 14 | Normal rules back | normal |
| 15 | Delete protection on | normal |
| 16 | Resume the nightly jobs | normal |

Then set `FIRESTORE_DATA_EPOCH = 'europe-west1'` in `constants.js`, commit and push, so each
device drops its offline copy once and downloads it fresh.

```powershell
npm run data:move -- --rollback
```
It knows how far the move got. If the old database was never deleted, it puts the normal
rules back and resumes the jobs, and no data is touched. If it was deleted, it creates
`(default)` in `nam5` again, imports Google's export from the US bucket, checks every
document against copy 3, re-creates the trigger, reopens the rules and resumes the jobs. It
never deletes an intact original.

**Tests:** `npm test` (fingerprints for every value type, the 1:1 check, the read-only rules,
the step order and the cache reset) and `npm run test:data-move`. The second one runs in the
emulator: real documents of every type, REST vs gRPC, a copy in a database with another name,
a changed type / value / missing / extra document caught, and every read answered the same
under the read-only rules while every allowed write is refused.

**Found and fixed while building it (2026-11-20):**
- Production had **4 composite indexes and 1 field setting that were not in
  `firestore.indexes.json`** (made outside the file). The new database would have missed them
  and those queries would have failed. They are in the file now, and `--check` refuses a move
  if this happens again.
- `firestore.rules` in the repo has one change that is not live yet (2 November, Ceremony of
  the Month: a watched ceremony can move straight to locked). The move publishes it, and
  `--check` says so.

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

## 8. What is decided, and what is left

- **Location:** `europe-west1` (decided 2026-11-20).
- **Files:** stay in the US for now.
- **Before the move:** push the device cache reset (`firebase.js` + `utils/firestoreCacheEpoch.mjs`)
  and let it go live. Run `--check`, then `--rehearse` once (any time, no downtime).
- **The night:** about an hour, at night after lessons. `--go`, then the `FIRESTORE_DATA_EPOCH`
  push.
