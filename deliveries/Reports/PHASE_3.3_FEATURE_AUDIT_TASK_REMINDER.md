# SIRMAN — PHASE 3.3 FEATURE AUDIT

تاریخ: ۱۴۰۵/۰۵/۲۷ (۱۸ اوت ۲۰۲۶)  
نسخه محصول: **1405.5.27γ**  
شاخه مبنا: `cursor/daily-operations-brief-3733`

```
FEATURE: Task Reminder Reliability
STATUS: AUDIT COMPLETE
IMPLEMENTATION: NOT STARTED
CODE CHANGES: NONE
```

========================================
SIRMAN — PHASE 3.3 FEATURE AUDIT
========================================

FEATURE:
Task Reminder Reliability

STATUS:
AUDIT COMPLETE

BASELINE:
5582145e7eb7cc750450e9794ab440e5e2c12d33

TAG:
phase-3.2-complete-1405.5.27-gamma

FILES MODIFIED:
NONE

COMMITS CREATED:
NONE

----------------------------------------
TASK MODEL
----------------------------------------

Canonical schema (`SCHEMAS.tasks`) plus live fields used by create/sync:

- id: string. Manual: `TSK-` + Date.now base36 + random. Auto: stable `TSK-AUTO-{invoiceNum}`, `TSK-AUTO-WAR-{warrantyId}`, `TSK-AUTO-INV-{productCode}`, `TSK-AUTO-BACKUP`.
- title, desc: strings. desc optional.
- kind: `do` | `watch`. Persistent. Manual from active tab; auto invoice/warranty/inventory use `watch`; backup uses `do`.
- status: `open` | `done`. Persistent.
- priority: `urgent` | `high` | `normal` | `low`. Persistent.
- deadlineTS: Unix milliseconds number, or null. Persistent. Not a Jalali string and not a Date object.
- hasTime: boolean. Persistent. True only if the picker value contains `HH:MM`.
- createdAt: stored as Date.now() number on create; schema default is `''`. Optional; absence is safe.
- doneAt: number or null (this is “completedAt”; there is no `completedAt` field).
- notify: boolean. Persistent. Default true on the form (`tsk-notify` = 1). Auto tasks always `true`.
- notifiedAt: number (ms) or null. Persistent. Dedup flag, not a delivery receipt.
- link: `{ type, id }` or null. Types: `invoice`, `sale`, `warranty`, `inventory`, `dataio`. Optional.
- autoInvoice / autoWarranty / autoInventory / autoBackup: extra flags, not in schema defaults. Survive restore because `migrateRecord` copies extra keys. Optional; absence means “not an auto task”.

Persistent: whole task object in `localStorage['laegh_tasks']`, mirrored to IndexedDB `laegh-tasks-db` / store `tasks`, and included in backup JSON `tasks`.

Safely absent: desc, deadlineTS, hasTime, link, notify (treated falsy), notifiedAt, doneAt, auto* flags, createdAt.

Not in the model: retry count, lastAttemptAt, deliveredAt, channel (web vs desktop).

----------------------------------------
TASK CREATION
----------------------------------------

Paths:

1. Manual `saveTask()` — new id each time; edit updates in place. Changing deadlineTS clears `notifiedAt`.
2. `syncOpenInvoiceTasks()` — one watch task per open invoice (`status !== 'closed'`). Duplicate prevented by `autoInvoice && link.id === num`. Closed invoice deletes that auto task. Re-open creates a **new** task with `notifiedAt: null`.
3. `syncOpenWarrantyTasks()` — same pattern on `w.status !== 'closed'`, id `TSK-AUTO-WAR-{id}`.
4. `syncLowInventoryTasks()` — products where `inventory[code].min > 0 && qty <= min` (weaker product KPI; **not** `invLowStockFromLists`, **not** parts). Stock recovery deletes the auto task.
5. `syncBackupReminderTask()` — one `TSK-AUTO-BACKUP` if any data exists and last manual backup (`laegh_last_backup`) is missing or older than 7 days. Fresh backup deletes it.
6. `syncAllAutoTasks()` — runs all four. Scheduled `setTimeout(..., 2500)` then `setInterval(..., 300000)`. Also on Event Bus `invoice:closed` and `warranty:closed` only. **Not** on `invoice:saved` / `warranty:saved`.

