# SIRMAN — PHONEBOOK 2650 CLONES FORENSIC + REPAIR SAFETY AUDIT

**Mode:** READ-ONLY FORENSIC / REPAIR-SAFETY  
**Packet date (stated):** 2026-09-07  
**Report written:** 2026-09-08 (Jalali ۱۴۰۵/۰۶/۱۷)  
**Product examined:** `1405.6.16α` (`Sirman_Final.html` / `Laegh_Final.html`, unchanged)  
**Requested input file:** `Laegh_backup__۱۴۰۵-۰۶-۱۶_ (1).json`  
**Branch:** `cursor/phonebook-2650-clones-repair-safety-fa01`

```text
Requested backup modified:  NO (file not present on this VM)
Shop data / localStorage:   NOT TOUCHED
Production code:            NOT EDITED
Restore / Merge / Replace:   NOT RUN
Contacts deleted/merged:    NO
Indexes renumbered:         NO
Repair script / UI / migration: NOT CREATED
Copy-only simulation:       NOT RUN (no source array to copy)
```

**Final status:** **BLOCKED**  
**Final verdict:** **FORENSIC INCONCLUSIVE**

HARD STOP applied: the named backup was not readable here. File-dependent numbers are **UNKNOWN**. User-stated contact fields were **not verified**. No repair was designed as an implementation.

---

## 1. Executive Summary

The audit **cannot certify** that ~2650 rows are exact clones, and **cannot certify** that reducing ~2730 → ~81 is safe.

Reason: `Laegh_backup__۱۴۰۵-۰۶-۱۶_ (1).json` is **not on this agent**. Searches of `/workspace`, `/tmp`, `/opt/cursor`, `/cursor/stores`, uploads, and GitHub did not find that filename or any JSON whose `phonebook` length is ~2730.

**Code-side facts (verified on current `Sirman_Final.html`, independent of the missing file):**

- Phonebook has **no stable id**. Live array is RAM `phonebook` from `localStorage` key `lb`.
- The **only persisted cross-collection array-index** into Phonebook is `daqi.agencyPhonebookIdx`.
- `splice` / compacting **shifts every later index**. That changes the meaning of every `agencyPhonebookIdx` **greater than** a deleted slot, including indexes that point at **non-clone** contacts after a clone block.
- Therefore identical JSON objects are **not** automatically safe to delete.
- After ARCH-25, Merge skips exact `_phonebookCanonicalFingerprint` clones. Empty-phone Merge **before** ARCH-25 could multiply copies (`N + k×N`; test replay 530→2650 is mechanism, not a measurement of this file).

**Critical question (2730 → 81 by removing 2649 clones):** **not answerable from evidence.** Do not treat the user observation as measured.

Unblock: place the named JSON on this VM **without modifying it**, then re-run fingerprint + daqi index mapping + in-memory simulation.

---

## 2. Backup Identification

| Item | Result |
|---|---|
| Requested filename | `Laegh_backup__۱۴۰۵-۰۶-۱۶_ (1).json` |
| Found on this VM | **NO** |
| SHA-256 of file | **UNKNOWN** |
| Size | **UNKNOWN** |
| `version` / `exportedAt` / `applicationVersion` / `schemaVersion` | **UNKNOWN** |
| `phonebook` vs `pb` | **UNKNOWN** |
| Historical `Laegh_AutoSave.json` (2026-06-25, N=20 unique) | **Not this file.** Read-only previously; not used as a substitute. |

User observation (~2730 total, ~2650 copies of آقای رهبر / shop رهبری / `phones: []` / `ita: 09904205600`) is **UNVERIFIED**.

---

## 3. Exact Phonebook Counts

| Metric | Value |
|---|---|
| Total phonebook records | **UNKNOWN** |
| Unique canonical fingerprints (`_phonebookCanonicalFingerprint`) | **UNKNOWN** |
| Duplicate groups (fingerprint count ≥ 2) | **UNKNOWN** |
| Stated ~2730 | **not measured** |
| Implied unique if 2730 − 2649 = 81 | **arithmetic on unverified numbers — not a count** |

