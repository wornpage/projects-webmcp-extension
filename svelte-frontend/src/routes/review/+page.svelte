<script lang="ts">
	import { getAbortSignal, onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Copy from '@lucide/svelte/icons/copy';
	import {
		demoState,
		demoStateError,
		demoStateLoading,
		refreshDemoState,
		runPackAction,
		togglePackPinned,
		setSelectedWork,
		actionBusy,
		ChallengeStateError,
		toasts
	} from '$lib/demo-client';
	import { buildActionUndoSnapshot, commitActionUndo, receiptUndo, undoReceipt } from '$lib/undo';
	import { WornButton, WornIconButton, WornContainer, WornAccordion, WornError, WornEmpty, WornBadge, WornInput, WornPage, WornSegmentedControl, WornToolbar, WornReceipt, WornFoldedSurface } from '$lib/components';
	import { workItemIssues } from '$lib/work-item-issues';
	import { activityTextWithoutActor } from '$lib/activity';
	import { focusAndPulse } from '$lib/focus-pulse.mjs';
	import { settleProgressiveReveal } from '$lib/progressive-reveal.mjs';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import { createCurrentReviewTool, createSetReviewScopeTool, reviewItemPageView, reviewPageView } from './review-webmcp.mjs';
	import {
		PACK_ACTIONS,
		primaryCommand,
		primaryCommandNavigation,
		workflowLabel,
		blockerText,
		hasBlocker,
		isMissingNextAction,
		dueUrgency,
		dueDateLabel,
		workflowCardClass,
		buildStandupText as buildReviewSummaryText,
		receiptCells,
		preferredReviewPack,
		isMissingOwnerValue,
		ownerLabel,
		summarizeReviewQueue,
		workTitle,
		type DemoPack,
		type ReviewSubFilter
	} from '$lib/demo-workflow';

	let query = $state('');
	let busyId = $state('');
	let busyAction = $state('');

	function livePacks(source: DemoPack[]): DemoPack[] {
		return source.filter((pack) => pack.archived !== true);
	}

	function latestMemoryPreview(pack: DemoPack): string {
		const note = activityTextWithoutActor(pack.memory?.at(-1) || '');
		return note.length > 120 ? `${note.slice(0, 117).trimEnd()}…` : note;
	}

	function validationSummary(pack: DemoPack): { label: string; title: string } | null {
		const issues = workItemIssues(pack);
		if (issues.length === 0) return null;
		return {
			label: `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`,
			title: issues.map((issue) => issue.message).join(' ')
		};
	}

	function attentionReasons(pack: DemoPack): string[] {
		const reasons: string[] = [];
		if (hasBlocker(pack)) reasons.push(`Blocked: ${blockerText(pack)}.`);
		if (isMissingNextAction(pack)) reasons.push('No next action is set.');
		if (isMissingOwnerValue(pack.owner)) reasons.push('No owner is assigned.');
		if (pack.decision === true) {
			const decider = String(pack.decider || '').trim() || 'a person';
			reasons.push(`Decision needed from ${decider}.`);
		}
		if (reasons.length === 0 && primaryCommand(pack).action === 'review') {
			reasons.push('The current next action requests review.');
		}
		return [...new Set(reasons)].slice(0, 4);
	}

	const LANDING_TOUR_PACK_ID = 'garage-reset-sort-shelves';

	function isExactLandingReviewTour(search: string): boolean {
		return new URLSearchParams(search).get('tour') === 'landing';
	}

	function landingTourItem(filteredVisible: DemoPack[], landingTourRequested: boolean): DemoPack | null {
		return landingTourRequested
			? filteredVisible.find((pack) => pack.id === LANDING_TOUR_PACK_ID) || null
			: null;
	}

	function reviewListAfterSpotlight(filteredVisible: DemoPack[], landingTourReview: DemoPack | null): DemoPack[] {
		return landingTourReview
			? filteredVisible.filter((pack) => pack.id !== landingTourReview.id)
			: filteredVisible.slice(1);
	}

	let packs = $derived(livePacks(($demoState?.packs ?? []) as DemoPack[]));
	let reviewSubFilter = $state<ReviewSubFilter>('all');
	// The route store updates on client-side query navigation. The browser guard
	// keeps prerendering from reading URL search params.
	let landingTourRequested = $derived(browser && isExactLandingReviewTour($page.url.search));
	let reviewQueue = $derived(summarizeReviewQueue(packs, query, reviewSubFilter));
	let reviewTotal = $derived(reviewQueue.reviewTotal);
	let visible = $derived(reviewQueue.visible);
	let receipt = $derived($demoState?.actionReceipt || null);
	let webMcpScopeReceipt = $state<{
		summary: string;
		cells: Array<{ label: string; value: string }>;
		scopeKey: string;
	} | null>(null);
	let reviewSummaryText = $derived(buildReviewSummaryText(visible));
	let blockedCount = $derived(reviewQueue.blockedCount);
	let missingNextCount = $derived(reviewQueue.missingNextCount);
	let ownerGapCount = $derived(reviewQueue.ownerGapCount);
	let reviewFilterOptions = $derived.by(() => {
		const options: { id: ReviewSubFilter; label: string }[] = [{ id: 'all', label: `All ${visible.length}` }];
		if (blockedCount > 0 || reviewSubFilter === 'blocked') options.push({ id: 'blocked', label: `Blocked ${blockedCount}` });
		if (missingNextCount > 0 || reviewSubFilter === 'missing-next') options.push({ id: 'missing-next', label: `No next ${missingNextCount}` });
		if (ownerGapCount > 0 || reviewSubFilter === 'owner-gap') options.push({ id: 'owner-gap', label: `No owner ${ownerGapCount}` });
		return options;
	});
	const REVIEW_RENDER_PAGE_SIZE = 8;
	let reviewRenderLimit = $state(REVIEW_RENDER_PAGE_SIZE);
	let filteredVisible = $derived(reviewQueue.filteredVisible);
	let reviewTitle = $derived(
		reviewTotal > 0
			? filteredVisible.length === reviewTotal
				? `${reviewTotal} to review · ${blockedCount} blocked`
				: `${filteredVisible.length} of ${reviewTotal} scoped · ${blockedCount} blocked`
			: undefined
	);
	let landingTourReview = $derived(landingTourItem(filteredVisible, landingTourRequested));
	let firstReview = $derived(landingTourReview || filteredVisible[0] || null);
	let listVisible = $derived(reviewListAfterSpotlight(filteredVisible, landingTourReview));
	let reviewFilterKey = $derived(`${query}\u0000${reviewSubFilter}`);
	// Every Review mode advances through the same bounded page. New searches and
	// queue subfilters return to the first page instead of retaining a prior
	// expansion level.
	$effect(() => {
		reviewFilterKey;
		reviewRenderLimit = REVIEW_RENDER_PAGE_SIZE;
	});
	let renderedList = $derived(listVisible.slice(0, reviewRenderLimit));
	let renderedReviewCount = $derived((firstReview ? 1 : 0) + renderedList.length);
	let hiddenReviewCount = $derived(Math.max(0, listVisible.length - renderedList.length));
	let currentReviewView = $derived.by(() => reviewPageView({
		scope: { query, filter: reviewSubFilter },
		availableFilters: reviewFilterOptions.map((option) => option.id),
		counts: {
			totalReview: reviewTotal,
			searchMatches: visible.length,
			filtered: filteredVisible.length,
			shown: renderedReviewCount,
			remaining: hiddenReviewCount,
			blocked: blockedCount,
			missingNext: missingNextCount,
			missingOwner: ownerGapCount
		},
		upNext: reviewItemForPageTool(firstReview),
		items: renderedList.map(reviewItemForPageTool)
	}));
	let reviewReceiptScopeKey = $derived(currentReviewView
		? JSON.stringify({ scope: currentReviewView.scope, counts: currentReviewView.counts })
		: '');

	$effect(() => {
		if (webMcpScopeReceipt && webMcpScopeReceipt.scopeKey !== reviewReceiptScopeKey) {
			webMcpScopeReceipt = null;
		}
	});

	function reviewItemForPageTool(pack: DemoPack | null) {
		if (!pack) return null;
		return reviewItemPageView({
			id: pack.id,
			title: workTitle(pack),
			workflow: workflowLabel(pack),
			owner: ownerLabel(pack.owner),
			due: pack.due ? dueDateLabel(pack.due) : null,
			blocker: hasBlocker(pack) ? blockerText(pack) : null,
			attentionReasons: attentionReasons(pack)
		});
	}

	function reviewRevealLabel() {
		const shown = renderedReviewCount;
		const total = filteredVisible.length;
		const nextCount = Math.min(REVIEW_RENDER_PAGE_SIZE, hiddenReviewCount);
		const itemNoun = nextCount === 1 ? 'review item' : 'review items';
		return `Show ${nextCount} more ${itemNoun} (${shown} of ${total})`;
	}

	function reviewRevealList(trigger: HTMLElement): HTMLElement | null {
		const list = trigger.closest('[data-review-list]');
		return list instanceof HTMLElement ? list : null;
	}

	async function showMoreReviewItems(event: MouseEvent) {
		const trigger = event.currentTarget;
		if (!(trigger instanceof HTMLElement)) return;
		const reviewList = reviewRevealList(trigger);
		if (!reviewList) return;
		const previousCount = renderedList.length;
		const nextLimit = Math.min(listVisible.length, reviewRenderLimit + REVIEW_RENDER_PAGE_SIZE);
		const removesTrigger = nextLimit >= listVisible.length;
		reviewRenderLimit = nextLimit;
		await settleProgressiveReveal({
			settled: tick(),
			removesTrigger,
			trigger,
			getDestination: () => {
				const firstNewCard = reviewList.querySelector<HTMLElement>(
					`[data-review-card]:nth-child(${previousCount + 1})`
				);
				const firstNewTitle = firstNewCard?.querySelector<HTMLElement>('.demo-card-title');
				return firstNewCard && firstNewTitle
					? { focusTarget: firstNewTitle, pulseTarget: firstNewCard }
					: null;
			}
		});
	}

	async function applyReviewScope(
		nextQuery: string,
		nextFilter: ReviewSubFilter,
		destination: 'filters' | 'results',
		requireVisibleFocus = false
	) {
		const changed = query !== nextQuery || reviewSubFilter !== nextFilter;
		query = nextQuery;
		reviewSubFilter = nextFilter;
		await tick();
		if (destination === 'filters') {
			document.getElementById('review-filter-query')?.focus();
			return { changed, focus: null };
		}

		const firstTitle = document.querySelector<HTMLElement>('.review-priority .demo-card-title');
		const filterInput = document.getElementById('review-filter-query');
		const reviewList = document.querySelector<HTMLElement>('[data-review-list]');
		const focusTarget = firstTitle || filterInput || reviewList;
		if (!focusTarget) throw new Error('Review scope destination did not render.');
		const itemId = firstTitle?.closest<HTMLElement>('[data-pack-id]')?.dataset.packId || null;
		if (firstTitle && !itemId) throw new Error('Review scope destination is missing its work-item identity.');
		const focusReceipt = focusAndPulse(focusTarget, {
			pulseTarget: firstTitle?.closest<HTMLElement>('.review-priority') || focusTarget,
			requireVisibleFocus
		});
		return {
			changed,
			focus: firstTitle
				? { target: 'item' as const, itemId: itemId as string, ...focusReceipt }
				: focusTarget === filterInput
					? { target: 'search' as const, itemId: null, ...focusReceipt }
					: { target: 'queue' as const, itemId: null, ...focusReceipt }
		};
	}

	async function clearReviewFilters() {
		await applyReviewScope('', 'all', 'filters');
	}

	async function setReviewScopeFromWebMcp({
		query: nextQuery,
		filter: nextFilter
	}: {
		query: string;
		filter: ReviewSubFilter;
	}) {
		const requestedQueue = summarizeReviewQueue(packs, nextQuery, 'all');
		const filterAvailable = nextFilter === 'all' || nextFilter === reviewSubFilter ||
			(nextFilter === 'blocked' && requestedQueue.blockedCount > 0) ||
			(nextFilter === 'missing-next' && requestedQueue.missingNextCount > 0) ||
			(nextFilter === 'owner-gap' && requestedQueue.ownerGapCount > 0);
		if (!filterAvailable) {
			throw new Error(`Review filter "${nextFilter}" is not available for the current search.`);
		}
		const { changed, focus } = await applyReviewScope(nextQuery, nextFilter, 'results', true);
		if (!focus) throw new Error('Review did not verify its visible scope destination.');
		if (!currentReviewView) throw new Error('Review did not render the requested queue scope.');
		const filterLabel = nextFilter === 'all'
			? 'All review items'
			: nextFilter === 'blocked'
				? 'Blocked'
				: nextFilter === 'missing-next'
					? 'No next action'
					: 'No owner';
		webMcpScopeReceipt = {
			summary: `Agent scoped Review to ${currentReviewView.counts.shown} visible ${currentReviewView.counts.shown === 1 ? 'item' : 'items'}.`,
			cells: [
				{ label: 'Search', value: currentReviewView.scope.query.trim() || 'Any text' },
				{ label: 'Queue filter', value: filterLabel },
				{ label: 'Denominator', value: `${currentReviewView.counts.shown} shown of ${currentReviewView.counts.filtered} scoped · ${currentReviewView.counts.totalReview} total review` },
				{ label: 'Workspace data', value: 'Unchanged' }
			],
			scopeKey: reviewReceiptScopeKey
		};
		return { changed, focus, review: currentReviewView };
	}

	let stopReviewWebMcp: (() => void) | null = null;
	onMount(() => {
		stopReviewWebMcp = registerPageTools(document, [
			createCurrentReviewTool(() => currentReviewView),
			createSetReviewScopeTool(setReviewScopeFromWebMcp)
		]);
	});
	onDestroy(() => {
		stopReviewWebMcp?.();
		stopReviewWebMcp = null;
	});

	// Entering Review selects the preferred pack after a successful refresh.
	async function refreshReview({ reuseRecent = false, signal }: { reuseRecent?: boolean; signal?: AbortSignal } = {}) {
		const state = await refreshDemoState({ reuseRecent });
		if (!state || signal?.aborted) return;
		const list = livePacks(state.packs as DemoPack[]);
		const tourPack = landingTourRequested
			? summarizeReviewQueue(list, query, reviewSubFilter).filteredVisible.find(
				(pack) => pack.id === LANDING_TOUR_PACK_ID
			)
			: null;
		const selected = tourPack || preferredReviewPack(list);
		if (selected?.id && selected.id !== state.selectedId) {
			setSelectedWork(selected.id).catch((e) => console.warn('Failed to sync selected work:', e));
		}
	}

	let lastReviewSearch: string | null = null;
	let focusedReviewId = '';
	$effect(() => {
		if (!browser) return;
		const currentReviewSearch = $page.url.search;
		if (lastReviewSearch === currentReviewSearch) return;
		lastReviewSearch = currentReviewSearch;
		const signal = getAbortSignal();
		void refreshReview({ reuseRecent: true, signal });
	});

	$effect(() => {
		if (!browser) return;
		const target = $page.url.searchParams.get('focus') || '';
		if (!target || target === focusedReviewId) return;
		focusedReviewId = target;
		void tick().then(() => {
			const card = document.querySelector<HTMLElement>(`[data-review-card][data-pack-id="${CSS.escape(target)}"], .review-priority[data-pack-id="${CSS.escape(target)}"]`);
			const destination = card?.querySelector<HTMLElement>('.demo-card-title') || card;
			if (destination) focusAndPulse(destination, { block: 'center', pulseTarget: card || destination });
		});
	});

async function handleCardKeys(e: KeyboardEvent) {
  // Ignore keys aimed at inner controls (buttons, inputs): space on a focused
  // button must activate it, not navigate the card.
  const target = e.target as HTMLElement | null;
  if (target && target.closest?.('button, input, textarea, select, a, [role="button"]')) return;
  // Alt+Space is a window-menu gesture in some browsers; repeated keys would
  // fire goto() per repeat.
  if (e.altKey || e.shiftKey || e.repeat) return;
	const cards = document.querySelectorAll('[data-review-list] .demo-review-card');
  if (!cards.length) return;
  const current = Array.from(cards).indexOf(document.activeElement as Element);
  if (e.key === 'ArrowDown') { e.preventDefault(); const next = (current + 1) % cards.length; (cards[next] as HTMLElement)?.focus(); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); const prev = (current - 1 + cards.length) % cards.length; (cards[prev] as HTMLElement)?.focus(); return; }
  if (current < 0) return;
  const packId = (cards[current] as HTMLElement)?.dataset?.packId;
  if (!packId) return;
  if (e.key === ' ' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); await handoffToNext(packId); return; }
  if (e.key === 'Enter') { e.preventDefault(); await handoffToNext(packId); return; }
}

	async function handoffToNext(packId: string | undefined, event?: MouseEvent) {
		if (!packId) return;
		event?.preventDefault();
		await goto(`/next?pack=${encodeURIComponent(packId)}`);
		await tick();
		const preview = document.querySelector<HTMLElement>('[data-next-preview]');
		if (!preview) throw new Error('Next preview did not render.');
		focusAndPulse(preview, { behavior: 'auto', block: 'center', requireVisibleFocus: true });
	}

	async function doAction(pack: DemoPack, action: string) {
		if (!pack.id || busyId) return;
		busyId = pack.id;
		busyAction = action;
		actionBusy.set(pack.id);
		const snapshot = buildActionUndoSnapshot(packs, pack.id, action);
		try {
			await runPackAction(pack.id, action);
			commitActionUndo(snapshot);
		} catch (e) {
			toasts.update((t) => [...t, {
				id: `err-${Date.now()}`,
				message: e instanceof ChallengeStateError ? e.message : 'Action failed.',
				kind: 'error'
			}]);
		} finally {
			busyId = '';
			busyAction = '';
		}
	}

	async function copyReviewSummary() {
		const text = reviewSummaryText;
		try {
			await navigator.clipboard.writeText(text);
			toasts.update((t) => [...t, {
				id: `copy-${Date.now()}`,
				message: 'Review summary copied.',
				kind: 'success'
			}]);
		} catch {
			toasts.update((t) => [...t, {
				id: `copy-${Date.now()}`,
				message: 'Copy blocked by browser.',
				kind: 'error'
			}]);
		}
	}

	async function togglePin(pack: DemoPack) {
		if (!pack.id || busyId) return;
		busyId = pack.id;
		busyAction = 'pin';
		try {
			await togglePackPinned(pack.id);
		} catch (e) {
			toasts.update((t) => [...t, {
				id: `pin-${Date.now()}`,
				message: e instanceof ChallengeStateError ? e.message : 'Could not toggle pin.',
				kind: 'error'
			}]);
		} finally {
			busyId = '';
			busyAction = '';
		}
	}
