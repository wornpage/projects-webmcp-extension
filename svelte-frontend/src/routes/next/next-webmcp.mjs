export const CURRENT_NEXT_EDITOR_TOOL_NAME = 'get_current_next_editor';
export const PREPARE_NEXT_ACTION_TOOL_NAME = 'prepare_next_action';
export const NEXT_EDITOR_PREVIEW_ID = 'next-action-preview';

const SINGLE_LINE_CONTROL = /\p{Cc}/u;
const PREPARE_INPUT_KEYS = ['choice', 'expectedMode', 'expectedChoice'];

/** @typedef {'preset' | 'custom'} NextEditorMode */
/** @typedef {{ id: string, title: string }} NextEditorWork */
/** @typedef {{ mode: NextEditorMode, choice: string }} NextEditorChoice */
/** @typedef {{ blocker: string | null, nextAction: string }} NextEditorPreview */
/** @typedef {{ work: NextEditorWork, presetChoices: string[], editor: NextEditorChoice, preview: NextEditorPreview, canSave: boolean, busy: boolean }} NextEditorView */
/** @typedef {{ choice: string, expectedMode: NextEditorMode, expectedChoice: string }} PrepareNextActionInput */
/** @typedef {{ changed: boolean, focus: { id: string }, next: NextEditorView }} PrepareNextActionReceipt */

/**
 * Project only the current work item, choices, editor state, and preview already
 * rendered on Next. The human-owned Save command is intentionally outside this
 * projection and remains the only workspace mutation path.
 *
 * @param {unknown} input
 * @returns {NextEditorView | null}
 */
export function nextEditorPageView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (typeof candidate.canSave !== 'boolean' || typeof candidate.busy !== 'boolean') return null;
	const work = nextEditorWork(candidate.work);
	const presetChoices = nextEditorPresetChoices(candidate.presetChoices);
	const editor = nextEditorChoice(candidate.editor);
	const preview = nextEditorPreview(candidate.preview);
	if (!work || !presetChoices || !editor || !preview) return null;
	if (editor.mode === 'preset' && (!editor.choice || !presetChoices.includes(editor.choice))) return null;
	if (candidate.canSave !== (Boolean(editor.choice) && !candidate.busy)) return null;
	return {
		work,
		presetChoices,
		editor,
		preview,
		canSave: candidate.canSave,
		busy: candidate.busy
	};
}

/** @param {() => NextEditorView | null} getEditor */
export function createCurrentNextEditorTool(getEditor) {
	if (typeof getEditor !== 'function') throw new TypeError('Next WebMCP requires a current editor getter.');
	return {
		name: CURRENT_NEXT_EDITOR_TOOL_NAME,
		title: 'Get current Next editor',
		description: 'Read the exact current work item, visible choices, unsaved editor, and preview shown on Next. This does not change or save the editor.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false
		},
		annotations: {
			readOnlyHint: true,
			openWorldHint: false,
			untrustedContentHint: true
		},
		/** @param {unknown} input @param {{ signal?: AbortSignal }} [options] */
		async execute(input, options = {}) {
			options.signal?.throwIfAborted();
			requireEmptyInput(input);
			return cloneNextEditorView(getEditor());
		}
	};
}

/** @param {(input: PrepareNextActionInput) => Promise<PrepareNextActionReceipt>} prepareNextAction */
export function createPrepareNextActionTool(prepareNextAction) {
	if (typeof prepareNextAction !== 'function') throw new TypeError('Next WebMCP requires a next-action preparer.');
	return {
		name: PREPARE_NEXT_ACTION_TOOL_NAME,
		title: 'Prepare next-action preview',
		description: 'Prepare an unsaved next-action preview for the current work item using the latest editor state. This changes only reversible page state for a person to review and never saves or writes workspace data.',
		inputSchema: {
			type: 'object',
			properties: {
				choice: { type: 'string', minLength: 1, maxLength: 200, description: 'Preset label or custom next action to preview.' },
				expectedMode: { type: 'string', enum: ['preset', 'custom'], description: 'Editor mode returned by the latest current-editor read.' },
				expectedChoice: { type: 'string', maxLength: 200, description: 'Editor choice returned by the latest current-editor read.' }
			},
			required: ['choice', 'expectedMode', 'expectedChoice'],
			additionalProperties: false
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
			untrustedContentHint: true
		},
		/** @param {unknown} input @param {{ signal?: AbortSignal }} [options] */
		async execute(input, options = {}) {
			options.signal?.throwIfAborted();
			const fields = prepareNextActionInput(input);
			const receipt = prepareNextActionReceipt(await prepareNextAction(fields), fields.choice);
			options.signal?.throwIfAborted();
			return receipt;
		}
	};
}

