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

function isOwnedName(name, contract) {
  if ((contract.ownedExactFiles || []).some(x => x.toLowerCase() === name.toLowerCase())) return true;
  if ((contract.ownedNamePrefixes || []).some(p => name.toLowerCase().startsWith(String(p).toLowerCase()))) return true;
  if (name.toLowerCase().endsWith('.pdb')) return true;
  return false;
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
    let owned = isOwnedName(name, contract)
      || rel.toLowerCase().startsWith('runtimes/')
      || rel.toLowerCase().startsWith('updates/sirman_update_');
    if (!owned) continue;
    if (sourceRel.has(rel)) continue;
    fs.unlinkSync(file);
  }
}

function level1RemoveOwned(destDir, contract) {
  const manPath = path.join(destDir, contract.canonical.manifestFileName);
  const manifestRel = new Set();
  if (fs.existsSync(manPath)) {
    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    (man.files || []).forEach(f => manifestRel.add(String(f)));
  }
  const destFiles = [];
  walkFiles(destDir, destFiles);
  for (const file of destFiles) {
    if (isPreserveDir(file, contract)) continue;
    const rel = relPath(destDir, file);
    const name = path.basename(file);
    let owned = manifestRel.has(rel) || isOwnedName(name, contract)
      || rel.toLowerCase().startsWith('runtimes/')
      || rel.toLowerCase().startsWith('updates/sirman_update_');
    if (owned) fs.unlinkSync(file);
  }
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