Duplicates: manual can create many similar titles. Auto tasks are unique per link id while the source stays open. Completing (`doneTask`) an auto task does **not** recreate it (finder still matches). Deleting an auto task while the source is still open **does** recreate it on next sync, with `notifiedAt: null` → another notification.

Completed auto tasks are not removed until the source closes / stock recovers / backup is fresh.

IDs: auto IDs are stable for a given invoice number / warranty id / product code. Manual IDs are not stable across delete+recreate. Two invoices sharing the same `num` would share one auto-task id.

----------------------------------------
DEADLINE / TIMEZONE
----------------------------------------

`deadlineTS` is Unix ms from the Jalali date picker.

Picker (`_dpPick`): builds a Gregorian day, then `Date.UTC(..., 12, 0, 0)` plus a Tehran offset hack (`toLocaleString` parsed as a Date). Date-only deadlines land near **Tehran noon**, not start of Tehran day. With time, 12h is subtracted and `hh:mm` added.

App TZ default: `Asia/Tehran` (`TZ` / `laegh_tz`). Display uses `tehranParts` / `fdate` / `ftime`.

Comparisons:

- Notification (`checkDueTasksForNotification`): `deadlineTS <= Date.now()`. No `sameTehranDay`. Date-only “today” usually waits until ~noon Tehran.
- Task list groups: overdue = open && `deadlineTS < now` && **not** `sameTehranDay`; today = `sameTehranDay`; this week = `< now + 7*86400000`; else / null = «بعداً / بدون موعد».
- Dashboard overdue alerts: `deadlineTS < now` **without** `sameTehranDay` (same-day past noon can alert as overdue while the task page still shows «امروز»).
- Dashboard KPI urgent: `priority==='urgent' || deadlineTS < now` (also no Tehran-day gate).

No Jalali-string deadline. `parseShamsiToTs` is not used here.

UTC/local risk: the picker offset uses `new Date(toLocaleString(...))`, which is parsed in the **machine** timezone. On a non-Tehran OS this can shift the instant. Notification then uses raw epoch, so the bug is at store time, not at compare time.

----------------------------------------
NOTIFICATION PIPELINE
----------------------------------------

Exact current flow:

1. Due condition: `status==='open' && notify && !notifiedAt && (!deadlineTS || deadlineTS <= Date.now())`.
2. Gate: `desktopNotifyAllowed()` — true if EXE host flag, or `laegh_desktop_notify_on==='1'`, or `Notification.permission==='granted'`. If false, function returns and **does not** write `notifiedAt`.
3. `showLaeghNotification(title, opts)`:
   - plays in-page chime unless EXE host (EXE plays its own).
   - calls `pushWindowsNotifyBridge` inside try/catch and sets `ok = true` even if the bridge did not deliver.
   - if Web `Notification` granted: `new Notification(...)`, else SW `showNotification` if registered.
4. `pushWindowsNotifyBridge`:
   - EXE: `sirmanDesktopNotify` → Host `Notify` / WebView2 `postMessage({type:'notify'})` → `NotifyBridgeService.ShowToast` (WinRT toast or tray balloon). Returns early if that path reports true.
   - else `fetch POST http://127.0.0.1:{port}/notify` **fire-and-forget** (`.catch` empty). Port from Host `GetNotifyPort()` or 8766.
   - always appends to `localStorage laegh_win_notify_q` (max 40). **No consumer of this queue was found.**
