import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';

const port = 4177;
const origin = `http://127.0.0.1:${port}`;
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
	for (const path of ['/landing.html', '/assets/landing.css', '/assets/landing.js']) {
		assert.match(serviceWorkerSource, new RegExp(`['\"]${path.replaceAll('/', '\\/')}['\"]`, 'u'), `${path} is explicitly precached`);
	}
	assert.match(serviceWorkerSource, /NETWORK_FIRST_PATHS[\s\S]*?'\/data\/demo-packs\.json'[\s\S]*?'\/assets\/landing\.css'[\s\S]*?'\/assets\/landing\.js'/u, 'unversioned landing and seed assets prefer the network');
	assert.match(serviceWorkerSource, /event\.request\.mode === 'navigate'[\s\S]*?fetchAndCache\(event\.request\)\.catch\(\(\) => cachedOrOfflineFallback/u, 'navigations refresh online and fall back offline');

	browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined });
	const context = await browser.newContext({ serviceWorkers: 'allow' });
	const page = await context.newPage();
	await page.goto(`${origin}/webmcp-challenge`, { waitUntil: 'networkidle' });
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/sw.js');
		await Promise.race([
			navigator.serviceWorker.ready,
			new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker did not become ready.')), 10000))
		]);
	});
	await page.reload({ waitUntil: 'networkidle' });
	assert.ok(await page.evaluate(async () => (await caches.keys()).includes('projects-webmcp-v2')), 'offline cache is installed');

	// Deliberately poison one navigation entry. Network-first routing must replace
	// it with the live page while online, then retain that refreshed response for
	// the subsequent offline navigation.
	await page.evaluate(async () => {
		const cache = await caches.open('projects-webmcp-v2');
		await cache.put('/work', new Response(
			'<!doctype html><html><body><main id="stale-work-cache">stale work cache</main></body></html>',
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		));
	});
	await page.goto(`${origin}/work`, { waitUntil: 'networkidle' });
	assert.equal(await page.locator('#stale-work-cache').count(), 0, 'online navigation does not serve a poisoned cached page');
	assert.equal(await page.locator('main.challenge-route').count(), 1, 'online navigation serves the current Work route');
	const refreshedWorkCache = await page.evaluate(async () => (await (await caches.match('/work')).text()).includes('challenge-route'));
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
	console.log(JSON.stringify({ cache: 'projects-webmcp-v2', freshness: 'network-first', offline: true, routes: ['webmcp-challenge', 'work'], cachedSeed }));
} finally {
	await browser?.close();
	server.kill();
}
