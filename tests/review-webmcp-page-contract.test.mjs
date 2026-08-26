import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	REVIEW_CURRENT_TOOL_NAME,
	REVIEW_SCOPE_TOOL_NAME,
	createCurrentReviewTool,
	createSetReviewScopeTool,
	reviewItemPageView,
	reviewPageView
} from '../svelte-frontend/src/routes/review/review-webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/review/+page.svelte'), 'utf8');
const helperSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/review/review-webmcp.mjs'), 'utf8');
const registrationSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/webmcp.mjs'), 'utf8');

function queueView() {
	return reviewPageView({
		scope: { query: 'garage', filter: 'blocked' },
		availableFilters: ['all', 'blocked', 'missing-next'],
		counts: {
			totalReview: 12,
			searchMatches: 5,
			filtered: 3,
			shown: 2,
			remaining: 1,
			blocked: 3,
			missingNext: 1,
			missingOwner: 0
		},
		upNext: {
			id: 'garage / one',
			title: 'Garage one',
			workflow: 'Blocked',
			owner: 'Avery',
			due: 'Due today',
			blocker: 'Waiting for access',
			attentionReasons: ['Blocked: Waiting for access.', 'Due date is overdue.'],
			memory: ['not exposed'],
			purpose: 'not exposed'
		},
		items: [{
			id: 'garage-two',
			title: 'Garage two',
			workflow: 'Needs action',
			owner: 'Unassigned',
			due: null,
			blocker: null,
			attentionReasons: ['No owner is assigned.'],
			next: 'not exposed'
		}]
	});
}

test('Review projects only its explicit rendered queue and denominators', () => {
	assert.deepEqual(reviewItemPageView({
		id: 'garage / one',
		title: 'Garage one',
		workflow: 'Blocked',
		owner: 'Avery',
		due: 'Due today',
		blocker: 'Waiting for access',
		attentionReasons: ['Blocked: Waiting for access.'],
		memory: ['not exposed']
	}), {
		id: 'garage / one',
		title: 'Garage one',
		href: '/next?pack=garage%20%2F%20one',
		workflow: 'Blocked',
		owner: 'Avery',
		due: 'Due today',
		blocker: 'Waiting for access',
		attentionReasons: ['Blocked: Waiting for access.']
	});

	const view = queueView();
	assert.deepEqual(view, {
		scope: { query: 'garage', filter: 'blocked' },
		availableFilters: ['all', 'blocked', 'missing-next'],
		counts: {
			totalReview: 12,
			searchMatches: 5,
			filtered: 3,
			shown: 2,
			remaining: 1,
			blocked: 3,
			missingNext: 1,
			missingOwner: 0
		},
		upNext: {
			id: 'garage / one',
			title: 'Garage one',
			href: '/next?pack=garage%20%2F%20one',
			workflow: 'Blocked',
			owner: 'Avery',
			due: 'Due today',
			blocker: 'Waiting for access',
			attentionReasons: ['Blocked: Waiting for access.', 'Due date is overdue.']
		},
		items: [{
			id: 'garage-two',
			title: 'Garage two',
			href: '/next?pack=garage-two',
			workflow: 'Needs action',
			owner: 'Unassigned',
			due: null,
			blocker: null,
			attentionReasons: ['No owner is assigned.']
		}]
	});
	assert.doesNotMatch(JSON.stringify(view), /not exposed/u);

	for (const malformed of [
		null,
		{},
		{ ...view, availableFilters: ['all'] },
		{ ...view, counts: { ...view.counts, shown: 3 } },
		{ ...view, counts: { ...view.counts, remaining: 2 } },
		{ ...view, counts: { ...view.counts, searchMatches: 2 } },
		{ ...view, items: [view.upNext] },
		{ ...view, upNext: { ...view.upNext, attentionReasons: [] } },
		{ ...view, upNext: { ...view.upNext, attentionReasons: ['Same reason.', 'Same reason.'] } },
		{ ...view, upNext: { ...view.upNext, attentionReasons: ['x'.repeat(241)] } },
		{ ...view, scope: { query: '', filter: 'unknown' } }
	]) {
		assert.equal(reviewPageView(malformed), null);
	}
});

