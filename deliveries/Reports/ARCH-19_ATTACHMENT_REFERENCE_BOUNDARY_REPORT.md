# SIRMAN — ARCH-19 Attachment / Reference Boundary Audit

**Date:** 2026-09-05  
**Packet:** Audit + design of `attachmentsIndex` and its parent references. **No production cutover.**  
**Product version:** `1405.6.3α` (unchanged)  
**Branch:** `cursor/arch-19-attachment-reference-boundary-fa01`  
**Base:** `cursor/arch-18-optional-business-snapshot-adapter-fa01`  
**Final status:** **COMPLETED — AUDIT ONLY, NO PRODUCTION CUTOVER**

This packet does **not** claim shop verification. ARCH-20 was **not** started. Production HTML (`Sirman_Final.html` / `Laegh_Final.html`) was **not** modified.

---

## 1. Change Gate

```text
CHANGE: ARCH-19 forensic fixtures + unused Core AttachmentReferenceSnapshot
        documenting collectAttachmentIndex. No HTML production edit.
CLASS: Audit + design. Not a live assembler/restore cutover.
Q1: CAPABILITY — attachment/reference boundary around attachmentsIndex.
    Not Restore behavior change. Not Phonebook. Not SQLite.
Q2: RunBusiness / Host: NO. No new Host method.
Q3: Persistence: NO. Tests read collector in a sandbox; no LS/IDB write.
Q4: Printing: NO.
Q5: HTML-only: PRESERVED. Assembler SHA locked.
Q6: New transport/DB/ACL: unused JSON DTO only. No SQLite. No P1C-8.
RESULT: PASS
AUTHORITY: explicit user packet ARCH-19 2026-09-05
```

Parent identity is proven from source (`rec.id`). Payload storage is proven (parent `docs[].data` + `disk://` filesystem; index is metadata). Collector semantics are not ambiguous. No STOP/BLOCKED condition was hit.

---

## 2. collectAttachmentIndex source audit

**Definition:** `Sirman_Final.html` 7709–7739.

**Callers (production, unchanged):**

| Site | When |
|---|---|
| `_buildFullBackupData` 8551 | After the backup object literal; then JSON-cloned at 8552 |
| `finalizeBackupPackage` 7746 | Always **rebuilds** `data.attachmentsIndex` |
| Core `BackupFinalizer` | Same rebuild via `BackupSchemaMigrations.CollectAttachmentIndex` |
| Schema 0→1 8199 | Fills index **only if falsy** (`if(!d.attachmentsIndex)`) |

**Algorithm (exact):**

1. `refs = []`
2. Nested `pushDoc(kind, parentId, doc, i)`:
   - Skip falsy `doc`
   - `data = doc.data || doc.src || doc.ref || ''`
   - `isDisk` if `data` is a string starting with `disk:` or `idb:` **or** `isDiskRef(data)` (`disk://` prefix, 9392)
   - Push `{ id, name, ref, inline, kind, parentId }`
     - `id = doc.id || (kind + '-' + String(parentId||'') + '-' + i)`
     - `name = doc.name || ''`
     - `ref = isDisk ? data : ''`
     - `inline = !isDisk && !!data`
     - `kind` as given
     - `parentId = parentId || ''`
   - **Does not copy `data`/`src` onto the index row**
3. Nested `walk(arr, kind)`:
   - `docs = rec.docs || rec.attachments || []`
   - If `rec.docs` is a **non-array object**: `Object.keys(rec.docs)` then each nested array (`pushDoc(kind, rec.id, doc, i)`)
   - Else: array forEach (`pushDoc(kind, rec && rec.id, doc, i)`)
4. Walk order: `d.warranties` / `'warranty'` → `d.sales` / `'sale'` → `d.invoices` / `'invoice'`
5. Return `refs` (new array). No storage I/O.

**Not walked:** `phonebook`, products, parts, tasks, accounts, warehouse*, daqi*, postalHistory, `stockMoves`. Nested warranty bags `agencyWork.docs`, `companyWork.docs`, `devices[].docs`, `phoneResolution.docs` (T13).

**Helpers:** none besides optional `isDiskRef`. No Host, no DOM, no localStorage, no IndexedDB open.

SHA (locked): `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f`

---

## 3. Attachment identity model

| Layer | Field | Rule | Unique? | Stable? |
|---|---|---|---|---|
| Index row | `id` | `doc.id` if truthy, else synthesized `kind-parentId-i` | **No.** T9 keeps two rows with `id:'SAME'` | Synthesized ids change if parentId or index `i` changes |
| Parent record | `rec.id` | **Only** field the walker/validator use | Sales display `id` (`SL-…`) can collide after deletes; warranties use `nextWarCaseId`; invoices often **have no `id`** | invoice `id` is **not** `invoiceId`; sale `id` is **not** `saleUid` |

