import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	emptyWebMcpHandoffSession,
	recordWebMcpHandoffStepState,
	webMcpHandoffSessionView
} from '../svelte-frontend/src/lib/webmcp-handoff-session.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const reducerSource = readSource('svelte-frontend/src/lib/webmcp-handoff-session.mjs');
const storeSource = readSource('svelte-frontend/src/lib/webmcp-handoff-store.ts');
const railSource = readSource('svelte-frontend/src/lib/WebMcpHandoffRail.svelte');
const stripSource = readSource('svelte-frontend/src/lib/WebMcpActivityStrip.svelte');
const layoutSource = readSource('svelte-frontend/src/routes/+layout.svelte');
const workSource = readSource('svelte-frontend/src/routes/work/+page.svelte');
const reviewSource = readSource('svelte-frontend/src/routes/review/+page.svelte');
const nextSource = readSource('svelte-frontend/src/routes/next/+page.svelte');
const guideSource = readSource('svelte-frontend/src/routes/webmcp-challenge/+page.svelte');

const steps = {
	work: {
		id: 'work-scope',
		title: 'Work narrowed',
		summary: '4 matching of 8',
		evidence: '2 blocked · 4 shown',
		authority: 'Page view only · Workspace unchanged'
	},
	review: {
		id: 'review-scope',
		title: 'Review verified',
		summary: '2 shown of 5',
		evidence: '2 blocked · 3 search matches',
		authority: 'Page view only · Workspace unchanged'
	},
	next: {
		id: 'next-proposal',
		title: 'Next prepared',
		summary: 'Unsaved · Confirm storage bin delivery',
		evidence: '2 verified facts · Workspace unchanged',
		authority: 'Human approval required'
	}
};

test('handoff session keeps one canonical clone-safe step per successful page action', () => {
	let session = emptyWebMcpHandoffSession();
	assert.deepEqual(session, { steps: [], agentSaved: 0, agentStarted: 0 });
	session = recordWebMcpHandoffStepState(session, steps.review);
	session = recordWebMcpHandoffStepState(session, steps.work);
	session = recordWebMcpHandoffStepState(session, steps.next);
	assert.deepEqual(session.steps.map(({ id }) => id), ['work-scope', 'review-scope', 'next-proposal']);
	assert.equal(session.agentSaved, 0);
	assert.equal(session.agentStarted, 0);

	const replaced = recordWebMcpHandoffStepState(session, {
		...steps.work,
		summary: '3 matching of 8'
	});
	assert.equal(replaced.steps.length, 3);
	assert.equal(replaced.steps[0].summary, '3 matching of 8');
	replaced.steps[0].summary = 'mutated';
	assert.equal(session.steps[0].summary, '4 matching of 8');
});

test('handoff session rejects false authority, duplicate ids, malformed order, and open input', () => {
	assert.throws(
		() => webMcpHandoffSessionView({ steps: [], agentSaved: 1, agentStarted: 0 }),
		/cannot claim agent-owned Save or Start authority/u
	);
	assert.throws(
		() => webMcpHandoffSessionView({ steps: [steps.work, steps.work], agentSaved: 0, agentStarted: 0 }),
		/step ids must be unique/u
	);
	assert.throws(
		() => webMcpHandoffSessionView({ steps: [steps.review, steps.work], agentSaved: 0, agentStarted: 0 }),
		/canonical order/u
	);
	assert.throws(
		() => recordWebMcpHandoffStepState(emptyWebMcpHandoffSession(), { ...steps.work, extra: true }),
		/unsupported field/u
	);
	assert.throws(
		() => recordWebMcpHandoffStepState(emptyWebMcpHandoffSession(), { ...steps.work, summary: 'x'.repeat(401) }),
		/1 to 400 characters/u
	);
});

test('one shared rail records only successful scoped receipts and reset clears the run', () => {
	assert.match(reducerSource, /'work-scope'[\s\S]*?'review-scope'[\s\S]*?'next-proposal'[\s\S]*?'draft-batch'[\s\S]*?'human-decision'/u);
	assert.doesNotMatch(`${reducerSource}\n${storeSource}`, /localStorage|sessionStorage|fetch\(|apiFetch|goto\(|runPackAction|saveBrowserState/u);
	assert.equal((layoutSource.match(/<WebMcpHandoffRail \/>/gu) ?? []).length, 1);
	assert.match(railSource, /Live WebMCP handoff[\s\S]*?One agent run · visible across pages[\s\S]*?\{steps\.length\} of 5 steps/u);
	assert.match(railSource, /STEP_NUMBERS[\s\S]*?'work-scope': 1[\s\S]*?'review-scope': 2[\s\S]*?'next-proposal': 3[\s\S]*?'draft-batch': 4[\s\S]*?'human-decision': 5/u);
	assert.match(railSource, /Agent authority[\s\S]*?agentSaved[\s\S]*?saved ·[\s\S]*?agentStarted[\s\S]*?started[\s\S]*?Human final decision required/u);
	assert.match(stripSource, /Step 1 · Narrow Work[\s\S]*?Step 2 · Verify Review[\s\S]*?Step 3 · Prepare Next[\s\S]*?Step 4 · Stage Drafts/u);
	assert.match(stripSource, /font-size: 18px;[\s\S]*?font-size: 14px;/u);
	assert.match(workSource, /id: 'work-scope'[\s\S]*?Page view only · Workspace unchanged/u);
	assert.match(workSource, /id: 'draft-batch'[\s\S]*?Draft only · Human Start required[\s\S]*?pendingNextActionDrafts\(\$demoState\)\.find[\s\S]*?if \(pendingWebMcpDraft\)[\s\S]*?id: 'human-decision'[\s\S]*?Only a person can Save or Start/u);
	assert.match(reviewSource, /id: 'review-scope'[\s\S]*?Page view only · Workspace unchanged/u);
	assert.match(nextSource, /id: 'next-proposal'[\s\S]*?Human approval required/u);
	assert.match(nextSource, /wasWebMcpPreparation[\s\S]*?Discarded by person[\s\S]*?Workspace unchanged[\s\S]*?Approved and saved by person[\s\S]*?Human decision completed/u);
	assert.match(guideSource, /await resetDemoSampleState\(\);[\s\S]*?resetWebMcpHandoffSession\(\);[\s\S]*?Live sample reset/u);
});
