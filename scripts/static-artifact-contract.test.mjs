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

function collectCss(directory) {
	return collectFiles(directory)
		.filter((file) => file.endsWith('.css'))
		.map((file) => readFileSync(file, 'utf8'))
		.join('\n');
}

function getAttribute(element, name) {
	const match = element.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'));
	return match?.[1] ?? null;
}

function findCssBlock(css, atRulePattern) {
	const match = atRulePattern.exec(css);
	assert.ok(match, `built CSS contains ${atRulePattern}`);
	const openBrace = css.indexOf('{', match.index);
	let depth = 1;
	for (let index = openBrace + 1; index < css.length; index += 1) {
		if (css[index] === '{') depth += 1;
		if (css[index] === '}') depth -= 1;
		if (depth === 0) return css.slice(openBrace + 1, index);
	}
	assert.fail(`built CSS closes ${atRulePattern}`);
}

function parseCssRules(css) {
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((match) => ({
		selectors: match[1].split(',').map((selector) => selector.trim()),
		declarations: new Map(
			match[2]
				.split(';')
				.filter(Boolean)
				.map((declaration) => {
					const colon = declaration.indexOf(':');
					return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
				})
		)
	}));
}

function findRule(rules, selectorPattern) {
	const rule = rules.find(({ selectors }) => selectors.some((selector) => selectorPattern.test(selector)));
	assert.ok(rule, `built CSS contains a rule matching ${selectorPattern}`);
	return rule;
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
	for (const route of ['webmcp-challenge.html', 'work.html', 'review.html', 'next.html']) {
		const html = readFileSync(path.join(artifactRoot, route), 'utf8');
		const brand = html.match(/<a\b[^>]*\bclass="[^"]*\bchallenge-brand\b[^"]*"[^>]*>[\s\S]*?<\/a>/u)?.[0];
		assert.ok(brand, `${route} contains the interactive challenge-brand anchor`);
		assert.equal(getAttribute(brand, 'href'), '/landing.html', `${route} preserves the landing route`);
		assert.equal(
			getAttribute(brand, 'aria-label'),
			'Wornpage Projects landing page',
			`${route} preserves the brand accessible name`
		);
		assert.match(brand, /<span[^>]*>Wornpage Projects<\/span>/u, `${route} preserves the visible brand name`);
	}

	const css = collectCss(artifactRoot);
	const rules = parseCssRules(css);
	const brandRule = findRule(rules, /^\.challenge-brand(?:\.[\w-]+)?$/u);
	assert.equal(brandRule.declarations.get('min-height'), '44px');
	assert.equal(brandRule.declarations.get('padding'), '0 12px');
	assert.equal(brandRule.declarations.get('min-width'), '0');

	const brandTextRule = findRule(rules, /^\.challenge-brand(?:\.[\w-]+)? span(?::where\([^)]*\))?$/u);
	assert.equal(brandTextRule.declarations.get('overflow'), 'hidden');
	assert.equal(brandTextRule.declarations.get('text-overflow'), 'ellipsis');
	assert.equal(brandTextRule.declarations.get('white-space'), 'nowrap');

	const focusRule = findRule(rules, /^\.challenge-brand(?:\.[\w-]+)?:focus-visible$/u);
	assert.equal(focusRule.declarations.get('outline'), '2px dashed var(--worn-focus)');
	assert.equal(focusRule.declarations.get('outline-offset'), '2px');

	const hoverRule = findRule(rules, /^\.challenge-brand(?:\.[\w-]+)?:hover$/u);
	assert.equal(hoverRule.declarations.get('background'), 'var(--worn-hover-bg)');

	const compactRules = parseCssRules(findCssBlock(css, /@media\s*\(max-width:\s*700px\)/u));
	const compactBrandRules = compactRules.filter(({ selectors }) =>
		selectors.some((selector) => selector.includes('.challenge-brand'))
	);
	assert.deepEqual(
		compactBrandRules,
		[],
		'compact CSS does not remove or override challenge-brand padding and text containment'
	);
	for (const pattern of deniedRuntimePatterns) assert.doesNotMatch(artifactText, pattern);
});
