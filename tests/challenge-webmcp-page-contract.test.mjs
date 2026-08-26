import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	WEBMCP_CHALLENGE_GUIDE_TOOL_NAME,
	createWebMcpChallengeGuideTool,
	webMcpChallengeGuideView
} from '../svelte-frontend/src/routes/webmcp-challenge/webmcp-challenge-webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/webmcp-challenge/+page.svelte'), 'utf8');
const pageConfig = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/+layout.ts'), 'utf8');
const svelteConfig = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/svelte.config.js'), 'utf8');

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

test('challenge route is prerendered and owns one public reader without navigation or write authority', () => {
	assert.match(pageConfig, /prerender\s*=\s*true/u);
	for (const route of ['/webmcp-challenge', '/work', '/review', '/next']) {
		assert.match(svelteConfig, new RegExp(`prerender:[\\s\\S]*?${route.replaceAll('/', '\\/')}`, 'u'));
	}
	assert.match(pageSource, /registerPageTools\(document/u);
	assert.match(pageSource, /createWebMcpChallengeGuideTool\(readChallengeGuide\)/u);
	assert.match(pageSource, /Public static edition · sample data · no login/u);
	assert.match(pageSource, /Consequential workspace changes remain human-owned/u);
	assert.match(pageSource, /Codex and ChatGPT in-app browsers/u);
	assert.match(pageSource, /navigator\.clipboard\.writeText\(recommendedPrompt\)/u);
	assert.match(pageSource, /WornButton type="button" size="sm" onclick=\{copyRecommendedPrompt\}>Copy prompt<\/WornButton>/u);
	assert.match(pageSource, /data-challenge-copy-status aria-live="polite"/u);
	assert.match(pageSource, /<section class="challenge-prompt" aria-labelledby="challenge-prompt-title">[\s\S]*?<h2 id="challenge-prompt-title">Try this prompt<\/h2>[\s\S]*?<\/section>/u);
	assert.match(pageSource, /\.challenge-kicker \{\s*color: var\(--worn-text-secondary\);/u);
	assert.doesNotMatch(pageSource, /\.challenge-kicker \{[^}]*color: var\(--worn-accent\);/u);
	assert.doesNotMatch(pageSource, /fetch\(|apiFetch|localStorage|sessionStorage|\.click\(/u);
});
