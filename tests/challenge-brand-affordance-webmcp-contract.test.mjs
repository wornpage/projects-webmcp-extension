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
const activityStripSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'lib', 'WebMcpActivityStrip.svelte'), 'utf8');
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
	assert.match(layoutSource, /\.challenge-brand:focus-visible,[\s\S]*?outline: 2px solid var\(--challenge-focus-mint\);/u);
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
	assert.match(activityStripSource, /\.webmcp-activity-strip \{[\s\S]*?padding: 12px 14px;/u);
	assert.match(activityStripSource, /\.webmcp-activity-inset \{[\s\S]*?padding: 12px;[\s\S]*?width: 100%;/u);
	assert.match(activityStripSource, /@media \(max-width: 500px\) \{[\s\S]*?\.webmcp-activity-inset \{[\s\S]*?padding: 8px;/u);
	assert.match(activityStripSource, /@media \(max-width: 500px\) \{[\s\S]*?padding: 11px 12px;/u);
	assert.match(workRouteSource, /\{#if webMcpSearchReceipt\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?route="work"[\s\S]*?\{#each densityPanelTabs/u);
	assert.match(reviewRouteSource, /\{#if \$demoStateError\}[\s\S]*?\{#if webMcpScopeReceipt\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?route="review"[\s\S]*?\{#if firstReview\}/u);
	assert.match(nextRouteSource, /\{#if preparationReceipt\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?id=\{NEXT_PREPARATION_RECEIPT_ID\}[\s\S]*?route="next"[\s\S]*?<div class="next-presenter-result">[\s\S]*?data-next-preview/u);
});

test('the single activity strip stays in regular flow without restoring route-local receipts', () => {
	assert.match(
		activityStripSource,
		/\.webmcp-activity-strip \{[\s\S]*?background: color-mix\([\s\S]*?box-sizing: border-box;[\s\S]*?max-inline-size: 100%;[\s\S]*?position: static;[\s\S]*?width: 100%;/u
	);
	assert.doesNotMatch(activityStripSource, /position: sticky|position: fixed|z-index:/u);
	assert.match(activityStripSource, /grid-template-columns: repeat\(auto-fit, minmax\(min\(190px, 100%\), 1fr\)\);/u);
	assert.match(activityStripSource, /@media \(max-width: 500px\) \{[\s\S]*?padding: 11px 12px;[\s\S]*?flex-direction: column;/u);

	for (const [route, source] of [
		['work', workRouteSource],
		['review', reviewRouteSource],
		['next', nextRouteSource]
	]) {
		assert.equal((source.match(/<WebMcpActivityStrip/gu) ?? []).length, 1, `${route} must render one shared activity strip`);
		assert.doesNotMatch(source, new RegExp(`data-webmcp-receipt=["']${route}["']`, 'u'));
	}
	assert.doesNotMatch(workRouteSource, /work-presenter-result|webmcp-tool-label/u);
	assert.doesNotMatch(reviewRouteSource, /review-presenter-result|webmcp-tool-label/u);
	assert.doesNotMatch(nextRouteSource, /webmcp-tool-label/u);
});

test('challenge motion is visible by default and removed for reduced motion', () => {
	assert.match(layoutSource, /animation: challenge-route-arrive 380ms/u);
	assert.match(layoutSource, /animation: challenge-receipt-arrive 440ms/u);
	assert.match(
		layoutSource,
		/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?data-webmcp-receipt[\s\S]*?animation: none;/u
	);
});

test('presentation-changing tools produce truthful accessible receipts without making getters side-effectful', () => {
	assert.match(registrationSource, /async execute\(input, invocationOptions\)[\s\S]*?await onResult\(\{ toolName: name, toolTitle, result \}\)/u);
	assert.match(registrationSource, /if \(!registrationController\.signal\.aborted\)/u);

	assert.match(guideRouteSource, /registerPageTools\(document,[\s\S]*?onResult:/u);
	assert.match(workRouteSource, /if \(toolName !== WORK_SEARCH_TOOL_NAME\) return;[\s\S]*?workSearchPresentationReceipt/u);
	assert.match(reviewRouteSource, /if \(toolName !== REVIEW_SCOPE_TOOL_NAME\) return;[\s\S]*?reviewScopePresentationReceipt/u);
	assert.doesNotMatch(nextRouteSource, /webMcpReadReceipt|data-webmcp-receipt="next-read"/u);
	assert.match(nextRouteSource, /label: 'Verified evidence'[\s\S]*?label: 'Status', value: 'Draft — waiting for your approval'[\s\S]*?label: 'Save', value: 'Not saved'/u);
	assert.doesNotMatch(nextRouteSource.match(/let preparationCells[\s\S]*?\] : \[\]\);/u)?.[0] ?? '', /Work item|Prepared action|Browser agent changed/u);
	assert.doesNotMatch(nextRouteSource.match(/let preparationCells[\s\S]*?\] : \[\]\);/u)?.[0] ?? '', /Workspace data|Authority|Only you can Save/u);
	for (const [route, source] of [['work', workRouteSource], ['review', reviewRouteSource], ['next', nextRouteSource]]) {
		assert.match(source, /import WebMcpActivityStrip from '\$lib\/WebMcpActivityStrip\.svelte';/u, `${route} must render the shared activity strip`);
	}
	assert.match(activityStripSource, /data-webmcp-receipt=\{route\}[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/u);
	assert.match(activityStripSource, /Agent activity[\s\S]*?WebMCP · \{toolName\}[\s\S]*?webmcp-activity-outcome[\s\S]*?webmcp-activity-evidence/u);
	assert.doesNotMatch(activityStripSource, /WornReceipt|ondone|JSON\.stringify|localStorage|sessionStorage|fetch\(/u);
});

test('action presenters publish only after success and preserve valid pre-invocation state on failure', () => {
	assert.match(registrationSource, /catch \(error\) \{[\s\S]*?await onInvocationError\(\{ toolName: name, toolTitle, error \}\);[\s\S]*?throw error;/u);

	const workPresenter = workRouteSource.match(/async function showWorkSearchFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(workPresenter, /webMcpSearchReceipt\s*=/u);
	assert.match(workRouteSource, /async function clearFailedWorkWebMcpReceipt\(\) \{\s*webMcpSearchReceipt = null;\s*await tick\(\);\s*\}/u);

	const reviewPresenter = reviewRouteSource.match(/async function setReviewScopeFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(reviewPresenter, /webMcpScopeReceipt\s*=/u);
	assert.match(reviewRouteSource, /async function clearFailedReviewWebMcpReceipt\(\) \{\s*webMcpScopeReceipt = null;\s*await tick\(\);\s*\}/u);

	assert.doesNotMatch(nextRouteSource, /onInvocationError:|webMcpReadReceipt/u);
	assert.match(nextRouteSource, /onResult: \(\{ toolName \}\)[\s\S]*?toolName === PREPARE_NEXT_ACTION_TOOL_NAME/u);
	assert.match(nextRouteSource, /createPrepareNextActionTool\(prepareNextActionFromWebMcp, \{[\s\S]*?capture: captureNextPreparationSnapshot,[\s\S]*?restore: restoreNextPreparationSnapshot/u);
	assert.match(guideRouteSource, /onInvocationError: async \(\) => \{\s*webMcpGuideReceipt = null;\s*await tick\(\);\s*\}/u);
});
