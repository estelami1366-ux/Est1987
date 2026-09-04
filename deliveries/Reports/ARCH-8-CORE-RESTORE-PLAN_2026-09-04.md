# SIRMAN — ARCH-8 CORE RESTORE PLAN (NO APPLY)

**Date:** 2026-09-04  
**Packet:** Pure Core RestorePlan after DryRun. Describes what a restore would do. Does **not** apply.  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-8-core-restore-plan-fa01`  
**Base:** `cursor/arch-7-host-restore-dryrun-fa01`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-8 Core RestorePlan (decision only)
CLASS: New pure Core planner. No Host cutover. No live Restore change.
Q1: CAPABILITY — Core can describe Merge/Replace without executing them
Q2: RunBusiness: NO. No new Host method.
Q3: Persistence: planner does not write. Applied=false always
Q4: Printing: NO
Q5: HTML-only: PRESERVED — Sirman_Final.html not modified
Q6: New transport/DB/ACL: NO
RESULT: PASS
AUTHORITY: explicit user packet ARCH-8 2026-09-04
```

ARCH-9, Restore cutover, Merge/Replace execution, `_buildFullBackupData` extraction, Phonebook recovery, SQLite, `JsonBackupRepository` activation, and P1C-8 were **not** started.

---

## 1. Current HTML Restore semantics

Traced from `Sirman_Final.html`. Live path is **unchanged** by this packet.

```text
importData(file)
    → parse / decrypt
    → HTML validateRequiredBackupCollections   (MISSING ≠ EMPTY)
    → HTML validateBackupStructuralIntegrity
    → HTML validateBackupPortableIntegrity
    → HTML verifyChecksum
    → HTML applySchemaMigrations + migrateBackup
    → openRestorePreviewModal
    → confirmRestorePreview
         → selected checkboxes + merge|replace
         → applyBackupSelective
              → assertRequiredBackupCollections
              → safety snapshot (_buildFullBackupData)
              → applyBackupMergeSections  OR  applyBackupReplaceSections
              → sv() / svWarr() / render*
              → rollback via applyBackupReplaceSections(safety) on throw
```

### Preview / selection

- `getBackupSectionDefs()` lists many sections (invoices, products, inventory, phonebook, parts, services, warranties, sales, tasks, accounts, …).
- Checkboxes `.restore-sec-chk`. `confirmRestorePreview` refuses if **zero** boxes are checked.
- `_restoreWants(selected, key)`: empty/null `selected` means **all** keys. The modal never sends empty (it requires ≥1 check). Callers that pass `null` (e.g. `applyAll` → replace with `null`) restore every section.
- Preview counts come from the **backup object** (`describeBackupValue`). Live totals used only for a warning (`curTotal` vs `newTotal`), not as a planner DTO.

### Replace (`applyBackupReplaceSections`)

- Whole-array (or object/scalar) assignment for **selected** keys only.
- Unselected keys are left on live RAM. **Omitted section ≠ empty replace.**
- Missing required schema≥1 collection → `assertRequiredBackupCollections` throws → **no apply**.
- Empty array `[]` is a valid replace of that section with zero records.
- Then persist (`sv`, `svParts`, `svWarr`, …) and `render*`.

### Merge (`applyBackupMergeSections`)

- Add-if-not-found. **No in-place UPDATE.** Match → skip, miss → push.
- Identity actually used in HTML (this packet copies **only** the five evidenced keys into Core; see §6 and §17):

| Collection | HTML match | Core RestorePlan key |
|---|---|---|
| invoices | `invoiceId` **or** `id` **or** `num` | `invoiceId` only |
| sales | `saleUid` **or** `id` | `saleUid` only |
| warranties | `id` | `id` |
| parts | `id` | `id` |
| accounts | `id`; records **without** `id` are silently not merged | `id`; no id → CONFLICT |
| phonebook | first phone (`entryPhone`) | **excluded** (not copied) |

- HTML merge does **not** detect duplicate identities as conflicts; a duplicate current match still counts as skip.
- Accounts without `id` are skipped with no conflict flag.

### Conflicts / statistics

