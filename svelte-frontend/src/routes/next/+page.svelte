<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		demoState,
		demoStateError,
		refreshDemoState,
		setPackNextAction,
		setSelectedWork,
		toasts,
		ChallengeStateError
	} from '$lib/demo-client';
	import {
		NEXT_ACTION_CHOICES,
		nextChoiceForwardPath,
		commandActionForLabel,
		primaryCommand,
		blockerText,
		isReview,
		hasBlocker,
		workTitle,
		type DemoPack
	} from '$lib/demo-workflow';
import { WornButton, WornAlert, WornChip, WornEmpty, WornError, WornInput, WornPage } from '$lib/components';
import { workItemIssues } from '$lib/work-item-issues';
import { focusAndPulse } from '$lib/focus-pulse.mjs';
import { settleProgressiveReveal } from '$lib/progressive-reveal.mjs';
import { registerPageTools } from '$lib/webmcp.mjs';
import {
	NEXT_EDITOR_PREVIEW_ID,
	createCurrentNextEditorTool,
	createPrepareNextActionTool,
	nextEditorPageView
} from './next-webmcp.mjs';

type NextEditorMode = 'preset' | 'custom';
type PrepareNextActionInput = {
	choice: string;
	expectedMode: NextEditorMode;
	expectedChoice: string;
};

	let chosenPackId = $state('');
	let choice = $state('');
