# SIRMAN — STORAGE ARCHITECTURE DECISION RECORD
## Persistence program — design only / no implementation

**Mode:** DESIGN / DECISION ONLY — no database, no product code, no backup/restore patch  
**Jalali:** 1405/06/02  
**Gregorian:** 24 August 2026  
**Exact time:** 19:35 Asia/Tehran  
**Timezone:** Asia/Tehran (+03:30)  
**Live version (unchanged):** `1405.5.27γ` / assembly `1405.5.27.3`  
**Authoritative forensic source:** `deliveries/Reports/P3_STORAGE_FORENSIC_AUDIT.md` (OPTION A)  
**Governance:** `docs/PHASE_3_CHANGE_GATE.md`, `docs/ARCHITECTURE_RULES.md`, `docs/DEVELOPMENT_GOVERNANCE.md`, `.agents/skills/laegh-software-workflow/SKILL.md`

```text
Product code changed = NO
Database added = NO
localStorage / IndexedDB changed = NO
Backup / Restore changed = NO
Print / inventory / warranty behavior changed = NO
Dual-write introduced = NO
```

---

## 0. Git gate

No switch / reset / rebase / merge / cherry-pick.

```text
Branch:   cursor/p3-storage-forensic-audit-fa01
HEAD:     c9ea60b
Worktree: product-clean
Untracked (not part of this design):
  deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.zip
  deliveries/Sirman_Setup_1405.5.27γ_NATIVE_PRINT.sha256
  scripts/__pycache__/
Version:  1405.5.27γ / 1405.5.27.3
Date:     2026-08-24 / 1405/06/02
Time:     19:35 Asia/Tehran
Timezone: Asia/Tehran (+03:30)
```

This ADR is docs-only on the current checkout.

---

## 1. Current-state summary

From `P3_STORAGE_FORENSIC_AUDIT.md` (not re-litigated):

| Fact | Value |
|---|---|
| Canonical SoT today | In-memory JS globals hydrated from HTML `localStorage`, written back on save |
| Core persist | `CurrentStorage.Kind = html-localStorage-indexeddb`; `JsonBackupRepository` is a TBD stub (`html-backup-engine`) |
| SQLite/EF/LiteDB in `desktop/` | **Absent** |
| IndexedDB | Not live warranty/invoice tables; app blob, updates, backup copies, tasks mirror |
| Native disk | `%AppData%\Sirman\backup` JSON via `WriteBackupText`; media `disk://` refs |
| Phase 3 B20 | Persist/backup is a **separate program**, not a B-step |
| Phase 2 SQLite design | Approved as **unwired parallel adapter**, JSON-document rows, **not** live SoT. Historical. **Not** copied as the target SoT. |

HTML-only must keep working until a verified cutover. UI must not open a database file.

---

## 2. Problem statement

Operational business data currently lives in quota-limited browser storage. Proven risks (forensic codes R1–R8):

| ID | Risk |
|---|---|
| R1 | Browser quota can block durable persist while RAM still looks saved |
| R2 | Restore is non-atomic and can wipe a missing section to `[]` |
| R3 | Restore can toast success after persist `catch` |
| R4 | Selective backup can omit sections (checkbox UI narrower than full builder) |
| R5 | Tasks split-brain: `localStorage` vs IndexedDB mirror |
| R6 | Backup serializes RAM, which may be newer than persisted LS |
| R7 | Attachments live on disk / IDB refs, not in row JSON |
| R8 | Secrets (`loginPw`, AI keys) can sit in a downloadable backup JSON |

Shop incident counts remain UNKNOWN. This design does not claim a specific shop root cause beyond those mechanisms.

Target:

```text
Operational business data
        ↓
Native persistence boundary (Core contracts)
        ↓
Embedded local file database (Desktop implementation)
        ↓
Disk  (+ sirman_media/ for files)
```

```text
HTML / WebView2     = UI
localStorage/IDB    = legacy / cache / rollback until cutover
Backup              = derived artifact, never SoT
Media               = disk folder, durable IDs + hashes
```

