// Service Worker لایق الکترونیک پارسیان — اعلان دسکتاپ پس‌زمینه برای ماژول وظایف
// Version: 1405.5.17γ
// محدودیت مهم: این فایل فقط وقتی توسط مرورگر «بیدار» شود (periodicsync/sync) می‌تواند اعلان بفرستد.
// با بسته‌بودن کامل مرورگر، زمان‌بندی این بیداری به‌طور کامل در اختیار خود مرورگر (Chrome/Edge) است؛
// best-effort است، نه دقیق و نه تضمین‌شده — این محدودیت پلتفرم است، نه باگ این کد.

const DB_NAME = 'laegh-tasks-db';
const STORE = 'tasks';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllTasks() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function putTask(t) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(t);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function checkDueTasks() {
  const tasks = await getAllTasks();
  const now = Date.now();
  for (const t of tasks) {
    if (t.status === 'open' && t.notify && t.deadlineTS && t.deadlineTS <= now && !t.notifiedAt) {
      await self.registration.showNotification('⏰ ' + t.title, {
        body: (t.desc || '') + ' — اولویت: ' + t.priority,
        tag: t.id,
      });
      t.notifiedAt = now;
      await putTask(t);
    }
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'laegh-task-check') {
    event.waitUntil(checkDueTasks());
  }
});

// Fallback برای مرورگرهایی که Periodic Background Sync ندارند ولی Background Sync دارند
self.addEventListener('sync', (event) => {
  if (event.tag === 'laegh-task-check') {
    event.waitUntil(checkDueTasks());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// اعلام به‌روزرسانی به همه کلاینت‌ها
self.addEventListener('message', (event) => {
  if (event.data === 'CHECK_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: '10.5.9' });
  }
});
