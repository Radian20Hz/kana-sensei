/**
 * @fileoverview KanaSensei — Service Worker
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS) → cache-first, served instantly offline
 *   - Firebase / Google APIs    → network-only (auth & data must be live)
 *   - Everything else           → stale-while-revalidate
 *
 * Bump CACHE_VERSION whenever you deploy changes to the app shell.
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

const CACHE_VERSION = 'kanasensei-v5';

const APP_SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/css/main.css',
  '/js/main.js',
  '/js/engine.js',
  '/js/data.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/config.js',
  '/js/live-dashboard.js',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
];

// ─── Install: precache app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: purge stale caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: routing logic ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { hostname } = new URL(event.request.url);

  // Always go to network for Firebase / Google (auth, Firestore, RTDB)
  const isFirebase = hostname.includes('firebase') ||
                     hostname.includes('firebaseio') ||
                     hostname.includes('googleapis') ||
                     hostname.includes('google.com');
  if (isFirebase) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Cache hit — serve instantly, revalidate in background
      const networkFetch = fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return the cached app shell for document requests
        if (event.request.destination === 'document') return caches.match('/app.html');
      });

      return cached ?? networkFetch;
    })
  );
});
