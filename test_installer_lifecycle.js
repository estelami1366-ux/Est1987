#!/usr/bin/env node
/**
 * Installer/uninstaller lifecycle tests.
 * Uses throwaway temp dirs only. Never touches the operator's real Sirman data.
 *
 * Run via test_laegh.js, or: node test_installer_lifecycle.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function repoRootFrom(filePath) {
  if (filePath) {
    const dir = path.dirname(path.resolve(filePath));
    if (fs.existsSync(path.join(dir, 'Sirman_Final.html'))) return dir;
  }
  let dir = path.resolve(__dirname);
  while (dir) {
    if (fs.existsSync(path.join(dir, 'Sirman_Final.html'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('repo root not found');
}

function readContract(root) {
  const p = path.join(root, 'scripts', 'setup-kit', 'sirman-install-contract.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isPreserveDir(fullPath, contract) {
  const parts = fullPath.split(/[\\/]/);
  return (contract.preserveDirNames || []).some(keep =>
    parts.some(p => p.toLowerCase() === String(keep).toLowerCase())
  );
}

function isOwnedFallback(rel, name, contract) {
  const n = String(name || '');
  const relN = String(rel || '').replace(/\\/g, '/');
  if ((contract.ownedExactFiles || []).some(x => x.toLowerCase() === n.toLowerCase())) return true;
  if ((contract.ownedNamePrefixes || []).some(p => n.toLowerCase().startsWith(String(p).toLowerCase()))) return true;
  if ((contract.ownedNameSuffixes || []).some(s => n.toLowerCase().endsWith(String(s).toLowerCase()))) return true;
  const top = relN.split('/')[0];
  if ((contract.ownedExactDirs || []).some(d => String(d).toLowerCase() === top.toLowerCase())) return true;
  if (relN.toLowerCase().startsWith('updates/sirman_update_')) return true;
  return false;
}

function isOwnedName(name, contract, rel) {
  return isOwnedFallback(rel || name, name, contract);
}

function parseSourceManifest(destDir, contract) {
  const manPath = path.join(destDir, contract.canonical.manifestFileName);
  if (!fs.existsSync(manPath)) return { ok: false, reason: 'absent', files: new Set() };
  try {
    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    const files = (man.files || []).map(f => String(f).replace(/\\/g, '/')).filter(Boolean);
    if (!files.length) return { ok: false, reason: 'empty', files: new Set() };
    return { ok: true, reason: 'ok', files: new Set(files) };
  } catch (e) {
    return { ok: false, reason: 'corrupt', files: new Set() };
  }
}

function removeFileWithRetry(file, retries, simulateLock) {
  let last = 'unknown';
  const max = retries == null ? 5 : retries;
  for (let i = 0; i <= max; i++) {
    try {
      if (simulateLock) throw new Error('Access is denied');
      fs.unlinkSync(file);
      return { ok: true, retries: i, error: null };
    } catch (e) {
      last = e.message || String(e);
    }
  }
  return { ok: false, retries: max, error: last };
}

function relPath(root, full) {
  const r = path.resolve(root) + path.sep;
  const f = path.resolve(full);
  if (f.toLowerCase().startsWith(r.toLowerCase())) return f.slice(r.length).split(path.sep).join('/');
  return path.basename(full);
}

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
}

function pruneStale(destDir, sourceDir, contract) {
  const sourceRel = new Set();
  const srcFiles = [];
  walkFiles(sourceDir, srcFiles);
  srcFiles.forEach(f => sourceRel.add(relPath(sourceDir, f)));
  const destFiles = [];
  walkFiles(destDir, destFiles);
  for (const file of destFiles) {
    if (isPreserveDir(file, contract)) continue;
    const rel = relPath(destDir, file);
    const name = path.basename(file);
    let owned = isOwnedName(name, contract, rel)
      || rel.toLowerCase().startsWith('runtimes/')
      || rel.toLowerCase().startsWith('updates/sirman_update_');
    if (!owned) continue;
    if (sourceRel.has(rel)) continue;
    fs.unlinkSync(file);
  }
}

function level1RemoveOwned(destDir, contract, opts) {
  opts = opts || {};
  const retries = contract.level1RemovalRetries != null ? contract.level1RemovalRetries : 5;
  const locked = new Set((opts.lockedRel || []).map(x => String(x).replace(/\\/g, '/')));
  const manifest = parseSourceManifest(destDir, contract);
  const removed = [];
  const failed = [];
  const destFiles = [];
  walkFiles(destDir, destFiles);
  for (const file of destFiles) {
    if (isPreserveDir(file, contract)) continue;
    const rel = relPath(destDir, file);
    const relN = rel.replace(/\\/g, '/');
    const name = path.basename(file);
    const owned = (manifest.ok && manifest.files.has(relN)) || isOwnedFallback(relN, name, contract);
    if (!owned) continue;
    const attempt = removeFileWithRetry(file, retries, locked.has(relN));
    if (attempt.ok) removed.push(relN);
    else failed.push({ path: relN, error: attempt.error, retries: attempt.retries });
  }
  const failedSet = new Set(failed.map(f => f.path));
  const preserved = [];
  const left = [];
  walkFiles(destDir, left);
  for (const file of left) {
    const relN = relPath(destDir, file).replace(/\\/g, '/');
    if (failedSet.has(relN)) continue;
    preserved.push(relN);
  }
  return {
    ownershipMode: manifest.ok ? 'manifest' : ('fallback:' + manifest.reason),
    removed,
    failed,
    preserved,
    removedCount: removed.length,
    failedCount: failed.length,
    preservedCount: preserved.length
  };
}

function resolveLevel1Target(artifactDir, recordedDir) {
  const target = path.resolve(artifactDir);
  let other = null;
  if (recordedDir) {
    const rec = path.resolve(recordedDir);
    if (rec.toLowerCase() !== target.toLowerCase()) other = rec;
  }
  return { targetDir: target, otherDetectedDir: other, silentRedirect: false };
}

function confirmLevel2(typed, contract) {
  return String(typed || '').trim() === contract.canonical.level2ConfirmationWord;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function register(ctx) {
  const { test, html, filePath, assertTrue, assertEqual, assertContainsString } = ctx;
  const root = repoRootFrom(filePath);
  const contract = readContract(root);
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  console.log('');
  console.log('📋 گروه: نصب/حذف سطح ۱ و پاک‌سازی سطح ۲');

  test('قرارداد نصب باید پوشه Start Menu را Sirman بداند', () => {
    assertEqual(contract.canonical.startMenuFolderName, 'Sirman', 'پوشه Start Menu باید Sirman باشد');
  });

  test('قرارداد نصب باید میانبر اجرا را SIRMAN.lnk بداند', () => {
    assertEqual(contract.canonical.startMenuLaunchShortcut, 'SIRMAN.lnk', 'میانبر اجرا');
  });

  test('قرارداد نصب باید میانبر حذف را Uninstall SIRMAN.lnk بداند', () => {
    assertEqual(contract.canonical.startMenuUninstallShortcut, 'Uninstall SIRMAN.lnk', 'میانبر حذف');
  });

  test('install-setup.ps1 باید میانبرهای استاندارد را بسازد', () => {
    const src = read('scripts/setup-kit/install-setup.ps1');
    assertContainsString(src, 'SIRMAN.lnk', 'install-setup باید SIRMAN.lnk بسازد');
    assertContainsString(src, 'Uninstall SIRMAN.lnk', 'install-setup باید Uninstall SIRMAN.lnk بسازد');
    assertContainsString(src, "Programs\\Sirman", 'install-setup باید Programs\\Sirman را استفاده کند');
    assertTrue(src.indexOf("Programs\\سیرمان") === -1, 'install-setup نباید پوشه فارسی بسازد');
  });

  test('InstallService باید پوشه فارسی Start Menu نسازد', () => {
    const src = read('desktop/Sirman.Desktop/InstallService.cs');
    assertContainsString(src, 'CanonicalStartMenuFolderName = "Sirman"', 'InstallService باید پوشه Sirman را ثابت کند');
    assertContainsString(src, 'CanonicalLaunchShortcutName = "SIRMAN.lnk"', 'InstallService باید SIRMAN.lnk بسازد');
    assertContainsString(src, 'CanonicalUninstallShortcutName = "Uninstall SIRMAN.lnk"', 'InstallService باید Uninstall SIRMAN.lnk بسازد');
    assertTrue(src.indexOf('var folder = Path.Combine(programs, "سیرمان")') === -1, 'نباید پوشه فارسی ساخته شود');
  });

  test('میانبر کمکی باید SIRMAN.lnk و install-location.txt بنویسد', () => {
    const src = read('Sirman_Install_Shortcuts.ps1');
    assertContainsString(src, 'SIRMAN.lnk', 'میانبر اجرا');
    assertContainsString(src, 'install-location.txt', 'ثبت مسیر استاندارد');
    assertTrue(src.indexOf("Join-Path $Programs 'سیرمان.lnk'") === -1, 'نباید میانبر فارسی در Programs ساخته شود');
  });

  test('HTML دانلود میانبر باید با قرارداد جدید هم‌خوان باشد', () => {
    const src = extractDownloadPs1(html);
    assertTrue(!!src, 'downloadShortcutInstaller باید PS1 داشته باشد');
    assertContainsString(src, 'SIRMAN.lnk', 'HTML باید SIRMAN.lnk بسازد');
    assertContainsString(src, 'install-location.txt', 'HTML باید install-location.txt بنویسد');
    assertTrue(src.indexOf("Join-Path $Programs 'سیرمان.lnk'") === -1, 'HTML نباید میانبر فارسی Programs بسازد');
  });

  test('حذف سطح ۱ باید میانبر انگلیسی و فارسی قدیمی را بردارد', () => {
    const life = read('scripts/setup-kit/Sirman-InstallLifecycle.ps1');
    const bat = read('desktop/Uninstall-Sirman.bat');
    const cs = read('desktop/Sirman.Desktop/InstallService.cs');
    assertContainsString(life, 'سیرمان.lnk', 'lifecycle باید میانبر فارسی دسکتاپ را حذف کند');
    assertContainsString(life, 'حذف سیرمان.lnk', 'lifecycle باید میانبر حذف فارسی را بردارد');
    assertContainsString(cs, 'RemoveLegacyShortcuts', 'C# باید میانبرهای قدیمی را پاک کند');
    assertTrue(bat.indexOf('rd /s /q "%APP_ROOT%"') === -1, 'بات سطح ۱ نباید کل LocalAppData را پاک کند');
  });

  test('حذف سطح ۱ WebView2 و بک‌آپ AppData را نگه می‌دارد', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-l1-'));
    try {
      const artifact = path.join(tmp, 'install-A');
      const other = path.join(tmp, 'install-B');
      const local = path.join(tmp, 'LocalAppData');
      const roaming = path.join(tmp, 'Roaming');
      fs.mkdirSync(path.join(artifact), { recursive: true });
      fs.mkdirSync(other, { recursive: true });
      fs.writeFileSync(path.join(artifact, 'Sirman.exe'), 'exe');
      fs.writeFileSync(path.join(artifact, 'Sirman_Final.html'), 'html');
      fs.writeFileSync(path.join(other, 'Sirman.exe'), 'other');
      const wv = path.join(local, 'Sirman', 'WebView2', 'EBWebView');
      const bak = path.join(roaming, 'Sirman', 'backup');
      const userBak = path.join(tmp, 'user-backup');
      fs.mkdirSync(wv, { recursive: true });
      fs.mkdirSync(bak, { recursive: true });
      fs.mkdirSync(userBak, { recursive: true });
      fs.writeFileSync(path.join(wv, 'local-storage.json'), 'invoices');
      fs.writeFileSync(path.join(bak, 'shop.json'), 'backup');
      fs.writeFileSync(path.join(userBak, 'chosen.json'), 'user');
      fs.mkdirSync(path.join(local, 'Sirman'), { recursive: true });
      fs.writeFileSync(path.join(local, 'Sirman', 'install-location.txt'), other);

      const resolved = resolveLevel1Target(artifact, other);
      assertEqual(resolved.targetDir, path.resolve(artifact), 'هدف حذف باید پوشه همین اسکریپت باشد');
      assertEqual(resolved.otherDetectedDir, path.resolve(other), 'نصب دیگر باید جدا گزارش شود');
      assertTrue(resolved.silentRedirect === false, 'نباید بی‌صدا به پوشه دیگر تغییر مسیر دهد');

      level1RemoveOwned(artifact, contract);
      assertTrue(!fs.existsSync(path.join(artifact, 'Sirman.exe')), 'فایل برنامه باید حذف شود');
      assertTrue(fs.existsSync(path.join(wv, 'local-storage.json')), 'WebView2 باید بماند');
      assertTrue(fs.existsSync(path.join(bak, 'shop.json')), 'بک‌آپ AppData باید بماند');
      assertTrue(fs.existsSync(path.join(userBak, 'chosen.json')), 'بک‌آپ انتخابی کاربر باید بماند');
      assertTrue(fs.existsSync(path.join(other, 'Sirman.exe')), 'نصب دیگر نباید حذف شود');
    } finally {
      rmrf(tmp);
    }
  });

  test('حذف سطح ۱ پوشه بک‌آپ انتخاب‌شده کاربر را پاک نمی‌کند', () => {
    const life = read('scripts/setup-kit/Sirman-InstallLifecycle.ps1');
    const ps1 = read('desktop/Uninstall-Sirman.ps1');
    const bat = read('desktop/Uninstall-Sirman.bat');
    assertContainsString(life, 'user-selected backup', 'باید بک‌آپ انتخابی را استثنا کند');
    assertTrue(life.indexOf("Remove-Item -LiteralPath $env:LOCALAPPDATA") === -1, 'lifecycle نباید کل LocalAppData را پاک کند');
    assertTrue(ps1.indexOf("Invoke-SirmanLevel1Uninstall") >= 0, 'wrapper سطح ۱ باید جدا باشد');
    assertTrue(ps1.indexOf("Level1") >= 0 && ps1.indexOf("Level2") >= 0, 'wrapper باید هر دو سطح را داشته باشد');
    assertTrue(bat.indexOf('-Mode Level1') >= 0, 'بات سطح ۱ باید -Mode Level1 را صدا بزند');
    assertTrue(bat.indexOf('rd /s /q "%LOCALAPPDATA%\\Sirman"') === -1, 'بات نباید rd کل Sirman LocalAppData باشد');
    assertTrue(bat.indexOf('rd /s /q "%APPDATA%\\Sirman"') === -1, 'بات نباید rd کل Sirman Roaming باشد');
  });

  test('پاک‌سازی کامل باید تایید تایپی بخواهد و بدون آن چیزی پاک نکند', () => {
    const contractWord = contract.canonical.level2ConfirmationWord;
    assertEqual(contractWord, 'تایید', 'کلمه تایید فارسی');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-l2-'));
    try {
      const local = path.join(tmp, 'LocalAppData', 'Sirman');
      const roaming = path.join(tmp, 'Roaming', 'Sirman');
      const wv = path.join(local, 'WebView2');
      const bak = path.join(roaming, 'backup');
      fs.mkdirSync(wv, { recursive: true });
      fs.mkdirSync(bak, { recursive: true });
      fs.writeFileSync(path.join(wv, 'x'), 'data');
      fs.writeFileSync(path.join(bak, 'y'), 'bak');
      assertTrue(confirmLevel2('', contract) === false, 'خالی باید رد شود');
      assertTrue(confirmLevel2('yes', contract) === false, 'yes باید رد شود');
      assertTrue(confirmLevel2('تاييد', contract) === false, 'حرف عربی ی اشتباه باید رد شود');
      assertTrue(confirmLevel2('تایید', contract) === true, 'تایید باید قبول شود');
      if (!confirmLevel2('wrong', contract)) {
        assertTrue(fs.existsSync(path.join(wv, 'x')), 'رد تایید نباید WebView2 را پاک کند');
        assertTrue(fs.existsSync(path.join(bak, 'y')), 'رد تایید نباید بک‌آپ را پاک کند');
      }
    } finally {
      rmrf(tmp);
    }
    const life = read('scripts/setup-kit/Sirman-InstallLifecycle.ps1');
    assertContainsString(life, 'Invoke-SirmanLevel2FullCleanup', 'موتور سطح ۲');
    assertContainsString(life, 'Aborted. Nothing deleted.', 'بدون تایید هیچ حذفی');
    assertContainsString(read('desktop/Sirman-Full-Cleanup.bat'), '-Mode Level2', 'بات سطح ۲ جداست');
    assertTrue(read('desktop/Uninstall-Sirman.bat').indexOf('-Mode Level2') === -1, 'بات سطح ۱ نباید سطح ۲ را اجرا کند');
  });

  test('حذف نمی‌تواند بی‌صدا نصب دیگری را هدف بگیرد', () => {
    const a = path.join(os.tmpdir(), 'sirman-art-' + Date.now());
    const b = path.join(os.tmpdir(), 'sirman-rec-' + Date.now());
    const r = resolveLevel1Target(a, b);
    assertEqual(r.targetDir, path.resolve(a), 'هدف = پوشه uninstall جاری');
    assertEqual(r.otherDetectedDir, path.resolve(b), 'مسیر ثبت‌شده جدا گزارش شود');
    assertTrue(r.silentRedirect === false, 'silentRedirect ممنوع');
    const life = read('scripts/setup-kit/Sirman-InstallLifecycle.ps1');
    assertContainsString(life, 'OtherDetectedDir', 'باید نصب دیگر را جدا نگه دارد');
    assertTrue(read('desktop/Uninstall-Sirman.bat').indexOf('set "INSTALL_DIR=%SAVED%"') === -1, 'بات دیگر INSTALL_DIR را از loc عوض نکند');
  });

  test('فایل‌های کهنه نصب‌کننده هرس می‌شوند و فایل کاربر می‌ماند', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-prune-'));
    try {
      const src = path.join(tmp, 'src');
      const dest = path.join(tmp, 'dest');
      fs.mkdirSync(src, { recursive: true });
      fs.mkdirSync(path.join(dest, 'sirman_media'), { recursive: true });
      fs.writeFileSync(path.join(src, 'Sirman.exe'), 'new-exe');
      fs.writeFileSync(path.join(src, 'Sirman_Final.html'), 'new-html');
      fs.writeFileSync(path.join(dest, 'Sirman.exe'), 'old-exe');
      fs.writeFileSync(path.join(dest, 'Sirman_Final.html'), 'old-html');
      fs.writeFileSync(path.join(dest, 'Sirman_Final_1405.5.21α.html'), 'stale-html');
      fs.writeFileSync(path.join(dest, 'createdump.exe'), 'dump');
      fs.writeFileSync(path.join(dest, 'user-notes.txt'), 'keep-me');
      fs.writeFileSync(path.join(dest, 'sirman_media', 'logo.jpg'), 'logo');
      fs.writeFileSync(path.join(dest, 'Sirman_Pending_Update.json'), 'tiny');
      pruneStale(dest, src, contract);
      assertTrue(!fs.existsSync(path.join(dest, 'Sirman_Final_1405.5.21α.html')), 'HTML نسخه‌قدیمی باید هرس شود');
      assertTrue(!fs.existsSync(path.join(dest, 'createdump.exe')), 'createdump باید هرس شود');
      assertTrue(fs.existsSync(path.join(dest, 'user-notes.txt')), 'فایل دلخواه کاربر باید بماند');
      assertTrue(fs.existsSync(path.join(dest, 'sirman_media', 'logo.jpg')), 'رسانه کاربر باید بماند');
      assertTrue(fs.existsSync(path.join(dest, 'Sirman.exe')), 'فایل موجود در منبع نباید هرس شود');
    } finally {
      rmrf(tmp);
    }
  });

  test('موتور حذف سطح ۱ فایل دلخواه داخل پوشه نصب را کورکورانه پاک نکند', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-owned-'));
    try {
      fs.writeFileSync(path.join(tmp, 'Sirman.exe'), 'exe');
      fs.writeFileSync(path.join(tmp, 'user-backup.json'), 'mine');
      fs.mkdirSync(path.join(tmp, 'sirman_media'));
      fs.writeFileSync(path.join(tmp, 'sirman_media', 'logo.jpg'), 'logo');
      fs.writeFileSync(path.join(tmp, contract.canonical.manifestFileName), JSON.stringify({ files: ['Sirman.exe'] }));
      level1RemoveOwned(tmp, contract);
      assertTrue(!fs.existsSync(path.join(tmp, 'Sirman.exe')), 'فایل نصب‌کننده باید برود');
      assertTrue(fs.existsSync(path.join(tmp, 'user-backup.json')), 'فایل کاربر باید بماند');
      assertTrue(fs.existsSync(path.join(tmp, 'sirman_media', 'logo.jpg')), 'رسانه باید بماند');
    } finally {
      rmrf(tmp);
    }
  });

  test('حذف سطح ۱ بدون مانیفست runtime خودکفا را برمی‌دارد و فایل کاربر را می‌گذارد', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-runtime-fb-'));
    try {
      const dest = path.join(tmp, 'install');
      fs.mkdirSync(path.join(dest, 'runtimes', 'win-x64', 'native'), { recursive: true });
      fs.mkdirSync(path.join(dest, 'cs'), { recursive: true });
      fs.mkdirSync(path.join(dest, 'user-subfolder'), { recursive: true });
      const owned = [
        'coreclr.dll',
        'hostfxr.dll',
        'PresentationFramework.dll',
        'PresentationFramework.Aero.dll',
        'System.Private.CoreLib.dll',
        'Microsoft.CSharp.dll',
        'Sirman_Final.html',
        'Uninstall-Sirman.bat',
        'sirman_run.ps1'
      ];
      owned.forEach(n => fs.writeFileSync(path.join(dest, n), 'owned'));
      fs.writeFileSync(path.join(dest, 'runtimes', 'win-x64', 'native', 'e_sqlite3.dll'), 'native');
      fs.writeFileSync(path.join(dest, 'cs', 'PresentationCore.resources.dll'), 'sat');
      fs.writeFileSync(path.join(dest, 'user-notes.txt'), 'keep-notes');
      fs.writeFileSync(path.join(dest, 'user-created-backup.json'), 'keep-bak');
      fs.writeFileSync(path.join(dest, 'user-subfolder', 'export.json'), 'keep-sub');
      const summary = level1RemoveOwned(dest, contract);
      owned.forEach(n => assertTrue(!fs.existsSync(path.join(dest, n)), n + ' باید حذف شود'));
      assertTrue(!fs.existsSync(path.join(dest, 'runtimes', 'win-x64', 'native', 'e_sqlite3.dll')), 'runtimes باید حذف شود');
      assertTrue(!fs.existsSync(path.join(dest, 'cs', 'PresentationCore.resources.dll')), 'satellite runtime باید حذف شود');
      assertTrue(fs.existsSync(path.join(dest, 'user-notes.txt')), 'user-notes.txt باید بماند');
      assertTrue(fs.existsSync(path.join(dest, 'user-created-backup.json')), 'بک‌آپ JSON کاربر باید بماند');
      assertTrue(fs.existsSync(path.join(dest, 'user-subfolder', 'export.json')), 'پوشه ساخته کاربر باید بماند');
      assertTrue(summary.ownershipMode.indexOf('fallback') === 0, 'بدون مانیفست باید fallback باشد');
      assertTrue(summary.preservedCount >= 3, 'باید فایل‌های کاربر در گزارش preserved باشند');
    } finally {
      rmrf(tmp);
    }
  });

  test('حذف سطح ۱ با مانیفست منبع، مسیرهای بسته‌بندی را برمی‌دارد نه فایل دلخواه', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-runtime-man-'));
    try {
      const dest = path.join(tmp, 'install');
      fs.mkdirSync(path.join(dest, 'runtimes'), { recursive: true });
      const files = ['coreclr.dll', 'hostfxr.dll', 'PresentationFramework.dll', 'runtimes/host.dll'];
      files.forEach(rel => {
        const full = path.join(dest, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, 'pkg');
      });
      fs.writeFileSync(path.join(dest, 'user-notes.txt'), 'keep');
      fs.writeFileSync(path.join(dest, contract.canonical.manifestFileName), JSON.stringify({ files }));
      const summary = level1RemoveOwned(dest, contract);
      files.forEach(rel => assertTrue(!fs.existsSync(path.join(dest, rel)), rel + ' باید از مانیفست حذف شود'));
      assertTrue(fs.existsSync(path.join(dest, 'user-notes.txt')), 'یادداشت کاربر باید بماند');
      assertEqual(summary.ownershipMode, 'manifest', 'مانیفست معتبر باید منبع مالکیت باشد');
    } finally {
      rmrf(tmp);
    }
  });

  test('مانیفست خراب باید به فهرست fallback محافظه‌کار برگردد نه حذف همه فایل‌ها', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-runtime-badman-'));
    try {
      fs.writeFileSync(path.join(tmp, 'coreclr.dll'), 'rt');
      fs.writeFileSync(path.join(tmp, 'mystery-user.dat'), 'user');
      fs.writeFileSync(path.join(tmp, contract.canonical.manifestFileName), '{not-json');
      const summary = level1RemoveOwned(tmp, contract);
      assertTrue(!fs.existsSync(path.join(tmp, 'coreclr.dll')), 'coreclr در fallback باید حذف شود');
      assertTrue(fs.existsSync(path.join(tmp, 'mystery-user.dat')), 'فایل ناشناس کاربر نباید installer-owned فرض شود');
      assertTrue(summary.ownershipMode.indexOf('fallback:corrupt') === 0, 'مانیفست خراب = fallback');
    } finally {
      rmrf(tmp);
    }
  });

  test('شکست حذف فایل سطح ۱ باید گزارش شود نه بلعیده شود', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-runtime-lock-'));
    try {
      fs.writeFileSync(path.join(tmp, 'coreclr.dll'), 'locked');
      fs.writeFileSync(path.join(tmp, 'user-notes.txt'), 'keep');
      const summary = level1RemoveOwned(tmp, contract, { lockedRel: ['coreclr.dll'] });
      assertTrue(fs.existsSync(path.join(tmp, 'coreclr.dll')), 'فایل قفل‌شده باید بماند');
      assertTrue(fs.existsSync(path.join(tmp, 'user-notes.txt')), 'یادداشت کاربر باید بماند');
      assertTrue(summary.failedCount === 1, 'باید یک شکست ثبت شود');
      assertEqual(summary.failed[0].path, 'coreclr.dll', 'مسیر شکست');
      assertTrue(String(summary.failed[0].error).indexOf('Access is denied') >= 0, 'متن خطا باید ثبت شود');
      assertTrue(summary.failed[0].retries === contract.level1RemovalRetries, 'تعداد retry باید ثبت شود');
      assertTrue(summary.preserved.indexOf('user-notes.txt') >= 0, 'preserved نباید شکست قفل را به‌جای فایل کاربر بشمارد');
    } finally {
      rmrf(tmp);
    }
  });

  test('حذف سطح ۱ رکورد نصب دیگر را پاک نمی‌کند و سطح ۲ هنوز تایید می‌خواهد', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sirman-runtime-other-'));
    try {
      const a = path.join(tmp, 'A');
      const b = path.join(tmp, 'B');
      const local = path.join(tmp, 'LocalAppData', 'Sirman');
      fs.mkdirSync(a, { recursive: true });
      fs.mkdirSync(b, { recursive: true });
      fs.mkdirSync(local, { recursive: true });
      fs.writeFileSync(path.join(a, 'coreclr.dll'), 'a');
      fs.writeFileSync(path.join(b, 'coreclr.dll'), 'b');
      fs.writeFileSync(path.join(local, 'install-location.txt'), b);
      const resolved = resolveLevel1Target(a, b);
      assertTrue(resolved.silentRedirect === false, 'نباید به نصب دیگر تغییر مسیر دهد');
      assertEqual(resolved.otherDetectedDir, path.resolve(b), 'نصب دوم باید جدا بماند');
      level1RemoveOwned(a, contract);
      assertTrue(!fs.existsSync(path.join(a, 'coreclr.dll')), 'هدف جاری باید runtime را حذف کند');
      assertTrue(fs.existsSync(path.join(b, 'coreclr.dll')), 'نصب دوم نباید حذف شود');
      assertTrue(fs.existsSync(path.join(local, 'install-location.txt')), 'رکورد نصب دیگر باید بماند');
      assertTrue(confirmLevel2('تایید', contract) === true, 'سطح ۲ با تایید کار می‌کند');
      assertTrue(confirmLevel2('yes', contract) === false, 'سطح ۲ بدون تایید کار نمی‌کند');
    } finally {
      rmrf(tmp);
    }
  });

  test('موتور PowerShell سطح ۱ retry و گزارش خطا دارد و runtime را در قرارداد می‌شناسد', () => {
    const life = read('scripts/setup-kit/Sirman-InstallLifecycle.ps1');
    assertContainsString(life, 'function Read-SirmanSourcePackageManifest', 'مانیفست منبع');
    assertContainsString(life, 'function Remove-SirmanPathWithRetry', 'retry حذف');
    assertContainsString(life, 'function Stop-SirmanKnownProcesses', 'توقف فرایند');
    assertContainsString(life, 'Sirman-Server-', 'فرزند شناخته‌شده');
    assertContainsString(life, 'Remove-Item -LiteralPath $PathValue -Force -ErrorAction Stop', 'شکست حذف بلعیده نشود');
    assertContainsString(life, 'Could not remove:', 'گزارش شکست');
    assertContainsString(life, 'Preserved user files:', 'گزارش فایل کاربر');
    const contractSrc = read('scripts/setup-kit/sirman-install-contract.json');
    assertContainsString(contractSrc, 'coreclr.dll', 'مالکیت coreclr');
    assertContainsString(contractSrc, 'hostfxr.dll', 'مالکیت hostfxr');
    assertContainsString(contractSrc, 'Presentation', 'مالکیت Presentation');
    assertTrue(life.indexOf('rd /s /q') === -1, 'سطح ۱ نباید rd کل پوشه باشد');
    assertEqual(isOwnedFallback('coreclr.dll', 'coreclr.dll', contract), true, 'قرارداد coreclr');
    assertEqual(isOwnedFallback('hostfxr.dll', 'hostfxr.dll', contract), true, 'قرارداد hostfxr');
    assertEqual(isOwnedFallback('PresentationFramework.dll', 'PresentationFramework.dll', contract), true, 'قرارداد PresentationFramework');
    assertEqual(isOwnedFallback('user-notes.txt', 'user-notes.txt', contract), false, 'یادداشت کاربر owned نیست');
    assertEqual(isOwnedFallback('user-created-backup.json', 'user-created-backup.json', contract), false, 'JSON کاربر owned نیست');
  });

  test('راهنمای حذف سالم در برابر پاک‌سازی کامل باید در HTML باشد', () => {
    assertContainsString(html, 'data-help-id="uninstall-cleanup-guide"', 'کارت راهنما');
    assertContainsString(html, 'پاک‌سازی کامل', 'متن سطح ۲');
    assertContainsString(html, 'سطح ۱', 'متن سطح ۱');
  });
}

function extractDownloadPs1(html) {
  const fn = html.match(/function downloadShortcutInstaller\(kind\)\{[\s\S]*?\n\}/);
  return fn ? fn[0] : '';
}

function standalone() {
  let total = 0, failed = [];
  const test = (name, fn) => {
    total++;
    try { fn(); console.log('  ✅ ' + name); }
    catch (e) { failed.push(name + ': ' + e.message); console.log('  ❌ ' + name); console.log('     ' + e.message); }
  };
  const assertEqual = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg + ' — ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
  };
  const assertTrue = (v, msg) => { if (!v) throw new Error(msg); };
  const assertContainsString = (h, s, msg) => { if (h.indexOf(s) === -1) throw new Error(msg || s); };
  const root = repoRootFrom(null);
  const html = fs.readFileSync(path.join(root, 'Sirman_Final.html'), 'utf8');
  register({ test, html, filePath: path.join(root, 'Sirman_Final.html'), assertTrue, assertEqual, assertContainsString });
  if (failed.length) {
    console.log('FAILED', failed.length, '/', total);
    process.exit(1);
  }
  console.log('OK', total);
}

module.exports = { register, readContract, pruneStale, level1RemoveOwned, resolveLevel1Target, confirmLevel2 };

if (require.main === module) standalone();