- HTML merge returns a Persian summary string (`added` / `skip` for some collections). It does not build a structured conflict list.
- Duplicate keys in source are not rejected at merge time; first live match wins skip/add.
- RestorePlan is therefore **stricter** on duplicates and missing identity (CONFLICT) rather than silent skip.

### Live Restore is not this planner

`importData` / `applyBackupMergeSections` / `applyBackupReplaceSections` / `confirmRestorePreview` do not reference `RestorePlan` or `BackupRestorePlanBuilder`. ARCH-8 G1 locks that.

---

## 2. RestorePlan contract

Types in `desktop/Sirman.Core/Backup/BackupRestorePlanModels.cs`.

```text
Backup JSON
    → BackupDryRunService.Run   (validate + migrate, no apply)
    → RestorePlanBuilder.Build
    → RestorePlan { Applied = false }
```

| Type | Role |
|---|---|
| `RestorePlanRequest` | backup `Data`, optional current snapshot, `Mode`, `SelectedSections`, frozen `NowMs` |
| `RestorePlan` | `Ok`, `Applied` (always false), `Mode`, `Status`, `DryRun`, `Summary`, `Sections`, `Errors`, `Warnings`, `Fingerprint`, `MigratedData` |
| `RestorePlanSection` | selected, excluded, current-available, action, source/current/resulting counts, add/update/remove/skip/conflicts, identity key, per-record actions |
| `RestorePlanSummary` | selected / planned / excluded / conflict section counts |
| `RestoreConflict` | collection, identity key, identity, reason |
| `RestorePlanRecord` | index, identity, action |
| `RestorePlanAction` | Add, Update, Replace, Conflict, Skip, NoAction |
| `RestorePlanMode` | Merge, Replace |

`Update` is **reserved and unused**. HTML never updates in place.

INVALID DryRun → `Ok=false`, empty `Sections`, `MigratedData=null`, **no plan**.

---

## 3. CurrentStateSnapshot contract

```csharp
public sealed class CurrentStateSnapshot
{
    public JsonNode? Data { get; init; }
    public static CurrentStateSnapshot From(JsonNode? data) => new() { Data = data };
}
```

- Supplied as data on `RestorePlanRequest.CurrentSnapshot` (or `Current` JsonNode).
- Core never reads `localStorage`, IndexedDB, browser globals, or live arrays.
- **No live snapshot adapter** in this packet. Tests use synthetic DTOs only.
- Missing snapshot (`null` / absent collection key / non-array) → `CurrentStateAvailable=false`, counts `null`, Merge action `NoAction`, warning `MISSING current ≠ empty`.
- Present empty array `[]` → available, `CurrentCount=0`. That is **not** the same as missing.

---

## 4. Replace planning semantics

For a **selected** collection that exists as an array on the **migrated** package:

- `Action = Replace` (or `Conflict` if source identities duplicate).
- `SourceCount` = array length (0 is valid).
- `ResultingCount` = source length (the live array would become the backup array).
- `ProposedRemovals` = current count **only if** current snapshot is available; otherwise `null` (not 0).
- Unselected collections: `NoAction`, `ResultingCount=null`. They are **not** planned as empty replace.
- Missing required collection fails at DryRun: **no plan**.

Replace does not mutate backup, snapshot, or live storage.

---

## 5. Merge planning semantics

HTML merge is add-or-skip. RestorePlan copies that for the five plannable collections **after DryRun/migration**, using only packet identity keys.

| Source vs current | Action |
|---|---|
| identity missing/blank | CONFLICT (not guessed; not silent skip) |
| identity duplicated in source | CONFLICT |
| identity duplicated in current snapshot | CONFLICT (ambiguous) |
| identity matches exactly one current row | SKIP |
| identity not in current | ADD |
| empty source `[]` | NoAction, zero records |
| current snapshot missing | NoAction; additions/skips **null**, not zero |

`ProposedUpdates` is always 0. `ProposedRemovals` is 0 for merge.

Phonebook selected → excluded section, warning, no identity math.

Unknown selected names → excluded, REVIEW warning, no guessed identity.

---

## 6. Identity rules actually supported

Only these keys, after DryRun/migration:

