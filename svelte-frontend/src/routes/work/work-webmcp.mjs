export const WORK_CURRENT_TOOL_NAME = 'get_current_work_view';
export const WORK_SEARCH_TOOL_NAME = 'show_work_search';

const WORK_STATUSES = new Set(['all', 'active', 'blocked', 'draft', 'done', 'review', 'archived']);
const WORK_SORTS = new Set(['urgency', 'due', 'title', 'status', 'energy', 'recent']);
const WORK_DENSITIES = new Set(['grid', 'card']);
const WORK_DUE_SCOPES = new Set(['all', 'overdue']);
const MAX_SEARCH_LENGTH = 120;

/** @typedef {'grid' | 'card'} WorkDensity */
/** @typedef {{ search: string, appliedSearch: string, status: string, energy: string, area: string, recurrence: string, owner: string, dueUrgency: string, sort: string, hideDone: boolean, focusMode: boolean, density: WorkDensity }} WorkScopeView */
/** @typedef {{ workspace: number, matching: number, shown: number, remaining: number, blocked: number }} WorkCountsView */
/** @typedef {{ id: string, title: string, href: string, workflow: string, owner: string | null, due: string | null, blocker: string | null }} WorkItemView */
/** @typedef {{ scope: WorkScopeView, counts: WorkCountsView, items: WorkItemView[] }} WorkView */
/** @typedef {{ target: 'item', itemId: string, focused: boolean, focusVisible: boolean, inViewport: boolean, pulsed: boolean } | { target: 'search', itemId: null, focused: boolean, focusVisible: boolean, inViewport: boolean, pulsed: boolean }} WorkSearchFocus */
/** @typedef {{ changed: boolean, query: string, focus: WorkSearchFocus, work: WorkView }} WorkSearchReceipt */
/** @typedef {{ summary: string, cells: Array<{ label: string, value: string }>, scopeKey: string }} WorkPresentationReceipt */

/**
 * Project the exact bounded Work view already available to the person. The
 * complete packs never cross the page-tool boundary and every denominator is
 * explicit so expanding, filtering, or changing density cannot hide scope.
 *
 * @param {unknown} input
 * @returns {WorkView | null}
 */
export function workPageView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const scope = workScopeView(candidate.scope);
	const counts = workCountsView(candidate.counts);
	if (!scope || !counts || !Array.isArray(candidate.items)) return null;

	const items = candidate.items.map(workItemPageView);
	if (items.some((item) => item === null)) return null;
	const projectedItems = /** @type {WorkItemView[]} */ (items);
	if (
		new Set(projectedItems.map(({ id }) => id)).size !== projectedItems.length ||
		counts.shown !== projectedItems.length ||
		counts.matching !== counts.shown + counts.remaining ||
		counts.workspace < counts.matching ||
		counts.blocked > counts.matching
	) {
		return null;
	}

	return { scope, counts, items: projectedItems };
}

/** @param {unknown} input @returns {WorkItemView | null} */
export function workItemPageView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const id = normalizedText(candidate.id);
	const title = normalizedText(candidate.title);
	const workflow = normalizedText(candidate.workflow);
	const owner = nullableText(candidate.owner);
	const due = nullableText(candidate.due);
	const blocker = nullableText(candidate.blocker);
	if (!id || !title || !workflow || owner === undefined || due === undefined || blocker === undefined) return null;
	return {
		id,
		title,
		href: `/next?pack=${encodeURIComponent(id)}`,
		workflow,
		owner,
		due,
		blocker
	};
}

/** @param {() => WorkView | null} getWork */
export function createCurrentWorkTool(getWork) {
	if (typeof getWork !== 'function') throw new TypeError('Work WebMCP requires a current-view getter.');
	return {
		name: WORK_CURRENT_TOOL_NAME,
		title: 'Get current Work view',
		description: 'Read the exact filtered, sorted, density-aware, and bounded work-item view currently rendered on Work, including explicit workspace, matching, shown, and remaining counts.',
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
			return cloneWorkView(getWork());
		}
	};
}

/** @param {(query: string) => Promise<WorkSearchReceipt>} showSearch */
export function createShowWorkSearchTool(showSearch) {
	if (typeof showSearch !== 'function') throw new TypeError('Work WebMCP requires a search presenter.');
	return {
		name: WORK_SEARCH_TOOL_NAME,
		title: 'Show Work search',
		description: "Set only Work's visible text search, preserving every other active page filter. This changes page-local presentation, focuses the first result or search field, and never modifies workspace data.",
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					maxLength: MAX_SEARCH_LENGTH,
					description: 'Text to show in Work search. Use an empty string to clear it.'
				}
			},
			required: ['query'],
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
			const query = workSearchInput(input);
			const receipt = workSearchReceipt(await showSearch(query));
			options.signal?.throwIfAborted();
			return receipt;
		}
	};
}

/** @param {unknown} input @returns {WorkScopeView | null} */
function workScopeView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const search = exactSearch(candidate.search);
	const appliedSearch = exactSearch(candidate.appliedSearch);
	const status = normalizedText(candidate.status);
	const energy = normalizedText(candidate.energy);
	const area = normalizedText(candidate.area);
	const recurrence = normalizedText(candidate.recurrence);
	const owner = normalizedText(candidate.owner);
	const dueUrgency = normalizedText(candidate.dueUrgency);
	const sort = normalizedText(candidate.sort);
	const density = normalizedText(candidate.density);
	if (
		search === null || appliedSearch === null || !status || !WORK_STATUSES.has(status) || !energy || !area || !recurrence || !owner ||
		!dueUrgency || !WORK_DUE_SCOPES.has(dueUrgency) || !sort || !WORK_SORTS.has(sort) ||
		!density || !WORK_DENSITIES.has(density) || typeof candidate.hideDone !== 'boolean' || typeof candidate.focusMode !== 'boolean'
	) {
		return null;
	}
	return {
		search,
		appliedSearch,
		status,
		energy,
		area,
		recurrence,
		owner,
		dueUrgency,
		sort,
		hideDone: candidate.hideDone,
		focusMode: candidate.focusMode,
		density: /** @type {WorkDensity} */ (density)
	};
}

