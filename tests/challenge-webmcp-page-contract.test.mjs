import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	WEBMCP_CHALLENGE_GUIDE_TOOL_NAME,
	createWebMcpChallengeGuideTool,
	readRenderedWebMcpChallengeGuide,
	webMcpChallengeGuideView
} from '../svelte-frontend/src/routes/webmcp-challenge/webmcp-challenge-webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/webmcp-challenge/+page.svelte'), 'utf8');
const pageConfig = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/+layout.ts'), 'utf8');
const svelteConfig = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/svelte.config.js'), 'utf8');
const appDocument = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/app.html'), 'utf8');
const webManifest = fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8');
const rootReadme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const reviewerTests = fs.readFileSync(path.join(repoRoot, 'docs/submission/webmcp/reviewer-tests.md'), 'utf8');

function guideFixture() {
	return {
		title: 'WebMCP Challenge guide',
		purpose: 'People and browser agents share the same page.',
		prompt: 'Find what needs attention without changing workspace data.',
		steps: [
			{ position: 1, title: 'Understand work', description: 'Read the current view.', href: '/work' },
			{ position: 2, title: 'Inspect review', description: 'Read the queue.', href: '/review' },
			{ position: 3, title: 'Prepare next', description: 'Prepare a draft.', href: '/next' }
		],
		safety: ['Sample data stays local.', 'Page state is bounded.', 'Humans retain decisions.']
	};
}

test('WebMCP challenge guide projects one exact public three-step judge path', () => {
	assert.deepEqual(webMcpChallengeGuideView(guideFixture()), guideFixture());
	assert.equal(webMcpChallengeGuideView({ ...guideFixture(), steps: guideFixture().steps.slice(0, 2) }), null);
	assert.equal(webMcpChallengeGuideView({
		...guideFixture(),
		steps: guideFixture().steps.map((step, index) => index === 2 ? { ...step, href: '/billing' } : step)
	}), null);
	assert.equal(webMcpChallengeGuideView({ ...guideFixture(), safety: ['Only one'] }), null);
});

test('challenge guide descriptor is closed, read-only, live, and abort-aware', async () => {
	let guide = guideFixture();
	const tool = createWebMcpChallengeGuideTool(() => guide);
	assert.equal(tool.name, WEBMCP_CHALLENGE_GUIDE_TOOL_NAME);
	assert.deepEqual(tool.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
	assert.deepEqual(tool.annotations, {
		readOnlyHint: true,
		openWorldHint: false,
		untrustedContentHint: false
	});
	assert.deepEqual(await tool.execute({}), guide);
	guide = { ...guide, prompt: 'Updated visible prompt.' };
	assert.equal((await tool.execute({})).prompt, 'Updated visible prompt.');
	await assert.rejects(tool.execute({ extra: true }), /empty object/u);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.execute({}, { signal: controller.signal }), /abort/iu);
});

test('guide reader projects the rendered guide exactly and ordinary links remain the fallback', async () => {
	const fixture = guideFixture();
	const stepElements = fixture.steps.map((step) => ({
		querySelector(selector) {
			if (selector === 'h2') return { textContent: step.title };
			if (selector === 'p') return { textContent: step.description };
			if (selector === 'a') return { getAttribute: (attribute) => attribute === 'href' ? step.href : null };
			return null;
		}
	}));
	const guide = readRenderedWebMcpChallengeGuide({
		querySelector(selector) {
			return selector === '[data-webmcp-challenge-guide]'
				? { dataset: { webmcpChallengeTitle: fixture.title, webmcpChallengePurpose: fixture.purpose, webmcpChallengePrompt: fixture.prompt } }
				: null;
		},
		querySelectorAll(selector) {
			if (selector === '[data-webmcp-challenge-step]') return stepElements;
			if (selector === '[data-webmcp-challenge-safety] li') return fixture.safety.map((textContent) => ({ textContent }));
			return [];
		}
	});
	assert.deepEqual(guide, fixture);
	assert.deepEqual(await createWebMcpChallengeGuideTool(() => guide).execute({}), fixture);
	assert.match(pageSource, /<WornButton href=\{step\.href\} size="sm">\{step\.action\}<\/WornButton>/u);
	assert.match(pageSource, /If WebMCP is unavailable, the ordinary page and browser-local sample remain usable/u);
});

