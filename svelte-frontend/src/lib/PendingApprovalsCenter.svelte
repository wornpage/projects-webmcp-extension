<script lang="ts">
	import { pendingDraftFingerprint, discardPendingNextActionDraft, displayToast, type PendingNextActionDraft } from '$lib/demo-client';
	import { evidenceFacts, isOpenDecision, workTitle, type DemoPack } from '$lib/demo-workflow';
	import { pendingDecisionWorkHref } from '$lib/decision-workspace-navigation.mjs';
	import { WornAlert, WornButton, WornDialog } from '$lib/components';

	interface Props {
		open: boolean;
		drafts: PendingNextActionDraft[];
		packs: DemoPack[];
	}

	let { open = $bindable(), drafts, packs }: Props = $props();
	let busyId = $state('');

	function packFor(workId: string): DemoPack | null {
		return packs.find((pack) => pack.id === workId) || null;
	}

	function draftStatus(draft: PendingNextActionDraft): 'fresh' | 'stale' | 'orphaned' {
		const origin = packFor(draft.workId);
		if (!origin || draft.evidence.some((fact) => !packFor(fact.workId))) return 'orphaned';
		const state = { packs, pendingNextActionDrafts: drafts };
		return pendingDraftFingerprint(state, draft) === draft.originFingerprint ? 'fresh' : 'stale';
	}

	async function discard(workId: string) {
		if (busyId) return;
		busyId = workId;
		try {
			await discardPendingNextActionDraft(workId);
			displayToast('Pending approval discarded.', 'success');
		} catch (error) {
			displayToast(error instanceof Error ? error.message : 'Pending approval could not be discarded.', 'error');
		} finally {
			busyId = '';
		}
	}
</script>

<WornDialog bind:open title={`Pending approvals (${drafts.length})`} size="md">
	<div class="pending-center-intro">Every proposal remains unsaved until you approve it on Next or, for an explicit open decision, directly in Work. Evidence is checked against the current workspace.</div>
	{#if drafts.length === 0}
		<p class="pending-center-empty">No pending approvals.</p>
	{:else}
		<div class="pending-center-list" role="list" aria-label="Pending approval proposals">
			{#each drafts as draft (draft.workId)}
				{@const pack = packFor(draft.workId)}
				{@const status = draftStatus(draft)}
				{@const workResumeHref = pack && isOpenDecision(pack) ? pendingDecisionWorkHref(draft.workId) : null}
				<article class="pending-center-item" role="listitem">
					<div class="pending-center-head">
						<div><h3>{pack ? workTitle(pack) : `Missing work item ${draft.workId}`}</h3><span>{draft.source === 'webmcp' ? 'Prepared by browser agent' : 'Prepared by you'} · {draft.mode === 'custom' ? 'Custom action' : 'Preset action'}</span></div>
						<strong class:status-fresh={status === 'fresh'} class:status-stale={status !== 'fresh'}>{status}</strong>
					</div>
					<div class="pending-center-action"><span>Proposed action</span><b>{draft.choice}</b></div>
					{#if status === 'orphaned'}
						<WornAlert tone="warning">This proposal references work that no longer exists. Discard it to clear the orphan.</WornAlert>
					{:else if status === 'stale'}
						<WornAlert tone="warning">Workspace facts changed. Re-prepare this proposal before saving.</WornAlert>
					{:else}
						<div class="pending-center-evidence"><span>Verified evidence</span><p>{draft.evidenceNote || `${evidenceFacts(pack!).workflow} is still current.`}</p></div>
					{/if}
					<div class="pending-center-actions">
						{#if workResumeHref}
							<WornButton
								variant="primary"
								size="sm"
								href={workResumeHref}
								aria-label={`Open ${pack ? workTitle(pack) : draft.workId} in the Work decision workspace`}
								data-pending-work-resume
								onclick={() => (open = false)}
							>Open in Work</WornButton>
						{/if}
						<WornButton size="sm" href={`/next?pack=${encodeURIComponent(draft.workId)}`} onclick={() => (open = false)}>Review on Next</WornButton>
						<WornButton size="sm" variant="danger" type="button" disabled={busyId === draft.workId} onclick={() => discard(draft.workId)}>{busyId === draft.workId ? 'Discarding…' : 'Discard'}</WornButton>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</WornDialog>

<style>
	.pending-center-intro { color: var(--worn-text-secondary); font-size: 14px; line-height: 1.5; margin-bottom: 14px; }
	.pending-center-list { display: grid; gap: 12px; max-height: min(70vh, 680px); overflow: auto; }
	.pending-center-item { border: 1px solid var(--worn-border); border-radius: var(--worn-radius-sm); display: grid; gap: 10px; padding: 12px; }
	.pending-center-head { align-items: start; display: flex; gap: 12px; justify-content: space-between; }
	.pending-center-head h3 { font-size: 16px; margin: 0 0 3px; }
	.pending-center-head span, .pending-center-action span, .pending-center-evidence span { color: var(--worn-text-muted); font-size: 12px; }
	.pending-center-head strong { border: 1px solid var(--worn-border); border-radius: 999px; font-size: 11px; padding: 3px 7px; text-transform: capitalize; }
	.status-fresh { color: var(--worn-success-text); }
	.status-stale { color: var(--worn-warning-text); }
	.pending-center-action, .pending-center-evidence { display: grid; gap: 3px; }
	.pending-center-evidence p { margin: 0; }
	.pending-center-actions { display: flex; flex-wrap: wrap; gap: 8px; }
	.pending-center-empty { color: var(--worn-text-secondary); }
	@media (max-width: 500px) {
		.pending-center-head { align-items: stretch; flex-direction: column; }
		.pending-center-head strong { justify-self: start; width: fit-content; }
		.pending-center-actions :global(.worn-btn) { flex: 1 1 100%; width: 100%; }
	}
</style>
