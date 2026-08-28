<script lang="ts">
	import { tick } from 'svelte';
	import { WornButton } from '$lib/components';

	export const DEFAULT_AGENT_BRIEF = 'Use the WebMCP tools on Work, Review, and Next to inspect the visible project state, narrow the items that need attention, and prepare an evidence-based next action for my review. Do not save or change workspace data.';

	let brief = $state(DEFAULT_AGENT_BRIEF);
	let status = $state('Local draft · not saved · workspace unchanged');
	let briefInput = $state<HTMLTextAreaElement | null>(null);

	function noteLocalDraft() {
		status = 'Local draft · not saved · workspace unchanged';
	}

	function resetBrief() {
		brief = DEFAULT_AGENT_BRIEF;
		noteLocalDraft();
	}

	async function copyBrief() {
		try {
			if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Clipboard API unavailable.');
			await navigator.clipboard.writeText(brief);
			status = 'Brief copied · local draft not saved · workspace unchanged';
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
	<p class="agent-brief-help" id="agent-brief-help">The Guide tool reads the current text in this field. Copy brief is the fallback when its reader API is unavailable.</p>
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
