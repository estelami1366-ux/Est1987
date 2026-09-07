# SIRMAN — PHONEBOOK 2470 DUPLICATE FORENSIC AUDIT

**Mode:** ANALYSIS ONLY / READ-ONLY  
**Jalali:** ۱۴۰۵/۰۶/۱۶  
**Gregorian:** 2026-09-07  
**Product examined:** `1405.6.16α` (`Sirman_Final.html` / `Laegh_Final.html`, unchanged)  
**Branch:** `cursor/phonebook-2470-forensic-audit-fa01`  
**Base:** `cursor/release-1405-6-16-alpha-fa01` @ `b5f532c`

```text
Production code changed:     NO
Sirman_Final.html:           NOT EDITED
Laegh_Final.html:            NOT EDITED
Phonebook data:              NOT EDITED
User backup:                 NOT FOUND ON THIS VM — not modified
Restore / Merge / Replace:   NOT RUN
Import / Excel / localStorage rewrite: NOT RUN
Repair script:               NOT WRITTEN
Deduplicate / delete / merge contacts: NOT DONE
Git commits containing code: NO
```

**Final status:** **BLOCKED**  
**Final verdict:** **FORENSIC BLOCKED**

---

## 1. Executive Summary

The ~2470 repeated contact **could not be measured**. The live Phonebook the user saw is RAM `phonebook` hydrated from `localStorage` key `lb`. That shop profile is not on this Linux agent. The backup the user created before this investigation is also **not in this workspace**.

Every JSON file in the tree that actually contains a `phonebook` array of shop-like contacts was scanned. The only shop-shaped file is `Laegh_AutoSave.json` (and an identical archive copy): **20 contacts, 20 distinct canonical fingerprints, zero duplicate groups**, exported `2026-06-25T07:22:55.567Z`, version `7.0`. That file is **not** the 2470 observation. It was read only. It was not rewritten.

Named files from the 2026-09-04 Phonebook forensic (`Laegh_backup__۱۴۰۵-۰۶-۰۴_(1).json`, `Laegh_backup__۱۴۰۵-۰۶-۱۱_(1).json`) remain absent.

**What is known from code (current `1405.6.16α`):**

- Phonebook has **no stable contact identity**. Array index is the only implicit identity. `savePBContact` does not mint `id`.
- Canonical clone detection in production Merge is `_phonebookCanonicalFingerprint` (sorted-key JSON walk). That function was used as the analysis fingerprint. No new production fingerprint system was introduced.
- After ARCH-25, Merge **skips exact canonical clones**, including empty-phone clones. Non-empty `phones[0]` still skips on raw `indexOf`. Different empty-phone rows still **insert**.
- Before ARCH-25, empty-phone rows **always inserted**. Tests prove `530 → 1060 → 1590 → 2120 → 2650` on four extra Merges of the same empty-phone payload. **2470 is not 2650.** That arithmetic is a proven mechanism, not a measured shop count.
- `savePBContact` new-row always `push`es with no uniqueness check. Excel import cannot insert empty phones and skips an existing raw phone. Export/`sv()` serialize RAM as-is and do not append.
- UI `renderPB` / `pbFilteredRows` map one card per array slot. A contact that “appears ~2470 times” is almost certainly **~2470 rows in RAM**, not a render loop. That still cannot be counted here.
- `daqi.agencyPhonebookIdx` is a positional pointer into `phonebook`. Any future collapse of clones would retarget or orphan داغی rows. This audit does not repair that.

**Do not treat this report as permission to delete, merge, or renumber contacts.**

---

## 2. Exact duplicate count

| Metric | Value |
|---|---|
| Requested observation | one contact appears **approximately 2470** times |
| Exact repeated-record count on the observed Phonebook | **UNKNOWN — DATA NOT ON THIS VM** |
| Total `phonebook.length` of the observed book | **UNKNOWN** |
| Count of the dominant fingerprint | **UNKNOWN** |
| `Laegh_AutoSave.json` (historical, not the 2470 set) | 20 records, 0 duplicates |

No number in this section is inferred from 2470, 2650, or 530. Those figures are either the user’s observation (unverified here) or synthetic test replay.

---

## 3. Contact identity/content

Identified **by exact content, not by name**. Content of the ~2470 group:

