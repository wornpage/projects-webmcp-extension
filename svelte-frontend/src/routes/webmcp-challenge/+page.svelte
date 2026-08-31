<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { WornAccordion, WornButton, WornPage, WornReceipt } from '$lib/components';
	import AgentBriefEditor from '$lib/AgentBriefEditor.svelte';
	import { ChallengeStateError, demoState, displayToast, resetDemoSampleState } from '$lib/demo-client';
	import { filterPacks, type DemoPack } from '$lib/demo-workflow';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import { resetWebMcpHandoffSession } from '$lib/webmcp-handoff-store';
	import seedPacks from '../../../../data/demo-packs.json';
	import {
		PROJECTS_HANDOFF_GUIDE_TOOL_NAME,
		createWebMcpChallengeGuideTool,
		deriveGuideWorkScopeCatalog,
		readRenderedWebMcpChallengeGuide
	} from './webmcp-challenge-webmcp.mjs';

	const steps = [
		{
			title: 'Observe the workspace',
			description: 'On Work, read the visible items, priorities, and explicit counts.',
			action: 'Start in Work',
			href: '/work'
		},
		{
			title: 'Explain what needs attention',
			description: 'On Review, narrow the queue and surface the evidence behind each priority.',
			action: 'Continue to Review',
			href: '/review'
		},
		{
			title: 'Prepare the handoff',
			description: 'On Next, prepare a clear next action from exact workspace facts, then stop before Save.',
			action: 'Open the draft editor',
			href: '/next'
		}
	] as const;
	const safety = [
		'Agent: read the exact state currently rendered.',
		'Agent: change page-local scope, prepare an unsaved next action, or create up to three Draft items through the bounded Work tool.',
		'Person: control Start, final Save, blocking, completion, and deletion.'
	] as const;
	let webMcpGuideReaderAvailable = $state(false);
	let webMcpGuideReceipt = $state<{
		summary: string;
		cells: Array<{ label: string; value: string }>;
	} | null>(null);
	let webMcpInvocationCount = $state(0);
	let resettingSample = $state(false);
	let selectedScopeId = $state('all');
	let workQuery = $state('');
	let guidePacks = $derived(($demoState?.packs ?? seedPacks) as DemoPack[]);
	let guideVisiblePacks = $derived(filterPacks(guidePacks, 'all', ''));
	let guideScopeCatalog = $derived.by(() => deriveGuideWorkScopeCatalog(
		guidePacks.length,
		guideVisiblePacks,
		(query) => filterPacks(guidePacks, 'all', query).length
	));
	let selectedMatchingCount = $derived(filterPacks(guidePacks, 'all', workQuery).length);

	async function resetLiveSample() {
		if (resettingSample) return;
		resettingSample = true;
		try {
			await resetDemoSampleState();
			resetWebMcpHandoffSession();
			displayToast('Live sample reset. Previous local results were cleared.', 'success');
		} catch (error) {
			displayToast(
				error instanceof ChallengeStateError ? error.message : 'The live sample could not be reset.',
				'error'
			);
		} finally {
			resettingSample = false;
		}
	}

	onMount(() => {
		// This is intentionally capability detection, not a registration-success claim.
		// registerPageTools continues to own registration, failure handling, and teardown.
		const webMcpDocument = document as Document & { modelContext?: { registerTool?: unknown } };
		webMcpGuideReaderAvailable = typeof webMcpDocument.modelContext?.registerTool === 'function';
		return registerPageTools(document, [
			createWebMcpChallengeGuideTool(() => readRenderedWebMcpChallengeGuide(document))
		], {
		onInvocationError: async () => {
			webMcpGuideReceipt = null;
			await tick();
		},
		onResult: async ({ toolName, result }) => {
			if (toolName !== PROJECTS_HANDOFF_GUIDE_TOOL_NAME) return;
			const guide = result as {
				steps?: unknown[];
				agentBrief?: unknown;
				workQuery?: unknown;
				workScope?: {
					workspaceCount?: unknown;
					selected?: { label?: unknown; matchingCount?: unknown };
				};
			};
			webMcpInvocationCount += 1;
			webMcpGuideReceipt = {
				summary: 'WebMCP read the current Guide, brief, and visible Work scope.',
				cells: [
					{ label: 'Tool', value: toolName },
					{ label: 'Invocation', value: `#${webMcpInvocationCount}` },
					{ label: 'What it read', value: `${guide.steps?.length ?? 0} workflow steps and the visible authority boundary` },
					{ label: 'Editable brief', value: typeof guide.agentBrief === 'string' ? guide.agentBrief : 'Unavailable' },
					{ label: 'Work scope', value: typeof guide.workScope?.selected?.label === 'string' ? guide.workScope.selected.label : 'Unavailable' },
					{ label: 'Work query', value: typeof guide.workQuery === 'string' && guide.workQuery ? guide.workQuery : 'Any text' },
					{ label: 'Matches', value: typeof guide.workScope?.selected?.matchingCount === 'number' && typeof guide.workScope.workspaceCount === 'number' ? `${guide.workScope.selected.matchingCount} of ${guide.workScope.workspaceCount} workspace` : 'Unavailable' },
					{ label: 'Page-local presentation', value: 'Unchanged' },
					{ label: 'Saved workspace changes', value: 'None' }
				]
			};
			await tick();
		}
		});
	});
</script>

<svelte:head>
	<title>Projects handoff guide — Wornpage Projects™</title>
	<meta
		name="description"
	content="A practical Projects handoff workflow: WebMCP tools read visible work, can create bounded Drafts, and prepare an unsaved next action while people control Start and final Save."
	/>
</svelte:head>

