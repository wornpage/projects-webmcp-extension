import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	PROJECTS_HANDOFF_GUIDE_TOOL_NAME,
	createWebMcpChallengeGuideTool,
	deriveGuideWorkScopeCatalog,
	readRenderedWebMcpChallengeGuide,
	webMcpChallengeGuideView
} from '../svelte-frontend/src/routes/webmcp-challenge/webmcp-challenge-webmcp.mjs';
import { guideWorkAction } from '../svelte-frontend/src/lib/guide-work-action.mjs';
import { routeWorkSearch } from '../svelte-frontend/src/routes/work/work-webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/webmcp-challenge/+page.svelte'), 'utf8');
const layoutSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/+layout.svelte'), 'utf8');
const pageConfig = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/+layout.ts'), 'utf8');
const svelteConfig = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/svelte.config.js'), 'utf8');
const appDocument = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/app.html'), 'utf8');
const webManifest = fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8');
const rootReadme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const demoClientSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/demo-client.ts'), 'utf8');
const reviewerTests = fs.readFileSync(path.join(repoRoot, 'docs/submission/webmcp/reviewer-tests.md'), 'utf8');
const editorSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/AgentBriefEditor.svelte'), 'utf8');
const guideActionSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/guide-work-action.mjs'), 'utf8');
const workRouteSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/work/+page.svelte'), 'utf8');
const samplePacks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/demo-packs.json'), 'utf8'));

function scopeFixture() {
	return {
		workspaceCount: 8,
		visibleCount: 8,
		discoveredChoiceCount: 2,
		shownChoiceCount: 2,
		omittedChoiceCount: 0,
		choices: [
			{ id: 'all', kind: 'all', label: 'All visible work', query: '', matchingCount: 8 },
			{ id: 'area-1', kind: 'derived', label: 'Household', query: 'Household', matchingCount: 4 },
			{ id: 'area-2', kind: 'derived', label: 'Research', query: 'Research', matchingCount: 4 },
			{ id: 'custom', kind: 'custom', label: 'Custom', query: null, matchingCount: null }
		],
		selected: { id: 'all', kind: 'all', label: 'All visible work', query: '', matchingCount: 8 }
	};
}

function guideFixture() {
	return {
		title: 'Projects handoff guide',
		purpose: 'People and browser agents share the same page.',
		steps: [
			{ position: 1, title: 'Understand work', description: 'Read the current view.', href: '/work' },
			{ position: 2, title: 'Inspect review', description: 'Read the queue.', href: '/review' },
			{ position: 3, title: 'Prepare next', description: 'Prepare a draft.', href: '/next' }
		],
		safety: ['Sample data stays local.', 'Page state is bounded.', 'Humans retain decisions.'],
		agentBrief: 'Read the visible project state.\nDo not save workspace data.',
		workQuery: '',
		workScope: scopeFixture()
	};
}

function selectedGuide({ id, kind, label, query, matchingCount }) {
	const guide = guideFixture();
	return {
		...guide,
		workQuery: query,
		workScope: {
			...guide.workScope,
			selected: { id, kind, label, query, matchingCount }
		}
	};
}