---

## 3. Requirements (must-have)

1. Durable writes independent of browser quota  
2. Transactions for multi-entity operations  
3. Atomic / verified restore (no silent partial success)  
4. Entity-level integrity checks  
5. Full backup parity with live canonical data + media manifest  
6. Deterministic, repeatable migration  
7. Rollback to legacy browser storage until cutover is verified  
8. Local desktop operation with **no external database server**  
9. Media outside the database when appropriate  
10. Secrets not in ordinary downloadable JSON  
11. Versioned schema migrations  
12. Crash-safe startup (WAL / integrity check)

Also: `.NET 8` Host; existing `sirmanHost` only (no REST business API); print frozen; HTML-only remains usable; no live dual-write as first step.

---

## 4. Engine comparison

Scoring: Fit / Weak / Fail against SIRMAN’s single-shop desktop, not popularity.

| Criterion | A. SQLite | B. LiteDB / embedded document | C. Other embedded (e.g. Realm / custom) | D. SQL Server / LocalDB |
|---|---|---|---|---|
| Transactions | Fit — ACID, multi-table | Weak — collection-level; cross-entity weaker | Unknown / extra stack | Fit — overkill |
| Reliability / WAL crash safety | Fit — WAL + `integrity_check` | Weak — smaller recovery ecosystem | Fail unless proven | Fit |
| Single-user desktop | Fit | Fit | Fit | Weak — service/instance |
| .NET 8 | Fit — `Microsoft.Data.Sqlite` | Fit — LiteDB nuget | Weak | Fit — heavy |
| Deployment | Fit — one file, no service | Fit — one file | Weak | Fail vs “no external server” |
| Backup / restore | Fit — Online Backup API / `VACUUM INTO` | Weak — file copy; less mature verify | Weak | Fit — not local-simple |
| Corruption recovery | Fit — dump/repair tooling | Weak | Weak | Fit |
| Concurrency path later | Fit — one writer; readers OK | Weak | Unknown | Fit — not needed now |
| Query / indexes | Fit — SQL indexes | Fit — document indexes | Unknown | Fit |
| Migration complexity | Medium — map JSON → tables + `json_extra` | Lower for blobs, worse for integrity | High | High |
| File portability | Fit — copy `.sqlite` + media | Fit | Unknown | Fail |
| Long-term maintainability | Fit — SQL, standard, hireable | Weaker ecosystem | Fail | Weak for this shop |

**Historical SQLite design is not the reason for choosing SQLite.** Phase 2 used SQLite as a **document bag** behind Get/Save, explicitly **not** SoT, and forbade wiring Desktop. This program **supersedes** that SoT/wiring stance. The engine is still SQLite because it is the only option that simultaneously satisfies transactions, crash safety, no server, one file, and restore-without-partial-success.

---

## 5. Chosen engine

```text
SQLite (embedded), WAL mode, one file under %AppData%\Sirman\data\sirman.sqlite
Access library: Microsoft.Data.Sqlite (not EF Core for the first slice)
```

Not EF Core in v1: avoids a second model of invoices/warranties, keeps schema explicit, matches existing `JsonObject` contracts until tables stabilize.

---

## 6. Why chosen

- Multi-entity transactions (invoice + stock + accounts) are a must-have; browser storage cannot do this.  
- WAL + `PRAGMA integrity_check` addresses crash/corruption better than LiteDB for this risk class.  
- No SQL Server/LocalDB service on the shop PC.  
- Portable file next to `sirman_media/`.  
- Schema version table enables “newer DB / older app” refusal.  
- Core stays free of SQLite types: Desktop (or a persistence assembly referenced only by Desktop) implements repository interfaces.

---

## 7. Alternatives rejected

