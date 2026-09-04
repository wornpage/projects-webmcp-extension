<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import {
		demoState,
		demoStateError,
		refreshDemoState,
		setPackNextAction,
		savePendingNextActionDraft,
		revisePendingNextActionDraftChoice,
		discardPendingNextActionDraft,
		restorePendingNextActionDraft,
		pendingNextActionDraftFor,
		pendingDraftFingerprint,
		setSelectedWork,
		displayToast,
		ChallengeStateError,
		type PendingNextActionDraft
	} from '$lib/demo-client';
	import {
		NEXT_ACTION_CHOICES,
		nextChoiceForwardPath,
		blockerText,
		evidenceFacts,
		isReview,
		hasBlocker,
		isOpenDecision,
		workTitle,
		type DemoPack
	} from '$lib/demo-workflow';
	import {
		WornAlert,
		WornButton,
		WornChip,
		WornEmpty,
		WornError,
		WornInput,
		WornPage,
		WornReceipt,
		WornCollapsible
	} from '$lib/components';
	import { workItemIssues } from '$lib/work-item-issues';
	import { focusAndPulse } from '$lib/focus-pulse.mjs';
	import {
		DECISION_WORKSPACE_CONTEXT,
		DECISION_WORKSPACE_CONTEXT_REASON,
		decisionWorkspaceContextDecider,
		decisionWorkspaceContextPackId
	} from '$lib/decision-workspace-navigation.mjs';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import { recordWebMcpDraftDecision, recordWebMcpHandoffStep } from '$lib/webmcp-handoff-store';
	import WebMcpActivityStrip from '$lib/WebMcpActivityStrip.svelte';
	import NextCandidatePicker from './NextCandidatePicker.svelte';
	import NextWorkContext from './NextWorkContext.svelte';
	import {
		NEXT_ACTION_MAX_LENGTH,
		NEXT_EDITOR_PREVIEW_ID,
		NEXT_PREPARATION_RECEIPT_ID,
		NEXT_PREPARATION_SUMMARY,
		PREPARE_NEXT_ACTION_TOOL_NAME,
		createNextDraftRevisionState,
		createCurrentNextEditorTool,
		createPrepareNextActionTool,
		evidenceMatchesReferences,
		nextDraftTerminalAvailable,
		nextEditorPageView,
		reviseNextDraft,
		runSettledNextDraftAction,
		verifiedNextEvidenceNote,
		verifyNextPreparationEvidence,
		shouldHydratePendingDraft
	} from './next-webmcp.mjs';

	type NextEditorMode = 'preset' | 'custom';
	type NextEvidenceField = 'workflow' | 'blocker';
	type NextEvidenceReference = {
		workId: string;
		field: NextEvidenceField;
		expectedValue: string | null;
	};
	type NextVerifiedEvidence = {
		work: { id: string; title: string };
		field: NextEvidenceField;
		label: string;
		value: string | null;
	};
	type PrepareNextActionInput = {
		choice: string;
		expectedMode: NextEditorMode;
		expectedChoice: string;
		evidence: NextEvidenceReference[];
	};
	type PreparationReceipt = {
		summary: string;
		work: { id: string; title: string };
		evidenceNote: string;
		evidence: NextVerifiedEvidence[];
		preparedAction: string;
		workspaceChanged: false;
		requiresHumanSave: true;
	};
	type EditorSnapshot = { mode: NextEditorMode; choice: string };
	type SavedNextReceipt = { summary: string; pack: DemoPack };
	type DecisionWorkspaceContext = {
		mode: 'decision-workspace';
		reason: string;
		decider: string | null;
	};
	type NextPreparationSnapshot = {
		choice: string;
		customValue: string;
		showingCustom: boolean;
		preparationReceipt: PreparationReceipt | null;
		preparationPreviousEditor: EditorSnapshot | null;
		savedNextReceipt: SavedNextReceipt | null;
		pendingDraft: PendingNextActionDraft | null;
		invocationWorkId: string;
		preparationInFlight: boolean;
	};
	type HumanRevisionSnapshot = {
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
	let preparationInFlight = $state(false);
	let draftRevision = $state(createNextDraftRevisionState());
	let preparationPreviousEditor = $state<EditorSnapshot | null>(null);
	let savedNextReceipt = $state<SavedNextReceipt | null>(null);
	let editorPackId = $state('');
	let editorFocusRequest = 0;
	let saveFocusFrame: number | null = null;
	let stopNextWebMcp: (() => void) | null = null;
	let packs = $derived(
		(($demoState?.packs ?? []) as DemoPack[]).filter((candidate) => candidate.archived !== true)
	);
	let requestedPackId = $derived(browser ? ($page.url.searchParams.get('pack') || '') : '');
	let decisionWorkspaceContextId = $derived(
		browser ? decisionWorkspaceContextPackId($page.url.searchParams) : ''
	);
	// Work and Review link here with an explicit ?pack= selection.
	let selectedId = $derived(
		chosenPackId ||
			// The prerender has no browser URL; hydration resolves the real query.
			requestedPackId ||
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
	let visiblePackId = $derived(pack?.id || '');
	let pendingDraft = $derived(pendingNextActionDraftFor($demoState, visiblePackId));
	let pendingDraftStale = $derived(pendingDraft ? pendingDraft.originFingerprint !== pendingDraftFingerprint($demoState!, pendingDraft) : false);
	// Only declare not-found once the demo state has landed — until then the
	// requested pack may simply not have arrived yet.
	let notFound = $derived(Boolean(selectedId) && demoLoaded && !pack);
	let loadingSelected = $derived(Boolean(selectedId) && !demoLoaded && !pack);
	let decisionWorkspaceContext = $derived.by((): DecisionWorkspaceContext | null => {
		if (!pack?.id || pack.id !== requestedPackId || pack.id !== decisionWorkspaceContextId || !isOpenDecision(pack)) return null;
		const decider = decisionWorkspaceContextDecider(pack.decider);
		return {
			mode: DECISION_WORKSPACE_CONTEXT,
			reason: DECISION_WORKSPACE_CONTEXT_REASON,
			decider
		};
	});
	// The editor previews the pack AS IF the current choice were saved, so the
	// fact lines and help always show what the main button will really run.
	let effectiveChoice = $derived(showingCustom ? choice.trim() : choice || defaultChoiceFor(pack));
	let effectiveMode = $derived<NextEditorMode>(
		showingCustom || !(NEXT_ACTION_CHOICES as readonly string[]).includes(effectiveChoice)
			? 'custom'
			: 'preset'
	);
	let routeBusy = $derived(busy || preparationInFlight || draftRevision.pending);
	let terminalDraftAvailable = $derived(nextDraftTerminalAvailable(draftRevision, {
		busy: busy || preparationInFlight,
		stale: pendingDraftStale,
		choice: effectiveChoice,
		mode: effectiveMode,
		draft: pendingDraft
	}));
	let previewChoice = $derived(effectiveChoice || defaultChoiceFor(pack));
	let preview = $derived(
		pack ? ({ ...pack, ...nextChoiceForwardPath(pack, previewChoice) } as DemoPack) : null
	);
	let currentNextEditor = $derived.by(() => {
		if (!pack?.id || !preview) return null;
		return nextEditorPageView({
			work: { id: pack.id, title: workTitle(pack) },
			decisionContext: decisionWorkspaceContext,
			presetChoices: NEXT_ACTION_CHOICES,
			editor: { mode: effectiveMode, choice: effectiveChoice },
			preview: {
				blocker: hasBlocker(preview) ? blockerText(preview) : null,
				nextAction: effectiveChoice || 'Not set'
			},
			preparationReceipt: preparationReceipt && pendingDraft?.source === 'webmcp' ? preparationReceipt : null,
			canSave: terminalDraftAvailable,
			staleReason: pendingDraftStale
				? 'Draft is stale. Refresh the evidence and prepare it again before approval.'
				: draftRevision.pending
					? 'The visible draft change is still being saved.'
					: pendingDraft && !terminalDraftAvailable
						? 'The visible editor does not match the settled pending draft.'
						: pendingDraft ? null : 'No pending draft. Choose an action to create one before approval.',
			busy: routeBusy
		});
	});
	let preparationCells = $derived(preparationReceipt ? [
		{ label: 'Verified evidence', value: preparationReceipt.evidenceNote },
		{ label: 'Status', value: 'Draft — waiting for your approval' },
		{ label: 'Save', value: 'Not saved' }
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
		if (!pendingDraft) return `Choose or confirm an action to create a draft for ${workTitle(pack)}.`;
		if (pendingDraftStale) return 'This draft is stale. Refresh the evidence before approval.';
		if (draftRevision.pending) return 'Wait for the visible draft change to finish saving.';
		if (!terminalDraftAvailable) return 'Finish saving the visible draft before approval.';
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
		], {
			onResult: ({ toolName, result }) => {
				if (toolName !== PREPARE_NEXT_ACTION_TOOL_NAME) return;
				const outcome = result as {
					next: {
						preparationReceipt: {
							preparedAction: string;
							evidence: unknown[];
							workspaceChanged: false;
						};
					};
				};
				recordWebMcpHandoffStep({
					id: 'next-proposal',
					title: 'Next prepared',
					summary: `Unsaved · ${outcome.next.preparationReceipt.preparedAction}`,
					status: 'complete',
					outcome: 'proposal-prepared'
				});
				recordWebMcpHandoffStep({
					id: 'human-decision',
					title: 'Human decision',
					summary: 'Pending approval',
					status: 'pending',
					outcome: 'proposal-pending'
				});
			}
		});
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

	function savedEditorBaseline(target: DemoPack | null): EditorSnapshot {
		const choice = defaultChoiceFor(target);
		return { choice, mode: (NEXT_ACTION_CHOICES as readonly string[]).includes(choice) ? 'preset' : 'custom' };
	}

	function clearPreparation() {
		preparationReceipt = null;
		preparationPreviousEditor = null;
	}

	function preparationFromPending(draft: PendingNextActionDraft): PreparationReceipt {
		const evidence = draft.evidence.map((reference) => {
			const candidate = packs.find((item) => item.id === reference.workId);
			return {
				work: { id: reference.workId, title: candidate ? workTitle(candidate) : reference.workId },
				field: reference.field,
				label: reference.field === 'workflow' ? 'Workflow' : 'Blocker',
				value: reference.expectedValue
			};
		}) as NextVerifiedEvidence[];
		return { summary: NEXT_PREPARATION_SUMMARY, work: { id: draft.workId, title: pack ? workTitle(pack) : draft.workId }, evidenceNote: draft.evidenceNote, evidence, preparedAction: draft.choice, workspaceChanged: false, requiresHumanSave: true };
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
			savedNextReceipt,
			pendingDraft: pendingDraft ? structuredClone(pendingDraft) : null,
			invocationWorkId: pack?.id || '',
			preparationInFlight
		};
	}

	async function restoreNextPreparationSnapshot(snapshot: NextPreparationSnapshot) {
		choice = snapshot.choice;
		customValue = snapshot.customValue;
		showingCustom = snapshot.showingCustom;
		preparationReceipt = clonePreparationReceipt(snapshot.preparationReceipt);
		preparationPreviousEditor = snapshot.preparationPreviousEditor ? { ...snapshot.preparationPreviousEditor } : null;
		savedNextReceipt = snapshot.savedNextReceipt;
		preparationInFlight = snapshot.preparationInFlight;
		if (snapshot.invocationWorkId) await restorePendingNextActionDraft(snapshot.invocationWorkId, snapshot.pendingDraft);
	}

	function captureHumanRevisionSnapshot(): HumanRevisionSnapshot {
		return {
			choice,
			customValue,
			showingCustom,
			preparationReceipt: clonePreparationReceipt(preparationReceipt),
			preparationPreviousEditor: preparationPreviousEditor ? { ...preparationPreviousEditor } : null,
			savedNextReceipt
		};
	}

	function restoreHumanRevisionSnapshot(snapshot: HumanRevisionSnapshot) {
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

	async function setHumanNextEditorChoice(nextChoice: string, mode: NextEditorMode): Promise<boolean> {
		if (busy || preparationInFlight || draftRevision.pending || !pack?.id) return false;
		const boundedChoice = nextChoice.slice(0, NEXT_ACTION_MAX_LENGTH);
		const pendingChoice = boundedChoice.trim();
		if (!pendingChoice) {
			if (!preparationPreviousEditor) preparationPreviousEditor = savedEditorBaseline(pack);
			setNextEditorChoice(boundedChoice, mode, false);
			errorText = '';
			return false;
		}
		const workId = pack.id;
		const outcome = await reviseNextDraft(draftRevision, {
			capture: captureHumanRevisionSnapshot,
			preview: () => {
				if (!preparationPreviousEditor) preparationPreviousEditor = savedEditorBaseline(pack);
				setNextEditorChoice(boundedChoice, mode, false);
				errorText = '';
			},
			persist: async () => {
				const state = await revisePendingNextActionDraftChoice(workId, pendingChoice, mode);
				const revisedDraft = pendingNextActionDraftFor(state, workId);
				if (!revisedDraft || revisedDraft.choice !== pendingChoice || revisedDraft.mode !== mode) {
					throw new ChallengeStateError('The pending draft change did not settle.');
				}
				return revisedDraft;
			},
			settle: (revisedDraft) => {
				setNextEditorChoice(boundedChoice, mode, false);
				preparationReceipt = preparationFromPending(revisedDraft);
			},
			rollback: restoreHumanRevisionSnapshot,
			reject: () => {
				errorText = 'The draft change was not saved. Your previous draft is still pending.';
			}
		});
		return outcome.status === 'settled';
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

	$effect(() => {
		const draft = pendingDraft;
		if (!draft || !shouldHydratePendingDraft({ preparationInFlight: preparationInFlight || draftRevision.pending, pendingDraft: draft, visibleWorkId: pack?.id || '', preparationReceipt })) return;
		preparationPreviousEditor = savedEditorBaseline(pack);
		preparationReceipt = preparationFromPending(draft);
		setNextEditorChoice(draft.choice, draft.mode, false);
	});

	async function prepareNextActionFromWebMcp(
		input: PrepareNextActionInput,
		invocation: { markMutated: () => void }
	) {
		if (routeBusy) throw new Error('Prepare next action is unavailable while Next is updating.');
		const current = currentNextEditor;
		if (!current) throw new Error('Prepare next action requires a visible Next editor.');
		const desiredMode: NextEditorMode = (NEXT_ACTION_CHOICES as readonly string[]).includes(input.choice)
			? 'preset'
			: 'custom';
		const verifiedEvidence = verifyNextPreparationEvidence(
			input.evidence,
			packs.map((candidate) => ({
				id: candidate.id,
				title: workTitle(candidate),
				...evidenceFacts(candidate)
			})),
			current.work.id
		) as NextVerifiedEvidence[];
		const evidenceNote = verifiedNextEvidenceNote(verifiedEvidence);
		const alreadyDesired = current.editor.mode === desiredMode && current.editor.choice === input.choice;
		const receiptAlreadyDesired = preparationReceipt?.preparedAction === input.choice &&
			preparationReceipt.evidenceNote === evidenceNote &&
			evidenceMatchesReferences(preparationReceipt.evidence, input.evidence) &&
			preparationReceipt.work.id === current.work.id;
		const matchesExpected = current.editor.mode === input.expectedMode && current.editor.choice === input.expectedChoice;
		if (!alreadyDesired && !matchesExpected) {
			throw new Error('Prepare next action rejected stale Next editor state.');
		}
		const pending: PendingNextActionDraft = {
			workId: current.work.id,
			choice: input.choice,
			mode: desiredMode,
			evidenceNote,
			evidence: input.evidence,
			originFingerprint: pendingDraftFingerprint($demoState!, { workId: current.work.id, choice: input.choice, mode: desiredMode, evidenceNote, evidence: input.evidence, originFingerprint: 'pending', source: 'webmcp' }),
			source: 'webmcp'
		};
		invocation.markMutated();
		preparationInFlight = true;
		if (!preparationReceipt) preparationPreviousEditor = savedEditorBaseline(pack);
		setNextEditorChoice(input.choice, desiredMode, false);
		preparationReceipt = {
			summary: NEXT_PREPARATION_SUMMARY,
			work: current.work,
			evidenceNote,
			evidence: verifiedEvidence,
			preparedAction: input.choice,
			workspaceChanged: false,
			requiresHumanSave: true
		};
		await savePendingNextActionDraft(pending);
		await tick();
		const target = document.getElementById(NEXT_PREPARATION_RECEIPT_ID);
		if (!(target instanceof HTMLElement)) throw new Error('Prepare next action could not find its visible preview.');
		const focusReceipt = focusAndPulse(target, {
			behavior: 'auto',
			block: 'center',
			requireVisibleFocus: true
		});
		if (!currentNextEditor) throw new Error('Prepare next action could not verify the visible editor.');
		preparationInFlight = false;
		return {
			changed: !alreadyDesired || !receiptAlreadyDesired,
			focus: { id: NEXT_PREPARATION_RECEIPT_ID, ...focusReceipt },
			next: currentNextEditor
		};
	}

	async function discardPreparation() {
		if (!pack?.id) return;
		const workId = pack.id;
		try {
			await runSettledNextDraftAction(draftRevision, {
				busy: busy || preparationInFlight,
				stale: pendingDraftStale,
				choice: effectiveChoice,
				mode: effectiveMode,
				draft: pendingDraft,
				start: () => {
					busy = true;
					errorText = '';
				},
				finish: () => (busy = false),
				action: async (consumedDraft) => {
					const previous = preparationPreviousEditor;
					await discardPendingNextActionDraft(workId);
					clearPreparation();
					recordWebMcpDraftDecision(consumedDraft, 'proposal-discarded');
					if (previous) {
						setNextEditorChoice(previous.choice, previous.mode, false);
						await scheduleEditorFocus(previous.mode === 'custom' ? 'custom' : 'choices');
					}
				}
			});
		} catch (error) {
			errorText = error instanceof ChallengeStateError ? error.message : 'Discarding the pending draft failed.';
		}
	}

	function editPack(candidate: DemoPack) {
		if (!candidate.id || routeBusy) return;
		chosenPackId = candidate.id;
		choice = '';
		customValue = '';
		showingCustom = false;
		clearPreparation();
		savedNextReceipt = null;
		errorText = '';
		// Keep the browser-local selection in step with the visible editor.
		setSelectedWork(candidate.id).catch((e) => console.warn('Failed to sync selected work:', e));
		displayToast(`Editing next action for ${workTitle(candidate)}`, 'success');
		// A new work item always starts at the bounded choice group.
		scheduleEditorFocus('choices');
	}

	async function saveChoice() {
		if (!pack?.id || !effectiveChoice) return;
		if (pendingDraft && pendingDraftStale) {
			errorText = 'Draft is stale. Refresh the evidence and prepare it again before approval.';
			return;
		}
		const workId = pack.id;
		try {
			await runSettledNextDraftAction(draftRevision, {
				busy: busy || preparationInFlight,
				stale: pendingDraftStale,
				choice: effectiveChoice,
				mode: effectiveMode,
				draft: pendingDraft,
				start: () => {
					busy = true;
					errorText = '';
					if (saveFocusFrame !== null) cancelAnimationFrame(saveFocusFrame);
					saveFocusFrame = null;
				},
				finish: () => (busy = false),
				action: async (consumedDraft) => {
					const result = await setPackNextAction(workId);
					const summary = result?.receipt?.summary || `Next action saved: ${consumedDraft.choice}.`;
					savedNextReceipt = { summary, pack: result.pack };
					clearPreparation();
					recordWebMcpDraftDecision(consumedDraft, 'proposal-approved');
					displayToast(summary, 'success');
					// Land focus on the preview so keyboard users land on the updated
					// state — the /next analogue of the pack page's afterSave receipt
					// focus. The save button itself would keep focus with no move.
					saveFocusFrame = requestAnimationFrame(() => {
						saveFocusFrame = null;
						const el = document.querySelector('[data-next-preview]') as HTMLElement | null;
						if (!el) return;
						focusAndPulse(el, { behavior: 'smooth', block: 'center' });
					});
				}
			});
		} catch (error) {
			errorText =
				error instanceof ChallengeStateError ? error.message : 'Saving the next action failed.';
		}
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
	<WornPage sectionLabel="Step 3 of 3 · Prepare" title={preparationReceipt ? 'Review the proposed next action' : 'Set the next action'}>
		<NextWorkContext workTitle={workTitle(pack)} decisionContext={decisionWorkspaceContext} />
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
		{#if errorText}
			<WornAlert tone="danger" dismissible dismissLabel="Dismiss next-action error">{errorText}</WornAlert>
		{/if}
		{#if preparationReceipt && pendingDraft?.source === 'webmcp'}
			<WebMcpActivityStrip
				id={NEXT_PREPARATION_RECEIPT_ID}
				route="next"
				outcome="Draft prepared — waiting for your approval."
				toolName={PREPARE_NEXT_ACTION_TOOL_NAME}
				cells={preparationCells}
			/>
		{:else if pendingDraft?.source === 'human'}
			<WornAlert tone="info">Draft prepared by you. The Next action remains unsaved until you approve Save.</WornAlert>
		{/if}
		<div class="next-presenter-result">
			<div class="demo-command-lines compact demo-focus-surface" id={NEXT_EDITOR_PREVIEW_ID} data-next-preview data-next-work-id={pack.id} tabindex="-1">
				{#if hasBlocker(preview)}
					<div class="demo-command-line" data-command-field="blocker"><span>Current blocker</span><strong>{blockerText(preview)}</strong></div>
				{/if}
				<div class="demo-command-line" data-command-field="button-runs-next"><span>Proposed next action</span><strong>{effectiveChoice || 'Not set'}</strong></div>
			</div>
			{#if savedNextReceipt}
				<WornReceipt
					summary={savedNextReceipt.summary}
					announce={false}
					cells={savedNextCells}
					ondone={() => (savedNextReceipt = null)}
				/>
			{/if}
		</div>
		<p class="next-authority"><strong>Draft:</strong> {savedNextReceipt ? 'none · completed' : pendingDraft ? pendingDraftStale ? 'stale' : 'pending approval' : 'none'} · <strong>Workspace:</strong> {savedNextReceipt ? 'updated' : 'unchanged'} · <strong>Authority:</strong> {savedNextReceipt ? 'saved and approved by the person' : pendingDraft ? 'only you can approve Save' : 'create a draft before approval'}.</p>
		{#if pendingDraftStale}
			<WornAlert tone="warning">Draft is stale. Refresh the visible work and re-prepare before approval; this draft cannot be saved.</WornAlert>
		{/if}

		<div class="demo-inline-form next-action-editor">
			<div class="demo-field">
				<div class="demo-chip-row" role="group" aria-label="Next action choices" aria-busy={routeBusy} data-next-choices>
					{#each NEXT_ACTION_CHOICES as act}
						<WornChip label={act} size="sm" pressed={!showingCustom && effectiveChoice === act}
							onclick={async () => { await setHumanNextEditorChoice(act, 'preset'); }} />
					{/each}
					<WornChip label="Custom…" size="sm" pressed={effectiveMode === 'custom'}
						onclick={async () => { await setHumanNextEditorChoice(customValue, 'custom'); await scheduleEditorFocus('custom'); }} />
				</div>
				{#if effectiveMode === 'custom'}
					<WornInput
						id="custom-next-input"
						aria-label="Custom next action"
						placeholder="Type a custom next action…"
						maxlength={NEXT_ACTION_MAX_LENGTH}
						value={choice}
						disabled={routeBusy}
						oninput={async (event) => { await setHumanNextEditorChoice((event.currentTarget as HTMLInputElement).value, 'custom'); }} />
				{/if}
			</div>
			<span id="apply-next-action-help" class="next-save-help">{saveNextHelp}</span>
			<div class="next-save-actions">
				{#if preparationReceipt}
					<WornButton type="button" disabled={!terminalDraftAvailable} onclick={discardPreparation}>Discard draft</WornButton>
				{/if}
				<WornButton variant="primary" disabled={!terminalDraftAvailable} aria-describedby="apply-next-action-help" onclick={saveChoice}>
					{draftRevision.pending ? 'Updating draft…' : busy ? 'Saving…' : preparationReceipt ? 'Approve and save' : 'Save next action'}
				</WornButton>
			</div>
		</div>

		<WornCollapsible summary="Advanced options">
			{#if workItemIssues(pack).length > 0}
				<div class="next-item-warnings" data-next-item-warnings>
					{#each workItemIssues(pack) as v}
						<WornAlert tone="warning">{v.message}</WornAlert>
					{/each}
				</div>
			{/if}

			<NextCandidatePicker {packs} currentPackId={pack.id || ''} onedit={editPack} />
		</WornCollapsible>
	</WornPage>
{:else}
	<WornPage title="Next actions">
		{#if $demoStateError}
			<WornError message="Could not load next actions" detail={$demoStateError} onretry={refreshNext} />
		{/if}
		<WornEmpty
			title="No sample work available"
			description="Choose a work item in Work or load the challenge sample before preparing next actions."
		>
			<WornButton variant="primary" href="/webmcp-challenge">Open guide</WornButton>
			<WornButton href="/work">Open Work</WornButton>
		</WornEmpty>
	</WornPage>
{/if}

<style>
	/* Inline style attributes are blocked by the shared CSP — scoped classes. */
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
		min-width: 0;
	}
	.next-action-editor > .demo-field {
		grid-column: 1 / -1;
		min-width: 0;
		width: 100%;
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
	.next-item-warnings {
		display: grid;
		gap: 8px;
		margin-block-start: 16px;
		max-inline-size: 100%;
		min-inline-size: 0;
	}
	@media (max-width: 500px) {
		.next-action-editor {
			grid-template-columns: minmax(0, 1fr);
		}
		.next-action-editor > .demo-field {
			grid-column: auto;
		}
		.demo-inline-form {
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
		.next-save-actions :global(.worn-btn) {
			min-width: 0;
			width: 100%;
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
