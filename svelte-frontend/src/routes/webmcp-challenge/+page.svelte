<script lang="ts">
	import { onMount } from 'svelte';
	import { WornButton, WornPage } from '$lib/components';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import { createWebMcpChallengeGuideTool } from './webmcp-challenge-webmcp.mjs';

	const recommendedPrompt = 'As you move through Work, Review, and Next, use each page’s WebMCP tools to show only “Garage reset” work, notice that the floor is already done while shelf sorting still waits on storage bins, narrow Review to blocked Garage-reset items, and prepare “Confirm storage bin delivery” with a brief evidence-based note for my review. Do not save or change workspace data.';
	const steps = [
		{
			title: 'Observe the workspace',
			description: 'On Work, read the full denominator and show only Garage-reset work.',
			action: 'Start in Work',
			href: '/work'
		},
		{
			title: 'Explain what needs attention',
			description: 'On Review, narrow to blocked Garage-reset items and surface “Waiting on storage bins.”',
			action: 'Continue to Review',
			href: '/review'
		},
		{
			title: 'Prepare the handoff',
			description: 'On Next, replace the stale floor-clearing action with “Confirm storage bin delivery,” add a short evidence note, then stop before Save.',
			action: 'Open the draft editor',
			href: '/next'
		}
	] as const;
	const safety = [
		'Agent: read the exact state currently rendered.',
		'Agent: change page-local scope and prepare an unsaved draft.',
		'Person: approve, save, or discard every workspace change.'
	] as const;
	let copyStatus = $state('');

	async function copyRecommendedPrompt() {
		try {
			await navigator.clipboard.writeText(recommendedPrompt);
			copyStatus = 'Prompt copied.';
		} catch {
			copyStatus = 'Copy unavailable. Select the prompt text instead.';
		}
	}

	function readChallengeGuide() {
		const root = document.querySelector<HTMLElement>('[data-webmcp-challenge-guide]');
		const renderedSteps = Array.from(document.querySelectorAll<HTMLElement>('[data-webmcp-challenge-step]')).map((step, index) => ({
			position: index + 1,
			title: step.querySelector<HTMLElement>('h2')?.textContent?.trim() ?? '',
			description: step.querySelector<HTMLElement>('p')?.textContent?.trim() ?? '',
			href: step.querySelector<HTMLAnchorElement>('a')?.getAttribute('href') ?? ''
		}));
		const renderedSafety = Array.from(document.querySelectorAll<HTMLElement>('[data-webmcp-challenge-safety] li')).map((item) => item.textContent?.trim() ?? '');
		return {
			title: root?.dataset.webmcpChallengeTitle ?? '',
			purpose: root?.dataset.webmcpChallengePurpose ?? '',
			prompt: root?.dataset.webmcpChallengePrompt ?? '',
			steps: renderedSteps,
			safety: renderedSafety
		};
	}

	onMount(() => registerPageTools(document, [
		createWebMcpChallengeGuideTool(readChallengeGuide)
	]));
</script>

<svelte:head>
	<title>WebMCP Challenge guide — Wornpage Projects™</title>
	<meta
		name="description"
		content="A browser-local WebMCP guide for Work, Review, and Next: tools read, narrow, and prepare while you control Save."
	/>
</svelte:head>

<WornPage sectionLabel="Judge path · about 90 seconds" title="WebMCP Challenge guide">
	<div
		class="challenge-guide"
		data-webmcp-challenge-guide
		data-webmcp-challenge-title="WebMCP Challenge guide"
		data-webmcp-challenge-purpose="People and browser agents share the same live project page while consequential decisions remain human-owned."
		data-webmcp-challenge-prompt={recommendedPrompt}
	>
		<div class="challenge-hero">
			<div class="challenge-intro">
				<p class="challenge-kicker">WebMCP project workspace · live sample · no login</p>
				<p class="challenge-purpose">A browser agent reads and narrows the same work you see, then prepares an unsaved next action while you keep the final say.</p>
				<div class="challenge-facts" aria-label="Challenge build facts">
					<div><strong>7</strong><span>route-owned tools</span></div>
					<div><strong>3</strong><span>reversible page actions</span></div>
					<div><strong>0</strong><span>automatic saves</span></div>
				</div>
			</div>
			<section class="challenge-prompt" aria-labelledby="challenge-prompt-title">
				<div class="challenge-prompt-head">
					<h2 id="challenge-prompt-title">Run the judged path</h2>
					<WornButton type="button" size="sm" onclick={copyRecommendedPrompt}>Copy prompt</WornButton>
				</div>
				<blockquote>{recommendedPrompt}</blockquote>
				<p class="challenge-copy-status" data-challenge-copy-status aria-live="polite">{copyStatus}</p>
			</section>
		</div>

		<ol class="challenge-steps" aria-label="Three-step WebMCP demonstration">
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

			<p class="challenge-browser-note">
				Open this demo in the ChatGPT or Codex in-app browser for the demonstrated WebMCP path. If WebMCP is unavailable, the ordinary page and browser-local sample remain usable.
			</p>
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
		font-size: 12px;
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
	.challenge-facts strong {
		font-family: var(--font-typewriter);
		font-size: 20px;
	}
	.challenge-facts span {
		color: var(--worn-text-muted);
		font-size: 11px;
		line-height: 1.35;
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
	.challenge-prompt-head {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.challenge-prompt-head h2 {
		margin: 0;
	}
	.challenge-prompt blockquote {
		color: var(--worn-text);
		font-family: var(--font-typewriter);
		font-size: 14px;
		line-height: 1.6;
		margin: 0;
	}
	.challenge-copy-status {
		color: var(--worn-text-secondary);
		font-size: 13px;
		margin: 8px 0 0;
		min-height: 1.4em;
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
		font-size: 16px;
		margin: 0;
	}
	.challenge-steps p,
	.challenge-browser-note {
		color: var(--worn-text-secondary);
		font-size: 14px;
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
		font-size: 14px;
		line-height: 1.6;
		margin: 0;
		padding-left: 20px;
	}
	.challenge-browser-note {
		border-left: 3px solid var(--worn-accent);
		margin: 0;
		padding-left: 12px;
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