---

## 4. Duplicate Group Distribution

**UNKNOWN.** No group-size table can be produced without the array.

Do not copy the user-stated 2650 into this table as a measurement.

---

## 5. Dominant 2650 Clone Analysis

| Question | Answer |
|---|---|
| Is there a ~2650 group? | **UNKNOWN** |
| Are all members canonical-identical? | **UNKNOWN** |
| Name آقای رهبر on every member? | **UNVERIFIED** |
| Shop رهبری / given address / `phones: []` / `ita: 09904205600` / note روبیکا / `cat: shop` | **UNVERIFIED** — packet forbids assuming these for every occurrence |
| Empty `phones` involved? | **UNKNOWN** (if later proven `phones: []`, that matches the historical empty-phone Merge multiplier) |
| Canonical representative from position/history | **UNKNOWN** — first vs last cannot be chosen without indexes |

`ita` is **not** a Merge identity field. Merge uses fingerprint then raw `phones[0]`. A contact with `phones: []` and a number only in `ita` is **empty-phone** for Merge.

---

## 6. Exact Index Ranges

| Item | Value |
|---|---|
| All indexes of the dominant fingerprint | **UNKNOWN** |
| First occurrence | **UNKNOWN** |
| Last occurrence | **UNKNOWN** |
| Contiguous vs split blocks | **UNKNOWN** |
| Same contact before/after a block | **UNKNOWN** |

---

## 7. Canonical Fingerprint Evidence

**Function used (not invented):** production `_phonebookCanonicalFingerprint` (`Sirman_Final.html`). Test lock SHA `32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15`. Replica: `PhonebookRestoreSafety.CanonicalFingerprint` (sorted keys).

This is **not** unsorted `JSON.stringify`. Extra hidden keys change the fingerprint.

| Field | Dominant group |
|---|---|
| fingerprint string | **UNKNOWN** |
| count | **UNKNOWN** |
| first index | **UNKNOWN** |
| last index | **UNKNOWN** |
| all index ranges | **UNKNOWN** |
| all members same fingerprint? | **UNKNOWN** |
| raw key-order / extra fields | **UNKNOWN** |

---

## 8. Hidden Field / ID Comparison

| Question | Answer |
|---|---|
| Hidden/additional fields differ among supposed clones | **UNKNOWN** |
| `id` present and differs | **UNKNOWN**. `savePBContact` does **not** mint `id`. Schema has no `id`. |
| `privacyConsentAt` / extra keys | **UNKNOWN** |

If two rows differ by any key, they are **not** class-A exact clones under `_phonebookCanonicalFingerprint`.

---

## 9. Positional Reference Analysis

Search of current `Sirman_Final.html` (not historical kits) for `phonebook`, `pb`, `lb`, `agencyPhonebookIdx`, `phonebook[idx]`, `phonebook[index]`.

### Persisted array-index consumer (other dataset → phonebook slot)

| Consumer | Stored field | Type |
|---|---|---|
| **داغی** | `daqi.agencyPhonebookIdx` | **C. array-index reference** |

`_daqiAgencyName` reads `phonebook[d.agencyPhonebookIdx]`. Select/combo stores the integer in a hidden input. Invoice-to-daqi prefill uses `phonebook.findIndex` on seller name/shop (textual match at **create time**), then **stores the integer**.

`PhonebookSnapshotCatalog.PositionalIndexConsumer` = `"daqi.agencyPhonebookIdx"`. Adapter `collectPhonebookSnapshot` does **not** rewrite that field.

### Phonebook-internal index use (not another dataset)