test('challenge route is prerendered and owns one public reader without navigation or write authority', () => {
	assert.match(pageConfig, /prerender\s*=\s*true/u);
	for (const route of ['/webmcp-challenge', '/work', '/review', '/next']) {
		assert.match(svelteConfig, new RegExp(`prerender:[\\s\\S]*?${route.replaceAll('/', '\\/')}`, 'u'));
	}
	assert.match(pageSource, /registerPageTools\(document/u);
	assert.match(pageSource, /createWebMcpChallengeGuideTool\(\(\) => readRenderedWebMcpChallengeGuide\(document\)\)/u);
	assert.match(pageSource, /WebMCP project workspace · live sample · no login/u);
	assert.match(pageSource, /Person: approve, save, or discard every workspace change/u);
	assert.match(pageSource, /prepare “Confirm storage bin delivery” with a brief evidence-based note/u);
	assert.match(pageSource, /ChatGPT or Codex in-app browser for the demonstrated WebMCP path/u);
	assert.match(pageSource, /ordinary page and browser-local sample remain usable/u);
	assert.doesNotMatch(pageSource, /Chrome/u);
	assert.match(appDocument, /tools read, narrow, and prepare while you control Save/u);
	assert.match(appDocument, /prepare an unsaved next action[\s\S]*?the person controls Save/u);
	assert.match(appDocument, /<meta property="og:url" content="https:\/\/projects-webmcp-extension\.pages\.dev\/webmcp-challenge" \/>/u);
	assert.match(webManifest, /human-controlled Work, Review, and Next loop/u);
	assert.match(rootReadme, /^Live submission: <https:\/\/projects-webmcp-extension\.pages\.dev\/webmcp-challenge>$/mu);
	assert.match(rootReadme, /submission URL is publicly accessible without an account[\s\S]*?preview URLs remain separate/u);
	assert.match(rootReadme, /document\.modelContext\.registerTool\(\{[\s\S]*?name: 'get_webmcp_challenge_guide'[\s\S]*?description:[\s\S]*?inputSchema:[\s\S]*?execute:/u);
	assert.doesNotMatch(rootReadme, /^Judge URL:/mu);
	assert.match(reviewerTests, /ChatGPT or Codex in-app browser, the demonstrated WebMCP client path/u);
	assert.match(reviewerTests, /Public judge URL \(no account required\)/u);
	assert.doesNotMatch(reviewerTests, /Chrome with WebMCP testing enabled|\| Hosted status \|/u);
	assert.match(pageSource, /navigator\.clipboard\.writeText\(recommendedPrompt\)/u);
	assert.match(pageSource, /WornButton type="button" size="sm" onclick=\{copyRecommendedPrompt\}>Copy prompt<\/WornButton>/u);
	assert.match(pageSource, /data-challenge-copy-status aria-live="polite"/u);
	assert.match(pageSource, /<section class="challenge-prompt" aria-labelledby="challenge-prompt-title">[\s\S]*?<h2 id="challenge-prompt-title">Run the judged path<\/h2>[\s\S]*?<\/section>/u);
	assert.match(pageSource, /<dl class="challenge-facts" aria-label="What the demo allows">[\s\S]*?<dt>Page tools<\/dt><dd>7<\/dd>[\s\S]*?<dt>Actions you can undo<\/dt><dd>3<\/dd>[\s\S]*?<dt>Automatic saves<\/dt><dd>0<\/dd>[\s\S]*?<\/dl>/u);
	assert.match(pageSource, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
	assert.match(pageSource, /\.challenge-kicker \{\s*color: var\(--worn-text-secondary\);/u);
	assert.doesNotMatch(pageSource, /\.challenge-kicker \{[^}]*color: var\(--worn-accent\);/u);
	assert.doesNotMatch(pageSource, /fetch\(|apiFetch|localStorage|sessionStorage|\.click\(/u);
});
