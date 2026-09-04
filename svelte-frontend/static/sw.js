// CACHE_NAME is the stable family anchor retained by the static artifact
// contract. Bump CACHE_GENERATION whenever this worker's cached shell changes;
// a distinct active cache keeps installation isolated from the controlling
// worker's cache until the new worker activates successfully.
const CACHE_NAME = 'projects-webmcp-v2';
const CACHE_GENERATION = 'atomic-1';
const ACTIVE_CACHE_NAME = `${CACHE_NAME}-${CACHE_GENERATION}`;
const OWNED_CACHE_PREFIX = 'projects-webmcp-v';

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
	'/assets/icon-512.svg'
];

// These URLs are intentionally unversioned. Prefer the network while online so
// a newly deployed landing proof, manifest, or sample seed cannot be hidden by
// an older cache entry. The active cache remains the offline fallback.
const NETWORK_FIRST_PATHS = new Set([
	'/',
	'/landing.html',
	'/manifest.json',
	'/data/demo-packs.json',
	'/assets/demo.css',
	'/assets/landing.css',
	'/assets/landing.js'
]);

function isCacheable(response) {
	return response.ok && response.status === 200;
}

async function activeCache() {
	return caches.open(ACTIVE_CACHE_NAME);
}

async function fetchAndCache(request) {
	const response = await fetch(request);
	if (isCacheable(response)) {
		try {
			const cache = await activeCache();
			await cache.put(request, response.clone());
		} catch {}
	}
	return response;
}

async function cachedOrOfflineFallback(request) {
	const cache = await activeCache();
	const cached = await cache.match(request);
	if (cached) return cached;
	if (request.mode === 'navigate') {
		const guide = await cache.match('/webmcp-challenge');
		if (guide) return guide;
	}
	return Response.error();
}

async function precacheRequiredAssets() {
	// This generation is unique to the new worker, so clearing it cannot disturb
	// the cache still owned by the controlling worker.
	await caches.delete(ACTIVE_CACHE_NAME);
	const cache = await activeCache();
	try {
		const entries = await Promise.all(PRECACHE.map(async (url) => {
			const response = await fetch(new Request(url, { cache: 'reload' }));
			if (!isCacheable(response)) {
				throw new Error(`Required offline asset failed to load: ${url} (${response.status})`);
			}
			return { url, response };
		}));
		await Promise.all(entries.map(({ url, response }) => cache.put(url, response)));
	} catch (error) {
		await caches.delete(ACTIVE_CACHE_NAME);
		throw error;
	}
}

self.addEventListener('install', (event) => {
	event.waitUntil(precacheRequiredAssets());
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys
			.filter((key) => key.startsWith(OWNED_CACHE_PREFIX) && key !== ACTIVE_CACHE_NAME)
			.map((key) => caches.delete(key)));
		await self.clients.claim();
	})());
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

	event.respondWith(activeCache().then((cache) => cache.match(event.request)).then((cached) => cached || fetchAndCache(event.request)
		.catch(() => cachedOrOfflineFallback(event.request))));
});