| Field | Value on the observed 2470 group |
|---|---|
| Name (`fn` + `ln`) | **UNKNOWN** |
| Phone(s) | **UNKNOWN** |
| `shop` / `addr` / `zip` | **UNKNOWN** |
| `ita` / `tg` / `wa` / `ig` / `socials` | **UNKNOWN** |
| `note` / `cat` | **UNKNOWN** |
| `nid` / privacy flags | **UNKNOWN** |
| `id` | **UNKNOWN** (create path does not mint `id`) |
| Empty-phone involved? | **UNKNOWN** |

`SCHEMAS.phonebook` in HTML is:

```js
{ fn:'', ln:'', shop:'', addr:'', zip:'', phones:[], ita:'', tg:'', wa:'', ig:'', socials:[], note:'', cat:'other' }
```

`savePBContact` also writes `nid`, `privacyConsent`, `privacyConsentAt`. Extra keys survive migrate (copy-all).

### Identity classes for the 2470-record group (required A–E)

These are the packet classes. They are **not** the ARCH-22 test helper letters (A/D/C/B/E/F in `PhonebookForensic.cs`).

| Class | Meaning | Count in the 2470 group |
|---|---|---|
| **A** EXACT CANONICAL CLONE | `_phonebookCanonicalFingerprint` equal | **UNKNOWN** |
| **B** SAME PHONE / DIFFERENT CONTACT CONTENT | overlapping raw phone, fingerprint differs | **UNKNOWN** |
| **C** SAME NAME / DIFFERENT PHONE | `fn+ln` equal, first phone differs | **UNKNOWN** |
| **D** DIFFERENT CONTACT | not A/B/C | **UNKNOWN** |
| **E** UNKNOWN | cannot classify | **2470-group unclassified — entire observation is E until the array is present** |

Do **not** conclude “same person” from name or phone alone.

---

## 4. Fingerprint distribution

**Fingerprint used:** production `_phonebookCanonicalFingerprint` in `Sirman_Final.html` (locked SHA `32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15` in `PhonebookRestoreContract.FingerprintSha`). Test replica: `PhonebookRestoreSafety.CanonicalFingerprint` (sorted object keys, `JSON.stringify` scalars, `null` literal).

```js
function _phonebookCanonicalFingerprint(node){
  if(node === null || node === undefined) return 'null';
  if(typeof node === 'object'){
    if(Array.isArray(node)){
      return '['+node.map(_phonebookCanonicalFingerprint).join(',')+']';
    }
    var keys = Object.keys(node).sort();
    return '{'+keys.map(function(k){ return JSON.stringify(k)+':'+_phonebookCanonicalFingerprint(node[k]); }).join(',')+'}';
  }
  return JSON.stringify(node);
}
```

This is **not** `JSON.stringify(contact)` (ARCH-22 test Class A used unsorted stringify). Merge identity after ARCH-25 is the **sorted-key** walk above.

### Observed 2470 Phonebook

| fingerprint | count | representative record | first index | last index |
|---|---|---|---|---|
| **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** | **UNKNOWN** |

Whether every one of the ~2470 records is identical: **UNKNOWN**.

### Historical file that *was* readable (`Laegh_AutoSave.json`) — not the 2470 set

Read-only. Not modified.

| fingerprint (SHA-256 of canonical string, 16 hex) | count | representative | first | last |
|---|---|---|---|---|
| 20 distinct fingerprints | 1 each | 20 different contacts | 0..19 | same as first |

Largest group size: **1**. Dominant repeated fingerprint: **none**.

Example row 0 (not a clone cluster): `fn=اقای میرجلیلی`, `ln=میرجلیلی`, `phones=["09131524107"]`, shop `فروشگاه سپاه یزد`. Other rows are different people/phones. **Do not treat this as the 2470 contact.**

---

## 5. Exact-clone determination

For the ~2470 group:

| Question | Answer |
|---|---|
| Byte-identical canonical clones (`_phonebookCanonicalFingerprint` equal)? | **UNKNOWN** |
| Every one of ~2470 identical? | **UNKNOWN** |
| Only array position differs? | **UNKNOWN** |

**Code fact (not a shop measurement):** if two records share that fingerprint, Merge after ARCH-25 treats them as exact clones and **skips** the incoming one. That is the definition of class A in this packet.

---

## 6. Differences, if any