let customValue = $state('');
let showingCustom = $state(false);
	let busy = $state(false);
	let errorText = $state('');
	let editorFocusRequest = 0;
	let saveFocusFrame: number | null = null;
	let stopNextWebMcp: (() => void) | null = null;
	// Keep a large review queue useful without placing every candidate in the
	// DOM at once. The full list still determines the count and can be expanded
	// explicitly with the same keyboard-accessible buttons.
	const NEXT_CANDIDATE_RENDER_LIMIT = 100;
	let candidateRenderLimit = $state(NEXT_CANDIDATE_RENDER_LIMIT);

	let packs = $derived(
		(($demoState?.packs ?? []) as DemoPack[]).filter((candidate) => candidate.archived !== true)
	);
	// Work and Review link here with an explicit ?pack= selection.
	let selectedId = $derived(
		chosenPackId ||
			// The prerender has no browser URL; hydration resolves the real query.
			(browser ? $page.url.searchParams.get('pack') : '') ||
			$demoState?.selectedId ||
			''
	);
	// An explicit selection never falls back to a different work item.
	let demoLoaded = $derived(Boolean($demoState?.packs));
	let pack = $derived(
		packs.find((p) => p.id === selectedId) ||
			(!selectedId ? packs.find(isReview) || packs[0] : null) ||
			null
	);
	// Only declare not-found once the demo state has landed — until then the
	// requested pack may simply not have arrived yet.
	let notFound = $derived(Boolean(selectedId) && demoLoaded && !pack);
	let loadingSelected = $derived(Boolean(selectedId) && !demoLoaded && !pack);
	let candidates = $derived(packs.filter(isReview));
	let otherCandidates = $derived(candidates.filter((candidate) => candidate.id !== pack?.id));
	let renderedOtherCandidates = $derived(otherCandidates.slice(0, candidateRenderLimit));
	let hasMoreCandidates = $derived(renderedOtherCandidates.length < otherCandidates.length);

	// The editor previews the pack AS IF the current choice were saved, so the
	// fact lines and help always show what the main button will really run.
	let effectiveChoice = $derived(showingCustom ? choice.trim() : choice || defaultChoiceFor(pack));
	let previewChoice = $derived(effectiveChoice || defaultChoiceFor(pack));
	let preview = $derived(
		pack ? ({ ...pack, ...nextChoiceForwardPath(pack, previewChoice) } as DemoPack) : null
	);
	let previewCommand = $derived(preview ? primaryCommand(preview) : null);
	let currentNextEditor = $derived.by(() => {
		if (!pack?.id || !preview || !previewCommand) return null;
		return nextEditorPageView({
			work: { id: pack.id, title: workTitle(pack) },
			presetChoices: NEXT_ACTION_CHOICES,
			editor: { mode: showingCustom ? 'custom' : 'preset', choice: effectiveChoice },
			preview: {
				blocker: hasBlocker(preview) ? blockerText(preview) : null,
				nextAction: showingCustom && !effectiveChoice ? 'Not set' : previewCommand.label
			},
			canSave: Boolean(effectiveChoice) && !busy,
			busy
		});
	});

	// Describe the save command directly; the preview already owns workflow facts.
	let saveNextHelp = $derived.by(() => {
		if (!pack || !previewCommand) return '';
		if (!effectiveChoice) return 'Type a custom next action.';
		return `Save "${effectiveChoice}" as the next action for ${workTitle(pack)}.`;
	});

	async function refreshNext() {
		await refreshDemoState();
	}

	onMount(() => {
		void refreshDemoState({ reuseRecent: true });
		stopNextWebMcp = registerPageTools(document, [
			createCurrentNextEditorTool(() => currentNextEditor),
			createPrepareNextActionTool(prepareNextActionFromWebMcp)
		]);
		return () => {
			stopNextWebMcp?.();
			stopNextWebMcp = null;
		};
	});

	async function scheduleEditorFocus(target: 'custom' | 'choices') {
		const request = ++editorFocusRequest;
		const origin = document.activeElement;
		await tick();
		if (request !== editorFocusRequest) return;

		const pulseTarget = document.querySelector(
			target === 'custom' ? '#custom-next-input' : '[data-next-choices]'
		) as HTMLElement | null;
		const focusTarget = target === 'custom'
			? pulseTarget
			: pulseTarget?.querySelector('button') as HTMLElement | null;
		if (!focusTarget || !pulseTarget) return;

		const active = document.activeElement;
		const focusStillOwned = !active || active === document.body || active === origin || active === focusTarget;
		if (!focusStillOwned) return;
		focusAndPulse(focusTarget, { behavior: 'smooth', block: 'center', pulseTarget });
	}

	onDestroy(() => {
		editorFocusRequest += 1;
		if (saveFocusFrame !== null) cancelAnimationFrame(saveFocusFrame);
		saveFocusFrame = null;
	});

	// Map the saved action to one visible editor choice.
	function defaultChoiceFor(target: DemoPack | null): string {
		if (!target) return 'Open';
		const stored = target.next || '';
		if ((NEXT_ACTION_CHOICES as readonly string[]).includes(stored)) return stored;
		const action = commandActionForLabel(stored).action;
		if (action === 'unblock') return 'Set Blocker: None';
		if (action === 'done') return 'Finish with proof';
		if (action === 'start' || action === 'block') return 'Open';
		return 'Open';
	}

	function setNextEditorChoice(nextChoice: string, mode: NextEditorMode) {
		choice = nextChoice;
		showingCustom = mode === 'custom';
		if (mode === 'custom') customValue = nextChoice;
	}

	async function prepareNextActionFromWebMcp(input: PrepareNextActionInput) {
		if (busy) throw new Error('Prepare next action is unavailable while Next is saving.');
		const current = currentNextEditor;
		if (!current) throw new Error('Prepare next action requires a visible Next editor.');
		const desiredMode: NextEditorMode = (NEXT_ACTION_CHOICES as readonly string[]).includes(input.choice)
			? 'preset'
			: 'custom';
		const alreadyDesired = current.editor.mode === desiredMode && current.editor.choice === input.choice;
		const matchesExpected = current.editor.mode === input.expectedMode && current.editor.choice === input.expectedChoice;
		if (!alreadyDesired && !matchesExpected) {
			throw new Error('Prepare next action rejected stale Next editor state.');
		}
		if (!alreadyDesired) setNextEditorChoice(input.choice, desiredMode);
		await tick();
		const target = document.getElementById(NEXT_EDITOR_PREVIEW_ID);
		if (!(target instanceof HTMLElement)) throw new Error('Prepare next action could not find its visible preview.');
		focusAndPulse(target, { behavior: 'smooth', block: 'center' });
		if (!currentNextEditor) throw new Error('Prepare next action could not verify the visible editor.');
		return {
			changed: !alreadyDesired,
			focus: { id: NEXT_EDITOR_PREVIEW_ID },
			next: currentNextEditor
		};
	}

	function editPack(candidate: DemoPack) {
		if (!candidate.id) return;
		chosenPackId = candidate.id;
		choice = '';
		customValue = '';
		showingCustom = false;
		errorText = '';
		// Keep the browser-local selection in step with the visible editor.
		setSelectedWork(candidate.id).catch((e) => console.warn('Failed to sync selected work:', e));
		toasts.update((t) => [...t, { id: `pick-${Date.now()}`, message: `Editing next action for ${workTitle(candidate)}`, kind: 'success' }]);
		// A new work item always starts at the bounded choice group.
		scheduleEditorFocus('choices');
	}

	async function saveChoice() {
		if (!pack?.id || busy || !effectiveChoice) return;
		busy = true;
		errorText = '';
		if (saveFocusFrame !== null) cancelAnimationFrame(saveFocusFrame);
		saveFocusFrame = null;
		try {
			const result = await setPackNextAction(pack.id, effectiveChoice);
			const summary = result?.receipt?.summary || `Next action saved: ${effectiveChoice}.`;
			toasts.update((t) => [...t, { id: `next-${Date.now()}`, message: summary, kind: 'success' }]);
			// Land focus on the preview so keyboard users land on the updated
			// state — the /next analogue of the pack page's afterSave receipt
			// focus. The save button itself would keep focus with no move.
			saveFocusFrame = requestAnimationFrame(() => {
				saveFocusFrame = null;
				const el = document.querySelector('[data-next-preview]') as HTMLElement | null;
				if (!el) return;
				focusAndPulse(el, { behavior: 'smooth', block: 'center' });
			});
		} catch (error) {
			errorText =
				error instanceof ChallengeStateError ? error.message : 'Saving the next action failed.';
		} finally {
			busy = false;
		}
	}

	async function focusCandidate(candidate: DemoPack) {
		if (!candidate.id) return;
		try {
			await setSelectedWork(candidate.id);
		} catch {
			// selection is a nicety; still navigate
		}
		goto(`/work?focus=${encodeURIComponent(candidate.id)}`);
	}

	async function showMoreCandidates(event: MouseEvent) {
		const trigger = event.currentTarget;
		if (!(trigger instanceof HTMLElement)) return;
		const previousCount = renderedOtherCandidates.length;
		const nextLimit = previousCount + NEXT_CANDIDATE_RENDER_LIMIT;
		const removesTrigger = nextLimit >= otherCandidates.length;
		candidateRenderLimit = nextLimit;
		await settleProgressiveReveal({
			settled: tick(),
			removesTrigger,
			trigger,
			getDestination: () => {
				const pulseTarget = document.querySelectorAll<HTMLElement>('[data-pack-id]')[previousCount];
				const focusTarget = pulseTarget?.querySelector<HTMLElement>('.demo-row-actions button');
				return pulseTarget && focusTarget ? { focusTarget, pulseTarget } : null;
			}
		});
	}
