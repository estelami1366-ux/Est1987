# ARCH-25 Phonebook Restore Contract

DATE: 2026-09-05  
PRODUCT VERSION: `1405.6.3α` (unchanged)  
BASE: `cursor/arch-24-backup-recovery-closure-audit-fa01`  
TARGET: `cursor/arch-25-phonebook-restore-contract-fa01`

Status: **COMPLETED — PHONEBOOK RESTORE CONTRACT**

This packet is production code/test verification only. No shop data was used. ARCH-26 is not started.

---

## 1. Executive result

Phonebook Restore now follows the ARCH-23/ARCH-24 approved contract (Policy B + Replace missing-key safety).

- Merge skips exact canonical clones, including empty-phone clones.
- Merge still inserts different empty-phone contacts.
- Non-empty `phones[0]` keeps current raw `indexOf` matching. There is no UPDATE.
- Replace clears Phonebook only for explicit `phonebook: []`.
- Missing / null / wrong-type selected Phonebook **KEEP LIVE** and emits a warn toast + debug entry.
- Assembler, `savePBContact`, `collectPhonebookSnapshot`, `collectAttachmentIndex`, ARCH-17/18 adapters, version, Print, SQLite, checksum are unchanged.
- Historical 530-row empty-phone replay stays 530 after four Merges.

## 2. Selected Replace missing-key behavior

**Choice: KEEP LIVE** (not REJECT SECTION).

Reason:

- Preview UI (`openRestorePreviewModal`) disables and unchecks sections with `has:false`. A user cannot select an empty/missing Phonebook from that modal, so `_restoreWants` never enters the branch in the normal preview path.
- `REJECT` by throw would hit `applyBackupSelective` catch and call `applyBackupReplaceSections(safety, null)`, rolling back **all** already-applied sections. That is larger than a Phonebook-only defect.
- `applyAll()` / `selectedKeys == null` still wants every section. That was the wipe hazard. KEEP LIVE stops the wipe.
- The else-branch is not silent: `ntf(..., 'warn')` plus `addDbgEntry('warn', ...)`.
- Overall restore success toast may still fire because other selected sections can apply. Phonebook itself is not claimed as a successful empty restore; the warn names KEEP LIVE.

KEEP LIVE is the smallest behavior supported by the current Restore UI/contract.

## 3. Before/after Merge logic

Before (unsafe for empty-phone clones):

```
entryPhone = (entry.phones && entry.phones[0]) || ''
exists = phonebook.find(p => entryPhone && (p.phones||[]).indexOf(entryPhone) !== -1)
if (!exists) phonebook.push(entry)
```

Empty/missing/null `phones[0]` never matched, so every empty-phone row inserted. Four Merges of 530 clones: 530 → 1060 → 1590 → 2120 → 2650.

After (Policy B):

1. `entryPhone` unchanged.
2. Canonical fingerprint vs live. Exact clone → `SKIP_EXACT_DUPLICATE`.
3. If `entryPhone` non-empty: raw `indexOf` on any live `phones[]` slot → `SKIP_PHONE_MATCH`; else ADD.
4. If empty/missing/null first phone and not an exact clone → ADD.

No UPDATE. Name is not identity. No ID minting. Existing order preserved; new rows append.

## 4. Before/after Replace logic

Before:

```
if (non-empty d.phonebook) assign
else if (non-empty d.pb) legacy convert
else phonebook = []
```

Missing / null / `{}` / `"bad"` / empty `pb` all cleared live Phonebook.

After:

1. Non-empty `d.phonebook` array → REPLACE.
2. Else non-empty `d.pb` → legacy convert/REPLACE.
3. Else explicit `Array.isArray(d.phonebook) && length === 0` → CLEAR.
4. Else KEEP LIVE + warn.

Companion (Phonebook-only) in `migrateBackup` and lockstep `BackupFieldMigrator.MigratePhonebook`: missing/null/wrong-type no longer synthesizes `d.phonebook = []`. Explicit `[]` stays `[]`. No extra migrate log line (ARCH-24 log parity). `d.pb` is assigned only when `phonebook` is an array. Required so `importData` → migrate → Replace can still tell missing from intentional empty. Other Restore sections are unchanged. ARCH-3/ARCH-4 HTML goldens were regenerated from current HTML so Core stays in lockstep.

## 5. Exact fingerprint model

HTML helper `_phonebookCanonicalFingerprint` mirrors the ARCH-23 test-only model:

- `null` / `undefined` → `'null'`
- arrays keep order
- object keys sorted, then `JSON.stringify(key)+':'+recurse`
- primitives via `JSON.stringify`
- no normalization, no omitted fields, no generated ID, no mutation

SHA: `32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15`