function renderedGuideDocument(fixture) {
	const root = {
		dataset: {
			webmcpChallengeTitle: fixture.title,
			webmcpChallengePurpose: fixture.purpose
		}
	};
	const briefInput = { value: fixture.agentBrief };
	const scopeChooser = {
		dataset: {
			workspaceCount: String(fixture.workScope.workspaceCount),
			visibleCount: String(fixture.workScope.visibleCount),
			discoveredChoiceCount: String(fixture.workScope.discoveredChoiceCount),
			shownChoiceCount: String(fixture.workScope.shownChoiceCount),
			omittedChoiceCount: String(fixture.workScope.omittedChoiceCount),
			selectedScopeId: fixture.workScope.selected.id,
			selectedScopeKind: fixture.workScope.selected.kind,
			selectedScopeLabel: fixture.workScope.selected.label,
			selectedWorkQuery: fixture.workScope.selected.query,
			selectedMatchCount: String(fixture.workScope.selected.matchingCount)
		}
	};
	const choices = fixture.workScope.choices.map((choice) => ({
		dataset: {
			scopeId: choice.id,
			scopeKind: choice.kind,
			scopeLabel: choice.label,
			...(choice.query === null ? {} : { scopeQuery: choice.query }),
			...(choice.matchingCount === null ? {} : { scopeMatchCount: String(choice.matchingCount) })
		}
	}));
	const steps = fixture.steps.map((step) => ({
		querySelector(selector) {
			if (selector === 'h2') return { textContent: step.title };
			if (selector === 'p') return { textContent: step.description };
			if (selector === 'a') return { getAttribute: (attribute) => attribute === 'href' ? step.href : null };
			return null;
		}
	}));
	return {
		root,
		briefInput,
		scopeChooser,
		querySelector(selector) {
			if (selector === '[data-webmcp-challenge-guide]') return root;
			if (selector === '[data-agent-brief-input]') return briefInput;
			if (selector === '[data-agent-scope-chooser]') return scopeChooser;
			return null;
		},
		querySelectorAll(selector) {
			if (selector === '[data-agent-scope-choice]') return choices;
			if (selector === '[data-webmcp-challenge-step]') return steps;
			if (selector === '[data-webmcp-challenge-safety] li') return fixture.safety.map((textContent) => ({ textContent }));
			return [];
		}
	};
}

test('Projects workflow surfaces keep the Guide compact and product-labeled', () => {
	assert.match(layoutSource, /<nav aria-label="Projects workflow navigation">/u);
	assert.doesNotMatch(layoutSource, /aria-label="Challenge pages"/u);
	assert.match(pageSource, /Choose visible work and edit the brief; the browser agent can inspect and prepare while you control Save\./u);
	assert.match(pageSource, /<WornAccordion label="Authority and browser status">/u);
	assert.doesNotMatch(pageSource, /challenge-facts|Projects workflow capabilities/u);
	assert.match(editorSource, /All visible work is ready by default; choose a counted scope or Custom, then ask:/u);
});

test('Guide editable fields include their live character bounds in accessible descriptions', () => {
	assert.match(editorSource, /<p class="agent-brief-limit" id="agent-brief-limit" aria-label=\{`\$\{brief\.length\} of 1000 characters`\}>/u);
	assert.match(editorSource, /<textarea[\s\S]*?id="agent-brief-input"[\s\S]*?aria-describedby="agent-brief-help agent-brief-limit agent-brief-status"/u);
	assert.match(editorSource, /<span id="agent-work-query-limit" aria-label=\{`\$\{workQuery\.length\} of 120 characters`\}>/u);
	assert.match(editorSource, /<input[\s\S]*?id="agent-work-query-input"[\s\S]*?aria-describedby="agent-work-query-help agent-work-query-limit agent-brief-status"/u);
});

test('Guide derives bounded scope choices from stable fields and the supplied Work search counter', () => {
	const queries = [];
	const visible = [
		{ id: 'a', area: 'Research' },
		{ id: 'b', area: 'Household' },
		{ id: 'c', area: 'research' },
		{ id: 'd' }
	];
	const catalog = deriveGuideWorkScopeCatalog(5, visible, (query) => {
		queries.push(query);
		return query === 'Household' ? 1 : 2;
	});
	assert.deepEqual(queries, ['Household', 'Research']);
	assert.deepEqual(catalog, {
		workspaceCount: 5,
		visibleCount: 4,
		discoveredChoiceCount: 2,
		shownChoiceCount: 2,
		omittedChoiceCount: 0,
		choices: [
			{ id: 'area-1', kind: 'derived', label: 'Household', query: 'Household', matchingCount: 1 },
			{ id: 'area-2', kind: 'derived', label: 'Research', query: 'Research', matchingCount: 2 }
		]
	});
	const many = Array.from({ length: 30 }, (_, index) => ({ area: `Area ${String(index).padStart(2, '0')}` }));
	const bounded = deriveGuideWorkScopeCatalog(30, many, () => 1);
	assert.equal(bounded.discoveredChoiceCount, 30);
	assert.equal(bounded.shownChoiceCount, 24);
	assert.equal(bounded.omittedChoiceCount, 6);
	assert.equal(bounded.choices.length, 24);
	assert.throws(() => deriveGuideWorkScopeCatalog(3, visible, () => 1), /denominators/u);
	assert.throws(() => deriveGuideWorkScopeCatalog(4, visible, () => 5), /count/u);
});

