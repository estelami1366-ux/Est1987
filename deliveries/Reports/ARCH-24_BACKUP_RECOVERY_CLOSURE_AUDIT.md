# SIRMAN — ARCH-24 Backup / Recovery Closure Audit

**Date:** 2026-09-05  
**Packet:** System-level closure audit of Backup/Recovery after ARCH-1..ARCH-23. **Audit / planning only.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-24-backup-recovery-closure-audit-fa01`  
**Base:** `cursor/arch-23-phonebook-restore-safety-fa01`  
**Final status:** **COMPLETED — SYSTEM CLOSURE AUDIT**

No production code change. No Restore change. No Phonebook change. No attachment change. No SQLite change. ARCH-25 was **not** started. No shop verification is claimed.

Authority: repository reports ARCH-1..ARCH-23 plus live source in `Sirman_Final.html` and `desktop/Sirman.Core`.

---

## 1. Executive Conclusion

Backup/Recovery is **not** system-complete.

What is true today:

- A single HTML assembler (`_buildFullBackupData`) produces the `SIRMAN_BACKUP` JSON package.
- Settings, required business, and optional business slices are **production-cut over** to adapters with equivalence proofs.
- Exe finalize + SHA-256 checksum, Core validator/migration/dry-run/RestorePlan, and disk pretty-print round-trip exist.
- Live Restore **apply** is still HTML Merge/Replace. Core RestorePlan never applies (`Applied = false`).
- Phonebook is in the backup payload but has **no stable id**. Merge of empty-phone rows is not idempotent. Replace of a selected missing Phonebook section clears to `[]`.
- `attachmentsIndex` is derived metadata. Inline attachment bytes that live on parent `docs[]` travel with JSON. `disk://` / `idb:` media do **not**.
- No copy-only clean-install E2E has been executed. No shop restore is verified.

Self-contained backup result: **PARTIAL**.

Smallest finite remaining work:

1. **ARCH-25 — Phonebook Restore Contract** (production, data-safety).
2. **ARCH-26 — Copy-only Recovery Acceptance** (execute the E2E designed here; no new architecture).

After those two packets pass, the statement `BACKUP / RECOVERY = COMPLETE` becomes valid **with the explicit exceptions in section 13**. Everything else is parked.

---

## 2. ARCH-1..ARCH-23 normalized status

Legend: **GREEN** = phase itself completed. **YELLOW** = phase complete but a downstream system dependency remains. **RED** = system dependency still open that this phase did not close.

Shop column is **No** for every row (this VM / these packets never claimed shop VERIFIED).

