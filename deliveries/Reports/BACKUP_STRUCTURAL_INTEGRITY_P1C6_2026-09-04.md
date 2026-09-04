# SIRMAN — P1C-6 Backup Structural Integrity Validator

**Date:** 2026-09-04  
**Packet:** CODE + TEST ONLY. No live shop data, restore on real data, data repair, Phonebook recovery/cleanup, SQLite, `resetAll`, backup rewriting, or storage SoT changes.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/p1c6-backup-structural-integrity-fa01`  
**Base:** `cursor/p1c5-accounts-schema1-fail-closed-fa01`

Required-collection registry **not modified:**

```javascript
var REQUIRED_BACKUP_COLLECTIONS = ['warranties', 'invoices'];
var REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA = { 1: ['sales', 'parts', 'accounts'] };
```

`tasks` remains legacy-compatible / not required.

---

## Phase 3 Change Gate

```text
CHANGE: P1C-6 backup structural integrity (itemCounts / attachmentsIndex / duplicate warnings)
CLASS: Safety bugfix of existing BackupEngine
Q1: CAPABILITY — restore integrity gate only
Q2: RunBusiness / Host / Core: NO
Q3: Persistence: YES — validation only; live SoT not mutated
Q4: Printing: NO
Q5: HTML-only: PRESERVED
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet P1C-6 2026-09-04
```

---

## 1. Existing structural metadata discovered

Source of truth: `_buildFullBackupData`, `finalizeBackupPackage`, `buildBackupManifest`, `collectAttachmentIndex`, `attachChecksum`, `attachSectionChecksums`.

| Field | Present in current format? | Semantics | Mandatory today? |
|---|---|---|---|
| `itemCounts` | YES — object of collection → `array.length` on full export | Declared counts for truncation detection | NO. Schema 0 and SCHEMA 0→1 omit it. Historical fixtures omit it. |
| `sections` | YES — array of section names | Export inventory of keys | NO. Not a count contract. |
| `schemaVersion` | YES | Integer schema, separate from app version | Used for required-collection map; not a new P1C-6 rule |
| `version` / `applicationVersion` | YES | App version string (`1405.6.3α`) | NO for structural FAIL |
| `magic` | YES (`SIRMAN_BACKUP`) | Package marker | Existing package validator |
| `manifest` | YES — built in finalize / 0→1 | Copies schema, versions, origin, kind, `itemCounts`, `sections` | Missing is filled on 0→1; not FAIL when absent |
| `exportedAt` | YES | Timestamp | Excluded from checksum payload |
| Backup file identity (`backupId`) | **NO such field** | Layer prune uses runtime layer `id`, not a backup JSON identity | Not invented |
| `attachmentsIndex` | YES — **derived** by `collectAttachmentIndex` | `{ id, name, ref, inline, kind, parentId }` from `docs`/`attachments` on warranties/sales/invoices | NO when missing. Present → type + parent rule |
| Record-level `docs` / `attachments` | YES — nested on records | Inline/disk refs; index is a projection, not a separate store | Not rewritten |
| `checksum` / `checksumAlgo` | YES — SHA-256 or `none`/`error` | File-hash; `file://` often `none` | Verify still confirm-through; **not** fail-closed here |
| `sectionChecksums` | YES — djb2-style `backupSectionHash` | Per-section hash | Existing **warnings** only; not fail-closed here |

Do not invent fields. P1C-6 only enforces metadata that already exists and has defined semantics.

---

## 2. Collection count rules

`itemCounts` is **optional**. Missing → compatible PASS (no warning spam on every legacy apply).

When the key **is present**:

| Condition | Result |
|---|---|
| `itemCounts` null / array / non-object | FAIL |
| A declared value is not a finite number | FAIL |
| Declared key has no array collection | FAIL (mismatch; never coerce) |
| Declared count ≠ `array.length` | FAIL |
| Declared count = length | PASS |
| Never silently repair the count | YES |

Enforced on: `validateBackupItemCounts` → `validateBackupStructuralIntegrity` / `assertRequiredBackupCollections` / `validateBackupPackage` / post-migrate `importData` gate.

---

## 3. Collection type rules

Unchanged from P1C-1…P1C-5. Structural layer calls `validateRequiredBackupCollections` first.