| Option | Why rejected |
|---|---|
| LiteDB as SoT | Cross-entity restore/invoice+stock transactions and corruption recovery are weaker than the forensic risks require |
| SQL Server / LocalDB | Violates “local desktop, no external server”; ops burden for one shop |
| Keep localStorage as SoT + only patch restore | Forensic OPTION A: quota + non-atomic restore remain |
| Phase 2 JSON-column-only bag as live SoT | No entity integrity, no real FKs, easy to re-create silent section wipe in another form |
| Dual-write LS + SQLite from day one | Two authorities; R1/R6 class failures continue |
| HTML opens SQLite via JS | Violates UI ↛ Database; HTML-only and exe would diverge |

---

## 8. Target architecture

```text
Sirman_Final.html  (UI only for canonical data after cutover)
        ↓  existing sirmanHost / RunBusiness
Sirman.Core        (domain + I*Repository / persist contracts, no SQLite types)
        ↓
Persistence assembly (Desktop-referenced): SQLite implementation
        ↓
%AppData%\Sirman\data\sirman.sqlite
%AppData%\Sirman\sirman_media\   (or backup-folder media, hashed paths)
```

| Kind | Home |
|---|---|
| Operational business rows | SQLite (canonical after cutover) |
| Backup | Derived snapshot (`VACUUM INTO` or Backup API) + media manifest + checksums |
| localStorage / IndexedDB | Rollback / HTML-only until cutover; then cache or archive — **never a second SoT** |
| Print artifacts | OS spooler — unchanged, frozen |
| Attachments | `sirman_media/` files; DB holds id, relative path, mime, hash, size, created_at |

HTML-only: until cutover, continue LS. After cutover **in exe**, HTML talks only through Host. HTML-only without Host **does not** become a second writer to SQLite.

LAN today remains **file-share of backup packages**, not a live shared SQLite on UNC (SQLite-on-network-share is unsafe). Multi-user live DB is a **later program**.

---

## 9. Entity ownership (target)

Convention: preserve legacy identifiers. Add `json_extra TEXT` for unknown JS fields so migration does not drop data. Do not invent new IDs when a legacy id/code exists.

| Entity | Target | Primary key | References | Indexes (min) | Transaction with | Backup |
|---|---|---|---|---|---|---|
| invoices | `invoices` | `invoice_id` (legacy `invoiceId` / INVUID-*) | seller/customer phones; line product codes | invoice_id, num, date | lines, inventory, stock_moves, accounts | rows + json_extra |
| invoice_lines | `invoice_lines` | `(invoice_id, line_no)` | invoices, products/parts | invoice_id | parent invoice save/close | included |
| products | `products` | `code` | — | code, name | inventory row | rows |
| inventory | `inventory` | `code` (same as product) | products | code | reserve/consume/release, warehouse docs | rows |
| phonebook | `phonebook` | `contact_id` **assigned at migrate if missing**; unique first-phone | — | phones (normalized table `phonebook_phones`) | — | rows |
| parts | `parts` | `code` (legacy `prodCode-N` style) | products.code | code, product_code | stock | rows |
| services | `services` | `service_id` = legacy `id` or `code` | — | code | — | rows |
| warranties | `warranties` | `warranty_id` = legacy `id` | accounts, parts, phone | id, phone, status | parts, accounts | rows |
| sales | `sales` | `sale_id` = `saleUid` or `id` | parts, accounts | saleUid, id | inventory, accounts | rows |
| tasks | `tasks` | `task_id` = legacy `id` | optional invoice/warranty/sale | id | **LS+IDB both retired for SoT** | rows; no IDB mirror as authority |
| defective_stock | `defective_stock` | `id` | products/parts | id | inventory | rows |
| accounts | `accounts` | `account_id` = legacy `id` | trx children | id | warranty/sale/invoice money | rows |
| warehouses | `warehouses` | `warehouse_id` = legacy `id` | — | id, code | — | rows |
| warehouse_docs | `warehouse_docs` | `doc_id` = legacy `id` | warehouses | id | stock_moves, inventory | rows |
| stock_moves | `stock_moves` | `move_id` = legacy `id` | warehouses, docs, codes | id, date | warehouse IN/OUT, consume | rows |
| daqi* | `daqi` / `daqi_warehouse` / `daqi_vouchers` | legacy `id` | — | id | — | rows |
| postal_history | `postal_history` | `id` | — | id | — | rows |
| audit_logs | `audit_user` / `audit_bg` | `id` | — | ts | append-only | rows |
| settings | `settings` key/value + typed print/company tables | `key` | — | key | — | rows; **exclude secrets** |
| attachments | `attachments` | `attachment_id` | owner_type + owner_id | owner | media verify | metadata only |
| schema | `schema_info` | singleton | — | — | migrations | version integers |

