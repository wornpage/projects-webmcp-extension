<script lang="ts">
	import { tick } from 'svelte';
	import { WornButton } from '$lib/components';

	interface Props {
		initialValue: string;
		heading?: string;
		description?: string;
	}

	const instanceId = $props.id();
	let {
		initialValue,
		heading = 'Brief the browser agent',
		description = 'Edit this brief, then paste it into a WebMCP-capable browser agent.'
	}: Props = $props();
	let editedBrief = $state<string | null>(null);
	let copyStatus = $state('');
	let briefField = $state<HTMLTextAreaElement>();
	let brief = $derived(editedBrief ?? initialValue);
	let canCopy = $derived(brief.trim().length > 0);
	let canReset = $derived(brief !== initialValue);

	function updateBrief(event: Event) {
		editedBrief = (event.currentTarget as HTMLTextAreaElement).value;
		copyStatus = '';
	}

	async function copyBrief() {
		const normalizedBrief = brief.trim();
		if (!normalizedBrief) return;
		copyStatus = '';
		await tick();
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
			await navigator.clipboard.writeText(normalizedBrief);
			copyStatus = 'Brief copied to the clipboard.';
		} catch {
			briefField?.focus();
			briefField?.select();
			copyStatus = 'Clipboard unavailable. The brief is selected for manual copy.';
		}
	}

	function resetBrief() {
		editedBrief = null;
		copyStatus = 'Default brief restored.';
	}
</script>

<section class="agent-brief-editor" aria-labelledby={`${instanceId}-heading`} data-agent-brief-editor>
	<div class="agent-brief-heading">
		<h2 id={`${instanceId}-heading`}>{heading}</h2>
		<p>{description}</p>
	</div>

	<label for={`${instanceId}-brief`}>Agent brief</label>
	<textarea
		id={`${instanceId}-brief`}
		bind:this={briefField}
		value={brief}
		oninput={updateBrief}
		rows="5"
		maxlength="1000"
		spellcheck="true"
		aria-describedby={`${instanceId}-boundary ${instanceId}-status`}
		data-agent-brief-input
	></textarea>

	<div class="agent-brief-footer">
		<p id={`${instanceId}-boundary`}>Local draft · not saved · workspace unchanged</p>
		<div class="agent-brief-actions">
			<WornButton type="button" size="sm" disabled={!canReset} data-agent-brief-reset onclick={resetBrief}>Reset</WornButton>
			<WornButton type="button" size="sm" variant="primary" disabled={!canCopy} data-agent-brief-copy onclick={copyBrief}>Copy brief</WornButton>
		</div>
	</div>
	<p class="agent-brief-status" id={`${instanceId}-status`} role="status" aria-live="polite" aria-atomic="true" data-agent-brief-status>{copyStatus}</p>
</section>

<style>
	.agent-brief-editor {
		background: var(--worn-bg-secondary);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		display: grid;
		gap: 12px;
		min-width: 0;
		padding: 16px;
	}
	.agent-brief-heading {
		display: grid;
		gap: 6px;
	}
	.agent-brief-heading h2 {
		font-size: 16px;
		margin: 0;
	}
	.agent-brief-heading p {
		color: var(--worn-text-secondary);
		font-size: 14px;
		line-height: 1.5;
		margin: 0;
	}
	label {
		color: var(--worn-text-muted);
		font-family: var(--font-typewriter);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}
	textarea {
		background: var(--worn-surface);
		border: 1px solid var(--worn-border-strong);
		border-radius: var(--worn-radius);
		box-sizing: border-box;
		color: var(--worn-text);
		font: inherit;
		font-size: 15px;
		line-height: 1.55;
		min-height: 132px;
		min-width: 0;
		padding: 12px 14px;
		resize: vertical;
		width: 100%;
	}
	textarea:focus-visible {
		border-color: var(--worn-focus);
		outline: 2px dashed var(--worn-focus);
		outline-offset: 2px;
	}
	.agent-brief-footer {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 10px 16px;
		justify-content: space-between;
	}
	.agent-brief-footer p,
	.agent-brief-status {
		color: var(--worn-text-secondary);
		font-size: 12px;
		line-height: 1.45;
		margin: 0;
	}
	.agent-brief-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.agent-brief-status {
		min-height: 1.45em;
	}
	@media (pointer: coarse) {
		textarea {
			font-size: 16px;
		}
	}
	@media (max-width: 520px) {
		.agent-brief-footer {
			align-items: stretch;
			flex-direction: column;
		}
		.agent-brief-actions :global(.worn-btn) {
			flex: 1 1 auto;
		}
	}
</style>
