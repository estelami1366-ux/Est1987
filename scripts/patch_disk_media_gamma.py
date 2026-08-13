#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Patch Sirman_Final.html: store backgrounds/attachments on disk, not localStorage."""
from pathlib import Path
import re

HTML = Path("/workspace/Sirman_Final.html")
text = HTML.read_text(encoding="utf-8")
orig = text

OLD_VER = "1405.5.21β"
NEW_VER = "1405.5.21γ"
if OLD_VER not in text:
    raise SystemExit(f"expected version {OLD_VER} not found")

text = text.replace(OLD_VER, NEW_VER)

DISK_API = r'''
// ══ ذخیرهٔ رسانه روی هارد (نه localStorage) — 1405.5.21γ ═══════════════════
// عکس پس‌زمینه، لوگو و ضمیمه‌ها فقط در پوشهٔ بک‌آپ روی دیسک نوشته می‌شوند.
// در حافظهٔ مرورگر فقط ارجاع کوتاه disk://sirman_media/... نگه داشته می‌شود.
window._diskUrlCache = window._diskUrlCache || {};
window.DISK_REF_PREFIX = 'disk://';
function isDiskRef(s){
  return typeof s === 'string' && s.indexOf(window.DISK_REF_PREFIX) === 0;
}
function diskRefPath(s){
  return isDiskRef(s) ? s.slice(window.DISK_REF_PREFIX.length) : '';
}
function isHeavyDataUrl(s){
  return typeof s === 'string' && s.indexOf('data:') === 0 && s.length > 800;
}
function dataUrlToBlob(dataUrl){
  var parts = String(dataUrl||'').split(',');
  if(parts.length < 2) throw new Error('dataURL نامعتبر');
  var mime = 'application/octet-stream';
  var m = parts[0].match(/data:([^;]+)/);
  if(m) mime = m[1] || mime;
  var bin = atob(parts[1]);
  var arr = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], {type:mime});
}
function mediaExtFromMimeOrName(mime, name){
  var n = String(name||'').toLowerCase();
  var mm = String(mime||'').toLowerCase();
  if(n.indexOf('.png')>=0 || mm.indexOf('png')>=0) return '.png';
  if(n.indexOf('.webp')>=0 || mm.indexOf('webp')>=0) return '.webp';
  if(n.indexOf('.gif')>=0 || mm.indexOf('gif')>=0) return '.gif';
  if(n.indexOf('.pdf')>=0 || mm.indexOf('pdf')>=0) return '.pdf';
  if(n.indexOf('.jpeg')>=0 || n.indexOf('.jpg')>=0 || mm.indexOf('jpeg')>=0) return '.jpg';
  if(mm.indexOf('image/')===0) return '.jpg';
  return '.bin';
}
function mediaSafeFileName(name, mime){
  var base = (typeof safeFsFileName === 'function') ? safeFsFileName(name) : String(name||'file');
  base = String(base||'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  if(!base || base === 'sirman_file') base = 'media_'+Date.now();
  var ext = mediaExtFromMimeOrName(mime, name);
  // اگر پسوند مجاز نداشت، یکی اضافه کن
  var lower = base.toLowerCase();
  if(!/\.(jpg|jpeg|png|webp|gif|pdf|bin|txt)$/.test(lower)) base = base + ext;
  if(base.length > 80){
    var e2 = (base.match(/\.[a-z0-9]+$/i)||['.bin'])[0];
    base = base.slice(0, 70 - e2.length) + e2;
  }
  return base;
}
async function ensureMediaDirHandle(opts){
  opts = opts || {};
  if(typeof autoSaveDirHandle !== 'undefined' && autoSaveDirHandle){
    var ok = await ensureFsPermission(autoSaveDirHandle, 'readwrite');
    if(ok) return autoSaveDirHandle;
  }
  // اگر فقط فایل انتخاب شده، برای رسانه حتماً پوشه لازم است
  if(!opts.silent){
    if(typeof ntf === 'function') ntf('برای ذخیره عکس/ضمیمه روی هارد، پوشه بک‌آپ را انتخاب کنید','err');
    try{
      if(typeof showStgTab === 'function') showStgTab('autosave');
      else if(typeof go === 'function') go('settings');
    }catch(_e){}
    if(typeof chooseAutoSaveFolder === 'function'){
      await chooseAutoSaveFolder();
    }
  }
  if(typeof autoSaveDirHandle !== 'undefined' && autoSaveDirHandle){
    var ok2 = await ensureFsPermission(autoSaveDirHandle, 'readwrite');
    if(ok2) return autoSaveDirHandle;
  }
  throw new Error('پوشه بک‌آپ روی هارد انتخاب نشده — عکس/ضمیمه در حافظه مرورگر ذخیره نمی‌شود');
}
async function getDiskFileHandle(relPath, create){
  var root = await ensureMediaDirHandle({silent:!create});
  var parts = String(relPath||'').split('/').filter(Boolean);
  if(!parts.length) throw new Error('مسیر خالی');
  var fileName = parts.pop();
  var dir = root;
  for(var i=0;i<parts.length;i++){
    dir = await dir.getDirectoryHandle(parts[i], {create:!!create});
  }
  return await dir.getFileHandle(fileName, {create:!!create});
}
async function writeDiskBlob(relPath, blob){
  if(!blob) throw new Error('محتوای خالی');
  var parts = String(relPath||'').split('/').filter(Boolean);
  if(parts[0] !== 'sirman_media') parts = ['sirman_media'].concat(parts);
  var fileName = parts.pop();
  fileName = mediaSafeFileName(fileName, blob.type||'');
  var fullRel = parts.concat([fileName]).join('/');
  var fh = await getDiskFileHandle(fullRel, true);
  var w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  var ref = window.DISK_REF_PREFIX + fullRel;
  try{
    if(window._diskUrlCache[ref]) URL.revokeObjectURL(window._diskUrlCache[ref]);
  }catch(_r){}
  try{ window._diskUrlCache[ref] = URL.createObjectURL(blob); }catch(_c){}
  return ref;
}
async function writeDiskDataUrl(relPath, dataUrl){
  return writeDiskBlob(relPath, dataUrlToBlob(dataUrl));
}
async function resolveDiskRef(ref){
  if(!ref) return '';
  if(!isDiskRef(ref)) return ref;
  if(window._diskUrlCache[ref]) return window._diskUrlCache[ref];
  try{
    var fh = await getDiskFileHandle(diskRefPath(ref), false);
    var file = await fh.getFile();
    var url = URL.createObjectURL(file);
    window._diskUrlCache[ref] = url;
    return url;
  }catch(e){
    if(typeof addDbgEntry === 'function') addDbgEntry('warn','خواندن رسانه دیسک', (e&&e.message)||String(e), ref, 'پوشه بک‌آپ را دوباره انتخاب کنید');
    return '';
  }
}
async function resolveForDisplay(val){
  if(!val) return '';
  if(isDiskRef(val)) return await resolveDiskRef(val);
  return val;
}
async function storeBgOnDisk(slotKey, dataUrl){
  var map = {
    laegh_app_bg: 'sirman_media/bg_app.jpg',
    laegh_sb_bg: 'sirman_media/bg_sb.jpg',
    laegh_main_bg: 'sirman_media/bg_main.jpg',
    laegh_dash_bg: 'sirman_media/bg_dash.jpg'
  };
  var rel = map[slotKey] || ('sirman_media/bg_' + String(slotKey).replace(/[^a-z0-9_]/gi,'_') + '.jpg');
  var ref = await writeDiskDataUrl(rel, dataUrl);
  try{ localStorage.setItem(slotKey, ref); }catch(_e){
    throw new Error('حتی ارجاع کوتاه هم در حافظه ذخیره نشد');
  }
  // پاک‌سازی dataURLهای قدیمی که حافظه را پر کرده بودند
  try{
    var old = localStorage.getItem(slotKey);
    if(old && isHeavyDataUrl(old)) localStorage.setItem(slotKey, ref);
  }catch(_e2){}
  return ref;
}
async function storePrintBgOnDisk(section, dataUrl){
  var rel = 'sirman_media/print_' + String(section||'x').replace(/[^a-z0-9_]/gi,'_') + '.jpg';
  return await writeDiskDataUrl(rel, dataUrl);
}
async function storeLogoOnDisk(dataUrl){
  return await writeDiskDataUrl('sirman_media/logo.jpg', dataUrl);
}
async function storeDocFileOnDisk(file, prefix){
  var pref = prefix || 'doc';
  var safe = mediaSafeFileName(file.name || (pref+'.bin'), file.type||'');
  var rel = 'sirman_media/docs/' + pref + '_' + Date.now() + '_' + Math.floor(Math.random()*1e6) + '_' + safe;
  return await writeDiskBlob(rel, file);
}
async function hydrateDocList(arr){
  if(!arr || !arr.length) return arr;
  for(var i=0;i<arr.length;i++){
    var d = arr[i];
    if(!d) continue;
    var src = d.data || d.src || '';
    if(isDiskRef(src)){
      d._blobUrl = await resolveDiskRef(src);
    } else if(src){
      d._blobUrl = src;
    }
  }
  return arr;
}
function docThumbSrc(d){
  if(!d) return '';
  if(d._blobUrl) return d._blobUrl;
  var src = d.data || d.src || '';
  if(isDiskRef(src)){
    if(window._diskUrlCache[src]) return window._diskUrlCache[src];
    // placeholder سبک — بعداً resolve می‌شود
    resolveDiskRef(src).then(function(u){ if(u && d){ d._blobUrl = u; } }).catch(function(){});
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#e8eef3"/><text x="36" y="40" text-anchor="middle" font-size="11" fill="#668">...</text></svg>');
  }
  return src;
}
async function migrateHeavyKeyToDisk(key, relPath){
  try{
    var v = localStorage.getItem(key) || '';
    if(!isHeavyDataUrl(v)) return false;
    if(!autoSaveDirHandle) return false;
    var ref = await writeDiskDataUrl(relPath, v);
    localStorage.setItem(key, ref);
    return true;
  }catch(_e){ return false; }
}
async function migrateAllHeavyMediaToDisk(){
  if(!autoSaveDirHandle) return 0;
  var n = 0;
  var pairs = [
    ['laegh_app_bg','sirman_media/bg_app.jpg'],
    ['laegh_sb_bg','sirman_media/bg_sb.jpg'],
    ['laegh_main_bg','sirman_media/bg_main.jpg'],
    ['laegh_dash_bg','sirman_media/bg_dash.jpg'],
    ['ll','sirman_media/logo.jpg']
  ];
  for(var i=0;i<pairs.length;i++){
    if(await migrateHeavyKeyToDisk(pairs[i][0], pairs[i][1])) n++;
  }
  // پس‌زمینه چاپ
  try{
    var ps = JSON.parse(localStorage.getItem('laegh_printSettings')||'{}');
    var changed = false;
    Object.keys(ps||{}).forEach(function(sec){
      // sync loop body below
    });
    for(var sec in ps){
      if(!ps[sec] || !isHeavyDataUrl(ps[sec].bgImage)) continue;
      try{
        ps[sec].bgImage = await storePrintBgOnDisk(sec, ps[sec].bgImage);
        changed = true; n++;
      }catch(_pe){}
    }
    if(changed) localStorage.setItem('laegh_printSettings', JSON.stringify(ps));
  }catch(_ps){}
  // لوگو در حافظهٔ متغیر
  try{
    if(typeof logoSrc === 'string' && isHeavyDataUrl(logoSrc) && autoSaveDirHandle){
      var lr = await storeLogoOnDisk(logoSrc);
      logoSrc = lr;
      localStorage.setItem('ll', lr);
      n++;
    }
  }catch(_lg){}
  if(n && typeof ntf === 'function') ntf(n + ' فایل رسانه به هارد منتقل شد ✅');
  if(typeof applyAppBg === 'function') applyAppBg();
  if(typeof applyLayerBackgrounds === 'function') applyLayerBackgrounds();
  return n;
}
async function requireDiskOrAbort(actionLabel){
  try{
    await ensureMediaDirHandle({silent:false});
    return true;
  }catch(e){
    if(typeof ntf === 'function') ntf((actionLabel||'این کار') + ' فقط روی هارد (پوشه بک‌آپ) ذخیره می‌شود — پوشه را انتخاب کنید','err');
    return false;
  }
}
'''

