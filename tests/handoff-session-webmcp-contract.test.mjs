import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	emptyWebMcpHandoffSession,
	recordWebMcpHandoffStepState
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
		summary: '4 matching of 8'
	},
	review: {
		id: 'review-scope',
		title: 'Review verified',
		summary: '2 shown of 5'
	},
	next: {
		id: 'next-proposal',
		title: 'Next prepared',
		summary: 'Unsaved · Confirm storage bin delivery'
	}
};

test('handoff session keeps one canonical clone-safe step per successful page action', () => {
	let session = emptyWebMcpHandoffSession();
	assert.deepEqual(session, { steps: [] });
	session = recordWebMcpHandoffStepState(session, steps.review);
	session = recordWebMcpHandoffStepState(session, steps.work);
	session = recordWebMcpHandoffStepState(session, steps.next);
	assert.deepEqual(session.steps.map(({ id }) => id), ['work-scope', 'review-scope', 'next-proposal']);
	assert.deepEqual(Object.keys(session.steps[0]), ['id', 'title', 'summary']);
	assert.deepEqual(Object.keys(session), ['steps']);

	const replaced = recordWebMcpHandoffStepState(session, {
		...steps.work,
		summary: '3 matching of 8'
	});
	assert.equal(replaced.steps.length, 3);
	assert.equal(replaced.steps[0].summary, '3 matching of 8');
	replaced.steps[0].summary = 'mutated';
	assert.equal(session.steps[0].summary, '4 matching of 8');
});

test('handoff session rejects extra authority, duplicate ids, malformed order, and open input', () => {
	assert.throws(
		() => recordWebMcpHandoffStepState({ steps: [], agentSaved: 1 }, steps.work),
		/session contains an unsupported field/u
	);
	assert.throws(
		() => recordWebMcpHandoffStepState({ steps: [steps.work, steps.work] }, steps.next),
		/step ids must be unique/u
	);
	assert.throws(
		() => recordWebMcpHandoffStepState({ steps: [steps.review, steps.work] }, steps.next),
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
	assert.match(railSource, /Live WebMCP handoff[\s\S]*?currentStep\.title[\s\S]*?Ready for one bounded run[\s\S]*?currentStep\?\.summary[\s\S]*?\{steps\.length\} of 5 steps/u);
	assert.match(railSource, /STAGES[\s\S]*?'work-scope', number: 1, label: 'Work'[\s\S]*?'review-scope', number: 2, label: 'Review'[\s\S]*?'next-proposal', number: 3, label: 'Next'[\s\S]*?'draft-batch', number: 4, label: 'Drafts'[\s\S]*?'human-decision', number: 5, label: 'Decide'/u);
	assert.match(railSource, /Agent authority[\s\S]*?0 saved · 0 started[\s\S]*?Human decides/u);
	assert.doesNotMatch(railSource, /step\?\.evidence|step\.evidence|min-height: 108px|One agent run · visible across pages/u);
	assert.match(stripSource, /Step 1 · Narrow Work[\s\S]*?Step 2 · Verify Review[\s\S]*?Step 3 · Prepare Next[\s\S]*?Step 4 · Stage Drafts/u);
	assert.match(stripSource, /Page view only · Workspace unchanged[\s\S]*?Unsaved proposal · Human approval required[\s\S]*?Draft only · Human Start required/u);
	assert.match(stripSource, /font-size: 18px;[\s\S]*?font-size: 14px;/u);
	assert.match(reducerSource, /STEP_FIELDS = new Set\(\['id', 'title', 'summary'\]\)/u);
	assert.match(reducerSource, /SESSION_FIELDS = new Set\(\['steps'\]\)/u);
	assert.doesNotMatch(`${reducerSource}\n${storeSource}`, /agentSaved|agentStarted/u);
	assert.doesNotMatch(reducerSource, /candidate\.(?:evidence|authority)|(?:evidence|authority): normalizedText/u);
	assert.doesNotMatch(storeSource, /(?:evidence|authority): string;/u);
	assert.match(workSource, /id: 'work-scope'[\s\S]*?summary: `\$\{outcome\.work\.counts\.matching\} matching of \$\{outcome\.work\.counts\.workspace\}`/u);
	assert.match(workSource, /id: 'draft-batch'[\s\S]*?summary: `\$\{outcome\.created\.length\} Drafts[\s\S]*?pendingNextActionDrafts\(\$demoState\)\.find[\s\S]*?if \(pendingWebMcpDraft\)[\s\S]*?id: 'human-decision'[\s\S]*?summary: 'Pending approval'/u);
	assert.match(reviewSource, /id: 'review-scope'[\s\S]*?summary: `\$\{outcome\.review\.counts\.shown\} shown of \$\{outcome\.review\.counts\.totalReview\}`/u);
	assert.match(nextSource, /id: 'next-proposal'[\s\S]*?summary: `Unsaved · \$\{outcome\.next\.preparationReceipt\.preparedAction\}`/u);
	assert.match(nextSource, /wasWebMcpPreparation[\s\S]*?summary: 'Discarded by person'[\s\S]*?summary: 'Approved and saved by person'/u);
	assert.match(guideSource, /await resetDemoSampleState\(\);[\s\S]*?resetWebMcpHandoffSession\(\);[\s\S]*?Live sample reset/u);
});