5. `checkDueTasksForNotification` then sets `t.notifiedAt = Date.now()` and `svTasks()` **unconditionally**. Return value of `showLaeghNotification` is ignored.

Frequency: `setInterval(..., 60000)` plus immediate calls from auto-task sync, enable-notify, and boot `autoEnableDesktopNotifyOnBoot`. SW may also run `periodicsync` `laegh-task-check` at min 30 minutes (best-effort; comments in code say closed browser is not guaranteed).

`notifiedAt` is written **before/without** known delivery success.

Web Notification failure does not block the desktop attempt. Desktop/bridge failure does **not** prevent `notifiedAt`. Duplicate web+desktop toasts can occur when both channels work.

In-app `ntf()` is a 3-second HTML toast; task due path does not call it (warranty SLA path does).

----------------------------------------
FAILURE MODES
----------------------------------------

Application closed:
Timers stop. SW periodic sync is best-effort and only notifies tasks that have `deadlineTS` (auto tasks with null deadline are skipped in `sw.js`). Toast while fully closed is not guaranteed.

Computer sleep:
No `visibilitychange` / `pageshow` handler for tasks. `setInterval` is paused; after wake the next 60s tick may fire (browser-dependent). Sleep through deadline while the app is alive is usually recovered on the next interval; while fully stopped it is the same as “closed”.

NotifyBridge unavailable:
`fetch` fails silently. EXE can still toast via Host/postMessage. `ok` is still treated as success; `notifiedAt` is still set. Missed toast is not retried.

Port 8766 occupied:
.NET `NotifyBridgeService.Start` probes 8766–8785; Host `GetNotifyPort` exposes the real port. `sirman_run.ps1` skips the PS1 listener if 8766 is in use (“probably Sirman.exe”). HTML using Host follows the real port. HTML without Host still posts to 8766 and can miss EXE’s relocated port. Tests cover this bind/port mapping.

Web Notification denied:
Ignored if desktop/host flag is on. If only browser path exists and permission is denied, `desktopNotifyAllowed` is false → no `notifiedAt` → retries every 60s until allowed.

Windows notification disabled:
Code cannot see Focus Assist / toast policy. `ShowToast` / WinRT / balloon failures are swallowed. `notifiedAt` still set if the JS gate was open.

Restart after deadline:
Tasks reload from `laegh_tasks`. If `notifiedAt` was saved, no re-fire. If app was closed before the due check, boot `checkDueTasksForNotification` will fire. Race: `syncNotifiedFromIDB()` is async and **not awaited** before boot notify; SW may have written IDB `notifiedAt` while localStorage still has null → duplicate possible.

`notifiedAt` already exists:
Skipped forever until deadline is edited (clears it) or the auto task is deleted and recreated.

System clock changes:
Forward jump: next tick notifies all due without `notifiedAt`. Backward jump: already-notified tasks stay silent.

Deadline edited:
`notifiedAt = null` → will notify again when due.

Completed before notification:
`status==='done'` skipped. Auto task is not recreated while source still matches.

Deleted before notification:
Gone. Auto source still open → recreated later and notified.

Multiple tasks due at once:
`forEach` notifies all in the same tick; each gets its own `notifiedAt`. No batching beyond that.

----------------------------------------
RETRY SEMANTICS
----------------------------------------

There is **no delivery retry**.

- Failure after `notifiedAt` is written: never retried.
- Failure because `desktopNotifyAllowed` is false: retried every 60 seconds (gate only).
- Retry is not persisted as a counter.
- Restart recovers **missed** notifications only if `notifiedAt` is still null.
- Restart does **not** recover failed toasts if `notifiedAt` was already set.
- There is **no distinction** between “attempted” and “successfully delivered”. `notifiedAt` means “JS decided to call show once”.

SW writes `notifiedAt` to IndexedDB only; page later copies it one-way (IDB → memory if memory is empty).

----------------------------------------
DUPLICATION ANALYSIS
----------------------------------------

