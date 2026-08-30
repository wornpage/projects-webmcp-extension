<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		WornAccordion,
		WornBadge,
		WornButton,
		WornFoldedSurface,
		WornReactionButton,
		WornSelect
	} from '$lib/components';
	import {
		PACK_ACTIONS,
		blockerText,
		dueDateLabel,
		dueUrgency,
		energyLabel,
		hasBlocker,
		ownerLabel,
		packAge,
		primaryCommand,
		primaryCommandNavigation,
		workflowCardClass,
		workflowLabel,
		workTitle,
		type DemoPack
	} from '$lib/demo-workflow';

	const REACTION_EMOJI = ['👍', '🎉', '🚀', '😅', '🔥'] as const;
	const SNOOZE_OPTIONS = [
		{ value: '', label: 'Snooze' },
		{ value: '1', label: '1 day' },
		{ value: '3', label: '3 days' },
		{ value: '7', label: '7 days' }
	];

	function displayedTypeLabel(value: unknown): string {
		return String(value ?? '');
	}
	function typeAndAreaMatch(type: unknown, area: unknown): boolean {
		if (!type || type === 'general' || !area) return false;
		return displayedTypeLabel(type).trim().toLowerCase() === String(area).trim().toLowerCase();
	}

	let {
		pack,
		index,
		selectedId,
		focusedIndex,
		batchMode,
		busyId,
		busyAction,
		batchCheckbox,
		receipt,
		receiptUndo,
		snoozeDays,
		onCardClick,
		onCardKeydown,
		onCardFocus,
		onDragStart,
		onDragOver,
		onDragEnd,
		onDrop,
		onTrackRecent,
		onPrimaryMutation,
		onAction,
		onTogglePin,
		onApplySnooze,
		onRepeatPack,
		onReactPack,
		onUndoReceipt
	}: {
		pack: DemoPack;
		index: number;
		selectedId?: string;
		focusedIndex: number;
		batchMode: boolean;
		busyId: string;
		busyAction: string;
		batchCheckbox: Snippet<[DemoPack]>;
		receipt: { pack?: { id?: string }; summary?: string } | null;
		receiptUndo: { packId: string } | null;
		snoozeDays: Record<string, string>;
		onCardClick: (event: MouseEvent, packId: string) => void;
		onCardKeydown: (event: KeyboardEvent, index: number) => void;
		onCardFocus: (index: number) => void;
		onDragStart: (event: DragEvent, packId: string) => void;
		onDragOver: (event: DragEvent, packId: string) => void;
		onDragEnd: () => void;
		onDrop: (event: DragEvent, packId: string) => void;
		onTrackRecent: (packId: string) => void;
		onPrimaryMutation: (pack: DemoPack, action: string) => void;
		onAction: (pack: DemoPack, action: string) => void;
		onTogglePin: (pack: DemoPack) => void;
		onApplySnooze: (pack: DemoPack, key: string) => void;
		onRepeatPack: (pack: DemoPack) => void;
		onReactPack: (pack: DemoPack, emoji: string) => void;
		onUndoReceipt: () => void;
	} = $props();

	let command = $derived(primaryCommand(pack));
	let commandHref = $derived(PACK_ACTIONS.has(command.action) ? undefined : primaryCommandNavigation(pack));
	let workflow = $derived(workflowLabel(pack));
	let cardCls = $derived(workflowCardClass(pack, false, false));
	let packKey = $derived(pack.id || '');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<!-- The card-level click only augments batch mode; the keyboard path is the explicit role="checkbox" button rendered with it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<WornFoldedSurface
	as="article"
	reveal="hover"
	class={`demo-work-card demo-focus-surface ${cardCls}${pack.id === selectedId ? ' selected' : ''}${batchMode ? ' batch-active' : ''}`}
	tabindex={focusedIndex === index ? 0 : -1}
	aria-label={`Work ${workTitle(pack)}`}
	aria-current={pack.id === selectedId ? 'true' : undefined}
	data-pack-id={pack.id}
	data-work-item
	draggable="true"
	ondragstart={(event) => onDragStart(event, pack.id!)}
	ondragover={(event) => onDragOver(event, pack.id!)}
	ondragend={onDragEnd}
	ondrop={(event) => onDrop(event, pack.id!)}
	onclick={(event) => onCardClick(event, pack.id!)}
	onkeydown={(event) => onCardKeydown(event, index)}
	onfocus={() => onCardFocus(index)}