| Collection | Rule |
|---|---|
| `warranties`, `invoices` | Always required. MISSING / null / non-array → FAIL. `[]` PASS. |
| `sales`, `parts`, `accounts` | Required only at `schemaVersion >= 1`. Schema 0 may omit (migrate/0→1 may fill `[]`). |
| `tasks` | Not required. v2.0 missing → `tasks=[]` still. |
| Present required array `[]` | Valid empty structure |
| null | FAIL when required; no coerce |

---

## 4. Existing uniqueness contracts

Evidence is merge-skip / save-time help text, **not** a restore-FAIL schema.

| Collection | Evidenced identity | Restore uniqueness FAIL? | P1C-6 action |
|---|---|---|---|
| `invoices` | Merge skip: `invoiceId` / `id` / `num`. Help text: **duplicate `num` historically allowed**. New invoice `num` rejected at save. | NO | WARN on non-empty `invoiceId` duplicates only |
| `sales` | Merge skip: `saleUid` or `id` | NO | WARN on non-empty `saleUid` |
| `warranties` | Merge skip: `id` | NO | WARN on non-empty `id` |
| `parts` | Merge skip: `id`. Save-time `code` uniqueness is UI save, not backup FAIL | NO | WARN on non-empty `id` |
| `accounts` | Merge skip: `id` | NO | WARN on non-empty `id` |
| `phonebook` | Frozen. Duplicate analysis not in this packet | NO | **Not scanned** |
| `DIFF_KEYS` | Diff viewer only | NO | Not a restore contract |

Empty identity values are skipped (not treated as duplicates). Data is never mutated. Duplicate count is reported in `duplicateIdentities` + a warning. Status: `VALID_WITH_WARNINGS`. Restore is **not** blocked.

---

## 5. Attachment reference contracts

`collectAttachmentIndex` walks `warranties` / `sales` / `invoices` `docs` or `attachments`. Each index entry:

- `id` — `doc.id` or synthesized `kind-parentId-i`
- `name`, `ref` (disk/`idb:`), `inline`
- `kind`: `warranty` | `sale` | `invoice`
- `parentId`: `rec.id` (empty string if missing)

Records **embed** documents; they do not point at `attachmentsIndex` by id. The evidenced relationship is **index → parent record**.

| Case | Result |
|---|---|
| `attachmentsIndex` missing | Compatible PASS |
| Present but not an array | FAIL |
| Entry without `kind` or empty `parentId` | Skip (insufficient relation) |
| `kind`+`parentId` and no parent `rec.id` in the mapped collection | FAIL |
| Valid `parentId` matching `rec.id` | PASS |
| Record docs not listed in index | **Not enforced** (no reverse pointer in format) |
| Index `kind` → section | `warranty→warranties`, `sale→sales`, `invoice→invoices` |

No new attachment format. No attachment data rewrite.

---

## 6. Validation ordering

Fail-closed order (unchanged sequence, structural inserted after required collections):

1. Parse / unwrap envelope / decrypt  
2. Required collections (`validateRequiredBackupCollections`) — P1C-1…5 rules unchanged  
3. **Structural integrity** (`validateBackupStructuralIntegrity`: counts + attachment parents + duplicate warnings)  
4. Schema restore gate (`canRestoreSchema`)  
5. Checksum verify (still confirm-through if mismatch; not P1C-6 FAIL)  
6. `applySchemaMigrations` (can fill schema-0 omissions)  
7. `migrateBackup`  
8. Post-migrate `itemCounts` re-check (FAIL, never repair) + `validateBackupPackage`  
9. Restore preview  
10. Safety snapshot  
11. Merge / replace / live mutation  

Hard structural failure (`INVALID`) → restore blocked. No confirm-through. Zero live mutation.

`VALID_WITH_WARNINGS` cannot hide: required missing/wrong type, declared count mismatch, required attachment parent broken. Duplicate identity is warning-only because uniqueness is not a restore-FAIL contract.

Entry points: `importData`, `testRestoreBackup`, `BackupEngine.validate`, `assertRequiredBackupCollections` (merge/replace/selective), `prepareNetworkWorkspacePull`.

---

## 7. New implementation

Central result: `{ ok, status, errors, warnings, missingRequiredCollections, invalidCollections, countMismatches, brokenAttachmentRefs, duplicateIdentities }`.

