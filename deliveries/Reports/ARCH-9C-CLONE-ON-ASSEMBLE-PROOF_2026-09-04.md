# SIRMAN — ARCH-9C Clone-On-Assemble Proof

**Date:** 2026-09-04  
**Packet:** TEST-ONLY proof of JSON clone isolation around `_buildFullBackupData`. **No production clone. No assembly change.**  
**Product version left unchanged:** `1405.6.3α`  
**Branch:** `cursor/arch-9c-clone-on-assemble-proof-fa01`  
**Base:** `cursor/arch-9b-backup-snapshot-contract-fa01` @ `a8c47f3`

---

## Phase 3 Change Gate

```text
CHANGE: ARCH-9C test-only clone isolation proof around assembled snapshot
CLASS: Tests + report. No production behavior change.
Q1: CAPABILITY — prove JSON clone isolates RAM from snapshot mutation
Q2: RunBusiness / Host: NO
Q3: Persistence: NO
Q4: Printing: NO
Q5: HTML-only: PRESERVED — _buildFullBackupData / _safeArr / _safeObj unchanged
Q6: New transport/DB/ACL: NO
RESULT: PASS (proof). Production clone-on-assemble remains BLOCK until a later packet.
AUTHORITY: explicit user packet ARCH-9C 2026-09-04
```

This packet does **not** implement production clone-on-assemble. It does **not** start ARCH-10 or P1C-8. Restore / Merge / Replace / Phonebook / SQLite / live Backup export are unchanged.

Verified suites after this packet:

| Suite | Result |
|---|---|
| HTML `node test_laegh.js Sirman_Final.html` | **821/821 PASS** (801 previous + 20 ARCH-9C) |
| Core `dotnet test desktop/Sirman.Core.Tests` | **556/556 PASS** (538 previous + 18 ARCH-9C) |

---

## 1. Current alias / reference behavior

Authority: live execution of extracted `_buildFullBackupData` + `_safeArr` / `_safeObj` in the HTML sandbox (same extraction pattern as existing گروه ۲۲), plus ARCH-9A source.

```text
_safeArr(a)  →  Array.isArray(a) ? a : []     // returns the SAME array
_safeObj(o)  →  (o && typeof o==='object') ? o : {}  // returns the SAME object
```

Measured on a populated sandbox (invoices / inventory / nested record):

| Check | Result |
|---|---|
| `assembly.invoices === invoices` | **true** — live RAM alias |
| `assembly.invoices[0] === invoices[0]` | **true** |
| `assembly.invoices[0].someNested === invoices[0].someNested` | **true** |
| `assembly.inventory === inventory` | **true** |
| `assembly.inventory['SKU-1'] === inventory['SKU-1']` | **true** |
| `assembly.services === services` | **true** |
| `assembly.svcs === services` | **true** — `svcs` and `services` are the **same** RAM array |

Consequence: a later mutation of the assembled object (or of a holder that still points at it) **mutates shop RAM**. This is the highest current assembly risk identified by ARCH-9A. It is **not** fixed in this packet.

Demo artifact: `/opt/cursor/artifacts/arch9c-isolation-demo.json`

```json
{
  "liveAlias": true,
  "nestedAlias": true,
  "cloneIsolated": true,
  "originalLen": 1,
  "cloneLen": 2,
  "originalNested": "original-nested",
  "cloneNested": "changed",
  "exportedAtIsString": true
}
```

`printSettings` / `company` / `sms` / appearance strings come from `JSON.parse(localStorage…)` or `localStorage.getItem` during assembly, so those particular objects are already new values at assemble time. The live-alias hazard is the RAM collections passed through `_safeArr` / `_safeObj`.

---

## 2. Clone mechanism evaluated

Two candidates were compared. Neither was wired into production.

| Mechanism | Where | Status |
|---|---|---|
| `JSON.parse(JSON.stringify(value))` | HTML ARCH-9C harness | Evaluated. Used as the proposed JS boundary. |
| `BackupJsonUtil.CloneExact` = `JsonNode.Parse(BackupJsJson.Stringify(d))` | Core ARCH-9B already | Evaluated. Same semantic boundary as HTML `JSON.stringify` for JSON-compatible values (insertion order preserved, non-ASCII not escaped). |
| `BackupSnapshot.Parse` | Core contract | Uses `CloneExact` then wraps. Test-only consumer of the clone. **Not** a live adapter. |