test('Projects handoff guide accepts default, derived, and honest zero-match Custom scopes', () => {
	const all = guideFixture();
	assert.deepEqual(webMcpChallengeGuideView(all), all);
	const derived = selectedGuide({ id: 'area-2', kind: 'derived', label: 'Research', query: 'Research', matchingCount: 4 });
	assert.deepEqual(webMcpChallengeGuideView(derived), derived);
	const noMatch = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: 'Definitely absent', matchingCount: 0 });
	assert.deepEqual(webMcpChallengeGuideView(noMatch), noMatch);
	const normalized = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: '  another term  ', matchingCount: 0 });
	assert.equal(webMcpChallengeGuideView(normalized)?.workQuery, 'another term');
	assert.equal(webMcpChallengeGuideView(normalized)?.workScope.selected.query, 'another term');
	const emptyCustom = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: '', matchingCount: 8 });
	assert.deepEqual(webMcpChallengeGuideView(emptyCustom), emptyCustom);
});

test('Guide actions, Guide projection, route arrival, and Work search share exact query and count outcomes', async () => {
	const workspaceCount = samplePacks.filter((pack) => !pack.archived).length;
	const researchQuery = routeWorkSearch(' Research ');
	const researchCount = samplePacks.filter((pack) => !pack.archived && pack.area === researchQuery).length;
	assert.equal(workspaceCount, 8);
	assert.equal(researchCount, 4);

	assert.deepEqual(guideWorkAction({ kind: 'all', label: 'All visible work', query: '', matchingCount: workspaceCount }), {
		disabled: false, href: '/work', label: 'Open all 8 work items'
	});
	assert.deepEqual(guideWorkAction({ kind: 'derived', label: 'Research', query: researchQuery, matchingCount: researchCount }), {
		disabled: false, href: '/work?search=Research', label: 'Open 4 Research items'
	});
	assert.deepEqual(guideWorkAction({ kind: 'custom', label: 'Custom', query: 'absent', matchingCount: 0 }), {
		disabled: true, href: null, label: 'No work matches'
	});
	assert.equal(guideWorkAction({ kind: 'custom', label: 'Custom', query: 'research & review', matchingCount: 1 }).href, '/work?search=research+%26+review');

	const guide = webMcpChallengeGuideView(selectedGuide({
		id: 'area-2', kind: 'derived', label: 'Research', query: researchQuery, matchingCount: researchCount
	}));
	assert.equal(guide?.workQuery, researchQuery);
	assert.deepEqual(guide?.workScope.selected, {
		id: 'area-2', kind: 'derived', label: 'Research', query: researchQuery, matchingCount: researchCount
	});
	assert.equal(samplePacks.filter((pack) => !pack.archived && pack.area === routeWorkSearch('absent')).length, 0);
	assert.match(guideActionSource, /new URLSearchParams\(\{ search: query \}\)/u);
	assert.match(pageSource, /guideVisiblePacks = \$derived\(filterPacks\(guidePacks, 'all', ''\)\)/u);
	assert.match(pageSource, /selectedMatchingCount = \$derived\(filterPacks\(guidePacks, 'all', workQuery\)\.length\)/u);
	assert.match(workRouteSource, /filterPacks\(packs,filter,debouncedQuery,energyFilter,areaFilter,recurrenceFilter,ownerFilter,hideDone\)/u);
	assert.match(editorSource, /guideWorkAction\(\{[\s\S]*?kind: selectedScopeKind,[\s\S]*?query: workQuery,[\s\S]*?matchingCount: selectedMatchingCount/u);
	assert.match(editorSource, /data-agent-scope-action-link[\s\S]*?href=\{selectedScopeAction\.href\}/u);
	assert.match(editorSource, /data-agent-scope-action-disabled[\s\S]*?disabled/u);
	assert.doesNotMatch(editorSource, /matching of \{scopeCatalog\.workspaceCount\} workspace/u);
});

test('Projects handoff guide rejects malformed, duplicate, negative, and mismatched scope projections', () => {
	const fixture = guideFixture();
	assert.equal(webMcpChallengeGuideView({ ...fixture, workScope: undefined }), null);
	assert.equal(webMcpChallengeGuideView({ ...fixture, steps: fixture.steps.slice(0, 2) }), null);
	assert.equal(webMcpChallengeGuideView({ ...fixture, safety: ['Only one'] }), null);
	assert.equal(webMcpChallengeGuideView({ ...fixture, agentBrief: 'x'.repeat(1001) }), null);
	assert.equal(webMcpChallengeGuideView({ ...fixture, agentBrief: 'Unsafe\u0007control' }), null);
	const duplicate = structuredClone(fixture);
	duplicate.workScope.choices[2].id = 'area-1';
	assert.equal(webMcpChallengeGuideView(duplicate), null);
	const duplicateQuery = structuredClone(fixture);
	duplicateQuery.workScope.choices[2].query = 'HOUSEHOLD';
	assert.equal(webMcpChallengeGuideView(duplicateQuery), null);
	const negative = structuredClone(fixture);
	negative.workScope.selected.matchingCount = -1;
	assert.equal(webMcpChallengeGuideView(negative), null);
	const denominator = structuredClone(fixture);
	denominator.workScope.visibleCount = 9;
	assert.equal(webMcpChallengeGuideView(denominator), null);
	const arithmetic = structuredClone(fixture);
	 arithmetic.workScope.omittedChoiceCount = 1;
	assert.equal(webMcpChallengeGuideView(arithmetic), null);
	const mismatchedCount = selectedGuide({ id: 'area-2', kind: 'derived', label: 'Research', query: 'Research', matchingCount: 3 });
	assert.equal(webMcpChallengeGuideView(mismatchedCount), null);
	const mismatchedQuery = selectedGuide({ id: 'area-2', kind: 'derived', label: 'Research', query: 'Household', matchingCount: 4 });
	assert.equal(webMcpChallengeGuideView(mismatchedQuery), null);
	const emptyCustomMismatch = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: '', matchingCount: 0 });
	assert.equal(webMcpChallengeGuideView(emptyCustomMismatch), null);
	const tooLong = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: 'x'.repeat(121), matchingCount: 0 });
	assert.equal(webMcpChallengeGuideView(tooLong), null);
	const control = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: 'line\nbreak', matchingCount: 0 });
	assert.equal(webMcpChallengeGuideView(control), null);
});