| Phase | Scope | Phase status | Production cutover? | Test verified? | Real-shop verified? | System-closure contribution | Remaining dependency | CLOSED? |
|---|---|---|---|---|---|---|---|---|
| ARCH-1 | Extraction map of BackupEngine | GREEN — audit | No | Report + later suites | No | Named the real engine (HTML) vs Host I/O vs Core stub | Extraction still incomplete at Apply | Phase yes / system **YELLOW** |
| ARCH-2 | Core validator extraction | GREEN | No (HTML still restore gate) | Yes (goldens) | No | Fail-closed required collections + structural + portable in Core | Live import still uses HTML validators | Phase yes / system YELLOW |
| ARCH-3 | Core schema migration extraction | GREEN | No | Yes | No | 0→1 + field migrate in Core | Live migrate is HTML | Phase yes / system YELLOW |
| ARCH-4 | Core dry-run façade | GREEN | No | Yes | No | Preview without apply | Not the live preview modal | Phase yes / system YELLOW |
| ARCH-5 | Core serializer / finalizer types | GREEN | No (until ARCH-6) | Yes | No | Package finalize model | Wired in ARCH-6 | Phase yes |
| ARCH-6 | Finalize cutover on exe | GREEN | **Yes** (finalize only) | Yes | No | Authoritative Core finalize when Host present | Assembler remains HTML | Phase yes / system YELLOW |
| ARCH-7 | Host `TestRestoreBackup` dry-run | GREEN | Preview only | Yes | No | Exe can analyze a file without writing | Does not apply | Phase yes / system YELLOW |
| ARCH-8 | Core RestorePlan | GREEN | No apply | Yes | No | Decision DTO; Phonebook excluded | Live apply is HTML | Phase yes / system YELLOW |
| ARCH-9A | Assembler audit | GREEN — audit | No | Report | No | Full `_buildFullBackupData` map | Cutover later slices | Phase yes |
| ARCH-9B | Snapshot contract | GREEN | No | Yes | No | Typed BackupSnapshot | Consumer opt-in | Phase yes |
| ARCH-9C | Clone-on-assemble proof | GREEN — tests | No | Yes | No | Proved alias hazard | ARCH-9D fix | Phase yes |
| ARCH-9D | Production clone-on-return | GREEN | **Yes** (clone only) | Yes | No | Snapshot isolated from RAM | — | Phase yes |
| ARCH-10 | `ConsumeBackupSnapshot` | GREEN | Inspection only; **not** on export | Yes | No | Parse+validate isolated JSON | Unused on export path | Phase yes / system YELLOW |
| ARCH-11 | Disk round-trip | GREEN — tests | No format change | Yes (synthetic) | No | Pretty disk ≠ hashed bytes, reopen works | Not shop files | Phase yes |
| ARCH-12 | Strict stored checksum in Core | GREEN | Core validator overlay | Yes | No | Tampered hex fails Core | HTML `verifyChecksum` already compared | Phase yes |
| ARCH-13 | Snapshot consistency audit | GREEN — audit | No | Report | No | Split-brain LS vs RAM named | Settings adapter | Phase yes |
| ARCH-14 | Settings adapter | GREEN | No (until ARCH-15) | Yes | No | LS settings DTO | Cutover ARCH-15 | Phase yes |
| ARCH-15 | Settings-slice cutover | GREEN | **Yes** (settings keys) | Equivalence T1–T18 | No | Settings from one adapter | `loginPw` / `logoSrc` / `senderInfo` / `acH` / audit still inline | Phase yes / system YELLOW |
| ARCH-16 | Business snapshot audit | GREEN — audit | No | Report | No | Required vs optional vs forbidden | Adapters + cutovers | Phase yes |
| ARCH-17 | Required adapter | GREEN | No (until ARCH-20) | Yes | No | invoices/sales/warranties/parts/accounts/counters | Cutover ARCH-20 | Phase yes |
| ARCH-18 | Optional adapter | GREEN | No (until ARCH-21) | Yes | No | 13 optional keys | Cutover ARCH-21 | Phase yes |
| ARCH-19 | Attachment reference audit | GREEN — audit | No | Yes (fixtures) | No | Index is metadata; parent `id`; no blob copy | Media sidecar / E2E | Phase yes / system **YELLOW** |
| ARCH-20 | Required-slice cutover | GREEN | **Yes** | Equivalence | No | Six required fields from adapter | Phonebook still RAM | Phase yes |
| ARCH-21 | Optional-slice cutover | GREEN | **Yes** | Equivalence | No | 13 optional fields from adapter | Phonebook / ops-inline remain | Phase yes |
| ARCH-22 | Phonebook adapter + identity forensic | GREEN | **No** live cutover | Yes (1050 HTML / 788 Core at the time) | No | Adapter unused; no stable id proven | Restore contract | Phase yes / system **RED** (restore) |
| ARCH-23 | Phonebook Restore safety | GREEN — audit | **No** live fix; decision **B. NOT SAFE YET** | Yes (1059 / 822) | No | Merge/Replace forensics; candidate not wired | ARCH-25 contract | Phase yes / system **RED** |

Do **not** mark the Backup/Recovery **system** complete because 23 phases individually completed.

---

## 3. Current architecture map