# Insert disk API after restoreAutoSaveHandlesOnBoot function ends (before mirrorBackupToIDB)
marker = "async function mirrorBackupToIDB(json){"
if marker not in text:
    raise SystemExit("mirrorBackupToIDB marker not found")
if "storeBgOnDisk" not in text:
    text = text.replace(marker, DISK_API + "\n" + marker)

# Fix restoreAutoSaveHandlesOnBoot to restore BOTH handles
old_restore = """async function restoreAutoSaveHandlesOnBoot(){
  try{
    var enabled = localStorage.getItem('laegh_autosave_enabled')==='1';
    if(!enabled) return false;
    var mode = localStorage.getItem('laegh_autosave_mode') || '';
    var restored = false;
    if(mode === 'file' || !mode){
      var fh = await loadAutoSaveHandleFromIDB('file');
      if(fh){
        var ok = await ensureFsPermission(fh, 'readwrite');
        if(ok){ autoSaveFileHandle = fh; restored = true; }
      }
    }
    if((mode === 'dir' || !restored) && !autoSaveFileHandle){
      var dh = await loadAutoSaveHandleFromIDB('dir');
      if(dh){
        var ok2 = await ensureFsPermission(dh, 'readwrite');
        if(ok2){ autoSaveDirHandle = dh; restored = true; }
      }
    }
    if(restored){
      updateAutoSaveTargetUI();
      var st = document.getElementById('as-status');
      if(st){ st.textContent = '✅ فعال (بازیابی‌شده) — هر ' + autoSaveIntervalMin + ' دقیقه'; st.style.color = 'var(--green)'; }
      try{ startAutoSave(); }catch(_e){}
      if(typeof ntf==='function') ntf('محل بک‌آپ قبلی بازیابی شد ✅');
    }
    return restored;
  }catch(_e2){ return false; }
}"""

