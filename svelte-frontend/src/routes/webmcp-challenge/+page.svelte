<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { WornAccordion, WornBadge, WornButton, WornPage, WornReceipt } from '$lib/components';
	import AgentBriefEditor from '$lib/AgentBriefEditor.svelte';
	import { ChallengeStateError, demoState, displayToast, exportWorkspaceState, importWorkspaceState, previewWorkspaceImport, resetDemoSampleState, type WorkspaceImportPreview } from '$lib/demo-client';
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
	let importBusy = $state(false);
	let importPreview = $state<WorkspaceImportPreview | null>(null);
	let importError = $state('');
	let importInput = $state<HTMLInputElement | null>(null);
	let exportHref = $state('');

	function prepareWorkspaceExport() {
		if (exportHref) URL.revokeObjectURL(exportHref);
		exportHref = URL.createObjectURL(new Blob([exportWorkspaceState()], { type: 'application/json' }));
		displayToast('Workspace export is ready to download.', 'success');
	}

	async function selectWorkspaceFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		importPreview = null;
		importError = '';
		if (!file) return;
		try {
			importPreview = previewWorkspaceImport(await file.text());
		} catch (error) {
			importError = error instanceof Error ? error.message : 'The workspace export is invalid.';
		}
	}

	async function applyWorkspaceImport(mode: 'replace' | 'merge') {
		if (!importPreview || importBusy) return;
		importBusy = true;
		try {
			const result = await importWorkspaceState(importPreview.serialized, mode);
			displayToast(mode === 'replace' ? `Workspace replaced with ${result.packs} work items.` : `Workspace merged with ${result.packs} new work items${result.skipped ? ` (${result.skipped} existing skipped)` : ''}.`, 'success');
			importPreview = null;
			if (importInput) importInput.value = '';
		} catch (error) {
			importError = error instanceof Error ? error.message : 'The workspace could not be imported.';
		} finally {
			importBusy = false;
		}
	}

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
					<div class="challenge-role-split" aria-label="Authority handoff">
						<WornBadge variant="accent" size="sm" label="Agent · inspect + prepare" />
						<span class="challenge-role-arrow" aria-hidden="true">→</span>
						<WornBadge size="sm" label="You · decide + save" />
					</div>
					<div class="challenge-sample-reset">
						<WornButton type="button" size="sm" disabled={resettingSample} onclick={resetLiveSample}>
							{resettingSample ? 'Resetting sample…' : 'Reset live sample'}
						</WornButton>
						<span>Explicitly restores this browser’s bundled sample and clears its prior local results.</span>
					</div>
					<section class="challenge-portability" aria-labelledby="workspace-portability-title">
						<h2 id="workspace-portability-title">Workspace portability</h2>
						<p>Export a validated local backup or preview an export before replacing or merging it.</p>
						<div class="challenge-portability-actions">
							<WornButton type="button" size="sm" onclick={prepareWorkspaceExport}>Prepare export</WornButton>
							{#if exportHref}<a class="challenge-export-link" href={exportHref} download="projects-workspace.json">Download export</a>{/if}
							<label class="challenge-import-label">Import export<input bind:this={importInput} type="file" accept="application/json" onchange={selectWorkspaceFile} /></label>
						</div>
					{#if importError}<p class="challenge-import-error" role="alert">{importError}</p>{/if}
						{#if importPreview}
							<div class="challenge-import-preview" aria-live="polite"><strong>Preview:</strong> {importPreview.packs} work items · {importPreview.pendingApprovals} pending approvals · {importPreview.collisions} existing ID collisions.</div>
							<div class="challenge-portability-actions"><WornButton size="sm" variant="primary" disabled={importBusy} onclick={() => applyWorkspaceImport('merge')}>Merge</WornButton><WornButton size="sm" variant="danger" disabled={importBusy} onclick={() => applyWorkspaceImport('replace')}>Replace</WornButton></div>
						{/if}
					</section>
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
			<div class="challenge-agent-column">
				<AgentBriefEditor scopeCatalog={guideScopeCatalog} bind:selectedScopeId bind:workQuery {selectedMatchingCount} />
			</div>
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

		<WornAccordion label="Authority boundary">
			<section class="challenge-safety" data-webmcp-challenge-safety aria-labelledby="challenge-safety-title">
				<h2 id="challenge-safety-title">Who controls changes</h2>
				<ul>
					{#each safety as guarantee (guarantee)}
						<li>{guarantee}</li>
					{/each}
				</ul>
			</section>
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
	.challenge-agent-column {
		display: grid;
		gap: 12px;
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
	.challenge-role-split {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.challenge-role-arrow {
		color: var(--worn-text-muted);
		font-family: var(--font-typewriter);
		font-size: 13px;
		font-weight: 700;
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
	.challenge-portability { background: var(--worn-surface); border: 1px solid var(--worn-border); border-radius: var(--worn-radius); display: grid; gap: 8px; padding: 14px; }
	.challenge-portability h2 { font-size: 16px; margin: 0; }
	.challenge-portability p { color: var(--worn-text-secondary); font-size: 13px; line-height: 1.45; margin: 0; }
	.challenge-portability-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
	.challenge-import-label { align-items: center; border: 1px solid var(--worn-border-strong); border-radius: var(--worn-radius-sm); cursor: pointer; display: inline-flex; font-size: 13px; padding: 9px 10px; }
	.challenge-import-label input { max-width: 1px; opacity: 0; position: absolute; }
	.challenge-import-preview { color: var(--worn-text-secondary); font-size: 13px; }
	.challenge-import-error { color: var(--worn-danger) !important; }
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
		background: var(--worn-accent);
		border: 1px solid var(--worn-accent);
		border-radius: 50%;
		color: var(--worn-accent-text);
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
	.challenge-safety ul {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.6;
		margin: 0;
		padding-left: 20px;
	}
	@media (max-width: 860px) {
		.challenge-hero {
			grid-template-columns: minmax(0, 1fr);
		}
		.challenge-steps {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