| Site | Role |
|---|---|
| `openPBModal(idx)` / `savePBContact` / `delPBContact` / `anonymizeOpenContact` | UI edit/delete of **that** slot |
| `printPBLabelDirect(idx)` / `fillRcv` | copies name/addr/phone **into postal form** (no stored index) |
| `pbFilteredRows` `map((c,i)=>({c,i}))` | render index |
| Global search `pb.indexOf(c)` then `openPBModal(ri)` | session UI only |
| `let pb = phonebook` | alias of the same array |

Hydration: `let phonebook = JSON.parse(localStorage.getItem('lb') || '[]')`. Persist: `sv()` → `setItem('lb', JSON.stringify(phonebook))`.

**No other `phonebookIdx` / `pbIndex` field exists in current HTML.**

### Would deleting duplicates change meaning of indexes?

**Yes, in general.** Any `phonebook.splice(i,1)` decreases every stored `agencyPhonebookIdx` that was `> i` by one **if those values are not remapped**. That is true even when the deleted object is an exact clone of another row.

Whether **this backup’s** daqi indexes fall inside a clone range: **UNKNOWN** (no `daqi` array from the named file).

---

## 10. Daqi Index Impact

| Question | Answer |
|---|---|
| Which `agencyPhonebookIdx` values exist in the named backup | **UNKNOWN** |
| Which fall inside the duplicate ranges | **UNKNOWN** |
| What those indexes currently point to | **UNKNOWN** |
| Null vs integer vs missing | **UNKNOWN** |

**Code fact:** daqi also stores `agencyName` and `agencyPhone` as **copied text**. Display prefers the live phonebook slot when the index is non-null (`_daqiAgencyName`). After a shift, a داغی row can show a **different** contact while `agencyName` still holds the old string.

---

## 11. Cross-Domain Reference Analysis

Classification required: A direct object · B stable ID · C array-index · D name/phone text · E none.

Do **not** treat matching names/phones as the same person.

| Domain | How it relates to Phonebook | Class |
|---|---|---|
| **daqi** | `agencyPhonebookIdx` integer; plus `agencyName` / `agencyPhone` copies | **C** + **D** |
| **invoices** | `seller` / phone on the invoice; no phonebook index field | **D** (text) / **E** as FK |
| **sales** | own `id` / `saleUid`; customer fields are record text | **D** / **E** as FK |
| **warranties** | own `id`; name/phone on warranty | **D** / **E** as FK |
| **accounts** | own `id` | **E** as Phonebook FK |
| **tasks** | own `id` | **E** as Phonebook FK |
| **defectiveStock** | `customerName` / `customerPhone` copies | **D** |
| **attachments** | invoice/warranty/sale docs; not phonebook indexes (`AttachmentReferenceSnapshotCatalog` lists `daqi.agencyPhonebookIdx` as independent) | **E** as Phonebook FK |
| **postalHistory** | `receiverName` / `receiverPhone` / addr copies | **D** |
| **Excel import** | writes into `phonebook` array; does not store reverse indexes | n/a (writer) |
| **Backup assembler** | `phonebook: _safeArr(phonebook)` | snapshot of array, not a FK |

`DIFF_KEYS.phonebook` uses `phones[0]` or `fn|ln` or `id` for **backup diff UI only**, not a stored relation.

---

## 12. Possible Creation Mechanisms

Verified against **current** source (ARCH-22–26 reports used only where the live function still matches).

