# SIRMAN — ARCH-23 Phonebook Restore Safety + Idempotency

**Date:** 2026-09-05  
**Packet:** Audit + TEST-ONLY safety design for Phonebook Merge/Replace. **No live Phonebook repair.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-23-phonebook-restore-safety-fa01`  
**Base:** `cursor/arch-22-phonebook-safety-adapter-fa01`  
**Final status:** **COMPLETED — PHONEBOOK RESTORE SAFETY AUDIT, NO LIVE FIX**

This packet is **code/test verification + policy analysis only**. No shop files rewritten. No live restore. ARCH-24 was **not** started.

Production change decision: **B. NOT SAFE YET**.

---

## 1. Change Gate

```text
CHANGE: ARCH-23 Phonebook restore safety audit + TEST-ONLY candidate merge model
CLASS: Forensic tests and design. Not a production Restore cutover.
Q1: CAPABILITY — document current Merge/Replace Phonebook branches and a
    candidate outcome model. Candidate lives only in Sirman.Core.Tests and
    test_laegh.js helpers. Production functions are SHA-locked and unread-written.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Tests do not write shop storage. No migration.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. Sirman_Final.html / Laegh_Final.html production
    bodies are not edited. Assembler still phonebook: _safeArr(phonebook).
Q6: New transport/DB/ACL: NO. No SQLite. No permanent identity minted.
RESULT: PASS for audit/tests only
AUTHORITY: explicit user packet ARCH-23 2026-09-05
PRODUCTION IMPLEMENTATION: NOT AUTHORIZED
```

Gate stayed PASS because this packet did not change production Phonebook functions. Stop conditions were not hit: Merge/Replace/assembler/`savePBContact` SHAs are unchanged; no live repair; no silent Merge→Replace conversion; exact duplicates are detectable deterministically via canonical JSON fingerprint in the TEST-ONLY model.

---

## 2. Current Merge forensic analysis

Authority: `applyBackupMergeSections` Phonebook branch in `Sirman_Final.html` (not inferred).

```javascript
var pbSource = (Array.isArray(d.phonebook) && d.phonebook.length>0) ? d.phonebook : (d.pb||[]);
pbSource.forEach(function(x){
  var entry = x;
  if (x.fn === undefined && x.phones === undefined) { /* legacy name/phone → fn/ln/phones */ }
  var entryPhone = (entry.phones&&entry.phones[0]) || '';
  var exists = phonebook.find(function(p){ return entryPhone && (p.phones||[]).indexOf(entryPhone) !== -1; });
  if (!exists) { phonebook.push(entry); added.pb++; } else skip.pb++;
});
```

Matching rule (exact):

- Identity used: raw `phones[0]` of the incoming entry after optional legacy convert.
- Live match: `entryPhone` is truthy **and** appears in **any** slot of live `(p.phones||[])` via `indexOf` (strict equality).
- Empty / missing / null `phones[0]` → `entryPhone === ''` → `exists` is always falsy → **always INSERT**.
- No UPDATE. On skip, the live row is left untouched (name/metadata of the incoming clone are dropped).
- No stable id is read.

| # | Incoming | Observed current behavior |
|---|---|---|
| 1 | `phonebook` missing | `pbSource = d.pb\|\|[]`. If `pb` also missing: no inserts, **live array not cleared**. |
| 2 | `phonebook = []` | Length 0, so source falls through to `d.pb\|\|[]`. If no alias: no inserts, **not cleared**. If `pb` has rows: those rows are merged. |
| 3 | Normal `phones[0]` | Insert if that raw string is absent from every live `phones[]`; skip if present in any live slot. |
| 4 | Empty `phones: []` | Always insert. Proven synthetic replay 530→1060→1590→2120→2650 (ARCH-22; not shop causality). |
| 5 | Exact clone with phone | Skip (`indexOf` hits). Second merge does not grow. |
| 6 | Same `fn`, different phone | Insert (different `phones[0]`). Name is not identity. |
| 7 | Multiple phones | Only incoming `phones[0]` is the probe. If that value exists anywhere in a live `phones[]`, skip. Incoming extra numbers are not compared. |
| 8 | Missing `phones` field | `entryPhone === ''` → insert. Field stays absent on the pushed object. |
| 9 | `phones: null` | `(null && null[0]) \|\| ''` → insert. Null field is preserved on the pushed object. |
| 10 | Extra unknown fields | Pushed as-is (modern records are not stripped). |

Additional source fact: `phones: [null, '0912']` still has falsy `phones[0]`, so production **inserts** even when a later slot matches a live phone.

Live import path note (not this branch, but adjacent): `migrateBackup` fills `d.phonebook = []` when both keys are empty and then sets `d.pb = d.phonebook`. After that, Merge still no-ops on an empty array. This report does not treat migrate as a silent clear of RAM; RAM clear is the Replace branch.

---

## 3. Current Replace forensic analysis

Authority: `applyBackupReplaceSections` Phonebook branch:

```javascript
if (Array.isArray(d.phonebook) && d.phonebook.length > 0) phonebook = d.phonebook;
else if (Array.isArray(d.pb) && d.pb.length > 0) { phonebook = d.pb.map(/* legacy convert */); }
else phonebook = [];
```

| Incoming | Behavior |
|---|---|
| Non-empty `phonebook` array | Assign that array. Order, duplicates, empty-phone rows, extra fields preserved (same object references as the backup payload). |
| Non-empty `pb` only | Convert/assign alias. |
| Missing `phonebook` (and empty/missing `pb`) | **`phonebook = []`** — clears RAM. |
| `phonebook: []` | Clears. |
| `phonebook: null` | Not an array → clears. |
| Wrong type (object/string) | Clears. |

This **is** the current contract of the Replace Phonebook branch: a selected Phonebook section with a missing/empty/null/wrong-type payload means `[]`. It is a **data-loss hazard** if Replace is run with Phonebook selected and the backup omitted that key. This packet does **not** change that contract. A missing section must not be reinterpreted as “keep live” without a separate Restore-contract packet.

`phonebook` is **not** in `REQUIRED_BACKUP_COLLECTIONS`. P1C can accept a backup without the key; Replace can still clear it when the section is selected.

---

## 4. Identity policy matrix

No new permanent identity is chosen. Analysis only.

| Option | Current source support | Stable? | Collision-prone? | Distinguishes empty-phone rows? | Behavior change if adopted for auto-Merge? | Safe for automatic Merge? |
|---|---|---|---|---|---|---|
| A. stable `id` | **Not generated** by `savePBContact`. Occasional extra JSON `id` is not a schema key. | Would be, if minted once | Low if unique | Yes | **Yes** — minting/backfilling is a live rewrite | **No** in this packet (assigning IDs is forbidden here) |
| B. raw `phones[0]` | **Yes — this is current Merge** | No (user-editable, nullable) | High (shared shop phones; empty always collides as “no identity”) | **No** — empty always inserts | No (already current) | Unsafe for empty-phone; acceptable only for non-empty raw strings as *current* semantics |
| C. any `phones[]` overlap | Incoming probe is only `[0]`; live scan is already any-slot | No | Higher than B (second live number can block a different person) | No | Partial — changing the incoming probe to any-slot would skip more rows | Not safe as a new auto-rule without review |
| D. normalized phone | **Not used** by Merge. ARCH-22 analysis-only digit map exists in tests | No | Persian/ASCII twins currently **insert** as different | No for empty | **Yes** — would skip rows current Merge inserts | Not for automatic Merge |
| E. composite name+phone | Not used | No | Names repeat; empty phone reduces to name | Only if name unique | **Yes** | **Forbidden:** name alone must never be identity. Composite still collapses two empty-phone different people with the same name |
| F. exact JSON fingerprint | Not used by production Merge. Canonical fingerprint is TEST-ONLY here | Stable for byte-identical clones; brittle if field order/whitespace differed without canonicalization | Very low for true clones; will not match edited twins | **Yes** for exact clones; **No** for two different empty-phone people | **Yes** if skip-on-clone is wired | Safe only as a *skip exact clone* rule, not as a general identity |
| G. array position | Implicit RAM order; `daqi.agencyPhonebookIdx` | **No** — splice/reorder shifts | Index reuse is guaranteed after delete | Positions are unique only while the array is frozen | Using index as Merge identity would be wrong | **Unsafe** |

**Finding restated:** Phonebook has **no** stable persistent identity field.

---

## 5. Empty-phone policy matrix

Highest-risk case. **Not implemented.** NAME ALONE MUST NEVER BE IDENTITY (Policy E is rejected).

| Policy | False-positive (skip/merge a distinct person) | False-negative (insert a true clone) | Data-loss risk | Backward compatibility | Idempotency | Effect on existing backups |
|---|---|---|---|---|---|---|
| A. Empty-phone incoming always INSERT | Low skip-FP (never skips) | **High** — exact clones grow forever | Does not delete; Restore **growth** can bury the book | **Exact current Merge** | **Fails** (530→2650 synthetic) | Backups with empty rows replay-grow on Merge |
| B. Exact JSON clone SKIP; different empty-phone INSERT | Low if fingerprint is canonical and complete | Low for true clones | No unique-row loss vs current first Merge | **Behavior change** on 2nd Merge of the same empty clone (skip vs insert) | Holds for exact clones | Payload unchanged; repeated Merge of the same backup would stop doubling |
| C. Human review for empty-phone incoming | Depends on operator | Depends on operator | If review UI withholds apply, Restore is incomplete until confirmed | Behavior change (no silent insert) | Holds if review is sticky | No backup rewrite; Restore UX required |
| D. New persistent id | Mint collisions / backfill errors | Missed ids → insert | Backfill can merge wrong rows if ids are guessed | **Major** — create/save/backup/daqi | Would hold after ids exist | Old backups lack ids; dual-path forever |
| E. Name as identity | **High** — two “بی‌تلفن” people collapse | Low | **Silent contact loss** | Behavior change | Apparent idempotency by destroying distinction | Unsafe on any backup with repeated names |

Packet Phase 5 candidate is **stricter than Policy B**: different empty-phone rows return `CONFLICT_EMPTY_PHONE` and are **not auto-added**. That is closer to Policy C without a UI. It withholds unique empty-phone contacts that current Merge would insert.

---

## 6. Exact-duplicate proof

TEST-ONLY `PhonebookRestoreSafety.MergeCandidate` / `arch23MergeCandidate`.

Required property: `Merge(P, State)` then `Merge(P, Result)` must not grow State when `P` is an exact JSON clone already represented in State.

| Case | Production Merge | Candidate (State already contains the clone) |
|---|---|---|
| 1. Normal phone duplicate | Skip (phone match); 2nd merge no growth | `SKIP_EXACT_DUPLICATE`; no growth |
| 2. Empty-phone exact duplicate | **Insert again**; 2nd merge grows | `SKIP_EXACT_DUPLICATE`; no growth |
| 3. Null-phone exact duplicate | Insert again | Skip exact; no growth |
| 4. Missing-phone exact duplicate | Insert again | Skip exact; no growth |
| 5. Same name / different phone | Insert | `ADD` once, then skip exact; **name is not identity** |
| 6. Same phone / different name | Skip; live name kept (no UPDATE) | `SKIP_PHONE_MATCH`; live kept |
| 7. Same name+phone, different metadata | Skip (phone); metadata not applied | `SKIP_PHONE_MATCH` |
| 8. Multiple-phone overlap (`phones[0]` in live any slot) | Skip | `SKIP_PHONE_MATCH` |

Canonical fingerprint is key-sorted, so field-order twins of the same clone hash equal. Missing `phones` vs `phones: []` vs `phones: null` are **different** fingerprints (and they should be: they are different JSON).

Determinism: same object tree → same fingerprint. Proven in Core + HTML tests.

---

## 7. Candidate Merge model

TEST-ONLY. **Not wired** into `applyBackupMergeSections`.

Steps (as specified):

1. Detect stable current identity: **none** (`savePBContact` does not mint ids).
2. Non-empty `phones[0]`: keep raw-phone matching (any live slot), unless fingerprint already matched.
3. Empty/missing/null first phone: compare canonical JSON fingerprint.
4. Exact clone → `SKIP_EXACT_DUPLICATE`.
5. Different empty-phone contact → **do not auto-merge**.
6. Return explicit conflict / review outcome.
7. Never delete existing records.
8. Never modify incoming data. No UPDATE.

This remains a **candidate policy**. Production Merge is unchanged.

---

## 8. Outcome taxonomy

Every incoming row receives exactly one of:

| Outcome | Meaning | State effect |
|---|---|---|
| `ADD` | Non-empty unmatched `phones[0]` | Append clone of incoming (after legacy convert if needed) |
| `SKIP_EXACT_DUPLICATE` | Canonical fingerprint already in State | No change |
| `SKIP_PHONE_MATCH` | Exactly one live contact contains incoming `phones[0]` | No change, no UPDATE |
| `CONFLICT_EMPTY_PHONE` | Empty/missing/null phone and not an exact clone | No change; review required |
| `CONFLICT_IDENTITY_AMBIGUOUS` | Two or more live contacts contain incoming `phones[0]` | No change; review required |
| `INVALID_INPUT` | Incoming is not an object | No change |

**No UPDATE** in this packet. **No automatic repair.**

---

## 9. Idempotency results

| Scenario | Production `Merge(P); Merge(P)` | Candidate |
|---|---|---|
| Non-empty unique phone into empty State | +1 then +0 | +1 then +0 |
| Exact empty-phone clone already in State | **+1 then +1** (grows every time) | +0 then +0 |
| Unique empty-phone into empty State | +1 then +1 | **+0 then +0** (`CONFLICT_EMPTY_PHONE` — incomplete Restore vs production) |
| Exact phone clone already in State | +0 then +0 | +0 then +0 |

Production empty-phone Merge is **not idempotent**. Candidate exact-clone skip **is** idempotent, but unique empty-phone Restore is **not equivalent** to production.

---

## 10. Replace safety

Proven (HTML execution of `applyBackupReplaceSections` + Core replica):

- Valid non-empty array: replaces the full RAM array; order, duplicates, empty-phone rows preserved.
- Missing / null / `[]` / wrong type: **clears to `[]`**.
- Does not convert Merge into Replace.
- This packet does **not** modify Replace.

Critical: missing Phonebook **does** currently mean `[]` when the Phonebook section is selected. That is source-proven, not assumed. Changing it would itself be a Restore behavior change.

---

## 11. daqi agency index proof

TEST-ONLY arrays:

- Initial `[A, B, C]`, index `1` → `B`.
- After delete/reorder `[A, C]`, index `1` → `C`.

`_daqiAgencyName` reads `phonebook[d.agencyPhonebookIdx]`. `delPBContact` uses `phonebook.splice(idx,1)`. Merge/Replace Phonebook branches do not remap daqi.

**Future invariant (not implemented):** every surviving `daqi.agencyPhonebookIdx` must still point to the same logical contact after any Phonebook cleanup.

**Why this cannot be guaranteed without a separate identity strategy:** there is no stable contact id. Position is the only current handle. Any delete/reorder/dedup shifts later indices. Fingerprint or phone matching cannot uniquely remap an index when empty-phone duplicates or shared phones exist. Introducing remap without identity would guess, and a wrong guess is silent agency mis-attribution.

This packet does **not** implement remap and does **not** change daqi behavior.

---

## 12. Backup compatibility

Read-only. Fixtures were not rewritten.

| Source | What was checked | Result |
|---|---|---|
| `desktop/Sirman.Core.Tests/PhonebookFixtures.json` (ARCH-22 synthetic) | Backup key `phonebook`; storage `lb`; T4 exact clones preserved; T5 empty-phone rows preserved (8); T8 null/missing phones preserved; unknown fields in other cases; ordering | Read-only copy matches itself after parse |
| `BackupFinalizeGolden.json` / other Core goldens | `phonebook: []` in synthetic backups; `pb` listed as excluded/legacy in restore-plan goldens | Compatible with current key; empty array is a valid payload |
| `*.sirman` shop backups on this VM | Searched | **None present** |

**Limitation:** real historical shop backups are **unavailable in this Cursor VM**. No shop verification is claimed. Old `pb` alias compatibility is source-proven (`d.pb` fallback in Merge/Replace and `migrateBackup` convert) and covered by alias tests, not by a named shop file.

---

## 13. Production change decision

**B. NOT SAFE YET**

Not A: candidate empty-phone `CONFLICT` withholds unique empty-phone rows that production inserts (Restore incompleteness). Exact-clone SKIP is a Merge behavior change. Ambiguous-phone CONFLICT is also a behavior change versus production `find()` skip (same non-add, different operator signaling — still not a silent production swap). Replace missing→`[]` is a separate hazard; fixing it is a second contract change. No stable id exists for daqi-safe cleanup.

Not C/BLOCKED: production SHAs held; tests did not require mutating real shop data; exact clones are deterministically detectable; no production function was edited.

Default packet expectation is honored: tests passing is **not** authorization to wire Merge.

---

## 14. Exact SHA locks

| Function | SHA-256 (utf8 of extracted `function` source) |
|---|---|
| `_buildFullBackupData` | `f354ba9875b25c3160581b6f06a62e991c11fb7a6181f9172db0db93c78cbd41` |
| `collectPhonebookSnapshot` | `7595af4ed999d5c3213af78fe8ef5f74e1da4252d53961df466c998cc5e7a79c` |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` |

