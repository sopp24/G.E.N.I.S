/* G.E.N.I.S — service worker : coque applicative hors ligne, mises à jour propres, notifications.
   Jamais de cache pour la passerelle ni pour les API : seuls les fichiers de l'application et les bibliothèques épinglées (CDN) sont mis en cache.
   Hors ligne, fonctionnent : interface, historique, mémoire, automatisations, minuteurs, calculs. Ne fonctionnent pas : IA, météo, cartes, musique, actualités. */
const VERSION = 'genis-v3.0.0';
const SHELL = ["./", "index.html", "styles.css", "manifest.webmanifest", "favicon.svg", "genis-192.png", "genis-512.png", "apple-touch-icon.png", "agents.js", "app.js", "audio.js", "automations.js", "brain.js", "cards.js", "connector-booking.js", "connector-deezer.js", "connector-files.js", "connector-genis.js", "connector-google.js", "connector-knowledge.js", "connector-maps.js", "connector-media.js", "connector-shopping.js", "connector-sopp.js", "connector-system.js", "connector-travel.js", "connector-weather.js", "connectors-prepared.js", "connectors.js", "datetime-fr.js", "executor.js", "files.js", "gateway.js", "geo.js", "legacy.js", "memory.js", "modals.js", "nlu-local.js", "notifications.js", "panels.js", "permissions.js", "scheduler.js", "security.js", "services.js", "spaces.js", "storage.js", "strong-auth.js", "tts.js", "ui.js", "util.js", "vault.js", "voice.js", "waveform.js"];
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(VERSION);
  await Promise.all(SHELL.map(async u => { const r = await fetch(new Request(u, { cache: 'reload' })); if (!r.ok) throw new Error(u); await c.put(u, r); }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('genis-') && !k.startsWith(VERSION)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') { e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put('index.html', r.clone())); return r; }).catch(() => caches.match('index.html'))); return; }
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put(req, r.clone())); return r; }).catch(() => hit); return hit || net; }));
    return;
  }
  if (/^(cdnjs\.cloudflare\.com|esm\.sh|cdn\.jsdelivr\.net)$/.test(url.hostname)) e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) caches.open(VERSION + '-cdn').then(c => c.put(req, r.clone())); return r; })));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => (cs.length ? cs[0].focus() : self.clients.openWindow('./')))); });
self.addEventListener('push', e => { let d = {}; try { d = e.data.json(); } catch {} e.waitUntil(self.registration.showNotification(d.title || 'G.E.N.I.S', { body: d.body || '', icon: 'genis-192.png', tag: d.tag })); });
