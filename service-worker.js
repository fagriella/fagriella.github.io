// F.AGRIELLA — Service Worker
// Versi cache — naikkan versi ini saat ada update agar cache lama dihapus otomatis
const CACHE_NAME = 'fagriella-v1';

// Aset statis yang di-cache saat instalasi
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/images/logo/F.AGRIELLA.webp'
];

// ===== INSTALL: Cache aset statis =====
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// ===== ACTIVATE: Hapus cache lama =====
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// ===== FETCH: Network-first untuk data, Cache-first untuk aset statis =====
self.addEventListener('fetch', function (event) {
    var url = new URL(event.request.url);

    // Jangan intercept request ke Google Sheets / Drive / ntfy
    if (
        url.hostname === 'docs.google.com' ||
        url.hostname === 'drive.google.com' ||
        url.hostname === 'spreadsheets.google.com' ||
        url.hostname === 'script.google.com' ||
        url.hostname === 'ntfy.sh'
    ) {
        return;
    }

    // Untuk file dari origin sendiri: Cache-first, fallback network
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(function (cached) {
                return cached || fetch(event.request).then(function (response) {
                    // Simpan di cache jika responsnya valid
                    if (response && response.status === 200 && response.type === 'basic') {
                        var clone = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                });
            }).catch(function () {
                // Offline fallback ke halaman utama jika tersedia
                return caches.match('/index.html');
            })
        );
    }
});

// ===== PUSH: Tangkap notifikasi dari ntfy.sh =====
self.addEventListener('push', function (event) {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { message: event.data ? event.data.text() : 'Notifikasi Baru' };
    }

    const title = data.title || 'Info Baru - F.AGRIELLA';
    const options = {
        body: data.message || data.body || 'Ada pembaruan di Arsip Kuliah.',
        icon: '/images/logo/F.AGRIELLA.webp',
        badge: '/images/logo/F.AGRIELLA.webp',
        vibrate: [200, 100, 200],
        tag: 'ntfy-push',
        data: {
            url: data.click || data.url || self.location.origin
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ===== NOTIFICATION CLICK: Buka URL saat diklik =====
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