**Chosen for the proof (not for production):** JSON-canonical stringify → parse.

Reasons:

1. ARCH-9B already defined this as the snapshot clone.
2. Current assembled payload is JSON data (section 3).
3. It isolates arrays, nested objects, and nested arrays (sections 4–5).
4. It does not require a new serializer.

`structuredClone`, `lodash.cloneDeep`, and handwritten walkers were **not** selected. They were not needed once JSON clone proved type-safe for the current snapshot.

The clone is **not** a replacement for production assembly. Tests call `_buildFullBackupData()` first, then clone the result.

---

## 3. Data-type safety assessment

Walk of the assembled sandbox snapshot (`arch9cScanTypes`) found only JSON kinds: `object`, `array`, `string`, `number`, `boolean`, `null`. **Zero** specials.

Core walk of the populated synthetic snapshot found only `JsonValueKind` Object / Array / String / Number / True / False / Null. No `Undefined`. All numbers finite.

Types actually present today (from ARCH-9A + this scan):

| Field class | Runtime type in current snapshot | JSON-safe? |
|---|---|---|
| collections (`invoices`, …) | arrays of plain objects | yes |
| `inventory` / `itemCounts` / `appearance` | plain objects | yes |
| counters | finite numbers | yes |
| `exportedAt` | **ISO string** (`new Date().toISOString()`), not a `Date` | yes |
| `loginPw` / `logoSrc` / `tz` | strings | yes |
| Persian text | UTF-16 strings (`علی`, `فروشگاه سیرمان`) | yes — round-trips |
| `attachmentsIndex` | array of plain objects | yes |
| `printCenter` | plain object | yes |

Hypothetical JSON.clone coercions (**not present** in current snapshot):

| Value | `JSON.stringify` | Would it lose current snapshot data? |
|---|---|---|
| `undefined` in object | key omitted | **No** — not observed |
| `undefined` in array | `null` | **No** — not observed |
| `Date` | ISO string | **No** — `exportedAt` is already a string |
| `function` | omitted / `null` | **No** — not observed |
| `NaN` / `Infinity` / `-Infinity` | `null` | **No** — not observed |
| `bigint` | throws | **No** — not observed |
| `Map` / `Set` / DOM / Host | `{}` or throws | **No** — forbidden runtime keys absent |

Core cannot even stringify `JsonValue.Create(NaN|±Infinity)` (STJ throws `ArgumentException`). A `BackupSnapshot` parsed from JSON text therefore cannot contain those values.

**STOP rule:** clone does **not** lose meaningful **current** snapshot data. JSON clone is semantically safe for the ARCH-9B BackupSnapshot. No production assembly change was required or performed.

Residual risk for a later packet: if a future RAM field stored `Date` / `undefined` / `NaN`, JSON clone would coerce. Keep the type-scan test as a gate.

Identity note (not data loss): `svcs` and `services` currently share one RAM array. JSON clone produces **two equal copies**. Content is preserved; the alias is split. That is safer for isolation.

---

## 4. Reference-isolation tests

Isolation is asserted with `===` / `ReferenceEquals`, **not** only `JSON.stringify` equality.

HTML (`test_laegh.js` ARCH-9C group) and Core (`BackupSnapshotCloneTests`):

| Target | After JSON clone |
|---|---|
| top-level arrays (`invoices`, `products`, `warranties`, `phonebook`, `parts`, `sales`, `accounts`, `tasks`, `attachmentsIndex`, `sections`) | `clone[k] !== live[k]` |
| nested objects (`invoices[0]`, `invoices[0].someNested`, `inventory`, `inventory['SKU-1']`, `printCenter`) | distinct references |
| nested arrays (`invoices[0].docs`, `warranties[0].docs`) | distinct references |
| stringify before mutation | equal content, unequal identity |

Core additionally: `BackupSnapshot.Parse(live).Data` is not `ReferenceEquals` the input node.

---

## 5. Nested mutation tests

T1–T11 (HTML + Core). After clone, mutate the clone; original assembly / RAM is unchanged.