`detectBackupDuplicateIdentities` does **not** scan `attachmentsIndex`. Parse/DTO does **not** enforce uniqueness. No identity was invented.

---

## 4. Parent-kind matrix

| kind | Source collection | Parent identity field | Matching expression | Writer of `docs` today | Can parent be missing? | Duplicate parent ids? | One attachment, multiple parents? | Attachment without parent? |
|---|---|---|---|---|---|---|---|---|
| `warranty` | `warranties` | `id` | `String(rec.id\|\|'') === parentId` | `addWDocs` → `wDocs` → `getWarData().docs` (20740, 21029) | Yes, after delete | Possible if ids collide | **No** — one index row, one parentId | Yes: `parentId:''` if `rec.id` missing |
| `sale` | `sales` | `id` (display `SL-…`) | same | `addSaleDocs` → `saleDocs` → `getSaleData().docs` (20762, 22603) | Yes | Length-based `SL-` can collide after deletes | No | Yes if `id` missing (`mig_sale_*` only on migrateBackup) |
| `invoice` | `invoices` | `id` | same | **No current UI writer.** Walker still accepts `docs`/`attachments` if present | Yes | `mig_inv_*` only assigned in `migrateBackup` 14707 | No | **Typical live invoice:** `getData()` sets `num`+`invoiceId`, **not** `id` → `parentId:''` (T8) |

No other `kind` is emitted. Validator map 8013: `{ warranty:'warranties', sale:'sales', invoice:'invoices' }`. Unsupported kinds are **skipped** (not INVALID) — T7.

---

## 5. ParentId semantics

**Proven, not assumed:**

- Walker passes `rec.id` only (7729, 7733). Source contains **zero** reads of `invoiceId` / `saleUid` / `num` inside `collectAttachmentIndex`.
- Validator 8024: `String(rec.id || '') === pid`. Same `id` field. **Not** `invoiceIdentity()` / `saleIdentity()`.
- T3: invoice `{ id:'mig_inv_0_1', invoiceId:'INVUID-000012', num:'12' }` → `parentId === 'mig_inv_0_1'`.
- T4: sale `{ id:'SL-0001', saleUid:'SALEUID-000007' }` → `parentId === 'SL-0001'`.
- T8: invoice with `invoiceId` and **no** `id` → `parentId === ''`. Validator **skips** empty `parentId` (8018 `if(!section || !pid) return`).

Therefore: **`invoiceId ≠ invoice.num ≠ rec.id`** and **`saleUid ≠ sale.id`**. Using invoiceId/saleUid as `parentId` would be a **new** contract, not the current one.

IDs can change: migrateBackup assigns `mig_inv_*` / `mig_sale_*` when `id` is missing (14707–14710) — that mutates restore input, not the live assembler. Live `ensureInvoiceIdentity` writes `invoiceId`, not `id`.

---

## 6. Storage model

Attachment **payloads** and the **index** are different stores.

| Mechanism | What is stored | Key / path | Writer | Reader | Backup | Restore | Delete |
|---|---|---|---|---|---|---|---|
| **A — backup JSON** | Index metadata + parent records including `docs[].data` (usually a short `disk://` string; legacy dataURL still possible) | backup object keys `attachmentsIndex`, `warranties`, `sales`, `invoices` | assembler + finalizer | import/migrate | yes | parents restored; index **not** applied to RAM | n/a |
| **B — localStorage** | Parent JSON with `docs` | `lw2` (warranties), `laegh_sales` (sales), `li` (invoices) | `svWarr` / `svSales` / `sv` | hydrate at load | via RAM → assembler | merge/replace writes those keys | splice RAM then persist; **disk file remains** |
| **C — IndexedDB** | **Not** a blob store for docs. `laegh-backup-db` / `snapshots` holds whole backup JSON copies (keyPath `ts`). Also `fsHandles`, `layers`, `safety`, `backupAudit`, `prefs`. `laegh-fullapp-db` / `app` is the HTML package. `laegh-tasks-db` / `tasks`. `laegh-updates-db` / `packages`. | see left | backup snapshot writers 8745–8768 | snapshot restore | snapshots include index as JSON | not attachment blobs | store-specific |
| **D — filesystem** | Binary files | `{backupFolder}/sirman_media/docs/{prefix}_{Date.now}_{rand}_{safeName}` | `storeDocFileOnDisk` → `writeDiskBlob` (File System Access `autoSaveDirHandle`) 9548–9552, 9481 | `resolveDiskRef` / `hydrateDocList` | **files are not embedded in JSON** | pointers restore; bytes missing unless folder copied | `spliceDocNamed` 20805 does **not** delete the file |
| **E — other app store** | blob URL cache | `window._diskUrlCache` | write/resolve | `docThumbSrc` | no | no | revoke on rewrite |
| **F — index metadata** | `{id,name,ref,inline,kind,parentId}` | `attachmentsIndex` | collector | P1C-6 validator; not a RAM global | yes | discarded (not assigned) | rebuilt next backup |
| **G — multiple** | Typical live doc: LS/RAM pointer **and** disk bytes **and** index metadata | — | — | — | — | — | — |