```text
BACKUP
Live RAM / localStorage / IndexedDB
    → _buildFullBackupData                 HTML PRODUCTION
         → collectBackupSettingsSnapshot   HTML PRODUCTION (ARCH-15)
         → collectRequiredBusinessSnapshot HTML PRODUCTION (ARCH-20)
         → collectOptionalBusinessSnapshot HTML PRODUCTION (ARCH-21)
         → phonebook: _safeArr(phonebook)  HTML PRODUCTION (adapter unused)
         → loginPw / userRoles / audit /
           senderInfo / logoSrc / acH      HTML PRODUCTION (inline, not adapter)
         → collectAttachmentIndex          HTML PRODUCTION (metadata)
         → itemCounts / sections           HTML PRODUCTION (derived)
         → JSON.parse(JSON.stringify)      HTML PRODUCTION (ARCH-9D)
    → applyBackupFinalizer
         → exe: Host.FinalizeBackup        Core PRODUCTION (ARCH-6)
         → HTML-only: finalizeBackupPackage + attachChecksum
    → JSON.stringify(data, null, 2)        HTML PRODUCTION (pretty disk, not hashed)
    → WriteBackupText / Blob download      Host or browser PRODUCTION
    → optional IDB mirror                  HTML PRODUCTION (third copy)

RESTORE
backup file
    → FileReader / unwrap / decrypt        HTML PRODUCTION
    → validateRequiredBackupCollections    HTML PRODUCTION (Core equivalent unused on this path)
    → structural + portable                HTML PRODUCTION
    → verifyChecksum                       HTML PRODUCTION (SHA-256 compare; skip if no subtle)
    → applySchemaMigrations + migrateBackup HTML PRODUCTION
    → preview modal                        HTML PRODUCTION
    → applyBackupSelective
         → safety snapshot → IDB           HTML PRODUCTION
         → Merge or Replace sections       HTML PRODUCTION
         → sv() / LS / RAM                 HTML PRODUCTION
         → rollback Replace(safety) on throw
    → application state                    HTML PRODUCTION

CORE (beside the live apply path)
    BackupValidator / Migration / DryRun / RestorePlan / SnapshotConsumer
    Host TestRestoreBackup, ConsumeBackupSnapshot
    JsonBackupRepository TbdMarker = html-backup-engine
    → PRODUCTION for finalize+preview+inspect
    → TEST/DESIGN for RestorePlan apply
    → NOT the live Merge/Replace engine
```

| Box | Implementation | Core or HTML | Production or test-only | Complete? |
|---|---|---|---|---|
| Live RAM/LS/IDB SoT | HTML globals + `sv*` | HTML | Production | Complete as current SoT |
| `_buildFullBackupData` | HTML | HTML | Production | Complete as assembler; not extracted to Core |
| Settings adapter | `collectBackupSettingsSnapshot` | HTML + Core DTO | Production (wired) | Complete for its key list |
| Required adapter | `collectRequiredBusinessSnapshot` | HTML + Core DTO | Production (wired) | Complete for six fields |
| Optional adapter | `collectOptionalBusinessSnapshot` | HTML + Core DTO | Production (wired) | Complete for 13 keys |
| Phonebook current path | `_safeArr(phonebook)` | HTML | Production | Payload yes; identity **incomplete** |
| `attachmentsIndex` | `collectAttachmentIndex` | HTML + Core rebuild in Finalizer | Production | Metadata complete; blobs **incomplete** |
| Derived fields | `itemCounts`, `sections`, manifest | HTML + Core finalizer | Production | Complete as derived |
| Finalizer | Core on exe; HTML fallback | Both | Production | Complete |
| Checksum | Canonical SHA-256; pretty disk not hashed | Both | Production | Complete as designed (not disk-byte hash) |
| Backup file write | Host `WriteBackupText` / Blob | Both | Production | Complete |
| File read | HTML `importData` | HTML | Production | Complete for JSON/envelope |
| Validation | HTML gate; Core equivalent | Both | Production HTML; Core for Host preview | Complete for required+structural+checksum |
| Migration | HTML live; Core extracted | Both | Production HTML | Complete as live HTML |
| Dry-run | Host `TestRestoreBackup` | Core | Production preview | Complete as preview |
| RestorePlan | `BackupRestorePlanBuilder` | Core | Test/design (`Applied=false`) | Incomplete as apply engine |
| HTML Merge/Replace | `applyBackup*Sections` | HTML | Production | Functionally live; Phonebook **unsafe** |
| RAM after restore | same globals | HTML | Production | Complete for ID'd collections |
| LS/IDB writes | `sv`, `saveSafetySnapshot` | HTML | Production | Complete; IDB is extra copy not SoT |
| App state | render* | HTML | Production | Complete if RAM filled |

---

## 4. Complete gap inventory

Classification of the 34 inspection items. **Not all require implementation.**