test('the current-review descriptor is closed, read-only, live, and clone-safe', async () => {
	let current = queueView();
	const tool = createCurrentReviewTool(() => current);
	assert.equal(tool.name, REVIEW_CURRENT_TOOL_NAME);
	assert.equal(tool.name, 'get_current_review_queue');
	assert.equal(tool.title, 'Get current review queue');
	assert.match(tool.description, /bounded work queue currently rendered on Review/u);
	assert.match(tool.description, /total, filtered, shown, and remaining counts/u);
	assert.deepEqual(tool.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
	assert.deepEqual(tool.annotations, { readOnlyHint: true, openWorldHint: false, untrustedContentHint: true });
	const result = await tool.execute({}, { signal: new AbortController().signal });
	assert.deepEqual(result, current);
	assert.notEqual(result, current);
	assert.notEqual(result.items, current.items);
	await assert.rejects(
		() => tool.execute({ unexpected: true }, { signal: new AbortController().signal }),
		/empty object/u
	);
	current = null;
	assert.equal(await tool.execute({}, { signal: new AbortController().signal }), null);
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(() => tool.execute({}, { signal: aborted.signal }), { name: 'AbortError' });
	assert.throws(() => createCurrentReviewTool(null), /queue getter/u);
});

test('the Review scope descriptor declares and verifies one reversible page-state interaction', async () => {
	const calls = [];
	const view = queueView();
	const tool = createSetReviewScopeTool(async (scope) => {
		calls.push(scope);
		return { changed: true, review: view };
	});
	assert.equal(tool.name, REVIEW_SCOPE_TOOL_NAME);
	assert.equal(tool.name, 'set_review_scope');
	assert.equal(tool.title, 'Set review scope');
	assert.match(tool.description, /changes only the current page scope/u);
	assert.match(tool.description, /does not modify workspace data/u);
	assert.deepEqual(tool.inputSchema, {
		type: 'object',
		properties: {
			query: { type: 'string', description: 'Search text. Use an empty string to clear the search.' },
			filter: {
				type: 'string',
				enum: ['all', 'blocked', 'missing-next', 'owner-gap'],
				description: 'Review queue subfilter.'
			}
		},
		required: ['query', 'filter'],
		additionalProperties: false
	});
	assert.deepEqual(tool.annotations, {
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
		untrustedContentHint: true
	});

	const result = await tool.execute({ query: ' garage ', filter: 'blocked' }, { signal: new AbortController().signal });
	assert.deepEqual(calls, [{ query: ' garage ', filter: 'blocked' }]);
	assert.deepEqual(result, { changed: true, review: view });
	assert.notEqual(result.review, view);
	await assert.rejects(() => tool.execute({ query: '', filter: 'unknown' }), /filter must be/u);
	await assert.rejects(() => tool.execute({ query: '', filter: 'all', extra: true }), /accepts only query and filter/u);
	await assert.rejects(() => tool.execute({ query: 42, filter: 'all' }), /query must be a string/u);
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(() => tool.execute({ query: '', filter: 'all' }, { signal: aborted.signal }), { name: 'AbortError' });
	assert.throws(() => createSetReviewScopeTool(null), /scope setter/u);
});

test('Review owns one canonical rendered projection and scope setter', () => {
	assert.match(routeSource, /import \{ registerPageTools \} from '\$lib\/webmcp\.mjs';/u);
	assert.match(routeSource, /import \{ createCurrentReviewTool, createSetReviewScopeTool, reviewItemPageView, reviewPageView \} from '\.\/review-webmcp\.mjs';/u);
	assert.match(routeSource, /let currentReviewView = \$derived\.by\(\(\) => reviewPageView\(\{[\s\S]*?totalReview: reviewTotal,[\s\S]*?searchMatches: visible\.length,[\s\S]*?filtered: filteredVisible\.length,[\s\S]*?shown: renderedReviewCount,[\s\S]*?remaining: hiddenReviewCount/u);
	assert.match(routeSource, /upNext: reviewItemForPageTool\(firstReview\),\s*items: renderedList\.map\(reviewItemForPageTool\)/u);
	assert.match(routeSource, /function attentionReasons\(pack: DemoPack\): string\[\][\s\S]*?Blocked:[\s\S]*?No next action is set[\s\S]*?Decision needed from/u);
	assert.doesNotMatch(routeSource, /This item is in the review queue/u);
	assert.match(routeSource, /function reviewItemForPageTool\([\s\S]*?reviewItemPageView\(\{[\s\S]*?title: workTitle\(pack\)[\s\S]*?workflow: workflowLabel\(pack\)[\s\S]*?owner: ownerLabel\(pack\.owner\)[\s\S]*?blocker: hasBlocker\(pack\) \? blockerText\(pack\) : null,[\s\S]*?attentionReasons: attentionReasons\(pack\)/u);
	assert.match(routeSource, /class="review-reasons"[\s\S]*?Why this surfaced[\s\S]*?attentionReasons\(firstReview\)/u);
	assert.match(routeSource, /async function applyReviewScope\([\s\S]*?query = nextQuery;\s*reviewSubFilter = nextFilter;\s*await tick\(\);[\s\S]*?focusAndPulse\(focusTarget/u);
	assert.match(routeSource, /const requestedQueue = summarizeReviewQueue\(packs, nextQuery, 'all'\);[\s\S]*?nextFilter === reviewSubFilter[\s\S]*?const changed = await applyReviewScope\(nextQuery, nextFilter, 'results'\);[\s\S]*?return \{ changed, review: currentReviewView \};/u);
	assert.match(routeSource, /webMcpScopeReceipt = \{[\s\S]*?Agent scoped Review[\s\S]*?Workspace data[\s\S]*?Unchanged/u);
	assert.match(routeSource, /let reviewReceiptScopeKey = \$derived\([\s\S]*?currentReviewView\.scope[\s\S]*?currentReviewView\.counts/u);
	assert.match(routeSource, /\$effect\(\(\) => \{[\s\S]*?webMcpScopeReceipt\.scopeKey !== reviewReceiptScopeKey[\s\S]*?webMcpScopeReceipt = null/u);
	assert.match(routeSource, /webMcpScopeReceipt = \{[\s\S]*?scopeKey: reviewReceiptScopeKey/u);
	assert.match(routeSource, /data-webmcp-receipt="review"[\s\S]*?<WornReceipt[\s\S]*?cells=\{webMcpScopeReceipt\.cells\}/u);
	assert.match(routeSource, /registerPageTools\(document, \[\s*createCurrentReviewTool\(\(\) => currentReviewView\),\s*createSetReviewScopeTool\(setReviewScopeFromWebMcp\)\s*\]\)/u);
	assert.match(routeSource, /stopReviewWebMcp\?\.\(\);\s*stopReviewWebMcp = null;/u);
	assert.doesNotMatch(routeSource, /document\.modelContext|registerTool\(/u);
	assert.doesNotMatch(`${routeSource}\n${helperSource}\n${registrationSource}`, /\/api\/mcp-proxy|jsonrpc|tools\/call|unregisterTool/u);
	assert.doesNotMatch(helperSource, /\.\.\.(?:pack|item|review)|runPackAction|togglePackPinned|setSelectedWork/u);
});