`backupValidationStatus`: `INVALID` | `VALID_WITH_WARNINGS` | `VALID`.

`status === 'INVALID'` iff `ok === false` (any hard error). Warnings alone never set `ok` false.

Duplicate scan originally missed the first row (`seen[id] = 0` is falsy). Fixed to `Object.prototype.hasOwnProperty.call(seen, id)`.

---

## 8. Exact files / functions changed

| File | Change |
|---|---|
| `Sirman_Final.html` | Structural validators + fail-closed wiring |
| `Laegh_Final.html` | Byte-sync |
| `test_laegh.js` | Extract new functions; P1C-6 T1–T18 |
| `deliveries/Reports/BACKUP_STRUCTURAL_INTEGRITY_P1C6_2026-09-04.md` | This report |

| Function | Change |
|---|---|
| `REQUIRED_BACKUP_COLLECTIONS` | Unchanged |
| `REQUIRED_BACKUP_COLLECTIONS_FROM_SCHEMA` | Unchanged |
| `validateRequiredBackupCollections` | Unchanged rules |
| `backupValidationStatus` | **New** |
| `validateBackupItemCounts` | **New** — optional metadata; present → match or FAIL |
| `validateBackupAttachmentIndex` | **New** — optional index; present parent rule |
| `detectBackupDuplicateIdentities` | **New** — detect/report only |
| `validateBackupStructuralIntegrity` | **New** — centralized combiner |
| `assertRequiredBackupCollections` | Also throws on count/attachment hard fail |
| `validateBackupPackage` | Count mismatch is **error** (was warning) |
| `testRestoreBackup` | Structural check **before** schema migrate |
| `BackupEngine.validate` | Uses structural combiner; exposes status |
| `importData` | Structural before migrate/preview; post-migrate count FAIL (no confirm) |
| `prepareNetworkWorkspacePull` | Structural after required, before `migrateBackup` |

Not changed: Phonebook save/merge, `resetAll`, SQLite sidecars, checksum confirm path, `sectionChecksums` warning path, SCHEMA 0→1 collection fills, tasks coerce.

---

## 9. Test matrix

| Test | Result |
|---|---|
| T1 required collection missing → existing FAIL | PASS |
| T2 required null → FAIL | PASS |
| T3 required wrong type → FAIL | PASS |
| T4 explicit `[]` → PASS | PASS |
| T5 declared count matches actual → PASS | PASS |
| T6 declared count mismatch → FAIL, no repair | PASS |
| T7 invalid count type when metadata present → FAIL | PASS |
| T8 valid attachment reference → PASS | PASS |
| T9 broken attachment parent → FAIL | PASS |
| T10 duplicate identity → WARN, `ok:true`, zero mutation | PASS |
| T11 structural fail → zero live mutation (merge/replace/testRestore) | PASS |
| T12 historical fixture without `itemCounts` compatible | PASS |
| T13 warranties regression | PASS |
| T14 invoices regression | PASS |
| T15 sales regression (schema 0 omit / schema 1 missing) | PASS |
| T16 parts regression | PASS |
| T17 accounts regression | PASS |
| T18 tasks still not required; v2.0 `tasks=[]` intact | PASS |

---

## 10. Full-suite result

`node test_laegh.js Sirman_Final.html`

```text
کل تست‌ها: 757
موفق: 757
ناموفق: 0
```

Previous verified suite before this packet: 739/739. Added 18 P1C-6 tests.

---

## 11. Regression results

| Gate | Result |
|---|---|
| P1C warranties (always required) | PASS (T13 + original P1C group) |
| P1C-2 invoices (always required) | PASS (T14 + original P1C-2 group) |
| P1C-3 sales schema ≥ 1 | PASS (T15 + original P1C-3 group) |
| P1C-4 parts schema ≥ 1 | PASS (T16 + original P1C-4 group) |
| P1C-5 accounts schema ≥ 1 | PASS (T17 + original P1C-5 group) |
| tasks legacy / not required | PASS (T18 + P1C-5 T15) |
| v2.0 / `10.3.29` without `itemCounts` | PASS (T12) |

---

## 12. Live-data unchanged

YES. Packet is validator + synthetic tests. T11: merge/replace throw before `sv*` / snapshot / live array writes. `testRestoreBackup.applied === false`. No shop restore executed.

