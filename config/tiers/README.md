# Tier presets for Firestore

Use these when creating the **`appConfig/subscription`** document for a new school.

- **starter.json** — Starter plan (3 teachers, 6 classes; no Guilds, limited Log, no Scroll/Story Weavers/Calendar).
- **pro.json** — Pro plan (6 teachers, 10 classes; full features except AI).
- **elite.json** — Elite plan (unlimited; all features including AI).

In Firestore: create document at path `appConfig/subscription` and paste the JSON fields as document fields. Do **not** paste the file as a single string; use each key as a field name and the value as the field value.
