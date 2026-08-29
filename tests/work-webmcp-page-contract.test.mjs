import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	WORK_CURRENT_TOOL_NAME,
	WORK_SEARCH_TOOL_NAME,
	createCurrentWorkTool,
	createShowWorkSearchTool,
	normalizeWorkSearch,
	routeWorkSearch,
	workItemPageView,
	workPageView,
	workSearchPresentationReceipt
} from '../svelte-frontend/src/routes/work/work-webmcp.mjs';
import { registerPageTools } from '../svelte-frontend/src/lib/webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/work/+page.svelte'), 'utf8');
const helperSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/work/work-webmcp.mjs'), 'utf8');
const registrationSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/webmcp.mjs'), 'utf8');
const activityStripSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/WebMcpActivityStrip.svelte'), 'utf8');
const workflowSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/demo-workflow.ts'), 'utf8');

function workView({ search = '', items = null, workspace = 4, matching = 3, blocked = 1 } = {}) {
	const projectedItems = items ?? [
		{ id: 'alpha / one', title: 'Alpha', workflow: 'Active', owner: 'Avery', due: null, blocker: null, purpose: 'not exposed' },
		{ id: 'beta', title: 'Beta', workflow: 'Blocked', owner: 'Blake', due: 'Aug 25', blocker: 'Waiting for proof', memory: ['not exposed'] }
	];
	return workPageView({
		scope: {
			search,
			appliedSearch: search,
			status: 'all',
			energy: 'all',
			area: 'all',
			recurrence: 'all',
			owner: 'all',
			dueUrgency: 'all',
			sort: 'urgency',
			hideDone: false,
			focusMode: false,
			density: 'grid',
			notExposed: true
		},
		counts: { workspace, matching, shown: projectedItems.length, remaining: matching - projectedItems.length, blocked },
		items: projectedItems,
		rawPacks: [{ secret: 'not exposed' }]
	});
}

test('Work projects only its live scope, explicit denominators, and bounded rendered items', () => {
	const view = workView();
	assert.deepEqual(view, {
		scope: {
			search: '', appliedSearch: '', status: 'all', energy: 'all', area: 'all', recurrence: 'all', owner: 'all',
			dueUrgency: 'all', sort: 'urgency', hideDone: false, focusMode: false, density: 'grid'
		},
		counts: { workspace: 4, matching: 3, shown: 2, remaining: 1, blocked: 1 },
		items: [
			{ id: 'alpha / one', title: 'Alpha', href: '/next?pack=alpha%20%2F%20one', workflow: 'Active', owner: 'Avery', due: null, blocker: null },
			{ id: 'beta', title: 'Beta', href: '/next?pack=beta', workflow: 'Blocked', owner: 'Blake', due: 'Aug 25', blocker: 'Waiting for proof' }
		]
	});
	assert.deepEqual(Object.keys(view).sort(), ['counts', 'items', 'scope']);
	assert.doesNotMatch(JSON.stringify(view), /not exposed|secret/u);
	const pendingSearch = workPageView({ ...view, scope: { ...view.scope, search: 'nee', appliedSearch: '' } });
	assert.equal(pendingSearch.scope.search, 'nee');
	assert.equal(pendingSearch.scope.appliedSearch, '');
	assert.deepEqual(pendingSearch.counts, view.counts);
	assert.deepEqual(workItemPageView({ id: 'encoded / id', title: ' Item ', workflow: ' Active ', owner: null, due: null, blocker: null }), {
		id: 'encoded / id', title: 'Item', href: '/next?pack=encoded%20%2F%20id', workflow: 'Active', owner: null, due: null, blocker: null
	});

	for (const malformed of [
		null,
		{},
		{ scope: {}, counts: {}, items: [] },
		{ ...view, scope: { ...view.scope, status: 'unknown' } },
		{ ...view, scope: { ...view.scope, density: 'table' } },
		{ ...view, counts: { ...view.counts, workspace: 2 } },
		{ ...view, counts: { ...view.counts, matching: 4 } },
		{ ...view, counts: { ...view.counts, blocked: 4 } },
		{ ...view, items: [view.items[0], view.items[0]], counts: { ...view.counts, shown: 2 } },
		{ ...view, items: [{ id: '', title: 'Missing ID', workflow: 'Active', owner: null, due: null, blocker: null }], counts: { ...view.counts, shown: 1, remaining: 2 } }
	]) {
		assert.equal(workPageView(malformed), null);
	}
});

