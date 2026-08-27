export const REVIEW_CURRENT_TOOL_NAME = 'get_current_review_queue';
export const REVIEW_SCOPE_TOOL_NAME = 'set_review_scope';

const REVIEW_FILTERS = new Set(['all', 'blocked', 'missing-next', 'owner-gap']);
const MAX_ATTENTION_REASONS = 4;
const MAX_REASON_LENGTH = 240;

/** @typedef {'all' | 'blocked' | 'missing-next' | 'owner-gap'} ReviewFilter */
/** @typedef {{ id: string, title: string, href: string, workflow: string, owner: string, due: string | null, blocker: string | null, attentionReasons: string[] }} ReviewItemView */
/** @typedef {{ totalReview: number, searchMatches: number, filtered: number, shown: number, remaining: number, blocked: number, missingNext: number, missingOwner: number }} ReviewCounts */
/** @typedef {{ scope: { query: string, filter: ReviewFilter }, availableFilters: ReviewFilter[], counts: ReviewCounts, upNext: ReviewItemView | null, items: ReviewItemView[] }} ReviewView */
/** @typedef {{ target: 'item', itemId: string, focused: boolean, focusVisible: boolean, inViewport: boolean, pulsed: boolean } | { target: 'search' | 'queue', itemId: null, focused: boolean, focusVisible: boolean, inViewport: boolean, pulsed: boolean }} ReviewScopeFocus */
/** @typedef {{ changed: boolean, focus: ReviewScopeFocus, review: ReviewView }} ReviewScopeReceipt */

/**
 * Project the exact bounded queue already rendered by Review. Raw packs,
 * memory, purpose, sources, and mutation payloads never cross this boundary.
 *
 * @param {unknown} input
 * @returns {ReviewView | null}
 */
export function reviewPageView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const scope = reviewScope(candidate.scope);
	const counts = reviewCounts(candidate.counts);
	if (!scope || !counts || !Array.isArray(candidate.availableFilters) || !Array.isArray(candidate.items)) {
		return null;
	}

	const availableFilters = candidate.availableFilters.map(reviewFilter);
	if (
		availableFilters.some((filter) => filter === null) ||
		new Set(availableFilters).size !== availableFilters.length ||
		!availableFilters.includes('all') ||
		!availableFilters.includes(scope.filter)
	) {
		return null;
	}

	const upNext = candidate.upNext === null ? null : reviewItemPageView(candidate.upNext);
	const items = candidate.items.map(reviewItemPageView);
	if ((candidate.upNext !== null && !upNext) || items.some((item) => item === null)) return null;

	const projectedItems = /** @type {ReviewItemView[]} */ (items);
	const shownIds = [upNext?.id, ...projectedItems.map((item) => item.id)].filter(Boolean);
	if (
		new Set(shownIds).size !== shownIds.length ||
		counts.shown !== projectedItems.length + (upNext ? 1 : 0) ||
		counts.filtered !== counts.shown + counts.remaining ||
		counts.searchMatches < counts.filtered ||
		counts.totalReview < counts.searchMatches ||
		counts.blocked > counts.searchMatches ||
		counts.missingNext > counts.searchMatches ||
		counts.missingOwner > counts.searchMatches
	) {
		return null;
	}

	return {
		scope,
		availableFilters: /** @type {ReviewFilter[]} */ (availableFilters),
		counts,
		upNext,
		items: projectedItems
	};
}

/** @param {unknown} input @returns {ReviewItemView | null} */
export function reviewItemPageView(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const id = normalizedText(candidate.id);
	const title = normalizedText(candidate.title);
	const workflow = normalizedText(candidate.workflow);
	const owner = normalizedText(candidate.owner);
	const due = nullableText(candidate.due);
	const blocker = nullableText(candidate.blocker);
	const attentionReasons = reviewAttentionReasons(candidate.attentionReasons);
	if (!id || !title || !workflow || !owner || due === undefined || blocker === undefined || !attentionReasons) return null;
	return {
		id,
		title,
		href: `/next?pack=${encodeURIComponent(id)}`,
		workflow,
		owner,
		due,
		blocker,
		attentionReasons
	};
}

/** @param {unknown} input @returns {string[] | null} */
function reviewAttentionReasons(input) {
	if (!Array.isArray(input) || input.length < 1 || input.length > MAX_ATTENTION_REASONS) return null;
	const reasons = input.map((value) => {
		if (typeof value !== 'string' || value.length > MAX_REASON_LENGTH || /\p{Cc}/u.test(value)) return null;
		const text = value.trim();
		return text || null;
	});
	if (reasons.some((reason) => reason === null)) return null;
	const normalized = /** @type {string[]} */ (reasons);
	return new Set(normalized).size === normalized.length ? normalized : null;
}

