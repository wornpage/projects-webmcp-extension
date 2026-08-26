import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { registerPageTools } from '../svelte-frontend/src/lib/webmcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function descriptor(name) {
	return {
		name,
		description: `Test ${name}`,
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
		execute: async () => ({ name })
	};
}

test('unsupported browsers retain the ordinary page without reading or registering tools', () => {
	let reads = 0;
	const tools = [{
		get name() {
			reads += 1;
			return 'should-not-register';
		}
	}];
	const cleanup = registerPageTools({}, tools);
	assert.equal(typeof cleanup, 'function');
	cleanup();
	assert.equal(reads, 0);
});

test('one page lifecycle signal owns every route tool registration', async () => {
	const registrations = [];
	const documentRef = {
		modelContext: {
			registerTool(tool, options) {
				registrations.push({ tool, options });
				return Promise.resolve();
			}
		}
	};
	const errors = [];
	const cleanup = registerPageTools(
		documentRef,
		[descriptor('read-current-view'), descriptor('change-current-view')],
		{ onError: (error, tool) => errors.push({ error, tool }) }
	);

	assert.deepEqual(registrations.map(({ tool }) => tool.name), ['read-current-view', 'change-current-view']);
	assert.ok(registrations.every(({ options }) => options.signal instanceof AbortSignal));
	assert.equal(registrations[0].options.signal, registrations[1].options.signal);
	assert.equal(registrations[0].options.signal.aborted, false);
	cleanup();
	cleanup();
	assert.equal(registrations[0].options.signal.aborted, true);
	await Promise.resolve();
	assert.deepEqual(errors, []);
});

test('teardown suppresses pending registration failures while live failures retain tool identity', async () => {
	let rejectPending;
	const pendingErrors = [];
	const cleanup = registerPageTools({
		modelContext: {
			registerTool() {
				return new Promise((_resolve, reject) => { rejectPending = reject; });
			}
		}
	}, [descriptor('pending-tool')], {
		onError: (error, tool) => pendingErrors.push({ error, tool })
	});
	cleanup();
	rejectPending(new Error('registration ended during teardown'));
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(pendingErrors, []);

	const liveFailure = new Error('live registration failure');
	const liveErrors = [];
	registerPageTools({
		modelContext: { registerTool: () => Promise.reject(liveFailure) }
	}, [descriptor('live-tool')], {
		onError: (error, tool) => liveErrors.push({ error, tool })
	});
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(liveErrors, [{ error: liveFailure, tool: 'live-tool' }]);

	const syncFailure = new Error('synchronous registration failure');
	const syncErrors = [];
	registerPageTools({
		modelContext: { registerTool: () => { throw syncFailure; } }
	}, [descriptor('sync-tool')], {
		onError: (error, tool) => syncErrors.push({ error, tool })
	});
	assert.deepEqual(syncErrors, [{ error: syncFailure, tool: 'sync-tool' }]);
});

test('a synchronous mixed-registration failure aborts the whole page catalog and stops later registrations', () => {
	const active = new Set();
	const attempted = [];
	const errors = [];
	const failure = new Error('second registration failed');
	const cleanup = registerPageTools({
		modelContext: {
			registerTool(tool, { signal }) {
				attempted.push(tool.name);
				if (tool.name === 'second-tool') throw failure;
				active.add(tool.name);
				signal.addEventListener('abort', () => active.delete(tool.name), { once: true });
				return Promise.resolve();
			}
		}
	}, [descriptor('first-tool'), descriptor('second-tool'), descriptor('third-tool')], {
		onError: (error, tool) => errors.push({ error, tool })
	});

	assert.deepEqual(attempted, ['first-tool', 'second-tool']);
	assert.deepEqual([...active], []);
	assert.deepEqual(errors, [{ error: failure, tool: 'second-tool' }]);
	cleanup();
});

test('an asynchronous mixed-registration failure aborts the whole page catalog and reports only its first live failure', async () => {
	const active = new Set();
	const registrations = [];
	const errors = [];
	const secondFailure = new Error('second registration rejected');
	const thirdFailure = new Error('third registration rejected after the catalog failed');
	const cleanup = registerPageTools({
		modelContext: {
			registerTool(tool, { signal }) {
				registrations.push({ tool: tool.name, signal });
				active.add(tool.name);
				signal.addEventListener('abort', () => active.delete(tool.name), { once: true });
				if (tool.name === 'second-tool') return Promise.reject(secondFailure);
				if (tool.name === 'third-tool') return Promise.reject(thirdFailure);
				return Promise.resolve();
			}
		}
	}, [descriptor('first-tool'), descriptor('second-tool'), descriptor('third-tool')], {
		onError: (error, tool) => errors.push({ error, tool })
	});

	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(registrations.length, 3);
	assert.equal(new Set(registrations.map(({ signal }) => signal)).size, 1);
	assert.equal(registrations[0].signal.aborted, true);
	assert.deepEqual([...active], []);
	assert.deepEqual(errors, [{ error: secondFailure, tool: 'second-tool' }]);
	cleanup();
});

test('invalid descriptor collections fail loudly instead of registering a partial catalog', () => {
	const documentRef = { modelContext: { registerTool() { throw new Error('must not register'); } } };
	assert.throws(() => registerPageTools(documentRef, null), /array of tool descriptors/u);
	assert.throws(() => registerPageTools(documentRef, []), /at least one tool descriptor/u);
	assert.throws(() => registerPageTools(documentRef, [descriptor('duplicate'), descriptor('duplicate')]), /unique tool names/u);
	assert.throws(() => registerPageTools(documentRef, [{ name: 'missing-execute' }]), /executable tool descriptor/u);
});
