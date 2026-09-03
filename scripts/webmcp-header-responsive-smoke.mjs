import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';

const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.resolve('svelte-frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port)], { cwd: 'svelte-frontend', stdio: 'ignore', windowsHide: true });
let browser;
try {
	for (let attempt = 0; attempt < 30; attempt += 1) { try { await fetch(`${origin}/next`); break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } }
	browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
	await page.goto(`${origin}/next`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(async () => {
		const seed = await (await fetch('/data/demo-packs.json')).json();
		localStorage.setItem('projects-webmcp-challenge-state-v1', JSON.stringify({ packs: seed, pendingNextActionDrafts: [{ workId: seed[0].id, choice: 'Clear the garage floor', mode: 'preset', evidenceNote: 'Smoke test', evidence: [{ workId: seed[0].id, field: 'workflow', expectedValue: 'Blocked' }], originFingerprint: 'smoke', source: 'webmcp' }] }));
	});
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForSelector('.pending-approval-link', { state: 'visible' });
	const result = await page.locator('.challenge-shell-nav').evaluate((header) => { const nav = header.querySelector('nav'); const links = [...header.querySelectorAll('nav a')]; const navRect = nav.getBoundingClientRect(); const headerRect = header.getBoundingClientRect(); return { linkCount: links.length, labels: links.map((link) => link.textContent.trim()), navTop: navRect.top, pendingTop: header.querySelector('.pending-approval-link').getBoundingClientRect().top, headerHeight: headerRect.height, statusTop: header.querySelector('.webmcp-status-pill').getBoundingClientRect().top, saveBoundary: [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Approve and save') }; });
	assert.equal(result.linkCount, 6);
	assert.deepEqual(result.labels, ['Guide', 'Priority', '1 Work', '2 Review', '3 Next', 'Pending 1']);
	assert.equal(result.pendingTop, result.navTop);
	assert.ok(result.headerHeight < 150, `header should remain compact, got ${result.headerHeight}px`);
	assert.ok(result.statusTop < result.navTop, 'WebMCP status should remain grouped above the workflow links');
	assert.equal(result.saveBoundary, true, 'human-only Approve and save boundary remains visible');
	console.log(JSON.stringify({ viewport: '768x900', ...result }));
} finally { await browser?.close(); server.kill(); }