| # | Topic | Class | Evidence | Action |
|---|---|---|---|---|
| 1 | Phonebook Restore contract | **REQUIRED** / HIGH-RISK | ARCH-23: NOT SAFE YET | ARCH-25 |
| 2 | Phonebook Merge idempotency | **REQUIRED** / HIGH-RISK | Empty `phones[0]` always INSERT; 530→2650 synthetic | ARCH-25 Policy B |
| 3 | Replace missing Phonebook → `[]` | **REQUIRED** / HIGH-RISK | `else phonebook = [];` when section selected | ARCH-25 keep-or-reject |
| 4 | `daqi.agencyPhonebookIdx` | HIGH-RISK / **ARCHITECTURAL** | Positional; no id | Park until cleanup; not needed to freeze JSON backup |
| 5 | `attachmentsIndex` | ARCHITECTURAL | Derived; SHA locked | Keep; do not invent a second index |
| 6 | External media files | **REQUIRED** for recoverability (as explicit sidecar) | `disk://` / `idb:` refs, index does not copy bytes | Contract in §6; prove in ARCH-26 |
| 7 | Media self-contained backup | OPTIONAL if sidecar is explicit | Embedding all blobs would change format | Park zip/embed |
| 8 | Remaining HTML Merge/Replace | ARCHITECTURAL | Live engine is HTML; ID'd collections have keys | Park Core apply |
| 9 | RestorePlan vs Apply | ARCHITECTURAL | Plan never applies | Park |
| 10 | Restore storage writes | REQUIRED (already exist) | `sv()` after apply; safety IDB | Prove in ARCH-26; no new code unless gap found |
| 11 | File read/write boundary | REQUIRED (already exist) | Host write; HTML read | Prove round-trip in ARCH-26 |
| 12 | End-to-end restore verification | **REQUIRED** | Never executed copy-only | ARCH-26 |
| 13 | Referential integrity | HIGH-RISK | Parent `id` on warranty/sale/invoice docs; Phonebook has none; daqi index positional | Phonebook/daqi parked except contract; business ids in E2E |
| 14 | itemCounts / sections | REQUIRED (derived) | Assembler still RAM `.length` | E2E compare; no packet unless mismatch |
| 15 | Checksum verification | REQUIRED (already exist) | `verifyChecksum` on import; Core Compare | E2E corrupt file; no new algo |
| 16 | Generated metadata | ARCHITECTURAL | `exportedAt` excluded from hash; manifest rebuilt | Keep current contract |
| 17 | Settings/business snapshot completeness | REQUIRED for listed keys (done) | ARCH-15/20/21 | Inline ops keys still in assembler — see 18–26 |
| 18 | Ops/security outside adapters | ARCHITECTURAL | Still inline, **but present in backup** | Park adapter extraction |
| 19 | `loginPw` | REQUIRED as payload (present) | Restore only if non-empty string | Document; E2E; do not clear live on empty |
| 20 | `senderInfo` | REQUIRED as payload (present) | Replace if object | E2E |
| 21 | `logoSrc` | REQUIRED as payload (present) | Restore if truthy; `disk://` needs folder | Sidecar exception |
| 22 | `acH` | REQUIRED as payload (present) | Restore if object | E2E |
| 23 | `userAuditLog` | OPTIONAL / LEGACY for DoD | In backup; not a business SoT | Park as non-blocking |
| 24 | `bgAuditLog` | OPTIONAL | Same | Park |
| 25 | `userRoles` | REQUIRED as payload (present) | Replace vs merge differ | E2E |
| 26 | `appliedUpdates` / `updatePackages` | ARCHITECTURAL | In settings adapter | E2E; not a data-loss class |
| 27 | IndexedDB package/snapshot | ARCHITECTURAL | Third copy + safety store; not SoT | Document; HTML-only extra |
| 28 | Legacy `pb` alias | LEGACY | Merge/Replace + migrate convert | Keep; covered by tests |
| 29 | Backup version/migration | REQUIRED (exists) | HTML migrate live; Core extracted | E2E old schema fixture |
| 30 | Atomic snapshot consistency | REQUIRED (clone-on-assemble done) | ARCH-9D | E2E freeze source |
| 31 | Corruption detection | REQUIRED (exists) | JSON parse fail; checksum fail; required missing | E2E |
| 32 | Partial/incomplete backup | REQUIRED (exists) | MISSING ≠ EMPTY for required; Phonebook not required | ARCH-25 for optional-section missing |
| 33 | Rollback | REQUIRED (exists) | `applyBackupReplaceSections(safety)` on throw; IDB safety open | E2E; HTML-only IDB |
| 34 | Recovery verification | **REQUIRED** | No acceptance report yet | ARCH-26 |

