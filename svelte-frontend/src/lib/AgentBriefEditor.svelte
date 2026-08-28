<script lang="ts">
	import { tick } from 'svelte';
	import { WornButton } from '$lib/components';

	export const DEFAULT_AGENT_BRIEF = 'Use the WebMCP tools on Work, Review, and Next to inspect the visible project state, narrow the items that need attention, and prepare an evidence-based next action for my review. Do not save or change workspace data.';

	let brief = $state(DEFAULT_AGENT_BRIEF);
	let workQuery = $state('');
	let status = $state('Local draft · not saved · workspace unchanged');
	let briefInput = $state<HTMLTextAreaElement | null>(null);

	function noteLocalDraft() {
		status = 'Local draft · not saved · workspace unchanged';
	}

	function resetBrief() {
		brief = DEFAULT_AGENT_BRIEF;
		workQuery = '';
		noteLocalDraft();
	}

	async function copyBrief() {
		try {
			if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Clipboard API unavailable.');
			const scopedQuery = workQuery.trim();
			const copyText = scopedQuery
				? `Brief for the browser agent:\n${brief}\n\nWork to focus on:\n${scopedQuery}`
				: brief;
			await navigator.clipboard.writeText(copyText);
			status = scopedQuery
				? 'Brief and work scope copied · local draft not saved · workspace unchanged'
				: 'Brief copied · local draft not saved · workspace unchanged';
		} catch {
			status = 'Copy unavailable · brief selected for manual copy · workspace unchanged';
			await tick();
			briefInput?.focus();
			briefInput?.select();
		}
	}
</script>

<section class="agent-brief-editor" aria-labelledby="agent-brief-title">
	<div class="agent-brief-heading">
		<div>
			<p class="agent-brief-kicker">Editable browser-agent brief</p>
			<h2 id="agent-brief-title">Set the next investigation</h2>
		</div>
		<p class="agent-brief-limit" aria-label={`${brief.length} of 1000 characters`}>{brief.length}/1000</p>
	</div>
	<p class="agent-brief-help" id="agent-brief-help">Leave work scope empty for all visible work, or enter an existing visible work term. Then ask the browser agent: <q>Follow the brief on this page.</q> The Guide tool reads both fields; Copy brief is the fallback when its reader API is unavailable.</p>
	<div class="agent-work-query-field">
		<div class="agent-work-query-label">
			<label for="agent-work-query-input">Work to focus on (optional)</label>
			<span aria-label={`${workQuery.length} of 120 characters`}>{workQuery.length}/120</span>
		</div>
		<input
			bind:value={workQuery}
			data-agent-work-query-input
			id="agent-work-query-input"
			maxlength="120"
			type="text"
			aria-describedby="agent-work-query-help agent-brief-status"
			oninput={noteLocalDraft}
		/>
		<p id="agent-work-query-help" class="agent-brief-help">Matches visible title, type, area, owner, blocker, source, purpose, memory, next action, due date, or other visible work terms.</p>
	</div>
	<label for="agent-brief-input">Brief for the browser agent</label>
	<textarea
		bind:this={briefInput}
		bind:value={brief}
		data-agent-brief-input
		id="agent-brief-input"
		maxlength="1000"
		rows="6"
		aria-describedby="agent-brief-help agent-brief-status"
		oninput={noteLocalDraft}
	></textarea>
	<div class="agent-brief-actions">
		<WornButton type="button" size="sm" onclick={copyBrief}>Copy brief</WornButton>
		<WornButton type="button" size="sm" onclick={resetBrief}>Reset</WornButton>
		<p id="agent-brief-status" class="agent-brief-status" aria-live="polite">{status}</p>
	</div>
</section>

<style>
	.agent-brief-editor {
		background: var(--worn-bg-secondary);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		display: grid;
		gap: 12px;
		padding: 16px;
	}
	.agent-brief-heading {
		align-items: start;
		display: flex;
		gap: 12px;
		justify-content: space-between;
	}
	.agent-brief-kicker,
	.agent-brief-limit {
		color: var(--worn-text-secondary);
		font-family: var(--font-typewriter);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		margin: 0;
		text-transform: uppercase;
	}
	.agent-brief-limit {
		white-space: nowrap;
	}
	.agent-brief-editor h2 {
		font-size: 18px;
		margin: 3px 0 0;
	}
	.agent-brief-help,
	.agent-brief-status {
		color: var(--worn-text-secondary);
		font-size: 14px;
		line-height: 1.5;
		margin: 0;
	}
	.agent-brief-editor label {
		font-size: 14px;
		font-weight: 700;
	}
	.agent-work-query-field {
		display: grid;
		gap: 6px;
	}
	.agent-work-query-label {
		align-items: baseline;
		display: flex;
		gap: 12px;
		justify-content: space-between;
	}
	.agent-work-query-label span {
		color: var(--worn-text-secondary);
		font-family: var(--font-typewriter);
		font-size: 12px;
		white-space: nowrap;
	}
	.agent-brief-editor input,
	.agent-brief-editor textarea {
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		box-sizing: border-box;
		color: var(--worn-text-primary);
		font: inherit;
		line-height: 1.5;
		min-height: 144px;
		padding: 10px 12px;
		resize: vertical;
		width: 100%;
	}
	.agent-brief-editor input:focus-visible,
	.agent-brief-editor textarea:focus-visible {
		outline: 2px dashed var(--worn-focus);
		outline-offset: 2px;
	}
	.agent-brief-actions {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.agent-brief-status {
		flex: 1 1 220px;
	}
	@media (max-width: 520px) {
		.agent-brief-editor {
			padding: 14px;
		}
		.agent-brief-heading {
			align-items: start;
			flex-direction: column;
		}
		.agent-brief-actions :global(.worn-btn) {
			flex: 1 1 auto;
		}
		.agent-brief-status {
			flex-basis: 100%;
		}
	}
</style>
