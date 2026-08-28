<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { WornButton, WornPage, WornReceipt } from '$lib/components';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import {
		PROJECTS_HANDOFF_GUIDE_TOOL_NAME,
		createWebMcpChallengeGuideTool,
		readRenderedWebMcpChallengeGuide
	} from './webmcp-challenge-webmcp.mjs';

	const steps = [
		{
			title: 'Observe the workspace',
			description: 'On Work, read the visible items, priorities, and explicit counts.',
			action: 'Start in Work',
			href: '/work'
		},
		{
			title: 'Explain what needs attention',
			description: 'On Review, narrow the queue and surface the evidence behind each priority.',
			action: 'Continue to Review',
			href: '/review'
		},
		{
			title: 'Prepare the handoff',
			description: 'On Next, prepare a clear next action with an evidence note, then stop before Save.',
			action: 'Open the draft editor',
			href: '/next'
		}
	] as const;
	const safety = [
		'Agent: read the exact state currently rendered.',
		'Agent: change page-local scope and prepare an unsaved draft.',
		'Person: approve, save, or discard every workspace change.'
	] as const;
	let webMcpGuideReaderAvailable = $state(false);
	let webMcpGuideReceipt = $state<{
		summary: string;
		cells: Array<{ label: string; value: string }>;
	} | null>(null);
	let webMcpInvocationCount = $state(0);

	onMount(() => {
		// This is intentionally capability detection, not a registration-success claim.
		// registerPageTools continues to own registration, failure handling, and teardown.
		const webMcpDocument = document as Document & { modelContext?: { registerTool?: unknown } };
		webMcpGuideReaderAvailable = typeof webMcpDocument.modelContext?.registerTool === 'function';
		return registerPageTools(document, [
			createWebMcpChallengeGuideTool(() => readRenderedWebMcpChallengeGuide(document))
		], {
		onInvocationError: async () => {
			webMcpGuideReceipt = null;
			await tick();
		},
		onResult: async ({ toolName, result }) => {
			if (toolName !== PROJECTS_HANDOFF_GUIDE_TOOL_NAME) return;
			const guide = result as { steps?: unknown[] };
			webMcpInvocationCount += 1;
			webMcpGuideReceipt = {
				summary: 'WebMCP read the Projects handoff guide.',
				cells: [
					{ label: 'Tool', value: toolName },
					{ label: 'Invocation', value: `#${webMcpInvocationCount}` },
					{ label: 'What it read', value: `${guide.steps?.length ?? 0} workflow steps and the visible authority boundary` },
					{ label: 'Page-local presentation', value: 'Unchanged' },
					{ label: 'Saved workspace changes', value: 'None' }
				]
			};
			await tick();
		}
		});
	});
</script>

<svelte:head>
	<title>Projects handoff guide — Wornpage Projects™</title>
	<meta
		name="description"
	content="A practical Projects handoff workflow: WebMCP tools read visible work, narrow review, and prepare a draft while you control Save."
	/>
</svelte:head>

