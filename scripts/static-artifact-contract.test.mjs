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

function findCssBlocks(css, atRuleName) {
	const blocks = [];
	let searchFrom = 0;
	while (searchFrom < css.length) {
		const atRuleIndex = css.indexOf(`@${atRuleName}`, searchFrom);
		if (atRuleIndex === -1) break;
		const openBrace = css.indexOf('{', atRuleIndex);
		assert.notEqual(openBrace, -1, `built CSS opens @${atRuleName}`);
		let depth = 1;
		let closeBrace = openBrace + 1;
		for (; closeBrace < css.length && depth > 0; closeBrace += 1) {
			if (css[closeBrace] === '{') depth += 1;
			if (css[closeBrace] === '}') depth -= 1;
		}
		assert.equal(depth, 0, `built CSS closes @${atRuleName}`);
		blocks.push({
			prelude: css.slice(atRuleIndex + atRuleName.length + 1, openBrace).trim(),
			body: css.slice(openBrace + 1, closeBrace - 1)
		});
		searchFrom = closeBrace;
	}
	return blocks;
}

function isCompactWidthMedia(prelude) {
	const upperBounds = [
		...[...prelude.matchAll(/max-width\s*:\s*(\d+(?:\.\d+)?)px/gu)].map((match) => Number(match[1])),
		...[...prelude.matchAll(/width\s*<=\s*(\d+(?:\.\d+)?)px/gu)].map((match) => Number(match[1]))
	];
	return upperBounds.some((upperBound) => upperBound <= 700);
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
	assert.match(landing, /Open the handoff workflow/u);
	assert.match(landing, /Public static sample, no login, no backend, and four focused workflow pages/u);
	assert.doesNotMatch(landing, /judge|contest|garage reset|recording/iu);
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
	const guideHtml = readFileSync(path.join(artifactRoot, 'webmcp-challenge.html'), 'utf8');
	assert.match(guideHtml, /data-agent-brief-input/u);
	assert.match(guideHtml, /data-agent-scope-chooser/u);
	assert.match(guideHtml, /challenge-guide-rail/u);
	assert.match(guideHtml, /<a href="\/work"[^>]*data-agent-scope-action-link[^>]*>.*?Open all 8 work items/u);
	assert.doesNotMatch(guideHtml, /8 matching of 8 workspace · All visible work/u);
	const railIndex = guideHtml.indexOf('challenge-guide-rail');
	const stepsIndex = guideHtml.indexOf('challenge-steps', railIndex);
	const editorIndex = guideHtml.indexOf('agent-brief-editor', railIndex);
	assert.ok(railIndex >= 0 && railIndex < stepsIndex && stepsIndex < editorIndex, 'built Guide keeps steps in the left rail before the editor');
	for (const href of ['/work', '/review', '/next']) {
		assert.match(guideHtml, new RegExp(`<a href="${href}"[^>]*>.*?(?:Start in Work|Continue to Review|Open the draft editor)`, 'u'));
	}
	assert.match(guideHtml, /maxlength="1000"/u);
	assert.doesNotMatch(guideHtml, /data-agent-work-query-input/u);
	assert.match(guideHtml, /All visible work is ready by default/u);
	assert.match(guideHtml, /Follow the brief on this page\./u);
	assert.match(guideHtml, /Local draft · not saved · workspace unchanged/u);
	assert.match(guideHtml, /Authority and browser status/u);
	assert.doesNotMatch(guideHtml, /challenge-facts|Projects workflow capabilities/u);
	assert.match(artifactText, /data-agent-work-query-input/u);
	assert.match(artifactText, /Custom Work search term \(optional\)/u);
	assert.match(artifactText, /an unmatched term stays at zero/u);
	assert.doesNotMatch(guideHtml, /A useful handoff, in order/u);

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
	assert.equal(focusRule.declarations.get('outline'), '2px solid var(--challenge-focus-mint)');
	assert.equal(focusRule.declarations.get('outline-offset'), '2px');

	const hoverRule = findRule(rules, /^\.challenge-brand(?:\.[\w-]+)?:hover$/u);
	assert.equal(hoverRule.declarations.get('background'), 'var(--worn-hover-bg)');

	const compiledSvelteCss = collectCss(path.join(artifactRoot, '_app', 'immutable', 'assets'));
	const compactMediaBlocks = findCssBlocks(compiledSvelteCss, 'media').filter(({ prelude }) =>
		isCompactWidthMedia(prelude)
	);
	assert.ok(compactMediaBlocks.length > 0, 'compiled Svelte CSS contains compact width media blocks');
	assert.ok(
		compactMediaBlocks.some(({ prelude }) => /\(width<=700px\)/u.test(prelude)),
		'compiled Svelte CSS contains the emitted @media (width<=700px) block'
	);
	for (const { prelude, body } of compactMediaBlocks) {
		const compactBrandRules = parseCssRules(body).filter(({ selectors }) =>
			selectors.some(
				(selector) =>
					/^\.challenge-brand(?:\.[\w-]+)?$/u.test(selector) ||
					/^\.challenge-brand(?:\.[\w-]+)? span(?::where\([^)]*\))?$/u.test(selector)
			)
		);
		assert.deepEqual(
			compactBrandRules,
			[],
			`compact compiled Svelte CSS ${prelude} does not override challenge-brand padding or ellipsis containment`
		);
	}
	for (const pattern of deniedRuntimePatterns) assert.doesNotMatch(artifactText, pattern);
});

