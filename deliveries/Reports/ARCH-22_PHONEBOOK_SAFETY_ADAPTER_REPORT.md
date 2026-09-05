# SIRMAN — ARCH-22 Phonebook Safety Adapter + Forensic Identity Boundary

**Date:** 2026-09-05  
**Packet:** Dedicated SAFE, TEST-ONLY Phonebook boundary: forensic identity analysis + Core DTO + HTML adapter for the **current** payload. **No live Backup cutover.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-22-phonebook-safety-adapter-fa01`  
**Base:** `cursor/arch-21-optional-business-slice-cutover-fa01`  
**Final status:** **COMPLETED — PHONEBOOK ADAPTER + FORENSIC AUDIT, NO LIVE CUTOVER**

This packet is **code/test verification only**. No shop files, no shop data, no live restore. ARCH-23 was **not** started.

---

## 1. Change Gate

```text
CHANGE: ARCH-22 Phonebook safety adapter + forensic identity boundary
CLASS: New transport DTO + unused HTML RAM reader. Not an assembler cutover.
Q1: CAPABILITY — inspect current Phonebook payload without repairing it.
    collectPhonebookSnapshot() clones RAM phonebook. Core PhonebookSnapshot
    parses the same JSON. Classifier/fingerprint/replay are TEST-ONLY.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Adapter does not write LS/IDB. Assembler unchanged.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. Backup still uses _safeArr(phonebook) in assembler.
Q6: New transport/DB/ACL: PhonebookSnapshot is a JSON DTO in Core.Backup only.
    No SQLite. No second identity system.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-22 2026-09-05
