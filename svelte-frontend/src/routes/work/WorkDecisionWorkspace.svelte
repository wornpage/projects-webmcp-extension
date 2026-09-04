<script lang="ts">
	import { WornBadge, WornButton, WornCollapsible } from '$lib/components';
	import {
		dueDateLabel,
		dueUrgency,
		workTitle,
		type DecisionWorkspaceRecommendation
	} from '$lib/demo-workflow';
	import {
		decisionWorkspaceNextHref,
		decisionWorkspaceReviewHref
	} from '$lib/decision-workspace-navigation.mjs';

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
</script>

<section
	class="decision-workspace"
	data-decision-workspace
	data-decision-pack-id={recommendation.pack.id}
	aria-labelledby="decision-workspace-title"
	id="work-decision-workspace"
>
	<div class="decision-workspace-heading">
		<h2 id="decision-workspace-title">Decision workspace</h2>
		<p class="decision-workspace-kicker">Needs a decision</p>
		<h3 class="decision-workspace-item-title" data-decision-workspace-title>{workTitle(recommendation.pack)}</h3>
		<div class="decision-workspace-meta" aria-label="Decision context">
			{#if recommendation.pack.due}<span class="due-{dueUrgency(recommendation.pack)}">{dueDateLabel(recommendation.pack)}</span>{/if}
			{#if recommendation.pack.area}<WornBadge variant="muted" label={recommendation.pack.area} />{/if}
			{#if decider}<span data-decision-workspace-decider>{decider}</span>{/if}
		</div>
	</div>
	<div class="decision-workspace-primary">
		<p class="decision-workspace-authority-note">Human review is required before any next action is saved.</p>
		<WornButton data-decision-workspace-next variant="primary" href={decisionWorkspaceNextHref(recommendation.pack.id)}>Set next action</WornButton>
	</div>

	<div class="decision-workspace-rationale">
		<WornCollapsible summary="Why this decision is surfaced">
			<div class="decision-workspace-detail">
				<p data-decision-workspace-reason>{reason}</p>
				<ul class="decision-workspace-signals" aria-label="Current Work view signals">
					<li data-decision-workspace-signal="decisions" data-decision-workspace-signal-count={recommendation.visibleDecisionCount}><strong>{recommendation.visibleDecisionCount}</strong> open {recommendation.visibleDecisionCount === 1 ? 'decision' : 'decisions'} in view</li>
					<li data-decision-workspace-signal="blocked" data-decision-workspace-signal-count={recommendation.visibleBlockedCount}><strong>{recommendation.visibleBlockedCount}</strong> blocked {recommendation.visibleBlockedCount === 1 ? 'item' : 'items'} in view</li>
					<li data-decision-workspace-signal="overdue" data-decision-workspace-signal-count={recommendation.visibleOverdueCount}><strong>{recommendation.visibleOverdueCount}</strong> overdue {recommendation.visibleOverdueCount === 1 ? 'item' : 'items'} in view</li>
					<li data-decision-workspace-signal="sources" data-decision-workspace-signal-count={sourceCount}><strong>{sourceCount}</strong> linked {sourceCount === 1 ? 'source' : 'sources'}</li>
				</ul>
				<div class="decision-workspace-authority">
					<p>Review this item in the review queue before deciding how to proceed.</p>
				</div>
				<div class="decision-workspace-actions">
					<WornButton data-decision-workspace-review variant="default" size="sm" href={decisionWorkspaceReviewHref(recommendation.pack.id)}>Review in queue</WornButton>
				</div>
			</div>
		</WornCollapsible>
	</div>
</section>

<style>
	.decision-workspace{background:color-mix(in srgb,var(--worn-accent) 10%,var(--worn-surface));border:1px solid color-mix(in srgb,var(--worn-accent) 58%,var(--worn-border));border-radius:var(--worn-radius-md,10px);box-shadow:var(--worn-shadow-sm,0 1px 2px rgb(0 0 0 / 10%));box-sizing:border-box;margin-block:0 14px;max-width:100%;min-width:0;padding:16px;width:100%}
	.decision-workspace-heading{display:grid;gap:5px}
	.decision-workspace-kicker{color:var(--worn-accent);font-size:12px;font-weight:800;letter-spacing:.08em;margin:0;text-transform:uppercase}
	.decision-workspace h2,.decision-workspace h3{margin:0}
	.decision-workspace h2{font-size:16px;line-height:1.15;overflow-wrap:anywhere}
	.decision-workspace h3{font-size:14px}
	.decision-workspace .decision-workspace-item-title{font-size:clamp(20px,3vw,28px);line-height:1.15;overflow-wrap:anywhere}
	.decision-workspace-primary{align-items:center;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;min-width:0}
	.decision-workspace-authority-note{color:var(--worn-text-muted);font-size:13px;line-height:1.4;max-width:100%;margin:0}
	.decision-workspace-authority-note,
	.decision-workspace-detail p{color:var(--worn-text-secondary)}
	.decision-workspace-meta{align-items:center;color:var(--worn-text-muted);display:flex;flex-wrap:wrap;gap:8px;font-size:13px;min-width:0}
	.decision-workspace-meta span{min-width:0;overflow-wrap:anywhere}
	.decision-workspace-rationale{padding-block-start:12px}
	.decision-workspace-detail{display:grid;gap:12px;max-width:100%;min-width:0}
	.decision-workspace-detail p{color:var(--worn-text-secondary);font-size:14px;line-height:1.45;margin:0}
	.decision-workspace-signals{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:10px 0 0;padding:0}
	.decision-workspace-signals li{background:var(--worn-surface);border:1px solid var(--worn-border);border-radius:999px;font-size:12px;padding:4px 8px}
	.decision-workspace-signals strong{color:var(--worn-text);font-size:13px}
	.decision-workspace-authority{display:grid;gap:8px}
	.decision-workspace-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
	:global(.decision-workspace .worn-collapsible summary){font-size:12px}
	@media(max-width:700px){
		.decision-workspace .decision-workspace-item-title{font-size:clamp(18px,7vw,24px)}
	}
	@media(max-width:420px){
		.decision-workspace{padding:13px}
		.decision-workspace-primary{align-items:stretch}
		.decision-workspace-actions :global(.worn-btn),
		.decision-workspace-primary :global(.worn-btn){flex:1 1 100%;justify-content:center;min-width:0;width:100%}
	}
</style>