Same task, one PC:

- 60s timer + auto-sync immediate check: `notifiedAt` usually blocks repeats.
- Event Bus dashboard refresh does **not** call `checkDueTasksForNotification`.
- Web + desktop both on → two toasts for one logical reminder.
- EXE host toast + leftover fetch to 8766: HTML returns after `sirmanDesktopNotify` true, so double desktop is unlikely on EXE.
- Recreate auto task (delete, or close+reopen source) → new `notifiedAt: null` → another toast.
- Boot race with SW IDB vs localStorage → possible duplicate after restart.
- Notification `tag` is `id + hour-bucket` on the page and `id` in SW; this may collapse OS toasts but does not stop JS from sending.

`notifiedAt` is sufficient to stop the **timer loop**, not sufficient as a delivery receipt, and not sufficient across recreate / two PCs / SW race.

----------------------------------------
AUTO TASK INTERACTION
----------------------------------------

`syncAllAutoTasks` / the four sync functions **write the `tasks` array** and call `svTasks()`. They do not write invoices, stock movements, accounts, or warranty status.

They can:

- Recreate a task after the user deleted it → notification loop if the source is still open.
- Delete a task when invoice/warranty closes or stock recovers or backup is fresh — including after it was already notified.
- Not change deadline (auto tasks have `deadlineTS: null`).
- Not reset `notifiedAt` on an **existing** matching auto task.
- Reset notification state indirectly by delete+recreate.
- Not create colliding random IDs; auto IDs are deterministic per source.
- Call `checkDueTasksForNotification` immediately when the list changed → first notify can happen at sync time (2.5s after load, or up to 5 minutes after creating an invoice, because `invoice:saved` does not sync).

They do not by themselves overwrite `notifiedAt` on a still-linked open auto task. Completing an auto task (`done`) also prevents notify and prevents recreate.

`checkWarrantySlaAlerts` is a **separate** hourly loop. It writes `warranty.companyWork.slaLastAlertAt` via `svWars()`. It must not be used as the task-reminder fix.

----------------------------------------
PERSISTENCE
----------------------------------------

- Primary: `localStorage laegh_tasks` via `svTasks()` + `markDirty()`.
- Mirror: IndexedDB for SW (full task objects). `syncNotifiedFromIDB` only copies `notifiedAt` IDB → live.
- Backup JSON: `tasks` array including `notifiedAt`. Replace restore replaces the array. Merge restore **adds only missing ids**; existing local task (and its `notifiedAt`) is kept; incoming `notifiedAt` is ignored.
- Pref: `laegh_desktop_notify_on` in localStorage and prefs bundle.
- Dead queue: `laegh_win_notify_q`.
- `CurrentJsonStore` does **not** persist tasks (invoice/inventory/customer/warranty/payment JSON merge only). No SQL.

Survives restart: yes, via localStorage.
Survives backup/restore replace: yes.
Survives merge / LAN pull: only as “add if new id”. Divergent `notifiedAt` on the same id is not merged.

----------------------------------------
LAN / MULTI-PC RISK
----------------------------------------

Each PC has its own localStorage/IDB. Phase 3.1 pull merge adds tasks the local PC does not already have by `id`.

PC A creates task → PC B pulls → both have the same id, both `notifiedAt: null`.
PC A notifies → local `notifiedAt` set. PC B still null → **PC B also notifies**.
If B later publishes, A already has the id so merge **does not** copy B’s state either.

This is duplicate notifications across stations. No network notification lock exists. Do not add REST or a second merge engine to “fix” this in Phase 3.3.

----------------------------------------
SECURITY / PERMISSIONS
----------------------------------------