/** @param {unknown} input @returns {NextEditorWork | null} */
function nextEditorWork(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const id = pageText(candidate.id, 200);
	const title = pageText(candidate.title, 200);
	return id && title ? { id, title } : null;
}

/** @param {unknown} input @returns {string[] | null} */
function nextEditorPresetChoices(input) {
	if (!Array.isArray(input) || input.length === 0) return null;
	const choices = input.map((value) => pageText(value, 200));
	if (choices.some((value) => !value)) return null;
	const normalized = /** @type {string[]} */ (choices);
	return new Set(normalized).size === normalized.length ? normalized : null;
}

/** @param {unknown} input @returns {NextEditorChoice | null} */
function nextEditorChoice(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (candidate.mode !== 'preset' && candidate.mode !== 'custom') return null;
	const choice = pageText(candidate.choice, 200, true);
	return choice === null ? null : { mode: candidate.mode, choice };
}

/** @param {unknown} input @returns {NextEditorPreview | null} */
function nextEditorPreview(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const blocker = candidate.blocker === null ? null : pageText(candidate.blocker, 200);
	const nextAction = pageText(candidate.nextAction, 200);
	if ((candidate.blocker !== null && !blocker) || !nextAction) return null;
	return { blocker, nextAction };
}

/** @param {unknown} input */
function requireEmptyInput(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 0) {
		throw new TypeError('Next current editor requires an empty object.');
	}
}

/** @param {unknown} input @returns {PrepareNextActionInput} */
function prepareNextActionInput(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Prepare next action requires an object input.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const keys = Object.keys(candidate);
	if (keys.some((key) => !PREPARE_INPUT_KEYS.includes(key))) {
		throw new TypeError('Prepare next action accepts only choice, expectedMode, and expectedChoice.');
	}
	if (!PREPARE_INPUT_KEYS.every((key) => Object.hasOwn(candidate, key))) {
		throw new TypeError('Prepare next action requires choice, expectedMode, and expectedChoice.');
	}
	if (typeof candidate.choice !== 'string') throw new TypeError('choice must be a string.');
	if (typeof candidate.expectedChoice !== 'string') throw new TypeError('expectedChoice must be a string.');
	if (candidate.expectedMode !== 'preset' && candidate.expectedMode !== 'custom') {
		throw new TypeError('expectedMode must be preset or custom.');
	}
	if (SINGLE_LINE_CONTROL.test(candidate.choice)) throw new TypeError('choice cannot contain control characters.');
	if (SINGLE_LINE_CONTROL.test(candidate.expectedChoice)) throw new TypeError('expectedChoice cannot contain control characters.');
	const choice = candidate.choice.trim();
	const expectedChoice = candidate.expectedChoice.trim();
	if (!choice) throw new TypeError('choice cannot be empty.');
	if (choice.length > 200) throw new TypeError('choice must be 200 characters or fewer.');
	if (expectedChoice.length > 200) throw new TypeError('expectedChoice must be 200 characters or fewer.');
	return { choice, expectedMode: candidate.expectedMode, expectedChoice };
}

/** @param {unknown} input @param {string} choice @returns {PrepareNextActionReceipt} */
function prepareNextActionReceipt(input, choice) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Prepare next action did not return a verifiable page receipt.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const next = cloneNextEditorView(candidate.next);
	const focus = candidate.focus;
	const expectedMode = next?.presetChoices.includes(choice) ? 'preset' : 'custom';
	if (
		typeof candidate.changed !== 'boolean' || !next || next.busy || !next.canSave ||
		!focus || typeof focus !== 'object' || Array.isArray(focus) ||
		/** @type {Record<string, unknown>} */ (focus).id !== NEXT_EDITOR_PREVIEW_ID
	) {
		throw new TypeError('Prepare next action did not return a verifiable page receipt.');
	}
	if (next.editor.mode !== expectedMode || next.editor.choice !== choice) {
		throw new TypeError('Prepare next action did not preserve the prepared choice.');
	}
	return { changed: candidate.changed, focus: { id: NEXT_EDITOR_PREVIEW_ID }, next };
}

/** @param {unknown} view @returns {NextEditorView | null} */
function cloneNextEditorView(view) {
	return nextEditorPageView(view);
}

/** @param {unknown} value @param {number} limit @param {boolean} [allowEmpty] */
function pageText(value, limit, allowEmpty = false) {
	if (typeof value !== 'string' || value.length > limit || SINGLE_LINE_CONTROL.test(value)) return null;
	if (!allowEmpty && !value) return null;
	return value;
}