/** @param {() => ReviewView | null} getReview */
export function createCurrentReviewTool(getReview) {
	if (typeof getReview !== 'function') throw new TypeError('Review WebMCP requires a queue getter.');
	return {
		name: REVIEW_CURRENT_TOOL_NAME,
		title: 'Get current review queue',
		description: 'Read the bounded work queue currently rendered on Review, including explicit total, filtered, shown, and remaining counts.',
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
			return cloneReviewView(getReview());
		}
	};
}

/** @param {(scope: { query: string, filter: ReviewFilter }) => Promise<ReviewScopeReceipt>} setScope */
export function createSetReviewScopeTool(setScope) {
	if (typeof setScope !== 'function') throw new TypeError('Review WebMCP requires a scope setter.');
	return {
		name: REVIEW_SCOPE_TOOL_NAME,
		title: 'Set review scope',
		description: "Set Review's page-local search and queue filter. This changes only the current page scope and does not modify workspace data.",
		inputSchema: {
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
			const scope = reviewScopeInput(input);
			const receipt = await setScope(scope);
			options.signal?.throwIfAborted();
			return reviewScopeReceipt(receipt);
		}
	};
}

/** @param {unknown} input */
function requireEmptyInput(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 0) {
		throw new TypeError('Review current queue requires an empty object.');
	}
}

/** @param {unknown} input @returns {{ query: string, filter: ReviewFilter }} */
function reviewScopeInput(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Review scope requires an object input.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const allowedKeys = new Set(['query', 'filter']);
	if (Object.keys(candidate).some((key) => !allowedKeys.has(key))) {
		throw new TypeError('Review scope accepts only query and filter.');
	}
	if (typeof candidate.query !== 'string') throw new TypeError('Review query must be a string.');
	const filter = reviewFilter(candidate.filter);
	if (!filter) throw new TypeError('Review filter must be all, blocked, missing-next, or owner-gap.');
	return { query: candidate.query, filter };
}

/** @param {unknown} input @returns {ReviewScopeReceipt} */
function reviewScopeReceipt(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Review did not return a verifiable page receipt.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const review = cloneReviewView(candidate.review);
	const focus = reviewScopeFocus(candidate.focus);
	if (typeof candidate.changed !== 'boolean' || !review || !focus) {
		throw new TypeError('Review did not return a verifiable page receipt.');
	}
	const expectedItemId = review.upNext?.id ?? null;
	const focusMatches = expectedItemId
		? focus.target === 'item' && focus.itemId === expectedItemId
		: review.counts.totalReview > 1 || review.scope.filter !== 'all'
			? focus.target === 'search' && focus.itemId === null
			: focus.target === 'queue' && focus.itemId === null;
	if (!focusMatches) throw new TypeError('Review scope focus did not match the rendered destination.');
	return { changed: candidate.changed, focus, review };
}

/** @param {unknown} input @returns {ReviewScopeFocus | null} */
function reviewScopeFocus(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (
		candidate.focused !== true || candidate.focusVisible !== true ||
		candidate.inViewport !== true || candidate.pulsed !== true
	) return null;
	const evidence = { focused: true, focusVisible: true, inViewport: true, pulsed: true };
	if ((candidate.target === 'search' || candidate.target === 'queue') && candidate.itemId === null) {
		return { target: candidate.target, itemId: null, ...evidence };
	}
	const itemId = normalizedText(candidate.itemId);
	return candidate.target === 'item' && itemId ? { target: 'item', itemId, ...evidence } : null;
}

/** @param {unknown} input @returns {{ query: string, filter: ReviewFilter } | null} */
function reviewScope(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (typeof candidate.query !== 'string') return null;
	const filter = reviewFilter(candidate.filter);
	return filter ? { query: candidate.query, filter } : null;
}

/** @param {unknown} input @returns {ReviewCounts | null} */
function reviewCounts(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const candidate = /** @type {Record<string, unknown>} */ (input);
	const keys = ['totalReview', 'searchMatches', 'filtered', 'shown', 'remaining', 'blocked', 'missingNext', 'missingOwner'];
	if (keys.some((key) => !Number.isInteger(candidate[key]) || /** @type {number} */ (candidate[key]) < 0)) return null;
	return /** @type {ReviewCounts} */ ({
		totalReview: candidate.totalReview,
		searchMatches: candidate.searchMatches,
		filtered: candidate.filtered,
		shown: candidate.shown,
		remaining: candidate.remaining,
		blocked: candidate.blocked,
		missingNext: candidate.missingNext,
		missingOwner: candidate.missingOwner
	});
}

/** @param {unknown} value @returns {ReviewFilter | null} */
function reviewFilter(value) {
	return typeof value === 'string' && REVIEW_FILTERS.has(value) ? /** @type {ReviewFilter} */ (value) : null;
}

/** @param {unknown} view @returns {ReviewView | null} */
function cloneReviewView(view) {
	return reviewPageView(view);
}

/** @param {unknown} value */
function normalizedText(value) {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text || null;
}

/** @param {unknown} value @returns {string | null | undefined} */
function nullableText(value) {
	if (value === null || value === undefined || value === '') return null;
	return typeof value === 'string' ? value.trim() || null : undefined;
}