</script>

<svelte:head><title>Next — Wornpage Projects™</title></svelte:head>

{#if notFound}
	<WornPage title="Next actions">
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
		<WornError
			message="Work item not found"
			detail={selectedId ? `No loaded work item has id "${selectedId}".` : 'No work item id was provided.'}
		>
			<div class="demo-row-actions">
				<WornButton variant="primary" size="sm" href="/next">Next actions</WornButton>
			</div>
		</WornError>
	</WornPage>
{:else if loadingSelected}
	<WornPage title="Loading work item…">
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
	</WornPage>
{:else if pack && preview && previewCommand}
	<WornPage title="Set the next action" status={workTitle(pack)}>
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
		{#if errorText}
			<WornAlert tone="danger" dismissible dismissLabel="Dismiss next-action error">{errorText}</WornAlert>
		{/if}
		<div class="demo-command-lines compact" id={NEXT_EDITOR_PREVIEW_ID} data-next-preview data-next-work-id={pack.id} tabindex="-1">
			{#if hasBlocker(preview)}
				<div class="demo-command-line" data-command-field="blocker"><span>Blocker</span><strong>{blockerText(preview)}</strong></div>
			{/if}
			<div class="demo-command-line" data-command-field="button-runs-next"><span>Next action</span><strong>{showingCustom && !effectiveChoice ? 'Not set' : previewCommand.label}</strong></div>
		</div>

		<div class="demo-inline-form next-action-editor">
			<div class="demo-field">
				<div class="demo-chip-row" role="group" aria-label="Next action choices" data-next-choices>
					{#each NEXT_ACTION_CHOICES as act}
						<WornChip label={act} size="sm" pressed={!showingCustom && effectiveChoice === act}
							onclick={() => setNextEditorChoice(act, 'preset')} />
					{/each}
					<WornChip label="Custom…" size="sm" pressed={showingCustom}
						onclick={() => { setNextEditorChoice(customValue, 'custom'); scheduleEditorFocus('custom'); }} />
				</div>
				{#if showingCustom}
					<WornInput id="custom-next-input" aria-label="Custom next action" placeholder="Type a custom next action…" bind:value={choice} oninput={() => customValue = choice} />
				{/if}
			</div>
			<span id="apply-next-action-help" class="sr-only">{saveNextHelp}</span>
			<WornButton variant="primary" disabled={busy || !effectiveChoice} aria-describedby="apply-next-action-help" onclick={saveChoice}>
				{busy ? 'Saving…' : 'Save next action'}
			</WornButton>
		</div>

		{#each workItemIssues(pack) as v}
			<WornAlert tone="warning">{v.message}</WornAlert>
		{/each}
	</WornPage>

	{#if otherCandidates.length > 0}
	<WornPage title="Other next actions">
		<div class="demo-list">
			{#each renderedOtherCandidates as candidate (candidate.id)}
				<div class="demo-row has-row-support" data-pack-id={candidate.id}>
					<div>
						<strong>{workTitle(candidate)}</strong>
						{#if blockerText(candidate) !== 'None'}
							<span>{blockerText(candidate)}</span>
						{/if}
					</div>
					<div class="demo-row-actions">
						<WornButton
							type="button"
							variant="primary"
							size="sm"
							aria-label={`Set next action for ${workTitle(candidate)}`}
							onclick={() => editPack(candidate)}
						>
							Set next action
						</WornButton>
						<WornButton
							type="button"
							size="sm"
							aria-label={`Focus ${workTitle(candidate)} in Work`}
							onclick={() => focusCandidate(candidate)}
						>
							Focus
						</WornButton>
					</div>
				</div>
			{/each}
			{#if otherCandidates.length > NEXT_CANDIDATE_RENDER_LIMIT}
				<div class="next-load-more">
					<span aria-live="polite">{renderedOtherCandidates.length} of {otherCandidates.length} shown</span>
					{#if hasMoreCandidates}
						<WornButton type="button" size="sm" data-action="show-more-next-candidates" onclick={showMoreCandidates}>
							Show {Math.min(NEXT_CANDIDATE_RENDER_LIMIT, otherCandidates.length - renderedOtherCandidates.length)} more
						</WornButton>
					{/if}
				</div>
			{/if}
		</div>
	</WornPage>
	{/if}
{:else}
	<WornPage title="Next actions">
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
		<WornEmpty title="No sample work available">
			<WornButton variant="primary" href="/webmcp-challenge">Open guide</WornButton>
		</WornEmpty>
	</WornPage>
{/if}

<style>
	/* Inline style attributes are blocked by the shared CSP — scoped classes. */
	.demo-row.has-row-support {
		padding: 10px 12px;
	}
	.demo-row.has-row-support > div:first-child {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.next-load-more {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 12px;
		color: var(--worn-text-muted);
		font-size: 12px;
	}
	.next-action-editor > .demo-field {
		flex: 1 1 auto;
		min-width: 0;
	}
	@media (max-width: 500px) {
		.demo-inline-form,
		.demo-row.has-row-support {
			align-items: stretch;
			flex-direction: column;
		}
		.demo-chip-row {
			max-width: 100%;
		}
		.demo-row-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			width: 100%;
		}
		.demo-row-actions :global(.worn-btn),
		.demo-inline-form > :global(.worn-btn),
		.next-load-more :global(.worn-btn) {
			min-width: 0;
			width: 100%;
		}
		.next-load-more {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