test('Projects handoff guide descriptor is closed, read-only, live, clone-safe, and abort-aware', async () => {
	let guide = guideFixture();
	const tool = createWebMcpChallengeGuideTool(() => guide);
	assert.equal(tool.name, PROJECTS_HANDOFF_GUIDE_TOOL_NAME);
	assert.deepEqual(tool.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
	assert.deepEqual(tool.annotations, {
		readOnlyHint: true,
		openWorldHint: false,
		untrustedContentHint: true
	});
	assert.deepEqual(await tool.execute({}), guide);
	guide = selectedGuide({ id: 'area-1', kind: 'derived', label: 'Household', query: 'Household', matchingCount: 4 });
	assert.deepEqual(await tool.execute({}), guide);
	guide = selectedGuide({ id: 'custom', kind: 'custom', label: 'Custom', query: 'No such work', matchingCount: 0 });
	const liveResult = await tool.execute({});
	assert.equal(liveResult.workQuery, 'No such work');
	assert.equal(liveResult.workScope.selected.matchingCount, 0);
	assert.deepEqual(structuredClone(liveResult), liveResult);
	await assert.rejects(tool.execute({ extra: true }), /empty object/u);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(tool.execute({}, { signal: controller.signal }), /abort/iu);
});

test('guide reader projects live DOM scope choices, selection, and denominators exactly', async () => {
	const fixture = guideFixture();
	const documentRef = renderedGuideDocument(fixture);
	const tool = createWebMcpChallengeGuideTool(() => readRenderedWebMcpChallengeGuide(documentRef));
	assert.deepEqual(await tool.execute({}), fixture);
	documentRef.briefInput.value = 'Edited live brief.';
	Object.assign(documentRef.scopeChooser.dataset, {
		selectedScopeId: 'area-2',
		selectedScopeKind: 'derived',
		selectedScopeLabel: 'Research',
		selectedWorkQuery: 'Research',
		selectedMatchCount: '4'
	});
	const changed = await tool.execute({});
	assert.equal(changed.agentBrief, 'Edited live brief.');
	assert.deepEqual(changed.workScope.selected, {
		id: 'area-2', kind: 'derived', label: 'Research', query: 'Research', matchingCount: 4
	});
	Object.assign(documentRef.scopeChooser.dataset, {
		selectedScopeId: 'custom',
		selectedScopeKind: 'custom',
		selectedScopeLabel: 'Custom',
		selectedWorkQuery: 'Definitely absent',
		selectedMatchCount: '0'
	});
	const noMatch = await tool.execute({});
	assert.equal(noMatch.workQuery, 'Definitely absent');
	assert.equal(noMatch.workScope.selected.matchingCount, 0);
	assert.match(pageSource, /<WornButton href=\{step\.href\} size="sm">\{step\.action\}<\/WornButton>/u);
	assert.match(pageSource, /Reader API unavailable[\s\S]*?Copy brief[\s\S]*?three visible route buttons remain usable/u);
});

test('handoff route owns one data-backed reader without navigation, write, or model authority', () => {
	assert.match(pageConfig, /prerender\s*=\s*true/u);
	for (const route of ['/webmcp-challenge', '/work', '/review', '/next']) {
		assert.match(svelteConfig, new RegExp(`prerender:[\\s\\S]*?${route.replaceAll('/', '\\/')}`, 'u'));
	}
	assert.match(pageSource, /createWebMcpChallengeGuideTool\(\(\) => readRenderedWebMcpChallengeGuide\(document\)\)/u);
	assert.match(pageSource, /guidePacks = \$derived\(\(\$demoState\?\.packs \?\? seedPacks\) as DemoPack\[\]\)/u);
	assert.match(pageSource, /guideVisiblePacks = \$derived\(filterPacks\(guidePacks, 'all', ''\)\)/u);
	assert.match(pageSource, /deriveGuideWorkScopeCatalog\([\s\S]*?\(query\) => filterPacks\(guidePacks, 'all', query\)\.length/u);
	assert.match(pageSource, /selectedMatchingCount = \$derived\(filterPacks\(guidePacks, 'all', workQuery\)\.length\)/u);
	assert.match(layoutSource, /shared workspace shell hydrates the one browser-local state owner[\s\S]*?refreshDemoState\(\{ reuseRecent: true \}\)/u);
	assert.match(pageSource, /<AgentBriefEditor scopeCatalog=\{guideScopeCatalog\} bind:selectedScopeId bind:workQuery \{selectedMatchingCount\} \/>/u);
	assert.match(pageSource, /Person: approve, save, or discard every workspace change/u);
	assert.match(pageSource, /typeof webMcpDocument\.modelContext\?\.registerTool === 'function'/u);
	assert.doesNotMatch(pageSource, /fetch\(|apiFetch|localStorage|sessionStorage|\.click\(|goto\(/u);
	assert.doesNotMatch(editorSource, /fetch\(|apiFetch|localStorage|sessionStorage|modelContext|goto\(/u);
	assert.doesNotMatch(`${pageSource}\n${editorSource}`, /Garage reset|Garden study|Household|Research/u);
	assert.match(appDocument, /Projects handoff workflow/u);
	assert.match(appDocument, /human-controlled saves/u);
	assert.match(webManifest, /read visible work, narrow review, and prepare a draft/u);
	assert.match(rootReadme, /^Live submission: <https:\/\/projects-webmcp-extension\.pages\.dev\/webmcp-challenge>$/mu);
	assert.match(reviewerTests, /Public judge URL \(no account required\)/u);
	assert.match(editorSource, /data-agent-scope-chooser/u);
	assert.match(editorSource, /data-agent-scope-choice/u);
	assert.match(editorSource, /data-workspace-count=\{scopeCatalog\.workspaceCount\}/u);
	assert.match(editorSource, /data-selected-work-query=\{workQuery\}/u);
	assert.match(editorSource, /WornChip label=\{`All visible work · \$\{scopeCatalog\.visibleCount\}`\}[\s\S]*?pressed=\{selectedScopeId === 'all'\}/u);
	assert.match(editorSource, /WornChip label="Custom…"[\s\S]*?pressed=\{selectedScopeId === 'custom'\}/u);
	assert.match(editorSource, /\{#if selectedScopeId === 'custom'\}[\s\S]*?data-agent-work-query-input[\s\S]*?maxlength="120"/u);
	assert.match(editorSource, /an unmatched term stays at zero/u);
	assert.match(editorSource, /aria-live="polite" data-agent-scope-action/u);
	assert.match(editorSource, /Local draft · not saved · workspace unchanged/u);
	assert.match(editorSource, /@media \(max-width: 520px\)/u);
});

test('the live sample can be explicitly reset through the single browser-state owner', () => {
	assert.match(pageSource, /Reset live sample/u);
	assert.match(pageSource, /onclick=\{resetLiveSample\}/u);
	assert.match(pageSource, /Explicitly restores this browser’s bundled sample and clears its prior local results\./u);
	assert.match(pageSource, /import \{ ChallengeStateError, demoState, displayToast, resetDemoSampleState \} from '\$lib\/demo-client';/u);
	assert.match(demoClientSource, /export async function resetDemoSampleState\(\): Promise<DemoState \| null> \{[\s\S]*?if \(!browser\) return null;[\s\S]*?stateRevision \+= 1;[\s\S]*?resetPersistedState\([\s\S]*?remove: \(\) => localStorage\.removeItem\(STORAGE_KEY\),[\s\S]*?loadSeed: loadSeedState,[\s\S]*?install: replaceDemoState/u);
	assert.doesNotMatch(pageSource, /localStorage|sessionStorage|fetch\(/u);
});

test('wide Guide layout keeps the existing steps in the left rail beside the editor without a dead quadrant', () => {
	const railStart = pageSource.indexOf('<div class="challenge-guide-rail">');
	const introStart = pageSource.indexOf('<div class="challenge-intro">');
	const stepsStart = pageSource.indexOf('<ol class="challenge-steps"');
	const editorStart = pageSource.indexOf('<AgentBriefEditor');
	assert.ok(railStart >= 0 && railStart < introStart && introStart < stepsStart && stepsStart < editorStart);
	assert.match(pageSource, /\.challenge-hero \{[\s\S]*?align-items: start;[\s\S]*?grid-template-columns: minmax\(0, 0\.82fr\) minmax\(360px, 1\.18fr\);/u);
	assert.match(pageSource, /\.challenge-guide-rail \{[\s\S]*?display: grid;[\s\S]*?gap: 24px;[\s\S]*?min-width: 0;/u);
	assert.match(pageSource, /\.challenge-steps \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/u);
	const layoutCss = pageSource.match(/\.challenge-hero \{[\s\S]*?@media \(max-width: 860px\)/u)?.[0] ?? '';
	assert.doesNotMatch(layoutCss, /min-height|overflow:\s*(?:hidden|clip)/u);
	assert.match(pageSource, /@media \(max-width: 860px\) \{[\s\S]*?\.challenge-hero,[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/u);
	assert.match(pageSource, /<WornButton href=\{step\.href\} size="sm">\{step\.action\}<\/WornButton>/u);
	for (const route of ['/work', '/review', '/next']) {
		assert.match(pageSource, new RegExp(`href: '${route}'`, 'u'), `${route} remains one of the usable Guide steps`);
	}
});

test('editable Guide fallback preserves composite copy, all semantics, and manual-copy focus', () => {
	assert.match(editorSource, /const scopedQuery = workQuery\.trim\(\);/u);
	assert.match(editorSource, /scopedQuery\s*\? `Brief for the browser agent:\\n\$\{brief\}\\n\\nWork to focus on:\\n\$\{scopedQuery\}`\s*:\s*brief/u);
	assert.match(editorSource, /navigator\.clipboard\.writeText\(copyText\)/u);
	assert.match(editorSource, /selectedScopeId = 'all';\s*workQuery = '';/u);
	assert.match(editorSource, /brief = DEFAULT_AGENT_BRIEF;/u);
	assert.match(editorSource, /briefInput\?\.focus\(\);[\s\S]*?briefInput\?\.select\(\);/u);
	assert.doesNotMatch(editorSource, /fetch\(|localStorage|sessionStorage|modelContext|goto\(/u);
});