| ID | Mutation | Original |
|---|---|---|
| T1 invoices | `clone.invoices.push(...)` | length unchanged |
| T2 nested record | `clone.invoices[0].someNested.value = changed` | `'original-nested'` |
| T3 products | push + rename | unchanged |
| T4 warranties | push + nested serial | unchanged |
| T5 phonebook | push + `fn` | `علی` unchanged |
| T6 parts | push + nested bin | unchanged |
| T7 sales | push + nested total | unchanged |
| T8 accounts | push + nested bal | unchanged |
| T9 nested inventory | qty / bin / new SKU key | RAM map unchanged |
| T10 attachments | `attachmentsIndex.push`, `docs[0].name`, `docs.push` | original index + docs unchanged |
| T11 multi-array | push on 7 collections + `tasks` | original stringify unchanged; `tasks` stays `[]` |

Expected: **ZERO** mutation of original assembly / RAM. Observed: **ZERO**.

---

## 6. Snapshot contract regression (ARCH-9B)

Cloned result still satisfies ARCH-9B:

| Rule | Evidence |
|---|---|
| required arrays present | Schema-1 `warranties` / `invoices` / `sales` / `parts` / `accounts` are arrays |
| `[]` preserved | `tasks: []` survives clone; `itemCounts.tasks === 0` |
| `itemCounts` preserved | 15 keys; counts match array lengths |
| `sections` preserved | catalog 32 names; optional `printCenter` may be 33rd |
| optional `printCenter` | present on typical 51-key fixture; clone keeps it |
| optional `attachmentsIndex` | array; clone keeps it |
| Persian Unicode | `علی` / `فروشگاه سیرمان` / `فاکتور.pdf` / `۱۲` round-trip |
| no browser/runtime handles | `localStorage`, `indexedDB`, `document`, `window`, `chrome`, `webview`, `sirmanHost` absent |
| `BackupValidator.Validate` | Ok on Core populated clone |
| `JsonBackupRepository.TbdMarker` | still `html-backup-engine` |

---

## 7. HTML source unchanged proof

`git diff --exit-code -- Sirman_Final.html Laegh_Final.html desktop/Sirman.Core desktop/Sirman.Desktop` → **clean**.

SHA-256 of both HTML files (identical byte-sync):

```text
ccf20a2d8bd1d1c3135be3ace4d58e9af1597ca5d77280d32384968e8abf9ce4  Sirman_Final.html
ccf20a2d8bd1d1c3135be3ace4d58e9af1597ca5d77280d32384968e8abf9ce4  Laegh_Final.html
```

Frozen SHA-256 of production function **source** (ARCH-9C G1 lock in `test_laegh.js`):

| Function | SHA-256 |
|---|---|
| `_buildFullBackupData` | `5224e91e5e888217d42fa5d557b06e50ebfe982abf18f5ff5f7260083ff2349b` |
| `_safeArr` | `c14ddc772241ede09e95578d561ffa4732d9c51cc439ab5ee85360b875a4590a` |
| `_safeObj` | `9fcac0940a097e4c92bda249b14a91dcf143bb614edae3cfd423035c6df860b7` |
| `exportData` | `aa8f62ed31807362c3ca80e6c58f73bff68f5354d49b76bbfd9c9a76b82bb498` |
| `buildBackupObject` | `f66b0a89313603ae5e70c581e523719056f1a484e8a323423f63e3e69f0150a5` |
| `applyBackupSelective` | `06a395a4e7e89e8d5a032e6210955b071a23c42e064063a86b7f6d0f97444637` |

G2 still requires:

- `_safeArr` body is `return Array.isArray(a)?a:[]`
- `_safeObj` body is live-object return
- `_buildFullBackupData` still has `invoices: _safeArr(invoices)` and **no** `JSON.parse(JSON.stringify`

This packet added tests only: `test_laegh.js`, `desktop/Sirman.Core.Tests/BackupSnapshotCloneTests.cs`, this report.

---

## 8. Full HTML test result

```text
node test_laegh.js Sirman_Final.html
کل تست‌ها: 821
✅ موفق: 821
❌ ناموفق: 0
```

Previous baseline: 801/801. New ARCH-9C group: 20 tests, all PASS. No previous test deleted.

---

## 9. Full Core test result

```text
dotnet test desktop/Sirman.Core.Tests
Passed!  Failed: 0, Passed: 556, Skipped: 0, Total: 556
```

Previous baseline: 538/538. New `BackupSnapshotCloneTests`: 18 tests, all PASS. No previous test deleted.

---

## 10. New test result

**HTML ARCH-9C (20):** live alias (2) + T1–T11 + reference isolation + type scan + hypothetical JSON type table + ARCH-9B clone contract + G1/G2/G3 source locks.

