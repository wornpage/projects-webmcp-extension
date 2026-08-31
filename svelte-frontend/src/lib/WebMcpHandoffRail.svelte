<script lang="ts">
	import { webMcpHandoffSession } from './webmcp-handoff-store';

	const STEP_NUMBERS = {
		'work-scope': 1,
		'review-scope': 2,
		'next-proposal': 3,
		'draft-batch': 4,
		'human-decision': 5
	} as const;
	const STAGES = [
		{ id: 'work-scope', title: 'Observe and narrow', waiting: 'Waiting for the Work scope.' },
		{ id: 'review-scope', title: 'Verify evidence', waiting: 'Waiting for the Review evidence.' },
		{ id: 'next-proposal', title: 'Prepare proposal', waiting: 'Waiting for the unsaved Next proposal.' },
		{ id: 'draft-batch', title: 'Stage Drafts', waiting: 'Waiting for bounded Draft creation.' },
		{ id: 'human-decision', title: 'Human decides', waiting: 'Save, Start, or Discard stays with a person.' }
	] as const;
	let steps = $derived($webMcpHandoffSession.steps);
	let stepsById = $derived(new Map(steps.map((step) => [step.id, step])));
	let currentId = $derived(steps.at(-1)?.id || '');
</script>


<section
	class="webmcp-handoff-rail"
	data-webmcp-handoff-session
	aria-label="Live WebMCP handoff"
	aria-live="polite"
>
	<header class="webmcp-handoff-head">
		<div>
			<p class="webmcp-handoff-kicker">Live WebMCP handoff</p>
			<h2>One agent run · visible across pages</h2>
		</div>
		<span class="webmcp-handoff-progress">{steps.length} of 5 steps</span>
	</header>

	<ol class="webmcp-handoff-steps">
		{#each STAGES as stage (stage.id)}
			{@const step = stepsById.get(stage.id)}
			<li
				class:is-complete={Boolean(step)}
				class:is-current={stage.id === currentId}
				data-webmcp-handoff-step={stage.id}
			>
				<span class="webmcp-handoff-number" aria-hidden="true">{STEP_NUMBERS[stage.id]}</span>
				<div>
					<strong>{step?.title || stage.title}</strong>
					<p>{step?.summary || stage.waiting}</p>
					<small>{step?.evidence || 'No agent action recorded.'}</small>
				</div>
			</li>
		{/each}
	</ol>

	<footer>
		<span>Agent authority</span>
		<strong>{$webMcpHandoffSession.agentSaved} saved · {$webMcpHandoffSession.agentStarted} started</strong>
		<span class="webmcp-human-boundary">Human final decision required</span>
	</footer>
</section>

<style>
	.webmcp-handoff-rail {
		background: color-mix(in srgb, var(--worn-selected-bg) 42%, var(--worn-surface));
		border: 1px solid var(--worn-border-strong);
		border-radius: var(--worn-radius);
		box-shadow: var(--worn-shadow-sm);
		display: grid;
		gap: 12px;
		min-width: 0;
		padding: 14px 16px;
	}

	.webmcp-handoff-head {
		align-items: start;
		display: flex;
		gap: 16px;
		justify-content: space-between;
	}

	.webmcp-handoff-kicker,
	.webmcp-handoff-head h2,
	.webmcp-handoff-steps,
	.webmcp-handoff-steps p {
		margin: 0;
	}

	.webmcp-handoff-kicker {
		color: var(--worn-link);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.webmcp-handoff-head h2 {
		color: var(--worn-text);
		font-size: 18px;
		line-height: 1.25;
	}

	.webmcp-handoff-progress,
	.webmcp-human-boundary {
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: 999px;
		color: var(--worn-text-secondary);
		font-size: 12px;
		font-weight: 700;
		padding: 5px 9px;
		white-space: nowrap;
	}

	.webmcp-handoff-steps {
		display: grid;
		gap: 8px;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		list-style: none;
		padding: 0;
	}

	.webmcp-handoff-steps li {
		align-items: start;
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius-sm);
		display: grid;
		gap: 8px;
		grid-template-columns: auto minmax(0, 1fr);
		min-width: 0;
		min-height: 108px;
		padding: 10px;
	}

	.webmcp-handoff-steps li.is-complete {
		background: color-mix(in srgb, var(--worn-selected-bg) 34%, var(--worn-surface));
	}

	.webmcp-handoff-steps li.is-current {
		border-color: var(--worn-accent);
		box-shadow: inset 0 0 0 1px var(--worn-accent);
	}

	.webmcp-handoff-number {
		align-items: center;
		background: var(--worn-selected-bg);
		border-radius: 999px;
		color: var(--worn-text);
		display: inline-flex;
		font-size: 12px;
		font-weight: 800;
		height: 24px;
		justify-content: center;
		width: 24px;
	}

	.webmcp-handoff-steps strong {
		color: var(--worn-text);
		display: block;
		font-size: 14px;
		line-height: 1.3;
	}

	.webmcp-handoff-steps p {
		color: var(--worn-text-secondary);
		font-size: 13px;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.webmcp-handoff-steps small {
		color: var(--worn-text-muted);
		display: block;
		font-size: 12px;
		line-height: 1.35;
		margin-top: 4px;
		overflow-wrap: anywhere;
	}

	.webmcp-handoff-steps p,
	.webmcp-handoff-steps small {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.webmcp-handoff-rail footer {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
	}

	.webmcp-handoff-rail footer > span:first-child {
		color: var(--worn-text-muted);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.webmcp-handoff-rail footer strong {
		color: var(--worn-text);
		font-size: 14px;
	}

	.webmcp-human-boundary {
		color: var(--worn-link);
		margin-left: auto;
	}

	@media (max-width: 900px) {
		.webmcp-handoff-steps {
			display: flex;
			overflow-x: auto;
			scroll-snap-type: x proximity;
		}

		.webmcp-handoff-steps li {
			flex: 0 0 220px;
			scroll-snap-align: start;
		}
	}

	@media (max-width: 520px) {
		.webmcp-handoff-head {
			align-items: stretch;
			flex-direction: column;
		}

		.webmcp-handoff-progress {
			align-self: start;
		}

		.webmcp-human-boundary {
			margin-left: 0;
		}
	}
</style>