Display `num` on invoices remains a **business number**, not the durable PK (`invoiceId` is).

---

## 10. ID mapping

| Current | Canonical DB | Stable after migrate? |
|---|---|---|
| `invoice.invoiceId` / `INVUID-n` | `invoices.invoice_id` | YES — do not mint a second UUID |
| `invoice.num` / `lc` counter | `invoices.num` + `counters` table | YES — counter table, not RAM-only |
| `warranty.id` | `warranties.warranty_id` | YES; migrate missing ids with `mig_war_*` only if already missing (same as current migrateBackup) |
| `sale.saleUid` then `sale.id` | `sales.sale_id` | YES — prefer saleUid |
| `product.code` | `products.code` | YES |
| `warehouse.id` | `warehouses.warehouse_id` | YES |
| `stockMoves.id` | `stock_moves.move_id` | YES |
| `task.id` | `tasks.task_id` | YES |
| phonebook | **no stable id today** (merge-by-phone) | Assign `contact_id` once at import; store phones in child table; **do not** use phone as PK (numbers change) |

Compatibility plan: HTML keep reading the same JS field names after Host returns records; mapping is adapter-side.

---

## 11. Transaction model

| Operation | Entities | Atomic TX required? | On failure |
|---|---|---|---|
| Invoice save (open) | invoices, lines | YES | rollback; UI error; no LS-only success |
| Invoice close | invoices, inventory, stock_moves, accounts (as today) | YES | full rollback; no closed invoice without stock apply |
| Sale save / finalize | sales, parts/inventory, accounts | YES | rollback |
| Inventory mutation (reserve / release / consume) | inventory, stock_moves | YES | fail-closed (existing Core stock contract) |
| Warehouse IN / OUT | warehouse_docs, stock_moves, inventory | YES | rollback doc+moves+qty |
| Warranty save | warranties | YES (single row OK) | rollback |
| Warranty close / reverse | warranties, parts, accounts | YES | rollback all three |
| Task save | tasks | YES | **no IDB second authority** |
| Restore | all imported tables + attachment rows | YES — staged DB file or single TX; **NO PARTIAL SUCCESS** | leave previous live DB file untouched |
| Settings (non-secret) | settings | YES | rollback |

Browser `sv()` / `_persistJsonSafe` are **not** the commit path after cutover.

---

## 12. Backup model

Do **not** reuse HTML BackupEngine as SoT export.

```text
live SQLite (checkpoint WAL)
        ↓
SQLite Backup API or VACUUM INTO  →  sirman-backup-<jalali>.sqlite
        ↓
media manifest (path, hash, size) of sirman_media/
        ↓
package checksum (SHA-256 of db file + manifest)
        ↓
optional Host write under GetBackupDir()
```

- Secrets file is **not** in the default package.  
- Selective backup, if ever offered, is a **filtered snapshot of SQLite**, not “delete JSON keys.”  
- `itemCounts` must match `SELECT COUNT(*)` after snapshot, or the package is invalid.

---

## 13. Restore model

```text
backup package
        ↓
validate magic / schema_info.version ≤ app supported
        ↓
validate checksums (hard fail, not confirm-and-continue)
        ↓
copy to staging path (not over live file)
        ↓
PRAGMA integrity_check; count vs manifest
        ↓
verify media hashes (missing media = integrity error, listed, not silent)
        ↓
atomic replace: swap staging file into live path (Windows MoveFileEx / replace)
        ↓
verify counts again
        ↓
commit pointer / success
```