| Difference | Observed 2470 group |
|---|---|
| IDs differ | **UNKNOWN** (create path has no `id`) |
| Metadata differs (`note`, `cat`, socials, extra keys, key order) | **UNKNOWN** |
| Phone empty vs non-empty mix | **UNKNOWN** |
| Persian vs ASCII digits in the same logical number | **UNKNOWN** (Merge compares **raw** strings; digit-shape variants would be class B, not A) |
| `phones[0]` falsy but later slots filled | **UNKNOWN** — production still treats falsy `phones[0]` as empty for the phone-match skip |

No difference table can be filled without the array.

---

## 7. Position/range analysis

| Question | Answer |
|---|---|
| First occurrence index | **UNKNOWN** |
| Last occurrence index | **UNKNOWN** |
| Contiguous block? | **UNKNOWN** |
| Same contact before/after the repeated block | **UNKNOWN** |
| Shared creation/update timestamps | **UNKNOWN** — schema has no required `createdAt` on contacts (`privacyConsentAt` only if consent) |

UI: `pbFilteredRows` is `phonebook.map((c,i) => ({c,i}))` then filter/sort. `pbRenderGroupedList` emits one card per remaining row. There is **no** multiply-in-render loop. Group headers show a count of rows in the group; they do not duplicate RAM.

---

## 8. Other duplicate groups

On the observed 2470 Phonebook: **UNKNOWN**.

On `Laegh_AutoSave.json`: **no** duplicate fingerprint groups.

Synthetic ARCH-26 RAH book (N=8) includes designed empty-phone clones; that is a test fixture, not shop data.

---

## 9. Likely creation mechanism

No shop log of clicks/merges exists on this VM. Ranked **mechanisms that can create thousands of copies**, from live `1405.6.16α` source. None of these were executed.

### Write paths (only these `push` / assign `phonebook`)

| Path | Function | Guard | Can multiply one contact to ~2470? |
|---|---|---|---|
| Boot | `let phonebook = JSON.parse(localStorage.getItem('lb')\|\|'[]')` | none | Loads existing clones; does not add |
| Persist | `sv()` → `localStorage.setItem('lb', JSON.stringify(phonebook))` | none | Serializes RAM; does not invent rows |
| Manual save | `savePBContact` `idx===-1` → `phonebook.push(c)` | permission; `withSaveLock('pb')` ~800ms | **Yes in principle** (no uniqueness). **Unlikely** as 2470 human clicks of «مخاطب جدید». Empty phone allowed (`filter(Boolean)` only drops blank inputs). |
| Excel | `importPhonebook` | skip if `!fn \|\| !phone`; skip if any live `phones` `includes(phone)` | **Cannot** insert empty phone; **cannot** insert same raw phone again |
| Merge | `applyBackupMergeSections` | exact fingerprint skip; if `phones[0]` truthy, raw `indexOf` skip; else insert | **Cannot** multiply **exact** clones **after ARCH-25**. **Can** still insert **different** empty-phone rows. **Before ARCH-25**, empty-phone rows always inserted → `N + k×N` |
| Replace | `applyBackupReplaceSections` | non-empty array assign; explicit `[]` clears; missing/invalid **KEEP LIVE** | **Does not multiply**; copies file length. If the file already has 2470 clones, live becomes 2470 |
| Network pull | `confirmNetworkPullPreview` → `applyBackupSelective(..., 'merge')` | same Merge | Same as Merge. Repeat pull of a file full of empty-phone **non-clones** still grows. Repeat pull of **exact** clones does **not** grow on current Merge |
| Export / snapshot | `_buildFullBackupData` / `collectPhonebookSnapshot` | `_safeArr(phonebook)` | Read-only clone of RAM; **does not append** |
| Delete / reset | `delPBContact` / `delSelPB` / `resetAll` | confirm | Shrink / wipe |
| Anonymize | `anonymizeOpenContact` | confirm | Clears phones on **one** index; creates an empty-phone row that **historical** Merge treated as always-new |

No `for` loop that inserts the same contact thousands of times was found.

### Mechanism ranking **if** the missing array is later proven class A (exact clones)

