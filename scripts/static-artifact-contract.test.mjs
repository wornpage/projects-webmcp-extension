import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

function countTopLevelTests(source) {
	return source.match(/^test\(/gmu)?.length ?? 0;
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

test('README verification denominators match the current manifest and contract sources', () => {
	const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
	const manifestCount = readFileSync(path.join(root, 'PUBLIC_SOURCE_MANIFEST.txt'), 'utf8')
		.trim()
		.split(/\r?\n/u).length;
	const webMcpContractCount = readdirSync(path.join(root, 'tests'))
		.filter((name) => name.includes('webmcp') && name.endsWith('.test.mjs'))
		.reduce(
			(total, name) =>
				total + countTopLevelTests(readFileSync(path.join(root, 'tests', name), 'utf8')),
			0
		);
	const artifactContractCount = countTopLevelTests(
		readFileSync(path.join(root, 'scripts', 'static-artifact-contract.test.mjs'), 'utf8')
	);

	assert.match(
		readme,
		new RegExp(
			`Current expected denominators are ${manifestCount}/${manifestCount} public source paths, ${webMcpContractCount}/${webMcpContractCount} WebMCP contracts, and ${artifactContractCount}/${artifactContractCount} static-artifact contracts\\.`,
			'u'
		)
	);
});

test('static artifact publishes the complete challenge input and security metadata', () => {
	for (const file of [
		'landing.html',
		'THIRD_PARTY_LICENSES.txt',
		'manifest.json',
		'assets/og-image.svg',
		'assets/not-found.css',
		'data/demo-packs.json'
	]) {
		assert.ok(STATIC_PUBLISH_FILES.includes(file), `${file} is published`);
		assert.ok(existsSync(path.join(root, file)), `${file} exists`);
	}
	assert.equal(STATIC_PUBLISH_FILES.includes('index.html'), false, 'root HTML is derived from the landing source');
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
	const landing = readFileSync(path.join(root, 'landing.html'), 'utf8');
	const landingScript = readFileSync(path.join(root, 'assets', 'landing.js'), 'utf8');
	const demoCss = readFileSync(path.join(root, 'assets', 'demo.css'), 'utf8');
	const app = readFileSync(path.join(root, 'svelte-frontend', 'src', 'app.html'), 'utf8');
	const headers = readFileSync(path.join(root, 'svelte-frontend', 'static', '_headers'), 'utf8');
	const submissionReadme = readFileSync(path.join(root, 'docs', 'submission', 'webmcp', 'README.md'), 'utf8');
	const recordingScript = readFileSync(path.join(root, 'docs', 'submission', 'webmcp', 'edge-recording-script.md'), 'utf8');
	const reviewerTests = readFileSync(path.join(root, 'docs', 'submission', 'webmcp', 'reviewer-tests.md'), 'utf8');
	const browserAgentPath = reviewerTests.match(/## Browser-agent path[\s\S]*?## Security and scope checks/u)?.[0] ?? '';
	for (const html of [landing, app]) {
		assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive"/u);
	}
	assert.match(landing, /href="\/work"/u);
	assert.match(landing, /href="\/review\?tour=landing"/u);
	assert.match(landing, /<a class="lp-skip" href="#main-content">Skip to main content<\/a>/u);
	assert.match(landing, /<main id="main-content" tabindex="-1">/u);
	assert.match(landing, /Let an agent find the next move\. Keep the final say\./u);
	assert.match(landing, /No automatic starts/u);
	assert.match(landing, /Open the handoff workflow/u);
	assert.match(landing, /<span class="lp-insight-value">9<\/span>[\s\S]*?<strong>Route-owned tools<\/strong>/u);
	assert.match(landing, /<span class="lp-insight-value">4<\/span>[\s\S]*?<strong>Bounded page actions<\/strong>[\s\S]*?search, scope, Draft creation, and unsaved preparation/u);
	assert.doesNotMatch(landing, /Reversible page actions/u);
	assert.match(landing, /Press play — four steps, about ten seconds/u);
	assert.match(landingScript, /function advance\(wrap\)[\s\S]*?if \(index >= steps\.length - 1\)[\s\S]*?if \(wrap === false\) \{ pause\(\); return; \}[\s\S]*?selectStep\(0\)[\s\S]*?selectStep\(index \+ 1\)/u);
	assert.match(landingScript, /advance\(true\);[\s\S]*?setInterval\(function \(\) \{ advance\(false\); \}, STEP_MS\)/u);
	assert.match(landingScript, /if \(reduced\)[\s\S]*?advance\(true\); \/\/ wraps: 1 → 2 → 3 → 4 → 1/u);
	assert.doesNotMatch(landingScript, /selectStep\(\(index \+ 1\) % steps\.length\)/u);
	assert.match(landing, /Public static sample, no login, no backend, and five focused workflow pages/u);
	assert.match(landing, /WebMCP can add at most three browser-local Draft items at once; only visible human controls can Start work or approve a final Save/u);
	assert.doesNotMatch(landing, /judge|contest|garage reset|recording/iu);
	assert.doesNotMatch(`${landing}\n${app}`, /projectsdemo\.org|\/agents|\/billing/u);
	assert.match(app, /<div class="sveltekit-body">%sveltekit\.body%<\/div>/u);
	assert.doesNotMatch(app, /\sstyle=/u);
	assert.match(demoCss, /\.sveltekit-body\s*\{\s*display: contents;\s*\}/u);
	assert.equal(headers.match(/Content-Security-Policy:/gu)?.length, 1);
	assert.match(headers, /\/\*[\s\S]*?Content-Security-Policy: default-src 'self';[\s\S]*?script-src 'self' __PROJECTS_SVELTE_SCRIPT_HASHES__; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline';[\s\S]*?connect-src 'self'/u);
	assert.match(submissionReadme, /\[edge-recording-script\.md\]\(edge-recording-script\.md\)/u);
	assert.match(recordingScript, /Target final length: \*\*2:10\*\*\. Hard stop: \*\*2:20\*\*[\s\S]*?one continuous Microsoft Edge clip[\s\S]*?Do not speed up footage/u);
	assert.match(recordingScript, /Keep the laptop's native Edge viewport; do not apply a viewport override[\s\S]*?require zero horizontal overflow before T0/u);
	assert.match(recordingScript, /Park the pointer in the bottom-right corner before T0 and leave it there for the entire clip/u);
	assert.match(recordingScript, /Every timed route change—including Guide → Work → Review → Next → Work—uses real Tab or Shift\+Tab focus movement[\s\S]*?followed by Enter[\s\S]*?Do not click route links, use full-document `goto`, address-bar navigation, browser Back, pointer activation, retry a transition/u);
	assert.match(recordingScript, /Vertical reveals use keyboard PageDown only[\s\S]*?pointer stays parked[\s\S]*?do not use the wheel, drag a scrollbar[\s\S]*?WebMCP focus owner already presents the receipt and focused evidence together/u);
	assert.match(recordingScript, /Visible focus is required when each WebMCP receipt first appears[\s\S]*?PageDown may then transfer focus to the page[\s\S]*?receipt and controls remaining simultaneously visible[\s\S]*?not on claiming the receipt retained focus after the scroll/u);
	assert.match(recordingScript, /fixed \*\*2\.25-second settle window\*\*/u);
	assert.match(recordingScript, /Landing → Guide: six Tab presses[\s\S]*?Returned Guide → fast brief: five Shift\+Tab presses[\s\S]*?press Tab once on the page body to reclaim page focus[\s\S]*?advance visibly with Tab until \*\*1 Work\*\* receives focus[\s\S]*?within five moves[\s\S]*?fail if focus reaches a later route first[\s\S]*?Work receipt → Review: seven Shift\+Tab presses[\s\S]*?Review receipt → Next: one Shift\+Tab press[\s\S]*?Prepared Next receipt → Work: four Shift\+Tab presses[\s\S]*?Work Draft receipt → pending decision: nine Shift\+Tab presses[\s\S]*?upper view must first show the counted scope[\s\S]*?one PageDown must then reveal the complete brief and fast-brief control[\s\S]*?Next: two PageDown presses[\s\S]*?Reader API detected/u);
	assert.match(recordingScript, /browser-agent side panel[\s\S]*?Side-panel instruction: `Follow the brief on this page\.`[\s\S]*?side-panel agent owns every WebMCP call/u);
	assert.doesNotMatch(recordingScript, /AGENT_SHORTCUT|replace this|placeholder/iu);
	assert.match(recordingScript, /do not load it before navigating away because this page-local state does not survive Guide → Priority → Guide/u);
	assert.match(recordingScript, /## One continuous Edge clip — 00:00–02:10[\s\S]*?00:00–00:07[\s\S]*?00:34–00:54[\s\S]*?01:12–01:36[\s\S]*?01:44–01:54[\s\S]*?01:54–02:10/u);
	assert.match(recordingScript, /show_work_search[\s\S]*?set_review_scope[\s\S]*?prepare_next_action[\s\S]*?get_current_work_view[\s\S]*?one `create_work_drafts` call/u);
	assert.match(recordingScript, /Confirm donation pickup window[\s\S]*?Print shelf labels[\s\S]*?Prepare bike rack checklist[\s\S]*?`3 · Draft`[\s\S]*?`8 → 11`[\s\S]*?Human Start required/u);
	assert.match(recordingScript, /Review the proposed next action[\s\S]*?Draft: pending approval[\s\S]*?Workspace: unchanged[\s\S]*?only you can approve Save[\s\S]*?Discard draft[\s\S]*?Approve and save[\s\S]*?Stop the recorder at 02:10 on the human approval frame/u);
	assert.match(recordingScript, /press PageDown once at 00:13[\s\S]*?press PageDown twice at 01:24[\s\S]*?press PageDown twice at 02:02[\s\S]*?Final viewport simultaneously shows the preserved WebMCP receipt/u);
	assert.match(recordingScript, /## Post-capture cleanup and edit[\s\S]*?same Edge profile[\s\S]*?pending Next proposal and all three recording Drafts are absent[\s\S]*?Trim only the four-second setup pad[\s\S]*?Do not add a route cut/u);
	assert.match(recordingScript, /Abort the take immediately[\s\S]*?Focus is not visible[\s\S]*?CSP violation[\s\S]*?horizontal overflow/u);
	assert.doesNotMatch(recordingScript, /in-app browser|hybrid|hard cut at 02:05/iu);
	assert.match(browserAgentPath, /Use fast-create brief[\s\S]*?453-character brief[\s\S]*?forbid Save\/Start\/block\/completion\/deletion[\s\S]*?Reset[\s\S]*?original no-workspace-change brief/u);
	assert.match(browserAgentPath, /Discover exactly `get_current_work_view`, `show_work_search`, and `create_work_drafts`\./u);
	assert.match(browserAgentPath, /create_work_drafts[\s\S]*?one atomic `8 → 11` receipt[\s\S]*?three visible human \*\*Start\*\* controls[\s\S]*?stale count `8`[\s\S]*?duplicate-title rejection[\s\S]*?Reset live sample[\s\S]*?exact original 8-item workspace/u);
	assert.doesNotMatch(browserAgentPath, /Discover `get_current_work_view` and `show_work_search` only/u);
	assert.match(headers, /X-Content-Type-Options: nosniff/u);
	assert.match(headers, /X-Robots-Tag: noindex, nofollow, noarchive/u);
});

test('built artifact exposes exactly the intended HTML routes and no executable edge path', () => {
	const expectedHtml = [
		'404.html',
		'index.html',
		'landing.html',
		'next.html',
		'priority.html',
		'review.html',
		'webmcp-challenge.html',
		'work.html'
	];
	const actualHtml = readdirSync(artifactRoot)
		.filter((name) => name.endsWith('.html'))
		.sort((left, right) => left.localeCompare(right));
	assert.deepEqual(actualHtml, expectedHtml);
	assert.equal(
		readFileSync(path.join(artifactRoot, 'index.html'), 'utf8'),
		readFileSync(path.join(artifactRoot, 'landing.html'), 'utf8'),
		'canonical root and landing alias share one HTML source'
	);
	assert.equal(existsSync(path.join(artifactRoot, '_worker.js')), false);
	assert.equal(existsSync(path.join(artifactRoot, 'functions')), false);
	assert.equal(collectFiles(artifactRoot).some((file) => file.endsWith('.map')), false);
	assert.ok(existsSync(path.join(artifactRoot, 'THIRD_PARTY_LICENSES.txt')));
	const builtHeaders = readFileSync(path.join(artifactRoot, '_headers'), 'utf8');
	assert.doesNotMatch(builtHeaders, /__PROJECTS_SVELTE_SCRIPT_HASHES__|script-src[^;]*'unsafe-inline'/u);
	const inlineScriptHashes = new Set();
	for (const name of actualHtml) {
		const html = readFileSync(path.join(artifactRoot, name), 'utf8');
		for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
			if (/\bsrc\s*=/u.test(match[1]) || !match[2].trim()) continue;
			inlineScriptHashes.add(`'sha256-${createHash('sha256').update(match[2], 'utf8').digest('base64')}'`);
		}
	}
	assert.ok(inlineScriptHashes.size > 0, 'built Svelte routes contain bootstrap scripts to hash');
	for (const hash of inlineScriptHashes) assert.ok(builtHeaders.includes(hash), `built CSP includes ${hash}`);
	const notFoundHtml = readFileSync(path.join(artifactRoot, '404.html'), 'utf8');
	assert.match(notFoundHtml, /<meta name="robots" content="noindex,nofollow,noarchive"/u);
	assert.match(notFoundHtml, /<link rel="stylesheet" href="\/assets\/not-found\.css">/u);
	assert.doesNotMatch(notFoundHtml, /<style|\sstyle=/u);
	const artifactText = collectText(artifactRoot).join('\n');
	for (const route of ['webmcp-challenge.html', 'priority.html', 'work.html', 'review.html', 'next.html']) {
		const html = readFileSync(path.join(artifactRoot, route), 'utf8');
		const brand = html.match(/<a\b[^>]*\bclass="[^"]*\bchallenge-brand\b[^"]*"[^>]*>[\s\S]*?<\/a>/u)?.[0];
		assert.ok(brand, `${route} contains the interactive challenge-brand anchor`);
		assert.equal(getAttribute(brand, 'href'), '/landing.html', `${route} preserves the static landing route`);
		assert.equal(
			getAttribute(brand, 'aria-label'),
			'Wornpage Projects landing page',
			`${route} preserves the brand accessible name`
		);
		assert.match(brand, /<span[^>]*>Wornpage Projects<\/span>/u, `${route} preserves the visible brand name`);
	}
	const priorityHtml = readFileSync(path.join(artifactRoot, 'priority.html'), 'utf8');
	assert.match(priorityHtml, /Priority/u);
	assert.match(priorityHtml, /No actionable recommendation/u);
	assert.match(priorityHtml, /No loaded, non-archived work item is active, unblocked, dependency-ready, and free of a pending decision\./u);
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
	assert.match(guideHtml, /data-agent-brief-fast-create[^>]*>.*?Use fast-create brief/u);
	assert.match(guideHtml, /Local draft · not saved · workspace unchanged/u);
	assert.match(guideHtml, /Authority and browser status/u);
	assert.match(guideHtml, /create up to three Draft items through the bounded Work tool/u);
	assert.match(guideHtml, /control Start, final Save, blocking, completion, and deletion/u);
	assert.doesNotMatch(guideHtml, /approve, save, or discard every workspace change/u);
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
		'Work search cleared to show all work.',
		'Current scope',
		'Visible search updated · Not saved',
		'Visible Review scope',
		'Current queue',
		'Search-match evidence',
		'Visible queue updated · Not saved',
		'Browser agent prepared an unsaved draft. No workspace data was saved.',
		'Verified evidence',
		'rejects stale or mismatched facts',
		'Draft — waiting for your approval',
		'Not saved'
	]) {
		assert.match(artifactText, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
	}
	assert.doesNotMatch(artifactText, /Unsaved draft shown in this editor only/u);
	assert.match(artifactText, /Reset live sample/u);
	assert.doesNotMatch(artifactText, /WebMCP read \d+ visible (?:Work|Review)/u);
	assert.doesNotMatch(artifactText, /WebMCP read the unsaved Next editor/u);
	assert.doesNotMatch(artifactText, /agentNote/u);
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