new_restore = """async function restoreAutoSaveHandlesOnBoot(){
  try{
    var enabled = localStorage.getItem('laegh_autosave_enabled')==='1';
    if(!enabled) return false;
    var restored = false;
    // هر دو هندل را بازیابی کن: فایل برای بک‌آپ متنی + پوشه برای رسانه روی هارد
    var fh = await loadAutoSaveHandleFromIDB('file');
    if(fh){
      var ok = await ensureFsPermission(fh, 'readwrite');
      if(ok){ autoSaveFileHandle = fh; restored = true; }
    }
    var dh = await loadAutoSaveHandleFromIDB('dir');
    if(dh){
      var ok2 = await ensureFsPermission(dh, 'readwrite');
      if(ok2){ autoSaveDirHandle = dh; restored = true; }
    }
    if(restored){
      updateAutoSaveTargetUI();
      var st = document.getElementById('as-status');
      if(st){ st.textContent = '✅ فعال (بازیابی‌شده) — هر ' + autoSaveIntervalMin + ' دقیقه'; st.style.color = 'var(--green)'; }
      try{ startAutoSave(); }catch(_e){}
      if(typeof ntf==='function') ntf('محل بک‌آپ قبلی بازیابی شد ✅');
      try{ await migrateAllHeavyMediaToDisk(); }catch(_m){}
      try{
        if(typeof applyAppBg==='function') applyAppBg();
        if(typeof applyLayerBackgrounds==='function') applyLayerBackgrounds();
        if(typeof logoSrc==='string' && isDiskRef(logoSrc)){
          resolveDiskRef(logoSrc).then(function(u){
            if(u){ var el=document.getElementById('sb-logo'); if(el) el.src=u; }
          });
        }
      }catch(_a){}
    }
    return restored;
  }catch(_e2){ return false; }
}"""

if old_restore not in text:
    raise SystemExit("old restoreAutoSaveHandlesOnBoot not found exactly")
text = text.replace(old_restore, new_restore)

# After chooseAutoSaveFolder success, migrate media
old_folder_ok = """    ntf('پوشه ذخیره خودکار انتخاب شد ✅');
    startAutoSave();
    try {
      await doAutoSave(true); // ذخیره فوری برای تست
      ntf('فایل بکاپ در پوشه نوشته شد ✅');
    } catch (saveErr) {"""

new_folder_ok = """    ntf('پوشه ذخیره خودکار انتخاب شد ✅ — رسانه هم روی همین پوشه ذخیره می‌شود');
    startAutoSave();
    try{ await migrateAllHeavyMediaToDisk(); }catch(_mig){}
    try {
      await doAutoSave(true); // ذخیره فوری برای تست
      ntf('فایل بکاپ در پوشه نوشته شد ✅');
    } catch (saveErr) {"""

if old_folder_ok not in text:
    raise SystemExit("chooseAutoSaveFolder success block not found")
text = text.replace(old_folder_ok, new_folder_ok)

# After chooseAutoSaveFile — prompt for folder for media
old_file_ok = """    ntf('فایل ذخیره خودکار انتخاب شد ✅');
    startAutoSave();
    try {
      await doAutoSave(true);
      ntf('بکاپ در فایل نوشته شد ✅');
    } catch (saveErr) {"""

new_file_ok = """    ntf('فایل ذخیره خودکار انتخاب شد ✅');
    startAutoSave();
    try {
      await doAutoSave(true);
      ntf('بکاپ در فایل نوشته شد ✅');
    } catch (saveErr) {"""

# Add folder prompt after successful file choose — insert before startAutoSave in file chooser
old_file_mid = """    localStorage.setItem('laegh_autosave_enabled','1');
    localStorage.setItem('laegh_autosave_mode','file');
    try{ await saveAutoSaveHandleToIDB('file', autoSaveFileHandle); }catch(_sh){}
    updateAutoSaveTargetUI();
    var st = document.getElementById('as-status');
    if (st) { st.textContent = '✅ فعال — هر ' + autoSaveIntervalMin + ' دقیقه'; st.style.color = 'var(--green)'; }
    ntf('فایل ذخیره خودکار انتخاب شد ✅');
    startAutoSave();"""