| Mechanism | Could produce ~2650 **empty-phone** exact clones? |
|---|---|
| **Pre-ARCH-25 `applyBackupMergeSections`** | **Yes, in principle.** Empty `phones[0]` always inserted. Repeat merge of a payload of N empty-phone clones: `N + k×N`. Test replay: 530→2650 after four extra merges. **Whether this file was built that way: UNKNOWN** (no merge audit log). `530×5=2650` is a **matching arithmetic family**, not proof this shop merged four extra times. |
| **Replace** | Copies file length. Does not multiply. Can **preserve** 2650 already in a file. |
| **`savePBContact` `push`** | No uniqueness. Empty phones allowed. **Unlikely** as 2650 manual saves (`withSaveLock` ~800ms). No production loop of 2650 `push`es found. |
| **Excel `importPhonebook`** | **Ruled out for empty phone** (`if (!fn \|\| !phone) skipped`). |
| **Current ARCH-25+ Merge** | **Cannot multiply exact clones** (fingerprint skip). **Can** still add **different** empty-phone rows. |
| **Export / `_buildFullBackupData` / `collectPhonebookSnapshot` / `sv()`** | Serialize RAM; **do not append**. |
| **Boot / `JSON.parse(lb)`** | Loads clones; does not add. |
| **Network pull** | Calls Merge. Same as Merge of that era. |
| **`anonymizeOpenContact`** | Clears phones on **one** row; does not loop-clone. |
| **UI `renderPB`** | One card per slot; does not invent RAM rows. |

**Evidence required to prove origin (not available here):** the named JSON plus prior backups / restore audit entries showing merge counts and whether `phones` were empty at each export.

---

## 13. Ruled-Out Mechanisms

Ruled out as the **multiplier of exact clones with a non-empty `phones[0]`** (both historical and current Merge skip on raw first phone):

- Excel import of the **same** raw phone
- Current Merge of exact fingerprints
- Export / autosave / snapshot / checksum
- Render / search / postal fill
- A `for` loop in current HTML that inserts one contact 2650 times (**none found**)

**Not ruled out** for empty-phone clones: historical Merge; Replace of an already-cloned file; unknown out-of-tree script (no evidence).

---

## 14. Repair Strategy Comparison

**None executed.** Classification from **code**, not from this backup’s indexes.

Deleting index `i` from `phonebook` without remapping `daqi[].agencyPhonebookIdx`:

- indexes `< i` keep pointing at the same remaining objects
- indexes `== i` now point at the **next** row (or become empty)
- indexes `> i` now point at the **previous** neighbor — **wrong contact** if that neighbor was not an equivalent clone

| Strategy | Class | Reason |
|---|---|---|
| **A) Keep first, remove later exact clones** | **UNKNOWN** for this file. Structurally **UNSAFE** unless clone indexes and **all** daqi indexes are mapped first. Even then, any clone **not at the tail** shifts later **non-clone** indexes. If the clone block is a **single contiguous suffix** and **no daqi index lies in that suffix except ones that should follow the keeper**, this could become **SAFE WITH CONDITIONS**. That condition is **unproven**. | |
| **B) Keep last, remove earlier exact clones** | **UNSAFE** as a default. Deleting earlier slots **always** shifts every later index, including the keeper and all non-clones after the first deletion. | |
| **C) Keep the occurrence referenced by positional consumers, remove the rest** | **SAFE WITH CONDITIONS** as a *design* only after: (1) exact fingerprint identity proven; (2) every `agencyPhonebookIdx` listed; (3) keeper chosen among referenced clone indexes (or first, if none reference the group); (4) remap then delete. **UNKNOWN** until the file is read. If daqi points at **both** a clone and a different contact at later indexes, remap is mandatory. | |
| **D) Move/collapse the block while preserving referenced indexes** | **UNSAFE** without an explicit remap table. “Preserve indexes” while changing array length is the same as rewriting daqi. Not a silent array edit. | |
| **E) Introduce stable Phonebook IDs first, then clean later** | **Not a repair of this backup.** ID minting is a new identity model (ARCH-22 explicitly did not mint `PB-` ids). It does not by itself make splice safe until daqi stores ids instead of indexes. **Out of scope** for this packet. | |

Identical objects ≠ safe delete.

---

## 15. Copy-Only Simulation

**Not executed.**

The packet allows in-memory simulation **of a copy of the supplied backup**. The supplied file was not present, so there was no copy to load.

| Simulated result | Value |
|---|---|
| Resulting array length | **UNKNOWN** |
| Index shifts | **UNKNOWN** |
| Daqi index impact | **UNKNOWN** |
| Whether references change meaning | **UNKNOWN** (code says they **can**; this file’s actual daqi: unknown) |