test('the current-Work descriptor is closed, read-only, untrusted-content aware, and live', async () => {
	let current = workView();
	let reads = 0;
	const tool = createCurrentWorkTool(() => {
		reads += 1;
		return current;
	});
	assert.equal(tool.name, WORK_CURRENT_TOOL_NAME);
	assert.equal(tool.name, 'get_current_work_view');
	assert.equal(tool.title, 'Get current Work view');
	assert.match(tool.description, /filtered, sorted, density-aware, and bounded/u);
	assert.match(tool.description, /workspace, matching, shown, and remaining/u);
	assert.deepEqual(tool.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
	assert.deepEqual(tool.annotations, { readOnlyHint: true, openWorldHint: false, untrustedContentHint: true });

	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(() => tool.execute({ unexpected: true }, { signal: aborted.signal }), { name: 'AbortError' });
	assert.equal(reads, 0);
	await assert.rejects(() => tool.execute(), /empty object/u);
	for (const malformed of [null, [], { unexpected: true }]) {
		await assert.rejects(() => tool.execute(malformed), /empty object/u);
	}
	assert.equal(reads, 0);

	const canonical = structuredClone(current);
	const first = await tool.execute({}, { signal: new AbortController().signal });
	assert.equal(reads, 1);
	assert.deepEqual(first, current);
	assert.notEqual(first, current);
	assert.notEqual(first.scope, current.scope);
	assert.notEqual(first.counts, current.counts);
	assert.notEqual(first.items, current.items);
	for (let index = 0; index < first.items.length; index += 1) {
		assert.notEqual(first.items[index], current.items[index]);
	}
	first.scope.search = 'mutated result';
	first.counts.workspace = 999;
	first.items[0].title = 'Mutated first item';
	first.items[1].owner = 'Mutated second owner';
	first.items.push({ ...first.items[0], id: 'result-only' });
	assert.deepEqual(current, canonical);

	current = null;
	assert.equal(await tool.execute({}), null);
	assert.equal(reads, 2);
	assert.throws(() => createCurrentWorkTool(null), /current-view getter/u);
});

test('the Work-search descriptor declares and verifies one reversible page-local interaction', async () => {
	const calls = [];
	const focusProof = { focused: true, focusVisible: true, inViewport: true, pulsed: true };
	const tool = createShowWorkSearchTool(async (query) => {
		calls.push(query);
		const work = workView({ search: query });
		return { changed: true, query, focus: { target: 'item', itemId: work.items[0].id, ...focusProof }, work };
	});
	assert.equal(tool.name, WORK_SEARCH_TOOL_NAME);
	assert.equal(tool.name, 'show_work_search');
	assert.equal(tool.title, 'Show Work search');
	assert.match(tool.description, /only Work's visible text search/u);
	assert.match(tool.description, /never modifies workspace data/u);
	assert.deepEqual(tool.inputSchema, {
		type: 'object',
		properties: {
			query: { type: 'string', maxLength: 120, description: 'Text to show in Work search. Use an empty string to clear it.' }
		},
		required: ['query'],
		additionalProperties: false
	});
	assert.deepEqual(tool.annotations, {
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
		untrustedContentHint: true
	});

	const result = await tool.execute({ query: ' needle ' }, { signal: new AbortController().signal });
	assert.deepEqual(calls, ['needle']);
	assert.equal(result.changed, true);
	assert.equal(result.query, 'needle');
	assert.deepEqual(result.focus, { target: 'item', itemId: 'alpha / one', ...focusProof });
	assert.equal(result.work.scope.search, 'needle');
	assert.equal(result.work.scope.appliedSearch, 'needle');
	assert.notEqual(result.work, workView({ search: 'needle' }));
	for (const field of Object.keys(focusProof)) {
		const unverified = createShowWorkSearchTool(async () => ({
			...structuredClone(result),
			focus: { ...result.focus, [field]: false }
		}));
		await assert.rejects(() => unverified.execute({ query: 'needle' }), /verifiable page receipt/u);
	}
	await assert.rejects(() => tool.execute({ query: 'needle', status: 'active' }), /accepts only query/u);
	await assert.rejects(() => tool.execute({ query: 42 }), /must be a string/u);
	await assert.rejects(() => tool.execute({ query: 'line\nbreak' }), /control characters/u);
	await assert.rejects(() => tool.execute({ query: 'x'.repeat(121) }), /120 characters or fewer/u);
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(() => tool.execute({ query: '' }, { signal: aborted.signal }), { name: 'AbortError' });
	assert.throws(() => createShowWorkSearchTool(null), /search presenter/u);

	const mismatched = createShowWorkSearchTool(async () => ({
		changed: true,
		query: 'needle',
		focus: { target: 'item', itemId: 'beta', ...focusProof },
		work: workView({ search: 'needle' })
	}));
	await assert.rejects(() => mismatched.execute({ query: 'needle' }), /focus did not match/u);
	const emptyWork = workView({ search: 'missing', items: [], matching: 0, blocked: 0 });
	const empty = createShowWorkSearchTool(async () => ({
		changed: true,
		query: 'missing',
		focus: { target: 'search', itemId: null, ...focusProof },
		work: emptyWork
	}));
	const noMatch = await empty.execute({ query: 'missing' });
	assert.deepEqual(noMatch.focus, { target: 'search', itemId: null, ...focusProof });
	assert.deepEqual(noMatch.work.counts, { workspace: 4, matching: 0, shown: 0, remaining: 0, blocked: 0 });
	assert.deepEqual(noMatch.work.items, []);
});

test('one exported Work-search normalizer serves tools and safe URL arrival', () => {
	assert.equal(normalizeWorkSearch('  Research  '), 'Research');
	assert.equal(routeWorkSearch('  Research  '), 'Research');
	assert.equal(normalizeWorkSearch('x'.repeat(121)), null);
	assert.equal(normalizeWorkSearch('line\nbreak'), null);
	assert.equal(routeWorkSearch('x'.repeat(121)), '');
	assert.equal(routeWorkSearch('line\nbreak'), '');
	assert.equal(routeWorkSearch(null), '');
	assert.match(helperSource, /const query = normalizeWorkSearch\(candidate\.query\);/u);
	assert.match(routeSource, /function applyRouteWorkSearch\(searchParam: unknown\)[\s\S]*?const routeSearch = routeWorkSearch\(searchParam\);[\s\S]*?query = routeSearch;[\s\S]*?debouncedQuery = routeSearch;/u);
	assert.match(routeSource, /const routeSearch = applyRouteWorkSearch\(\$page\.url\.searchParams\.get\('search'\)\);/u);
	assert.match(routeSource, /void focusRouteWorkSearchArrival\(routeSearch\);/u);
	const arrival = routeSource.match(/function applyRouteWorkSearch[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(arrival, /fetch\(|localStorage|sessionStorage|goto\(|runPackAction|registerPageTools/u);
});

test('Work presentation receipts freeze the normalized query and live denominators', () => {
	const work = workView({ search: 'Garage reset', workspace: 8, matching: 4, blocked: 2 });
	const receipt = workSearchPresentationReceipt({
		changed: true,
		query: 'Garage reset',
		focus: { target: 'item', itemId: work.items[0].id, focused: true, focusVisible: true, inViewport: true, pulsed: true },
		work
	});
	assert.equal(receipt.summary, 'Work search updated for “Garage reset”.');
	assert.deepEqual(receipt.cells, [
		{ label: 'Visible query', value: '“Garage reset”' },
		{ label: 'Current scope', value: '2 shown · 4 matching · 8 workspace' },
		{ label: 'Evidence', value: '2 blocked in the matching work' },
		{ label: 'Status', value: 'Visible search updated · Not saved' }
	]);
	assert.equal(receipt.scopeKey, JSON.stringify({ scope: work.scope, counts: work.counts }));

	const clearedWork = workView({ search: '', workspace: 8, matching: 3, blocked: 1 });
	const cleared = workSearchPresentationReceipt({
		changed: true,
		query: '',
		focus: { target: 'item', itemId: clearedWork.items[0].id, focused: true, focusVisible: true, inViewport: true, pulsed: true },
		work: clearedWork
	});
	assert.equal(cleared.summary, 'Work search cleared to show all work.');
	assert.equal(cleared.cells[0].value, 'All work · search cleared');
});

test('Work receipt insertion is followed by strict revalidation and failure clears the provisional receipt', async () => {
	const resultHandler = routeSource.match(/async function recordWorkWebMcpResult[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.match(resultHandler, /if \(toolName !== WORK_SEARCH_TOOL_NAME\) return;[\s\S]*?webMcpSearchReceipt = \{ \.\.\.workSearchPresentationReceipt\(outcome\), toolName \};[\s\S]*?await tick\(\);[\s\S]*?focusWorkSearchDestination\(true\)/u);
	assert.match(resultHandler, /finalFocus\.target !== outcome\.focus\.target[\s\S]*?finalFocus\.itemId !== outcome\.focus\.itemId[\s\S]*?throw new Error\('Work receipt focus did not match the rendered search destination\.'\)/u);

	let registered;
	let visibleReceipt = null;
	const events = [];
	const strictFailure = new Error('Visible focus verification failed: {"inViewport":false}');
	const view = workView({ search: 'Garage reset' });
	const validPageState = structuredClone(view);
	const focus = {
		target: 'item',
		itemId: view.items[0].id,
		focused: true,
		focusVisible: true,
		inViewport: true,
		pulsed: true
	};
	registerPageTools({
		modelContext: { registerTool(candidate) { registered = candidate; } }
	}, [createShowWorkSearchTool(async () => ({
		changed: true,
		query: 'Garage reset',
		focus,
		work: view
	}))], {
		onResult: async () => {
			visibleReceipt = { summary: 'Provisional Work search success' };
			events.push('receipt');
			await Promise.resolve();
			events.push('strict revalidation');
			throw strictFailure;
		},
		onInvocationError: async ({ error }) => {
			assert.equal(error, strictFailure);
			visibleReceipt = null;
			events.push('clear');
			await Promise.resolve();
		}
	});

	await assert.rejects(() => registered.execute({ query: 'Garage reset' }), strictFailure);
	assert.deepEqual(events, ['receipt', 'strict revalidation', 'clear']);
	assert.equal(visibleReceipt, null);
	assert.deepEqual(view, validPageState);
	const failureHandler = routeSource.match(/async function clearFailedWorkWebMcpReceipt[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.match(failureHandler, /webMcpSearchReceipt = null;[\s\S]*?await tick\(\);/u);
	assert.doesNotMatch(failureHandler, /query\s*=|debouncedQuery\s*=/u);
});

test('Work renders and returns one canonical bounded view through its existing search owner', () => {
	assert.match(routeSource, /import \{ registerPageTools \} from '\$lib\/webmcp\.mjs';/u);
	assert.match(routeSource, /import \{[\s\S]*?createCurrentWorkTool,[\s\S]*?createShowWorkSearchTool,[\s\S]*?workItemPageView,[\s\S]*?workPageView[\s\S]*?\} from '\.\/work-webmcp\.mjs';/u);
	assert.match(routeSource, /let currentWorkView = \$derived\.by\(\(\) => workPageView\(\{[\s\S]*?search: query,[\s\S]*?appliedSearch: debouncedQuery,[\s\S]*?matching: visible\.length,[\s\S]*?shown: renderedVisible\.length,[\s\S]*?items: renderedVisible\.map\(\(pack\) => workItemPageView\(/u);
	assert.match(routeSource, /let hideDone = \$state\(false\);/u);
	assert.doesNotMatch(routeSource, /demo-hide-done/u);
	assert.match(routeSource, /\{#each renderedVisible as pack, i \(pack\.id\)\}/u);
	assert.match(routeSource, /function focusWorkSearchDestination\(requireVisibleFocus: boolean\)[\s\S]*?\[data-work-item\]\[data-pack-id\][\s\S]*?focusAndPulse\(destination, \{[\s\S]*?behavior: 'auto',[\s\S]*?block: 'center',[\s\S]*?requireVisibleFocus[\s\S]*?target: 'item'[\s\S]*?target: 'search'/u);
	assert.match(routeSource, /async function showWorkSearchFromWebMcp\(nextQuery: string\) \{[\s\S]*?query = nextQuery;\s*debouncedQuery = nextQuery;[\s\S]*?await tick\(\);[\s\S]*?focus: focusWorkSearchDestination\(true\),[\s\S]*?work: currentWorkView/u);
	assert.match(routeSource, /async function recordWorkWebMcpResult[\s\S]*?if \(toolName !== WORK_SEARCH_TOOL_NAME\) return;[\s\S]*?webMcpSearchReceipt = \{ \.\.\.workSearchPresentationReceipt\(outcome\), toolName \}/u);
	assert.match(helperSource, /function workSearchPresentationReceipt[\s\S]*?Visible query[\s\S]*?Current scope[\s\S]*?Evidence[\s\S]*?Status[\s\S]*?Not saved/u);
	assert.match(routeSource, /webMcpSearchReceipt = \{ \.\.\.workSearchPresentationReceipt\(outcome\), toolName \};[\s\S]*?await tick\(\);[\s\S]*?focusWorkSearchDestination\(true\)[\s\S]*?finalFocus\.target !== outcome\.focus\.target[\s\S]*?throw new Error\('Work receipt focus did not match the rendered search destination\.'\)/u);
	assert.match(routeSource, /let workReceiptScopeKey = \$derived\([\s\S]*?currentWorkView\.scope[\s\S]*?currentWorkView\.counts/u);
	assert.match(routeSource, /\$effect\(\(\) => \{[\s\S]*?webMcpSearchReceipt\.scopeKey !== workReceiptScopeKey[\s\S]*?webMcpSearchReceipt = null/u);
	assert.match(helperSource, /scopeKey: JSON\.stringify\(\{ scope: work\.scope, counts: work\.counts \}\)/u);
	assert.match(routeSource, /import WebMcpActivityStrip from '\$lib\/WebMcpActivityStrip\.svelte';/u);
	assert.match(routeSource, /\{#if webMcpSearchReceipt\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?route="work"[\s\S]*?outcome=\{webMcpSearchReceipt\.summary\}[\s\S]*?toolName=\{webMcpSearchReceipt\.toolName\}[\s\S]*?cells=\{webMcpSearchReceipt\.cells\}[\s\S]*?\/>[\s\S]*?<!-- Keep the last good local view/u);
	assert.doesNotMatch(routeSource, /ondone=\{\(\) => \(webMcpSearchReceipt = null\)\}/u);
	assert.doesNotMatch(routeSource, /work-presenter-result|webmcp-tool-label/u);
	assert.match(activityStripSource, /data-webmcp-receipt=\{route\}[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/u);
	assert.match(activityStripSource, /Agent activity[\s\S]*?WebMCP · \{toolName\}[\s\S]*?webmcp-activity-outcome[\s\S]*?webmcp-activity-evidence/u);
	assert.match(activityStripSource, /grid-template-columns: repeat\(auto-fit, minmax\(min\(190px, 100%\), 1fr\)\);[\s\S]*?@media \(max-width: 500px\)/u);
	assert.match(routeSource, /\.demo-work-list\s*\{\s*overflow:\s*visible;\s*padding-block-start:\s*8px;\s*\}/u);
	assert.match(routeSource, /registerPageTools\(document, \[[\s\S]*?createCurrentWorkTool\(\(\) => currentWorkView\),[\s\S]*?createShowWorkSearchTool\(showWorkSearchFromWebMcp\)[\s\S]*?\], \{[\s\S]*?onInvocationError: clearFailedWorkWebMcpReceipt,[\s\S]*?onResult: recordWorkWebMcpResult[\s\S]*?\}\)/u);
	assert.match(routeSource, /stopWorkWebMcp\?\.\(\);\s*stopWorkWebMcp = null;/u);
	assert.match(routeSource, /stopWorkWebMcp = null;\s*webMcpSearchReceipt = null;/u);
	assert.doesNotMatch(routeSource, /document\.modelContext|registerTool\(/u);
	assert.doesNotMatch(`${routeSource}\n${helperSource}\n${registrationSource}`, /\/api\/mcp-proxy|jsonrpc|tools\/call|unregisterTool/u);
	assert.doesNotMatch(helperSource, /\.\.\.(?:pack|item|work)|purpose:|memory:|sources:|activity:/u);
});

test('Work text search includes the visible work type with every existing search field', () => {
	const searchHaystack = workflowSource.match(/return \[\s*pack\.title,[\s\S]*?memory\s*\]\s*\.join\(' '\)\.toLowerCase\(\)\.includes\(q\);/u)?.[0] ?? '';
	for (const field of ['pack.title', 'pack.type', 'pack.next', 'pack.owner', 'pack.due', 'pack.blocker', 'pack.area', "(pack.sources || []).join(' ')", 'pack.purpose', 'memory']) {
		assert.match(searchHaystack, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
	}
});