<WornPage sectionLabel="Projects workflow · guided handoff" title="Projects handoff guide">
	<div
		class="challenge-guide"
		data-webmcp-challenge-guide
		data-webmcp-challenge-title="Projects handoff guide"
		data-webmcp-challenge-purpose="People and browser agents share the same live project page while consequential decisions remain human-owned."
	>
		<div class="challenge-hero">
			<div class="challenge-guide-rail">
				<div class="challenge-intro">
					<p class="challenge-kicker">WebMCP project workspace · live sample · no login</p>
					<p class="challenge-purpose">Choose visible work and edit the brief; the browser agent can inspect, prepare, or add bounded Drafts while you control Start and final Save.</p>
					<div class="challenge-sample-reset">
						<WornButton type="button" size="sm" disabled={resettingSample} onclick={resetLiveSample}>
							{resettingSample ? 'Resetting sample…' : 'Reset live sample'}
						</WornButton>
						<span>Explicitly restores this browser’s bundled sample and clears its prior local results.</span>
					</div>
				</div>
				<ol class="challenge-steps" aria-label="Three-step Projects handoff workflow">
					{#each steps as step, index (step.href)}
						<li data-webmcp-challenge-step>
							<span class="challenge-number" aria-hidden="true">{index + 1}</span>
							<div>
								<h2>{step.title}</h2>
								<p>{step.description}</p>
							</div>
							<WornButton href={step.href} size="sm">{step.action}</WornButton>
						</li>
					{/each}
				</ol>
			</div>
			<AgentBriefEditor scopeCatalog={guideScopeCatalog} bind:selectedScopeId bind:workQuery {selectedMatchingCount} />
		</div>

		{#if webMcpGuideReceipt}
			<div data-webmcp-receipt="guide" aria-label="Latest Guide WebMCP tool receipt">
				<WornReceipt
					summary={webMcpGuideReceipt.summary}
					cells={webMcpGuideReceipt.cells}
					ondone={() => (webMcpGuideReceipt = null)}
				/>
			</div>
		{/if}

		<WornAccordion label="Authority and browser status">
			<div class="challenge-boundary-grid">
				<section class="challenge-safety" data-webmcp-challenge-safety aria-labelledby="challenge-safety-title">
					<h2 id="challenge-safety-title">Authority boundary</h2>
					<ul>
						{#each safety as guarantee (guarantee)}
							<li>{guarantee}</li>
						{/each}
					</ul>
				</section>

				<section class="challenge-browser-note" data-webmcp-guide-reader-status aria-live="polite" aria-labelledby="challenge-browser-note-title">
					<h2 id="challenge-browser-note-title">Guide reader in this browser</h2>
					{#if webMcpGuideReaderAvailable}
						<p><strong>Reader API detected.</strong> The Guide tool reads the visible guide, current brief, scope choices, and exact denominator only; it cannot navigate, save, or change workspace data. Detection does not confirm registration success.</p>
					{:else}
						<p><strong>Reader API unavailable.</strong> Copy brief keeps any nonempty Work scope, and the three visible route buttons remain usable.</p>
					{/if}
				</section>
			</div>
		</WornAccordion>
	</div>
</WornPage>

<style>
	.challenge-guide {
		display: grid;
		gap: 24px;
		min-width: 0;
	}
	.challenge-hero {
		align-items: start;
		display: grid;
		gap: 20px;
		grid-template-columns: minmax(0, 0.82fr) minmax(360px, 1.18fr);
	}
	.challenge-guide-rail {
		display: grid;
		gap: 24px;
		min-width: 0;
	}
	.challenge-intro {
		align-content: start;
		display: grid;
		gap: 16px;
	}
	.challenge-kicker {
		color: var(--worn-text-secondary);
		font-family: var(--font-typewriter);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		margin: 0;
		text-transform: uppercase;
	}
	.challenge-purpose {
		color: var(--worn-text-secondary);
		font-size: 17px;
		line-height: 1.6;
		margin: 0;
	}
	.challenge-sample-reset {
		align-items: center;
		color: var(--worn-text-muted);
		display: flex;
		flex-wrap: wrap;
		font-size: 12px;
		gap: 8px;
		line-height: 1.45;
	}
	.challenge-safety h2 {
		font-size: 14px;
		margin: 0 0 8px;
	}
	.challenge-steps {
		display: grid;
		gap: 10px;
		grid-template-columns: minmax(0, 1fr);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.challenge-steps li {
		align-content: start;
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		display: grid;
		gap: 12px;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: 16px;
	}
	.challenge-number {
		align-items: center;
		border: 1px solid var(--worn-accent);
		border-radius: 50%;
		display: flex;
		font-family: var(--font-typewriter);
		font-size: 12px;
		font-weight: 700;
		height: 28px;
		justify-content: center;
		width: 28px;
	}
	.challenge-steps h2 {
		font-size: 17px;
		margin: 0;
	}
	.challenge-steps p {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.55;
		margin: 3px 0 0;
	}
	.challenge-steps :global(.worn-btn) {
		justify-self: start;
	}
	.challenge-boundary-grid {
		display: grid;
		gap: 16px;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}
	.challenge-safety ul {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.6;
		margin: 0;
		padding-left: 20px;
	}
	.challenge-browser-note {
		border-left: 3px solid var(--worn-accent);
		padding-left: 12px;
	}
	.challenge-browser-note h2 {
		font-size: 14px;
		margin: 0 0 8px;
	}
	.challenge-browser-note p {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.55;
		margin: 0;
	}
	@media (max-width: 860px) {
		.challenge-hero,
		.challenge-boundary-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.challenge-steps {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