OUT OF SCOPE for Backup/Recovery closure: SQLite SoT, Print, UI redesign, Host REST, minting Phonebook ids in the same breath as Restore skip (ARCH-23).

---

## 5. Self-contained backup analysis

**Answer: PARTIAL**

A backup **file by itself** cannot restore the complete operational state of SIRMAN onto a clean installation when `disk://` / `idb:` media or a disk-backed logo exist. It **can** restore the JSON business package (required + optional + settings + phonebook payload + inline docs + security/ops fields that are inside the JSON).

| Category | Included in JSON? | Restored by HTML apply? | Verified (automated)? | External dependency? | Final-status requirement? |
|---|---|---|---|---|---|
| Business data (invoices, sales, warranties, parts, accounts, products, inventory, services, tasks, warehouses, daqi*, postal, defective, stockMoves, warehouseDocs) | Yes (adapters + assembler) | Yes Merge/Replace | Slice goldens; **not** clean-install E2E | No | Required |
| Settings (print, company, appearance, sms, tz, network, prefs, aiKeys, printCenter, appliedUpdates) | Yes (ARCH-15) | Yes | T1–T18 equivalence | LS keys only | Required |
| Phonebook | Yes (`_safeArr`) | Yes, but Merge non-idempotent; Replace missing clears | Forensics yes; restore-safe **no** | No | Required after ARCH-25 |
| Attachments/media | Index yes; inline `docs[].data` yes; disk/idb bytes **no** | Inline yes; refs restore as strings | Index fixtures | **Yes** `sirman_media` / IDB | Required as **explicit sidecar**, not as JSON blobs |
| Operational metadata | itemCounts, sections, manifest, schema | Regenerated / copied | Checksum goldens | No | Required |
| Security (`loginPw`, `userRoles`) | Yes | Yes if selected and truthy/array | Unit-ish restore tests exist historically | No | Required payload |
| UI state (last page, skin, density) | Inside `appearance` | Yes | Settings goldens | No | Required as settings |
| External filesystem | No | No | No | Backup folder / media folder | Explicit exception |
| IndexedDB state | Optional mirror + safety | Not the import path | No shop | Browser IDB | Not required for clean exe install |

---

## 6. Recovery contract

Design only. Not implemented.

**Authoritative backup artifact:** one UTF-8 JSON file with `magic: SIRMAN_BACKUP`, `schemaVersion`, `applicationVersion` / `version`, canonical SHA-256 on compact JSON excluding `exportedAt`/`checksum`/`checksumAlgo`, pretty-printed on disk.

**Must be inside it:** required collections for that schema; optional business arrays present as arrays (empty allowed); phonebook array; settings slice; security/ops fields that the assembler already emits; `attachmentsIndex` derived; `itemCounts`/`sections`/`manifest`.

**May remain external:** bytes behind `disk://` and `idb:` references; the Windows backup directory itself; IndexedDB safety copies.

**How external media is packaged:** not zipped into JSON. Recoverable set = JSON file **plus** the `sirman_media` (or documented backup-folder) tree copied beside it. Clean-install copies both. This is the declared exception, not a defect to “fix” by embedding megabytes of data URLs.

**Integrity:** `verifyChecksum` fail-closed when a SHA-256 claim is present and `crypto.subtle` exists. Unknown algo fails. Missing checksum on old files may skip (legacy). Core Host dry-run uses the same digest compare.

**Required section missing:** restore **stops** (MISSING ≠ EMPTY). Do not fill `[]`.

**Malformed section:** structural validator fail-closed before migrate.

**Checksum fail:** restore stops.

**Orphaned attachment refs:** index may list them; restore does not delete parents. E2E reports orphans; it does not auto-delete.

**Migration changes identity:** schema 0→1 may fill derived index if falsy; it must not mint Phonebook ids. If a future identity migration is proposed, it needs its own gate.

