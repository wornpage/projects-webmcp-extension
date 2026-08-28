<script lang="ts">
	import { page } from '$app/stores';
	import { toasts } from '$lib/demo-client';
	import WornToast from '$lib/components/WornToast.svelte';

	type RouteItem = {
		href: '/webmcp-challenge' | '/work' | '/review' | '/next';
		label: string;
	};

	const ROUTES: readonly RouteItem[] = [
		{ href: '/webmcp-challenge', label: 'Guide' },
		{ href: '/work', label: '1 Work' },
		{ href: '/review', label: '2 Review' },
		{ href: '/next', label: '3 Next' }
	];

	let { children }: { children: any } = $props();
	let pathname = $derived($page.url.pathname);
	let routeLabel = $derived(ROUTES.find((item) => item.href === pathname)?.label ?? 'WebMCP demo');

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
		</nav>
	</header>

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
		outline: 2px dashed var(--worn-focus);
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


	/* Keep cross-route arrival distinct without competing with the focused
	   control: this short-lived outline marks the destination for every motion
	   preference, then the focused control keeps its normal keyboard outline. */
	:global(.demo-focus-pulse[data-focus-arrival='true']) {
		outline: 2px solid var(--worn-focus) !important;
		outline-offset: 2px;
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
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.challenge-shell-nav nav a {
			justify-content: center;
			padding-inline: 4px;
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
