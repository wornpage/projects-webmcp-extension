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
	nextEditorPageView
} from '../svelte-frontend/src/routes/next/next-webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/next/+page.svelte'), 'utf8');
const helperSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/next/next-webmcp.mjs'), 'utf8');
const registrationSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/webmcp.mjs'), 'utf8');

const presetChoices = ['Review', 'Open', 'Focus', 'Set Blocker: None', 'Start', 'Finish with proof'];

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
		preparationReceipt: {
			summary: NEXT_PREPARATION_SUMMARY,
			work: { id: 'next-current', title: 'Prepare the garage inventory' },
			agentNote: 'The shelves are blocked until the floor is clear and bins arrive.',
			preparedAction: 'Clear the garage floor',
			workspaceChanged: false,
			requiresHumanSave: true
		}
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
		{ ...prepared, preparationReceipt: { ...prepared.preparationReceipt, agentNote: 'x'.repeat(281) } },
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
		preparationReceipt: {
			summary: NEXT_PREPARATION_SUMMARY,
			work: { id: 'next-current', title: 'Prepare the garage inventory' },
			agentNote: 'The shelves are blocked until the floor is clear and bins arrive.',
			preparedAction: 'Clear the garage floor',
			workspaceChanged: false,
			requiresHumanSave: true
		}
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
	first.preparationReceipt.agentNote = 'Mutated result-only note.';
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
		return {
			changed: true,
			focus: { id: NEXT_PREPARATION_RECEIPT_ID, ...focusProof },
			next: editor({
				editor: { mode: 'custom', choice: input.choice },
				preview: { blocker: null, nextAction: input.choice },
				preparationReceipt: {
					summary: NEXT_PREPARATION_SUMMARY,
					work: { id: 'next-current', title: 'Prepare the garage inventory' },
					agentNote: input.agentNote,
					preparedAction: input.choice,
					workspaceChanged: false,
					requiresHumanSave: true
				}
			})
		};
	});
	assert.equal(tool.name, PREPARE_NEXT_ACTION_TOOL_NAME);
	assert.equal(tool.name, 'prepare_next_action');
	assert.equal(tool.title, 'Prepare next-action preview');
	assert.match(tool.description, /unsaved next-action preview/u);
	assert.match(tool.description, /never saves or writes workspace data/u);
	assert.deepEqual(tool.inputSchema, {
		type: 'object',
		properties: {
			choice: { type: 'string', minLength: 1, maxLength: 200, description: 'Preset label or custom next action to preview.' },
			expectedMode: { type: 'string', enum: ['preset', 'custom'], description: 'Editor mode returned by the latest current-editor read.' },
			expectedChoice: { type: 'string', maxLength: 200, description: 'Editor choice returned by the latest current-editor read.' },
			agentNote: { type: 'string', minLength: 1, maxLength: 280, description: 'Brief user-facing reason for the choice, grounded in the visible page evidence.' }
		},
		required: ['choice', 'expectedMode', 'expectedChoice', 'agentNote'],
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
		agentNote: '  Labels are still waiting on the supplier.  '
	}, { signal: new AbortController().signal });
	assert.deepEqual(calls, [{
		choice: 'Call the supplier',
		expectedMode: 'preset',
		expectedChoice: 'Open',
		agentNote: 'Labels are still waiting on the supplier.'
	}]);
	assert.equal(result.changed, true);
	assert.deepEqual(result.focus, { id: 'next-preparation-receipt', ...focusProof });
	assert.equal(result.next.editor.mode, 'custom');
	assert.equal(result.next.editor.choice, 'Call the supplier');
	assert.equal(result.next.preparationReceipt.agentNote, 'Labels are still waiting on the supplier.');
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
				agentNote: 'Labels are still waiting on the supplier.'
			}),
			/verifiable page receipt/u
		);
	}

	for (const [input, message] of [
		[{}, /requires choice, expectedMode, expectedChoice, and agentNote/u],
		[{ choice: '', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason' }, /choice cannot be empty/u],
		[{ choice: 'Start', expectedMode: 'other', expectedChoice: 'Open', agentNote: 'Reason' }, /expectedMode must be preset or custom/u],
		[{ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason', packId: 'other' }, /accepts only choice, expectedMode, expectedChoice, and agentNote/u],
		[{ choice: 42, expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason' }, /choice must be a string/u],
		[{ choice: 'x'.repeat(201), expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason' }, /choice must be 200 characters or fewer/u],
		[{ choice: 'Line\nbreak', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason' }, /choice cannot contain control characters/u],
		[{ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', agentNote: '' }, /agentNote cannot be empty/u],
		[{ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'x'.repeat(281) }, /agentNote must be 280 characters or fewer/u],
		[{ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Line\nbreak' }, /agentNote cannot contain control characters/u]
	]) {
		await assert.rejects(() => tool.execute(input), message);
	}
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(
		() => tool.execute({ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason' }, { signal: aborted.signal }),
		{ name: 'AbortError' }
	);
	assert.throws(() => createPrepareNextActionTool(null), /next-action preparer/u);

	const mismatched = createPrepareNextActionTool(async () => ({
		changed: true,
		focus: { id: NEXT_PREPARATION_RECEIPT_ID, ...focusProof },
		next: editor({ editor: { mode: 'preset', choice: 'Open' } })
	}));
	await assert.rejects(
		() => mismatched.execute({ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', agentNote: 'Reason' }),
		/did not preserve the prepared choice/u
	);
	assert.throws(
		() => createPrepareNextActionTool(async () => result, { capture: null, restore: () => {} }),
		/preparation transactions require capture and restore functions/u
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
	const preparedView = (choice, agentNote) => editor({
		editor: { mode: 'custom', choice },
		preview: { blocker: null, nextAction: choice },
		preparationReceipt: {
			summary: NEXT_PREPARATION_SUMMARY,
			work: { id: 'next-current', title: 'Prepare the garage inventory' },
			agentNote,
			preparedAction: choice,
			workspaceChanged: false,
			requiresHumanSave: true
		}
	});
	const tool = createPrepareNextActionTool(async (input, invocation) => {
		if (failureStage === 'before-mutation') throw new Error('failed before mutation');
		invocation.markMutated();
		pageState = preparedView(input.choice, input.agentNote);
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
	const prepare = (choice, agentNote) => tool.execute({
		choice,
		expectedMode: pageState.editor.mode,
		expectedChoice: pageState.editor.choice,
		agentNote
	});

	await prepare('Draft A', 'First valid human-review draft.');
	const validDraftA = structuredClone(pageState);

	failureStage = 'before-mutation';
	await assert.rejects(() => prepare('Draft B', 'This attempt fails before mutation.'), /failed before mutation/u);
	assert.deepEqual(pageState, validDraftA);
	assert.equal(restores, 0, 'a failure before mutation must not rewrite the valid draft');

	failureStage = 'after-mutation';
	await assert.rejects(() => prepare('Draft B', 'This attempt fails after mutation.'), /failed after mutation/u);
	assert.deepEqual(pageState, validDraftA);
	assert.equal(restores, 1, 'a provisional mutation must restore its own pre-invocation snapshot');

	failureStage = 'receipt-validation';
	await assert.rejects(
		() => prepare('Draft C', 'This attempt returns an invalid visible receipt.'),
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
	assert.match(routeSource, /async function prepareNextActionFromWebMcp[\s\S]*?if \(busy\)[\s\S]*?currentNextEditor[\s\S]*?expectedMode[\s\S]*?expectedChoice[\s\S]*?stale[\s\S]*?agentNote[\s\S]*?workspaceChanged: false[\s\S]*?requiresHumanSave: true[\s\S]*?const focusReceipt = focusAndPulse\([\s\S]*?requireVisibleFocus: true[\s\S]*?focus: \{ id: NEXT_PREPARATION_RECEIPT_ID, \.\.\.focusReceipt \}[\s\S]*?next: currentNextEditor/u);
	assert.match(routeSource, /stopNextWebMcp = registerPageTools\(document, \[[\s\S]*?createCurrentNextEditorTool\(\(\) => currentNextEditor\),[\s\S]*?createPrepareNextActionTool\(prepareNextActionFromWebMcp, \{[\s\S]*?capture: captureNextPreparationSnapshot,[\s\S]*?restore: restoreNextPreparationSnapshot[\s\S]*?\}\)[\s\S]*?\], \{[\s\S]*?onInvocationError: clearFailedNextWebMcpReceipt,[\s\S]*?onResult: recordNextWebMcpResult[\s\S]*?\}\);/u);
	assert.match(routeSource, /return \(\) => \{\s*stopNextWebMcp\?\.\(\);\s*stopNextWebMcp = null;\s*\};/u);
	const handler = routeSource.match(/async function prepareNextActionFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(handler, /setPackNextAction|setSelectedWork|saveChoice|goto\(|fetch\(|runPackAction|localStorage|sessionStorage/u);
	assert.match(handler, /stale Next editor state[\s\S]*?invocation\.markMutated\(\);[\s\S]*?setNextEditorChoice/u);
	const failureHandler = routeSource.match(/async function clearFailedNextWebMcpReceipt[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(failureHandler, /clearPreparation|preparationPreviousEditor|setNextEditorChoice/u);
	assert.match(routeSource, /function captureNextPreparationSnapshot[\s\S]*?choice,[\s\S]*?customValue,[\s\S]*?showingCustom,[\s\S]*?preparationReceipt:[\s\S]*?preparationPreviousEditor:[\s\S]*?savedNextReceipt/u);
	assert.match(routeSource, /function restoreNextPreparationSnapshot[\s\S]*?choice = snapshot\.choice;[\s\S]*?customValue = snapshot\.customValue;[\s\S]*?showingCustom = snapshot\.showingCustom;[\s\S]*?preparationReceipt = [\s\S]*?preparationPreviousEditor = [\s\S]*?savedNextReceipt = snapshot\.savedNextReceipt/u);
	assert.match(routeSource, /id=\{NEXT_EDITOR_PREVIEW_ID\}[^>]*data-next-preview/u);
	assert.match(routeSource, /<WornReceipt[\s\S]*?id=\{NEXT_PREPARATION_RECEIPT_ID\}[\s\S]*?cells=\{preparationCells\}/u);
	assert.match(routeSource, /Proposed next action<\/span><strong>\{effectiveChoice \|\| 'Not set'\}/u);
	assert.match(routeSource, /\.next-authority\s*\{\s*margin-block-start:\s*12px;/u);
	assert.match(routeSource, /\.next-action-editor\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/u);
	assert.match(routeSource, /\.next-action-editor > \.demo-field\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-action-editor\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/u);
	assert.match(routeSource, /@media \(max-width: 500px\)[\s\S]*?\.next-save-help\s*\{\s*flex: 0 0 auto;/u);
	assert.match(registrationSource, /const registrationController = new AbortController\(\);/u);
	assert.doesNotMatch(helperSource, /modelContext|registerTool|fetch\(|jsonrpc|setPackNextAction|update_pack/u);
});
