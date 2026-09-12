# SIRMAN — RESTORE VALIDATION AUDIT (READ-ONLY)

**Date:** 1405/06/21 (2026-09-12)
**Mode:** READ-ONLY
**Product code modified:** NO
**User backup modified:** NO
**Restore / merge / replace executed:** NO
**Build / install:** NO

```text
RESTORE VALIDATION AUDIT = COMPLETE
ROOT CAUSE = SECTION CHECKSUMS RE-VALIDATED AFTER migrateBackup MUTATES/REORDERS RECORDS
RECOMMENDED FIX = RUN PORTABLE SECTION HASHES ONLY ON UNMODIFIED PARSED PACKAGE; DO NOT RE-CHECK AFTER FIELD MIGRATE
```

---

# 1. WHERE THE MESSAGE IS PRODUCED

The exact Persian string is:

```text
هش بخش <key> مطابقت ندارد
```

It is **not** a comparison against live shop data.

| Location | Function | Severity |
|---|---|---|
| `Sirman_Final.html` | `validateBackupSectionChecksums` | **ERROR** (fail-closed) |
| `Sirman_Final.html` | `validateBackupPackage` | **WARNING** (does not set `ok=false`) |
| `desktop/Sirman.Core/Backup/BackupPortableIntegrity.cs` | `ValidateSectionChecksums` | **ERROR** (Core extract; HTML is still the live restore gate) |

Callers that surface it to the user:

1. `importData` → `validateBackupPortableIntegrity` **before** migrate → alert `یکپارچگی قابل‌حمل نامعتبر`.
2. `importData` → `validateBackupPackage` **after** migrate → warnings appended to `سلامت فایل` in `openRestorePreviewModal`.
3. `applyBackupSelective` / `applyBackupReplaceSections` / `applyBackupMergeSections` → `assertRequiredBackupCollections` → `validateBackupPortableIntegrity` **on already-migrated `d`** → `throw new Error(...)` → alert `❌ خطا: هش بخش … مطابقت ندارد`.

The apply-time path (3) is the one that can reject a **valid same-version full backup** after the file already passed the pre-migrate integrity gate.

Hash primitive:

```text
Sirman_Final.html  backupSectionHash
Core               BackupCanonicalChecksum.SectionHash
```

Algorithm: djb2 of `JSON.stringify(section)` over UTF-16 code units, hex of uint32. **Not** SHA-256. SHA-256 is the separate package-level `checksum` field (`verifyChecksum` / `BackupStoredChecksum`).

---

# 2. EXACT COMPARISON

`validateBackupSectionChecksums`:

```text
for each key k in d.sectionChecksums:
  if d[k] is undefined: skip
  if backupSectionHash(d[k]) !== d.sectionChecksums[k]:
      error "هش بخش k مطابقت ندارد"
```

Compared objects:

| Left | Right |
|---|---|
| `backupSectionHash(d[k])` = djb2(`JSON.stringify` of the **in-memory** section now) | stored `d.sectionChecksums[k]` written at backup finalize |

**Not compared:** live `invoices` / `products` / localStorage, `applicationVersion`, `schemaVersion`, manifest kind, or current vs backup counts (except a separate preview volume warning that uses different wording).

`attachSectionChecksums` (write path) hashes keys from `data.sections` if that array is non-empty, skipping metadata (`version`, `exportedAt`, `origin`, `checksum`, `checksumAlgo`, `manifest`, `magic`, `schemaVersion`, `sectionChecksums`, `applicationVersion`, `attachmentsIndex`).

A current full package (`_buildFullBackupData`) always sets `sections` to the business/settings list, so those keys get hashes.

---

# 3. WHAT A FULL BACKUP SHOULD VALIDATE

A valid `magic=SIRMAN_BACKUP`, `kind=full`, `schemaVersion=1` package should be checked for:

- magic / schemaVersion / supported schema (`canRestoreSchema`)
- manifest presence/shape
- required collection presence (MISSING ≠ EMPTY)
- section shape (arrays of objects where required)
- `itemCounts` vs actual array lengths when `itemCounts` is present
- `attachmentsIndex` parent refs when present
- package SHA-256 when `checksumAlgo=SHA-256`
- `sectionChecksums` vs **unmodified parsed sections**
- version compatibility (`applicationVersion` is informational; schema gate is `schemaVersion`)