>
	{#if batchMode}
		{@render batchCheckbox(pack)}
	{/if}
	<div class="demo-card-head">
		<a class="demo-card-title" data-action="select" data-pack={pack.id} title="Set the next action for {workTitle(pack)}" aria-label="Set the next action for {workTitle(pack)}" href={`/next?pack=${encodeURIComponent(pack.id || '')}`} onclick={() => onTrackRecent(pack.id!)}>
			{#if pack.pinned}<span class="demo-pin-flag" role="img" title="Pinned to the top of the list" aria-label="Pinned"></span>{/if}
			{workTitle(pack)}
		</a>
		{#if pack.type && pack.type !== 'general'}
			<span class="demo-type-badge" data-type={pack.type}>{displayedTypeLabel(pack.type)}</span>
			<span class="demo-age">{packAge(pack)}</span>
		{/if}
		<WornBadge label={workflow} />
		{#if pack.decision && pack.status !== 'done'}
			<WornBadge variant="warn" label="Needs decision" title={pack.decider ? `Decision needed from ${pack.decider}` : 'Decision needed'} />
		{/if}
	</div>
	{#if hasBlocker(pack)}
		<div class="demo-card-facts" role="group" aria-label="Blocker: {blockerText(pack)}.">
			<div class="demo-card-fact"><span>Blocker</span><strong>{blockerText(pack)}</strong></div>
		</div>
	{/if}
	<div class="work-command-row">
		{#if commandHref}
			<WornButton data-work-primary-navigation variant="primary" href={commandHref} data-action="run-next" data-pack={pack.id}>
				{command.label}
			</WornButton>
		{:else}
			<WornButton data-work-primary-mutation type="button" variant="primary" data-action="run-next" data-pack={pack.id}
				disabled={busyId === pack.id}
				onclick={() => onPrimaryMutation(pack, command.action)}
			>
				{busyId === pack.id ? 'Running…' : command.label}
			</WornButton>
		{/if}
	</div>
	<div class="demo-card-meta">
		{#if pack.due}<span class="due-{dueUrgency(pack)}">{dueDateLabel(pack)}</span>{/if}
		{#if pack.area && !typeAndAreaMatch(pack.type, pack.area)}<WornBadge variant="muted" label={pack.area} />{/if}
		{#if pack.recurrence && pack.recurrence !== 'none'}
			<WornBadge size="sm" label={pack.recurrence.charAt(0).toUpperCase() + pack.recurrence.slice(1)} />
		{/if}
		<span class="demo-owner-text">{ownerLabel(pack.owner)}</span>
	</div>
	{#if pack.status === 'done' && !pack.archived}
		<div class="demo-archive-row">
			<WornButton size="sm" variant="default" data-action="archive" data-pack={pack.id} disabled={busyId === pack.id} onclick={() => onAction(pack, 'archive')}>Archive</WornButton>
		</div>
	{/if}
	{#if receipt?.pack?.id === pack.id && receipt?.summary}
		<div class="demo-card-receipt" data-receipt-surface="card" data-card-receipt={pack.id} role="group" tabindex="-1">
			<span>Last result</span>
			<strong>{receipt.summary}</strong>
			{#if receiptUndo && receiptUndo.packId === pack.id}
				<WornButton type="button" size="sm" data-receipt-undo title="Undo this action and restore the previous state." onclick={onUndoReceipt}>Undo</WornButton>
			{/if}
		</div>
	{/if}
	{#if REACTION_EMOJI.some((emoji) => ((pack.reactions as Record<string, number>)?.[emoji] ?? 0) > 0)}
		<div class="demo-card-reactions">
			{#each REACTION_EMOJI.filter((emoji) => ((pack.reactions as Record<string, number>)?.[emoji] ?? 0) > 0) as emoji (emoji)}
				<WornReactionButton reaction={emoji} count={(pack.reactions as Record<string, number>)?.[emoji] ?? 0} pressed={true} disabled={busyId === pack.id} onclick={() => onReactPack(pack, emoji)} />
			{/each}
		</div>
	{/if}
	<WornAccordion label="Other actions">
		{#if pack.energy || pack.location || pack.milestone}
			<dl class="demo-card-extra">
				{#if pack.energy}<div><dt>Energy</dt><dd>{energyLabel(String(pack.energy))}</dd></div>{/if}
				{#if pack.location}<div><dt>Location</dt><dd>{pack.location}</dd></div>{/if}
				{#if pack.milestone}<div><dt>Milestone</dt><dd>{pack.milestone}</dd></div>{/if}
			</dl>
		{/if}
		<div class="demo-card-reactions demo-card-reactions-picker">
			{#each REACTION_EMOJI as emoji (emoji)}
				<WornReactionButton reaction={emoji} count={(pack.reactions as Record<string, number>)?.[emoji] ?? 0} pressed={((pack.reactions as Record<string, number>)?.[emoji] ?? 0) > 0} disabled={busyId === pack.id} onclick={() => onReactPack(pack, emoji)} />
			{/each}
		</div>
		<div class="work-card-actions" onpointerdown={(event) => event.stopPropagation()} onclick={(event) => event.stopPropagation()}>
			<WornButton type="button" size="sm" data-action="open" data-pack={pack.id} disabled={busyId === pack.id && busyAction === 'open'} onclick={() => onAction(pack, 'open')}>Open</WornButton>
			<WornSelect
				class="work-snooze-select"
				bind:value={
					() => snoozeDays[packKey] ?? '',
					(value) => { snoozeDays[packKey] = value; }
				}
				options={SNOOZE_OPTIONS}
				data-action="snooze"
				data-pack={pack.id}
				disabled={busyId === pack.id}
				aria-label={`Snooze ${workTitle(pack)}`}
				onchange={() => onApplySnooze(pack, packKey)}
			/>
			<WornButton type="button" size="sm" data-action="repeat" data-pack={pack.id} disabled={busyId === pack.id} onclick={() => onRepeatPack(pack)}>Repeat</WornButton>
			<WornButton type="button" size="sm" data-action="pin" data-pack={pack.id} aria-pressed={pack.pinned} disabled={busyId === pack.id && busyAction === 'pin'} onclick={() => onTogglePin(pack)} title={pack.pinned ? 'Remove from the top of the list' : 'Keep this at the top of the list'}>{pack.pinned ? 'Unpin' : 'Pin'}</WornButton>
			<WornButton size="sm" data-action="focus" data-pack={pack.id} href={`/work?focus=${encodeURIComponent(pack.id || '')}`}>Focus</WornButton>
			{#if pack.status !== 'done'}
				{#if hasBlocker(pack)}
					<WornButton type="button" size="sm" data-action="unblock" data-pack={pack.id} disabled={busyId === pack.id} onclick={() => onAction(pack, 'unblock')}>Clear blocker</WornButton>
				{:else}
					<WornButton type="button" size="sm" data-action="block" data-pack={pack.id} disabled={busyId === pack.id} onclick={() => onAction(pack, 'block')}>Mark blocked</WornButton>
				{/if}
				<WornButton type="button" size="sm" data-action="done" data-pack={pack.id} disabled={busyId === pack.id} onclick={() => onAction(pack, 'done')}>Mark done</WornButton>
			{/if}
		</div>
	</WornAccordion>
</WornFoldedSurface>

<style>
	.demo-card-extra { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0 0 8px; font-size: 12px; }
	.demo-card-extra > div { display: contents; }
	.demo-card-extra dt { color: var(--worn-text-muted); font-family: var(--font-typewriter); }
	.demo-card-extra dd { margin: 0; color: var(--worn-text); }
	.demo-card-reactions { display: flex; gap: 4px; margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--worn-border); }
	.work-command-row, .work-card-actions { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; max-width: 100%; }
	.demo-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; margin-block-start: 8px; }
	.work-command-row :global(.worn-btn), .work-card-actions :global(.worn-btn) { box-sizing: border-box; min-width: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
	.work-card-actions :global(.worn-select) { box-sizing: border-box; min-width: 0; max-width: 100%; }
	:global(.demo-work-card.batch-active) .demo-card-head { min-block-size: 44px; padding-inline-start: 52px; }
	:global(.demo-work-card) { transition: box-shadow .1s ease, background .1s ease; }
	/* Both density cards use these generated urgency classes. Keep the visual
	   contract with the list-card component rather than the route shell. */
	:global(.due-overdue) { border-color: var(--worn-danger-border) !important; background: var(--worn-danger-bg) !important; color: var(--worn-danger-text) !important; }
	:global(.due-today) { border-color: var(--worn-warning-border) !important; background: var(--worn-warning-bg) !important; color: var(--worn-warning-text) !important; }
	:global(.due-soon) { border-color: var(--worn-accent) !important; background: var(--worn-accent-50) !important; }
	@media (max-width: 640px) {
		.demo-card-meta { gap: 6px; margin-block-start: 6px; }
		:global(.work-snooze-select) { width: 100%; }
	}
</style>