new_file_mid = """    localStorage.setItem('laegh_autosave_enabled','1');
    localStorage.setItem('laegh_autosave_mode','file');
    try{ await saveAutoSaveHandleToIDB('file', autoSaveFileHandle); }catch(_sh){}
    updateAutoSaveTargetUI();
    var st = document.getElementById('as-status');
    if (st) { st.textContent = '✅ فعال — هر ' + autoSaveIntervalMin + ' دقیقه'; st.style.color = 'var(--green)'; }
    ntf('فایل ذخیره خودکار انتخاب شد ✅');
    // برای عکس/ضمیمه حتماً پوشه روی هارد لازم است (فایل تکی اجازهٔ نوشتن رسانه ندارد)
    if(!autoSaveDirHandle){
      try{
        alert('برای ذخیرهٔ عکس پس‌زمینه و ضمیمه‌ها روی هارد (نه حافظه مرورگر)، الان یک پوشه بک‌آپ هم انتخاب کنید.\\n\\nپیشنهاد: همان پوشه‌ای که فایل بک‌آپ داخل آن است.');
        await chooseAutoSaveFolder();
      }catch(_cf){}
    } else {
      try{ await migrateAllHeavyMediaToDisk(); }catch(_m2){}
    }
    startAutoSave();"""

if old_file_mid not in text:
    raise SystemExit("chooseAutoSaveFile mid block not found")
text = text.replace(old_file_mid, new_file_mid)

# changeLogo
old_logo = """function changeLogo(inp){
  const f=inp.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=e=>{logoSrc=e.target.result; document.getElementById('sb-logo').src=logoSrc; localStorage.setItem('ll',logoSrc); ntf('لوگو تغییر کرد');};
  r.readAsDataURL(f);
}"""

new_logo = """function changeLogo(inp){
  const f=inp.files[0]; if(!f) return;
  (async function(){
    if(!(await requireDiskOrAbort('لوگو'))){ inp.value=''; return; }
    try{
      var ref = await writeDiskBlob('sirman_media/logo'+mediaExtFromMimeOrName(f.type,f.name), f);
      logoSrc = ref;
      var url = await resolveDiskRef(ref);
      var el = document.getElementById('sb-logo'); if(el) el.src = url || '';
      try{ localStorage.setItem('ll', ref); }catch(_e){}
      if(typeof markDirty==='function') markDirty();
      ntf('لوگو روی هارد ذخیره شد ✅');
    }catch(err){
      ntf('ذخیره لوگو روی هارد ناموفق: '+(err&&err.message?err.message:err),'err');
    } finally { inp.value=''; }
  })();
}"""

if old_logo not in text:
    raise SystemExit("changeLogo not found")
text = text.replace(old_logo, new_logo)

# addWarStageDocs
old_wsd = """function addWarStageDocs(key, inp){
  if(!window._warStageDocs[key]) window._warStageDocs[key]=[];
  Array.from(inp.files||[]).forEach(function(file){
    var r=new FileReader();
    r.onload=function(e){ window._warStageDocs[key].push({name:file.name,data:e.target.result}); renderWarStageDocs(key); };
    r.readAsDataURL(file);
  });
  inp.value='';
}"""

new_wsd = """function addWarStageDocs(key, inp){
  if(!window._warStageDocs[key]) window._warStageDocs[key]=[];
  var files = Array.from(inp.files||[]);
  inp.value='';
  if(!files.length) return;
  (async function(){
    if(!(await requireDiskOrAbort('ضمیمه'))) return;
    for(var i=0;i<files.length;i++){
      try{
        var file = files[i];
        var ref = await storeDocFileOnDisk(file, 'war_'+key);
        window._warStageDocs[key].push({name:file.name, data:ref, mime:file.type||''});
      }catch(err){
        ntf('ذخیره ضمیمه روی هارد ناموفق','err');
      }
    }
    await hydrateDocList(window._warStageDocs[key]);
    renderWarStageDocs(key);
    if(typeof markDirty==='function') markDirty();
  })();
}"""

if old_wsd not in text:
    raise SystemExit("addWarStageDocs not found")
text = text.replace(old_wsd, new_wsd)

# addWDocs / addSaleDocs
old_wdocs = """function addWDocs(inp){
  Array.from(inp.files).forEach(file=>{const r=new FileReader();r.onload=e=>{wDocs.push({name:file.name,data:e.target.result});renderWDocs();};r.readAsDataURL(file);});
  inp.value='';
}
function renderWDocs(){
  document.getElementById('wdocs-prev').innerHTML=wDocs.map((d,i)=>_renderDocThumb('wDocs',d,i,'renderWDocs')).join('');
}
function addSaleDocs(inp){
  Array.from(inp.files).forEach(file=>{const r=new FileReader();r.onload=e=>{saleDocs.push({name:file.name,data:e.target.result});renderSaleDocs();};r.readAsDataURL(file);});
  inp.value='';
}
function renderSaleDocs(){
  document.getElementById('sale-docs-prev').innerHTML=saleDocs.map((d,i)=>_renderDocThumb('saleDocs',d,i,'renderSaleDocs')).join('');
}"""

new_wdocs = """function addWDocs(inp){
  var files = Array.from(inp.files||[]);
  inp.value='';
  if(!files.length) return;
  (async function(){
    if(!(await requireDiskOrAbort('ضمیمه گارانتی'))) return;
    for(var i=0;i<files.length;i++){
      try{
        var file = files[i];
        var ref = await storeDocFileOnDisk(file, 'wdoc');
        wDocs.push({name:file.name, data:ref, mime:file.type||''});
      }catch(err){ ntf('ذخیره ضمیمه روی هارد ناموفق','err'); }
    }
    await hydrateDocList(wDocs);
    renderWDocs();
    if(typeof markDirty==='function') markDirty();
  })();
}
function renderWDocs(){
  var el = document.getElementById('wdocs-prev'); if(!el) return;
  el.innerHTML=wDocs.map((d,i)=>_renderDocThumb('wDocs',d,i,'renderWDocs')).join('');
}
function addSaleDocs(inp){
  var files = Array.from(inp.files||[]);
  inp.value='';
  if(!files.length) return;
  (async function(){
    if(!(await requireDiskOrAbort('ضمیمه فروش'))) return;
    for(var i=0;i<files.length;i++){
      try{
        var file = files[i];
        var ref = await storeDocFileOnDisk(file, 'sale');
        saleDocs.push({name:file.name, data:ref, mime:file.type||''});
      }catch(err){ ntf('ذخیره ضمیمه روی هارد ناموفق','err'); }
    }
    await hydrateDocList(saleDocs);
    renderSaleDocs();
    if(typeof markDirty==='function') markDirty();
  })();
}
function renderSaleDocs(){
  var el = document.getElementById('sale-docs-prev'); if(!el) return;
  el.innerHTML=saleDocs.map((d,i)=>_renderDocThumb('saleDocs',d,i,'renderSaleDocs')).join('');
}"""