</script>

<svelte:head>
	<title>Review — Wornpage Projects™</title>
</svelte:head>

<!-- Keep existing browser-local items visible during a background refresh. -->
<WornPage sectionLabel="Step 2 of 3 · Narrow" title="Review" status={reviewTitle} variant="list" loading={$demoStateLoading && packs.length === 0}>
	{#snippet headActions()}
		<div class="review-head-actions">
			{#if visible.length > 0 && !query.trim() && reviewSubFilter === 'all'}
				<WornIconButton type="button" id="copy-review-summary" label="Copy review summary" title="Copy review summary" onclick={copyReviewSummary}>
					<Copy aria-hidden="true" />
				</WornIconButton>
			{/if}
		</div>
	{/snippet}

	{#if $demoStateError}
		<WornError message="Could not load review" detail={$demoStateError} onretry={refreshReview} />
	{/if}

	{#if webMcpScopeReceipt}
		<div data-webmcp-receipt="review">
			<WornReceipt
				summary={webMcpScopeReceipt.summary}
				announce={false}
				cells={webMcpScopeReceipt.cells}
				ondone={() => (webMcpScopeReceipt = null)}
			/>
		</div>
	{/if}

	{#if firstReview}
		{@const firstValidation = validationSummary(firstReview)}
		{@const firstCommand = primaryCommand(firstReview)}
		{@const firstCommandHref = PACK_ACTIONS.has(firstCommand.action) ? undefined : primaryCommandNavigation(firstReview)}
		<div class="review-priority-shell">
		<WornContainer label="Up next">
		<article class="review-priority" data-pack-id={firstReview.id}>
			<div class="review-priority-head">
				<div>
					<div class="review-priority-title"><a class="demo-card-title" data-action="select" data-pack={firstReview.id} title="Set the next action for {workTitle(firstReview)}" aria-label="Set the next action for {workTitle(firstReview)}" href={`/next?pack=${encodeURIComponent(firstReview.id || '')}`} onclick={(event) => handoffToNext(firstReview.id, event)}>{workTitle(firstReview)}</a></div>
				</div>
				<WornBadge label={workflowLabel(firstReview)} />
				{#if firstValidation}<WornBadge variant="warn" label={firstValidation.label} title={firstValidation.title} />{/if}
			</div>
			<div class="review-priority-actions">
				{#if firstCommandHref}
					<WornButton data-review-primary-action data-review-priority-navigation variant="primary" href={firstCommandHref} onclick={firstCommand.action === 'set-next' ? (event) => handoffToNext(firstReview.id, event) : undefined}>{firstCommand.label}</WornButton>
				{:else}
					<WornButton data-review-primary-action data-review-priority-mutation type="button" variant="primary" disabled={busyId === firstReview.id} onclick={() => doAction(firstReview, firstCommand.action)}>
						{busyId === firstReview.id ? 'Running…' : firstCommand.label}
					</WornButton>
				{/if}
				{#if firstCommand.action !== 'set-next'}
					<WornButton data-review-next-action href={`/next?pack=${encodeURIComponent(firstReview.id || '')}`} onclick={(event) => handoffToNext(firstReview.id, event)}>Set next action</WornButton>
				{/if}
			</div>
			{#if hasBlocker(firstReview)}
				<div class="demo-card-facts" role="group" aria-label="Blocker: {blockerText(firstReview)}.">
					<div class="demo-card-fact"><span>Blocker</span><strong>{blockerText(firstReview)}</strong></div>
				</div>
			{/if}
			<div class="demo-card-meta">
				{#if firstReview.due}<span>{dueDateLabel(firstReview.due)}</span>{/if}
				<span>{ownerLabel(firstReview.owner)}</span>
			</div>
			<div class="review-reasons" aria-label="Why this work item surfaced">
				<span>Why this surfaced</span>
				<ul>
					{#each attentionReasons(firstReview) as reason (reason)}<li>{reason}</li>{/each}
				</ul>
			</div>
		</article>
		</WornContainer>
		</div>
	{/if}

	{#if reviewTotal > 1 || reviewSubFilter !== 'all'}
		<WornToolbar label="Review filters">
			<div class="review-filter-controls" data-review-filter-controls>
				<WornSegmentedControl
					options={reviewFilterOptions}
					bind:active={reviewSubFilter}
					name="review-subfilter"
					label="Review queue filter"
				/>
				<WornInput
					id="review-filter-query"
					type="search"
					placeholder="Search review…"
					aria-label="Filter review items by text"
					bind:value={query}
				/>
			</div>
		</WornToolbar>
	{/if}

	{#if receipt?.summary && receipt?.pack?.id}
		<WornReceipt
			summary={receipt.summary}
			announce={false}
			cells={receiptCells(receipt.pack)}
			undoAvailable={!!($receiptUndo && $receiptUndo.packId === receipt.pack.id)}
			onundo={() => undoReceipt()}
		/>
	{/if}

	<div class="demo-review-list" id="review-follow-on-list" data-review-list>
		{#if renderedList.length > 0}
			{#each renderedList as pack (pack.id)}
				{@const command = primaryCommand(pack)}
				{@const commandHref = PACK_ACTIONS.has(command.action) ? undefined : primaryCommandNavigation(pack)}
				{@const workflow = workflowLabel(pack)}
				{@const cardCls = workflowCardClass(pack, false, false)}
				{@const validation = validationSummary(pack)}
				<!-- Focusable card units: each card is a Tab stop and the Arrow
				     keys move focus between cards, Enter opens — matching the work
				     list's arrow navigation. Buttons inside remain reachable by
				     Tab; key events aimed at them are ignored by handleCardKeys. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<WornFoldedSurface as="article" reveal="hover" draggable="true" tabindex={0} class={`demo-review-card ${cardCls}${pack.id === $demoState?.selectedId ? ' selected' : ''}`} data-review-card data-pack-id={pack.id} onkeydown={handleCardKeys}
					aria-label="Review {workTitle(pack)}" aria-keyshortcuts="ArrowUp ArrowDown Enter Space">
					<div class="demo-card-head demo-review-card-head">
						<a class="demo-card-title" data-action="select" data-pack={pack.id} title="Set the next action for {workTitle(pack)}" aria-label="Set the next action for {workTitle(pack)}" href={`/next?pack=${encodeURIComponent(pack.id || '')}`} onclick={(event) => handoffToNext(pack.id, event)}>{workTitle(pack)}</a>
						<WornBadge label={workflow} />
						{#if validation}<WornBadge variant="warn" label={validation.label} title={validation.title} />{/if}
					</div>
					<div class="demo-review-card-main">
						{#if hasBlocker(pack)}
							<div class="demo-card-facts" role="group" aria-label="Blocker: {blockerText(pack)}.">
								<div class="demo-card-fact"><span>Blocker</span><strong>{blockerText(pack)}</strong></div>
							</div>
						{/if}
						<div class="demo-review-card-actions">
							{#if commandHref}
								<WornButton data-review-primary-action data-review-card-navigation variant="primary" href={commandHref} onclick={command.action === 'set-next' ? (event) => handoffToNext(pack.id, event) : undefined}>{command.label}</WornButton>
							{:else}
								<WornButton data-review-primary-action data-review-card-mutation type="button" variant="primary" disabled={busyId === pack.id} onclick={() => doAction(pack, command.action)}>
									{busyId === pack.id ? 'Running…' : command.label}
								</WornButton>
							{/if}
						</div>
					</div>
					<div class="demo-card-meta">
						{#if pack.due}<span>{dueDateLabel(pack.due)}</span>{/if}
						<span>{ownerLabel(pack.owner)}</span>
					</div>
					<div class="review-reasons compact" aria-label="Why this work item surfaced">
						<span>Why this surfaced</span>
						<ul>
							{#each attentionReasons(pack) as reason (reason)}<li>{reason}</li>{/each}
						</ul>
					</div>
					{#if receipt?.pack?.id === pack.id && receipt?.summary}
						<div class="demo-card-receipt review-card-receipt" data-receipt-surface="card">
							<span class="demo-summary-label">Last result</span> <strong>{receipt.summary}</strong>
						</div>
					{:else if pack.memory?.length}
						<div class="review-card-strip" data-memory-strip="card">
							<span class="demo-summary-label">Memory</span> {latestMemoryPreview(pack)}
						</div>
					{/if}
				<WornAccordion label="Other actions">
					<div class="review-other-actions">
						<WornButton type="button" size="sm" data-action="open" data-pack={pack.id} disabled={busyId === pack.id && busyAction === 'open'}
							onclick={() => doAction(pack, 'open')}>Open</WornButton>
						<WornButton type="button" size="sm" data-action="pin" data-pack={pack.id} aria-pressed={pack.pinned} disabled={busyId === pack.id && busyAction === 'pin'}
							onclick={() => togglePin(pack)}>
							{pack.pinned ? 'Unpin' : 'Pin'}
						</WornButton>
						{#if hasBlocker(pack)}
							<WornButton type="button"  size="sm" disabled={busyId === pack.id}
								onclick={() => doAction(pack, 'unblock')}>Clear blocker</WornButton>
						{/if}
					</div>
				</WornAccordion>
				</WornFoldedSurface>
			{/each}
			<p class="review-list-count" aria-live="polite">Showing {renderedReviewCount} of {filteredVisible.length} {filteredVisible.length === 1 ? 'review item' : 'review items'}.</p>
			{#if hiddenReviewCount > 0}
				<div class="review-list-reveal">
					<p>{hiddenReviewCount} more {hiddenReviewCount === 1 ? 'review item is' : 'review items are'} ready when you are.</p>
					<WornButton type="button" data-review-reveal aria-label={reviewRevealLabel()} onclick={showMoreReviewItems}>Show more</WornButton>
				</div>
			{/if}
		{:else if firstReview}
			<p class="review-list-count" aria-live="polite">Showing {renderedReviewCount} of {filteredVisible.length} review item.</p>
		{:else if filteredVisible.length === 0 && reviewTotal > 0}
			<WornEmpty title="No matches">
				<WornButton type="button" onclick={clearReviewFilters}>Clear filters</WornButton>
			</WornEmpty>
		{:else if reviewTotal === 0}
			<WornEmpty title="Review is clear">
				<WornButton variant="primary" href="/work">Work</WornButton>
			</WornEmpty>
		{/if}
	</div>
</WornPage>


<style>
	/* Inline style attributes are blocked by the shared CSP (style-src has no
	   unsafe-inline) — keep presentation in scoped classes. */
	.review-head-actions {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}
	.review-filter-controls {
		display: grid;
		gap: 8px;
		grid-template-columns: minmax(0, 1fr) minmax(200px, 0.7fr);
		min-width: 0;
		width: 100%;
	}
	@media (max-width: 500px) {
		.review-filter-controls {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 700px) {
		.review-head-actions {
			justify-content: flex-start;
		}
	}
	/* The spotlight head is a flex row on wider screens. Its anonymous title
	   wrapper otherwise keeps the min-content width of an unbroken user title,
	   so the shell's overflow clipping can hide part of the heading and badges. */
	.review-priority-shell,
	.review-priority {
		display: grid;
		gap: 12px;
		overflow: hidden;
		max-width: 100%;
		min-width: 0;
		width: 100%;
	}
	.review-priority-head,
	.review-priority-actions {
		align-items: center;
		display: flex;
		gap: 10px;
		justify-content: space-between;
		min-width: 0;
	}
	.review-priority-head > div:first-child {
		flex: 1 1 0;
		max-width: 100%;
		min-width: 0;
	}
	.review-priority-title {
		color: var(--worn-text);
		font-size: 18px;
		line-height: 1.15;
		margin: 6px 0 0;
		max-width: 100%;
		min-width: 0;
	}
	.review-priority-title .demo-card-title {
		display: block;
		max-width: 100%;
		overflow: hidden;
		overflow-wrap: anywhere;
		white-space: normal;
	}
	.review-priority-actions {
		border-top: 1px solid var(--worn-border);
		flex-wrap: wrap;
		padding-top: 12px;
	}
	.review-priority-actions :global(.worn-btn) {
		justify-content: center;
	}
	.review-card-strip {
		margin-top: 6px;
		margin-bottom: 6px;
		font-size: 0.85rem;
		color: var(--worn-text-muted);
		padding: 4px 0;
		border-top: 1px solid var(--worn-border);
	}
	.review-reasons {
		background: var(--worn-bg-secondary);
		border-left: 3px solid var(--worn-accent);
		display: grid;
		gap: 5px;
		padding: 9px 11px;
	}
	.review-reasons > span {
		color: var(--worn-text-muted);
		font-family: var(--font-typewriter);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.review-reasons ul {
		color: var(--worn-text-secondary);
		display: grid;
		font-size: 13px;
		gap: 3px;
		line-height: 1.45;
		margin: 0;
		padding-left: 18px;
	}
	.review-reasons.compact {
		margin-top: 4px;
	}
	.review-card-receipt {
		margin-top: 6px;
		padding: 10px 12px;
		border: 1px solid var(--worn-border);
		font-size: 0.85rem;
	}
	.review-list-reveal {
		align-items: center;
		border-top: 1px solid var(--worn-border);
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: space-between;
		margin-top: 12px;
		padding-top: 12px;
	}
	.review-list-reveal p {
		color: var(--worn-text-muted);
		margin: 0;
	}
	.review-list-count {
		color: var(--worn-text-muted);
		margin: 12px 0 0;
	}
	@media (max-width: 480px) {
		:global(.demo-panel-head:has(.review-head-actions)) {
			align-items: center;
			flex-direction: row;
			gap: 8px;
		}
		:global(.demo-panel-head:has(.review-head-actions) .demo-panel-heading) {
			flex: 0 0 auto;
		}
		:global(.demo-panel-head:has(.review-head-actions) .demo-panel-meta) {
			flex: 1 1 auto;
			flex-wrap: nowrap;
			width: auto;
		}
		:global(.demo-panel-head:has(.review-head-actions) .demo-status) {
			flex: 1 1 auto;
			white-space: nowrap;
		}
		.review-head-actions {
			flex: 0 0 auto;
		}
		.demo-review-card-actions,
		.review-other-actions {
			min-width: 0;
		}
		.review-priority-actions :global(.worn-btn),
		.demo-review-card-actions :global(.worn-btn),
		.review-other-actions :global(.worn-btn) {
			max-width: 100%;
			white-space: normal;
		}
	}
</style>
