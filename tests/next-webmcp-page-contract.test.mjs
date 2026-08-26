import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	CURRENT_NEXT_EDITOR_TOOL_NAME,
	NEXT_EDITOR_PREVIEW_ID,
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
		canSave: true,
		busy: false
	});
	assert.doesNotMatch(JSON.stringify(view), /not exposed/u);
	assert.notEqual(view.presetChoices, presetChoices);

	for (const malformed of [
		null,
		{},
		{ ...view, work: { id: '', title: view.work.title } },
		{ ...view, presetChoices: [...presetChoices, presetChoices[0]] },
		{ ...view, editor: { mode: 'archive', choice: 'Open' } },
		{ ...view, preview: { blocker: null, nextAction: '' } },
		{ ...view, canSave: 'yes' },
		{ ...view, busy: 'no' }
	]) {
		assert.equal(nextEditorPageView(malformed), null);
	}
});

test('the current-editor descriptor is closed, read-only, untrusted-content aware, and live', async () => {
	let current = editor();
	const tool = createCurrentNextEditorTool(() => current);
	assert.equal(tool.name, CURRENT_NEXT_EDITOR_TOOL_NAME);
	assert.equal(tool.name, 'get_current_next_editor');
	assert.equal(tool.title, 'Get current Next editor');
	assert.match(tool.description, /exact current work item, visible choices, unsaved editor, and preview/u);
	assert.match(tool.description, /does not change or save/u);
	assert.deepEqual(tool.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
	assert.deepEqual(tool.annotations, { readOnlyHint: true, openWorldHint: false, untrustedContentHint: true });
	const first = await tool.execute({}, { signal: new AbortController().signal });
	assert.deepEqual(first, current);
	assert.notEqual(first, current);
	assert.notEqual(first.work, current.work);
	for (const invalid of [undefined, null, [], { unexpected: true }]) {
		await assert.rejects(() => tool.execute(invalid), /Next current editor requires an empty object/u);
	}
	current = null;
	assert.equal(await tool.execute({}), null);
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(() => tool.execute({}, { signal: aborted.signal }), { name: 'AbortError' });
	assert.throws(() => createCurrentNextEditorTool(null), /current editor getter/u);
});

test('the prepare descriptor validates a stale-safe reversible page operation and receipt', async () => {
	const calls = [];
	const tool = createPrepareNextActionTool(async (input) => {
		calls.push(input);
		return {
			changed: true,
			focus: { id: NEXT_EDITOR_PREVIEW_ID },
			next: editor({
				editor: { mode: 'custom', choice: input.choice },
				preview: { blocker: null, nextAction: input.choice }
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
			expectedChoice: { type: 'string', maxLength: 200, description: 'Editor choice returned by the latest current-editor read.' }
		},
		required: ['choice', 'expectedMode', 'expectedChoice'],
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
		expectedChoice: ' Open '
	}, { signal: new AbortController().signal });
	assert.deepEqual(calls, [{ choice: 'Call the supplier', expectedMode: 'preset', expectedChoice: 'Open' }]);
	assert.equal(result.changed, true);
	assert.deepEqual(result.focus, { id: 'next-action-preview' });
	assert.equal(result.next.editor.mode, 'custom');
	assert.equal(result.next.editor.choice, 'Call the supplier');

	for (const [input, message] of [
		[{}, /requires choice, expectedMode, and expectedChoice/u],
		[{ choice: '', expectedMode: 'preset', expectedChoice: 'Open' }, /choice cannot be empty/u],
		[{ choice: 'Start', expectedMode: 'other', expectedChoice: 'Open' }, /expectedMode must be preset or custom/u],
		[{ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open', packId: 'other' }, /accepts only choice, expectedMode, and expectedChoice/u],
		[{ choice: 42, expectedMode: 'preset', expectedChoice: 'Open' }, /choice must be a string/u],
		[{ choice: 'x'.repeat(201), expectedMode: 'preset', expectedChoice: 'Open' }, /choice must be 200 characters or fewer/u],
		[{ choice: 'Line\nbreak', expectedMode: 'preset', expectedChoice: 'Open' }, /choice cannot contain control characters/u]
	]) {
		await assert.rejects(() => tool.execute(input), message);
	}
	const aborted = new AbortController();
	aborted.abort();
	await assert.rejects(
		() => tool.execute({ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open' }, { signal: aborted.signal }),
		{ name: 'AbortError' }
	);
	assert.throws(() => createPrepareNextActionTool(null), /next-action preparer/u);

	const mismatched = createPrepareNextActionTool(async () => ({
		changed: true,
		focus: { id: NEXT_EDITOR_PREVIEW_ID },
		next: editor({ editor: { mode: 'preset', choice: 'Open' } })
	}));
	await assert.rejects(
		() => mismatched.execute({ choice: 'Start', expectedMode: 'preset', expectedChoice: 'Open' }),
		/did not preserve the prepared choice/u
	);
});

test('Next owns one projection and one unsaved setter without server or navigation authority', () => {
	assert.match(routeSource, /import \{ registerPageTools \} from '\$lib\/webmcp\.mjs';/u);
	assert.match(routeSource, /import \{[\s\S]*?createCurrentNextEditorTool,[\s\S]*?createPrepareNextActionTool,[\s\S]*?nextEditorPageView[\s\S]*?\} from '\.\/next-webmcp\.mjs';/u);
	assert.match(routeSource, /let currentNextEditor = \$derived\.by\(\(\) => \{[\s\S]*?return nextEditorPageView\(\{[\s\S]*?work: \{ id: pack\.id,[\s\S]*?presetChoices: NEXT_ACTION_CHOICES,[\s\S]*?editor:[\s\S]*?preview:[\s\S]*?canSave:[\s\S]*?busy/u);
	assert.match(routeSource, /function setNextEditorChoice\(nextChoice: string, mode: NextEditorMode\)[\s\S]*?choice = nextChoice;[\s\S]*?showingCustom = mode === 'custom';[\s\S]*?customValue = nextChoice/u);
	assert.match(routeSource, /async function prepareNextActionFromWebMcp[\s\S]*?if \(busy\)[\s\S]*?currentNextEditor[\s\S]*?expectedMode[\s\S]*?expectedChoice[\s\S]*?stale[\s\S]*?setNextEditorChoice[\s\S]*?await tick\(\)[\s\S]*?focusAndPulse[\s\S]*?next: currentNextEditor/u);
	assert.match(routeSource, /stopNextWebMcp = registerPageTools\(document, \[[\s\S]*?createCurrentNextEditorTool\(\(\) => currentNextEditor\),[\s\S]*?createPrepareNextActionTool\(prepareNextActionFromWebMcp\)[\s\S]*?\]\);/u);
	assert.match(routeSource, /return \(\) => \{\s*stopNextWebMcp\?\.\(\);\s*stopNextWebMcp = null;\s*\};/u);
	const handler = routeSource.match(/async function prepareNextActionFromWebMcp[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.doesNotMatch(handler, /setPackNextAction|setSelectedWork|saveChoice|goto\(|fetch\(|runPackAction/u);
	assert.match(routeSource, /id=\{NEXT_EDITOR_PREVIEW_ID\}[^>]*data-next-preview/u);
	assert.match(registrationSource, /const registrationController = new AbortController\(\);/u);
	assert.doesNotMatch(helperSource, /modelContext|registerTool|fetch\(|jsonrpc|setPackNextAction|update_pack/u);
});
