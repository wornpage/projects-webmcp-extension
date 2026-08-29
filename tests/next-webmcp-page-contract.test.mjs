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
	verifyNextPreparationEvidence
} from '../svelte-frontend/src/routes/next/next-webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/next/+page.svelte'), 'utf8');
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
		busy: false
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
	assert.match(tool.description, /unsaved next-action preview/u);
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
	assert.match(routeSource, /let currentNextEditor = \$derived\.by\(\(\) => \{[\s\S]*?return nextEditorPageView\(\{[\s\S]*?work: \{ id: pack\.id,[\s\S]*?presetChoices: NEXT_ACTION_CHOICES,[\s\S]*?editor:[\s\S]*?preview:[\s\S]*?preparationReceipt,[\s\S]*?canSave:[\s\S]*?busy/u);
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
	assert.match(routeSource, /\{#if preparationReceipt\}[\s\S]*?<WebMcpActivityStrip[\s\S]*?id=\{NEXT_PREPARATION_RECEIPT_ID\}[\s\S]*?route="next"[\s\S]*?outcome="Draft prepared — waiting for your approval\."[\s\S]*?toolName=\{preparationToolName\}[\s\S]*?cells=\{preparationCells\}/u);
	assert.doesNotMatch(routeSource, /data-webmcp-receipt="next"|webmcp-tool-label/u);
	assert.match(activityStripSource, /WebMCP · \{toolName\}[\s\S]*?webmcp-activity-outcome[\s\S]*?webmcp-activity-evidence/u);
	assert.match(routeSource, /\.next-authority\s*\{\s*margin-block-start:\s*12px;/u);
	assert.match(routeSource, /\.next-action-editor\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/u);
	assert.match(routeSource, /\.next-action-editor > \.demo-field\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-action-editor\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-save-help\s*\{\s*flex: 0 0 auto;/u);
	assert.match(registrationSource, /const registrationController = new AbortController\(\);/u);
	assert.doesNotMatch(helperSource, /modelContext|registerTool|fetch\(|jsonrpc|setPackNextAction|update_pack/u);
});