## 6. Merge test matrix

| ID | Case | Result |
|---|---|---|
| M1 | unique phone | ADD |
| M2 | exact phone clone | SKIP_EXACT_DUPLICATE (fingerprint first) |
| M3 | exact empty-phone clone | SKIP_EXACT_DUPLICATE |
| M4 | exact missing-phones clone | SKIP_EXACT_DUPLICATE |
| M5 | exact null-phones clone | SKIP_EXACT_DUPLICATE |
| M6 | different empty-phone | ADD |
| M7 | same name, different phone | ADD |
| M8 | same phone, different name | SKIP_PHONE_MATCH, no UPDATE |
| M9 | same phone, different metadata | SKIP_PHONE_MATCH |
| M10 | incoming `phones[0]` in any live slot | SKIP_PHONE_MATCH |
| M11 | `phones[0]===''`, second slot matches live | ADD (identity is `phones[0]` only; same as pre-ARCH-25) |
| M12 | exact empty payload twice | length 1 |
| M13 | two distinct empties repeated | length 2 |
| M14 | order | live then incoming append |
| M15 | unknown fields | preserved |
| M16 | Persian/Arabic | preserved raw |
| M17 | legacy `pb` alias | converted/inserted |

## 7. Replace test matrix

| ID | Case | Result |
|---|---|---|
| R1 | non-empty array | REPLACE |
| R2 | `phonebook: []` | CLEAR |
| R3 | key missing | KEEP LIVE + warn |
| R4 | `null` | KEEP LIVE |
| R5 | `{}` | KEEP LIVE |
| R6 | `"bad"` | KEEP LIVE |
| R7 | legacy non-empty `pb` | legacy REPLACE |
| R8 | legacy `pb` empty/missing | KEEP LIVE (no implicit clear) |
| R9 | order | preserved |
| R10 | duplicates | preserved |
| R11 | empty-phone rows | preserved |
| R12 | unknown fields | preserved |
| R13 | `daqi.agencyPhonebookIdx` | unchanged |

Note: `phonebook: []` plus non-empty `pb` still prefers non-empty `pb` (legacy fallthrough order preserved).

## 8. Idempotency proof

- Exact-duplicate payload: `Merge(P, S)` then `Merge(P, result)` → same length.
- Distinct empty-phone payload: first Merge adds each distinct row; second adds none.
- Mixed payload: second Merge does not grow exact clones.

## 9. 530-row historical replay

Synthetic 530 distinct empty-phone rows (same `fn`, unique `ln`). Start = that payload. Merge four times.

Expected/actual: `530 → 530 → 530 → 530 → 530`

Not: `530 → 1060 → 1590 → 2120 → 2650`

No shop data.

## 10. 40-phone replay

40 unique non-empty `phones[0]` rows: `40 → 40`.

## 11. No-data-loss proof

1. Merge never deletes existing live contacts (they stay in original order; new rows append).
2. Different empty-phone contacts are inserted (M6).
3. Exact empty-phone duplicates are skipped (M3/M12).
4. Explicit Replace `[]` is the only Phonebook clear this packet introduces.
5. Missing/null/wrong-type selected Phonebook does not clear live data.
6. `daqi.agencyPhonebookIdx` is not read or written by Phonebook Merge/Replace.
7. Matching live phones are not rewritten.
8. Matching live names are not rewritten (M8).

## 12. daqi firewall proof

Merge/Replace Phonebook branches contain no `agencyPhonebookIdx`. Tests pass a live `daqi` object through Phonebook-only apply and assert the index stays `1` pointing at the same contact. No remapping added.

## 13. Legacy pb compatibility

Merge still uses:

```
var pbSource = (Array.isArray(d.phonebook) && d.phonebook.length>0) ? d.phonebook : (d.pb||[]);
```

Legacy `name`/`phone` conversion is unchanged. Non-empty `pb` still replaces when `phonebook` is empty/missing. Empty/missing `pb` no longer clears unless explicit `phonebook: []` is present.

## 14. Exact SHA old/new

| Function | Old | New |
|---|---|---|
| `_buildFullBackupData` | `f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41` | unchanged |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` | unchanged |
| `collectPhonebookSnapshot` | `7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c` | unchanged |
| `collectAttachmentIndex` | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` | unchanged |
| ARCH-17 required adapter | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` | unchanged |
| ARCH-18 optional adapter | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` | unchanged |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` | `0505b31f8f46e96dd097294e37c17549c79810b422073f2cc33111cdab90dc49` |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` | `b067f92b2e1bbf60c9d6edcc77dba68b5e839b44c8d0d61ab95967e47426b7af` |
| `_phonebookCanonicalFingerprint` | (new helper) | `32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15` |