| Collection | Key |
|---|---|
| `invoices` | `invoiceId` |
| `sales` | `saleUid` |
| `warranties` | `id` |
| `parts` | `id` |
| `accounts` | `id` |

`BackupFieldMigrator` (already in Core, unchanged this packet) may **assign** missing `invoiceId` (`INVUID-*`), `saleUid` (`SALEUID-*`), and `id` on invoices/parts/warranties/sales **before** planning. That is migration, not RestorePlan guessing.

Accounts **do not** get an assigned `id` in the migrator. An account object without `id` is the insufficient-identity fixture → CONFLICT.

Phonebook is not in `PlannableCollections`.

---

## 7. Conflict rules

No auto-resolve.

| Outcome | When |
|---|---|
| ADD | Merge, unique identity, not in current |
| SKIP | Merge, unique identity, one current match |
| REPLACE | Replace selected array (whole collection) |
| CONFLICT | Missing identity, source dup, current dup |
| NO_ACTION | Unselected, excluded, empty merge, or merge without current snapshot |
| UPDATE | Never emitted |

Ambiguous current duplicates stay CONFLICT / REVIEW REQUIRED.

---

## 8. Empty vs missing

Preserved from P1C / ARCH-2..4:

- Schema≥1 **missing** required collection → DryRun INVALID → **no plan**.
- Schema≥1 **empty** `"collection": []` → VALID → plan with `SourceCount=0`.
- Schema 0 missing sales/parts/accounts → existing migrator fills `[]`, then plan (T5/T14).
- Omitted **unselected** section ≠ empty replace (T11).
- Missing current snapshot ≠ empty current (T MergeWithoutCurrentSnapshot).

---

## 9. Determinism

Same backup + same migrated DryRun inputs + same current snapshot + same options + frozen `nowMs` → identical `Fingerprint` (SHA-256 of a canonical plan node). No `Date.now()`, no random IDs in the planner. T15.

`nowMs` is passed through to DryRun so field-migration assigned IDs stay stable in tests (`FrozenNow = 1700000000000`).

---

## 10. Immutability

Builder clones backup and current with `BackupJsonUtil.CloneExact` before DryRun. T16 asserts stringify equality of both inputs after `Build`. `MigratedData` is not the caller’s backup reference.

---

## 11. Exact Core files / functions created

| File | What |
|---|---|
| `desktop/Sirman.Core/Backup/BackupRestorePlanModels.cs` | `RestorePlan*`, `RestoreConflict`, `RestorePlanAction`, `RestorePlanMode`, `RestorePlanRequest`, `CurrentStateSnapshot` |
| `desktop/Sirman.Core/Backup/BackupRestorePlanBuilder.cs` | `Build`, `IdentityKey`, `Fingerprint`, `PlannableCollections` |
| `desktop/Sirman.Core.Tests/BackupRestorePlanTests.cs` | T1–T22 + exclusion / snapshot / immutability / TBD lock |
| `desktop/Sirman.Core.Tests/BackupRestorePlanGolden.json` | Contract notes + fixture catalog |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | copies the golden JSON (**keeps** `BackupFinalizeGolden.json`) |
| `test_laegh.js` | ARCH-8 G1 / G2 HTML locks |

Not created: Host method, live snapshot adapter, Merge/Replace engines, Phonebook planner.

---

## 12. Golden fixtures

`BackupRestorePlanGolden.json` locks identity keys, plannable collections, excluded phonebook, unused `Update`, and T1–T22 ids. `GoldenContract_MatchesBuilderIdentityKeys` asserts the JSON keys match `IdentityKey()`.

---

## 13. Test results (RestorePlan)

`dotnet test --filter BackupRestorePlanTests` → **30/30 PASS**.