**Partial restore:** user-selected checkboxes. Unselected sections stay live. Selected Phonebook with **absent key** must not mean `[]` after ARCH-25 (keep or reject). Selected Phonebook with explicit `[]` means clear (intentional).

**Rollback:** pre-restore safety snapshot (RAM clone saved to IDB when available). On throw, `applyBackupReplaceSections(safety, null)`. Operator can open last safety. Clean-install has no prior safety — rollback is “do not apply”.

**Success proof:** ARCH-26 acceptance report: source vs restored snapshot compare, counts, checksum, no duplicate growth on repeat Merge, corrupt file rejected.

---

## 7. Final data-safety acceptance criteria

| ID | Criterion | PASS condition | Evidence | Auto/manual | Blocking? |
|---|---|---|---|---|---|
| A | Backup generation | `_buildFullBackupData` emits required+optional+settings+phonebook+ops keys; clone isolated | HTML/Core goldens + SHA lock | Auto | YES |
| B | Backup integrity | Claimed SHA-256 matches canonical digest; pretty disk does not have to match digest | ARCH-11/12 + import gate | Auto | YES |
| C | Backup portability | File copied outside app dir still parses and validates | ARCH-26 copy step | Auto | YES |
| D | Required collections | Missing warranties/invoices (and schema-1 sales/parts/accounts) fail-closed | P1C + importData | Auto | YES |
| E | Optional collections | Present after restore; empty array ≠ missing required | ARCH-21 goldens + E2E | Auto | YES |
| F | Phonebook | Payload round-trips; Merge of exact clone does not grow; missing section does not wipe | ARCH-25 then E2E | Auto | YES |
| G | Attachments/media | Inline docs round-trip; disk refs listed; sidecar files copied when present | ARCH-19 + E2E | Auto + copy | YES (sidecar explicit) |
| H | Restore Replace | Selected sections replaced; unselected preserved; required missing still fail-closed | HTML apply tests + E2E | Auto | YES |
| I | Restore Merge | ID'd collections skip existing ids; Phonebook Policy B after ARCH-25 | Tests + E2E | Auto | YES |
| J | Migration | Old schema fixture restores without crash; fills allowed defaults only | ARCH-3 goldens + E2E | Auto | YES |
| K | Referential integrity | warranty/sale/invoice `docs` keep parent `id`; no silent drop | E2E | Auto | YES |
| L | Post-restore counts | `itemCounts` vs array lengths match source | E2E | Auto | YES |
| M | Post-restore checksums | Re-export digest of payload (excluding exportedAt) matches source payload digest | E2E | Auto | YES |
| N | No unexpected data loss | Source minus declared exceptions ⊆ restored | E2E diff | Auto | YES |
| O | No duplicate growth | Second Merge of same file does not grow ID'd collections or Phonebook exact clones | E2E | Auto | YES |
| P | Idempotent repeat restore | Merge twice = Merge once for exact payload | E2E | Auto | YES |
| Q | Rollback | Forced apply throw restores safety snapshot | Instrumented test | Auto | YES |
| R | Clean-install restore | Empty dest + JSON (+ sidecar) → comparable state | ARCH-26 | Auto | YES |
| S | End-to-end comparison | Frozen source snapshot vs restored snapshot | ARCH-26 report | Auto | YES |

---

## 8. Final E2E test design

**Do not execute against a real shop.** Copy-only environment.

Name: **Recovery Acceptance Harness (RAH)** — synthetic dataset in repo fixtures, temp directories, no `lb` of a shop.

Flow:

1. Create known source dataset (required + optional + phonebook with mixed empty/normal phones + one inline doc + one `disk://` file in a temp media dir + settings + loginPw/roles).
2. Export complete backup via `_buildFullBackupData` + finalizer (HTML sandbox or exe Host if present).
3. Freeze source snapshot (canonical JSON clone).
4. Copy backup JSON **and** media sidecar outside the app directory.
5. Create clean destination (empty RAM/LS).
6. Restore Replace of all sections.
7–14. Validate required, optional, Phonebook, attachments/media refs, parent ids, counts, settings, loginPw/roles.
15. Compare source vs restored (exclude `exportedAt` / checksum timestamps).
16. Repeat Merge of the same file on the restored dest.
17. Confirm no duplicate growth.
18. Restore a mutated checksum copy → must fail.
19. Restore with a thrown apply after safety snapshot → rollback.
20. Write `deliveries/Reports/ARCH-26_RECOVERY_ACCEPTANCE_REPORT.md`.