It should **not** require backup sections to match current live data. Restore is allowed onto an empty or different home machine. Preview already has a separate volume warning if live data is much larger; that is not `مطابقت ندارد`.

---

# 4. WHY MANY SECTIONS FAIL TOGETHER

`importData` order:

1. parse JSON
2. required collections + structural + **portable hashes on raw file**
3. schema migrate
4. **`migrateBackup(d)` mutates `d` in place**
5. `validateBackupPackage` (hash mismatches become warnings on `سلامت فایل`)
6. preview
7. on confirm: `assertRequiredBackupCollections(d)` runs portable hashes **again on mutated `d`**

`migrateBackup` always runs `migrateSection` / `migrateRecord` for every key in `SCHEMAS`:

`products`, `phonebook`, `parts`, `services`, `tasks`, `defectiveStock`, `accounts`, `warranties`, `sales`, `warehouses`, `daqi`, `daqiWarehouse`, `daqiVouchers`, `postalHistory`

`migrateRecord` builds a **new object**: schema defaults first (schema key order + missing fields filled), then copies original keys. Even when values are unchanged, **key order and added default fields change `JSON.stringify`**, so djb2 no longer matches the stored hash.

`invoices` is not in `SCHEMAS`, but `migrateBackup` still injects missing `id` / `invoiceId` (`mig_inv_*` / `INVUID-*`). That also changes the invoices stringify.

Empty arrays stay `[]`; their hash still matches. Populated sections fail together. That matches the user’s list.

Isolated proof (synthetic, no user file):

```text
products [{name, code, price}] hash 35bb5598
after migrateSection               60116e4d
match                              false
invoices after id/invoiceId inject false
empty array after migrate          true
```

---

# 5. BUG IN VALIDATION OR BACKUP?

**Validation / restore-pipeline bug.** The backup format and finalize hashes are internally consistent. The fail-closed section hash is applied a second time after a legitimate field-migrate that is *supposed* to change records.

Not evidence of a corrupt `SIRMAN_BACKUP` full file, and not a live-data mismatch.

Secondary risk (not required to explain this symptom): if step 2 already fails before migrate, then write/read canonicalization (Core `BackupJsJson` vs HTML `JSON.stringify`) would need a separate check. The multi-section pattern after a successful file open / preview is explained by post-migrate re-check.

---

# 6. MINIMUM FIX (NOT APPLIED)

Do **not** rewrite the user’s backup. Do **not** weaken fail-closed checks on the **raw parsed** package.

1. Keep `validateBackupSectionChecksums` on the unmodified object immediately after parse (current `importData` step 2).
2. After that gate passes, either:
   - drop `sectionChecksums` from the in-memory clone used for migrate/apply, or
   - skip portable section-hash in `assertRequiredBackupCollections` / post-migrate `validateBackupPackage`.
3. After migrate, keep required collections, shapes, and `itemCounts` (length must still match; migrate must not change counts).
4. Do not compare backup payload to live RAM as an integrity condition.
5. Do not change Backup/Print/Inventory architecture in this fix.

---

# 7. TESTS REQUIRED TO PROVE THE FIX

1. **Round-trip current full package:** `_buildFullBackupData` → finalize (HTML and Core) → `JSON.stringify(null,2)` → parse → portable PASS → migrate → apply/merge/replace must **not** throw `هش بخش`.
2. **Non-empty SCHEMAS sections:** products/services/warranties/sales/tasks/defectiveStock/warehouses with shop-like key order (not schema order) must restore.
3. **Invoices without `invoiceId`:** migrate may add ids; apply must still succeed after pre-migrate hash PASS.
4. **Tamper still FAIL-closed:** change one warranty after finalize; `importData` / merge / replace must throw `هش بخش warranties مطابقت ندارد` **before** live mutation (existing P1C-7 T9/T11).
5. **SHA-256 still FAIL-closed** on payload mutation; pretty-print must still PASS (existing P1C-7 T3/T4/T6).
6. **Legacy without `sectionChecksums`:** still compatible (T10/T12).
7. **Empty collections:** still PASS.
8. Execution-based test in `test_laegh.js` (not text-only): real `migrateBackup` then `assertRequiredBackupCollections` on a hashed full fixture must not throw after the fix; a tampered fixture still must.

---

# 8. PROTECTED / NOT DONE

No restore, no delete, no replace, no merge, no migration of shop data, no user-backup edit, no product-code change.

**STOP.**
