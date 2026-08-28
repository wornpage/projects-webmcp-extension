import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', '+layout.svelte'), 'utf8');
const guideRouteSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', 'webmcp-challenge', '+page.svelte'), 'utf8');
const workRouteSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', 'work', '+page.svelte'), 'utf8');
const reviewRouteSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', 'review', '+page.svelte'), 'utf8');
const nextRouteSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', 'next', '+page.svelte'), 'utf8');
const registrationSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'lib', 'webmcp.mjs'), 'utf8');

test('shared challenge brand keeps a padded, keyboard-visible landing affordance', () => {
	assert.match(
		layoutSource,
		/<a\s+class="challenge-brand"[\s\S]*?href="\/landing\.html"[\s\S]*?aria-label="Wornpage Projects landing page"/u
	);
	assert.match(
		layoutSource,
		/\.challenge-brand \{[\s\S]*?min-height: 44px;[\s\S]*?padding: 0 12px;[\s\S]*?text-decoration: none;/u
	);
	assert.match(layoutSource, /\.challenge-brand:focus-visible,[\s\S]*?outline: 2px dashed var\(--worn-focus\);/u);
	assert.match(layoutSource, /\.challenge-brand:hover,[\s\S]*?background: var\(--worn-hover-bg\);/u);
	assert.match(layoutSource, /\.challenge-brand span \{[\s\S]*?text-overflow: ellipsis;/u);
});

test('shared challenge layout keeps content compact and receipts comfortably separated', () => {
	assert.match(layoutSource, /\.challenge-shell \{[\s\S]*?align-content: start;/u);
	assert.match(
		layoutSource,
		/\.challenge-route :global\(\.worn-receipt\) \{[\s\S]*?margin-block: 14px 16px;[\s\S]*?padding: 16px 18px;/u
	);
	assert.match(layoutSource, /@media \(max-width: 700px\) \{[\s\S]*?padding: 14px;/u);
	assert.match(nextRouteSource, /data-webmcp-receipt="next"[\s\S]*?<WornReceipt[\s\S]*?id=\{NEXT_PREPARATION_RECEIPT_ID\}/u);
});

test('challenge motion is visible by default and removed for reduced motion', () => {
	assert.match(layoutSource, /animation: challenge-route-arrive 380ms/u);
	assert.match(layoutSource, /animation: challenge-receipt-arrive 440ms/u);
	assert.match(
		layoutSource,
		/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?data-webmcp-receipt[\s\S]*?animation: none;/u
	);
});

test('every successful route tool invocation produces a truthful accessible receipt', () => {
	assert.match(registrationSource, /async execute\(input, invocationOptions\)[\s\S]*?await onResult\(\{ toolName: name, toolTitle, result \}\)/u);
	assert.match(registrationSource, /if \(!registrationController\.signal\.aborted\)/u);

	for (const [route, source] of [
		['guide', guideRouteSource],
		['work', workRouteSource],
		['review', reviewRouteSource],
		['next', nextRouteSource]
	]) {
		assert.match(source, /registerPageTools\(document,[\s\S]*?onResult:/u, `${route} must own its invocation receipt callback`);
		assert.match(source, /registerPageTools\(document,[\s\S]*?onInvocationError:/u, `${route} must clear receipts after a failed invocation`);
		assert.match(source, /label: 'Tool'/u, `${route} must identify the invoked tool`);
		assert.match(source, /label: 'Invocation'/u, `${route} must distinguish repeated invocations`);
		assert.match(source, /label: 'Page-local presentation'/u, `${route} must report page-local effects`);
		assert.match(source, /label: 'Saved workspace changes', value: 'None'/u, `${route} must preserve the Save boundary`);
		assert.match(source, /data-webmcp-receipt=/u, `${route} must render the receipt in the page`);
	}

	assert.match(guideRouteSource, /label: 'What it read'/u);
	assert.match(workRouteSource, /toolName === WORK_CURRENT_TOOL_NAME \? 'What it read' : 'What it prepared'/u);
	assert.match(reviewRouteSource, /toolName === REVIEW_CURRENT_TOOL_NAME \? 'What it read' : 'What it prepared'/u);
	assert.match(nextRouteSource, /label: 'What it read'/u);
	assert.match(nextRouteSource, /label: 'What it prepared'/u);
	assert.match(nextRouteSource, /label: 'Authority', value: 'Awaiting your Save'/u);

	for (const source of [guideRouteSource, workRouteSource, reviewRouteSource, nextRouteSource]) {
		const webMcpReceiptBlocks = source.match(/data-webmcp-receipt=[\s\S]*?<WornReceipt[\s\S]*?\/>/gu) ?? [];
		assert.ok(webMcpReceiptBlocks.length > 0);
		assert.ok(webMcpReceiptBlocks.every((block) => !block.includes('announce={false}')), 'WebMCP receipts must retain the polite live region');
	}
});

test('action presenters publish only after success and preserve valid pre-invocation state on failure', () => {
	assert.match(registrationSource, /catch \(error\) \{[\s\S]*?await onInvocationError\(\{ toolName: name, toolTitle, error \}\);[\s\S]*?throw error;/u);

	const workPresenter = workRouteSource.match(/async function showWorkSearchFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(workPresenter, /webMcpSearchReceipt\s*=/u);
	assert.match(workRouteSource, /async function clearFailedWorkWebMcpReceipt\(\) \{\s*webMcpSearchReceipt = null;\s*await tick\(\);\s*\}/u);

	const reviewPresenter = reviewRouteSource.match(/async function setReviewScopeFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(reviewPresenter, /webMcpScopeReceipt\s*=/u);
	assert.match(reviewRouteSource, /async function clearFailedReviewWebMcpReceipt\(\) \{\s*webMcpScopeReceipt = null;\s*await tick\(\);\s*\}/u);

	assert.match(nextRouteSource, /async function clearFailedNextWebMcpReceipt\(\) \{\s*webMcpReadReceipt = null;\s*await tick\(\);\s*\}/u);
	assert.match(guideRouteSource, /onInvocationError: async \(\) => \{\s*webMcpGuideReceipt = null;\s*await tick\(\);\s*\}/u);
});
