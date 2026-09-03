import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';

const port = 4175;
const origin = `http://127.0.0.1:${port}`;
const storageKey = 'projects-webmcp-challenge-state-v1';
const server = spawn(
	process.execPath,
	[path.resolve('svelte-frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
	{ cwd: 'svelte-frontend', stdio: 'ignore', windowsHide: true }
);
let browser;

async function waitForServer() {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(`${origin}/work`);
			if (response.ok) return;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Work smoke server did not start at ${origin}.`);
}

async function assertCardCommands(page, density) {
	const sameDestination = page.locator('[data-pack-id="same-destination"]');
	await sameDestination.waitFor({ state: 'visible' });
	assert.equal(await sameDestination.locator('a[href="/next?pack=same-destination"]').count(), 1, `${density} cards retain one canonical Next title link.`);
	assert.equal(await sameDestination.locator('[data-work-primary-navigation]').count(), 0, `${density} cards omit only the duplicate primary Next link.`);

	const distinctNavigation = page.locator('[data-pack-id="review-destination"]');
	assert.equal(await distinctNavigation.locator('[data-work-primary-navigation][href="/review?focus=review-destination"]').count(), 1, `${density} cards retain a distinct Review navigation command.`);

	const mutation = page.locator('[data-pack-id="mutation-command"]');
	assert.equal(await mutation.locator('[data-work-primary-mutation]').count(), 1, `${density} cards retain mutation commands.`);
}

try {
	await waitForServer();
	browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined });
	const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
	await page.addInitScript(() => {
		window.__workToolRegistrations = [];
		Object.defineProperty(document, 'modelContext', {
			configurable: true,
			value: {
				registerTool(tool) {
					window.__workToolRegistrations.push({
						name: tool.name,
						annotations: structuredClone(tool.annotations)
					});
				}
			}
		});
	});
	await page.goto(`${origin}/work`, { waitUntil: 'networkidle' });
	await page.evaluate((key) => {
		localStorage.setItem(key, JSON.stringify({
			packs: [
				{ id: 'same-destination', title: 'Same destination', status: 'active', blocker: 'none', next: '', activity: ['[2026-09-03 09:00] Created.'] },
				{ id: 'review-destination', title: 'Review destination', status: 'blocked', blocker: 'Waiting for review', next: 'Open', activity: ['[2026-09-03 09:00] Created.'] },
				{ id: 'mutation-command', title: 'Mutation command', status: 'active', blocker: 'none', next: 'Done', activity: ['[2026-09-03 09:00] Created.'] }
			]
		}));
	}, storageKey);
	await page.reload({ waitUntil: 'networkidle' });
	await page.locator('[data-pack-id="same-destination"]').waitFor({ state: 'visible' });

	const registrationsBeforeQuickAdd = await page.evaluate(() => structuredClone(window.__workToolRegistrations));
	assert.deepEqual(registrationsBeforeQuickAdd.map((tool) => tool.name), ['get_current_work_view', 'show_work_search', 'create_work_drafts']);
	await assertCardCommands(page, 'grid');

	await page.getByRole('button', { name: 'Additional work filters' }).click();
	await page.getByRole('tab', { name: 'Cards' }).click();
	await assertCardCommands(page, 'card');
	await page.locator('#sort-work').selectOption('manual');
	const manualCard = page.locator('[data-pack-id="same-destination"]');
	await manualCard.focus();
	await page.getByRole('button', { name: 'Move focused down' }).click();
	await page.waitForFunction((key) => {
		const raw = localStorage.getItem(key);
		if (!raw) return false;
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed.state?.manualOrder) && parsed.state.manualOrder.includes('same-destination');
	}, storageKey);

	const title = 'Quick add receipt smoke';
	await page.locator('.quick-create-input').fill(title);
	await page.locator('[data-work-quick-create-submit]').click();
	const receipt = page.locator('#work-receipt');
	await receipt.waitFor({ state: 'visible' });
	assert.match((await receipt.textContent()) ?? '', /Created Quick add receipt smoke\./u);
	await page.waitForFunction(() => document.activeElement?.id === 'work-receipt');
	assert.equal(await page.evaluate(() => document.activeElement?.id), 'work-receipt', 'Quick Add focuses the shared durable action receipt.');
	assert.deepEqual(await page.evaluate(() => structuredClone(window.__workToolRegistrations)), registrationsBeforeQuickAdd, 'Quick Add does not change Work WebMCP authority.');

	await page.reload({ waitUntil: 'networkidle' });
	await page.locator('#work-receipt').waitFor({ state: 'visible' });
	assert.match((await page.locator('#work-receipt').textContent()) ?? '', /Created Quick add receipt smoke\./u);
	assert.equal(await page.locator('[data-work-item]').filter({ hasText: title }).count(), 1, 'Quick Add persists the created item with its receipt.');
	console.log(JSON.stringify({
		cards: { grid: 'same-destination suppressed; distinct navigation and mutation retained', card: 'same-destination suppressed; distinct navigation and mutation retained' },
		quickAdd: { receipt: 'visible, focused, and durable after reload' },
		webMcp: registrationsBeforeQuickAdd.map((tool) => tool.name)
	}));
} finally {
	await browser?.close();
	server.kill();
}
