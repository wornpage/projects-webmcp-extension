import assert from 'node:assert/strict';
import test from 'node:test';

import {
	normalizeBoundedText,
	normalizeWorkTitle,
	WORK_TITLE_MAX_LENGTH
} from '../svelte-frontend/src/lib/canonical-text.mjs';
import {
	DEMO_STATE_SCHEMA_VERSION,
	nextStateEnvelope,
	readStateEnvelope
} from '../svelte-frontend/src/lib/browser-state-envelope.mjs';
import { normalizeText } from '../svelte-frontend/src/lib/workflow-rules.mjs';
import {
	createWorkDraftsTool,
	workDraftInput
} from '../svelte-frontend/src/routes/work/work-webmcp.mjs';

const assertState = (value) => {
	assert.ok(value && typeof value === 'object' && Array.isArray(value.packs));
};
const migrateLegacyState = (state) => structuredClone(state);

function revisions(...values) {
	let index = 0;
	return () => values[index++];
}

function draftReceipt(input) {
	return {
		created: input.drafts.map((draft, index) => ({ id: `unicode-${index}`, title: draft.title, status: 'draft' })),
		workspaceBefore: input.expectedWorkspaceCount,
		workspaceAfter: input.expectedWorkspaceCount + input.drafts.length,
		workspaceChanged: true,
		requiresHumanStart: true,
		focus: { id: 'work-webmcp-activity', focused: true, focusVisible: true, inViewport: true, pulsed: true }
	};
}

test('canonical title validation stores the same NFC Unicode value that WebMCP validates', async () => {
	const combining = 'Cafe\u0301';
	const canonical = 'Caf\u00e9';
	assert.equal(normalizeWorkTitle(combining), canonical);
	assert.equal(workDraftInput({ expectedWorkspaceCount: 0, drafts: [{ title: combining }] }).drafts[0].title, canonical);
	assert.equal(normalizeWorkTitle('Ship 🚀'), 'Ship 🚀');
	assert.equal(normalizeWorkTitle('Review 🇺🇸 launch'), 'Review 🇺🇸 launch');

	const exactBoundary = `${'a'.repeat(199)}🚀`;
	assert.equal([...exactBoundary].length, WORK_TITLE_MAX_LENGTH);
	assert.equal(normalizeWorkTitle(exactBoundary), exactBoundary);
	assert.equal(normalizeText(exactBoundary, WORK_TITLE_MAX_LENGTH), exactBoundary);
	assert.equal(normalizeBoundedText(`${'a'.repeat(200)}🚀`, WORK_TITLE_MAX_LENGTH), null);

	let commits = 0;
	const tool = createWorkDraftsTool(async (input) => {
		commits += 1;
		return draftReceipt(input);
	});
	const receipt = await tool.execute({ expectedWorkspaceCount: 0, drafts: [{ title: exactBoundary }] });
	assert.equal(receipt.created[0].title, exactBoundary);
	await assert.rejects(
		tool.execute({ expectedWorkspaceCount: 1, drafts: [{ title: `${'a'.repeat(200)}🚀` }] }),
		TypeError
	);
	assert.equal(commits, 1, 'the overlong title is rejected before the persistence callback');
});

test('NFC-equivalent WebMCP titles collide before any draft transaction', async () => {
	let commits = 0;
	const tool = createWorkDraftsTool(async (input) => {
		commits += 1;
		return draftReceipt(input);
	});
	await assert.rejects(tool.execute({
		expectedWorkspaceCount: 0,
		drafts: [{ title: 'Cafe\u0301' }, { title: 'Caf\u00e9' }]
	}), /titles must be unique/u);
	assert.equal(commits, 0);
});

test('legacy raw DemoState hydrates once into the strict v1 revision envelope without data loss', () => {
	const legacy = {
		packs: [{ id: 'legacy', title: 'Legacy 🚀', status: 'active', memory: ['kept'] }],
		selectedId: 'legacy',
		status: 'Existing browser state'
	};
	const migrated = readStateEnvelope(JSON.stringify(legacy), {
		assertState,
		migrateLegacyState,
		createRevision: revisions('revision-migrated')
	});
	assert.equal(migrated.migrated, true);
	assert.deepEqual(migrated.envelope, {
		schemaVersion: DEMO_STATE_SCHEMA_VERSION,
		revision: 'revision-migrated',
		state: legacy
	});

	const hydrated = readStateEnvelope(JSON.stringify(migrated.envelope), {
		assertState,
		migrateLegacyState,
		createRevision: revisions('unused')
	});
	assert.equal(hydrated.migrated, false);
	assert.deepEqual(hydrated.envelope, migrated.envelope);
	assert.throws(() => readStateEnvelope(JSON.stringify({ ...migrated.envelope, schemaVersion: 2 }), {
		assertState,
		migrateLegacyState,
		createRevision: revisions('unused')
	}), /unsupported schema version/u);
});

test('explicit revisions rotate on success and a stale tab cannot overwrite the winner', () => {
	const stateA = { packs: [{ id: 'a', title: 'A' }] };
	const stateB = { packs: [{ id: 'b', title: 'B' }] };
	const stateC = { packs: [{ id: 'c', title: 'C' }] };
	const options = { assertState, migrateLegacyState };

	const first = nextStateEnvelope({
		...options,
		serialized: null,
		expectedRevision: null,
		state: stateA,
		createRevision: revisions('revision-a')
	});
	const second = nextStateEnvelope({
		...options,
		serialized: JSON.stringify(first),
		expectedRevision: 'revision-a',
		state: stateB,
		createRevision: revisions('revision-b')
	});
	const winner = JSON.stringify(second);

	assert.throws(() => nextStateEnvelope({
		...options,
		serialized: winner,
		expectedRevision: 'revision-a',
		state: stateC,
		createRevision: revisions('revision-c')
	}), /revision conflict/u);
	assert.deepEqual(JSON.parse(winner), second, 'the conflict path performs no overwrite');

	const third = nextStateEnvelope({
		...options,
		serialized: winner,
		expectedRevision: 'revision-b',
		state: stateC,
		createRevision: revisions('revision-c')
	});
	assert.equal(third.revision, 'revision-c');
	assert.notEqual(third.revision, second.revision);
	assert.deepEqual(third.state, stateC);
});