Failure at any step: **live DB unchanged**. No section-by-section apply. No success toast on catch. HTML BackupEngine replace-to-`[]` is **not** the target restore.

---

## 14. Migration model

```text
LEGACY LS/IDB  (untouched, rollback)
        ↓
READ-ONLY extraction (exe Host dump or in-memory snapshot written to a migrate file)
        ↓
CANONICALIZATION (ids, phones, json_extra)
        ↓
IMPORT into a new candidate sirman.sqlite (not the live path until verified)
        ↓
COUNT per entity
        ↓
CHECKSUM
        ↓
PARITY (JS array vs SQL rows; warranties/invoices/inventory must match when those entities move)
        ↓
HUMAN verification on shop Windows
        ↓
CUTOVER flag in Host: canonical = sqlite for migrated entities only
```

**No live dual-write on step 1.** Candidate DB is not authority until the flag. Cache after cutover, if any, is derived and must invalidate on every successful write (write-through Host; drop LS key for that entity or mark `cacheFrom=dbRev`).

---

## 15. Rollback model

Until cutover of an entity:

```text
legacy localStorage / IndexedDB = rollback source
sirman.sqlite                   = candidate only
```

Rollback = Host flag off; do not delete the candidate file in the same change.  
After full parity and human sign-off: SQLite canonical; LS archived, not deleted in the cutover commit.  
A newer `schema_info.version` than the app supports → **refuse to open** (see §18). No silent LS fallback to stale data.

---

## 16. Attachment model

```text
DB attachments:
  attachment_id, owner_type, owner_id, relative_path, mime, sha256, size, created_at

Disk:
  %AppData%\Sirman\sirman_media\...
```

Restore verifies every manifest hash. Broken reference → integrity error list; restore does not report OK. Rows stay in DB; media is not inlined as dataURL (quota R1).

---

## 17. Secrets model

| Secret | Target |
|---|---|
| `loginPw` / role hashes | Not in default backup JSON. Exe: Windows DPAPI (`ProtectedData`) file `%AppData%\Sirman\secrets.bin` via existing Host `SaveSecret` / `LoadSecret` direction. |
| AI keys | Same secrets store, not `settings` table, not downloadable backup. |
| Network tokens | Same. |

**Required mechanism:** OS DPAPI sidecar, excluded from ordinary backup.  
**Open (non-blocking):** optional whole-file SQLCipher later; not required for v1.

HTML-only: secrets remain in LS until that mode is retired; exe must not export them into `WriteBackupText` JSON after persist program starts.

---

## 18. Compatibility model

| Version | Meaning |
|---|---|
| `schema_info.user_version` / table `schema_version` | Integer; migrations 1…N |
| Application version | `1405.5.27γ` independent; do not encode schema in the Greek letter |
| Migration version | Last applied N |
| Older app + newer DB | **Hard refuse** with Persian message; do not open; do not write LS |
| Newer app + older DB | Run pending SQL migrations inside a transaction |
| Rollback of app | Keep previous exe + previous DB file; do not auto-open newer schema |

Legacy HTML without Host: no SQLite; LS remains SoT for that mode until HTML-only is explicitly retired.

---

## 19. First migration entity

**Chosen: `services` (catalog).**

| Why | Why not others |
|---|---|
| Has `id` and/or `code`; not merge-by-phone | Phonebook has **no stable PK** today — bad first PK exercise |
| No inventory reserve/consume | Products are coupled to `inventory` |
| Not warranties / sales / invoices | Packet forbids those as first slice |
| Touches Host dump, SQLite row, backup snapshot, parity, rollback flag | Validates the program, not the highest-risk ledger |

First-slice schema (design, not implemented):

