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
	for (const route of ['priority', 'work', 'review', 'next']) {
		await page.goto(`${origin}/${route}`, { waitUntil: 'networkidle' });
	}
	await context.setOffline(true);
	await page.goto(`${origin}/webmcp-challenge`, { waitUntil: 'domcontentloaded', timeout: 10000 });
	assert.equal(await page.locator('[data-webmcp-challenge-guide]').count(), 1, 'Guide loads offline from the service worker cache');
	await page.goto(`${origin}/work`, { waitUntil: 'domcontentloaded', timeout: 10000 });
	assert.equal(await page.locator('main.challenge-route').count(), 1, 'Work route loads offline from the service worker cache');
	const cachedSeed = await page.evaluate(async () => (await (await fetch('/data/demo-packs.json')).json()).length);
	assert.ok(cachedSeed > 0, 'bundled seed data is available offline');
	console.log(JSON.stringify({ cache: 'projects-webmcp-v2', offline: true, routes: ['webmcp-challenge', 'work'], cachedSeed }));
} finally {
	await browser?.close();
	server.kill();
}