Computed from actual `extractFunctionSource` UTF-8 SHA-256. Not predicted.

## 15. Regression results

- HTML `node test_laegh.js Sirman_Final.html` — 1074/1074
- C# `dotnet test desktop/Sirman.Core.Tests` — 838/838

ARCH-23 Core `PhonebookRestoreSafety.MergeProduction` remains a **historical pre-ARCH-25 replica** and is not retargeted to Policy B.

## 16. HTML/Core totals

- HTML `node test_laegh.js Sirman_Final.html`: **1074 / 1074 PASS** (ARCH-24 was 1063; +11 ARCH-25 tests)
- Core `/home/ubuntu/.dotnet/dotnet test desktop/Sirman.Core.Tests`: **838 / 838 PASS** (ARCH-24 was 829; +9 ARCH-25 contract tests)
- Merge matrix: M1–M17 PASS (HTML `ARCH-25 Merge matrix M1-M17` + Core `MergeMatrix_M1_To_M17`)
- Replace matrix: R1–R13 PASS (HTML `ARCH-25 Replace matrix R1-R13` + Core `ReplaceMatrix_R1_To_R13`)
- Idempotency: PASS
- 530-row replay: `530 → 530 → 530 → 530 → 530` PASS
- 40-phone replay: `40 → 40` PASS
- daqi: PASS (`agencyPhonebookIdx` unchanged on Phonebook-only Merge/Replace)

## 17. Files changed

- `Sirman_Final.html` / `Laegh_Final.html` (byte-identical): Phonebook Merge/Replace branches, `_phonebookCanonicalFingerprint`, Phonebook-only `migrateBackup` missing-key companion
- `desktop/Sirman.Core/Backup/BackupFieldMigrator.cs`: Phonebook-only lockstep with HTML migrate (do not invent `[]`)
- `desktop/Sirman.Core.Tests/BackupMigrationGolden.json` / `BackupDryRunGolden.json`: regenerated from current HTML
- `test_laegh.js`: ARCH-25 group; live SHA/replay locks retargeted to the contract
- `desktop/Sirman.Core.Tests/PhonebookRestoreContract.cs`
- `desktop/Sirman.Core.Tests/PhonebookRestoreContractTests.cs`
- `desktop/Sirman.Core.Tests/PhonebookRestoreSafetyTests.cs` (live SHA lock only)
- `desktop/Sirman.Core.Tests/BackupRecoveryClosureAuditTests.cs` (live SHA / Phonebook string lock)
- `deliveries/Reports/ARCH-25_PHONEBOOK_RESTORE_CONTRACT_REPORT.md`

Not changed: assembler `phonebook: _safeArr(phonebook)`, `savePBContact`, Excel import, attachmentsIndex, SQLite, Print, checksum, product version.

## 18. Data-impact statement

No production shop data was read, merged, replaced, or repaired. This packet only changes restore **code** and tests. Existing live contacts are not deleted by Merge. The only new clear is explicit Replace `phonebook: []`.

## 19. Rollback procedure

Revert this branch / restore `applyBackupMergeSections`, `applyBackupReplaceSections`, `_phonebookCanonicalFingerprint`, and the Phonebook else-branch of `migrateBackup` to ARCH-24. Assembler and other Restore sections do not need rollback. After rollback, empty-phone Merge doubling returns.

## 20. Known limitations

- KEEP LIVE still allows `applyBackupSelective` to show a general success toast if other sections applied. Phonebook warn is the section-specific signal. REJECT was rejected because it rolls back everything.
- Identity remains `phones[0]` for non-empty phones. `phones[1+]` matching with empty `phones[0]` ADDs (M11), matching pre-ARCH-25.
- Fingerprint treats `undefined` object values as `'null'`, same as ARCH-23.
- `phonebook: []` with non-empty `pb` still uses legacy `pb` (not a new clear).
- ARCH-22 adapter remains unused by the assembler.
- No shop verification. ARCH-26 is copy-only Recovery Acceptance.

## 21. ARCH-26 readiness assessment

ARCH-26 may start only after this packet’s production tests PASS and the gates below hold. Do not start ARCH-26 from this packet.

Gates:

1. ARCH-25 production tests PASS — HTML 1074/1074, Core 838/838
2. Merge/Replace SHA changes documented — yes (section 14)
3. Assembler SHA unchanged — yes
4. Critical tests PASS — yes
5. 530-row replay stays 530 — yes
6. Different empty-phone contacts preserved — M6
7. Missing Phonebook no longer clears selected Replace — R3 KEEP LIVE
8. Explicit `[]` still clears — R2
9. No production data repair — yes

**ARCH-26 may start after this packet is accepted. This packet stops here. Do not start ARCH-26 in this change.**