if old_wdocs not in text:
    raise SystemExit("addWDocs block not found")
text = text.replace(old_wdocs, new_wdocs)

# _renderDocThumb — use docThumbSrc
old_thumb = """function _renderDocThumb(arrName, d, idx, renderFn){
  if(!d) return '';
  var src = d.data || d.src || '';
  if(!src) return '';
  var rf = (typeof renderFn === 'string') ? renderFn : '';
  // مهم: openDocViewerNamed — چون آرایه‌های let روی window نیستند
  return '<div class="doc-thumb" onclick="openDocViewerNamed(\\''+arrName+'\\','+idx+')" title="کلیک برای بزرگ‌نمایی">'+
    '<img src="'+src+'" alt="'+escapeAttr(d.name||'سند')+'">'+
    '<span class="doc-zoom-badge">🔍</span>'+
    '<button type="button" class="doc-del" onclick="event.stopPropagation();spliceDocNamed(\\''+arrName+'\\','+idx+',\\''+String(rf).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'")+'\\')">✕</button>'+
    '</div>';
}"""

# The escaping in the file is different - read exact content
# Let me use a simpler unique replace for just the src line inside _renderDocThumb

old_thumb_src = "  var src = d.data || d.src || '';\n  if(!src) return '';\n  var rf = (typeof renderFn === 'string') ? renderFn : '';\n  // مهم: openDocViewerNamed — چون آرایه‌های let روی window نیستند\n  return '<div class=\"doc-thumb\" onclick=\"openDocViewerNamed(\\''+arrName+'\\','+idx+')\" title=\"کلیک برای بزرگ‌نمایی\">'+\n    '<img src=\"'+src+'\" alt=\"'+escapeAttr(d.name||'سند')+'\">'+'"

# Simpler approach - replace a unique smaller snippet
needle = """function _renderDocThumb(arrName, d, idx, renderFn){
  if(!d) return '';
  var src = d.data || d.src || '';
  if(!src) return '';"""

repl = """function _renderDocThumb(arrName, d, idx, renderFn){
  if(!d) return '';
  var src = (typeof docThumbSrc==='function') ? docThumbSrc(d) : (d.data || d.src || '');
  if(!src && !(d.data||d.src)) return '';
  if(!src) src = '';"""

if needle not in text:
    raise SystemExit("_renderDocThumb head not found")
text = text.replace(needle, repl)

# openDocViewer - hydrate disk refs
old_odv = """function openDocViewer(docs, idx){
  if(!docs) return;
  var list = Array.isArray(docs) ? docs : [docs];
  list = list.map(function(d){
    if(!d) return null;
    if(typeof d === 'string') return {data:d, name:'سند'};
    if(d.data) return d;
    if(d.src) return {data:d.src, name:d.name||'سند'};
    return null;
  }).filter(Boolean);
  if(!list.length) return;
  window._dvDocs=list;
  window._dvIdx = Math.max(0, Math.min(idx||0, list.length-1));
  _dvShowCurrent();
  var m=document.getElementById('doc-viewer');
  if(m){ m.classList.add('open'); m.style.display='flex'; }
}"""

new_odv = """function openDocViewer(docs, idx){
  if(!docs) return;
  var list = Array.isArray(docs) ? docs : [docs];
  list = list.map(function(d){
    if(!d) return null;
    if(typeof d === 'string') return {data:d, name:'سند'};
    if(d.data) return d;
    if(d.src) return {data:d.src, name:d.name||'سند'};
    return null;
  }).filter(Boolean);
  if(!list.length) return;
  (async function(){
    for(var i=0;i<list.length;i++){
      var src = list[i].data || list[i].src || '';
      if(isDiskRef(src)){
        var u = await resolveDiskRef(src);
        list[i] = {name:list[i].name, data:u||'', diskRef:src, mime:list[i].mime||''};
      } else if(list[i]._blobUrl){
        list[i] = {name:list[i].name, data:list[i]._blobUrl, diskRef:isDiskRef(src)?src:'', mime:list[i].mime||''};
      }
    }
    window._dvDocs=list;
    window._dvIdx = Math.max(0, Math.min(idx||0, list.length-1));
    _dvShowCurrent();
    var m=document.getElementById('doc-viewer');
    if(m){ m.classList.add('open'); m.style.display='flex'; }
  })();
}"""

if old_odv not in text:
    raise SystemExit("openDocViewer not found")
text = text.replace(old_odv, new_odv)

# setPrintBgImage callback - store on disk
old_pbg = """  _beginBgCropFromFile(inp, {w:paper.w, h:paper.h, label:'چاپ '+section}, function(out){
    var ps = getPrintSettings();
    if(!ps[section]) ps[section] = JSON.parse(JSON.stringify(PS_DEFAULTS[section]||{}));
    ps[section].bgImage = out;
    try{ localStorage.setItem(PS_KEY, JSON.stringify(ps)); }
    catch(err){ ntf('حافظه مرورگر پر است — تصویر کوچک‌تری انتخاب کنید','err'); return; }
    updatePrintBgStatus(section);
    ntf('تصویر پس‌زمینه چاپ مطابق چارچوب کاغذ ذخیره شد');
  });
}"""

new_pbg = """  _beginBgCropFromFile(inp, {w:paper.w, h:paper.h, label:'چاپ '+section}, function(out){
    (async function(){
      if(!(await requireDiskOrAbort('پس‌زمینه چاپ'))) return;
      try{
        var ref = await storePrintBgOnDisk(section, out);
        var ps = getPrintSettings();
        if(!ps[section]) ps[section] = JSON.parse(JSON.stringify(PS_DEFAULTS[section]||{}));
        ps[section].bgImage = ref;
        localStorage.setItem(PS_KEY, JSON.stringify(ps));
        updatePrintBgStatus(section);
        ntf('پس‌زمینه چاپ روی هارد ذخیره شد ✅');
      }catch(err){
        ntf('ذخیره پس‌زمینه چاپ روی هارد ناموفق: '+(err&&err.message?err.message:err),'err');
      }
    })();
  });
}"""

if old_pbg not in text:
    raise SystemExit("setPrintBgImage callback not found")
text = text.replace(old_pbg, new_pbg)