`idb:` prefix is recognized by the collector (7714) as an external ref (`inline:false`, `ref=data`). **No writer** of `idb:` for docs was found in current HTML. Treat as legacy/dead format (T10).

`unwrapBackupEnvelope` copies `rawObj.attachments` (8324) — a **legacy envelope field**, not `attachmentsIndex`, not Phonebook.

Host `WriteWorkspaceFile` (28249) publishes **backup JSON** to the shared folder, not `sirman_media` blobs. Media writes use the File System Access handle, not WebView2.

---

## 7. Backup semantics

Current backup contains:

| Piece | In backup JSON? |
|---|---|
| Attachment **metadata** (`attachmentsIndex`) | **Yes** (derived, rebuilt by assembler and again by finalize) |
| Attachment **references** (`ref` = `disk://…` / `idb:…`) | **Yes**, on the index; also `docs[].data` on parent records |
| Attachment **binary payload** | **Only if** `docs[].data` is still an inline dataURL. Current writers store `disk://` pointers. Binaries live under `sirman_media/docs/`. Index never copies bytes (`inline:true` only flags that parent `data` was non-disk and non-empty). |

**Restore without the external folder:** parent records and index pointers come back; `resolveDiskRef` returns `''` and UI shows a placeholder (9572–9576). That is **not** a complete media restore. Do not redesign the backup contract in this packet.

`itemCounts` / `sections` do **not** include `attachmentsIndex`. Section checksums **skip** the index (7699).

---

## 8. Restore semantics

| Path | `attachmentsIndex` | Parent `docs` | Reconstruct blobs? | Orphans | Missing payload |
|---|---|---|---|---|---|
| **Replace** `applyBackupReplaceSections` | **Not assigned.** Function body has no `attachmentsIndex` (SHA `83911194…`) | Yes, via `warranties` / `sales` / `invoices` arrays | No | Accepted at apply time | Not detected at apply time |
| **Merge** `applyBackupMergeSections` | **Not assigned** (SHA `d01ee561…`) | Yes, when parent row is inserted (warranty by `id`; sale by `saleUid` **or** `id`; invoice by `invoiceId` **or** `id` **or** `num`) | No | Same | Same |
| **migrateBackup** | Not a RAM target. May **invent** parent `id` (`mig_inv_*`) which later backups will use as `parentId` | Field-level `migrateRecord` / SCHEMAS keep warranty/sale `docs` | No | n/a | n/a |
| **P1C-6 validate** (pre-apply) | Missing index = compatible. Non-array = FAIL. `kind`+nonempty `parentId` with no `rec.id` match = FAIL | n/a | n/a | INVALID if kind supported and pid nonempty | Not a payload check |

Index is **derived**. After restore, the next export rebuilds it from restored parents. A stale index in the file is ignored by merge/replace.

---

## 9. Referential-integrity matrix

**Independent systems — do not merge:**

| System | Field | Resolves with | Mechanism |
|---|---|---|---|
| 1 | `attachmentsIndex.parentId` | `warranties\|sales\|invoices[].id` | kind + rec.id |
| 2 | `stockMoves.refDoc` | heterogeneous: warehouseDocs.id **or** invoice `num` **or** warranty `id` | string, untyped |
| 3 | `daqi.agencyPhonebookIdx` | **array index** into `phonebook` | integer; Phonebook safety packet |

Collector source contains none of `refDoc` / `agencyPhonebookIdx`. T19 HTML probe: those collections do not produce index rows.

**Current P1C-6 (already implemented, not changed):**

| Case | Today |
|---|---|
| VALID | supported kind + nonempty parentId + some `rec.id` equals pid |
| INVALID | index present but not an array; or supported kind + nonempty pid + parent missing |
| Skipped (compatible) | missing index; empty parentId; unknown kind; non-object entries |

---

## 10. Orphan scenarios