<WornPage sectionLabel="Projects workflow · guided handoff" title="Projects handoff guide">
	<div
		class="challenge-guide"
		data-webmcp-challenge-guide
		data-webmcp-challenge-title="Projects handoff guide"
		data-webmcp-challenge-purpose="People and browser agents share the same live project page while consequential decisions remain human-owned."
	>
		<div class="challenge-hero">
			<div class="challenge-intro">
				<p class="challenge-kicker">WebMCP project workspace · live sample · no login</p>
				<p class="challenge-purpose">Shared work loses time when people reconstruct blockers and next actions from scattered handoffs. Wornpage Projects lets a browser agent narrow the same visible workspace and prepare—not decide—the next handoff.</p>
				<dl class="challenge-facts" aria-label="What the demo allows">
					<div><dt>Page tools</dt><dd>7</dd></div>
					<div><dt>Actions you can undo</dt><dd>3</dd></div>
					<div><dt>Automatic saves</dt><dd>0</dd></div>
				</dl>
			</div>
			<section class="challenge-prompt" aria-labelledby="challenge-prompt-title">
				<h2 id="challenge-prompt-title">A useful handoff, in order</h2>
				<p>Start with the work that is already visible, explain what needs attention, and prepare a draft for the person who owns the decision.</p>
			</section>
		</div>

		{#if webMcpGuideReceipt}
			<div data-webmcp-receipt="guide" aria-label="Latest Guide WebMCP tool receipt">
				<WornReceipt
					summary={webMcpGuideReceipt.summary}
					cells={webMcpGuideReceipt.cells}
					ondone={() => (webMcpGuideReceipt = null)}
				/>
			</div>
		{/if}

		<ol class="challenge-steps" aria-label="Three-step Projects handoff workflow">
			{#each steps as step, index (step.href)}
				<li data-webmcp-challenge-step>
					<span class="challenge-number" aria-hidden="true">{index + 1}</span>
					<div>
						<h2>{step.title}</h2>
						<p>{step.description}</p>
					</div>
					<WornButton href={step.href} size="sm">{step.action}</WornButton>
				</li>
			{/each}
		</ol>

		<div class="challenge-boundary-grid">
			<section class="challenge-safety" data-webmcp-challenge-safety aria-labelledby="challenge-safety-title">
				<h2 id="challenge-safety-title">Authority boundary</h2>
				<ul>
					{#each safety as guarantee (guarantee)}
						<li>{guarantee}</li>
					{/each}
				</ul>
			</section>

			<section class="challenge-browser-note" data-webmcp-guide-reader-status aria-live="polite" aria-labelledby="challenge-browser-note-title">
				<h2 id="challenge-browser-note-title">Guide reader in this browser</h2>
				{#if webMcpGuideReaderAvailable}
					<p><strong>Reader API detected.</strong> This browser exposes the Guide reader API. Its one tool reads this visible guide only; it cannot navigate, save, or change workspace data. This status does not confirm registration success.</p>
				{:else}
					<p><strong>Reader API unavailable.</strong> Follow the three visible buttons instead. The browser-local sample remains usable without WebMCP.</p>
				{/if}
			</section>
		</div>
	</div>
</WornPage>

<style>
	.challenge-guide {
		display: grid;
		gap: 24px;
		min-width: 0;
	}
	.challenge-hero {
		display: grid;
		gap: 20px;
		grid-template-columns: minmax(0, 0.82fr) minmax(360px, 1.18fr);
	}
	.challenge-intro {
		align-content: start;
		display: grid;
		gap: 16px;
	}
	.challenge-kicker {
		color: var(--worn-text-secondary);
		font-family: var(--font-typewriter);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		margin: 0;
		text-transform: uppercase;
	}
	.challenge-purpose {
		color: var(--worn-text-secondary);
		font-size: 17px;
		line-height: 1.6;
		margin: 0;
	}
	.challenge-facts {
		display: grid;
		gap: 8px;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.challenge-facts div {
		border-top: 2px solid var(--worn-accent);
		display: grid;
		gap: 2px;
		padding-top: 8px;
	}
	.challenge-facts dt {
		color: var(--worn-text-secondary);
		font-size: 13px;
		line-height: 1.45;
		order: 2;
	}
	.challenge-facts dd {
		font-family: var(--font-typewriter);
		font-size: 20px;
		margin: 0;
		order: 1;
	}
	.challenge-prompt {
		background: var(--worn-bg-secondary);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		padding: 16px;
	}
	.challenge-prompt h2,
	.challenge-safety h2 {
		font-size: 14px;
		margin: 0 0 8px;
	}
	.challenge-steps {
		display: grid;
		gap: 10px;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.challenge-steps li {
		align-content: start;
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		display: grid;
		gap: 12px;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: 16px;
	}
	.challenge-number {
		align-items: center;
		border: 1px solid var(--worn-accent);
		border-radius: 50%;
		display: flex;
		font-family: var(--font-typewriter);
		font-size: 12px;
		font-weight: 700;
		height: 28px;
		justify-content: center;
		width: 28px;
	}
	.challenge-steps h2 {
		font-size: 17px;
		margin: 0;
	}
	.challenge-steps p {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.55;
		margin: 3px 0 0;
	}
	.challenge-steps :global(.worn-btn) {
		justify-self: start;
	}
	.challenge-boundary-grid {
		display: grid;
		gap: 16px;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}
	.challenge-safety ul {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.6;
		margin: 0;
		padding-left: 20px;
	}
	.challenge-browser-note {
		border-left: 3px solid var(--worn-accent);
		padding-left: 12px;
	}
	.challenge-browser-note h2 {
		font-size: 14px;
		margin: 0 0 8px;
	}
	.challenge-browser-note p {
		color: var(--worn-text-secondary);
		font-size: 15px;
		line-height: 1.55;
		margin: 0;
	}
	@media (max-width: 860px) {
		.challenge-hero,
		.challenge-boundary-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.challenge-steps {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 520px) {
		.challenge-facts {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
