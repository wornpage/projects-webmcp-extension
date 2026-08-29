<script lang="ts">
	type ActivityCell = {
		label: string;
		value: string;
	};

	let {
		id,
		route,
		outcome,
		toolName,
		cells
	}: {
		id?: string;
		route: 'work' | 'review' | 'next';
		outcome: string;
		toolName: string;
		cells: ActivityCell[];
	} = $props();

	const routeLabel = $derived(route[0].toUpperCase() + route.slice(1));
</script>

<section
	{id}
	class="webmcp-activity-strip"
	data-webmcp-receipt={route}
	aria-label={`Latest ${routeLabel} agent activity`}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	<div class="webmcp-activity-strip-head">
		<p class="webmcp-activity-kicker">Agent activity</p>
		<p class="webmcp-tool-provenance">WebMCP · {toolName}</p>
	</div>
	<p class="webmcp-activity-outcome">{outcome}</p>
	<dl class="webmcp-activity-evidence">
		{#each cells as cell (cell.label)}
			<div>
				<dt>{cell.label}</dt>
				<dd>{cell.value}</dd>
			</div>
		{/each}
	</dl>
</section>

<style>
	.webmcp-activity-strip {
		background: color-mix(in srgb, var(--worn-selected-bg) 58%, var(--worn-surface));
		border: 1px solid var(--worn-border-strong);
		border-left: 3px solid var(--worn-accent);
		border-radius: var(--worn-radius);
		box-shadow: var(--worn-shadow-sm);
		display: grid;
		gap: 8px;
		min-width: 0;
		padding: 12px 14px;
	}

	.webmcp-activity-strip-head {
		align-items: baseline;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		justify-content: space-between;
		min-width: 0;
	}

	.webmcp-activity-kicker,
	.webmcp-tool-provenance,
	.webmcp-activity-outcome,
	.webmcp-activity-evidence,
	.webmcp-activity-evidence dt,
	.webmcp-activity-evidence dd {
		margin: 0;
	}

	.webmcp-activity-kicker {
		color: var(--worn-text-secondary);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.webmcp-tool-provenance {
		color: var(--worn-text-secondary);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		overflow-wrap: anywhere;
	}

	.webmcp-activity-outcome {
		color: var(--worn-text);
		font-size: 15px;
		font-weight: 700;
		line-height: 1.4;
	}

	.webmcp-activity-evidence {
		display: grid;
		gap: 6px 14px;
		grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
		min-width: 0;
	}

	.webmcp-activity-evidence > div {
		border-top: 1px solid color-mix(in srgb, var(--worn-border) 82%, transparent);
		min-width: 0;
		padding-top: 6px;
	}

	.webmcp-activity-evidence dt {
		color: var(--worn-text-muted);
		font-size: 11px;
		font-weight: 650;
		line-height: 1.3;
	}

	.webmcp-activity-evidence dd {
		color: var(--worn-text-secondary);
		font-size: 12px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	@media (max-width: 500px) {
		.webmcp-activity-strip {
			padding: 11px 12px;
		}

		.webmcp-activity-strip-head {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