---

## 13. Phonebook unchanged

YES. No `savePBContact` / phonebook merge / duplicate-cleanup edits. Duplicate detector does not scan `phonebook` / `pb`. T11 asserts phonebook array unchanged on structural fail.

---

## 14. SQLite unchanged

YES. No SQLite schema, files, or migration code in this packet. Sidecar sqlite dirt in the working tree was left unstaged.

---

## 15. Rules intentionally NOT enforced (insufficient evidence)

| Candidate | Why not enforced |
|---|---|
| Missing `itemCounts` | Not emitted by schema 0 or 0→1; historical fixtures omit it |
| Missing `attachmentsIndex` | Derived; 0→1 may add it; current schema-1 files may omit |
| `checksum` mismatch as hard FAIL | Existing path is confirm-through; `none` is valid on `file://` |
| `sectionChecksums` mismatch as hard FAIL | Already documented as warnings in `validateBackupPackage` |
| Duplicate identity as FAIL | Merge **skips** duplicates; invoice `num` historically allowed |
| Invoice `num` uniqueness | Explicit help text: leftover same-number invoices must not be treated as one identity |
| `parts.code` / product `code` at restore | Save-time UI rule; merge uses `id` / `code` skip, not restore FAIL |
| Phonebook uniqueness | Frozen this program |
| Reverse docs→index completeness | Records embed docs; they do not reference index ids |
| `sections[]` vs actual keys | List of names, not a count/presence FAIL contract |
| Backup file `id` uniqueness | No backup JSON identity field |
| `tasks` required | Named v2.0 fill test; left for a later packet |

---

## 16. Remaining integrity gaps

- `sectionChecksums` still warning-only  
- Payload `checksum` still confirm-through  
- In-file duplicate identities restore with a warning (merge later skips vs live)  
- `tasks` still optional at schema ≥ 1  
- No reverse attachment completeness  
- Partial export `itemCounts` only covers selected arrays; undeclared collections are not counted  
- Envelope `database` unwrap does not invent `itemCounts`

---

## 17. Next safest step

**Stop. Do not start P1C-7 in this packet.**

Safest later investigation (not implemented here): either (a) `tasks` Decision B (schema ≥ 1 required, schema 0 fill `[]` preserved) — same evidence class as accounts — or (b) whether `sectionChecksums` / payload checksum should become fail-closed without breaking `file://` `checksumAlgo:'none'`.

No recovery. No Phonebook repair. No SQLite. No live mutation.

---

## Final questions

**Q1. What structural metadata already exists?**  
`itemCounts`, `sections`, `schemaVersion`, `version`/`applicationVersion`, `magic`, `manifest`, `exportedAt`, `attachmentsIndex` (derived), `checksum`/`checksumAlgo`, `sectionChecksums`. No backup-file `backupId`.

**Q2. Which count checks are enforced?**  
Only when `itemCounts` is present: object type, finite numeric values, declared === actual array length. Missing `itemCounts` does not FAIL.

**Q3. Which uniqueness rules are actually evidenced?**  
Detect/WARN only: `invoices.invoiceId`, `sales.saleUid`, `warranties.id`, `parts.id`, `accounts.id` when non-empty. No restore FAIL. Phonebook not scanned. `num`/`code`/name not used as FAIL keys.

**Q4. Which attachment relationships are actually evidenced?**  
`attachmentsIndex[].kind` + `parentId` → parent `rec.id` in warranties/sales/invoices. Enforced only when the index is present and `parentId` is non-empty.

**Q5. Can a hard structural failure reach Merge?**  
NO — `assertRequiredBackupCollections` / structural combiner throw or return before `applyBackupMergeSections` mutates (T11).

**Q6. Can it reach Replace?**  
NO — same gate on `applyBackupReplaceSections` (T11).

**Q7. Did any live data change?**  
NO — synthetic tests only; fail path writes nothing.

**Q8. Did Phonebook change?**  
NO — not in diff as behavior; detector does not scan it.

**Q9. Did SQLite change?**  
NO — not in this packet’s commits.

**Q10. Did all previous P1C rules remain unchanged?**  
YES — registry strings unchanged; T13–T18 plus original P1C-1…5 groups all PASS.