# previewPrintBg / previewStoredBg
old_prev_p = """function previewPrintBg(section){
  try{
    var s = (getPrintSettings()[section]) || {};
    if(!s.bgImage){ ntf('تصویری برای این بخش تنظیم نشده','err'); return; }
    openDocViewer({data:s.bgImage, name:'پس‌زمینه چاپ '+section}, 0);
  }catch(e){ ntf('پیش‌نمایش ممکن نیست','err'); }
}
function previewStoredBg(key, label){
  var d = localStorage.getItem(key)||'';
  if(!d){ ntf((label||'تصویر')+' ذخیره نشده','err'); return; }
  openDocViewer({data:d, name:label||key}, 0);
}"""

new_prev_p = """function previewPrintBg(section){
  try{
    var s = (getPrintSettings()[section]) || {};
    if(!s.bgImage){ ntf('تصویری برای این بخش تنظیم نشده','err'); return; }
    openDocViewer({data:s.bgImage, name:'پس‌زمینه چاپ '+section}, 0);
  }catch(e){ ntf('پیش‌نمایش ممکن نیست','err'); }
}
function previewStoredBg(key, label){
  var d = localStorage.getItem(key)||'';
  if(!d){ ntf((label||'تصویر')+' ذخیره نشده','err'); return; }
  openDocViewer({data:d, name:label||key}, 0);
}"""
# same - openDocViewer already handles disk refs. OK leave.

# printBgCss: resolve disk refs from cache; keep original .replace(...) intact
m = re.search(r"var url = String\(s\.bgImage\)\.replace\([^;]+;", text)
if not m:
    raise SystemExit("printBgCss url line not found")
exact = m.group(0)
text = text.replace(
    exact,
    "var rawBg = String(s.bgImage||'');\n"
    "    if(typeof isDiskRef==='function' && isDiskRef(rawBg) && window._diskUrlCache && window._diskUrlCache[rawBg]){\n"
    "      rawBg = window._diskUrlCache[rawBg];\n"
    "    }\n"
    "    " + exact.replace("s.bgImage", "rawBg", 1),
    1,
)

# setAppBgImage
old_appbg = """function setAppBgImage(inp){
  var m = {w: Math.max(800, window.innerWidth||1200), h: Math.max(600, window.innerHeight||800)};
  _beginBgCropFromFile(inp, {w:m.w, h:m.h, label:'پس‌زمینه عمومی'}, function(out){
    if(_safeSetItem('laegh_app_bg', out)){
      applyAppBg();
      ntf('پس‌زمینه برنامه مطابق چارچوب ذخیره شد ✅');
    }
  });
}"""

new_appbg = """function setAppBgImage(inp){
  var m = {w: Math.max(800, window.innerWidth||1200), h: Math.max(600, window.innerHeight||800)};
  _beginBgCropFromFile(inp, {w:m.w, h:m.h, label:'پس‌زمینه عمومی'}, function(out){
    (async function(){
      if(!(await requireDiskOrAbort('پس‌زمینه'))) return;
      try{
        await storeBgOnDisk('laegh_app_bg', out);
        applyAppBg();
        ntf('پس‌زمینه روی هارد ذخیره شد ✅');
      }catch(err){ ntf('ذخیره پس‌زمینه روی هارد ناموفق: '+(err&&err.message?err.message:err),'err'); }
    })();
  });
}"""

if old_appbg not in text:
    raise SystemExit("setAppBgImage not found")
text = text.replace(old_appbg, new_appbg)

# applyAppBg async resolve
old_apply_app = """function applyAppBg(){
  const img = localStorage.getItem('laegh_app_bg') || '';
  if(img){
    document.body.classList.add('has-bg-image');
    document.body.style.setProperty('--bg-img', 'url('+img+')');
  } else {
    document.body.classList.remove('has-bg-image');
    document.body.style.removeProperty('--bg-img');
  }
  const ov = localStorage.getItem('laegh_app_bg_overlay') || '0.55';
  document.body.style.setProperty('--bg-overlay', ov);
}"""

new_apply_app = """function applyAppBg(){
  const img = localStorage.getItem('laegh_app_bg') || '';
  const ov = localStorage.getItem('laegh_app_bg_overlay') || '0.55';
  document.body.style.setProperty('--bg-overlay', ov);
  if(!img){
    document.body.classList.remove('has-bg-image');
    document.body.style.removeProperty('--bg-img');
    return;
  }
  if(typeof isDiskRef==='function' && isDiskRef(img)){
    var cached = window._diskUrlCache && window._diskUrlCache[img];
    if(cached){
      document.body.classList.add('has-bg-image');
      document.body.style.setProperty('--bg-img', 'url('+cached+')');
    } else {
      resolveDiskRef(img).then(function(u){
        if(!u){ document.body.classList.remove('has-bg-image'); return; }
        document.body.classList.add('has-bg-image');
        document.body.style.setProperty('--bg-img', 'url('+u+')');
      });
    }
    return;
  }
  document.body.classList.add('has-bg-image');
  document.body.style.setProperty('--bg-img', 'url('+img+')');
}"""

if old_apply_app not in text:
    raise SystemExit("applyAppBg not found")
text = text.replace(old_apply_app, new_apply_app)

# _setCoverBg
old_cover = """function _setCoverBg(targetSel, cssVar, storageKey, fileInput, label){
  var m = _measureFrame(targetSel, targetSel==='.sb'?240:900, targetSel==='.sb'?900:700);
  _beginBgCropFromFile(fileInput, {w:m.w, h:m.h, label:label||'پس‌زمینه'}, function(out){
    if(_safeSetItem(storageKey, out)){
      applyLayerBackgrounds();
      ntf('پس‌زمینه مطابق چارچوب ذخیره شد ✅');
    }
  });
}"""

new_cover = """function _setCoverBg(targetSel, cssVar, storageKey, fileInput, label){
  var m = _measureFrame(targetSel, targetSel==='.sb'?240:900, targetSel==='.sb'?900:700);
  _beginBgCropFromFile(fileInput, {w:m.w, h:m.h, label:label||'پس‌زمینه'}, function(out){
    (async function(){
      if(!(await requireDiskOrAbort('پس‌زمینه'))) return;
      try{
        await storeBgOnDisk(storageKey, out);
        applyLayerBackgrounds();
        ntf('پس‌زمینه روی هارد ذخیره شد ✅');
      }catch(err){ ntf('ذخیره پس‌زمینه روی هارد ناموفق: '+(err&&err.message?err.message:err),'err'); }
    })();
  });
}"""