| Scenario | How it happens | Collector | Validator today |
|---|---|---|---|
| Parent deleted, index stale in an old file | Restore does not apply index; next backup rebuilds | n/a | If someone validates that stale file: FAIL (T6) |
| Invoice docs without `rec.id` | Live `getData()` | `parentId:''` | **Skip** (T8) — not classified orphan |
| Nested warranty stage/device docs | Never indexed | Absent from index | n/a — **silent omission**, not an orphan row |
| `disk://` file missing | Folder not copied | Index still has `ref` | No payload check |
| Duplicate `doc.id` | Two docs share id | Two rows (T9) | No uniqueness check |

No auto-repair. T6 leaves `parentId:'W-MISSING'` unchanged.

---

## 11. Phonebook dependency analysis

`collectAttachmentIndex` does **not** read `phonebook` / `pb`. T7/T11: `phonebook[].docs` produce **zero** index rows.

No attachment mechanism references Phonebook contacts as parents.

**Related but separate:** `daqi.agencyPhonebookIdx` indexes into `phonebook` (23247). That is **not** `attachmentsIndex`. Documented only. Requires the dedicated Phonebook safety packet before any daqi remap. Not changed here.

---

## 12. Proposed AttachmentReferenceSnapshot boundary

Evidence supports a **metadata-only** transport. Implemented unused in Core (not called from production):

`Sirman.Core.Backup.AttachmentReferenceSnapshot`

```text
{
  "attachmentsIndex": [
    { "id": "", "name": "", "ref": "", "inline": false, "kind": "warranty|sale|invoice", "parentId": "" }
  ]
}
```

| Design choice | Evidence |
|---|---|
| Exact fields | Collector push object 7715–7722 |
| Parent representation | `kind` + `parentId` (= `rec.id` or `''`) |
| Binary excluded | `data` never copied; `inline` is a boolean flag |
| External storage id | `ref` when disk/idb; else `''` |
| Attachment identity | `id` as above; uniqueness **not** enforced |
| Parent references typed | `kind` ∈ {warranty, sale, invoice} |
| Orphans representable | Yes (`parentId` pointing nowhere, or `''`) |
| Phonebook | Forbidden key; stripped on Parse |

`Parse` clones; does **not** re-walk parents (walking stays `collectAttachmentIndex` / `BackupSchemaMigrations.CollectAttachmentIndex`). `ToJson` clones. Canonical JSON = `BackupJsJson.Stringify`. No DateTime/Guid/Random. No Host.

This is **not** a production cutover and **not** a new HTML adapter (`collectAttachmentReferenceSnapshot` does not exist).

---

## 13. Future validation rules

**Do not implement in this packet. Do not silently repair.**

**VALID**

- `kind` ∈ {warranty, sale, invoice}
- `parentId` nonempty and equals some `rec.id` in the mapped collection
- `attachmentsIndex` is an array (including empty)
- `inline === true` XOR (`ref` is a disk/idb string) XOR (both empty for an empty payload)

**INVALID**

- unsupported `kind` **if** a future packet chooses fail-closed (today: skip)
- missing parent for supported kind + nonempty parentId (already FAIL)
- `attachmentsIndex` present and not an array (already FAIL)
- duplicate attachment `id` **if** a future packet defines uniqueness (today: allowed)

**AMBIGUOUS (do not infer)**

- resolving parent via `invoiceId`, `num`, or `saleUid`
- treating empty `parentId` as “invoice without id” vs “malformed”
- `idb:` refs (no writer found)
- nested `agencyWork.docs` / device docs (exist on records, absent from index)
- `stockMoves.refDoc` / `daqi.agencyPhonebookIdx`

Do not infer parent identity from file names or Persian labels.

---

## 14. Golden/forensic fixtures

`desktop/Sirman.Core.Tests/AttachmentReferenceFixtures.json` (regenerator `generate_arch19_fixtures.js` runs the live HTML collector).

| Id | Coverage |
|---|---|
| T1 | empty index |
| T2 | warranty + `disk://` |
| T3 | invoice with `rec.id`; parentId ≠ invoiceId/num |
| T4 | sale; parentId = `SL-…` ≠ saleUid |
| T5 | multiple; walk order warranties→sales→invoices |
| T6 | orphan validator FAIL; no repair |
| T7 | unsupported kind skipped; products/tasks/phonebook not indexed |
| T8 | invoice without `id` → parentId `''` |
| T9 | duplicate `doc.id` preserved |
| T10 | `disk://`, `idb:`, inline dataURL (`ref` empty, no bytes in index), empty data |
| T11 | Phonebook docs → empty index |
| T12 | Persian Unicode names |
| T13 | object-map `rec.docs`; `agencyWork.docs` / `devices[].docs` not indexed |
| T14 | 14-row exact order |