Not in this packet. ARCH-26 executes it **after** ARCH-25 so Phonebook Merge/Replace contract is the one under test.

---

## 9. Finite closure roadmap

Not an infinite ARCH-27+ series.

| Packet | Name | Exact scope | Blocker addressed | Dependencies | Production impact | Risk | Acceptance | Evidence | Why necessary |
|---|---|---|---|---|---|---|---|---|---|
| **ARCH-25** | Phonebook Restore Contract | Production Merge: Policy B only (skip canonical exact clones including empty-phone clones; still INSERT different empty-phone rows). Production Replace: if Phonebook **section selected** and `phonebook`/`pb` **key absent or non-array**, **do not assign `[]`** (keep live or reject the section). Explicit `phonebook: []` still clears. No ids, no reorder, no daqi remap, no name identity, no candidate CONFLICT withhold. | ARCH-23 empty-phone growth + missing-section wipe | ARCH-23 forensics | **Yes** Merge+Replace SHA will change | High | Goldens: empty clone 2nd merge no growth; unique empty still inserts; missing key keeps live; `[]` clears; SHA/docs | HTML+Core tests + report | Only remaining **correctness** hole in live Restore |
| **ARCH-26** | Copy-only Recovery Acceptance | Execute §8 harness. No architecture. No SQLite. No Print. Document sidecar media. | Never-run E2E; cannot declare COMPLETE | ARCH-25 | No production behavior unless a real bug is found (then stop and gate) | Medium | Checklist A–S | Acceptance report + test counts | Definition of Done requires proof, not more adapters |

No ARCH-27 is planned. If ARCH-26 finds a **new** required defect, that defect becomes a hotfix packet with its own gate — not a standing program.

Parked (not in the finite set): Core Merge/Replace apply, assembler extraction, Phonebook adapter cutover, Phonebook ids, daqi remap, media zip, ops-field adapters, `JsonBackupRepository` activation, P1C-8-as-undefined, ConsumeBackupSnapshot on export.

---

## 10. Closure dependencies

```text
ARCH-1..21  (assembler slices, finalize, checksum, clone)     DONE
ARCH-22..23 (phonebook facts, restore forensics)              DONE
ARCH-24     (this closure plan)                               DONE
    → ARCH-25 Phonebook Restore Contract                      REQUIRED
        → ARCH-26 Copy-only Recovery Acceptance               REQUIRED
            → BACKUP / RECOVERY = COMPLETE                    (with §13 exceptions)
```

ARCH-25 must precede ARCH-26. ARCH-26 must not start if ARCH-25 is BLOCKED.

---

## 11. Stop-doing list

Supported by current architecture evidence — do **not** pursue these before closure:

- Extracting `_buildFullBackupData` into Core
- Wiring `collectPhonebookSnapshot` just for symmetry
- Implementing Core Merge/Replace apply / RestorePlan execution
- Activating `JsonBackupRepository`
- Minting Phonebook `PB-` ids
- daqi index remap without identity
- Embedding all media into JSON / new zip format
- SQLite migration of live SoT
- Print / Print Center changes (frozen)
- UI redesign, appearance refactors
- Performance work on JSON.stringify
- Cosmetic HTML splits
- Checksum-of-pretty-disk-bytes redesign
- Network/REST backup transport
- Infinite ARCH-27+ “improvements”

---

## 12. Definition of Done

`BACKUP / RECOVERY = COMPLETE` means all of the following, and **not** “every theoretical improvement is done”:

1. All required backup data is in the JSON artifact (required + optional + settings + phonebook + inline docs + listed ops/security fields).
2. Integrity is proven (canonical SHA-256; fail-closed on mismatch when claimed).
3. Restore is safe: required missing fails; Phonebook Merge does not clone-grow; Phonebook Replace does not wipe on a missing key.
4. Known corruption class (broken JSON, bad checksum, missing required) is rejected.
5. External media is explicit (`disk://` / sidecar folder) and recoverable by copying that folder.
6. Repeat Merge of the same file does not grow exact duplicates.
7. Clean-install restore of JSON (+ sidecar) matches frozen source on the acceptance compare.
8. Rollback path exists (safety snapshot) and is demonstrated on a forced failure.
9. ARCH-26 E2E report is PASS.