- Browser Notification permission for the Web path.
- Windows toast / Focus Assist: OS-level; not checked in code.
- Host `Notify` and `GetNotifyPort` are **AlwaysAllowed** (no role). Isolated from invoice/print permissions.
- Tasks page is a role page (`operator` includes it). Timers still run even if the user cannot open the page.
- Failure is isolated: bridge/host/Web errors are swallowed; they do not throw into invoice/inventory code.
- `checkWarrantySlaAlerts` writing warranties is **not** isolated from warranty data (out of scope for this feature).

----------------------------------------
WINDOWS / WEBVIEW2
----------------------------------------

Code-verifiable:
- Pipeline wiring, `notifiedAt` write-before-ack, 60s/5min timers, port probe 8766–8785, Host `GetNotifyPort`, PS1 skip-if-busy, permission gate, SW/IDB race, merge skip-existing-id, tests that assert `notifiedAt` after a mocked `showLaeghNotification`.

Real Windows required:
- WebView2 `Notification` permission behavior.
- Actual WinRT toast vs tray balloon.
- Focus Assist / Windows notification settings.
- Sleep/resume of WebView2 timers.
- Dual Start.bat + Sirman.exe on one PC.
- Physical toast while the window is minimized or the process is closed.
- That `sirmanDesktopNotify` returns true on shop PCs.

Windows toast is **CODE-PRESENT, PHYSICAL_NOTIFY_NOT_VERIFIED** on this Linux audit host.

----------------------------------------
CURRENT TEST COVERAGE
----------------------------------------

Node (`test_laegh.js`):

- Auto invoice/warranty/low-stock/backup task create+remove.
- `checkDueTasksForNotification`: no-deadline auto invoice notifies once; future deadline does not; second run blocked by `notifiedAt` (mocked show function; does **not** test real delivery).
- Bridge called from `showLaeghNotification`; default URL 8766; Host port override; .NET `IsTcpPortFree`; PS1 `Test-SirmanPortFree`.
- `enableTaskNotifications` with live 8766 health (simulated).
- Distinct chime frequencies in HTML and `NotifyBridgeService`.
- Backup contains `tasks`; `svTasks` writes `laegh_tasks`.
- Dashboard overdue list still renders (Phase 3.2).
- `checkAlarms` old 5-minute toast removed.

.NET: **no** tests for NotifyBridge, toast, retry, or restart recovery.

----------------------------------------
MISSING TESTS
----------------------------------------

- `notifiedAt` must not be set if all delivery paths fail.
- Await/order: IDB `notifiedAt` applied before first boot check.
- Date-only deadline vs Tehran start-of-day / noon.
- Same-day past-time: list vs dashboard vs notify.
- Recreate auto task after delete while source still open → second notify.
- reopenTask keeps `notifiedAt` (no second notify).
- Deadline edit clears `notifiedAt`.
- Multiple simultaneous due tasks.
- `desktopNotifyAllowed` false does not stamp `notifiedAt`.
- Fire-and-forget fetch failure.
- SW vs page dual writer.
- Merge/LAN same-id different `notifiedAt`.
- `laegh_win_notify_q` never drained.
- Real Windows toast (manual / shop PC).

----------------------------------------
READ-ONLY / SIDE EFFECT ANALYSIS
----------------------------------------

READ-ONLY:
- `renderTasks`, `sameTehranDay`, `desktopNotifyAllowed`, `getNotifyBridgePort/Url`, `getDailyOperationsBriefSnapshot` (must not call notify writers).

WRITES TASK STATE:
- `saveTask`, `doneTask`, `reopenTask`, `delTask`, `delSelTasks`
- `syncOpenInvoiceTasks`, `syncOpenWarrantyTasks`, `syncLowInventoryTasks`, `syncBackupReminderTask`, `syncAllAutoTasks`
- `_afterAutoTaskSync` / `svTasks` / `mirrorTasksToIDB`

