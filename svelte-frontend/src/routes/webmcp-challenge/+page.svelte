<script lang="ts">
	import { onMount } from 'svelte';
	import { WornButton, WornPage } from '$lib/components';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import { createWebMcpChallengeGuideTool } from './webmcp-challenge-webmcp.mjs';

	const recommendedPrompt = 'Find what needs attention, narrow the visible work, and prepare the next action for my review. Do not change workspace data.';
	const steps = [
		{
			title: 'Understand the current work',
			description: 'Read the exact bounded Work view and narrow only its visible search.',
			href: '/work'
		},
		{
			title: 'Inspect the review queue',
			description: 'Read the visible queue and change only its reversible page scope.',
			href: '/review'
		},
		{
			title: 'Prepare the next action',
			description: 'Prepare a visible draft while the person retains Save authority.',
			href: '/next'
		}
	] as const;
	const safety = [
		'Sample data stays in this browser.',
		'Page tools expose bounded visible state, not private production data.',
		'Consequential workspace changes remain human-owned.'
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
		content="Try Wornpage Projects with a browser agent using bounded, route-scoped WebMCP tools and sample data."
	/>
</svelte:head>

<WornPage title="WebMCP Challenge guide">
	<div
		class="challenge-intro"
		data-webmcp-challenge-guide
		data-webmcp-challenge-title="WebMCP Challenge guide"
		data-webmcp-challenge-purpose="People and browser agents share the same live project page while consequential decisions remain human-owned."
		data-webmcp-challenge-prompt={recommendedPrompt}
	>
		<p class="challenge-kicker">Public static edition · sample data · no login</p>
		<p class="challenge-purpose">People and browser agents share the same live project page while consequential decisions remain human-owned.</p>
		<section class="challenge-prompt" aria-labelledby="challenge-prompt-title">
			<div class="challenge-prompt-head">
				<h2 id="challenge-prompt-title">Try this prompt</h2>
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
				<WornButton href={step.href} size="sm">Open {step.title}</WornButton>
			</li>
		{/each}
	</ol>

	<section class="challenge-safety" data-webmcp-challenge-safety aria-labelledby="challenge-safety-title">
		<h2 id="challenge-safety-title">Authority boundary</h2>
		<ul>
			{#each safety as guarantee (guarantee)}
				<li>{guarantee}</li>
			{/each}
		</ul>
	</section>

	<p class="challenge-browser-note">
		WebMCP tools are available in Codex and ChatGPT in-app browsers, or in a supported Chrome build with WebMCP testing enabled. The ordinary page remains usable when WebMCP is unavailable.
	</p>
</WornPage>

<style>
	.challenge-intro,
	.challenge-steps,
	.challenge-safety,
	.challenge-browser-note {
		max-width: 760px;
	}
	.challenge-kicker {
		color: var(--worn-text-secondary);
		font-family: var(--font-typewriter);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		margin: 0 0 8px;
		text-transform: uppercase;
	}
	.challenge-purpose {
		color: var(--worn-text-secondary);
		font-size: 17px;
		line-height: 1.6;
		margin: 0;
	}
	.challenge-prompt {
		background: var(--worn-surface-raised, var(--worn-surface));
		border: 1px solid var(--worn-border);
		margin-top: 20px;
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
		border-top: 1px solid var(--worn-border);
		list-style: none;
		margin: 24px 0 0;
		padding: 0;
	}
	.challenge-steps li {
		align-items: center;
		border-bottom: 1px solid var(--worn-border);
		display: grid;
		gap: 12px;
		grid-template-columns: 32px minmax(0, 1fr) auto;
		padding: 16px 0;
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
	.challenge-safety {
		margin-top: 24px;
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
		margin-top: 20px;
		padding-left: 12px;
	}
	@media (max-width: 620px) {
		.challenge-steps li {
			align-items: start;
			grid-template-columns: 28px minmax(0, 1fr);
		}
		.challenge-steps :global(.worn-btn) {
			grid-column: 2;
			justify-self: start;
			min-block-size: var(--worn-target-min);
		}
	}
</style>