1. **Pre-ARCH-25 Merge of empty-phone clones, repeated** — proven `N×(1+k)`. Shop N and k **UNKNOWN**. `494 × 5 = 2470` fits the same family as the documented `530 × 5 = 2650` test, but that equality is **not evidence** the shop had 494 rows or merged four extra times.
2. **Replace (or first load) of a backup that already contained ~2470 clones** — export would then keep writing them. Origin of the file still unexplained.
3. **`savePBContact` push with no uniqueness** — possible for a few copies; implausible as the sole source of ~2470 unless a non-UI caller pushed in a loop (none found).
4. **Current (ARCH-25+) Merge** — **cannot** be the multiplier **if** they are exact fingerprints. It **can** still add empty-phone rows that are **not** exact clones (class D in this packet’s sense of different content).

### Mechanism ranking **if** they share a visible phone in the UI

- Current and historical Merge **skip** when incoming `phones[0]` is a non-empty raw string found in any live `phones[]`.
- Therefore thousands of **exact** copies of a **non-empty** `phones[0]` are **not** explained by Merge, unless `phones[0]` is actually empty/null/`''` and the UI is showing another slot, or the strings only *look* the same (Persian digits, spaces) and fingerprints differ (class B).
- Excel cannot create that pattern for the same raw phone.
- Remaining: Replace of an already-cloned file, or repeated `savePBContact`.

### Stale preview (does not write)

`previewNetworkWorkspaceMerge` still classifies Phonebook with the **pre-ARCH-25** rule (`entryPhone && indexOf` only). Empty-phone incoming rows count as **added** in the preview even when live Merge would `SKIP_EXACT_DUPLICATE`. Preview cannot create 2470 rows. It can **mis-count** them.

### Positional consumers

`daqi.agencyPhonebookIdx` stores an integer index. `_daqiAgencyName` reads `phonebook[d.agencyPhonebookIdx]`. Clone insertion **appends**; it does not by itself retarget existing indices. Clone **deletion** / compacting **does**. This is why repair is unsafe without a daqi map.

---

## 10. Relation to ARCH-22–26

| Packet | Relation to 2470 |
|---|---|
| **ARCH-22** | Forensic identity boundary: **no stable id**. Test-only classifier/fingerprint. Adapter `collectPhonebookSnapshot()` clones RAM; assembler still `phonebook: _safeArr(phonebook)`. No live cutover. |
| **ARCH-23** | Restore safety audit. Production Merge still empty-phone-always-insert at that time. Verdict then: **NOT SAFE YET** to change production. Candidate merge lived in tests only. |
| **ARCH-24** | Backup/recovery closure. Phonebook still positional. |
| **ARCH-25** | **Production Merge changed:** skip exact canonical clones (including empty-phone clones); keep raw `phones[0]` skip; different empty-phone still ADD; Replace missing key **KEEP LIVE**. Historical 530-row replay **stays 530** after four Merges. This **stops future exact-clone multiplication via Merge**. It **does not remove** clones already in `lb`. |
| **ARCH-26** | Copy-only recovery acceptance on **synthetic** data (phonebook N=8). Shop `lb` forbidden. Not a measurement of 2470. |

**Implication:** if the shop book still has ~2470 copies, they were almost certainly **already in RAM/backup** (created under pre-ARCH-25 Merge, Replace of a bad file, or `savePBContact`), not created by the current fingerprint Merge. ARCH-25 is a **brake**, not a cleanup.

This packet does **not** start ARCH-27 and does **not** cut over identity.

---

## 11. Data-risk assessment

| Risk | Level without the array | If clones are later proven exact |
|---|---|---|
| Accidental loss of a **distinct** person who only shares a name/phone | **High** if anyone dedupes by name/phone | Lower **only** after fingerprint identity is proven on the real file |
| `daqi.agencyPhonebookIdx` pointing at the wrong remaining row after splice | **High** for any compacting repair | Same |
| Merge/Replace used as “cleanup” | **High** — Merge appends; Replace overwrites the whole book | Do not use as repair |
| Editing the user’s existing backup | **Forbidden** (user already backed up; file not even present here) | Still forbidden |
| Leaving clones in place | Operational nuisance (UI list, Excel export size, search noise). **Does not by itself destroy other modules** | Acceptable until a controlled, indexed repair exists |
| Minting `PB-` ids as a silent fix | **High** — changes identity model; out of scope | Do not |

**Safest current action:** keep the user’s backup untouched; do not Restore; do not Merge; do not delete.

---

## 12. Safest future repair strategy

