export const WEBMCP_CHALLENGE_GUIDE_TOOL_NAME = 'get_webmcp_challenge_guide';

const ALLOWED_ROUTES = new Set(['/work', '/review', '/next']);
const TEXT_LIMIT = 1_000;

/**
 * Validate the exact public guide rendered by the challenge page. The guide
 * contains no workspace data and offers no navigation or write authority.
 *
 * @param {unknown} input
 */
export function webMcpChallengeGuideView(input) {
	if (!isRecord(input) || !Array.isArray(input.steps) || !Array.isArray(input.safety)) return null;
	const title = normalizedText(input.title);
	const purpose = normalizedText(input.purpose);
	const prompt = normalizedText(input.prompt);
	if (!title || !purpose || !prompt || input.steps.length !== 3 || input.safety.length !== 3) return null;

	const steps = input.steps.map((entry, index) => challengeStep(entry, index + 1));
	const safety = input.safety.map(normalizedText);
	if (steps.some((step) => step === null) || safety.some((item) => item === null)) return null;
	const validSteps = /** @type {{ position: number, title: string, description: string, href: string }[]} */ (steps);
	if (new Set(validSteps.map(({ href }) => href)).size !== validSteps.length) return null;

	return {
		title,
		purpose,
		prompt,
		steps: validSteps,
		safety: /** @type {string[]} */ (safety)
	};
}

/** @param {() => unknown} getGuide */
export function createWebMcpChallengeGuideTool(getGuide) {
	if (typeof getGuide !== 'function') throw new TypeError('WebMCP challenge guide requires a current-page getter.');
	return {
		name: WEBMCP_CHALLENGE_GUIDE_TOOL_NAME,
		title: 'Get WebMCP challenge guide',
		description: 'Read the exact public judge guide currently rendered by the WebMCP Challenge page, including its recommended prompt, three safe demo routes, and authority boundaries. This does not navigate, fetch, or write.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
		annotations: {
			readOnlyHint: true,
			openWorldHint: false,
			untrustedContentHint: false
		},
		/** @param {unknown} input @param {{ signal?: AbortSignal }} [options] */
		async execute(input, options = {}) {
			options.signal?.throwIfAborted();
			if (!isRecord(input) || Object.keys(input).length !== 0) {
				throw new TypeError('WebMCP challenge guide accepts only an empty object.');
			}
			const guide = webMcpChallengeGuideView(getGuide());
			if (!guide) throw new TypeError('WebMCP challenge guide is not verifiable.');
			options.signal?.throwIfAborted();
			return guide;
		}
	};
}

/** @param {unknown} input @param {number} position */
function challengeStep(input, position) {
	if (!isRecord(input) || input.position !== position) return null;
	const title = normalizedText(input.title);
	const description = normalizedText(input.description);
	const href = typeof input.href === 'string' && ALLOWED_ROUTES.has(input.href) ? input.href : null;
	return title && description && href ? { position, title, description, href } : null;
}

/** @param {unknown} value */
function normalizedText(value) {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text && text.length <= TEXT_LIMIT && !/\p{Cc}/u.test(text) ? text : null;
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
