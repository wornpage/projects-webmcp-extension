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
		blockerText,
		isReview,
		hasBlocker,
		workTitle,
		type DemoPack
	} from '$lib/demo-workflow';
	import {
		WornAccordion,
		WornAlert,
		WornButton,
		WornChip,
		WornEmpty,
		WornError,
		WornInput,
		WornPage,
		WornReceipt
	} from '$lib/components';
	import { workItemIssues } from '$lib/work-item-issues';
	import { focusAndPulse } from '$lib/focus-pulse.mjs';
	import { settleProgressiveReveal } from '$lib/progressive-reveal.mjs';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import {
		NEXT_EDITOR_PREVIEW_ID,
		NEXT_PREPARATION_RECEIPT_ID,
		NEXT_PREPARATION_SUMMARY,
		createCurrentNextEditorTool,
		createPrepareNextActionTool,
		nextEditorPageView
	} from './next-webmcp.mjs';

	type NextEditorMode = 'preset' | 'custom';
	type PrepareNextActionInput = {
		choice: string;
		expectedMode: NextEditorMode;
		expectedChoice: string;
		agentNote: string;
	};
	type PreparationReceipt = {
		summary: string;
		work: { id: string; title: string };
		agentNote: string;
		preparedAction: string;
		workspaceChanged: false;
		requiresHumanSave: true;
	};
	type EditorSnapshot = { mode: NextEditorMode; choice: string };
	type SavedNextReceipt = { summary: string; pack: DemoPack };
	type NextPreparationSnapshot = {
		choice: string;
		customValue: string;
		showingCustom: boolean;
		preparationReceipt: PreparationReceipt | null;
		preparationPreviousEditor: EditorSnapshot | null;
		savedNextReceipt: SavedNextReceipt | null;
	};

	let chosenPackId = $state('');
	let choice = $state('');