if old_cover not in text:
    raise SystemExit("_setCoverBg not found")
text = text.replace(old_cover, new_cover)

# applyLayerBackgrounds
old_layers = """function applyLayerBackgrounds(){
  var sb = document.querySelector('.sb');
  var main = document.querySelector('.main');
  var dash = document.getElementById('dash-shell');
  var sbBg = localStorage.getItem('laegh_sb_bg') || '';
  var mainBg = localStorage.getItem('laegh_main_bg') || '';
  var dashBg = localStorage.getItem('laegh_dash_bg') || '';
  if(sb){
    if(sbBg){ sb.classList.add('has-custom-bg'); document.documentElement.style.setProperty('--sb-bg-img', 'url("'+sbBg.replace(/"/g,'%22')+'")'); }
    else { sb.classList.remove('has-custom-bg'); document.documentElement.style.removeProperty('--sb-bg-img'); }
  }
  if(main){
    if(mainBg){ main.classList.add('has-custom-bg'); document.documentElement.style.setProperty('--main-bg-img', 'url("'+mainBg.replace(/"/g,'%22')+'")'); }
    else { main.classList.remove('has-custom-bg'); document.documentElement.style.removeProperty('--main-bg-img'); }
  }
  if(dash){
    if(dashBg){ dash.classList.add('has-dash-bg'); document.documentElement.style.setProperty('--dash-bg-img', 'url("'+dashBg.replace(/"/g,'%22')+'")'); }
    else { dash.classList.remove('has-dash-bg'); document.documentElement.style.removeProperty('--dash-bg-img'); }
  }
  var ov = localStorage.getItem('laegh_dash_bg_overlay') || '0.35';
  document.documentElement.style.setProperty('--dash-bg-overlay', ov);
  var ovEl = document.getElementById('dash-bg-overlay'); if(ovEl) ovEl.value = ov;
  if(typeof applyDashTint==='function') applyDashTint();
}"""

new_layers = """function applyLayerBackgrounds(){
  var sb = document.querySelector('.sb');
  var main = document.querySelector('.main');
  var dash = document.getElementById('dash-shell');
  var sbBg = localStorage.getItem('laegh_sb_bg') || '';
  var mainBg = localStorage.getItem('laegh_main_bg') || '';
  var dashBg = localStorage.getItem('laegh_dash_bg') || '';
  function applyOne(el, cls, cssVar, raw){
    if(!el) return;
    if(!raw){
      el.classList.remove(cls);
      document.documentElement.style.removeProperty(cssVar);
      return;
    }
    function setUrl(u){
      if(!u){ el.classList.remove(cls); document.documentElement.style.removeProperty(cssVar); return; }
      el.classList.add(cls);
      document.documentElement.style.setProperty(cssVar, 'url("'+String(u).replace(/"/g,'%22')+'")');
    }
    if(typeof isDiskRef==='function' && isDiskRef(raw)){
      if(window._diskUrlCache && window._diskUrlCache[raw]) setUrl(window._diskUrlCache[raw]);
      else resolveDiskRef(raw).then(setUrl);
    } else setUrl(raw);
  }
  applyOne(sb, 'has-custom-bg', '--sb-bg-img', sbBg);
  applyOne(main, 'has-custom-bg', '--main-bg-img', mainBg);
  applyOne(dash, 'has-dash-bg', '--dash-bg-img', dashBg);
  var ov = localStorage.getItem('laegh_dash_bg_overlay') || '0.35';
  document.documentElement.style.setProperty('--dash-bg-overlay', ov);
  var ovEl = document.getElementById('dash-bg-overlay'); if(ovEl) ovEl.value = ov;
  if(typeof applyDashTint==='function') applyDashTint();
}"""

if old_layers not in text:
    raise SystemExit("applyLayerBackgrounds not found")
text = text.replace(old_layers, new_layers)

# _safeSetItem — refuse heavy data URLs
old_safe = """function _safeSetItem(key, val){
  try{
    localStorage.setItem(key, val);
    return true;
  }catch(e){
    try{
      // اگر پر بود، عکس‌های پس‌زمینه را نگه می‌داریم ولی هشدار می‌دهیم
      if(typeof ntf==='function') ntf('حافظه مرورگر پر است — عکس را کوچک‌تر کنید یا عکس‌های قبلی را حذف کنید','err');
    }catch(_e){}
    return false;
  }
}"""

new_safe = """function _safeSetItem(key, val){
  try{
    // ممنوع: ذخیرهٔ dataURL سنگین در حافظه مرورگر — فقط ارجاع دیسک یا مقدار کوچک
    if(typeof isHeavyDataUrl==='function' && isHeavyDataUrl(val)){
      if(typeof ntf==='function') ntf('عکس بزرگ در حافظه مرورگر ذخیره نمی‌شود — پوشه بک‌آپ روی هارد را انتخاب کنید','err');
      return false;
    }
    localStorage.setItem(key, val);
    return true;
  }catch(e){
    try{
      if(typeof ntf==='function') ntf('حافظه مرورگر پر است — از پوشه بک‌آپ روی هارد استفاده کنید','err');
    }catch(_e){}
    return false;
  }
}"""

if old_safe not in text:
    raise SystemExit("_safeSetItem not found")
text = text.replace(old_safe, new_safe)

# svWars / svSales — refuse if payload too large with data URLs
old_svw = "function svWars(){localStorage.setItem('lw2',JSON.stringify(warranties));markDirty();}\nfunction svWarr(){localStorage.setItem('lw2',JSON.stringify(warranties));markDirty();}"
new_svw = """function _persistJsonSafe(key, obj, label){
  var json = JSON.stringify(obj);
  if(json.length > 2500000){
    if(typeof ntf==='function') ntf((label||'داده')+' خیلی حجیم است — ضمیمه‌ها باید روی هارد (پوشه بک‌آپ) باشند نه داخل حافظه','err');
    try{ if(typeof addDbgEntry==='function') addDbgEntry('warn','ذخیره '+key, 'size='+json.length, 'احتمالاً dataURL داخل JSON مانده','پوشه بک‌آپ را انتخاب و دوباره ذخیره کنید'); }catch(_e){}
  }
  try{
    localStorage.setItem(key, json);
    return true;
  }catch(e){
    if(typeof ntf==='function') ntf('حافظه مرورگر پر است — ضمیمه‌ها را روی پوشه هارد ذخیره کنید (تنظیمات → ذخیره خودکار)','err');
    return false;
  }
}
function svWars(){_persistJsonSafe('lw2', warranties, 'پرونده‌های گارانتی'); markDirty();}
function svWarr(){_persistJsonSafe('lw2', warranties, 'پرونده‌های گارانتی'); markDirty();}"""