No simulation output was written next to the user’s backup. No production write occurred.

---

## 16. Data-Loss Risks

| Risk | Without the file |
|---|---|
| Deleting a row that only **looks** like آقای رهبر but differs in fingerprint | **High** if anyone deletes by name |
| Shifting `agencyPhonebookIdx` onto the wrong remaining contact | **High** for any compacting repair |
| Using Merge/Replace as cleanup | **High** — Merge appends; Replace overwrites the whole book |
| Editing the user’s backup in place | **Forbidden** |
| Leaving clones in place | UI noise / export size; **does not by itself erase invoices** |
| Assuming 2730 − 2649 = 81 unique people | **Invalid** until fingerprints are counted |

---

## 17. Safest Next Step

1. **Do not Restore, Merge, Replace, or delete contacts.**
2. Copy the named file onto an analysis machine **without altering bytes**.
3. Re-run this packet as measurement: `_phonebookCanonicalFingerprint` distribution, dominant index ranges, every `daqi.agencyPhonebookIdx`, in-memory-only simulation of strategies A/C.
4. Only after those numbers exist may a **later** gated packet discuss a controlled repair design. This packet does **not** authorize that design as code.

---

## 18. What MUST NOT be Done

- Modify `Laegh_backup__۱۴۰۵-۰۶-۱۶_ (1).json` if/when it arrives
- Modify shop `lb` / live Phonebook
- Run Restore / Merge / Replace / Excel import as cleanup
- Delete or merge contacts because they share a name, shop, or `ita`
- Renumber indexes
- Ship a repair script, migration, cleanup function, or UI button
- Treat `530 → 2650` test replay as this file’s provenance
- Treat `Laegh_AutoSave.json` (20 rows) as this backup
- Infer identity from name/phone/ita alone
- Answer “2730 → 81 is safe” without fingerprint + daqi maps

---

## 19. Final Verdict

**FORENSIC INCONCLUSIVE**

File-dependent questions (exact counts, clone identity, index ranges, hidden fields, daqi impact, 2730→81) were **not measured**. Source analysis is complete: the only persisted positional FK is `daqi.agencyPhonebookIdx`; splice is unsafe without remap; current Merge cannot create new exact clones; historical empty-phone Merge could.

Repair of the observed clones is **not** “SAFE TO DESIGN” on this evidence. It is also not proven “UNSAFE” for a specific suffix-collapse of proven clones, because that file was not read. The honest verdict is inconclusive, with a **hard stop on implementation**.

---

## Evidence appendix

### Search for the named backup

| Location | Result |
|---|---|
| `/workspace` unicode walk | not found |
| `/tmp`, `/opt/cursor`, `/cursor/stores` | not found |
| uploads / agent-tools | not found |
| GitHub issue/code search | no hit |
| `localStorage` `lb` | not on this VM |

### Production SHAs (unchanged)

| Symbol | SHA-256 |
|---|---|
| `_phonebookCanonicalFingerprint` | `32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15` |
| `applyBackupMergeSections` | `0505b31f8f46e96dd097294e37c17549c79810b422073f2cc33111cdab90dc49` |
| `applyBackupReplaceSections` | `b067f92b2e1bbf60c9d6edcc77dba68b5e839b44c8d0d61ab95967e47426b7af` |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` |

### Critical question (evidence-only)

**Can we safely reduce ~2730 → ~81 by removing 2649 exact clones?**

**Not from this evidence.** The objects were not proven identical. Daqi indexes were not listed. Index-shifting is a demonstrated language/runtime effect of `splice`. Identical clones would still be **unsafe to delete** if any later non-clone index is stored in daqi and not remapped.

---

**FINAL STATUS: BLOCKED — FORENSIC / SAFETY AUDIT ONLY (NO FILE, NO REPAIR)**
