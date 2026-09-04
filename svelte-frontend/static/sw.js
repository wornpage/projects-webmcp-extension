const CACHE_NAME = 'projects-webmcp-v2';
const PRECACHE = [
	'/',
	'/landing.html',
	'/webmcp-challenge',
	'/priority',
	'/work',
	'/review',
	'/next',
	'/manifest.json',
	'/data/demo-packs.json',
	'/assets/demo.css',
	'/assets/landing.css',
	'/assets/landing.js',
	'/assets/favicon.png',
	'/assets/favicon.svg',
	'/assets/icon-192.svg',
	'/assets/icon-512.svg',
	'/sw.js'
];

// These URLs are intentionally unversioned. Prefer the network while online so
// a newly deployed landing proof, manifest, or sample seed cannot be hidden by
// an older cache entry. The cache remains the offline fallback.
const NETWORK_FIRST_PATHS = new Set([
	'/',
	'/landing.html',
	'/manifest.json',
	'/data/demo-packs.json',
	'/assets/demo.css',
	'/assets/landing.css',
	'/assets/landing.js'
]);

async function fetchAndCache(request) {
	const response = await fetch(request);
	if (response.ok && response.status === 200) {
		try {
			const cache = await caches.open(CACHE_NAME);
			await cache.put(request, response.clone());
		} catch {}
	}
	return response;
}

async function cachedOrOfflineFallback(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	if (request.mode === 'navigate') {
		const guide = await caches.match('/webmcp-challenge');
		if (guide) return guide;
	}
	return Response.error();
}

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
		await Promise.all(PRECACHE.map(async (url) => {
			try {
				const response = await fetch(new Request(url, { cache: 'reload' }));
				if (response.ok && response.status === 200) await cache.put(url, response);
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
	const requestUrl = new URL(event.request.url);
	if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin || requestUrl.pathname === '/sw.js') return;

	if (event.request.mode === 'navigate' || NETWORK_FIRST_PATHS.has(requestUrl.pathname)) {
		event.respondWith(fetchAndCache(event.request).catch(() => cachedOrOfflineFallback(event.request)));
		return;
	}

	event.respondWith(caches.match(event.request).then((cached) => cached || fetchAndCache(event.request)
		.catch(() => cachedOrOfflineFallback(event.request))));
});
