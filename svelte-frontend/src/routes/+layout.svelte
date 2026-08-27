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

		<nav aria-label="Challenge pages">
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
	}

	.challenge-shell-nav nav a[aria-current='page'] {
		background: var(--worn-selected-bg);
		border-color: var(--worn-border-strong);
		color: var(--worn-selected-fg);
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