Documentation only. **No algorithm implemented. No script shipped.**

A future repair is **not authorized** by this report. If it is ever authorized, the **minimum** safe sequence is:

1. **Obtain the actual file** the user already exported (or a new export of current `lb`). Work on a **copy**. Never write the original backup.
2. Compute `_phonebookCanonicalFingerprint` (existing function only) on the copy.
3. If the dominant group is **not** class A for every member → **stop**. Manual identity review. Do not auto-collapse.
4. If it **is** class A (every member same fingerprint):
   - Inventory **all** `daqi.agencyPhonebookIdx` values that fall on those indices.
   - Keep **one** surviving index (prefer an index already referenced by daqi, else the first occurrence).
   - Remap every daqi index that pointed at a discarded clone onto the keeper **before** any splice.
   - Do not renumber unrelated contacts more than the splice shift requires; if splice is used, remap **every** positional consumer, not only daqi.
5. Human confirmation of the keeper row against invoices/postal/داغی by **content**, not by name guess.
6. Leave Merge/Replace/Excel/`savePBContact` unchanged until a separate, gated packet says otherwise.

This is a **strategy outline**, not an implementation plan and not a cleanup.

---

## 13. What MUST NOT be done

- Delete, merge, or deduplicate contacts in live `lb` or in the user’s backup.
- Renumber IDs or rewrite array indexes “to tidy the list”.
- Change phone numbers to make rows match.
- `save` Phonebook, run Restore, Merge, Replace, or import as a cleanup.
- Rewrite `localStorage`.
- Collapse by name or by phone (that is class C / B, not A).
- Use Excel re-import as a filter (it skips existing phones; it will not remove clones; empty-phone clones are invisible to it).
- Run historical Merge again on a book that still contains empty-phone **non-clone** rows.
- Write or run a repair script.
- Propose an automatic cleanup as production code in this packet.
- Treat `Laegh_AutoSave.json` (20 unique rows, 2026-06-25) as the 2470 dataset.
- Treat test replay `530 → 2650` as the shop’s 2470 count.
- Infer that two rows are the same person because names or phones look similar.

---

## 14. Final verdict

**FORENSIC BLOCKED**

The 2470-record group was not present as data on this agent. Exact count, contact content, fingerprint distribution, clone-vs-mixed classification, positions, and other duplicate groups are **UNKNOWN**. Code forensics is complete and consistent with prior ARCH-22–26 Phonebook work: there is still no stable identity; current Merge no longer multiplies **exact** clones; historical empty-phone Merge can; Replace copies whatever is already in the file; `savePBContact` has no uniqueness; UI does not invent extra cards.

Unblock condition: the user’s backup JSON (or an export of live `lb`) must be **readable on this VM** without modifying it. Then this audit can be re-run as measurement, still without repair.

---

## Evidence appendix (search)

| Location | Result |
|---|---|
| `/workspace/**/*.json` with `phonebook`/`pb` arrays N≥8 | `Laegh_AutoSave.json` N=20 unique; archive copy identical |
| `/tmp`, `/opt/cursor`, uploads | no shop Phonebook JSON |
| Git LFS | none |
| GitHub issues `2470` | no hit |
| `localStorage` `lb` | not on this VM |
| `Laegh_backup__۱۴۰۵-۰۶-۰۴_(1).json` | **NOT FOUND** |
| `Laegh_backup__۱۴۰۵-۰۶-۱۱_(1).json` | **NOT FOUND** |

Production SHAs recorded in tests (unchanged by this packet):

| Symbol | SHA-256 |
|---|---|
| `_phonebookCanonicalFingerprint` | `32eb8b515ee874e7e4eb89568e1293cbd54196e56667e863383f62add453dc15` |
| `applyBackupMergeSections` (ARCH-25+) | `0505b31f8f46e96dd097294e37c17549c79810b422073f2cc33111cdab90dc49` |
| `applyBackupReplaceSections` (ARCH-25+) | `b067f92b2e1bbf60c9d6edcc77dba68b5e839b44c8d0d61ab95967e47426b7af` |
| `savePBContact` | `1883f9d3dd575719ae6d653a30318faa38fed4dd9e046ead32a7070730e4cf81` |

---

**FINAL STATUS: BLOCKED — FORENSIC ONLY (NO DATA, NO REPAIR)**