```

Gate stayed PASS. Production Backup/Restore/savePBContact were not modified. Stop conditions were not hit: storage source is unambiguous (`lb` / RAM `phonebook`); stable identity is determined to be **absent** (that is a finding, not a blocker); adapter does not require production behavior changes.

Not started: ARCH-23, live Phonebook cutover, Restore change, duplicate collapse, ID minting.

---

## 2. Phonebook source/storage map

Inspected `Sirman_Final.html` (not inferred from older reports alone).

| Role | Exact source |
|---|---|
| RAM truth | `let phonebook = JSON.parse(localStorage.getItem('lb') \|\| '[]')` |
| Persist | `sv()` → `localStorage.setItem('lb', JSON.stringify(phonebook))` |
| Backup key | `phonebook: _safeArr(phonebook)` inside `_buildFullBackupData()` |
| Legacy alias | `let pb = phonebook` at init (same reference until reassignment) |
| Stale key | `laegh_pb` is **not** read anymore |
| IndexedDB | **No** Phonebook object store. Contacts are not IDB entities. |
| Excel import | `importPhonebook` pushes into RAM `phonebook` then `sv()` |
| UI browse prefs | `laegh_pb_browse` (view mode only, not contacts) |

Storage key **`lb`** is confirmed from hydrate and persist.

Adapter reads **only** RAM `phonebook`, not `pb`.

---

## 3. Creation/update/delete audit

| Operation | Function | Identity effect |
|---|---|---|
| Init/load | `let phonebook= JSON.parse(localStorage.getItem('lb') \|\| '[]')` | Array order is positional identity |
| Create | `savePBContact` when `idx===-1` → `phonebook.push(c)` | **No** `id` minted. Empty `phones` allowed (`filter(Boolean)` only drops blank inputs; zero phones is valid). |
| Update | `savePBContact` when `idx>=0` → `phonebook[idx]=c` | `Object.assign` from previous row; still no stable id |
| Delete | `delPBContact` / `delSelPB` → `splice` | Later indices shift. **Breaks** `daqi.agencyPhonebookIdx` |
| Search | `pbFilteredRows`, global search, postal lookup | Filter/sort copies; does not write ids |
| Excel import | `importPhonebook` | Skip if `phones` includes raw phone; **requires** name+phone; empty-phone rows are skipped here (unlike merge) |
| Export backup | assembler `_safeArr(phonebook)` | Serializes current RAM; preserves duplicates |
| Merge restore | `applyBackupMergeSections` | Raw `phones[0]`; empty first phone **always inserts** |
| Replace restore | `applyBackupReplaceSections` | Replaces the array; `pb` alias may go stale |
| Reset | `resetAll` → `phonebook=[]` then persist via `sv` | After forced backup |
| Autosave | `buildBackupObject` → `_buildFullBackupData` | Same RAM path as manual export |
| Anonymize | `anonymizeContactRecord` | Clears phones/name; sets flags; **no** id |

`savePBContact` was **not** modified. SHA: `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81`.

---

## 4. Identity forensic analysis

**Conclusion: Phonebook currently has NO stable persistent identity field.**

| Candidate | Stable? | Generated once? | Regenerated? | User editable? | Unique? | Nullable? | Collision-prone? |
|---|---|---|---|---|---|---|---|
| `id` | No | Not generated on create | N/A | Only if already present as extra JSON | No | Yes (usually absent) | Preview helper `DIFF_KEYS.phonebook` may *read* `r.id` as last fallback. Not a live key. |
| `phones[0]` | No | No | Overwritten on save | Yes | No (save allows dupes) | Yes (empty allowed) | Merge match when non-empty; exact raw string |
| `phones[]` | No | No | Yes | Yes | No | Yes | Merge checks `indexOf(entryPhone)` on the live array |
| `phone` / `mobile` | `phone` is **legacy backup** only; `mobile` is **not** a schema field | — | — | — | — | — | Excel maps «موبایل» into `phones[0]` |
| `fn`/`ln` / `name` | No | No | Yes | Yes | No | Yes | `name` exists only on old `pb` records |
| `code` | **Not a contact field** | — | — | — | — | — | — |
| `nid` | No | No | Yes | Yes | No | Yes | Not used by merge |
| Array index | Fragile positional | Implicit | Shifts on splice | Indirect | Unique while array unchanged | n/a | `daqi.agencyPhonebookIdx` |
| `agencyPhonebookIdx` | **Not on contacts** | Written on daqi rows | User can change select | N/A | No | Yes (`null`) | Invalid after phonebook reorder/delete/collapse |

Do **not** invent identity. This packet does not mint `PB-` ids.

---

## 5. Duplicate classification model

TEST-ONLY (`PhonebookForensic` in Core.Tests + helpers in `test_laegh.js`). Never writes live data.

| Class | Meaning | Primary precedence |
|---|---|---|
| A | Exact clone (`JSON.stringify` equal) | 1 |
| D | Empty / missing phone (no phone identity) | 2 |
| C | Same raw phone string (any `phones[]` overlap) | 3 |
| B | Same **analysis-only** normalized phone, different raw | 4 |
| E | Same `fn+ln`, different first raw phone — **never auto-merge** | 5 |
| F | Different record | 6 |

A record may belong to multiple classes (exact empty-phone clones are A and D). Primary class uses the table order. Classifier does not delete, merge, or tag production rows.

---

## 6. Normalization model

`normalizePhoneForAnalysis(phone)` / `PhonebookForensic.NormalizePhoneForAnalysis` — **pure test helper**.

| Rule | Applied? |
|---|---|
| Do not change stored phone | Yes |
| Preserve original/raw in fixtures and DTO | Yes |
| Never use normalization alone as automatic identity | Yes (B is analysis-only) |
| Empty / missing / `''` after trim => no identity | Yes |
| Persian `۰-۹` and Arabic `٠-٩` → ASCII `0-9` | Yes — UI `pbNormChar` already treats those digits as present; phone inputs are free text, so T10 is justified |
| Country-prefix (`+98` / `0`) transform | **No.** save/merge/Excel compare raw strings. Insufficient evidence |

---

## 7. Contact fingerprint model

TEST-ONLY: `JSON.stringify(contact)` / `BackupJsJson.Stringify` (HTML-canonical, key order preserved, no key sort).

- No fields excluded.
- Purpose: detect exact cloned contacts.
- **Not** a permanent live ID.
- Mutating a fingerprint string does not mutate RAM.

---

## 8. Current Phonebook schema

`SCHEMAS.phonebook`:

```js
{ fn:'', ln:'', shop:'', addr:'', zip:'', phones:[], ita:'', tg:'', wa:'', ig:'', socials:[], note:'', cat:'other' }
```

`savePBContact` also writes `nid`, `privacyConsent`, `privacyConsentAt`. Extra JSON keys survive `migrateRecord` (copy-all). `id` is not in the schema.

Backup section key remains **`phonebook`**. Legacy `pb` may appear in old files; migrate copies it into `phonebook` when current key is empty.

---

## 9. Core DTO

`Sirman.Core.Backup.PhonebookSnapshot`

- JSON-only; no browser/storage/Host.
- `Parse(JsonNode)` clones; `ToJson()` clones; `ToCanonicalJson()` is HTML `JSON.stringify`.
- Preserves array order, every field, duplicate rows, empty-phone rows, JSON `null`.
- No dedup, no normalization, no generated IDs.
- Output shape: `{ "phonebook": [ ...current contacts... ] }`.
- Forbidden keys (invoices, daqi, attachmentsIndex, settings, envelope, …) are stripped from the DTO and reported.

---

## 10. HTML adapter

```js
function collectPhonebookSnapshot(){
  var data = { phonebook: _safeArr(phonebook) };
  return JSON.parse(JSON.stringify(data));
}
```

- Reads only RAM `phonebook` (same expression as the assembler key).
- Clone-on-return.
- Not present in `_buildFullBackupData` / `exportData` / `buildBackupObject`.
- Does not write LS/IDB, call Host, touch daqi, Restore, or `savePBContact`.

SHA (computed from the function body, not predicted):

```text
7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c
```

---

## 11. Golden fixtures

File: `desktop/Sirman.Core.Tests/PhonebookFixtures.json` (T1–T17).

Expected output is `JSON.parse(JSON.stringify(source))` of `{ phonebook }`. **17/17** HTML adapter goldens. **17/17** Core DTO goldens.

T14–T17 also have execution proofs (mutation isolation; `setItem==0`; `indexedDB.open==0`; Host not invoked).

---

## 12. Historical corruption replay

Synthetic only. No shop JSON on this VM (named backups from prior forensic notes are absent here).

**Empty-phone payload (530 rows), start = that payload, merge same payload four times** using the **current** merge predicate (HTML `applyBackupMergeSections` in a stubbed sandbox, and a C# replica of the same `phones[0]` test):

```text
530 → 1060 → 1590 → 2120 → 2650
```

**PASS** (HTML + Core).

**Identical non-empty unique phones (40 rows):** first merge 40; second merge still 40. Raw-phone matching **prevents** duplication for that class.

Merge **code was not changed.**

---

## 13. Idempotency analysis

`Merge(Payload, State)` then `Merge(Payload, Result)`:

| Class / payload | Result | Category |
|---|---|---|
| D empty / missing first phone (T5, T8, 530-row replay) | length grows | **non-idempotent** |
| C / A with non-empty raw `phones[0]` (T4 clones, unique-phone replay) | Result unchanged | **idempotent** |
| E same name, different phones (T7) | both kept; second merge skips each by phone | **idempotent** after first insert |
| B different raw, same normalized digits | treated as different by merge (raw compare) | **ambiguous** for humans; merge **non-idempotent** if both raw strings appear in a payload that is merged twice from empty *as a set of distinct raw phones* they stay; repeating that payload is idempotent. Normalization is **not** used by merge. |
| Excel import | requires name+phone; empty skipped | different from merge (not repaired) |

Do not repair them.

---

## 14. `daqi.agencyPhonebookIdx` dependency

| Question | Finding |
|---|---|
| Meaning | Integer index into RAM `phonebook[]` |
| Writer | Daqi form save / `addDaqi({ agencyPhonebookIdx })` / select `_daqiFillAgencySelect` |
| Reader | `_daqiAgencyName`, filters, agency label |
| Delete/reorder Phonebook | `splice` **invalidates** the index (wrong contact or `undefined`) |
| Duplicate collapse | Would also invalidate unless remapped |

Adapter does **not** read or write daqi.

**Future Phonebook cleanup requires a coordinated daqi remap.** This packet does not perform one.

---

## 15. Real-backup compatibility analysis

Named shop backups were **not** on this VM. No historical file was rewritten.

From **code + goldens**:

- Backup key remains `"phonebook"`.
- Assembler still `_safeArr(phonebook)` (order, duplicates, empty-phone, unknown fields preserved by JSON clone).
- Adapter JSON equals that backup key for T1–T17.
- Old `pb` `{name,phone}` is migrate-time only; DTO may ingest `pb` if `phonebook` is empty, and still emits only `phonebook`.

---

## 16. Production firewall

`_buildFullBackupData` **did not change** (SHA match). Call graph remains ARCH-21:

```text
exportData / buildBackupObject
    ↓