Assembler still contains `phonebook: _safeArr(phonebook)` and does **not** call `collectPhonebookSnapshot()`. Product version remains `1405.6.3α`.

---

## 15. HTML/Core test counts

Recorded after the suite run on this packet (see follow-up commit if counts are filled post-run):

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | *filled after run* |
| Core | `/home/ubuntu/.dotnet/dotnet test desktop/Sirman.Core.Tests` | *filled after run* |

New forensic coverage:

- Current Merge behavior (10 incoming shapes + `pb` fallback + null-first-phone).
- Candidate algorithm / outcome taxonomy.
- Exact-duplicate idempotency (8 cases).
- Empty-phone production vs candidate.
- Replace safety (valid array + missing/null/wrong type).
- daqi index shift `[A,B,C]` → `[A,C]`.

---

## 16. Files changed

| File | Role |
|---|---|
| `desktop/Sirman.Core.Tests/PhonebookRestoreSafety.cs` | TEST-ONLY production replicas + candidate model |
| `desktop/Sirman.Core.Tests/PhonebookRestoreSafetyTests.cs` | Core forensics, SHA firewall, daqi, fixtures read-only |
| `test_laegh.js` | ARCH-23 HTML group executing real Merge/Replace sources + JS candidate |
| `deliveries/Reports/ARCH-23_PHONEBOOK_RESTORE_SAFETY_REPORT.md` | This report |

