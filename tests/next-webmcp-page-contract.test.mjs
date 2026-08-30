import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	CURRENT_NEXT_EDITOR_TOOL_NAME,
	NEXT_EDITOR_PREVIEW_ID,
	NEXT_PREPARATION_RECEIPT_ID,
	NEXT_PREPARATION_SUMMARY,
	PREPARE_NEXT_ACTION_TOOL_NAME,
	createCurrentNextEditorTool,
	createPrepareNextActionTool,
	nextEditorPageView,
	verifiedNextEvidenceNote,
	verifyNextPreparationEvidence,
	shouldHydratePendingDraft
} from '../svelte-frontend/src/routes/next/next-webmcp.mjs';
import { approvePendingDraft, cloneMutatePersist, discardPendingDraft, hydrateSerializedState, pendingDraftFingerprint, pendingDraftNavigation, resetPersistedState, restorePendingDraft, upsertPendingDraft } from '../svelte-frontend/src/lib/pending-next-action.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/next/+page.svelte'), 'utf8');
const demoClientSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/demo-client.ts'), 'utf8');
const layoutSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/+layout.svelte'), 'utf8');
const pendingStateSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/pending-next-action.mjs'), 'utf8');
const reviewerTests = fs.readFileSync(path.join(repoRoot, 'docs/submission/webmcp/reviewer-tests.md'), 'utf8');
const helperSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/next/next-webmcp.mjs'), 'utf8');
const registrationSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/webmcp.mjs'), 'utf8');
const activityStripSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/WebMcpActivityStrip.svelte'), 'utf8');

const presetChoices = ['Review', 'Open', 'Focus', 'Set Blocker: None', 'Start', 'Finish with proof'];
const currentEvidenceReference = Object.freeze({
	workId: 'next-current',
	field: 'blocker',
	expectedValue: 'Waiting for labels'
});
const currentVerifiedEvidence = Object.freeze({
	work: { id: 'next-current', title: 'Prepare the garage inventory' },
	field: 'blocker',
	label: 'Blocker',
	value: 'Waiting for labels'
});

function preparationReceipt(choice, evidence = [currentVerifiedEvidence]) {
	return {
		summary: NEXT_PREPARATION_SUMMARY,
		work: { id: 'next-current', title: 'Prepare the garage inventory' },
		evidenceNote: verifiedNextEvidenceNote(evidence),
		evidence,
		preparedAction: choice,
		workspaceChanged: false,
		requiresHumanSave: true
	};
}

function verifiedFromReferences(references) {
	return references.map((reference) => ({
		work: { id: reference.workId, title: reference.workId === 'next-current' ? 'Prepare the garage inventory' : 'Related work' },
		field: reference.field,
		label: reference.field === 'workflow' ? 'Workflow' : 'Blocker',
		value: reference.expectedValue
	}));
}

function editor(overrides = {}) {
	return nextEditorPageView({
		work: { id: 'next-current', title: 'Prepare the garage inventory' },
		presetChoices,
		editor: { mode: 'preset', choice: 'Open' },
		preview: { blocker: null, nextAction: 'Open' },
		preparationReceipt: null,
		canSave: true,
		busy: false,
		staleReason: null,
		privateState: 'not exposed',
		...overrides
	});
}

test('Next projects only its exact current editor, choices, and visible preview', () => {
	const view = editor({ preview: { blocker: 'Waiting for labels', nextAction: 'Unblock' } });
	assert.deepEqual(view, {
		work: { id: 'next-current', title: 'Prepare the garage inventory' },
		presetChoices,
		editor: { mode: 'preset', choice: 'Open' },
		preview: { blocker: 'Waiting for labels', nextAction: 'Unblock' },
		preparationReceipt: null,
		canSave: true,
		busy: false,
		staleReason: null
	});
	assert.doesNotMatch(JSON.stringify(view), /not exposed/u);
	assert.notEqual(view.presetChoices, presetChoices);
	const prepared = editor({
		editor: { mode: 'custom', choice: 'Clear the garage floor' },
		preview: { blocker: 'Waiting on storage bins', nextAction: 'Clear the garage floor' },
		preparationReceipt: preparationReceipt('Clear the garage floor')
	});
	assert.equal(prepared.preview.nextAction, 'Clear the garage floor');
	assert.equal(prepared.preparationReceipt.workspaceChanged, false);
	assert.equal(prepared.preparationReceipt.requiresHumanSave, true);

	for (const malformed of [
		null,
		{},
		{ ...view, work: { id: '', title: view.work.title } },
		{ ...view, presetChoices: [...presetChoices, presetChoices[0]] },
		{ ...view, editor: { mode: 'archive', choice: 'Open' } },
		{ ...view, preview: { blocker: null, nextAction: '' } },
		{ ...view, preparationReceipt: { summary: NEXT_PREPARATION_SUMMARY } },
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, preparedAction: 'Open' } },
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, workspaceChanged: true } },
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, requiresHumanSave: false } },
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, evidenceNote: 'Unverified prose.' } },
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, evidence: [] } },
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, evidence: [{ ...currentVerifiedEvidence, label: 'Status' }] } },
		{ ...view, canSave: 'yes' },
		{ ...view, staleReason: 'stale', canSave: true },
		{ ...view, busy: 'no' }
	]) {
		assert.equal(nextEditorPageView(malformed), null);
	}
});

