<script lang="ts">
	import { tick } from 'svelte';
	import {
		demoState,
		pendingDraftFingerprint,
		pendingNextActionDraftFor,
		revisePendingNextActionDraftChoice,
		savePendingNextActionDraft,
		discardPendingNextActionDraft,
		setPackNextAction,
		displayToast,
		ChallengeStateError,
		type PendingNextActionDraft
	} from '$lib/demo-client';
	import {
		NEXT_ACTION_CHOICES,
		dueDateLabel,
		dueUrgency,
		evidenceFacts,
		workTitle,
		type DecisionWorkspaceRecommendation,
		type DemoPack,
		type DemoState
	} from '$lib/demo-workflow';
	import { recordWebMcpDraftDecision } from '$lib/webmcp-handoff-store';
	import {
		WornAlert,
		WornBadge,
		WornButton,
		WornCollapsible,
		WornInput,
		WornSelect
	} from '$lib/components';
	import {
		decisionWorkspaceNextHref,
		decisionWorkspaceReviewHref
	} from '$lib/decision-workspace-navigation.mjs';

	type EditorMode = 'preset' | 'custom';
	const CUSTOM_ACTION = '__custom__';
	const NEXT_ACTION_MAX_LENGTH = 200;
	const ACTION_OPTIONS = [
		...NEXT_ACTION_CHOICES.map((value) => ({ value, label: value })),
		{ value: CUSTOM_ACTION, label: 'Custom action…' }
	];

	let {
		recommendation,
		reason,
		decider
	}: {
		recommendation: DecisionWorkspaceRecommendation;
		reason: string;
		decider: string | null;
	} = $props();

	let sourceCount = $derived(recommendation.pack.sources?.length || 0);
	let currentEvidence = $derived(evidenceFacts(recommendation.pack));
	let pendingDraft = $derived(pendingNextActionDraftFor($demoState, recommendation.pack.id));
	let pendingDraftStale = $derived(Boolean(
		pendingDraft &&
		$demoState &&
		pendingDraft.originFingerprint !== pendingDraftFingerprint($demoState, pendingDraft)
	));
	let selectedOption = $state('');
	let customChoice = $state('');
	let editorHydrationKey = $state('');
	let editorPackId = $state('');
	let busy = $state(false);
	let errorText = $state('');
	let outcomeText = $state('');
	let outcomeTarget = $state<HTMLElement | null>(null);
	let editorMode = $derived<EditorMode>(selectedOption === CUSTOM_ACTION ? 'custom' : 'preset');
	let editorChoice = $derived(
		(editorMode === 'custom' ? customChoice : selectedOption).trim().slice(0, NEXT_ACTION_MAX_LENGTH)
	);
	let editorMatchesDraft = $derived(Boolean(
		pendingDraft &&
		!pendingDraftStale &&
		pendingDraft.choice === editorChoice &&
		pendingDraft.mode === editorMode
	));
	let primaryIntent = $derived(editorMatchesDraft ? 'approve' : 'prepare');
	let primaryLabel = $derived(
		busy
			? 'Updating…'
			: editorMatchesDraft
				? 'Approve and save'
				: pendingDraftStale
					? 'Refresh draft'
					: pendingDraft
						? 'Update draft'
						: 'Prepare for approval'
	);
	let draftStatus = $derived(
		pendingDraftStale
			? 'Stale draft · refresh evidence before approval'
			: pendingDraft && !editorMatchesDraft
				? 'Editor changed · update the draft before approval'
				: pendingDraft
					? `${pendingDraft.source === 'webmcp' ? 'Agent-prepared' : 'Human-prepared'} · Not saved · Human approval required`
					: outcomeText
						? outcomeText
						: 'No draft yet · workspace unchanged'
	);

	$effect(() => {
		const draftKey = pendingDraft
			? `${pendingDraft.choice}\u0000${pendingDraft.mode}\u0000${pendingDraft.originFingerprint}`
			: '';
		const nextHydrationKey = `${recommendation.pack.id}\u0000${recommendation.pack.next || ''}\u0000${draftKey}`;
		if (nextHydrationKey === editorHydrationKey) return;
		editorHydrationKey = nextHydrationKey;
		const packChanged = editorPackId !== recommendation.pack.id;
		editorPackId = recommendation.pack.id;
		const initialChoice = pendingDraft?.choice || String(recommendation.pack.next || '').trim() || 'Open';
		const initialMode = pendingDraft?.mode ||
			((NEXT_ACTION_CHOICES as readonly string[]).includes(initialChoice) ? 'preset' : 'custom');
		selectedOption = initialMode === 'preset' ? initialChoice : CUSTOM_ACTION;
		customChoice = initialMode === 'custom' ? initialChoice : '';
		errorText = '';
		if (packChanged) outcomeText = '';
	});

	function evidenceWorkTitle(workId: string): string {
		const candidate = ($demoState?.packs ?? []).find((pack) => pack.id === workId) as DemoPack | undefined;
		return candidate ? workTitle(candidate) : workId;
	}

	function evidenceFieldLabel(field: 'workflow' | 'blocker'): string {
		return field === 'workflow' ? 'Workflow' : 'Blocker';
	}

	function errorMessage(error: unknown, fallback: string): string {
		return error instanceof ChallengeStateError || error instanceof Error
			? error.message
			: fallback;
	}

	function humanDraft(
		state: DemoState,
		choice: string,
		mode: EditorMode
	): PendingNextActionDraft {
		const evidence = [
			{
				workId: recommendation.pack.id,
				field: 'workflow' as const,
				expectedValue: currentEvidence.workflow
			},
			{
				workId: recommendation.pack.id,
				field: 'blocker' as const,
				expectedValue: currentEvidence.blocker
			}
		];
		const draft: PendingNextActionDraft = {
			workId: recommendation.pack.id,
			choice,
			mode,
			evidenceNote: 'Prepared from the verified Work evidence shown in this decision workspace.',
			evidence,
			originFingerprint: 'pending',
			source: 'human'
		};
		draft.originFingerprint = pendingDraftFingerprint(state, draft);
		return draft;
	}

	async function focusOutcome() {
		await tick();
		outcomeTarget?.focus({ preventScroll: true });
	}

	async function prepareDraft() {
		if (busy || !recommendation.pack.id) return;
		if (!editorChoice) {
			errorText = 'Choose or enter a next action before preparing the draft.';
			return;
		}
		const priorDraft = pendingDraft ? structuredClone(pendingDraft) : null;
		const wasStale = pendingDraftStale;
		const state = $demoState;
		if (!state) {
			errorText = 'The browser-local workspace is still loading.';
			return;
		}
		busy = true;
		errorText = '';
		outcomeText = '';
		try {
			const savedState = priorDraft && !wasStale
				? await revisePendingNextActionDraftChoice(recommendation.pack.id, editorChoice, editorMode)
				: await savePendingNextActionDraft(humanDraft(state, editorChoice, editorMode));
			const savedDraft = pendingNextActionDraftFor(savedState, recommendation.pack.id);
			if (!savedDraft || savedDraft.choice !== editorChoice || savedDraft.mode !== editorMode) {
				throw new ChallengeStateError('The prepared draft did not settle.');
			}
			if (wasStale && priorDraft?.source === 'webmcp') {
				recordWebMcpDraftDecision(priorDraft, 'proposal-discarded');
			}
			outcomeText = wasStale
				? 'Fresh draft prepared from current evidence. Workspace unchanged.'
				: 'Draft prepared. Workspace unchanged until you approve Save.';
			displayToast('Draft prepared for approval.', 'success');
		} catch (error) {
			errorText = errorMessage(error, 'Preparing the next-action draft failed.');
		} finally {
			busy = false;
		}
	}

	async function approveDraft() {
		const consumedDraft = pendingDraft ? structuredClone(pendingDraft) : null;
		if (busy || !consumedDraft || !editorMatchesDraft || pendingDraftStale) {
			errorText = pendingDraftStale
				? 'Draft is stale. Refresh it from the current evidence before approval.'
				: 'Prepare the visible action before approving it.';
			return;
		}
		busy = true;
		errorText = '';
		try {
			const result = await setPackNextAction(recommendation.pack.id);
			recordWebMcpDraftDecision(consumedDraft, 'proposal-approved');
			outcomeText = `${result.receipt.summary || 'Next action saved.'} Approved by you.`;
			displayToast(result.receipt.summary || 'Next action saved.', 'success');
			await focusOutcome();
		} catch (error) {
			errorText = errorMessage(error, 'Saving the next action failed.');
		} finally {
			busy = false;
		}
	}

	async function discardDraft() {
		const consumedDraft = pendingDraft ? structuredClone(pendingDraft) : null;
		if (busy || !consumedDraft) return;
		busy = true;
		errorText = '';
		try {
			const state = await discardPendingNextActionDraft(recommendation.pack.id);
			if (pendingNextActionDraftFor(state, recommendation.pack.id)) {
				throw new ChallengeStateError('The pending draft was not discarded.');
			}
			recordWebMcpDraftDecision(consumedDraft, 'proposal-discarded');
			outcomeText = 'Draft discarded. Workspace unchanged.';
			displayToast('Draft discarded. Workspace unchanged.', 'info');
			await focusOutcome();
		} catch (error) {
			errorText = errorMessage(error, 'Discarding the next-action draft failed.');
		} finally {
			busy = false;
		}
	}

	async function handleDecisionSubmit(event: SubmitEvent) {
		event.preventDefault();
		const submitter = event.submitter;
		if (!(submitter instanceof HTMLButtonElement)) return;
		const intent = submitter.dataset.decisionIntent;
		if (intent === 'discard') {
			await discardDraft();
			return;
		}
		if (intent === 'approve') {
			await approveDraft();
			return;
		}
		if (intent === 'prepare') await prepareDraft();
	}