test('built artifact keeps page-action receipts truthful and read-only getters silent', () => {
	const artifactText = collectText(artifactRoot).join('\n');
	for (const copy of [
		'Browser agent cleared Work search to show all work.',
		'Current scope',
		'Visible Review scope',
		'Current queue',
		'Search-match evidence',
		'Browser agent prepared an unsaved draft. No workspace data was saved.',
		'Evidence note',
		'Workspace data',
		'Unchanged',
		'Only you can Save'
	]) {
		assert.match(artifactText, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
	}
	assert.doesNotMatch(artifactText, /Unsaved draft shown in this editor only/u);
	assert.match(artifactText, /Reset live sample/u);
	assert.doesNotMatch(artifactText, /WebMCP read \d+ visible (?:Work|Review)/u);
	assert.doesNotMatch(artifactText, /WebMCP read the unsaved Next editor/u);
});

test('built Guide publishes exact default and discovered scope denominators', () => {
	const guideHtml = readFileSync(path.join(artifactRoot, 'webmcp-challenge.html'), 'utf8');
	assert.match(
		guideHtml,
		/data-agent-scope-chooser=""[^>]*data-workspace-count="8"[^>]*data-visible-count="8"[^>]*data-discovered-choice-count="2"[^>]*data-shown-choice-count="2"[^>]*data-omitted-choice-count="0"[^>]*data-selected-scope-id="all"[^>]*data-selected-scope-kind="all"[^>]*data-selected-work-query=""[^>]*data-selected-match-count="8"/u
	);
	assert.match(guideHtml, /8 visible of 8 workspace/u);
	assert.match(guideHtml, /data-scope-id="all"[^>]*data-scope-kind="all"[^>]*data-scope-match-count="8"[\s\S]*?All visible work · 8/u);
	assert.match(guideHtml, /data-scope-kind="derived"[^>]*data-scope-label="Household"[^>]*data-scope-query="Household"[^>]*data-scope-match-count="4"[\s\S]*?Household · 4/u);
	assert.match(guideHtml, /data-scope-kind="derived"[^>]*data-scope-label="Research"[^>]*data-scope-query="Research"[^>]*data-scope-match-count="4"[\s\S]*?Research · 4/u);
	assert.match(guideHtml, /data-scope-id="custom"[^>]*data-scope-kind="custom"[^>]*data-scope-label="Custom"[\s\S]*?Custom…/u);
	assert.match(guideHtml, /<a href="\/work"[^>]*data-agent-scope-action-link[^>]*>.*?Open all 8 work items/u);
	assert.doesNotMatch(guideHtml, /8 matching of 8 workspace · All visible work/u);
	assert.match(guideHtml, /aria-pressed="true"[\s\S]*?All visible work · 8/u);
});