/** @param {unknown} input @returns {WorkCountsView | null} */
function workCountsView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const keys = ['workspace', 'matching', 'shown', 'remaining', 'blocked'];
	if (keys.some((key) => !Number.isInteger(candidate[key]) || /** @type {number} */ (candidate[key]) < 0)) return null;
	return {
		workspace: /** @type {number} */ (candidate.workspace),
		matching: /** @type {number} */ (candidate.matching),
		shown: /** @type {number} */ (candidate.shown),
		remaining: /** @type {number} */ (candidate.remaining),
		blocked: /** @type {number} */ (candidate.blocked)
	};
}

/** @param {unknown} input */
function requireEmptyInput(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 0) {
		throw new TypeError('Work current view requires an empty object.');
	}
}

/** @param {unknown} input */
function workSearchInput(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Work search requires an object input.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (Object.keys(candidate).some((key) => key !== 'query')) {
		throw new TypeError('Work search accepts only query.');
	}
	if (typeof candidate.query !== 'string') throw new TypeError('Work search query must be a string.');
	if (/\p{Cc}/u.test(candidate.query)) throw new TypeError('Work search query cannot contain control characters.');
	const query = normalizeWorkSearch(candidate.query);
	if (query === null) throw new TypeError(`Work search query must be ${MAX_SEARCH_LENGTH} characters or fewer.`);
	return query;
}

/**
 * The single public Work-search normalizer. Route-arrival input must fail
 * closed while the page tool reports invalid caller input, so callers decide
 * whether a null result becomes the all-work view or a validation error.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeWorkSearch(value) {
	if (typeof value !== 'string' || /\p{Cc}/u.test(value)) return null;
	const query = value.trim();
	return query.length <= MAX_SEARCH_LENGTH ? query : null;
}

/**
 * Normalize route input without giving a URL any authority beyond Work's
 * local visible search. Invalid input deliberately falls back to all work.
 *
 * @param {unknown} value
 */
export function routeWorkSearch(value) {
	return normalizeWorkSearch(value) ?? '';
}

/**
 * Build the human receipt only from the validated presenter result. This
 * freezes the exact live rendered denominators returned by the canonical Work
 * search setter; later human scope changes invalidate the receipt by scopeKey.
 *
 * @param {unknown} input
 * @returns {WorkPresentationReceipt}
 */
export function workSearchPresentationReceipt(input) {
	const { changed, query, work } = workSearchReceipt(input);
	const queryLabel = query ? `“${query}”` : 'All work · search cleared';
	const summary = query
		? `Browser agent ${changed ? 'set' : 'confirmed'} Work search “${query}”.`
		: changed
			? 'Browser agent cleared Work search to show all work.'
			: 'Browser agent confirmed Work search is clear.';
	return {
		summary,
		cells: [
			{ label: 'Visible query', value: queryLabel },
			{
				label: 'Current scope',
				value: `${work.counts.shown} shown · ${work.counts.matching} matching · ${work.counts.workspace} workspace`
			},
			{ label: 'Browser agent changed', value: 'Visible Work search only' },
			{ label: 'Workspace data', value: 'Unchanged' }
		],
		scopeKey: JSON.stringify({ scope: work.scope, counts: work.counts })
	};
}

/** @param {unknown} input @returns {WorkSearchReceipt} */
function workSearchReceipt(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Work search did not return a verifiable page receipt.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const query = exactSearch(candidate.query);
	const work = cloneWorkView(candidate.work);
	const focus = workSearchFocus(candidate.focus);
	if (
		typeof candidate.changed !== 'boolean' || query === null || !work || !focus ||
		work.scope.search !== query || work.scope.appliedSearch !== query
	) {
		throw new TypeError('Work search did not return a verifiable page receipt.');
	}
	const firstId = work.items[0]?.id ?? null;
	if (
		(focus.target === 'item' && focus.itemId !== firstId) ||
		(focus.target === 'search' && firstId !== null)
	) {
		throw new TypeError('Work search focus did not match the rendered result.');
	}
	return { changed: candidate.changed, query, focus, work };
}

/** @param {unknown} input @returns {WorkSearchFocus | null} */
function workSearchFocus(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (
		candidate.focused !== true || candidate.focusVisible !== true ||
		candidate.inViewport !== true || candidate.pulsed !== true
	) return null;
	const evidence = { focused: true, focusVisible: true, inViewport: true, pulsed: true };
	if (candidate.target === 'search' && candidate.itemId === null) {
		return { target: 'search', itemId: null, ...evidence };
	}
	const itemId = normalizedText(candidate.itemId);
	return candidate.target === 'item' && itemId ? { target: 'item', itemId, ...evidence } : null;
}

/** @param {unknown} view @returns {WorkView | null} */
function cloneWorkView(view) {
	return workPageView(view);
}

/** @param {unknown} value @returns {string | null} */
function exactSearch(value) {
	if (typeof value !== 'string' || value.length > MAX_SEARCH_LENGTH || /\p{Cc}/u.test(value)) return null;
	return value;
}

/** @param {unknown} value @returns {string | null} */
function normalizedText(value) {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text || null;
}

/** @param {unknown} value @returns {string | null | undefined} */
function nullableText(value) {
	return value === null ? null : normalizedText(value) ?? undefined;
}
