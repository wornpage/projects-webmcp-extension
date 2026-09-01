<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { demoState, pendingNextActionDrafts, refreshDemoState, toasts } from '$lib/demo-client';
	import { pendingDraftNavigation } from '$lib/pending-next-action.mjs';
	import WornToast from '$lib/components/WornToast.svelte';
	import WebMcpHandoffRail from '$lib/WebMcpHandoffRail.svelte';
	import WebMcpStatus from '$lib/WebMcpStatus.svelte';

	type RouteItem = {
		href: '/webmcp-challenge' | '/priority' | '/work' | '/review' | '/next';
		label: string;
	};

	const ROUTES: readonly RouteItem[] = [
		{ href: '/webmcp-challenge', label: 'Guide' },
		{ href: '/priority', label: 'Priority' },
		{ href: '/work', label: '1 Work' },
		{ href: '/review', label: '2 Review' },
		{ href: '/next', label: '3 Next' }
	];

	let { children }: { children: any } = $props();
	let pathname = $derived($page.url.pathname);
	let routeLabel = $derived(ROUTES.find((item) => item.href === pathname)?.label ?? 'WebMCP demo');
	let pendingApprovals = $derived(pendingNextActionDrafts($demoState));
	let pendingNavigation = $derived(pendingDraftNavigation({ pendingNextActionDrafts: pendingApprovals }));
	let pendingResumeHref = $derived(pendingNavigation.resumeHref);

	onMount(() => {
		// The shared workspace shell hydrates the one browser-local state owner.
		// Guide only derives and renders that state; it owns no fetch or storage path.
		void refreshDemoState({ reuseRecent: true });
	});

	function dismissToast(id: string) {
		toasts.update((items) => items.filter((item) => item.id !== id));
	}
</script>