if old_svw not in text:
    raise SystemExit("svWars not found")
text = text.replace(old_svw, new_svw)

old_svs = "function svSales(){ localStorage.setItem('laegh_sales', JSON.stringify(sales)); markDirty(); }"
new_svs = "function svSales(){ _persistJsonSafe('laegh_sales', sales, 'فروش‌ها'); markDirty(); }"
if old_svs not in text:
    raise SystemExit("svSales not found")
text = text.replace(old_svs, new_svs)

# UI tip for autosave — prefer folder for media
old_tip = """        • روش پیشنهادی: «انتخاب فایل ذخیره» → فایل <code>sirman_autosave.txt</code> را یک‌بار بسازید/انتخاب کنید<br>
        • در حالت پوشه، فایل‌هایی مثل <code>backup.txt</code> / <code>data.txt</code> نوشته می‌شوند (نام‌های ساده برای سازگاری با کروم)<br>
        • اگر نوشتن در فایل/پوشه شکست بخورد، یک دانلود جایگزین خودکار انجام می‌شود<br>
        • اگر محل ذخیره انتخاب نشود، داده بیشتر در حافظه مرورگر می‌ماند — حتماً فایل ذخیره یا دانلود دستی را فعال کنید"""

new_tip = """        • <b>عکس پس‌زمینه و ضمیمه‌ها فقط روی هارد</b> در پوشه بک‌آپ (زیرپوشه <code>sirman_media</code>) ذخیره می‌شوند — نه در حافظه مرورگر<br>
        • حتماً «📂 انتخاب پوشه» را بزنید (برای رسانه الزامی است). فایل متنی بک‌آپ هم می‌تواند همزمان انتخاب شود<br>
        • در حالت پوشه، فایل‌هایی مثل <code>backup.txt</code> / <code>data.txt</code> نوشته می‌شوند<br>
        • اگر نوشتن در فایل/پوشه شکست بخورد، یک دانلود جایگزین خودکار انجام می‌شود<br>
        • بدون پوشه بک‌آپ، افزودن عکس/ضمیمه مسدود است تا حافظه مرورگر پر نشود"""

if old_tip not in text:
    raise SystemExit("autosave tip not found")
text = text.replace(old_tip, new_tip)

old_warn = """        ⚠️ اگر «انتخاب پوشه» خطای Name is not allowed داد، از دکمه <b>«📄 انتخاب فایل ذخیره»</b> استفاده کنید — پایدارتر است.
        اگر هیچ پنجره‌ای باز نشد: صفحه را با <b>Sirman_Start.bat</b> باز کنید (نه دوبارکلیک روی HTML)، یا از دانلود دستی پایین استفاده کنید.
        <br>✅ بعد از یک‌بار انتخاب، محل ذخیره در همین مرورگر <b>یادآوری و بازیابی</b> می‌شود (نیازی به انتخاب هر بار نیست).<br>🟢 تا وقتی ذخیره خودکار فعال باشد، نشانه سبز گوشه صفحه روشن می‌ماند."""

new_warn = """        ⚠️ برای <b>عکس و ضمیمه</b> حتماً <b>«📂 انتخاب پوشه»</b> را بزنید تا روی هارد در <code>sirman_media</code> ذخیره شود (حافظه مرورگر استفاده نمی‌شود).
        برای بک‌آپ متنی می‌توانید «📄 انتخاب فایل ذخیره» را هم بزنید.
        اگر هیچ پنجره‌ای باز نشد: صفحه را با <b>Sirman_Start.bat</b> باز کنید.
        <br>✅ بعد از یک‌بار انتخاب، محل ذخیره یادآوری می‌شود.<br>🟢 نشانه سبز = ذخیره خودکار فعال."""

if old_warn not in text:
    raise SystemExit("autosave warn not found")
text = text.replace(old_warn, new_warn)

# Button label tweak
text = text.replace(
    '<button class="btn btn-sm btn-o" onclick="chooseAutoSaveFolder()">📂 انتخاب پوشه</button>',
    '<button class="btn btn-p btn-sm" onclick="chooseAutoSaveFolder()">📂 انتخاب پوشه (برای عکس و ضمیمه)</button>'
)

boot_logo = "try{ if(typeof applyBrand==='function') applyBrand(); }catch(_e){}"
boot_logo_new = """try{ if(typeof applyBrand==='function') applyBrand(); }catch(_e){}
  try{
    if(typeof logoSrc==='string' && typeof isDiskRef==='function' && isDiskRef(logoSrc)){
      resolveDiskRef(logoSrc).then(function(u){ var el=document.getElementById('sb-logo'); if(el && u) el.src=u; });
    }
  }catch(_lg){}"""
if boot_logo in text:
    text = text.replace(boot_logo, boot_logo_new, 1)

text = text.replace(
    "{ code:'E004', match:'QuotaExceeded',          fa:'حافظه مرورگر (localStorage) پر شده است',                      sol:'از خروجی Excel پشتیبان بگیرید، داده‌های قدیمی را حذف کنید.' }",
    "{ code:'E004', match:'QuotaExceeded',          fa:'حافظه مرورگر (localStorage) پر شده است',                      sol:'پوشه بک‌آپ روی هارد را انتخاب کنید؛ عکس و ضمیمه نباید در حافظه مرورگر بماند.' }"
)

if "storeBgOnDisk" not in text:
    raise SystemExit("storeBgOnDisk missing after patch")

HTML.write_text(text, encoding="utf-8")
print("Patched OK, size", len(text))
print("version count", text.count(NEW_VER), "old left", text.count(OLD_VER))
print("has storeBgOnDisk", "storeBgOnDisk" in text)
print("has requireDiskOrAbort", "requireDiskOrAbort" in text)
if "var rawBg = String(s.bgImage" in text:
    i = text.find("var rawBg = String(s.bgImage")
    print("printBgCss ok:", text[i:i+200].replace("\n", " | "))