_buildFullBackupData()
    ↓
collectBackupSettingsSnapshot()       ×1
    ↓
collectRequiredBusinessSnapshot()     ×1
    ↓
collectOptionalBusinessSnapshot()     ×1
    ↓
phonebook from existing RAM path
    ↓
collectAttachmentIndex(data)
    ↓
JSON.parse(JSON.stringify(data))
```

`collectPhonebookSnapshot()` is **off** that graph.

ARCH-15 / ARCH-20 / ARCH-21 cutovers remain active. Restore merge/replace, Print, SQLite, checksum, version unchanged.

---

## 17. Exact SHA locks

| Function | SHA | Result |
|---|---|---|
| `_buildFullBackupData` (ARCH-21, must not move) | `f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41` | **unchanged** |
| `collectRequiredBusinessSnapshot` | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` | unchanged |
| `collectOptionalBusinessSnapshot` | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` | unchanged |
| `collectAttachmentIndex` | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` | unchanged |
| `collectPhonebookSnapshot` (new) | `7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c` | computed |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` | unchanged |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` | unchanged |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` | unchanged |
| `exportData` | `aa8f62ed31807362c3ca80e6c58f73bff68f5354d49b76bbfd9c9a76b82bb498` | unchanged |
| `buildBackupObject` | `f66b0a89313603ae5e70c581e523719056f1a484e8a323423f63e3e69f0150a5` | unchanged |

---

## 18. HTML / Core test counts

| Suite | Count |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **1050/1050** (was 1021; +29 ARCH-22; no decrease) |
| Core `dotnet test desktop/Sirman.Core.Tests` | **788/788** (was 746; +42 Phonebook tests) |
| Adapter goldens T1–T17 | **17/17** HTML, **17/17** Core |
| Classifier tests | HTML 1 group covering A–F + B digits; Core T4/T5/T6/T7/T8/T10/T2 |
| Corruption replay | HTML **2/2**, Core **2/2** (530→2650 empty; 40-phone idempotent) |
| Idempotency | empty **non-idempotent**; raw-phone clones **idempotent** |

Logs: `/opt/cursor/artifacts/arch22-html-tests.log`, `/opt/cursor/artifacts/arch22-core-tests.log`.

---

## 19. Files changed

| File | Why |
|---|---|
| `Sirman_Final.html` | New `collectPhonebookSnapshot()` only. Assembler/Restore/savePBContact untouched. |
| `Laegh_Final.html` | Byte-sync. |
| `desktop/Sirman.Core/Backup/PhonebookSnapshot.cs` | DTO |
| `desktop/Sirman.Core/Backup/PhonebookSnapshotCatalog.cs` | Catalog |
| `desktop/Sirman.Core.Tests/PhonebookFixtures.json` | T1–T17 |
| `desktop/Sirman.Core.Tests/PhonebookForensic.cs` | TEST-ONLY classifier / fingerprint / merge replica |
| `desktop/Sirman.Core.Tests/PhonebookSnapshotTests.cs` | Core proofs |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | Copy fixtures |
| `test_laegh.js` | ARCH-22 group |
| `deliveries/Reports/ARCH-22_PHONEBOOK_SAFETY_ADAPTER_REPORT.md` | This report |

**Not changed:** assembler body, Restore, Print, SQLite, Host, checksum helpers, `SIRMAN_VERSION.json`, ARCH-17/18 adapter bodies, `collectAttachmentIndex`, `savePBContact`.

---

## 20. Data-impact statement

- Live `phonebook` is not written by the adapter.
- No duplicates deleted. No contacts merged. No IDs invented. No phones rewritten.
- `localStorage` / IndexedDB writes by the adapter: **0**.
- Backup JSON produced by production assembler is unchanged.
- No shop data was read or written.

---

## 21. Rollback

1. Delete `collectPhonebookSnapshot` from both HTML files (byte-sync).
2. Remove Core DTO/catalog and Core.Tests forensic files + fixtures + ARCH-22 tests.
3. Confirm assembler SHA is still `f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41`.
4. Re-run HTML and Core suites.

Git: revert the ARCH-22 commits on this branch.

---

## 22. Explicit "NO LIVE PHONEBOOK REPAIR"

This packet did **not**:

- create a “clean phonebook”
- produce a replacement dataset
- mark any real contact as duplicate
- collapse 609 / 2730 historical rows
- alter user data
- change merge or Excel import
- mint permanent IDs

ARCH-22 is **only** the boundary and forensic model.

---

## 23. Recommendation for ARCH-23

Do **not** start ARCH-23 from this packet.

If later authorized, keep these constraints:

- Do **not** collapse duplicates or mint live IDs until a human-approved identity policy exists.
- Any cleanup **must** remap `daqi.agencyPhonebookIdx` in the same packet or refuse to run.
- A production assembler cutover (`phonebook: collectPhonebookSnapshot().phonebook`) is optional and must be **equivalence-gated** like ARCH-15/20/21. It does **not** fix merge non-idempotency.
- Merge idempotency for empty-phone rows is a **separate, high-risk Restore packet**, not an adapter packet.

---

**Status: COMPLETED — PHONEBOOK ADAPTER + FORENSIC AUDIT, NO LIVE CUTOVER**
