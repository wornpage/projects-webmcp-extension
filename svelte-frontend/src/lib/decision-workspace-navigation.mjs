export const DECISION_WORKSPACE_CONTEXT = 'decision-workspace';
export const DECISION_WORKSPACE_CONTEXT_REASON = "This item remains an explicit open decision. Decision Workspace selects the first open decision in Work's filtered and sorted view.";

const DECIDER_MAX_LENGTH = 200;
const SINGLE_LINE_CONTROL = /\p{Cc}/u;

/** @param {unknown} workId @returns {string} */
export function decisionWorkspaceNextHref(workId) {
	const normalizedId = exactWorkId(workId);
	if (!normalizedId) throw new TypeError('Decision Workspace navigation requires an exact work item id.');
	return `/next?pack=${encodeURIComponent(normalizedId)}&context=${DECISION_WORKSPACE_CONTEXT}`;
}

/**
 * Treat the route marker only as a bounded presentation request. The caller
 * must still verify that the exact loaded pack remains an open decision.
 *
 * @param {unknown} searchParams
 * @returns {string}
 */
export function decisionWorkspaceContextPackId(searchParams) {
	if (!searchParams || typeof /** @type {{ getAll?: unknown }} */ (searchParams).getAll !== 'function') return '';
	const params = /** @type {{ getAll: (name: string) => string[] }} */ (searchParams);
	const contexts = params.getAll('context');
	const workIds = params.getAll('pack');
	if (contexts.length !== 1 || contexts[0] !== DECISION_WORKSPACE_CONTEXT || workIds.length !== 1) return '';
	return exactWorkId(workIds[0]) || '';
}

/** @param {unknown} value @returns {string | null} */
export function decisionWorkspaceContextDecider(value) {
	if (typeof value !== 'string' || SINGLE_LINE_CONTROL.test(value)) return null;
	const normalized = value.trim();
	return normalized && normalized.length <= DECIDER_MAX_LENGTH ? normalized : null;
}

/** @param {unknown} value @returns {string | null} */
export function exactWorkId(value) {
	return typeof value === 'string' && Boolean(value.trim())
		? value
		: null;
}