**Core ARCH-9C (18):** T1–T11 + reference isolation + stringify-vs-identity + JSON-only type walk + hypothetical NaN/Infinity incompatibility + `CloneExact` mechanism + ARCH-9B contract on clone + production-source lock against HTML assembly.

All new tests green.

---

## 11. Confirmation — production surfaces unchanged

| Surface | Changed? | Evidence |
|---|---|---|
| production assembly (`_buildFullBackupData`) | **NO** | SHA256 lock + git diff clean |
| live Backup (`exportData` / `buildBackupObject` / Finalizer path) | **NO** | SHA256 lock; still calls `_buildFullBackupData` |
| Restore (`applyBackupSelective` / Merge / Replace) | **NO** | SHA256 + G3; merge/replace functions still present |
| Phonebook | **NO** | `savePBContact` present; no phonebook files edited |
| SQLite | **NO** | no persistence project edits (sidecars in working tree are unrelated and unstaged) |
| `_safeArr` / `_safeObj` | **NO** | still live references |
| Core BackupFinalizer / RestorePlan / validators | **NO** | `desktop/Sirman.Core` git-clean |

Live path remains:

```text
_buildFullBackupData
    ↓  (still live RAM aliases)
Core BackupFinalizer
```

---

## 12. Recommendation for the future production hardening packet

JSON clone is **semantically safe** for the current BackupSnapshot and **isolates** top-level arrays, nested objects, and nested arrays.

A **separate** production packet may:

1. Clone immediately after the object literal in `_buildFullBackupData` (or immediately after the call, before any holder retains the live object):  
   `return JSON.parse(JSON.stringify(data));`  
   Core equivalent already exists: `BackupJsonUtil.CloneExact`.
2. Keep `_safeArr` / `_safeObj` as they are **or** leave them live and clone once at the boundary — one deep clone at the return is enough.
3. Accept that `svcs` / `services` will become two equal copies.
4. Keep the ARCH-9C type-scan + SHA/contract tests as regression gates.
5. **Do not** change Restore apply, Phonebook, SQLite, or Finalizer in that packet unless a later explicit packet says so.
6. **Do not** start ARCH-10 / P1C-8 from that packet.

This ARCH-9C packet stops here. Production clone-on-assemble is **not** implemented.

---

## Q1–Q12

**Q1. Does current `_buildFullBackupData` return live references?**  
YES. `assembly.invoices === invoices`, nested objects and `inventory` alias RAM. `_safeArr` / `_safeObj` return the input.

**Q2. Does the proposed clone isolate top-level arrays?**  
YES. T1/T3–T8/T11 + `clone.invoices !== invoices` / Core `ReferenceEquals` false.

**Q3. Does it isolate nested objects/arrays?**  
YES. T2 nested value, T9 inventory, T10 `docs` / `attachmentsIndex`.

**Q4. Does cloning lose any currently used snapshot data?**  
NO. Type scan is JSON-only. `exportedAt` is already an ISO string. Persian text round-trips. Hypothetical Date/undefined/NaN/bigint losses do not apply to the current snapshot.

**Q5. Does the cloned snapshot satisfy ARCH-9B?**  
YES. 49 base keys, `[]` preserved, `itemCounts` / `sections`, optional `printCenter` + `attachmentsIndex`, Unicode, no runtime handles, `BackupValidator` Ok.

**Q6. Was `_buildFullBackupData` modified?**  
NO. SHA256 `5224e91e…` + git-clean HTML.

**Q7. Was live Backup modified?**  
NO. `exportData` / `buildBackupObject` SHA256 unchanged; still assemble via HTML then Finalizer.

**Q8. Was Restore modified?**  
NO. `applyBackupSelective` SHA256 unchanged; Merge/Replace still HTML.

**Q9. Did live data change?**  
NO. Tests used synthetic sandbox / Core JSON fixtures only.

**Q10. Did Phonebook change?**  
NO.

**Q11. Did SQLite change?**  
NO. No SQLite source edits in this packet.

**Q12. Is production clone-on-assemble ready for a separate implementation packet?**  
YES. Evidence: JSON-safe types + isolation PASS + ARCH-9B contract PASS + production source untouched. Implement clone-on-assemble **only** in a later dedicated packet. Not in ARCH-9C. Not ARCH-10. Not P1C-8.

---

## STOP

ARCH-10 not started. P1C-8 not started. Production clone-on-assemble **not** implemented. `_buildFullBackupData` not modified. Live Backup / Restore / Phonebook / SQLite unchanged.
