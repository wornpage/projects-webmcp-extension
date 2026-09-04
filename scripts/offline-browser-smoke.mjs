import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';

const port = 4177;
const origin = `http://127.0.0.1:${port}`;
const activeCacheName = 'projects-webmcp-v2-atomic-1';
const legacyCacheName = 'projects-webmcp-v2';
const unrelatedCacheName = 'unrelated-browser-cache';
const server = spawn(process.execPath, [path.resolve('svelte-frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: 'svelte-frontend', stdio: 'ignore', windowsHide: true });
let browser;

try {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try { if ((await fetch(`${origin}/webmcp-challenge`)).ok) break; } catch {}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	const serviceWorkerResponse = await fetch(`${origin}/sw.js`);
	assert.equal(serviceWorkerResponse.status, 200, 'service worker script is served');
	const serviceWorkerSource = await serviceWorkerResponse.text();
	for (const assetPath of ['/landing.html', '/assets/landing.css', '/assets/landing.js']) {
		assert.match(serviceWorkerSource, new RegExp(`['\"]${assetPath.replaceAll('/', '\\/')}['\"]`, 'u'), `${assetPath} is explicitly precached`);
	}
	const precacheSource = serviceWorkerSource.match(/const PRECACHE = \[([\s\S]*?)\];/u)?.[1] ?? '';
	assert.doesNotMatch(precacheSource, /['"]\/sw\.js['"]/u, 'the browser-managed worker script is not stored in Cache Storage');
	assert.match(serviceWorkerSource, /CACHE_GENERATION = 'atomic-1'[\s\S]*?ACTIVE_CACHE_NAME = `\$\{CACHE_NAME\}-\$\{CACHE_GENERATION\}`/u, 'each worker shell owns a distinct active cache generation');
	assert.match(serviceWorkerSource, /async function precacheRequiredAssets\(\)[\s\S]*?await caches\.delete\(ACTIVE_CACHE_NAME\)[\s\S]*?Promise\.all\(PRECACHE\.map[\s\S]*?!isCacheable\(response\)[\s\S]*?catch \(error\)[\s\S]*?await caches\.delete\(ACTIVE_CACHE_NAME\)[\s\S]*?throw error/u, 'required precache failure removes the incomplete generation and rejects installation');
	assert.match(serviceWorkerSource, /key\.startsWith\(OWNED_CACHE_PREFIX\) && key !== ACTIVE_CACHE_NAME/u, 'activation removes only obsolete app-owned caches');
	assert.match(serviceWorkerSource, /NETWORK_FIRST_PATHS[\s\S]*?'\/data\/demo-packs\.json'[\s\S]*?'\/assets\/landing\.css'[\s\S]*?'\/assets\/landing\.js'/u, 'unversioned landing and seed assets prefer the network');
	assert.match(serviceWorkerSource, /event\.request\.mode === 'navigate'[\s\S]*?fetchAndCache\(event\.request\)\.catch\(\(\) => cachedOrOfflineFallback/u, 'navigations refresh online and fall back offline');

	browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined });
	const context = await browser.newContext({ serviceWorkers: 'allow' });
	const page = await context.newPage();

	// Seed one obsolete app cache and one unrelated cache before the application
	// registers its worker. Activation must delete only the obsolete app cache.
	await page.goto(`${origin}/data/demo-packs.json`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(async ({ legacyCacheName, unrelatedCacheName }) => {
		const legacy = await caches.open(legacyCacheName);
		await legacy.put('/legacy-cache-marker', new Response('legacy'));
		const unrelated = await caches.open(unrelatedCacheName);
		await unrelated.put('/unrelated-cache-marker', new Response('preserve me'));
	}, { legacyCacheName, unrelatedCacheName });

	await page.goto(`${origin}/webmcp-challenge`, { waitUntil: 'networkidle' });
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/sw.js');
		await Promise.race([
			navigator.serviceWorker.ready,
			new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker did not become ready.')), 10000))
		]);
	});
	await page.reload({ waitUntil: 'networkidle' });
	const installedCaches = await page.evaluate(async ({ activeCacheName, legacyCacheName, unrelatedCacheName }) => {
		const keys = await caches.keys();
		const active = await caches.open(activeCacheName);
		return {
			keys,
			activeInstalled: keys.includes(activeCacheName),
			legacyRemoved: !keys.includes(legacyCacheName),
			unrelatedPreserved: keys.includes(unrelatedCacheName) && Boolean(await caches.match('/unrelated-cache-marker')),
			workerScriptCached: Boolean(await active.match('/sw.js'))
		};
	}, { activeCacheName, legacyCacheName, unrelatedCacheName });
	assert.equal(installedCaches.activeInstalled, true, 'the complete active cache generation is installed');
	assert.equal(installedCaches.legacyRemoved, true, 'the obsolete app cache is removed after successful activation');
	assert.equal(installedCaches.unrelatedPreserved, true, 'activation preserves caches owned by other same-origin features');
	assert.equal(installedCaches.workerScriptCached, false, 'the active cache does not duplicate the browser-managed service worker script');

	// Deliberately poison one navigation entry. Network-first routing must replace
	// it with the live page while online, then retain that refreshed response for
	// the subsequent offline navigation.
	await page.evaluate(async ({ activeCacheName }) => {
		const cache = await caches.open(activeCacheName);
		await cache.put('/work', new Response(
			'<!doctype html><html><body><main id="stale-work-cache">stale work cache</main></body></html>',
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		));
	}, { activeCacheName });
	await page.goto(`${origin}/work`, { waitUntil: 'networkidle' });
	assert.equal(await page.locator('#stale-work-cache').count(), 0, 'online navigation does not serve a poisoned cached page');
	assert.equal(await page.locator('main.challenge-route').count(), 1, 'online navigation serves the current Work route');
	const refreshedWorkCache = await page.evaluate(async ({ activeCacheName }) => {
		const cache = await caches.open(activeCacheName);
		const response = await cache.match('/work');
		return response ? (await response.text()).includes('challenge-route') : false;
	}, { activeCacheName });
	assert.equal(refreshedWorkCache, true, 'the live Work response replaces the poisoned cache entry');

	for (const route of ['priority', 'work', 'review', 'next']) {
		await page.goto(`${origin}/${route}`, { waitUntil: 'networkidle' });
	}
	await context.setOffline(true);
	await page.goto(`${origin}/webmcp-challenge`, { waitUntil: 'domcontentloaded', timeout: 10000 });
	assert.equal(await page.locator('[data-webmcp-challenge-guide]').count(), 1, 'Guide loads offline from the service worker cache');
	await page.goto(`${origin}/work`, { waitUntil: 'domcontentloaded', timeout: 10000 });
	assert.equal(await page.locator('main.challenge-route').count(), 1, 'Work route loads offline from the refreshed service worker cache');
	assert.equal(await page.locator('#stale-work-cache').count(), 0, 'offline Work uses the refreshed response, not the poisoned one');
	const cachedSeed = await page.evaluate(async () => (await (await fetch('/data/demo-packs.json')).json()).length);
	assert.ok(cachedSeed > 0, 'bundled seed data is available offline');
	console.log(JSON.stringify({ cache: activeCacheName, install: 'atomic', unrelatedCachePreserved: true, freshness: 'network-first', offline: true, routes: ['webmcp-challenge', 'work'], cachedSeed }));
} finally {
	await browser?.close();
	server.kill();
}