<div class="challenge-shell">
	<a class="challenge-skip" href="#challenge-main">Skip to current page</a>

	<header class="challenge-shell-nav">
		<a
			class="challenge-brand"
			href="/landing.html"
			data-sveltekit-reload
			aria-label="Wornpage Projects landing page"
		>
			<span>Wornpage Projects</span>
			<small>WebMCP edition</small>
		</a>

		<nav aria-label="Projects workflow navigation">
			{#each ROUTES as item (item.href)}
				<a href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
					{item.label}
				</a>
			{/each}
			{#if pendingNavigation.count > 0}
				<a class="pending-approval-link" href={pendingResumeHref} aria-label={`Resume ${pendingNavigation.count} pending approval${pendingNavigation.count === 1 ? '' : 's'}`}>
					Pending {pendingNavigation.count}
				</a>
			{/if}
		</nav>

		<WebMcpStatus />
	</header>

	<WebMcpHandoffRail />

	<div class="demo-toast-container">
		{#each $toasts as toast (toast.id)}
			<WornToast {toast} ondismiss={() => dismissToast(toast.id)} />
		{/each}
	</div>

	<main id="challenge-main" class="challenge-route" tabindex="-1" aria-label={`${routeLabel} page`}>
		{@render children()}
	</main>
</div>

<style>
	.challenge-shell {
		--challenge-focus-mint: var(--worn-link);
		align-content: start;
		box-sizing: border-box;
		display: grid;
		gap: 20px;
		margin: 0 auto;
		max-width: 1240px;
		min-height: 100vh;
		min-width: 0;
		padding: 20px 32px 48px;
		width: 100%;
	}

	.challenge-skip {
		background: var(--worn-text);
		border-radius: var(--worn-radius-sm);
		color: var(--worn-bg);
		font-weight: 700;
		left: 12px;
		padding: 10px 14px;
		position: fixed;
		top: 8px;
		transform: translateY(calc(-100% - 16px));
		transition: transform 0.12s ease;
		z-index: 300;
	}

	.challenge-skip:focus {
		transform: translateY(0);
	}

	.challenge-shell-nav {
		align-items: center;
		animation: challenge-nav-arrive 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
		background: var(--worn-surface);
		border: 1px solid var(--worn-border);
		border-radius: var(--worn-radius);
		display: flex;
		gap: 16px;
		justify-content: space-between;
		min-width: 0;
		padding: 8px 10px;
	}

	.challenge-brand {
		color: var(--worn-text);
		display: grid;
		flex: 0 1 auto;
		font-weight: 700;
		line-height: 1.15;
		min-height: 44px;
		min-width: 0;
		padding: 0 12px;
		place-content: center start;
		text-decoration: none;
	}

	.challenge-brand span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.challenge-brand small {
		color: var(--worn-text-muted);
		font-family: var(--font-typewriter);
		font-size: 11px;
		font-weight: 560;
	}

	.challenge-shell-nav nav {
		display: flex;
		flex: 0 1 auto;
		flex-wrap: wrap;
		gap: 4px;
		justify-content: flex-end;
	}

	.challenge-shell-nav nav a {
		align-items: center;
		border: 1px solid transparent;
		border-radius: var(--worn-radius-sm);
		color: var(--worn-text-secondary);
		display: inline-flex;
		font-family: var(--font-typewriter);
		font-size: 12px;
		font-weight: 650;
		min-height: 44px;
		padding: 0 12px;
		text-decoration: none;
		transition:
			background-color 180ms ease,
			border-color 180ms ease,
			box-shadow 180ms ease,
			color 180ms ease,
			translate 180ms ease;
	}

	.challenge-shell-nav nav a[aria-current='page'] {
		background: var(--worn-selected-bg);
		border-color: var(--worn-border-strong);
		box-shadow: inset 0 -2px 0 var(--worn-accent);
		color: var(--worn-selected-fg);
		translate: 0 -1px;
	}

	.challenge-brand:focus-visible,
	.challenge-shell-nav nav a:focus-visible {
		outline: 2px solid var(--challenge-focus-mint);
		outline-offset: 2px;
	}

	.challenge-route {
		display: grid;
		gap: 22px;
		min-width: 0;
	}

	.challenge-route > :global(.demo-panel) {
		animation: challenge-route-arrive 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
		transform-origin: top center;
	}

	.challenge-route :global(.worn-receipt) {
		box-shadow: var(--worn-shadow-sm);
		margin-block: 14px 16px;
		padding: 16px 18px;
	}

	.challenge-route :global(.worn-receipt-head) {
		padding-bottom: 10px;
	}

	.challenge-route :global(.worn-receipt-lines > div) {
		padding-block: 8px;
	}

	.challenge-route :global([data-webmcp-receipt]) {
		animation: challenge-receipt-arrive 440ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes challenge-nav-arrive {
		from {
			opacity: 0;
			translate: 0 -8px;
		}
		to {
			opacity: 1;
			translate: 0 0;
		}
	}

	@keyframes challenge-route-arrive {
		from {
			opacity: 0;
			scale: 0.992;
			translate: 0 12px;
		}
		to {
			opacity: 1;
			scale: 1;
			translate: 0 0;
		}
	}

	@keyframes challenge-receipt-arrive {
		0% {
			opacity: 0;
			translate: 0 -12px;
		}
		72% {
			opacity: 1;
			translate: 0 2px;
		}
		100% {
			opacity: 1;
			translate: 0 0;
		}
	}

	.demo-toast-container {
		display: grid;
		gap: 8px;
		pointer-events: none;
		position: fixed;
		right: calc(12px + env(safe-area-inset-right, 0px));
		top: calc(12px + env(safe-area-inset-top, 0px));
		width: min(420px, calc(100vw - 24px));
		z-index: 200;
	}

	.demo-toast-container > :global(*) {
		pointer-events: auto;
	}


	/* A solid, mint arrival ring is distinct from persistent keyboard focus
	   without resembling a diagnostic boundary. */
	:global(.demo-focus-pulse[data-focus-arrival='true']) {
		animation: challenge-focus-pulse 900ms ease-out both;
		outline: 2px solid var(--challenge-focus-mint) !important;
		outline-offset: 2px;
	}

	/* Card-like focused and arrival targets use the same rounded boundary as the
	   surface itself. Draw the cue inside those surfaces so grid containment
	   cannot clip one or more sides of the ring. */
	:global(.demo-focus-surface:focus-visible),
	:global(.demo-focus-surface.demo-focus-pulse[data-focus-arrival='true']) {
		border-radius: var(--worn-radius);
		outline: 0 !important;
		position: relative;
	}

	:global(.demo-focus-surface:focus-visible::after),
	:global(.demo-focus-surface.demo-focus-pulse[data-focus-arrival='true']::after) {
		border-radius: var(--demo-focus-ring-radius, inherit);
		box-sizing: border-box;
		content: '';
		inset: var(--demo-focus-ring-inset, 0);
		pointer-events: none;
		position: absolute;
		z-index: 4;
	}

	:global(.demo-focus-surface:focus-visible::after) {
		border: 2px solid var(--challenge-focus-mint);
	}

	:global(.demo-focus-surface.demo-focus-pulse[data-focus-arrival='true']::after) {
		animation: challenge-focus-pulse 900ms ease-out both;
		border: 2px solid var(--challenge-focus-mint);
	}

	@keyframes challenge-focus-pulse {
		0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--challenge-focus-mint) 0%, transparent); }
		45% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--challenge-focus-mint) 26%, transparent); }
		100% { box-shadow: 0 0 0 2px color-mix(in srgb, var(--challenge-focus-mint) 12%, transparent); }
	}

	@media (hover: hover) and (pointer: fine) {
		.challenge-brand:hover,
		.challenge-shell-nav nav a:hover {
			background: var(--worn-hover-bg);
			color: var(--worn-text);
		}
	}

	@media (max-width: 700px) {
		.challenge-shell {
			gap: 12px;
			padding: 12px 8px 32px;
		}

		.challenge-shell-nav {
			align-items: stretch;
			display: grid;
			gap: 6px;
		}

		.challenge-shell-nav nav {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}

		.challenge-shell-nav nav a {
			justify-content: center;
			padding-inline: 4px;
		}

		.challenge-shell-nav nav .pending-approval-link {
			grid-column: 1 / -1;
		}

		.challenge-route :global(.worn-receipt) {
			margin-block: 12px 14px;
			padding: 14px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.challenge-shell-nav,
		.challenge-route > :global(.demo-panel),
		.challenge-route :global([data-webmcp-receipt]) {
			animation: none;
		}

		.challenge-shell-nav nav a {
			transition: none;
		}

		:global(.demo-focus-pulse[data-focus-arrival='true']),
		:global(.demo-focus-surface.demo-focus-pulse[data-focus-arrival='true']::after) {
			animation: none;
		}
	}

	@media (max-width: 360px) {
		.challenge-brand small {
			display: none;
		}
		.challenge-shell-nav nav a {
			font-size: 11px;
		}
	}
</style>