| Id | Result |
|---|---|
| T1 valid Replace | PASS — Replace, resulting=source, removals from snapshot |
| T2 valid Merge | PASS — 1 skip + 1 add, updates=0 |
| T3 empty required `[]` | PASS — Ok, zero, NoAction |
| T4 missing required | PASS — INVALID, empty sections, no migrated data |
| T5 schema0 legacy | PASS — migrate then plan |
| T6 duplicate identity | PASS — Conflict, no Update |
| T7 clear identity match | PASS — Skip |
| T8 ambiguous identity | PASS — Conflict «مبهم» |
| T9 multiple sections | PASS — five collections add |
| T10 selected subset | PASS — unselected NoAction |
| T11 omitted ≠ empty | PASS — sales not replaced |
| T12 malformed | PASS — no plan |
| T13 checksum invalid | PASS — no plan; input unchanged |
| T14 migration-required | PASS — sales filled on migrated clone only |
| T15 identical fingerprint | PASS |
| T16 input immutability | PASS |
| T17 Applied=false | PASS including invalid input |
| T18 warranties | PASS missing vs empty |
| T19 invoices | PASS `invoiceId` |
| T20 sales | PASS `saleUid` |
| T21 parts | PASS `id` |
| T22 accounts | PASS `id` |
| Phonebook excluded | PASS — no `entryPhone` in builder |
| Insufficient identity | PASS — accounts without `id` |
| Invoice num not copied | PASS — migrator assigns `INVUID-*`, planner uses `invoiceId` |
| CurrentStateSnapshot DTO | PASS |
| Missing current ≠ zero | PASS |
| JsonBackupRepository TBD | PASS `html-backup-engine` |
| No UI/browser types | PASS |

---

## 14. Full HTML regression

`node test_laegh.js Sirman_Final.html`

**799/799 PASS** (previous 797 + ARCH-8 G1 + G2).

- G1: live `importData` still HTML validate → migrate; no `RestorePlan` / `BackupRestorePlanBuilder`.
- G2: Merge, Replace, `savePBContact`, `resetAll`, phonebook merge text, Core has no `localStorage` / `applyBackupMergeSections`; repository TBD.

`Sirman_Final.html` / `Laegh_Final.html` were **not** edited.

---

## 15. Full Core regression

`dotnet test desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj`

**514/514 PASS** (previous 484 + 30 RestorePlan tests).

ARCH-2..ARCH-7 engines remain in that suite.

---

## 16. Confirmation

| Surface | Status |
|---|---|
| Live Restore (`importData`) | unchanged |
| `applyBackupMergeSections` | unchanged |
| `applyBackupReplaceSections` | unchanged |
| Phonebook / `savePBContact` | unchanged |
| SQLite product files | not in this commit (`JsonBackupRepository` still `html-backup-engine`) |
| `resetAll` | unchanged |
| `_buildFullBackupData` | still HTML |
| Host `TestRestoreBackup` | still DryRun-only (ARCH-7); not wired to RestorePlan |
| Version | `1405.6.3α` |

---

## 17. Known unsupported legacy behaviors

These were **not** copied. Forcing them would couple Core to live HTML matching that the packet forbids.

1. **Invoice merge on `id` or `num`.** HTML skips when `num` matches even if `invoiceId` differs. Core matches `invoiceId` only. After migration most invoices have `invoiceId`, so the gap is same-number / different-uid pairs.
2. **Sales merge on `id`.** HTML also matches `p.id===x.id`. Core uses `saleUid` only.
3. **Accounts without `id`.** HTML silently does not merge them. Core emits CONFLICT / REVIEW.
4. **Phonebook first-phone merge** (`entryPhone`). Excluded on purpose. HTML engine unchanged.
5. **Products / inventory / services / tasks / warehouses / daqi / prefs / appearance / …** HTML can merge or replace them. RestorePlan only plans the five identity-backed arrays. Other selected names are excluded + REVIEW.
6. **`_restoreWants(null)` = all HTML sections.** Core empty selection = the five plannable arrays present on the migrated package. The modal already requires ≥1 checkbox, so this is not the live confirm path.
7. **HTML merge duplicate-in-current is skip, not conflict.** Core treats current identity dups as CONFLICT.
8. **Replace of phonebook empty vs `pb` fallback** and other HTML-only replace coercions are not in the planner.
9. **Safety snapshot / rollback / `sv` / `render*`** are apply-path only. Not in RestorePlan.
10. **Live current counts in the preview warning** read RAM globals. Core will not do that; a future adapter must pass `CurrentStateSnapshot`.

Where a behavior needs live globals or guessed names, this packet **stops** and documents the gap instead of inventing an abstraction.