let customValue = $state('');
let showingCustom = $state(false);
	let busy = $state(false);
	let errorText = $state('');
	let preparationReceipt = $state<PreparationReceipt | null>(null);
	let preparationPreviousEditor = $state<EditorSnapshot | null>(null);
	let savedNextReceipt = $state<SavedNextReceipt | null>(null);
	let editorPackId = $state('');
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
	let effectiveMode = $derived<NextEditorMode>(
		showingCustom || !(NEXT_ACTION_CHOICES as readonly string[]).includes(effectiveChoice)
			? 'custom'
			: 'preset'
	);
	let previewChoice = $derived(effectiveChoice || defaultChoiceFor(pack));
	let preview = $derived(
		pack ? ({ ...pack, ...nextChoiceForwardPath(pack, previewChoice) } as DemoPack) : null
	);
	let currentNextEditor = $derived.by(() => {
		if (!pack?.id || !preview) return null;
		return nextEditorPageView({
			work: { id: pack.id, title: workTitle(pack) },
			presetChoices: NEXT_ACTION_CHOICES,
			editor: { mode: effectiveMode, choice: effectiveChoice },
			preview: {
				blocker: hasBlocker(preview) ? blockerText(preview) : null,
				nextAction: effectiveChoice || 'Not set'
			},
			preparationReceipt,
			canSave: Boolean(effectiveChoice) && !busy,
			busy
		});
	});
	let preparationCells = $derived(preparationReceipt ? [
		{ label: 'Evidence note', value: preparationReceipt.agentNote },
		{ label: 'Workspace data', value: 'Unchanged' },
		{ label: 'Authority', value: 'Only you can Save' }
	] : []);
	let savedNextCells = $derived(savedNextReceipt ? [
		{ label: 'Work item', value: workTitle(savedNextReceipt.pack) },
		{ label: 'Saved next action', value: savedNextReceipt.pack.next || 'Open' },
		{ label: 'Blocker', value: blockerText(savedNextReceipt.pack) },
		{ label: 'Proof target', value: savedNextReceipt.pack.doneWhen || 'Not set' }
	] : []);

	// Describe the save command directly; the preview already owns workflow facts.
	let saveNextHelp = $derived.by(() => {
		if (!pack) return '';
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
			createPrepareNextActionTool(prepareNextActionFromWebMcp, {
				capture: captureNextPreparationSnapshot,
				restore: restoreNextPreparationSnapshot
			})
		]);
		return () => {
			stopNextWebMcp?.();
			stopNextWebMcp = null;
			clearPreparation();
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
		const stored = String(target.next || '').trim();
		if (stored) return stored;
		return 'Open';
	}

	function clearPreparation() {
		preparationReceipt = null;
		preparationPreviousEditor = null;
	}

	function clonePreparationReceipt(receipt: PreparationReceipt | null): PreparationReceipt | null {
		return receipt ? { ...receipt, work: { ...receipt.work } } : null;
	}

	function captureNextPreparationSnapshot(): NextPreparationSnapshot {
		return {
			choice,
			customValue,
			showingCustom,
			preparationReceipt: clonePreparationReceipt(preparationReceipt),
			preparationPreviousEditor: preparationPreviousEditor ? { ...preparationPreviousEditor } : null,
			savedNextReceipt
		};
	}

	function restoreNextPreparationSnapshot(snapshot: NextPreparationSnapshot) {
		choice = snapshot.choice;
		customValue = snapshot.customValue;
		showingCustom = snapshot.showingCustom;
		preparationReceipt = clonePreparationReceipt(snapshot.preparationReceipt);
		preparationPreviousEditor = snapshot.preparationPreviousEditor ? { ...snapshot.preparationPreviousEditor } : null;
		savedNextReceipt = snapshot.savedNextReceipt;
	}

	function setNextEditorChoice(nextChoice: string, mode: NextEditorMode, clearAgentPreparation = true) {
		if (clearAgentPreparation) clearPreparation();
		savedNextReceipt = null;
		choice = nextChoice;
		showingCustom = mode === 'custom';
		if (mode === 'custom') customValue = nextChoice;
	}

	$effect(() => {
		const nextPackId = pack?.id || '';
		if (!nextPackId || nextPackId === editorPackId) return;
		editorPackId = nextPackId;
		const initialChoice = defaultChoiceFor(pack);
		setNextEditorChoice(
			initialChoice,
			(NEXT_ACTION_CHOICES as readonly string[]).includes(initialChoice) ? 'preset' : 'custom'
		);
		errorText = '';
	});

	async function prepareNextActionFromWebMcp(
		input: PrepareNextActionInput,
		invocation: { markMutated: () => void }
	) {
		if (busy) throw new Error('Prepare next action is unavailable while Next is saving.');
		const current = currentNextEditor;
		if (!current) throw new Error('Prepare next action requires a visible Next editor.');
		const desiredMode: NextEditorMode = (NEXT_ACTION_CHOICES as readonly string[]).includes(input.choice)
			? 'preset'
			: 'custom';
		const alreadyDesired = current.editor.mode === desiredMode && current.editor.choice === input.choice;
		const receiptAlreadyDesired = preparationReceipt?.preparedAction === input.choice &&
			preparationReceipt.agentNote === input.agentNote &&
			preparationReceipt.work.id === current.work.id;
		const matchesExpected = current.editor.mode === input.expectedMode && current.editor.choice === input.expectedChoice;
		if (!alreadyDesired && !matchesExpected) {
			throw new Error('Prepare next action rejected stale Next editor state.');
		}
		invocation.markMutated();
		if (!preparationReceipt) {
			preparationPreviousEditor = { mode: current.editor.mode, choice: current.editor.choice };
		}
		setNextEditorChoice(input.choice, desiredMode, false);
		preparationReceipt = {
			summary: NEXT_PREPARATION_SUMMARY,
			work: current.work,
			agentNote: input.agentNote,
			preparedAction: input.choice,
			workspaceChanged: false,
			requiresHumanSave: true
		};
		await tick();
		const target = document.getElementById(NEXT_PREPARATION_RECEIPT_ID);
		if (!(target instanceof HTMLElement)) throw new Error('Prepare next action could not find its visible preview.');
		const focusReceipt = focusAndPulse(target, {
			behavior: 'auto',
			block: 'center',
			requireVisibleFocus: true
		});
		if (!currentNextEditor) throw new Error('Prepare next action could not verify the visible editor.');
		return {
			changed: !alreadyDesired || !receiptAlreadyDesired,
			focus: { id: NEXT_PREPARATION_RECEIPT_ID, ...focusReceipt },
			next: currentNextEditor
		};
	}

	function discardPreparation() {
		const previous = preparationPreviousEditor;
		clearPreparation();
		if (previous) setNextEditorChoice(previous.choice, previous.mode, false);
		void scheduleEditorFocus('choices');
	}

	function editPack(candidate: DemoPack) {
		if (!candidate.id) return;
		chosenPackId = candidate.id;
		choice = '';
		customValue = '';
		showingCustom = false;
		clearPreparation();
		savedNextReceipt = null;
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
			savedNextReceipt = { summary, pack: result.pack };
			clearPreparation();
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
{:else if pack && preview}
	<WornPage sectionLabel="Step 3 of 3 · Prepare" title={preparationReceipt ? 'Review the proposed next action' : 'Set the next action'} status={workTitle(pack)}>
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
		{#if errorText}
			<WornAlert tone="danger" dismissible dismissLabel="Dismiss next-action error">{errorText}</WornAlert>
		{/if}
		<div class="next-presenter-result">
			<div class="demo-command-lines compact demo-focus-surface" id={NEXT_EDITOR_PREVIEW_ID} data-next-preview data-next-work-id={pack.id} tabindex="-1">
				{#if hasBlocker(preview)}
					<div class="demo-command-line" data-command-field="blocker"><span>Current blocker</span><strong>{blockerText(preview)}</strong></div>
				{/if}
				<div class="demo-command-line" data-command-field="button-runs-next"><span>Proposed next action</span><strong>{effectiveChoice || 'Not set'}</strong></div>
			</div>
			{#if preparationReceipt}
				<div data-webmcp-receipt="next" aria-label="Latest Next WebMCP activity">
					<WornReceipt
						id={NEXT_PREPARATION_RECEIPT_ID}
						summary={preparationReceipt.summary}
						cells={preparationCells}
					/>
				</div>
			{/if}
			{#if savedNextReceipt}
				<WornReceipt
					summary={savedNextReceipt.summary}
					announce={false}
					cells={savedNextCells}
					ondone={() => (savedNextReceipt = null)}
				/>
			{/if}
		</div>
		<p class="next-authority">Review the draft. Nothing changes until you choose Save.</p>

		<div class="demo-inline-form next-action-editor">
			<div class="demo-field">
				<div class="demo-chip-row" role="group" aria-label="Next action choices" data-next-choices>
					{#each NEXT_ACTION_CHOICES as act}
						<WornChip label={act} size="sm" pressed={!showingCustom && effectiveChoice === act}
							onclick={() => setNextEditorChoice(act, 'preset')} />
					{/each}
					<WornChip label="Custom…" size="sm" pressed={effectiveMode === 'custom'}
						onclick={() => { setNextEditorChoice(customValue, 'custom'); scheduleEditorFocus('custom'); }} />
				</div>
				{#if effectiveMode === 'custom'}
					<WornInput id="custom-next-input" aria-label="Custom next action" placeholder="Type a custom next action…" bind:value={choice} oninput={() => { customValue = choice; clearPreparation(); savedNextReceipt = null; }} />
				{/if}
			</div>
			<span id="apply-next-action-help" class="next-save-help">{saveNextHelp}</span>
			<div class="next-save-actions">
				{#if preparationReceipt}
					<WornButton type="button" onclick={discardPreparation}>Discard draft</WornButton>
				{/if}
				<WornButton variant="primary" disabled={busy || !effectiveChoice} aria-describedby="apply-next-action-help" onclick={saveChoice}>
					{busy ? 'Saving…' : preparationReceipt ? 'Approve and save' : 'Save next action'}
				</WornButton>
			</div>
		</div>

		{#each workItemIssues(pack) as v}
			<WornAlert tone="warning">{v.message}</WornAlert>
		{/each}

		{#if otherCandidates.length > 0}
			<WornAccordion label={`Choose another item (${otherCandidates.length})`}>
				<div class="demo-list next-other-list">
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
			</WornAccordion>
		{/if}
	</WornPage>
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
	.next-action-editor {
		align-items: center;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.demo-command-lines.demo-focus-surface {
		--demo-focus-ring-inset: -6px;
		--demo-focus-ring-radius: calc(var(--worn-radius) + 6px);
	}
	.next-presenter-result {
		display: grid;
		gap: 8px;
	}
	.next-action-editor > .demo-field {
		grid-column: 1 / -1;
		min-width: 0;
		width: 100%;
	}
	.next-other-list {
		margin-top: 8px;
	}
	.next-authority,
	.next-save-help {
		color: var(--worn-text-secondary);
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
	}
	.next-authority {
		margin-block-start: 12px;
	}
	.next-save-help {
		display: block;
		min-width: 0;
	}
	.next-save-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
		justify-self: end;
	}
	@media (max-width: 500px) {
		.next-action-editor {
			grid-template-columns: minmax(0, 1fr);
		}
		.next-action-editor > .demo-field {
			grid-column: auto;
		}
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
		.next-save-actions :global(.worn-btn),
		.next-load-more :global(.worn-btn) {
			min-width: 0;
			width: 100%;
		}
		.next-load-more {
			align-items: stretch;
			flex-direction: column;
		}
		.next-save-help {
			flex: 0 0 auto;
		}
		.next-save-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			justify-self: stretch;
			width: 100%;
		}
	}
</style>