---

## 13. Final closure gate

The sentence **BACKUP / RECOVERY = COMPLETE** becomes valid when ARCH-25 and ARCH-26 are PASS and §12 holds.

**Exceptions (must stay explicit, not silent):**

- Not shop-VERIFIED unless a later human shop restore is recorded.
- Pretty-print disk bytes are not the hash input (canonical compact JSON is).
- `crypto.subtle` unavailable → checksum may skip (legacy HTML-only).
- IndexedDB mirror is extra, not required on clean exe install.
- Audit logs are best-effort payload, not a business invariant.
- Core RestorePlan still does not apply; HTML remains the apply engine.
- Phonebook still has no stable id; daqi remains positional — **cleanup/dedup stays forbidden** after COMPLETE unless a new identity packet is authorized.
- External media bytes are not inside the JSON file.

---

## 14. Current blockers

1. Phonebook Merge empty-phone non-idempotency (live).
2. Phonebook Replace missing/non-array → `[]` when section selected (live).
3. Copy-only clean-install E2E never executed.
4. External media recoverability not proven (only documented).

Non-blockers (parked): Core apply, SQLite, Print, id minting, adapter leftover inline keys (they already serialize).

---

## 15. Current green items

- ARCH-1..ARCH-21 phase completion as mapped in §2.
- Settings / required / optional **production** cutovers with goldens.
- Clone-on-assemble.
- Exe finalize + checksum attach.
- HTML import fail-closed for required collections, structural integrity, checksum (when claimed).
- Safety snapshot + rollback-on-throw.
- Attachment index metadata locked.
- Phonebook adapter present and **unused** (safe).
- Product version `1405.6.3α`.
- Print frozen; SQLite unused as SoT.

---

## 16. Test results

Filled after the suite run on this packet:

| Suite | Result |
|---|---|
| `node test_laegh.js Sirman_Final.html` | *pending run* |
| `/home/ubuntu/.dotnet/dotnet test desktop/Sirman.Core.Tests` | *pending run* |

New tests: ARCH-24 SHA/restore-path/self-contained locks only. No production behavior tests that require source edits.

---

## 17. Regression locks

| Symbol | SHA-256 |
|---|---|
| `_buildFullBackupData` | `f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41` |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` |
| `collectAttachmentIndex` | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` |
| `collectRequiredBusinessSnapshot` | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` |
| `collectOptionalBusinessSnapshot` | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` |
| `collectPhonebookSnapshot` | `7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c` |

`collectPhonebookSnapshot` remains unused by `_buildFullBackupData`. RestorePlan remains `Applied = false`. Product version unchanged.

---

## 18. Files changed

| File | Role |
|---|---|
| `deliveries/Reports/ARCH-24_BACKUP_RECOVERY_CLOSURE_AUDIT.md` | This report |
| `desktop/Sirman.Core.Tests/BackupRecoveryClosureAuditTests.cs` | SHA + architecture locks |
| `test_laegh.js` | ARCH-24 HTML lock group |

**Unchanged:** `Sirman_Final.html`, `Laegh_Final.html`, Core production Backup types, Host apply path, SQLite, Print, checksum implementation, version.

---

## 19. Data-impact statement

No live data, backups, Phonebook, attachments, or Restore defaults were modified. This packet cannot lose shop data because it does not run Restore or rewrite storage.

---

## 20. Rollback

Remove the ARCH-24 report and the ARCH-24 tests. Production needs no rollback.

---

## 21. Exact recommendation for ARCH-25

**Start ARCH-25 next. Do not start ARCH-26 in the same packet.**

ARCH-25 is the Phonebook Restore Contract:

1. Merge Policy B only (exact canonical clone → skip; different empty-phone → insert).
2. Replace: missing/non-array Phonebook payload + section selected → keep live or reject; explicit `[]` still replaces with empty.
3. Do not mint ids, remap daqi, reorder, or withhold unique empty-phone rows.
4. Update Merge/Replace SHA locks with evidence.
5. Stop. Leave E2E to ARCH-26.

If ARCH-25 cannot prove no unique-contact loss, remain **NOT SAFE YET** and do **not** declare Backup/Recovery complete.
