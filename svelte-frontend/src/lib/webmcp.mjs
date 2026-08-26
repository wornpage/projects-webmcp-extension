/** @typedef {{ registerTool?: (tool: object, options?: { signal?: AbortSignal }) => unknown }} WebMcpModelContext */
/** @typedef {{ modelContext?: WebMcpModelContext }} WebMcpDocument */

/**
 * Register the complete tool set owned by one rendered page. One abort signal
 * owns the set so client-side navigation or any registration failure cannot
 * leave a partial catalog alive. Unsupported browsers retain the ordinary
 * page and do not inspect tools.
 *
 * @param {unknown} documentRef
 * @param {unknown} tools
 * @param {{ onError?: (error: unknown, toolName: string) => void }} [options]
 * @returns {() => void}
 */
export function registerPageTools(documentRef, tools, {
	onError = (error, toolName) => console.error(`WebMCP registration failed for ${toolName}.`, error)
} = {}) {
	const pageDocument = /** @type {WebMcpDocument | null | undefined} */ (documentRef);
	const modelContext = pageDocument?.modelContext;
	if (typeof modelContext?.registerTool !== 'function') return () => {};

	if (!Array.isArray(tools)) throw new TypeError('WebMCP requires an array of tool descriptors.');
	if (tools.length === 0) throw new TypeError('WebMCP requires at least one tool descriptor.');

	const descriptors = tools.map((tool) => {
		if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
			throw new TypeError('WebMCP requires an executable tool descriptor.');
		}
		const descriptor = /** @type {Record<string, unknown>} */ (tool);
		if (typeof descriptor.name !== 'string' || !descriptor.name.trim() || typeof descriptor.execute !== 'function') {
			throw new TypeError('WebMCP requires an executable tool descriptor.');
		}
		return { descriptor, name: descriptor.name.trim() };
	});
	if (new Set(descriptors.map(({ name }) => name)).size !== descriptors.length) {
		throw new TypeError('WebMCP page tool names must be unique tool names.');
	}

	const registrationController = new AbortController();
	/** @param {unknown} error @param {string} toolName */
	const failPageRegistration = (error, toolName) => {
		if (registrationController.signal.aborted) return;
		registrationController.abort();
		onError(error, toolName);
	};
	for (const { descriptor, name } of descriptors) {
		try {
			void Promise.resolve(modelContext.registerTool(descriptor, {
				signal: registrationController.signal
			})).catch((error) => failPageRegistration(error, name));
		} catch (error) {
			failPageRegistration(error, name);
			break;
		}
	}

	return () => registrationController.abort();
}
