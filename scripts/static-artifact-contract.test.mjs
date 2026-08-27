import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { STATIC_PUBLISH_FILES, SVELTE_PUBLIC_FILES } from './build-static-publish.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(root, 'dist', 'static-publish');
const deniedRuntimePatterns = [
	/projectsdemo\.org/u,
	/\/api\//u,
	/\/(?:about|achievements|activity|adopt|agents|authorize|billing|blocked|calendar|catalog|changelog|compare|create|decisions|design|export|gantt|guide|heartbeat|home|inbox|insights|login|mcp-tools|memory|more|notifications|pack|profile|scenarios|search|settings|team|templates)(?:\/|\b)/u,
	/mcp-token|includeBudget/u
];

function collectFiles(directory, files = []) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) collectFiles(target, files);
		else if (entry.isFile()) files.push(target);
	}
	return files;
}

function collectText(directory) {
	return collectFiles(directory)
		.filter((file) => /\.(?:css|html|js|json|svg|txt)$/u.test(file))
		.map((file) => readFileSync(file, 'utf8'));
}

test('static artifact publishes the complete challenge input and security metadata', () => {
	for (const file of [
		'index.html',
		'landing.html',
		'THIRD_PARTY_LICENSES.txt',
		'manifest.json',
		'assets/og-image.svg',
		'data/demo-packs.json'
	]) {
		assert.ok(STATIC_PUBLISH_FILES.includes(file), `${file} is published`);
		assert.ok(existsSync(path.join(root, file)), `${file} exists`);
	}
	for (const file of ['_headers', 'robots.txt']) {
		assert.ok(SVELTE_PUBLIC_FILES.includes(file), `${file} is published`);
		assert.ok(existsSync(path.join(root, 'svelte-frontend', 'static', file)), `${file} exists`);
	}
	assert.equal(existsSync(path.join(root, 'svelte-frontend', 'static', 'sitemap.xml')), false);
	assert.equal(STATIC_PUBLISH_FILES.includes('assets/runtime-config.js'), false);
	const notices = readFileSync(path.join(root, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
	assert.match(notices, /Copyright \(c\) 2026 Lucide Icons and Contributors/u);
	assert.match(notices, /Copyright \(c\) 2013-present Cole Bemis/u);
	assert.match(notices, /Copyright \(c\) 2016-2025 \[Svelte Contributors\]/u);
	assert.match(notices, /Copyright \(c\) 2020 \[these people\]/u);
	assert.match(notices, /Copyright \(c\) 2026 Wornpage/u);
});

test('Svelte prerender validates one static adapter and no server output', () => {
	const config = readFileSync(path.join(root, 'svelte-frontend', 'svelte.config.js'), 'utf8');
	const build = readFileSync(path.join(root, 'scripts', 'build-svelte-frontend.mjs'), 'utf8');
	assert.match(config, /webmcp-challenge-static-adapter/u);
	assert.match(config, /builder\.writeClient\(output\)/u);
	assert.match(config, /builder\.writePrerendered\(output\)/u);
	assert.doesNotMatch(config, /writeServer|cloudflare|worker\/index/iu);
	assert.match(build, /buildStaticPublish\(stagedPublicDir\)/u);
	assert.match(build, /PROJECTS_SVELTE_ASSET_DIR: stagedPublicDir/u);
});

test('static mode identifies its bounded routes without production fallbacks', () => {
	const index = readFileSync(path.join(root, 'index.html'), 'utf8');
	const landing = readFileSync(path.join(root, 'landing.html'), 'utf8');
	const app = readFileSync(path.join(root, 'svelte-frontend', 'src', 'app.html'), 'utf8');
	const headers = readFileSync(path.join(root, 'svelte-frontend', 'static', '_headers'), 'utf8');
	for (const html of [index, landing, app]) {
		assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive"/u);
	}
	assert.match(landing, /href="\/work"/u);
	assert.match(landing, /href="\/review\?tour=landing"/u);
	assert.match(landing, /<a class="lp-skip" href="#main-content">Skip to main content<\/a>/u);
	assert.match(landing, /<main id="main-content" tabindex="-1">/u);
	assert.match(landing, /Let an agent find the next move\. Keep the final say\./u);
	assert.match(landing, /No automatic saves/u);
	assert.match(landing, /Confirm storage bin delivery/u);
	assert.doesNotMatch(`${landing}\n${app}`, /projectsdemo\.org|\/agents|\/billing/u);
	assert.match(headers, /X-Content-Type-Options: nosniff/u);
	assert.match(headers, /X-Robots-Tag: noindex, nofollow, noarchive/u);
});

test('built artifact exposes exactly the intended HTML routes and no executable edge path', () => {
	const expectedHtml = [
		'404.html',
		'index.html',
		'landing.html',
		'next.html',
		'review.html',
		'webmcp-challenge.html',
		'work.html'
	];
	const actualHtml = readdirSync(artifactRoot)
		.filter((name) => name.endsWith('.html'))
		.sort((left, right) => left.localeCompare(right));
	assert.deepEqual(actualHtml, expectedHtml);
	assert.equal(existsSync(path.join(artifactRoot, '_worker.js')), false);
	assert.equal(existsSync(path.join(artifactRoot, 'functions')), false);
	assert.equal(collectFiles(artifactRoot).some((file) => file.endsWith('.map')), false);
	assert.ok(existsSync(path.join(artifactRoot, 'THIRD_PARTY_LICENSES.txt')));
	assert.match(
		readFileSync(path.join(artifactRoot, '404.html'), 'utf8'),
		/<meta name="robots" content="noindex,nofollow,noarchive"/u
	);
	const artifactText = collectText(artifactRoot).join('\n');
	for (const pattern of deniedRuntimePatterns) assert.doesNotMatch(artifactText, pattern);
});