WRITES NOTIFICATION STATE:
- `checkDueTasksForNotification` (`notifiedAt` + `svTasks`)
- `syncNotifiedFromIDB` (`notifiedAt` + localStorage)
- `sw.js` `checkDueTasks` (IDB `notifiedAt`)
- `enableTaskNotifications` / `autoEnableDesktopNotifyOnBoot` (`laegh_desktop_notify_on`)
- `pushWindowsNotifyBridge` (`laegh_win_notify_q`)

WRITES OTHER BUSINESS DATA (do not call from a reminder fix):
- `checkWarrantySlaAlerts` / `startWarrantySlaAlerts` → **warranty** `slaLastAlertAt` + `svWars()`
- Auto-task sync **reads** invoices/warranties/inventory but does not mutate those records.

No invoice close/delete, stock reserve/consume, or accounting posting in the reminder path.

----------------------------------------
PROTECTED MODULE IMPACT
----------------------------------------

A scoped reminder-reliability fix (ack `notifiedAt`, boot IDB order, tests) can leave cores untouched.

Invoice:
UNCHANGED

Inventory:
UNCHANGED

Accounting:
UNCHANGED

Warranty:
UNCHANGED
(HIGH-RISK / REQUIRES EXPLICIT AUTHORIZATION if SLA alert writer is reused or modified)

Backup:
UNCHANGED
(HIGH-RISK if merge is changed to overwrite `notifiedAt`)

Print:
UNCHANGED

REST/SQL:
UNCHANGED

----------------------------------------
RECOMMENDED FIX
----------------------------------------

Must fix:
1. Set `notifiedAt` only after a known success: Host `Notify` true, or `fetch /notify` HTTP 200, or Web `Notification` constructed. Keep the existing field; do not add a scoring engine.
2. Finish `syncNotifiedFromIDB` before the first `checkDueTasksForNotification` on boot (no new timer).
3. Keep using the existing 60s interval and NotifyBridge; do not add a service, REST, SQL, or second queue processor unless draining `laegh_win_notify_q` after confirmed host/bridge success.

Nice to have:
- `visibilitychange` / `pageshow` → call existing `checkDueTasksForNotification`.
- Align date-only deadline with Tehran day start (reuse picker/TZ helpers; no `parseShamsiToTs`).
- Align dashboard overdue with `sameTehranDay` (display only).
- Stop SW from notifying when the page is the live writer, or copy `notifiedAt` back to localStorage from IDB before page notify.
- Optional: `invoice:saved` / `warranty:saved` also call existing `syncAllAutoTasks` (writes tasks only).

Out of scope:
- Multi-PC notification lock / LAN merge of `notifiedAt`
- New persistence architecture
- Rewriting NotifyBridge or changing port protocol
- Warranty SLA alerts
- Print, backup schema, invoice/inventory/accounting cores
- New reminder UI, export, or extra notification channels

----------------------------------------
COMPLEXITY
----------------------------------------

MEDIUM

REGRESSION RISK:
MEDIUM

(Ack-on-success can re-fire noisy toasts if success detection is wrong; auto-task recreate already can spam.)

----------------------------------------
IMPLEMENTATION SCOPE
----------------------------------------

Expected files:
- Sirman_Final.html
- Laegh_Final.html
- test_laegh.js
- sw.js only if the IDB/SW race is included

Files that MUST remain unchanged:
- Invoice identity / close / delete / reversal
- Inventory reserve / consume / reversal
- Accounting deposit / withdraw / reversal
- Warranty close / status workflow / SLA thresholds
- BackupEngine, migrateBackup, applyBackupSelective behavior
- Print module, IPrintService, WindowsPrintHost, PrintServiceAdapter
- REST / SQL / CurrentJsonStore schema
- NotifyBridge HTTP contract unless a proven bind bug appears (port fallback already exists)

----------------------------------------
FINAL STATUS
----------------------------------------

AUDIT:
COMPLETE

CODE CHANGES:
NONE

IMPLEMENTATION:
NOT STARTED

WAITING FOR IMPLEMENTATION AUTHORIZATION
========================================
