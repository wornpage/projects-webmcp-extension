import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';

const port = 4173;
const landingPort = 4174;
const origin = `http://127.0.0.1:${port}`;
const landingOrigin = `http://127.0.0.1:${landingPort}`;
const viteCli = path.resolve('svelte-frontend/node_modules/vite/bin/vite.js');
const server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(port)], { cwd: 'svelte-frontend', stdio: 'ignore', windowsHide: true });
const landingServer = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(landingPort), '--strictPort'], { cwd: '.', stdio: 'ignore', windowsHide: true });
let browser;

async function waitForServer(url) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try { if ((await fetch(url)).ok) return; } catch {}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Browser smoke server did not become ready: ${url}`);
}

try {
	await Promise.all([
		waitForServer(`${origin}/next`),
		waitForServer(`${landingOrigin}/landing.html`)
	]);
	browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined });

	const landingPage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
	await landingPage.goto(`${landingOrigin}/landing.html`, { waitUntil: 'networkidle' });
	await landingPage.waitForFunction(() => document.documentElement.getAttribute('data-hero-product-proof') === 'ready');
	const heroProof = await landingPage.locator('.lp-preview .lp-panel').evaluate((panel) => ({
		marker: panel.hasAttribute('data-hero-product-proof'),
		text: panel.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
		actions: [...panel.querySelectorAll('.lp-proof-action')].map((action) => action.textContent?.trim())
	}));
	assert.equal(heroProof.marker, true, 'the first fold upgrades to the signature product proof');
	assert.match(
		heroProof.text,
		/Verified action trail[\s\S]*?One accountable handoff[\s\S]*?3 verified · 1 pending[\s\S]*?Work 4 of 8 · Review 2 facts[\s\S]*?Agent stopped before Save[\s\S]*?Not saved[\s\S]*?Workflow[\s\S]*?Blocked[\s\S]*?Blocker[\s\S]*?Waiting on final details[\s\S]*?Proposed next action[\s\S]*?Confirm handoff details[\s\S]*?Human approval required/u
	);
	assert.deepEqual(heroProof.actions, ['Discard draft', 'Approve and save']);

	await landingPage.locator('#replay').scrollIntoViewIfNeeded();
	const replayStates = ['observe', 'narrow', 'prepare', 'decide'];
	for (let index = 0; index < replayStates.length; index += 1) {
		const state = replayStates[index];
		await landingPage.locator(`[data-replay="${index + 1}"]`).click();
		await landingPage.waitForFunction((expected) => document.querySelector('#replay-demo')?.getAttribute('data-replay-state') === expected, state);
		const replay = await landingPage.locator('#replay-demo').evaluate((demo) => ({
			state: demo.getAttribute('data-replay-state'),
			label: demo.getAttribute('aria-label'),
			stage: demo.querySelector('#replay-stage-label')?.textContent?.trim(),
			activeViews: [...demo.querySelectorAll('[data-replay-view].is-active')].map((view) => view.getAttribute('data-replay-view')),
			currentProgress: [...demo.querySelectorAll('[data-replay-progress].is-current')].length,
			pressedSteps: [...document.querySelectorAll('.lp-replay-step[aria-pressed="true"]')].map((step) => step.getAttribute('data-replay')),
			text: demo.textContent?.replace(/\s+/gu, ' ').trim() ?? ''
		}));
		assert.equal(replay.state, state);
		assert.match(replay.label ?? '', new RegExp(`^${state[0].toUpperCase()}${state.slice(1)}:`, 'u'));
		assert.equal(replay.stage, `${state[0].toUpperCase()}${state.slice(1)} · ${index + 1} of 4`);
		assert.deepEqual(replay.activeViews, [state]);
		assert.equal(replay.currentProgress, 1);
		assert.deepEqual(replay.pressedSteps, [String(index + 1)]);
		if (state === 'decide') {
			assert.match(replay.text, /Agent stopped here[\s\S]*?Your decision[\s\S]*?Discard draft[\s\S]*?Approve and save[\s\S]*?No workspace change until you choose\./u);
		}
	}
	const playButton = landingPage.locator('#replay-play');
	await playButton.click();
	assert.equal(await playButton.getAttribute('aria-pressed'), 'true');
	assert.match((await playButton.textContent()) ?? '', /Stop the handoff/u);
	assert.equal(await landingPage.locator('#replay-demo').getAttribute('data-replay-state'), 'observe');
	await playButton.click();
	assert.equal(await playButton.getAttribute('aria-pressed'), 'false');
	assert.match((await playButton.textContent()) ?? '', /Watch the handoff/u);
	assert.equal(await landingPage.locator('#replay-demo').getAttribute('data-replay-state'), 'observe');
	assert.equal((await landingPage.locator('#replay-note').textContent())?.trim(), 'Press play — four steps, about ten seconds. No account, no setup.');
	await landingPage.setViewportSize({ width: 390, height: 900 });
	await landingPage.locator('#replay').scrollIntoViewIfNeeded();
	const landingMetrics = await landingPage.evaluate(() => ({
		documentWidth: document.documentElement.scrollWidth,
		viewportWidth: document.documentElement.clientWidth,
		demoWidth: document.querySelector('#replay-demo')?.getBoundingClientRect().width ?? 0,
		heroWidth: document.querySelector('.lp-preview')?.getBoundingClientRect().width ?? 0,
		replayDecisionActions: document.querySelectorAll('#replay-demo .lp-proof-action').length,
		heroDecisionActions: document.querySelectorAll('.lp-preview .lp-proof-action').length
	}));
	assert.ok(landingMetrics.documentWidth <= landingMetrics.viewportWidth, `landing proof should not overflow: ${landingMetrics.documentWidth}px > ${landingMetrics.viewportWidth}px`);
	assert.ok(landingMetrics.demoWidth > 0 && landingMetrics.demoWidth <= landingMetrics.viewportWidth);
	assert.ok(landingMetrics.heroWidth > 0 && landingMetrics.heroWidth <= landingMetrics.viewportWidth);
	assert.equal(landingMetrics.replayDecisionActions, 2);
	assert.equal(landingMetrics.heroDecisionActions, 2);
	console.log(JSON.stringify({ heroProof: true, landingReplay: replayStates, humanBoundary: true, mobileOverflow: false }));
	await landingPage.close();

	const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
	await page.goto(`${origin}/next`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(async () => {
		const seed = await (await fetch('/data/demo-packs.json')).json();
		localStorage.setItem('projects-webmcp-challenge-state-v1', JSON.stringify({ packs: seed, pendingNextActionDrafts: [{ workId: seed[0].id, choice: 'Clear the garage floor', mode: 'preset', evidenceNote: 'Smoke test', evidence: [{ workId: seed[0].id, field: 'workflow', expectedValue: 'Blocked' }], originFingerprint: 'smoke', source: 'webmcp' }] }));
	});
	async function checkViewport(width) {
		await page.setViewportSize({ width, height: 900 });
		await page.reload({ waitUntil: 'networkidle' });
		await page.waitForSelector('.pending-approval-link', { state: 'visible' });
		const result = await page.locator('.challenge-shell-nav').evaluate((header) => { const nav = header.querySelector('nav'); const links = [...header.querySelectorAll('nav a')]; const navRect = nav.getBoundingClientRect(); const headerRect = header.getBoundingClientRect(); const brandRect = header.querySelector('.challenge-brand').getBoundingClientRect(); const pendingRect = header.querySelector('.pending-approval-link').getBoundingClientRect(); return { linkCount: links.length, labels: links.map((link) => link.textContent.trim()), navTop: navRect.top, navWidth: navRect.width, pendingTop: pendingRect.top, pendingWidth: pendingRect.width, brandWidth: brandRect.width, headerHeight: headerRect.height, statusTop: header.querySelector('.webmcp-status-pill').getBoundingClientRect().top, documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth, saveBoundary: [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Approve and save') }; });
		assert.equal(result.linkCount, 6);
		assert.deepEqual(result.labels, ['Guide', 'Priority', '1 Work', '2 Review', '3 Next', 'Pending 1']);
		assert.ok(result.headerHeight < 180, `header should remain compact, got ${result.headerHeight}px`);
		assert.ok(result.statusTop < result.navTop, 'WebMCP status should remain grouped above the workflow links');
		assert.ok(result.navWidth > 0, 'navigation should use the full available row');
		assert.ok(result.documentWidth <= result.viewportWidth, `header should not overflow horizontally: ${result.documentWidth}px > ${result.viewportWidth}px`);
		assert.ok(result.brandWidth > 200, 'Wornpage Projects brand should retain readable width');
		if (width === 768) assert.equal(result.pendingTop, result.navTop);
		if (width === 700) {
			assert.ok(result.pendingTop > result.navTop, 'compact Pending link should occupy its own navigation row');
			assert.ok(result.pendingWidth >= result.navWidth - 2, 'compact Pending row should use the full available width');
		}
		assert.equal(result.saveBoundary, true, 'human-only Approve and save boundary remains visible');
		console.log(JSON.stringify({ viewport: `${width}x900`, ...result }));
	}
	await checkViewport(700);
	await checkViewport(768);
} finally {
	await browser?.close();
	server.kill();
	landingServer.kill();
}
