export const WEBMCP_HANDOFF_STEP_IDS = Object.freeze([
	'work-scope',
	'review-scope',
	'next-proposal',
	'draft-batch',
	'human-decision'
]);

const STEP_ORDER = new Map(WEBMCP_HANDOFF_STEP_IDS.map((id, index) => [id, index]));
const STEP_FIELDS = new Set(['id', 'title', 'summary', 'evidence', 'authority']);

/** @returns {{ steps: Array<{ id: string, title: string, summary: string, evidence: string, authority: string }>, agentSaved: 0, agentStarted: 0 }} */
export function emptyWebMcpHandoffSession() {
	return { steps: [], agentSaved: 0, agentStarted: 0 };
}

/**
 * @param {{ steps?: unknown, agentSaved?: unknown, agentStarted?: unknown }} session
 * @param {unknown} input
 */
export function recordWebMcpHandoffStepState(session, input) {
	const current = webMcpHandoffSessionView(session);
	const step = webMcpHandoffStep(input);
	const steps = current.steps
		.filter((candidate) => candidate.id !== step.id)
		.concat(step)
		.sort((left, right) => stepOrder(left.id) - stepOrder(right.id));
	return { steps, agentSaved: 0, agentStarted: 0 };
}

/** @param {{ steps?: unknown, agentSaved?: unknown, agentStarted?: unknown }} input */
export function webMcpHandoffSessionView(input) {
	if (!input || typeof input !== 'object' || !Array.isArray(input.steps)) {
		throw new TypeError('WebMCP handoff session requires a steps array.');
	}
	if (input.agentSaved !== 0 || input.agentStarted !== 0) {
		throw new TypeError('WebMCP handoff session cannot claim agent-owned Save or Start authority.');
	}
	const steps = input.steps.map(webMcpHandoffStep);
	if (new Set(steps.map(({ id }) => id)).size !== steps.length) {
		throw new TypeError('WebMCP handoff session step ids must be unique.');
	}
	for (let index = 1; index < steps.length; index += 1) {
		if (stepOrder(steps[index - 1].id) >= stepOrder(steps[index].id)) {
			throw new TypeError('WebMCP handoff session steps must use canonical order.');
		}
	}
	return {
		steps: steps.map((step) => ({ ...step })),
		agentSaved: 0,
		agentStarted: 0
	};
}

/** @param {string} id */
function stepOrder(id) {
	const order = STEP_ORDER.get(id);
	if (order === undefined) throw new TypeError('WebMCP handoff step id is not recognized.');
	return order;
}

/** @param {unknown} input */
function webMcpHandoffStep(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('WebMCP handoff step requires an object.');
	}
	const candidate = /** @type {Record<string, unknown>} */ (input);
	if (Object.keys(candidate).some((key) => !STEP_FIELDS.has(key))) {
		throw new TypeError('WebMCP handoff step contains an unsupported field.');
	}
	const id = normalizedText(candidate.id, 'id', 40);
	if (!STEP_ORDER.has(id)) throw new TypeError('WebMCP handoff step id is not recognized.');
	return {
		id,
		title: normalizedText(candidate.title, 'title', 80),
		summary: normalizedText(candidate.summary, 'summary', 400),
		evidence: normalizedText(candidate.evidence, 'evidence', 1000),
		authority: normalizedText(candidate.authority, 'authority', 120)
	};
}

/** @param {unknown} value @param {string} field @param {number} maxLength */
function normalizedText(value, field, maxLength) {
	if (typeof value !== 'string') throw new TypeError(`WebMCP handoff ${field} must be text.`);
	const text = value.trim().replace(/\s+/gu, ' ');
	if (!text || text.length > maxLength) {
		throw new TypeError(`WebMCP handoff ${field} must contain 1 to ${maxLength} characters.`);
	}
	return text;
}