---

## 18. Next safest extraction

Do **not** start ARCH-9 in this packet. Do **not** cut over Restore. Do **not** implement Merge/Replace. Do **not** extract `_buildFullBackupData`. Do **not** start P1C-8.

Next smallest step after ARCH-8 (separate packet): **display-only** RestorePlan (or DryRun+Plan JSON) on the existing preview modal, still calling HTML `applyBackupSelective` for apply. First apply-adjacent cutover remains Validator-in-`importData`, which is higher risk.

---

## Governance work report (قانون ۱۳)

1. **کار:** ARCH-8 برنامه Restore خالص بدون اعمال  
2. **شاخه:** `cursor/arch-8-core-restore-plan-fa01`  
3. **تغییر:** `BackupRestorePlanBuilder` + مدل‌ها + تست T1–T22  
4. **نسخه:** `1405.6.3α`  
5. **HTML:** 799/799  
6. **Core:** 514/514  
7. **رگرسیون ARCH-2..7:** PASS  
8. **داده زنده:** بدون Restore اجرا / Phonebook / SQLite / resetAll  
9. **چاپ:** دست‌نخورده  
10. **HTML-only:** حفظ شده (HTML تغییر نکرد)  
11. **Rollback:** حذف کلاس‌های جدید کافی است؛ مسیر زنده همان HTML است  
12. **Restore cutover:** شروع نشد  
13. **وضعیت:** COMPLETED (کد+تست لینوکس)  
14. **راهنما:** بدون تغییر UI  
15. **گزارش:** همین فایل  

---

## Q1–Q16

**Q1. Is RestorePlan pure?**  
YES. Static Core builder. Clones inputs, calls existing `BackupDryRunService.Run`, returns data. No persist.

**Q2. Does it access live storage?**  
NO. No `localStorage`, IndexedDB, Host, WinForms, or live arrays. `Builder_DoesNotReferenceUiOrBrowserTypes`.

**Q3. Does it access Phonebook?**  
NO for identity. Selected phonebook is excluded with a warning. No `entryPhone` / `savePBContact`.

**Q4. Does it execute Merge?**  
NO. Describes ADD/SKIP/CONFLICT only. No `applyBackupMergeSections`.

**Q5. Does it execute Replace?**  
NO. Describes REPLACE counts. No array assignment to live state.

**Q6. Does MISSING required data prevent plan creation?**  
YES. T4/T18–T22: DryRun INVALID → empty sections, `MigratedData=null`.

**Q7. Does `[]` remain valid?**  
YES. T3: empty required arrays → Ok, source count 0.

**Q8. Are identity rules based only on evidenced keys?**  
YES. The five packet keys. Invoice `num`/`id` fallbacks not copied (`InvoiceNumFallback_IsNotCopied_MigratorAssignsInvoiceId`).

**Q9. Are ambiguous conflicts left unresolved?**  
YES. T8 current duplicate → CONFLICT. No auto-merge.

**Q10. Is plan generation deterministic?**  
YES. T15 identical fingerprint. Frozen `nowMs`. Canonical SHA-256.

**Q11. Is input immutable?**  
YES. T16 stringify equality of backup and current after Build.

**Q12. Is live Restore unchanged?**  
YES. HTML not edited. G1: `importData` still HTML validate → migrate → selective apply.

**Q13. Did live data change?**  
NO. Synthetic fixtures only. No shop SoT writes.

**Q14. Did Phonebook change?**  
NO. G2 `savePBContact` / HTML phonebook merge remain. Core excluded.

**Q15. Did SQLite change?**  
NO. Product SQLite not in commit. `JsonBackupRepository.TbdMarker` still `"html-backup-engine"`.

**Q16. What is the next safest extraction?**  
Do not cut over Restore apply. Optional display-only Plan on the preview modal. Do not extract `_buildFullBackupData`. Do not implement Core Merge/Replace. Do not start P1C-8.

---

## STOP

Restore cutover not started. Merge/Replace not implemented. `_buildFullBackupData` not extracted. ARCH-9 not started. Phonebook / SQLite / `JsonBackupRepository` not activated.
