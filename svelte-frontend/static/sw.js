const CACHE_NAME = 'projects-webmcp-v1';
const PRECACHE = [
	'/',
	'/webmcp-challenge',
	'/priority',
	'/work',
	'/review',
	'/next',
	'/manifest.json',
	'/data/demo-packs.json',
	'/assets/demo.css',
	'/sw.js'
];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
		await Promise.all(PRECACHE.map(async (url) => {
			try {
				const response = await fetch(url);
				if (response.ok) await cache.put(url, response);
			} catch {}
		}));
	}));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
	event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
		const copy = response.clone();
		void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
		return response;
	}).catch(() => event.request.mode === 'navigate' ? caches.match('/webmcp-challenge') : Response.error())));
});