test('the current-editor descriptor is closed, read-only, untrusted-content aware, and live', async () => {
	let current = editor({
		editor: { mode: 'custom', choice: 'Clear the garage floor' },
		preview: { blocker: 'Waiting on storage bins', nextAction: 'Clear the garage floor' },
		preparationReceipt: preparationReceipt('Clear the garage floor')
	});
	let reads = 0;
	const tool = createCurrentNextEditorTool(() => {
		reads += 1;
		return current;
	});
	assert.equal(tool.name, CURRENT_NEXT_EDITOR_TOOL_NAME);
	assert.equal(tool.name, 'get_current_next_editor');
	assert.equal(tool.title, 'Get current Next editor');
	assert.match(tool.description, /exact current work item, visible choices, unsaved editor, and preview/u);
	assert.match(tool.description, /does not change or save/u);
	assert.deepEqual(tool.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
	assert.deepEqual(tool.annotations, { readOnlyHint: true, openWorldHint: false, untrustedContentHint: true });

	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(() => tool.execute({ unexpected: true }, { signal: aborted.signal }), { name: 'AbortError' });
	assert.equal(reads, 0);
	await assert.rejects(() => tool.execute(), /Next current editor requires an empty object/u);
	for (const malformed of [null, [], { unexpected: true }]) {
		await assert.rejects(() => tool.execute(malformed), /Next current editor requires an empty object/u);
	}
	assert.equal(reads, 0);

	const canonical = structuredClone(current);
	const first = await tool.execute({}, { signal: new AbortController().signal });
	assert.equal(reads, 1);
	assert.deepEqual(first, current);
	assert.notEqual(first, current);
	assert.notEqual(first.work, current.work);
	assert.notEqual(first.presetChoices, current.presetChoices);
	assert.notEqual(first.editor, current.editor);
	assert.notEqual(first.preview, current.preview);
	assert.notEqual(first.preparationReceipt, current.preparationReceipt);
	assert.notEqual(first.preparationReceipt.work, current.preparationReceipt.work);
	first.work.title = 'Mutated work title';
	first.presetChoices.push('Result-only choice');
	first.editor.choice = 'Mutated editor choice';
	first.preview.nextAction = 'Mutated preview';
	first.preparationReceipt.evidenceNote = 'Mutated result-only note.';
	first.preparationReceipt.evidence[0].value = 'Mutated result-only evidence.';
	first.preparationReceipt.work.title = 'Mutated receipt work title';
	assert.deepEqual(current, canonical);

	current = null;
	assert.equal(await tool.execute({}), null);
	assert.equal(reads, 2);
	assert.throws(() => createCurrentNextEditorTool(null), /current editor getter/u);
});

test('the prepare descriptor validates a stale-safe reversible page operation and receipt', async () => {
	const calls = [];
	const focusProof = { focused: true, focusVisible: true, inViewport: true, pulsed: true };
	const tool = createPrepareNextActionTool(async (input) => {
		calls.push(input);
		const evidence = verifiedFromReferences(input.evidence);
		return {
			changed: true,
			focus: { id: NEXT_PREPARATION_RECEIPT_ID, ...focusProof },
			next: editor({
				editor: { mode: 'custom', choice: input.choice },
				preview: { blocker: null, nextAction: input.choice },
				preparationReceipt: preparationReceipt(input.choice, evidence)
			})
		};
	});
	assert.equal(tool.name, PREPARE_NEXT_ACTION_TOOL_NAME);
	assert.equal(tool.name, 'prepare_next_action');
	assert.equal(tool.title, 'Prepare next-action preview');
	assert.match(tool.description, /durable browser-local pending next-action draft/u);
	assert.match(tool.description, /rejects stale or mismatched facts/u);
	assert.match(tool.description, /generates the visible evidence note from the verified values/u);
	assert.match(tool.description, /never saves or writes workspace data/u);
	assert.deepEqual(tool.inputSchema, {
		type: 'object',
		properties: {
			choice: { type: 'string', minLength: 1, maxLength: 200, description: 'Preset label or custom next action to preview.' },
			expectedMode: { type: 'string', enum: ['preset', 'custom'], description: 'Editor mode returned by the latest current-editor read.' },
			expectedChoice: { type: 'string', maxLength: 200, description: 'Editor choice returned by the latest current-editor read.' },
			evidence: {
				type: 'array',
				minItems: 1,
				maxItems: 3,
				description: 'Exact facts previously read from Work or Review. At least one fact must reference the current work item.',
				items: {
					type: 'object',
					properties: {
						workId: { type: 'string', minLength: 1, maxLength: 200, description: 'Exact work item id returned by Work or Review.' },
						field: { type: 'string', enum: ['workflow', 'blocker'], description: 'Exact projected field being cited.' },
						expectedValue: { type: 'string', minLength: 1, maxLength: 200, description: 'Exact field value returned by Work or Review.' }
					},
					required: ['workId', 'field', 'expectedValue'],
					additionalProperties: false
				}
			}
		},
		required: ['choice', 'expectedMode', 'expectedChoice', 'evidence'],
		additionalProperties: false
	});
	assert.deepEqual(tool.annotations, {
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
		untrustedContentHint: true
	});

	const result = await tool.execute({
		choice: '  Call the supplier  ',
		expectedMode: 'preset',
		expectedChoice: ' Open ',
		evidence: [{ workId: ' next-current ', field: 'blocker', expectedValue: ' Waiting for labels ' }]
	}, { signal: new AbortController().signal });
	assert.deepEqual(calls, [{
		choice: 'Call the supplier',
		expectedMode: 'preset',
		expectedChoice: 'Open',
		evidence: [currentEvidenceReference]
	}]);
	assert.equal(result.changed, true);
	assert.deepEqual(result.focus, { id: 'next-preparation-receipt', ...focusProof });
	assert.equal(result.next.editor.mode, 'custom');
	assert.equal(result.next.editor.choice, 'Call the supplier');
	assert.equal(result.next.preparationReceipt.evidenceNote, 'Prepare the garage inventory — Blocker: Waiting for labels.');
	assert.deepEqual(result.next.preparationReceipt.evidence, [currentVerifiedEvidence]);
	for (const field of Object.keys(focusProof)) {
		const unverified = createPrepareNextActionTool(async () => ({
			...structuredClone(result),
			focus: { ...result.focus, [field]: false }
		}));
		await assert.rejects(
			() => unverified.execute({
				choice: 'Call the supplier',
				expectedMode: 'custom',
				expectedChoice: 'Call the supplier',
				evidence: [currentEvidenceReference]
			}),
			/verifiable page receipt/u
		);
	}

	const validInput = (overrides = {}) => ({
		choice: 'Start',
		expectedMode: 'preset',
		expectedChoice: 'Open',
		evidence: [currentEvidenceReference],
		...overrides
	});
	for (const [input, message] of [
		[{}, /requires choice, expectedMode, expectedChoice, and evidence/u],
		[validInput({ choice: '' }), /choice cannot be empty/u],
		[validInput({ expectedMode: 'other' }), /expectedMode must be preset or custom/u],
		[{ ...validInput(), packId: 'other' }, /accepts only choice, expectedMode, expectedChoice, and evidence/u],
		[validInput({ choice: 42 }), /choice must be a string/u],
		[validInput({ choice: 'x'.repeat(201) }), /choice must be 200 characters or fewer/u],
		[validInput({ choice: 'Line\nbreak' }), /choice cannot contain control characters/u],
		[validInput({ evidence: [] }), /evidence must contain one to 3 unique exact work facts/u],
		[validInput({ evidence: Array.from({ length: 4 }, (_, index) => ({ workId: `work-${index}`, field: 'workflow', expectedValue: 'Ready' })) }), /evidence must contain one to 3 unique exact work facts/u],
		[validInput({ evidence: [currentEvidenceReference, currentEvidenceReference] }), /evidence must contain one to 3 unique exact work facts/u],
		[validInput({ evidence: [{ ...currentEvidenceReference, field: 'owner' }] }), /evidence must contain one to 3 unique exact work facts/u],
		[validInput({ evidence: [{ ...currentEvidenceReference, expectedValue: 'Line\nbreak' }] }), /evidence must contain one to 3 unique exact work facts/u],
		[validInput({ evidence: [{ ...currentEvidenceReference, extra: 'not allowed' }] }), /evidence must contain one to 3 unique exact work facts/u]
	]) {
		await assert.rejects(() => tool.execute(input), message);
	}
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(
		() => tool.execute(validInput(), { signal: aborted.signal }),
		{ name: 'AbortError' }
	);
	assert.throws(() => createPrepareNextActionTool(null), /next-action preparer/u);

	const mismatched = createPrepareNextActionTool(async () => ({
		changed: true,
		focus: { id: NEXT_PREPARATION_RECEIPT_ID, ...focusProof },
		next: editor({ editor: { mode: 'preset', choice: 'Open' } })
	}));
	await assert.rejects(
		() => mismatched.execute(validInput()),
		/did not preserve the prepared choice/u
	);
	assert.throws(
		() => createPrepareNextActionTool(async () => result, { capture: null, restore: () => {} }),
		/preparation transactions require capture and restore functions/u
	);
});

test('Next verifies exact live workspace facts and generates the evidence note itself', () => {
	const workspace = [
		{
			id: 'next-current',
			title: 'Garage reset: sort shelves',
			workflow: 'Blocked',
			blocker: 'Waiting on storage bins'
		},
		{
			id: 'garage-reset-clear-floor',
			title: 'Garage reset: clear the floor',
			workflow: 'Done',
			blocker: 'None'
		}
	];
	const references = [
		{ workId: 'next-current', field: 'blocker', expectedValue: 'Waiting on storage bins' },
		{ workId: 'garage-reset-clear-floor', field: 'workflow', expectedValue: 'Done' }
	];
	const verified = verifyNextPreparationEvidence(references, workspace, 'next-current');
	assert.deepEqual(verified, [
		{
			work: { id: 'next-current', title: 'Garage reset: sort shelves' },
			field: 'blocker',
			label: 'Blocker',
			value: 'Waiting on storage bins'
		},
		{
			work: { id: 'garage-reset-clear-floor', title: 'Garage reset: clear the floor' },
			field: 'workflow',
			label: 'Workflow',
			value: 'Done'
		}
	]);
	assert.equal(
		verifiedNextEvidenceNote(verified),
		'Garage reset: sort shelves — Blocker: Waiting on storage bins. Garage reset: clear the floor — Workflow: Done.'
	);
	assert.throws(
		() => verifyNextPreparationEvidence([references[1]], workspace, 'next-current'),
		/evidence must include the current work item/u
	);
	assert.throws(
		() => verifyNextPreparationEvidence([{ ...references[0], expectedValue: 'Storage bins arrived' }], workspace, 'next-current'),
		/rejected stale blocker evidence for next-current/u
	);
	assert.throws(
		() => verifyNextPreparationEvidence([{ ...references[0], workId: 'missing-work' }], workspace, 'missing-work'),
		/could not verify work item missing-work/u
	);
	assert.throws(
		() => verifyNextPreparationEvidence(references, [...workspace, workspace[0]], 'next-current'),
		/duplicate workspace evidence/u
	);
	assert.throws(
		() => verifiedNextEvidenceNote([{ ...verified[0], value: 'Unverified', label: 'Status' }]),
		/requires one to three exact facts/u
	);
});

test('a failed repeated preparation preserves the immediately preceding valid draft', async () => {
	const focus = {
		id: NEXT_PREPARATION_RECEIPT_ID,
		focused: true,
		focusVisible: true,
		inViewport: true,
		pulsed: true
	};
	let pageState = editor();
	let failureStage = '';
	let restores = 0;
	const preparedView = (choice, references) => editor({
		editor: { mode: 'custom', choice },
		preview: { blocker: null, nextAction: choice },
		preparationReceipt: preparationReceipt(choice, verifiedFromReferences(references))
	});
	const tool = createPrepareNextActionTool(async (input, invocation) => {
		if (failureStage === 'before-mutation') throw new Error('failed before mutation');
		invocation.markMutated();
		pageState = preparedView(input.choice, input.evidence);
		if (failureStage === 'after-mutation') throw new Error('failed after mutation');
		return {
			changed: true,
			focus: failureStage === 'receipt-validation' ? { ...focus, focused: false } : focus,
			next: pageState
		};
	}, {
		capture: () => structuredClone(pageState),
		restore: (snapshot) => {
			restores += 1;
			pageState = structuredClone(snapshot);
		}
	});
	const prepare = (choice, evidence = [currentEvidenceReference]) => tool.execute({
		choice,
		expectedMode: pageState.editor.mode,
		expectedChoice: pageState.editor.choice,
		evidence
	});

	await prepare('Draft A');
	const validDraftA = structuredClone(pageState);

	failureStage = 'before-mutation';
	await assert.rejects(() => prepare('Draft B'), /failed before mutation/u);
	assert.deepEqual(pageState, validDraftA);
	assert.equal(restores, 0, 'a failure before mutation must not rewrite the valid draft');

	failureStage = 'after-mutation';
	await assert.rejects(() => prepare('Draft B'), /failed after mutation/u);
	assert.deepEqual(pageState, validDraftA);
	assert.equal(restores, 1, 'a provisional mutation must restore its own pre-invocation snapshot');

	failureStage = 'receipt-validation';
	await assert.rejects(
		() => prepare('Draft C'),
		/did not return a verifiable page receipt/u
	);
	assert.deepEqual(pageState, validDraftA);
	assert.equal(restores, 2, 'post-mutation receipt validation must restore the same snapshot');
});

test('Next owns one projection and one unsaved setter without server or navigation authority', () => {
	assert.match(routeSource, /import \{ registerPageTools \} from '\$lib\/webmcp\.mjs';/u);
	assert.match(routeSource, /import \{[\s\S]*?createCurrentNextEditorTool,[\s\S]*?createPrepareNextActionTool,[\s\S]*?nextEditorPageView[\s\S]*?\} from '\.\/next-webmcp\.mjs';/u);
	assert.match(routeSource, /let currentNextEditor = \$derived\.by\(\(\) => \{[\s\S]*?return nextEditorPageView\(\{[\s\S]*?work: \{ id: pack\.id,[\s\S]*?presetChoices: NEXT_ACTION_CHOICES,[\s\S]*?editor:[\s\S]*?preview:[\s\S]*?preparationReceipt: preparationReceipt && preparationToolName === PREPARE_NEXT_ACTION_TOOL_NAME \? preparationReceipt : null,[\s\S]*?canSave:[\s\S]*?busy/u);
	assert.match(routeSource, /function setNextEditorChoice\(nextChoice: string, mode: NextEditorMode,[\s\S]*?choice = nextChoice;[\s\S]*?showingCustom = mode === 'custom';[\s\S]*?customValue = nextChoice/u);
	assert.match(routeSource, /async function prepareNextActionFromWebMcp[\s\S]*?if \(busy\)[\s\S]*?currentNextEditor[\s\S]*?verifyNextPreparationEvidence\([\s\S]*?workflowLabel[\s\S]*?blockerText[\s\S]*?verifiedNextEvidenceNote[\s\S]*?expectedMode[\s\S]*?expectedChoice[\s\S]*?stale[\s\S]*?evidenceNote[\s\S]*?workspaceChanged: false[\s\S]*?requiresHumanSave: true[\s\S]*?const focusReceipt = focusAndPulse\([\s\S]*?requireVisibleFocus: true[\s\S]*?focus: \{ id: NEXT_PREPARATION_RECEIPT_ID, \.\.\.focusReceipt \}[\s\S]*?next: currentNextEditor/u);
	assert.match(routeSource, /stopNextWebMcp = registerPageTools\(document, \[[\s\S]*?createCurrentNextEditorTool\(\(\) => currentNextEditor\),[\s\S]*?createPrepareNextActionTool\(prepareNextActionFromWebMcp, \{[\s\S]*?capture: captureNextPreparationSnapshot,[\s\S]*?restore: restoreNextPreparationSnapshot[\s\S]*?\}\)[\s\S]*?\], \{[\s\S]*?onResult: \(\{ toolName \}\)[\s\S]*?toolName === PREPARE_NEXT_ACTION_TOOL_NAME[\s\S]*?\}\);/u);
	assert.match(routeSource, /return \(\) => \{\s*stopNextWebMcp\?\.\(\);\s*stopNextWebMcp = null;\s*clearPreparation\(\);\s*\};/u);
	assert.doesNotMatch(routeSource, /webMcpReadReceipt|recordNextWebMcpResult|clearFailedNextWebMcpReceipt/u);
	const handler = routeSource.match(/async function prepareNextActionFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(handler, /setPackNextAction|setSelectedWork|saveChoice|goto\(|fetch\(|runPackAction|localStorage|sessionStorage/u);
	assert.match(handler, /stale Next editor state[\s\S]*?invocation\.markMutated\(\);[\s\S]*?setNextEditorChoice/u);
	assert.match(routeSource, /function captureNextPreparationSnapshot[\s\S]*?choice,[\s\S]*?customValue,[\s\S]*?showingCustom,[\s\S]*?preparationReceipt:[\s\S]*?preparationPreviousEditor:[\s\S]*?savedNextReceipt/u);
	assert.match(routeSource, /function restoreNextPreparationSnapshot[\s\S]*?choice = snapshot\.choice;[\s\S]*?customValue = snapshot\.customValue;[\s\S]*?showingCustom = snapshot\.showingCustom;[\s\S]*?preparationReceipt = [\s\S]*?preparationPreviousEditor = [\s\S]*?savedNextReceipt = snapshot\.savedNextReceipt/u);
	assert.match(routeSource, /id=\{NEXT_EDITOR_PREVIEW_ID\}[^>]*data-next-preview/u);
	assert.match(routeSource, /import WebMcpActivityStrip from '\$lib\/WebMcpActivityStrip\.svelte';/u);
	assert.match(routeSource, /Verified evidence[\s\S]*?Status[\s\S]*?Draft — waiting for your approval[\s\S]*?Save[\s\S]*?Not saved/u);
	const preparationCellSource = routeSource.match(/let preparationCells[\s\S]*?\] : \[\]\);/u)?.[0] ?? '';
	assert.doesNotMatch(preparationCellSource, /Work item|Prepared action|Browser agent changed/u);
	assert.doesNotMatch(routeSource, /agentNote/u);
	assert.match(helperSource, /The returned values, not agent prose, are the[\s\S]*?only source for the visible evidence note/u);
	assert.match(helperSource, /Browser agent prepared an unsaved draft\. No workspace data was saved\./u);
	assert.match(routeSource, /Proposed next action<\/span><strong>\{effectiveChoice \|\| 'Not set'\}/u);
	assert.doesNotMatch(routeSource, /<WornPage[^>]*status=\{workTitle\(pack\)\}/u);
	assert.match(routeSource, /<WornPage sectionLabel="Step 3 of 3 · Prepare"[^>]*>[\s\S]*?<dl class="next-work-context" data-next-current-work>[\s\S]*?<dt>Current work<\/dt>[\s\S]*?<dd>\{workTitle\(pack\)\}<\/dd>/u);
	assert.match(routeSource, /\.next-work-context\s*\{[\s\S]*?background: var\(--worn-bg-secondary\);[\s\S]*?border: 1px solid var\(--worn-border-strong\);[\s\S]*?box-sizing: border-box;[\s\S]*?max-inline-size: 100%;[\s\S]*?min-inline-size: 0;[\s\S]*?padding: 12px 14px;/u);
	assert.match(routeSource, /\.next-work-context dd\s*\{[\s\S]*?overflow-wrap: anywhere;/u);
	assert.match(routeSource, /\{#if preparationReceipt && preparationToolName === PREPARE_NEXT_ACTION_TOOL_NAME\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?id=\{NEXT_PREPARATION_RECEIPT_ID\}[\s\S]*?route="next"[\s\S]*?outcome="Draft prepared — waiting for your approval\."[\s\S]*?toolName=\{preparationToolName\}[\s\S]*?cells=\{preparationCells\}/u);
	assert.doesNotMatch(routeSource, /data-webmcp-receipt="next"|webmcp-tool-label/u);
	assert.match(activityStripSource, /WebMCP · \{toolName\}[\s\S]*?webmcp-activity-outcome[\s\S]*?webmcp-activity-evidence/u);
	assert.match(routeSource, /\.next-authority\s*\{\s*margin-block-start:\s*12px;/u);
	assert.match(routeSource, /\.next-action-editor\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/u);
	assert.match(routeSource, /\.next-action-editor > \.demo-field\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;/u);
	assert.match(routeSource, /<div class="demo-inline-form next-action-editor">[\s\S]*?<div class="next-save-actions">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\{#if workItemIssues\(pack\)\.length > 0\}[\s\S]*?<div class="next-item-warnings" data-next-item-warnings>[\s\S]*?<WornAlert tone="warning">\{v\.message\}<\/WornAlert>/u);
	assert.match(routeSource, /\.next-item-warnings\s*\{[\s\S]*?margin-block-start: 16px;[\s\S]*?max-inline-size: 100%;[\s\S]*?min-inline-size: 0;/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-action-editor\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-work-context\s*\{\s*padding: 12px;/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-save-help\s*\{\s*flex: 0 0 auto;/u);
	assert.match(registrationSource, /const registrationController = new AbortController\(\);/u);
	assert.doesNotMatch(helperSource, /modelContext|registerTool|fetch\(|jsonrpc|setPackNextAction|update_pack/u);
});

test('Next approval emits one canonical success notification from the page receipt', () => {
	const mutation = demoClientSource.match(/export async function setPackNextAction\(workId: string\)[\s\S]*?\n\}\n\nfunction cloneState/u)?.[0] ?? '';
	const presentation = routeSource.match(/async function saveChoice\(\)[\s\S]*?\n\t\}\n\n\tasync function focusCandidate/u)?.[0] ?? '';
	assert.ok(mutation);
	assert.ok(presentation);
	assert.doesNotMatch(mutation, /displayToast\(/u);
	assert.equal(presentation.match(/displayToast\(/gu)?.length, 1);
	assert.match(presentation, /const summary = result\?\.receipt\?\.summary[\s\S]*?displayToast\(summary, 'success'\);/u);
});

test('pending next-action approvals use one durable state owner and fail closed when stale', () => {
	assert.match(demoClientSource, /export type PendingNextActionDraft = \{[\s\S]*?workId: string;[\s\S]*?evidence: Array<[\s\S]*?originFingerprint: string;[\s\S]*?source: 'human' \| 'webmcp';/u);
	assert.match(demoClientSource, /export async function savePendingNextActionDraft[\s\S]*?saveBrowserState[\s\S]*?upsertPendingDraft\(state, draft\);/u);
	assert.match(demoClientSource, /export async function discardPendingNextActionDraft[\s\S]*?saveBrowserState[\s\S]*?discardPendingDraft\(state, workId\);/u);
	assert.match(demoClientSource, /export async function setPackNextAction\(workId: string\)[\s\S]*?const written = await saveBrowserState\([\s\S]*?approvePendingDraft\(state, workId,[\s\S]*?nextPath: nextChoiceForwardPath/u);
	assert.doesNotMatch(demoClientSource, /approvePendingNextActionDraft/u);
	assert.match(pendingStateSource, /export function pendingDraftFingerprint[\s\S]*?export function approvePendingDraft[\s\S]*?pendingDraftFingerprint\(state, draft, projectPack\)[\s\S]*?Object\.assign\(pack, nextPath\(pack, draft\.choice\)\);[\s\S]*?discardPendingDraft\(state, workId\);/u);
	assert.match(demoClientSource, /export async function resetDemoSampleState[\s\S]*?resetPersistedState\([\s\S]*?remove: \(\) => localStorage\.removeItem\(STORAGE_KEY\),[\s\S]*?loadSeed: loadSeedState,[\s\S]*?install: replaceDemoState/u);
	assert.match(routeSource, /pendingNextActionDraftFor\(\$demoState, visiblePackId\)[\s\S]*?pendingDraftFingerprint\(\$demoState!, pendingDraft\)/u);
	assert.match(routeSource, /invocation\.markMutated\(\);[\s\S]*?if \(!currentNextEditor\)[\s\S]*?await savePendingNextActionDraft\(pending\);/u);
	assert.match(routeSource, /pendingDraft && pendingDraftStale[\s\S]*?Draft is stale/u);
	assert.match(routeSource, /canSave: Boolean\(effectiveChoice\) && !busy && Boolean\(pendingDraft\) && !pendingDraftStale,[\s\S]*?staleReason: pendingDraftStale \? 'Draft is stale[\s\S]*?No pending draft/u);
	assert.match(routeSource, /disabled=\{busy \|\| !effectiveChoice \|\| !pendingDraft \|\| pendingDraftStale\}/u);
	assert.match(routeSource, /next-authority[\s\S]*?savedNextReceipt \? 'none · completed'[\s\S]*?savedNextReceipt \? 'updated'[\s\S]*?saved and approved by the person/u);
	assert.match(routeSource, /function savedEditorBaseline\(target: DemoPack \| null\): EditorSnapshot[\s\S]*?defaultChoiceFor\(target\)[\s\S]*?NEXT_ACTION_CHOICES/u);
	assert.match(routeSource, /function setHumanNextEditorChoice[\s\S]*?setNextEditorChoice\(boundedChoice, mode\);[\s\S]*?preparationPreviousEditor = savedEditorBaseline\(pack\);/u);
	assert.match(routeSource, /const draft = pendingDraft;[\s\S]*?if \(!draft \|\| !shouldHydratePendingDraft\(\{ preparationInFlight, pendingDraft: draft, visibleWorkId: pack\?\.id \|\| '', preparationReceipt \}\)\) return;[\s\S]*?preparationPreviousEditor = savedEditorBaseline\(pack\);[\s\S]*?preparationFromPending/u);
	assert.match(routeSource, /async function discardPreparation\(\)[\s\S]*?await discardPendingNextActionDraft\(pack\.id\);[\s\S]*?clearPreparation\(\);[\s\S]*?setNextEditorChoice\(previous\.choice, previous\.mode, false\)/u);
	assert.match(routeSource, /let visiblePackId = \$derived\(pack\?\.id \|\| ''\);[\s\S]*?pendingNextActionDraftFor\(\$demoState, visiblePackId\)/u);
	assert.match(routeSource, /\{#if preparationReceipt && preparationToolName === PREPARE_NEXT_ACTION_TOOL_NAME\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?\{:else if pendingDraft\?\.source === 'human'\}[\s\S]*?Draft prepared by you\. Workspace unchanged until you approve Save\./u);
	assert.match(routeSource, /preparationReceipt: preparationReceipt && preparationToolName === PREPARE_NEXT_ACTION_TOOL_NAME \? preparationReceipt : null/u);
	assert.match(routeSource, /preparationToolName = PREPARE_NEXT_ACTION_TOOL_NAME;[\s\S]*?await tick\(\);[\s\S]*?NEXT_PREPARATION_RECEIPT_ID/u);
	assert.match(routeSource, /let preparationInFlight = \$state\(false\);[\s\S]*?shouldHydratePendingDraft\(\{ preparationInFlight/u);
	assert.match(routeSource, /invocation\.markMutated\(\);[\s\S]*?preparationInFlight = true;[\s\S]*?await savePendingNextActionDraft\(pending\);[\s\S]*?preparationInFlight = false;/u);
	assert.match(routeSource, /preparationInFlight: boolean;/u);
	assert.match(routeSource, /preparationToolName,[\s\S]*?preparationInFlight[\s\S]*?preparationInFlight = snapshot\.preparationInFlight;/u);
	assert.equal(routeSource.match(/await setPackNextAction\(/gu)?.length, 1);
	assert.match(routeSource, /const result = pendingDraft[\s\S]*?await setPackNextAction\(pack\.id\)/u);
	assert.match(routeSource, /async function discardPreparation\(\)[\s\S]*?await discardPendingNextActionDraft\(pack\.id\);/u);
	assert.match(layoutSource, /pendingNextActionDrafts\(\$demoState\)[\s\S]*?pendingDraftNavigation[\s\S]*?pendingResumeHref[\s\S]*?Pending \{pendingNavigation\.count\}/u);
	assert.doesNotMatch(routeSource, /localStorage|sessionStorage/u);
	assert.doesNotMatch(reviewerTests, /reload discarded the proposal|reload removed 1\/1 draft/u);
});

test('human and WebMCP next-action editors share one explicit choice-length boundary', () => {
	assert.match(helperSource, /export const NEXT_ACTION_MAX_LENGTH = 200;/u);
	assert.match(helperSource, /choice: \{ type: 'string', minLength: 1, maxLength: NEXT_ACTION_MAX_LENGTH,/u);
	assert.match(helperSource, /expectedChoice: \{ type: 'string', maxLength: NEXT_ACTION_MAX_LENGTH,/u);
	assert.match(helperSource, /if \(choice\.length > NEXT_ACTION_MAX_LENGTH\) throw new TypeError/u);
	assert.match(helperSource, /if \(expectedChoice\.length > NEXT_ACTION_MAX_LENGTH\) throw new TypeError/u);
	assert.match(routeSource, /<WornInput[\s\S]*?id="custom-next-input"[\s\S]*?maxlength=\{NEXT_ACTION_MAX_LENGTH\}[\s\S]*?bind:value=\{choice\}/u);
	assert.match(routeSource, /function setHumanNextEditorChoice\(nextChoice: string, mode: NextEditorMode\) \{[\s\S]*?const boundedChoice = nextChoice\.slice\(0, NEXT_ACTION_MAX_LENGTH\);[\s\S]*?const pendingChoice = boundedChoice\.trim\(\);[\s\S]*?setNextEditorChoice\(boundedChoice, mode\);[\s\S]*?choice: pendingChoice,/u);
});

test('pending draft state operation atomically approves, rejects stale drafts, and discards by exact work id', () => {
	assert.throws(() => pendingDraftFingerprint({}, { workId: 'missing', choice: 'Open', mode: 'preset', evidenceNote: '', evidence: [], originFingerprint: '', source: 'human' }, () => ({})), /find/u);
	const project = (pack) => ({ title: pack.title, workflow: pack.status, blocker: pack.blocker || 'None', next: pack.next || '' });
	const state = { packs: [{ id: 'a', title: 'A', status: 'active', blocker: '', next: 'Open' }, { id: 'b', title: 'B', status: 'blocked', blocker: 'Waiting', next: 'Review' }], pendingNextActionDrafts: [] };
	const draft = { workId: 'a', choice: 'Start', mode: 'preset', evidenceNote: 'A', evidence: [{ workId: 'a', field: 'workflow', expectedValue: 'active' }], originFingerprint: '', source: 'human' };
	draft.originFingerprint = pendingDraftFingerprint(state, draft, project);
	state.pendingNextActionDrafts.push(structuredClone(draft));
	const beforePrepare = structuredClone(state.packs);
	const approved = approvePendingDraft(state, 'a', { projectPack: project, nextPath: (pack, choice) => ({ ...pack, next: choice }) });
	assert.equal(approved.pack.next, 'Start');
	assert.deepEqual(state.pendingNextActionDrafts, []);
	assert.deepEqual(state.packs[1], beforePrepare[1]);
	state.pendingNextActionDrafts.push(structuredClone(draft));
	state.packs[0].status = 'done';
	const beforeStale = structuredClone(state);
	assert.throws(() => approvePendingDraft(state, 'a', { projectPack: project, nextPath: () => ({}) }), /Draft is stale/u);
	assert.deepEqual(state, beforeStale);
	state.pendingNextActionDrafts.push({ ...draft, workId: 'b' });
	discardPendingDraft(state, 'a');
	assert.deepEqual(state.pendingNextActionDrafts.map((item) => item.workId), ['b']);
});

test('pending draft transaction persists atomically and preserves exact hydration state', () => {
	const store = new Map(); let live = { packs: [{ id: 'a', title: 'A', status: 'active', blocker: '', next: 'Open' }], pendingNextActionDrafts: [] }; let writes = 0;
	const persist = (value) => { writes += 1; store.set('state', JSON.stringify(value)); };
	const install = (value) => { live = value; return value; };
	const draft = { workId: 'a', choice: 'Start', mode: 'preset', evidenceNote: 'A', evidence: [], originFingerprint: 'human', source: 'human' };
	cloneMutatePersist({ current: live, clone: structuredClone, mutate: (state) => upsertPendingDraft(state, draft), persist, install });
	assert.equal(writes, 1); assert.deepEqual(live.packs, [{ id: 'a', title: 'A', status: 'active', blocker: '', next: 'Open' }]);
	const hydrated = JSON.parse(store.get('state')); assert.deepEqual(hydrated.pendingNextActionDrafts, [draft]);
	const navigation = pendingDraftNavigation({ pendingNextActionDrafts: [draft, { ...draft, workId: 'b' }] }); assert.deepEqual(navigation, { count: 2, resumeHref: '/next?pack=a' });
	const beforeFailure = structuredClone(live); const bytes = store.get('state');
	assert.throws(() => cloneMutatePersist({ current: live, clone: structuredClone, mutate: (state) => discardPendingDraft(state, 'a'), persist: () => { throw new Error('full'); }, install }), /full/u);
	assert.deepEqual(live, beforeFailure); assert.equal(store.get('state'), bytes);
	const selectedElsewhere = { packs: live.packs, pendingNextActionDrafts: [{ ...draft, workId: 'a' }, { ...draft, workId: 'b' }] };
	restorePendingDraft(selectedElsewhere, 'a', null); assert.deepEqual(selectedElsewhere.pendingNextActionDrafts.map((item) => item.workId), ['b']);
});

test('pending draft persistence preserves order, hydrates, and resets through production helpers', async () => {
	const a = { workId: 'a', choice: 'Start', mode: 'preset', evidenceNote: 'A', evidence: [], originFingerprint: 'a', source: 'human' };
	const b = { ...a, workId: 'b', choice: 'Review', originFingerprint: 'b' };
	let live = { packs: [{ id: 'a', next: 'Open' }, { id: 'b', next: 'Review' }], pendingNextActionDrafts: [structuredClone(a), structuredClone(b)] };
	const before = structuredClone(live); let bytes = JSON.stringify(live); let writes = 0; let removes = 0;
	const persist = (state) => { writes += 1; bytes = JSON.stringify(state); };
	const install = (state) => { live = state; return state; };
	cloneMutatePersist({ current: live, clone: structuredClone, mutate: (state) => upsertPendingDraft(state, { ...a, choice: 'Focus' }), persist, install });
	assert.deepEqual(live.pendingNextActionDrafts.map((draft) => draft.workId), ['a', 'b']);
	restorePendingDraft(live, 'a', before.pendingNextActionDrafts[0]);
	assert.deepEqual(live, before); assert.deepEqual(pendingDraftNavigation(live), { count: 2, resumeHref: '/next?pack=a' });
	const hydrated = hydrateSerializedState(bytes, (state) => assert.ok(Array.isArray(state.packs)));
	assert.deepEqual(hydrated.packs, before.packs);
	await resetPersistedState({ remove: () => { removes += 1; bytes = ''; }, loadSeed: async () => ({ packs: [{ id: 'seed' }], pendingNextActionDrafts: [] }), install });
	assert.equal(removes, 1); assert.deepEqual(live.pendingNextActionDrafts, []); assert.ok(writes === 1);
});

test('pending approval transaction compositions persist atomically and restore exact order', () => {
	const project = (pack) => ({ title: pack.title, workflow: pack.status, blocker: pack.blocker || 'None', next: pack.next || '' });
	const a = { workId: 'a', choice: 'Start', mode: 'preset', evidenceNote: 'A', evidence: [{ workId: 'a', field: 'workflow', expectedValue: 'active' }], originFingerprint: '', source: 'human' };
	const b = { ...a, workId: 'b', choice: 'Review', evidence: [{ workId: 'b', field: 'workflow', expectedValue: 'active' }], originFingerprint: '' };
	let original = { packs: [{ id: 'a', title: 'A', status: 'active', blocker: '', next: 'Open' }, { id: 'b', title: 'B', status: 'active', blocker: '', next: 'Open' }], selectedId: 'b', pendingNextActionDrafts: [a, b] };
	original.pendingNextActionDrafts[0].originFingerprint = pendingDraftFingerprint(original, a, project); original.pendingNextActionDrafts[1].originFingerprint = pendingDraftFingerprint(original, b, project);
	let live = structuredClone(original); let bytes = JSON.stringify(live); let writes = 0; const persist = (state) => { writes += 1; bytes = JSON.stringify(state); }; const install = (state) => { live = state; return state; };
	const approve = (state) => approvePendingDraft(state, 'a', { projectPack: project, nextPath: (pack, choice) => ({ ...pack, next: choice }) });
	cloneMutatePersist({ current: live, clone: structuredClone, mutate: approve, persist, install });
	assert.equal(writes, 1); assert.equal(hydrateSerializedState(bytes, () => {}).packs[0].next, 'Start'); assert.deepEqual(live.pendingNextActionDrafts.map((draft) => draft.workId), ['b']);
	const approved = structuredClone(live); const approvedBytes = bytes; writes = 0;
	assert.throws(() => cloneMutatePersist({ current: original, clone: structuredClone, mutate: approve, persist: () => { writes += 1; throw new Error('full'); }, install }), /full/u);
	assert.equal(writes, 1); assert.deepEqual(live, approved); assert.equal(bytes, approvedBytes);
	const stale = structuredClone(original); stale.packs[0].status = 'done'; writes = 0;
	assert.throws(() => cloneMutatePersist({ current: stale, clone: structuredClone, mutate: approve, persist, install }), /stale/u); assert.equal(writes, 0);
	const priorA = structuredClone(original.pendingNextActionDrafts[0]); live = structuredClone(original); bytes = JSON.stringify(original); writes = 0;
	cloneMutatePersist({ current: live, clone: structuredClone, mutate: (state) => upsertPendingDraft(state, { ...priorA, choice: 'Focus' }), persist, install });
	cloneMutatePersist({ current: live, clone: structuredClone, mutate: (state) => restorePendingDraft(state, 'a', priorA), persist, install });
	assert.equal(writes, 2); assert.deepEqual(live, original); assert.equal(bytes, JSON.stringify(original)); assert.equal(pendingDraftNavigation(live).resumeHref, '/next?pack=a');
});

test('WebMCP prepare transaction keeps a differing-choice human draft from rehydrating provisionally', async () => {
	const human = { workId: 'next-current', choice: 'Review', source: 'human' };
	const original = { choice: 'Review', source: 'human', presenter: 'human', inFlight: false, draft: human };
	let pageState = structuredClone(original); let fail = true; let restores = 0;
	const tool = createPrepareNextActionTool(async (input, invocation) => {
		invocation.markMutated(); pageState = { ...pageState, choice: input.choice, source: 'webmcp', presenter: 'webmcp', inFlight: true, draft: { ...human, choice: input.choice, source: 'webmcp' } };
		assert.equal(shouldHydratePendingDraft({ preparationInFlight: pageState.inFlight, pendingDraft: human, visibleWorkId: 'next-current', preparationReceipt: { preparedAction: input.choice } }), false);
		if (fail) throw new Error('persist failed');
		pageState.inFlight = false;
		return { changed: true, focus: { id: NEXT_PREPARATION_RECEIPT_ID, focused: true, focusVisible: true, inViewport: true, pulsed: true }, next: editor({ editor: { mode: 'preset', choice: input.choice }, preparationReceipt: preparationReceipt(input.choice) }) };
	}, { capture: () => structuredClone(pageState), restore: (snapshot) => { restores += 1; pageState = structuredClone(snapshot); } });
	const input = { choice: 'Focus', expectedMode: 'preset', expectedChoice: 'Review', evidence: [currentEvidenceReference] };
	await assert.rejects(() => tool.execute(input), /persist failed/u); assert.equal(restores, 1); assert.deepEqual(pageState, original);
	fail = false; const result = await tool.execute(input); assert.deepEqual(result.focus, { id: NEXT_PREPARATION_RECEIPT_ID, focused: true, focusVisible: true, inViewport: true, pulsed: true }); assert.equal(restores, 1); assert.equal(pageState.source, 'webmcp'); assert.equal(pageState.choice, 'Focus'); assert.equal(pageState.draft.source, 'webmcp'); assert.equal(pageState.presenter, 'webmcp'); assert.equal(pageState.inFlight, false);
});