</script>

<section
	class="decision-workspace"
	data-decision-workspace
	data-decision-pack-id={recommendation.pack.id}
	aria-labelledby="decision-workspace-title"
	id="work-decision-workspace"
>
	<div class="decision-workspace-heading">
		<div>
			<h2 id="decision-workspace-title">Decision workspace</h2>
			<p class="decision-workspace-kicker">Needs a decision</p>
		</div>
		<div class="decision-workspace-meta" aria-label="Decision context">
			{#if recommendation.pack.due}<span class="due-{dueUrgency(recommendation.pack)}">{dueDateLabel(recommendation.pack)}</span>{/if}
			{#if recommendation.pack.area}<WornBadge variant="muted" label={recommendation.pack.area} />{/if}
			{#if decider}<span data-decision-workspace-decider>{decider}</span>{/if}
		</div>
		<h3 class="decision-workspace-item-title" data-decision-workspace-title>{workTitle(recommendation.pack)}</h3>
	</div>

	<ol class="decision-workspace-path" aria-label="Find, prove, prepare, decide">
		<li class="is-complete"><span>Find</span><strong>Selected from current Work</strong></li>
		<li class="is-complete"><span>Prove</span><strong>Current evidence visible</strong></li>
		<li class:is-complete={editorMatchesDraft}><span>Prepare</span><strong>{editorMatchesDraft ? 'Draft ready' : 'Choose an action'}</strong></li>
		<li class:is-current={editorMatchesDraft}><span>Decide</span><strong>Human-only Save</strong></li>
	</ol>

	{#if errorText}
		<WornAlert tone="danger" dismissible dismissLabel="Dismiss decision-workspace error">{errorText}</WornAlert>
	{/if}

	<form class="decision-editor" data-decision-editor onsubmit={handleDecisionSubmit}>
		<div class="decision-editor-grid">
			<div class="decision-editor-panel" data-decision-evidence>
				<div class="decision-editor-panel-heading">
					<span>Verified evidence</span>
					<strong>What the decision rests on</strong>
				</div>
				<dl class="decision-evidence-facts">
					<div><dt>Workflow</dt><dd>{currentEvidence.workflow}</dd></div>
					<div><dt>Blocker</dt><dd>{currentEvidence.blocker || 'None'}</dd></div>
					<div><dt>Linked sources</dt><dd>{sourceCount}</dd></div>
				</dl>
				{#if pendingDraft?.evidence.length}
					<div class="decision-draft-evidence" data-decision-draft-evidence>
						<p>{pendingDraft.source === 'webmcp' ? 'Agent-prepared' : 'Human-prepared'} draft cites:</p>
						<ul>
							{#each pendingDraft.evidence as reference (`${reference.workId}:${reference.field}`)}
								<li>
									<strong>{evidenceWorkTitle(reference.workId)}</strong>
									<span>{evidenceFieldLabel(reference.field)}: {reference.expectedValue || 'None'}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<div class="decision-editor-panel decision-editor-action" data-decision-action>
				<div class="decision-editor-panel-heading">
					<span>Proposed next action</span>
					<strong>{editorChoice || pendingDraft?.choice || recommendation.pack.next || 'Not set'}</strong>
				</div>
				<p id="decision-draft-status" class="decision-draft-status" data-decision-draft-status aria-live="polite">{draftStatus}</p>
				{#if pendingDraftStale}
					<WornAlert tone="warning">The work evidence changed after this draft was prepared. Refresh the draft before approval.</WornAlert>
				{/if}

				<div class="decision-editor-field">
					<label for="decision-next-action">Next action</label>
					<WornSelect
						id="decision-next-action"
						aria-label="Choose next action"
						options={ACTION_OPTIONS}
						bind:value={selectedOption}
						disabled={busy}
					/>
				</div>
				{#if editorMode === 'custom'}
					<div class="decision-editor-field">
						<label for="decision-custom-action">Custom next action</label>
						<WornInput
							id="decision-custom-action"
							aria-label="Custom next action"
							placeholder="Describe the next action…"
							maxlength={NEXT_ACTION_MAX_LENGTH}
							bind:value={customChoice}
							disabled={busy}
						/>
					</div>
				{/if}

				<p class="decision-workspace-authority-note" data-decision-workspace-review-required>
					Human review is required before any next action is saved.
				</p>
				<div class="decision-editor-actions">
					{#if pendingDraft}
						<WornButton
							type="submit"
							data-decision-intent="discard"
							disabled={busy}
						>Discard draft</WornButton>
					{/if}
					<WornButton
						type="submit"
						variant="primary"
						data-decision-intent={primaryIntent}
						aria-describedby="decision-draft-status"
						disabled={busy || !editorChoice}
					>{primaryLabel}</WornButton>
				</div>
				<p
					class="decision-outcome"
					data-decision-outcome
					tabindex="-1"
					bind:this={outcomeTarget}
					aria-live="polite"
				>{outcomeText}</p>
			</div>
		</div>
	</form>

	<div class="decision-workspace-explanation">
		<WornCollapsible summary="Why this decision is surfaced">
			<div class="decision-workspace-detail">
				<p data-decision-workspace-reason>{reason}</p>
				<ul class="decision-workspace-signals" aria-label="Current Work view signals">
					<li data-decision-workspace-signal="decisions" data-decision-workspace-signal-count={recommendation.visibleDecisionCount}><strong>{recommendation.visibleDecisionCount}</strong> open {recommendation.visibleDecisionCount === 1 ? 'decision' : 'decisions'} in view</li>
					<li data-decision-workspace-signal="blocked" data-decision-workspace-signal-count={recommendation.visibleBlockedCount}><strong>{recommendation.visibleBlockedCount}</strong> blocked {recommendation.visibleBlockedCount === 1 ? 'item' : 'items'} in view</li>
					<li data-decision-workspace-signal="overdue" data-decision-workspace-signal-count={recommendation.visibleOverdueCount}><strong>{recommendation.visibleOverdueCount}</strong> overdue {recommendation.visibleOverdueCount === 1 ? 'item' : 'items'} in view</li>
					<li data-decision-workspace-signal="sources" data-decision-workspace-signal-count={sourceCount}><strong>{sourceCount}</strong> linked {sourceCount === 1 ? 'source' : 'sources'}</li>
				</ul>
				<p>Review and Next remain available as focused deep links; the core decision can now be completed here.</p>
				<div class="decision-workspace-actions">
					<WornButton data-decision-workspace-review variant="default" size="sm" href={decisionWorkspaceReviewHref(recommendation.pack.id)}>Review in queue</WornButton>
					<WornButton data-decision-workspace-next variant="default" size="sm" href={decisionWorkspaceNextHref(recommendation.pack.id)}>Open full editor</WornButton>
				</div>
			</div>
		</WornCollapsible>
	</div>
</section>

<style>
	.decision-workspace{background:color-mix(in srgb,var(--worn-accent) 8%,var(--worn-surface));border:1px solid color-mix(in srgb,var(--worn-accent) 52%,var(--worn-border));border-radius:var(--worn-radius-md,10px);box-shadow:var(--worn-shadow-sm,0 1px 2px rgb(0 0 0 / 10%));box-sizing:border-box;margin-block:0 18px;max-width:100%;min-width:0;padding:18px;width:100%}
	.decision-workspace-heading{display:grid;gap:7px}
	.decision-workspace-heading>div:first-child{align-items:baseline;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between}
	.decision-workspace-kicker{color:var(--worn-accent);font-size:12px;font-weight:800;letter-spacing:.08em;margin:0;text-transform:uppercase}
	.decision-workspace h2,.decision-workspace h3{margin:0}
	.decision-workspace h2{font-size:16px;line-height:1.15;overflow-wrap:anywhere}
	.decision-workspace .decision-workspace-item-title{font-size:clamp(22px,3vw,30px);line-height:1.12;overflow-wrap:anywhere}
	.decision-workspace-meta{align-items:center;color:var(--worn-text-muted);display:flex;flex-wrap:wrap;gap:8px;font-size:13px;min-width:0}
	.decision-workspace-meta span{min-width:0;overflow-wrap:anywhere}
	.decision-workspace-path{display:grid;gap:8px;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none;margin:16px 0 0;padding:0}
	.decision-workspace-path li{display:grid;gap:2px;min-width:0}
	.decision-workspace-path span{color:var(--worn-link);font-family:var(--font-typewriter);font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
	.decision-workspace-path strong{color:var(--worn-text-muted);font-size:12px;line-height:1.3;overflow-wrap:anywhere}
	.decision-workspace-path li.is-complete strong,.decision-workspace-path li.is-current strong{color:var(--worn-text)}
	.decision-workspace-path li.is-current span{color:var(--worn-accent)}
	.decision-editor{margin-block-start:18px}
	.decision-editor-grid{display:grid;gap:12px;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}
	.decision-editor-panel{background:var(--worn-surface);border:1px solid var(--worn-border);border-radius:var(--worn-radius);box-sizing:border-box;display:grid;gap:14px;min-width:0;padding:14px}
	.decision-editor-panel-heading{display:grid;gap:3px;min-width:0}
	.decision-editor-panel-heading span{color:var(--worn-link);font-size:11px;font-weight:800;letter-spacing:.055em;text-transform:uppercase}
	.decision-editor-panel-heading strong{color:var(--worn-text);font-size:17px;line-height:1.25;overflow-wrap:anywhere}
	.decision-evidence-facts{display:grid;gap:8px;margin:0}
	.decision-evidence-facts div{display:grid;gap:2px;grid-template-columns:minmax(88px,auto) minmax(0,1fr)}
	.decision-evidence-facts dt{color:var(--worn-text-muted);font-size:12px}
	.decision-evidence-facts dd{color:var(--worn-text);font-size:13px;font-weight:600;margin:0;overflow-wrap:anywhere}
	.decision-draft-evidence{display:grid;gap:7px}
	.decision-draft-evidence p{color:var(--worn-text-secondary);font-size:12px;margin:0}
	.decision-draft-evidence ul{display:grid;gap:6px;list-style:none;margin:0;padding:0}
	.decision-draft-evidence li{background:var(--worn-bg);border:1px solid var(--worn-border);border-radius:var(--worn-radius-sm);display:grid;gap:2px;padding:8px 9px}
	.decision-draft-evidence li strong{font-size:12px}
	.decision-draft-evidence li span{color:var(--worn-text-secondary);font-size:12px;overflow-wrap:anywhere}
	.decision-editor-action{align-content:start}
	.decision-draft-status,.decision-outcome,.decision-workspace-authority-note{color:var(--worn-text-secondary);font-size:13px;line-height:1.45;margin:0}
	.decision-editor-field{display:grid;gap:6px}
	.decision-editor-field label{color:var(--worn-text-secondary);font-size:12px;font-weight:700}
	.decision-editor-actions{align-items:center;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
	.decision-outcome:empty{display:none}
	.decision-outcome:focus-visible{outline:2px dashed var(--worn-focus);outline-offset:4px}
	.decision-workspace-explanation{padding-block-start:16px}
	.decision-workspace-detail{display:grid;gap:12px;max-width:100%;min-width:0}
	.decision-workspace-detail p{color:var(--worn-text-secondary);font-size:14px;line-height:1.45;margin:0}
	.decision-workspace-signals{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
	.decision-workspace-signals li{background:var(--worn-surface);border:1px solid var(--worn-border);border-radius:999px;font-size:12px;padding:4px 8px}
	.decision-workspace-signals strong{color:var(--worn-text);font-size:13px}
	.decision-workspace-actions{display:flex;flex-wrap:wrap;gap:8px}
	:global(.decision-workspace .worn-collapsible-trigger){font-size:12px}
	@media(max-width:760px){
		.decision-editor-grid{grid-template-columns:minmax(0,1fr)}
		.decision-workspace-path{grid-template-columns:repeat(2,minmax(0,1fr))}
	}
	@media(max-width:700px){
		.decision-workspace .decision-workspace-item-title{font-size:clamp(20px,7vw,26px)}
	}
	@media(max-width:420px){
		.decision-workspace{padding:13px}
		.decision-workspace-explanation{padding-block-start:12px}
		.decision-editor-actions{align-items:stretch;flex-direction:column}
		.decision-editor-actions :global(.worn-btn),.decision-workspace-actions :global(.worn-btn){justify-content:center;min-width:0;width:100%}
	}
</style>