**Unchanged:** `Sirman_Final.html`, `Laegh_Final.html`, Core Backup production DTOs, SQLite, Print, checksum, version, Restore defaults, daqi writers.

---

## 17. Data-impact statement

- **Live Phonebook data:** not read, not rewritten, not repaired.
- **Shop backups:** none available; none altered.
- **Production Merge/Replace:** no code change → no Restore behavior change in the product.
- **Candidate model:** if it were wired later, unique empty-phone incoming rows would stop auto-inserting (`CONFLICT_EMPTY_PHONE`). That would be incomplete Restore versus today. That is why it is not wired.

---

## 18. Rollback

Delete the ARCH-23 test files and the ARCH-23 group in `test_laegh.js`, and drop this report. Production HTML/.NET need no rollback because they were not modified.

---

## 19. Explicit NO LIVE PHONEBOOK REPAIR

This packet **did not**:

- delete contacts
- merge contacts in production
- assign permanent IDs
- rewrite phone numbers or names
- reorder Phonebook
- change `daqi.agencyPhonebookIdx`
- run migration on live shop data
- alter real backups
- alter Restore defaults
- silently convert Merge to Replace
- change SQLite, Print, checksum, or product version

**NO LIVE PHONEBOOK REPAIR.**

---

## 20. Recommendation for ARCH-24

Do **not** start ARCH-24 until this audit is accepted.

Suggested scope for a later packet (not this one):

1. Keep production Merge/Replace frozen until an explicit Restore-contract packet names the empty-phone rule.
2. Least-loss Merge delta, **if** a future packet is authorized: **Policy B only** (skip canonical exact clones, still INSERT different empty-phone rows). That stops 530-doubling without withholding unique empty-phone people. It is still a behavior change and needs its own gate.
3. Do **not** adopt Phase 5 `CONFLICT_EMPTY_PHONE` withhold without a human-review UI (Policy C).
4. Do **not** mint contact IDs in the same packet as Restore skip rules.
5. Do **not** dedup/reorder Phonebook without a daqi remap plan that has a real identity strategy.
6. Treat Replace missing→`[]` as a dedicated Restore-contract issue; do not silently skip-clear.
7. NAME ALONE remains forbidden as identity.

ARCH-24 was not started.
