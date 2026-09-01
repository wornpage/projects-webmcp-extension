<script lang="ts">
	import { webMcpHandoffSession } from './webmcp-handoff-store';

	const STAGES = [
		{ id: 'work-scope', number: 1, label: 'Work' },
		{ id: 'review-scope', number: 2, label: 'Review' },
		{ id: 'next-proposal', number: 3, label: 'Next' },
		{ id: 'draft-batch', number: 4, label: 'Drafts' },
		{ id: 'human-decision', number: 5, label: 'Decide' }
	] as const;

	let steps = $derived($webMcpHandoffSession.steps);
	let completedIds = $derived(new Set(steps.map(({ id }) => id)));
	let currentStep = $derived(steps.at(-1) || null);
	let currentId = $derived(currentStep?.id || '');
</script>

<section
	class="webmcp-handoff-rail"
	data-webmcp-handoff-session
	aria-label="Live WebMCP handoff"
	aria-live="polite"
>
	<div class="webmcp-handoff-summary">
		<p>Live WebMCP handoff</p>
		<strong>{currentStep ? `${steps.length} of 5 · ${currentStep.title}` : 'Ready for one bounded run'}</strong>
		<small title={currentStep?.summary || undefined}>{currentStep?.summary || 'No agent action recorded.'}</small>
	</div>

	<ol class="webmcp-handoff-steps" aria-label={`${steps.length} of 5 handoff steps complete`}>
		{#each STAGES as stage (stage.id)}
			<li
				class:is-complete={completedIds.has(stage.id)}
				class:is-current={stage.id === currentId}
				data-webmcp-handoff-step={stage.id}
				aria-label={`${stage.label}: ${completedIds.has(stage.id) ? 'complete' : 'waiting'}`}
			>
				<span aria-hidden="true">{stage.number}</span>
				<small>{stage.label}</small>
			</li>
		{/each}
	</ol>

	<div class="webmcp-handoff-authority">
		<span>Agent authority</span>
		<strong>0 saved · 0 started</strong>
		<small>Human decides</small>
	</div>

	<span class="webmcp-handoff-progress">{steps.length} of 5 steps</span>
</section>

<style>
	.webmcp-handoff-rail {
		align-items: center;
		background: color-mix(in srgb, var(--worn-selected-bg) 34%, var(--worn-surface));
		border: 1px solid var(--worn-border-strong);
		border-radius: var(--worn-radius);
		box-shadow: var(--worn-shadow-sm);
		display: grid;
		gap: 10px 16px;
		grid-template-columns: minmax(220px, 1fr) auto auto;
		min-width: 0;
		padding: 10px 14px;
		position: relative;
	}

	.webmcp-handoff-summary,
	.webmcp-handoff-authority {
		display: grid;
		gap: 1px;
		min-width: 0;
	}

	.webmcp-handoff-summary p,
	.webmcp-handoff-summary strong,
	.webmcp-handoff-summary small,
	.webmcp-handoff-authority span,
	.webmcp-handoff-authority strong,
	.webmcp-handoff-authority small,
	.webmcp-handoff-steps {
		margin: 0;
	}

	.webmcp-handoff-summary p,
	.webmcp-handoff-authority span {
		color: var(--worn-link);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.webmcp-handoff-summary strong,
	.webmcp-handoff-authority strong {
		color: var(--worn-text);
		font-size: 14px;
		line-height: 1.3;
	}

	.webmcp-handoff-summary small,
	.webmcp-handoff-authority small {
		color: var(--worn-text-secondary);
		font-size: 12px;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.webmcp-handoff-steps {
		display: flex;
		gap: 5px;
		list-style: none;
		padding: 0;
	}

	.webmcp-handoff-steps li {
		align-items: center;
		color: var(--worn-text-muted);
		display: grid;
		gap: 2px;
		justify-items: center;
		min-width: 42px;
	}

	.webmcp-handoff-steps li > span {
		align-items: center;
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: 999px;
		display: inline-flex;
		font-size: 11px;
		font-weight: 800;
		height: 22px;
		justify-content: center;
		width: 22px;
	}

	.webmcp-handoff-steps li > small {
		font-size: 10px;
		line-height: 1.2;
	}

	.webmcp-handoff-steps li.is-complete {
		color: var(--worn-text-secondary);
	}

	.webmcp-handoff-steps li.is-complete > span {
		background: var(--worn-selected-bg);
		border-color: var(--worn-accent);
		color: var(--worn-text);
	}

	.webmcp-handoff-steps li.is-current > span {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--worn-accent) 36%, transparent);
	}

	.webmcp-handoff-authority {
		text-align: right;
	}

	.webmcp-handoff-progress {
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		height: 1px;
		overflow: hidden;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}

	@media (max-width: 760px) {
		.webmcp-handoff-rail {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.webmcp-handoff-steps {
			grid-column: 1 / -1;
			justify-content: space-between;
			order: 3;
		}
	}

	@media (max-width: 460px) {
		.webmcp-handoff-rail {
			grid-template-columns: 1fr;
		}

		.webmcp-handoff-authority {
			text-align: left;
		}

		.webmcp-handoff-steps {
			overflow-x: auto;
		}
	}
</style>