```text
services(
  service_id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  cat TEXT,
  price INTEGER,
  warr TEXT,
  json_extra TEXT NOT NULL DEFAULT '{}',
  migrated_at TEXT
)
```

`service_id` = existing `id` if present, else `code`. Do not mint a new id when either exists.

---

## 20. Implementation gates (future code — not this task)

A future persist packet may implement **only** after human review of this ADR, and must still pass `docs/PHASE_3_CHANGE_GATE.md` (Q3 persistence = yes, explicit program).

Order:

1. Persistence assembly + `schema_info` + WAL + integrity on startup  
2. Read-only extract of `services` from live LS (no delete)  
3. Import to **candidate** file; counts + checksum  
4. SQLite backup snapshot of candidate + restore-to-staging test  
5. Automated parity: N rows, field hashes  
6. Human shop verification of services list in UI (still reading LS) vs SQL dump  
7. Host flag **off** by default  
8. Only a later authorized packet may turn the flag on  

**Tests (required before any cutover):**

- Core: repository contract tests on SQLite (get/save/delete/tx rollback)  
- Restore abort leaves live file bytes unchanged  
- Quota-unrelated: write succeeds without `localStorage`  
- HTML suite still green (no LS key rename)  
- Print suite untouched  

**Human verification:** shop Windows exe; print frozen; backup folder present; services count match; no warranty/invoice regression.

Startup user-visible states:

| State | User sees |
|---|---|
| DB healthy | Normal |
| DB missing | “فایل داده پیدا نشد” — candidate create only if migrating; else block canonical mode |
| DB corrupt | “فایل داده خراب است” — do not load stale LS as if it were current canonical |
| Schema newer than app | “نسخه برنامه قدیمی است” — refuse |
| Schema older | migrate, then continue |
| Migration pending | progress; not editable as canonical |
| Restore pending | blocking restore UI; not mixed live |
| Legacy fallback | only when flag says canonical=html; **never silent** |

---

## 21. Unresolved decisions (non-blocking)

| Item | Status |
|---|---|
| Optional SQLCipher at-rest for the whole DB | Open — v1 uses NTFS ACL + DPAPI secrets sidecar |
| Exact column lists for invoices/warranties (after first entity) | Deferred — `json_extra` holds remainder |
| Whether `contact_id` is UUID vs `PB-n` | Open until phonebook slice |
| Shared-folder live SQLite | **Rejected for v1**; LAN stays backup-file share |
| EF Core later | Open; not for first entity |

These do not block the engine, boundary, first entity, dual-store rule, or restore atomicity.

---

## 22. Risks

| ID | Risk | Mitigation |
|---|---|---|
| D1 | Dual SoT if flag and LS both written | Forbid dual-write; flag is exclusive |
| D2 | Copying HTML restore-to-`[]` into SQL | Restore is file-swap, not section assign |
| D3 | HTML-only users lose data | LS remains until that mode is retired |
| D4 | SQLite on UNC share | Not used as live SoT |
| D5 | Migrating warranties first | Forbidden; first entity is services |
| D6 | Print coupling | Print frozen; persist program does not touch print |
| D7 | Secrets in backup JSON | Excluded; DPAPI sidecar |

---

## 23. Success-criteria checklist

```text
[x] engine chosen
[x] persistence boundary defined
[x] entity ownership defined
[x] IDs mapped
[x] transaction boundaries defined
[x] backup strategy defined
[x] restore atomicity defined
[x] migration strategy defined
[x] rollback defined
[x] first entity selected  (services)
[x] tests defined
[x] human verification defined
[x] secrets strategy defined  (DPAPI sidecar; JSON backup excluded)
[x] attachment strategy defined
```

---

## 24. Final decision

```text
APPROVED FOR IMPLEMENTATION
```

Meaning: **design is implementation-ready as a dedicated persist program.**  
This file **does not** authorize writing SQLite code in the same packet. A later implementation packet still needs Change Gate PASS and human go-ahead.

```text
Product code changed: NO
Database added: NO
```