HTML: `JSON.stringify(collectAttachmentIndex(bag)) === JSON.stringify(expectedIndex)`. T2/T4/T8 also equal `_buildFullBackupData().attachmentsIndex`.

---

## 15. Regression tests

Untouched: assembler, `exportData`, `buildBackupObject`, Restore merge/replace, Phonebook, Print, Host, checksum, SQLite, version, ARCH-17 adapter, ARCH-18 adapter.

| Lock | SHA |
|---|---|
| `_buildFullBackupData` | `17f08840ecb3e6ecc9d72082d27eeeb6736daa97a1f06819df4f4f04a998cfa6` |
| ARCH-17 adapter | `92dd552685fce56b5cff75a41c4a767d658233affc6d3870d015dc379199c631` |
| ARCH-18 adapter | `d885fa4c4c5f128f36db7799a5732adc3765025b9bebe204779a77c01a79b508` |
| `collectAttachmentIndex` | `ed781c62b8a0da9e80b458339cf3bf36bbabd38183ee5f5c1b81b9e686877d8f` |
| `applyBackupReplaceSections` | `8391119460561bc591b346c17bead9bdd75317828dd14a1b3636421e5cedc81b` |
| `applyBackupMergeSections` | `d01ee56106db3d5389ac3e7dc9ecec3c242965fb7aee7e2ba7e04835951d6b9d` |

`Sirman_Final.html` and `Laegh_Final.html` remain byte-identical (no edits this packet).

---

## 16. Exact HTML/Core test counts

| Suite | Command | Result |
|---|---|---|
| HTML | `node test_laegh.js Sirman_Final.html` | **985 / 985 PASS** (ARCH-18 was 959; **+26** ARCH-19 tests) |
| Core | `dotnet test desktop/Sirman.Core.Tests` | **746 / 746 PASS** (ARCH-18 was 713; **+33** DTO/forensic tests) |

No unrelated baseline failures. No repair of unrelated code.

---

## 17. Files changed

| File | Why |
|---|---|
| `desktop/Sirman.Core/Backup/AttachmentReferenceSnapshot.cs` | Unused metadata DTO. |
| `desktop/Sirman.Core/Backup/AttachmentReferenceSnapshotCatalog.cs` | Frozen kinds / parent-id docs. |
| `desktop/Sirman.Core.Tests/AttachmentReferenceSnapshotTests.cs` | Core goldens / firewall. |
| `desktop/Sirman.Core.Tests/AttachmentReferenceFixtures.json` | T1–T14 forensic goldens. |
| `desktop/Sirman.Core.Tests/generate_arch19_fixtures.js` | Regenerator. |
| `desktop/Sirman.Core.Tests/Sirman.Core.Tests.csproj` | Copy fixtures. |
| `test_laegh.js` | HTML goldens, SHA locks, Restore/Phonebook firewall. |
| `deliveries/Reports/ARCH-19_ATTACHMENT_REFERENCE_BOUNDARY_REPORT.md` | This report. |

**Not changed:** `Sirman_Final.html`, `Laegh_Final.html`, assembler, Restore, Phonebook, Print, Host, checksum, SQLite, `SIRMAN_VERSION.json`.

---

## 18. Data-impact statement

**Zero live-data impact.** Production HTML is unmodified. The DTO is unused by backup/restore. Tests do not write localStorage, IndexedDB, backup files, or SQLite. Phonebook is not read by the collector. Shop data on disk is untouched.

---

## 19. Rollback

Revert this branch. Production path is the pre-ARCH-19 assembler (identical SHA). No shop-data rollback is required.

---

## 20. Recommendation for ARCH-20

**Do not start a live attachments cutover in ARCH-20.**

Safest next packet (ARCH-16 plan): equivalence-gated **REQUIRED-slice** backup cutover **or** continue leaving assembler locked. If attachments are next:

1. Keep `parentId = rec.id` until an explicit compatibility packet remaps invoices to `invoiceId` and sales to `saleUid` (that remap is a behavior change).
2. Do not fold `stockMoves.refDoc` or `daqi.agencyPhonebookIdx` into this DTO.
3. Do not move `sirman_media` binaries into backup JSON without a dedicated media packet.
4. Do not index nested warranty stage/device docs without an explicit walker expansion.
5. Phonebook stays out.

ARCH-20 was **not** started here.

---

## Status

**COMPLETED — AUDIT ONLY, NO PRODUCTION CUTOVER**
