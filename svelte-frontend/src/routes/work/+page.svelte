<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { SvelteSet } from 'svelte/reactivity';
	import Focus from '@lucide/svelte/icons/focus';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import {
		demoState,
		demoStateError,
		demoStateLoading,
		refreshDemoState,
		runPackAction,
		saveBrowserState,
		savePackPath,
		savePackBrowserFields,
		setStateFilter,
		ChallengeStateError,
		displayToast,
		actionBusy,
		createPack
	} from '$lib/demo-client';
	import {
		PACK_ACTIONS,
		blockerText,
		dueDateLabel,
		filterPacks,
		orderPacks,
		ownerLabel,
		packStatusLabel,
		primaryCommand,
		primaryCommandNavigation,
		hasBlocker,
		isMissingOwnerValue,
		isReview,
		dueUrgency,
		parseDateOnly,
		PACK_ENERGIES,
		receiptCells,
		workTitle,
		workflowLabel,
		type DemoPack
	} from '$lib/demo-workflow';
	import { WornEmpty, WornError, WornButton, WornIconButton, WornCheckbox, WornChip, WornAccordion, WornDialog, WornInput, WornAlert, WornBadge, WornKbd, WornTimeline, WornPage, WornReceipt } from '$lib/components';
	import { buildActionUndoSnapshot, commitActionUndo, receiptUndo, undoReceipt } from '$lib/undo';
	import { activityActor, activityEvidenceText, recentPackActivity, relativeActivityTime } from '$lib/activity';
	import { localDateInputValue } from '$lib/local-date.mjs';
	import { summarizeWorkMetadata } from '$lib/work-metadata.mjs';
	import { focusAndPulse } from '$lib/focus-pulse.mjs';
	import { settleProgressiveReveal } from '$lib/progressive-reveal.mjs';
	import { parseRecentWorkIds, prependRecentWorkId } from '$lib/recent-work.mjs';
	import { registerPageTools } from '$lib/webmcp.mjs';
	import { keepActivityPresenterVisible } from '$lib/webmcp-activity-presentation.mjs';
	import WebMcpActivityStrip from '$lib/WebMcpActivityStrip.svelte';
	import WorkDeleteConfirmDialog from '$lib/WorkDeleteConfirmDialog.svelte';
	import WorkGridCard from '$lib/components/WorkGridCard.svelte';
	import WorkListCard from '$lib/components/WorkListCard.svelte';
	import WorkFilterControls from './WorkFilterControls.svelte';
	import {
		WORK_SEARCH_TOOL_NAME,
		createCurrentWorkTool,
		createShowWorkSearchTool,
		routeWorkSearch,
		workItemPageView,
		workPageView,
		workSearchPresentationReceipt
	} from './work-webmcp.mjs';

	const FILTERS: Array<[string, string]> = [
		['all', 'All'],
		['active', 'Active'],
		['blocked', 'Blocked'],
		['draft', 'Draft'],
		['done', 'Done'],
		['review', 'Review'],
		['archived', 'Archived']
	];
	const RECENT_ACTIVITY_LIMIT = 6;
	// Keep the Work route responsive when a real workspace holds thousands of
	// packs. Filtering and sorting stay accurate across the full result, while
	// the DOM starts with a bounded, explicit slice that a person can expand.
	const WORK_RENDER_LIMIT = 100;

	// Persist the selected card/grid presentation in this browser.
	const VIEW_STORAGE_KEY = 'demo-view-work';
	const RECENT_STORAGE_KEY = 'projects-work-recent-v1';

	let query = $state('');
	let debouncedQuery = $state('');
	let busyId = $state('');
	let busyAction = $state('');
	let errorText = $state('');
	let dismissedReceiptSummary = $state('');
	let energyFilter = $state('all');
	let areaFilter = $state('all');
	let recurrenceFilter = $state('all');
	let ownerFilter = $state('all');

	// Declared before the filter deriveds that read it (TDZ-safe for TS).
	let packs = $derived(($demoState?.packs ?? []) as DemoPack[]);
	let allRecentActivity = $derived(recentPackActivity(packs, Math.max(RECENT_ACTIVITY_LIMIT, packs.length)));
	let recentActivity = $derived(allRecentActivity.slice(0, RECENT_ACTIVITY_LIMIT));
	let recentTimelineEntries = $derived(recentActivity.map((entry) => ({
		date: entry.at,
		description: activityEvidenceText(entry),
		href: `/next?pack=${encodeURIComponent(entry.packId)}`,
		meta: activityActor(entry) || undefined,
		title: entry.packTitle
	})));

	let workMetadata = $derived.by(() => summarizeWorkMetadata(packs, { isMissingOwnerValue, dueUrgency }));
	let dueUrgencyFilter = $state('all');
	// The Work page begins with the complete sample workspace visible so people and page tools
	// share the same initial context on every browser visit.
	let hideDone = $state(false);

	// Debounce search query to avoid re-filtering on every keystroke
	let _debounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const nextQuery = query;
		clearTimeout(_debounceTimer);
		_debounceTimer = setTimeout(() => { debouncedQuery = nextQuery; }, 150);
		return () => clearTimeout(_debounceTimer);
	});
	let batchMode = $state(false);
	let batchSelected = new SvelteSet<string>();
	let batchBusyAction = $state<'done' | 'start' | 'block' | 'delete' | null>(null);
	let batchDeleteDialogOpen = $state(false);
	let batchDeleteTarget = $state<{ ids: string[]; count: number } | null>(null);
	let batchDeleteReturnFocus = $state<HTMLElement | null>(null);
	let focusMode = $state(false);
	const DENSITY_TABS: Array<{ id: 'card' | 'grid'; label: string }> = [
		{ id: 'card', label: 'Cards' },
		{ id: 'grid', label: 'Grid' }
	];
	let density = $state<'card' | 'grid'>('grid');
	let secondaryFiltersOpen = $state(false);
	let densityPanelTabs = $derived(
		packs.length > 1 ? DENSITY_TABS : DENSITY_TABS.filter((tab) => tab.id === density)
	);
	let recentIds = $state<string[]>([]);
	let recentPacks = $derived(recentIds
		.map((id) => packs.find((pack) => pack.id === id))
		.filter((pack): pack is DemoPack => Boolean(pack)));
	let snoozeDays = $state<Record<string, string>>({});
	let quickTitle = $state('');
	let quickProofTarget = $state('');
	let quickCreating = $state(false);
	let sortBy = $state('urgency');
	let renderLimit = $state(WORK_RENDER_LIMIT);

	let filter = $derived($demoState?.filter || 'all');
	let visible = $derived((()=>{let v=orderPacks(filterPacks(packs,filter,debouncedQuery,energyFilter,areaFilter,recurrenceFilter,ownerFilter,hideDone), sortBy);if(dueUrgencyFilter!=='all'){v=v.filter(p=>dueUrgency(p.due)===dueUrgencyFilter)}const sel=$demoState?.selectedId;if(focusMode&&sel){return v.filter(p=>p.id===sel)}return v})());
	let renderedVisible = $derived(visible.slice(0, renderLimit));
	let hasMoreVisible = $derived(renderedVisible.length < visible.length);
	let filterScope = $derived([filter, debouncedQuery, energyFilter, areaFilter, recurrenceFilter, ownerFilter, dueUrgencyFilter, sortBy, hideDone, focusMode].join('\u0000'));
	let appliedFilterScope = $state('');
	$effect(() => {
		if (filterScope !== appliedFilterScope) {
			appliedFilterScope = filterScope;
			renderLimit = WORK_RENDER_LIMIT;
		}
	});
	let counts = $derived(countByFilter(packs));
	let hasDoneWork = $derived(workMetadata.hasDoneWork);
	let hideDoneApplies = $derived(hideDone && filter === 'all' && hasDoneWork);
	let statusFilterOptions = $derived(
		FILTERS.map(([value, label]) => ({ value, label: `${label} (${counts[value] ?? 0})` }))
	);
	let hasActiveFilters = $derived(
		filter !== 'all' || energyFilter !== 'all' || areaFilter !== 'all' || recurrenceFilter !== 'all' || ownerFilter !== 'all' || dueUrgencyFilter !== 'all' || hideDoneApplies || focusMode
	);
	let showWorkControls = $derived(
		packs.length > 0 && (packs.length > 1 || hasActiveFilters || query.trim().length > 0 || sortBy !== 'urgency')
	);
	let activeFilterLabel = $derived.by(() => {
		const parts: string[] = [];
		if (filter !== 'all') parts.push(`status: ${filter}`);
		if (energyFilter !== 'all') parts.push(`energy: ${energyFilter}`);
		if (areaFilter !== 'all') parts.push(`area: ${areaFilter}`);
		if (recurrenceFilter !== 'all') parts.push(`recurrence: ${recurrenceFilter}`);
		if (ownerFilter !== 'all') parts.push(`owner: ${ownerFilter === '_unassigned' ? 'Unassigned' : ownerFilter}`);
		if (dueUrgencyFilter !== 'all') parts.push(`due: ${dueUrgencyFilter}`);
		if (hideDoneApplies) parts.push('done hidden');
		if (focusMode) parts.push('focus mode');
		return parts.join(', ');
	});
	let blockedCount = $derived(visible.filter(hasBlocker).length);
	let workStatus = $derived(
		packs.length === 0
			? undefined
			: `${renderedVisible.length} shown · ${visible.length} matching · ${packs.length} workspace${blockedCount > 0 ? ` · ${blockedCount} blocked` : ''}`
	);
	let currentWorkView = $derived.by(() => workPageView({
		scope: {
			search: query,
			appliedSearch: debouncedQuery,
			status: filter,
			energy: energyFilter,
			area: areaFilter,
			recurrence: recurrenceFilter,
			owner: ownerFilter,
			dueUrgency: dueUrgencyFilter,
			sort: sortBy,
			hideDone: hideDoneApplies,
			focusMode,
			density
		},
		counts: {
			workspace: packs.length,
			matching: visible.length,
			shown: renderedVisible.length,
			remaining: Math.max(0, visible.length - renderedVisible.length),
			blocked: blockedCount
		},
		items: renderedVisible.map((pack) => workItemPageView({
			id: pack.id,
			title: workTitle(pack),
			workflow: density === 'grid' ? packStatusLabel(pack.status) : workflowLabel(pack),
			owner: density === 'grid' ? (pack.owner ? String(pack.owner) : null) : ownerLabel(pack.owner),
			due: pack.due ? dueDateLabel(pack.due) : null,
			blocker: hasBlocker(pack) ? blockerText(pack) : null
		}))
	}));
	let workReceiptScopeKey = $derived(currentWorkView
		? JSON.stringify({ scope: currentWorkView.scope, counts: currentWorkView.counts })
		: '');
	let receipt = $derived($demoState?.actionReceipt || null);
	let webMcpSearchReceipt = $state<{
		summary: string;
		cells: Array<{ label: string; value: string }>;
		scopeKey: string;
		toolName: string;
	} | null>(null);
	let receiptVisible = $derived(Boolean(receipt?.summary && receipt.summary !== dismissedReceiptSummary));
	let receiptFocusTimer: ReturnType<typeof setTimeout> | null = null;
	let stopWorkWebMcp: (() => void) | null = null;

	$effect(() => {
		if (webMcpSearchReceipt && webMcpSearchReceipt.scopeKey !== workReceiptScopeKey) {
			webMcpSearchReceipt = null;
		}
	});

	async function recordWorkWebMcpResult({ toolName, result }: { toolName: string; result: unknown }) {
		if (toolName !== WORK_SEARCH_TOOL_NAME) return;
		const outcome = result as Parameters<typeof workSearchPresentationReceipt>[0] & {
			focus?: ReturnType<typeof focusWorkSearchDestination>;
		};
		webMcpSearchReceipt = { ...workSearchPresentationReceipt(outcome), toolName };
		await tick();
		const finalFocus = focusWorkSearchDestination(true);
		if (!outcome.focus || finalFocus.target !== outcome.focus.target || finalFocus.itemId !== outcome.focus.itemId) {
			throw new Error('Work receipt focus did not match the rendered search destination.');
		}
	}

	async function clearFailedWorkWebMcpReceipt() {
		webMcpSearchReceipt = null;
		await tick();
	}

	async function refreshWork(
		{
			reuseRecent = false,
			afterRefresh
		}: {
			reuseRecent?: boolean;
			afterRefresh?: (state: Awaited<ReturnType<typeof refreshDemoState>>) => void;
		} = {}
	): Promise<void> {
		const state = await refreshDemoState({ reuseRecent });
		afterRefresh?.(state);
	}

	function hydrateRecentWork(availablePacks: DemoPack[]) {
		try {
			recentIds = parseRecentWorkIds(sessionStorage.getItem(RECENT_STORAGE_KEY), availablePacks.map((pack) => pack.id));
			if (recentIds.length === 0) sessionStorage.removeItem(RECENT_STORAGE_KEY);
			else sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentIds));
		} catch {
			recentIds = [];
		}
	}

	// URL search is intentionally a one-time, page-local arrival state. It
	// shares the public tool's normalizer but does not write, navigate, or
	// initiate any work beyond rendering the existing Work route.
	function applyRouteWorkSearch(searchParam: unknown): string {
		const routeSearch = routeWorkSearch(searchParam);
		query = routeSearch;
		debouncedQuery = routeSearch;
		return routeSearch;
	}

	async function focusRouteWorkSearchArrival(routeSearch: string) {
		if (!routeSearch) return;
		await tick();
		if (!filterInput() && !document.querySelector<HTMLElement>('[data-work-item][data-pack-id]')) return;
		focusWorkSearchDestination(true);
	}

	onMount(() => {
		let mounted = true;
		const routeSearch = applyRouteWorkSearch($page.url.searchParams.get('search'));
		stopWorkWebMcp = registerPageTools(document, [
			createCurrentWorkTool(() => currentWorkView),
			createShowWorkSearchTool(showWorkSearchFromWebMcp)
		], {
			onInvocationError: clearFailedWorkWebMcpReceipt,
			onResult: recordWorkWebMcpResult
		});
		void refreshWork({
			reuseRecent: true,
			afterRefresh: (state) => {
				if (!mounted) return;
				hydrateRecentWork((state?.packs ?? packs) as DemoPack[]);
				void focusRouteWorkSearchArrival(routeSearch);
			}
		});
		try {
			const saved = localStorage.getItem(VIEW_STORAGE_KEY);
			if (saved === 'grid' || saved === 'card') density = saved as 'card' | 'grid';
		} catch {}
		return () => {
			mounted = false;
			stopWorkWebMcp?.();
			stopWorkWebMcp = null;
			webMcpSearchReceipt = null;
			if (receiptFocusTimer) clearTimeout(receiptFocusTimer);
			receiptFocusTimer = null;
			// Leaving Work drops its route-only batch and focus modes.
			document.documentElement.classList.remove('batch-mode');
			if (focusMode) document.documentElement.classList.remove('focus-mode');
		};
	});

	function countByFilter(list: DemoPack[]): Record<string, number> {
		const next: Record<string, number> = Object.fromEntries(FILTERS.map(([key]) => [key, 0]));
		for (const pack of list) {
			next[pack.status || ''] = (next[pack.status || ''] ?? 0) + 1;
			if (isReview(pack)) next.review += 1;
			if (pack.archived) next.archived += 1;
			if (!pack.archived) next.all += 1;
		}
		return next;
	}

	function describeError(error: unknown, fallback: string): string {
		if (error instanceof ChallengeStateError) {
			return error.message;
		}
		return fallback;
	}

	async function applyFilter(key: string): Promise<boolean> {
		errorText = '';
		try {
			await setStateFilter(key);
			return true;
		} catch (error) {
			errorText = describeError(error, 'Filter change did not save.');
			return false;
		}
	}

	async function handleStatusFilterChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		if (!(await applyFilter(select.value))) select.value = filter;
	}

	async function clearAllFilters() {
		const filterReset = applyFilter('all');
		energyFilter = 'all';
		query = '';
		debouncedQuery = '';
		areaFilter = 'all';
		recurrenceFilter = 'all';
		ownerFilter = 'all';
		dueUrgencyFilter = 'all';
		sortBy = 'urgency';
		hideDone = false;
		focusMode = false;
		document.documentElement.classList.remove('focus-mode');
		await tick();
		filterInput()?.focus();
		await filterReset;
		await tick();
		(filterInput() ?? document.querySelector<HTMLElement>('[data-work-item][data-pack-id]'))?.focus();
	}

	async function clearSearch() {
		query = '';
		debouncedQuery = '';
		await tick();
		filterInput()?.focus({ preventScroll: true });
	}

	function handleDensityChange(id: string) {
		density = id as 'card' | 'grid';
		try { localStorage.setItem(VIEW_STORAGE_KEY, density); } catch {}
	}

	// ── Batch select ──

	function toggleBatchMode() {
		if (busyId === 'batch') return;
		batchMode = !batchMode;
		if (!batchMode) batchSelected.clear();
		document.documentElement.classList.toggle('batch-mode', batchMode);
		if (batchMode) displayToast('Select cards to act on them.', 'info');
	}

	function clearBatchSelection() {
		if (busyId === 'batch') return;
		batchSelected.clear();
	}

	function requestBatchDelete(event: MouseEvent) {
		if (busyId || batchSelected.size === 0) return;
		const ids = [...batchSelected];
		batchDeleteTarget = { ids, count: ids.length };
		batchDeleteReturnFocus = event.currentTarget as HTMLElement;
		batchDeleteDialogOpen = true;
	}

	async function confirmBatchDelete() {
		const target = batchDeleteTarget;
		if (!target) return;
		await batchAction('delete', target.ids, false);
		batchDeleteTarget = null;
	}

	function toggleFocusMode() {
		focusMode = !focusMode;
		document.documentElement.classList.toggle('focus-mode', focusMode);
		if (focusMode) displayToast('Focus on. Press F to exit.', 'info');
	}

	// In batch mode a tap anywhere on the card toggles selection; inner
	// controls (buttons, links, the details toggle) keep their own behavior.
let focusedIndex = $state(0);
let showShortcutHelp = $state(false);

function handleCardKeys(e: KeyboardEvent, cardIndex: number = -1) {
  if (e.target !== e.currentTarget) return;
  // Grid is the default density — omitting .demo-grid-card left arrow-nav and
  // the d/b/o/space shortcuts dead on the view most people actually see.
  const cards = document.querySelectorAll('.demo-landing-card, .demo-work-card, .demo-grid-card');
  if (!cards.length) return;
  const current = Array.from(cards).indexOf(document.activeElement as Element);
  if (e.key === 'ArrowDown') { e.preventDefault(); const next = (current + 1) % cards.length; (cards[next] as HTMLElement)?.focus(); focusedIndex = next; return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); const prev = (current - 1 + cards.length) % cards.length; (cards[prev] as HTMLElement)?.focus(); focusedIndex = prev; return; }
  // Action shortcuts on focused cards
  if (current < 0) return;
  const packId = (cards[current] as HTMLElement)?.dataset?.packId;
  if (!packId) return;
  const pack = packs.find(p => p.id === packId);
  if (!pack) return;
  if (batchMode && (e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleBatchSelection(packId); return; }
  if (!batchMode && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); selectPack(pack); return; }
  if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); doAction(pack, 'done'); return; }
  if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); doAction(pack, 'block'); return; }
  if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); selectPack(pack); return; }
  if (e.key === ' ' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); runPrimary(pack); return; }
}

	// "/" focuses the filter, Escape leaves it. Kept in the script block rather
	// than inline on <svelte:window>: TypeScript generics in markup read as
	// component tags to the drift guard's missing-import detector.
	const FILTER_INPUT = '[aria-label="Filter work items by text"]';
	function filterInput(): HTMLInputElement | null {
		return document.querySelector<HTMLInputElement>(FILTER_INPUT);
	}
	function focusWorkSearchDestination(requireVisibleFocus: boolean) {
		const firstItem = document.querySelector<HTMLElement>('[data-work-item][data-pack-id]');
		const destination = firstItem ?? filterInput();
		if (!destination) throw new Error('Work search is unavailable because no work list is rendered.');
		const focusReceipt = focusAndPulse(destination, {
			behavior: 'auto',
			block: 'center',
			requireVisibleFocus
		});
		const activityPresenter = document.getElementById('work-webmcp-activity');
		if (requireVisibleFocus && activityPresenter) keepActivityPresenterVisible(activityPresenter, destination);
		return firstItem
			? { target: 'item' as const, itemId: firstItem.dataset.packId || '', ...focusReceipt }
			: { target: 'search' as const, itemId: null, ...focusReceipt };
	}
	async function showWorkSearchFromWebMcp(nextQuery: string) {
		const changed = query !== nextQuery || debouncedQuery !== nextQuery;
		query = nextQuery;
		debouncedQuery = nextQuery;
		await tick();
		if (!currentWorkView || currentWorkView.scope.search !== nextQuery) {
			throw new Error('Work did not render the requested search.');
		}
		return {
			changed,
			query: nextQuery,
			focus: focusWorkSearchDestination(true),
			work: currentWorkView
		};
	}
	function handleWindowKeys(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (showShortcutHelp) {
			if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				showShortcutHelp = false;
			}
			return;
		}
		if (e.key === '?' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			showShortcutHelp = true;
			return;
		}
		if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
			e.preventDefault();
			filterInput()?.focus();
			focusedIndex = -1;
			return;
		}
		if (e.key === 'Escape') { filterInput()?.blur(); focusedIndex = -1; showShortcutHelp = false; }
		// n / c: focus the local quick-create input when that view exposes it.
		if ((e.key === 'n' || e.key === 'c') && tag !== 'INPUT' && tag !== 'TEXTAREA') {
			const input = document.querySelector<HTMLInputElement>('.quick-create-input');
			if (input) { e.preventDefault(); input.focus(); }
		}
	}

	function handleCardClick(event: MouseEvent, packId: string) {
		if ((event.target as HTMLElement).closest('a, button, input, label, select, textarea, summary')) return;
		if (batchMode) {
			event.preventDefault();
			toggleBatchSelection(packId);
			return;
		}
		const pack = packs.find((p) => p.id === packId);
		if (pack) selectPack(pack);
	}

	function toggleBatchSelection(packId: string) {
		if (busyId === 'batch') return;
		if (batchSelected.has(packId)) batchSelected.delete(packId);
		else batchSelected.add(packId);
	}

	// Apply the selected local action to each item in sequence; the final
	// receipt remains visible. Delete updates the browser-local list once.
	let hasDraftSelected = $derived(batchSelected.size > 0 && packs.some(p => batchSelected.has(p.id!) && p.status === 'draft'));

	async function batchAction(action: 'done' | 'start' | 'block' | 'delete', selectedIds = [...batchSelected], reportError = true) {
		const ids = [...selectedIds];
		if (!ids.length || busyId) return;
		busyId = 'batch';
		batchBusyAction = action;
		errorText = '';
		try {
			if (action === 'delete') {
				await saveBrowserState((draft) => {
					draft.packs = draft.packs.filter((pack) => !ids.includes(pack.id || ''));
					if (!draft.packs.some((pack) => pack.id === draft.selectedId)) {
						draft.selectedId = draft.packs[0]?.id || '';
					}
				});
			} else {
				for (const id of ids) {
					await runPackAction(id, action);
				}
			}
			const label = { done: 'done', start: 'started', block: 'blocked', delete: 'deleted' }[action];
			displayToast(`${ids.length} ${ids.length === 1 ? 'item' : 'items'} ${label}.`, 'success');
			batchSelected.clear();
		} catch (error) {
			const message = describeError(error, 'The batch action failed partway — check the list.');
			if (reportError) errorText = message;
			else throw new Error(message);
		} finally {
			batchBusyAction = null;
			busyId = '';
			actionBusy.set('');
		}
	}

	async function doAction(pack: DemoPack, action: string) {
		if (!pack.id || busyId) return;
		errorText = '';
		busyId = pack.id;
		busyAction = action;
		actionBusy.set(pack.id);
		try {
			const snapshot = buildActionUndoSnapshot(packs, pack.id, action);
			const result = await runPackAction(pack.id, action);
			commitActionUndo(snapshot);
			dismissedReceiptSummary = '';
			if (!result?.summary) {
				errorText = 'The action ran but returned no receipt.';
			}
			revealReceipt();
		} catch (error) {
			errorText = describeError(error, 'Action failed — the local state is unchanged.');
		} finally {
			busyId = '';
			busyAction = '';
			actionBusy.set('');
		}
	}

	// Scroll the route receipt into view and focus it after an action fired
	// further down the list; smoothness comes from .demo-main scroll-behavior
	// (already disabled under prefers-reduced-motion).
	function revealReceipt() {
		if (receiptFocusTimer) clearTimeout(receiptFocusTimer);
		receiptFocusTimer = setTimeout(() => {
			const el = document.getElementById('work-receipt');
			receiptFocusTimer = null;
			if (!el) return;
			// 'start', not 'nearest': the receipt can be taller than a short
			// viewport, and its heading is the part that must be visible.
			focusAndPulse(el, { block: 'start' });
		}, 80);
	}

	function runPrimary(pack: DemoPack) {
		const command = primaryCommand(pack);
		if (PACK_ACTIONS.has(command.action)) {
			doAction(pack, command.action);
			return;
		}
		goto(primaryCommandNavigation(pack));
	}

	async function quickCreate() {
		const title = quickTitle.trim();
		const proofTarget = quickProofTarget.trim();
		if (!title || quickCreating) return;
		quickCreating = true;
		try {
			await createPack({
				title,
				status: 'active',
				next: 'Open',
				doneWhen: proofTarget || undefined,
				area: areaFilter !== 'all' && areaFilter !== '_none' ? areaFilter : undefined,
				recurrence: recurrenceFilter !== 'all' ? recurrenceFilter : undefined
			});
			quickTitle = '';
			quickProofTarget = '';
		} catch (e) {
			displayToast('Quick create failed', 'error');
		} finally {
			quickCreating = false;
			// Re-focus the input after creation
			setTimeout(() => document.querySelector<HTMLInputElement>('.quick-create-input')?.focus(), 0);
		}
	}

	// A focus query scrolls to the card and focuses its title once.
	let focusedCardId = '';
	$effect(() => {
		const target = $page.url.searchParams.get('focus') || '';
		if (!target || target === focusedCardId) return;
		focusedCardId = target;
		let cancelled = false;
		const focusTimers = new Set<ReturnType<typeof setTimeout>>();
		const scheduleFocus = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				focusTimers.delete(timer);
				if (!cancelled) callback();
			}, delay);
			focusTimers.add(timer);
		};
		// Retry up to 5 times — the card may not be in the visible
		// filtered list yet. Switch to All on the first miss.
		const tryFocus = (attempts: number) => {
			if (cancelled) return;
			const card = document.querySelector(
				`[data-work-item][data-pack-id="${CSS.escape(target)}"]`
			);
			if (card) {
				focusAndPulse(card as HTMLElement, { block: 'center' });
				return;
			}
			if (attempts <= 1) applyFilter('all');
			if (attempts < 5) scheduleFocus(() => tryFocus(attempts + 1), 80);
		};
		scheduleFocus(() => tryFocus(0), 100);
		return () => {
			cancelled = true;
			for (const timer of focusTimers) clearTimeout(timer);
			focusTimers.clear();
		};
	});

	function trackRecent(packId: string) {
		recentIds = prependRecentWorkId(recentIds, packId, packs.map((pack) => pack.id));
		try { sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentIds)); } catch {}
	}

	function selectPack(pack: DemoPack) {
		if (!pack.id) return;
		trackRecent(pack.id);
		goto(`/next?pack=${encodeURIComponent(pack.id)}`);
	}

	// Pin and reaction controls update only this browser's saved sample state.
	async function togglePin(pack: DemoPack) {
		if (!pack.id || busyId) return;
		busyId = pack.id;
		busyAction = 'pin';
		try {
			await savePackBrowserFields(pack.id, (target) => {
				target.pinned = !target.pinned;
			});
		} catch { displayToast('Pin toggle failed', 'error'); } finally {
			busyId = '';
			busyAction = '';
		}
	}

	async function snoozePack(pack: DemoPack, days: number) {
		if (!pack.id || busyId) return;
		const current = pack.due ? parseDateOnly(pack.due) : new Date();
		if (!current) {
			displayToast('Snooze failed', 'error');
			return;
		}
		current.setDate(current.getDate() + days);
		const newDue = localDateInputValue(current);
		busyId = pack.id;
		try {
			await savePackPath(pack.id, { due: newDue });
		} catch { displayToast('Snooze failed', 'error'); } finally {
			busyId = '';
		}
	}

	async function showMoreWork(event: MouseEvent) {
		const trigger = event.currentTarget as HTMLElement;
		const previousCount = renderedVisible.length;
		const nextLimit = renderLimit + WORK_RENDER_LIMIT;
		const removesTrigger = nextLimit >= visible.length;
		renderLimit = nextLimit;
		await settleProgressiveReveal({
			settled: tick(),
			removesTrigger,
			trigger,
			getDestination: () => {
				const firstNewCard = document.querySelectorAll<HTMLElement>('[data-work-item][data-pack-id]')[previousCount];
				return firstNewCard ? { focusTarget: firstNewCard } : null;
			}
		});
	}

	function applySnooze(pack: DemoPack, key: string) {
		const packId = pack.id;
		if (!packId) return;
		const focused = document.activeElement as HTMLElement | null;
		const restoreFocus = focused?.matches('.work-snooze-select') ?? false;
		const days = Number(snoozeDays[key] || '');
		snoozeDays[key] = '';
		if (![1, 3, 7].includes(days)) return;
		if (restoreFocus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.work-snooze-select[data-pack="${CSS.escape(packId)}"]`)?.focus());
		void snoozePack(pack, days);
	}

	async function repeatPack(pack: DemoPack) {
		if (!pack.id || busyId) return;
		busyId = pack.id;
		try {
			await savePackPath(pack.id, { status: 'active', next: 'Open', blocker: 'none' });
		} catch { displayToast('Repeat failed', 'error'); } finally {
			busyId = '';
		}
	}

	async function reactPack(pack: DemoPack, emoji: string) {
		if (!pack.id) return;
		try {
			await savePackBrowserFields(pack.id, (target) => {
				const reactions = { ...((target.reactions as Record<string, number>) || {}) };
				reactions[emoji] = (reactions[emoji] || 0) + 1;
				target.reactions = reactions;
			});
		} catch { displayToast('Reaction failed', 'error'); }
	}

	// ── Drag-to-reorder: move the dragged item beside its drop target ──
	let dragSrcId = '';
	function handleDragStart(e: DragEvent, packId: string) {
		if (batchMode) { e.preventDefault(); return; }
		dragSrcId = packId;
		e.dataTransfer!.effectAllowed = 'move';
		(e.currentTarget as HTMLElement | null)?.classList.add('dragging');
	}
	function handleDragOver(e: DragEvent, packId: string) {
		if (batchMode) return;
		if (!dragSrcId || packId === dragSrcId) return;
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
		(e.currentTarget as HTMLElement | null)?.classList.add('drag-over');
	}
	function handleDragEnd() {
		document.querySelectorAll('.dragging, .drag-over').forEach((el) => el.classList.remove('dragging', 'drag-over'));
		dragSrcId = '';
		energyDragTarget = '';
	}
	function handleDrop(e: DragEvent, targetId: string) {
		if (batchMode) { e.preventDefault(); return; }
		e.preventDefault();
		const sourceId = dragSrcId;
		handleDragEnd();
		if (!sourceId || sourceId === targetId) return;
		saveBrowserState((draft) => {
			const from = draft.packs.findIndex((p) => p.id === sourceId);
			const to = draft.packs.findIndex((p) => p.id === targetId);
			if (from < 0 || to < 0) return;
			const [item] = draft.packs.splice(from, 1);
			draft.packs.splice(to, 0, item);
		}).catch(() => {
			displayToast('Reorder did not save.', 'error');
		});
	}
	// Drag-to-energy: drop a card on an energy chip to set its energy level
	let energyDragTarget = $state('');
	function handleEnergyDragOver(e: DragEvent, energy: string) {
		if (!dragSrcId) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		energyDragTarget = energy;
	}
	function handleEnergyDragLeave(energy: string) {
		if (energyDragTarget === energy) energyDragTarget = '';
	}
	async function handleEnergyDrop(e: DragEvent, energy: string) {
		e.preventDefault();
		const id=dragSrcId;
		handleDragEnd();
		if(!id||!PACK_ENERGIES.includes(energy))return;
		try{await savePackBrowserFields(id,target=>{target.energy=energy})}catch(e){displayToast('Energy change failed','error')}
	}

</script>

{#snippet workEmptyState()}
	{#if packs.length > 0 && hasActiveFilters}
		<WornEmpty title="No matches" description={activeFilterLabel}>
			<WornButton variant="primary" size="md" onclick={clearAllFilters} data-action="clear-filters">Clear all filters</WornButton>
		</WornEmpty>
	{:else if query.trim()}
		<WornEmpty title='No work matches "{query.trim()}"'>
			<WornButton variant="primary" size="md" onclick={clearSearch}>Clear search</WornButton>
		</WornEmpty>
	{:else}
		<WornEmpty title="No sample work available">
			<WornButton variant="primary" size="md" href="/webmcp-challenge">Open guide</WornButton>
		</WornEmpty>
	{/if}
{/snippet}

{#snippet batchCheckbox(pack: DemoPack)}
	<div class="demo-batch-check-slot"><WornCheckbox checked={batchSelected.has(pack.id!)} disabled={busyId === 'batch'} ariaLabel={`Select ${workTitle(pack)} for batch actions`} aria-checked={batchSelected.has(pack.id!)} data-batch-check onchange={() => toggleBatchSelection(pack.id!)} /></div>
{/snippet}

<svelte:window onkeydown={handleWindowKeys} />

<svelte:head><title>Work — Wornpage Projects™</title></svelte:head>

<!-- Keep existing browser-local items visible during a background refresh;
     show the skeleton only when there is genuinely nothing to render. -->
<WornPage sectionLabel="Step 1 of 3 · Inspect" title="Work" status={workStatus} variant="list" loading={$demoStateLoading && packs.length === 0}>

	{#snippet headActions()}
		<div class="work-head-actions">
			<WornIconButton size="sm" label="Shortcuts" title="Keyboard shortcuts (?)" aria-haspopup="dialog" data-action="work-shortcuts" onclick={() => (showShortcutHelp = true)}>
				<Keyboard aria-hidden="true" />
			</WornIconButton>
			{#if packs.length > 1 || batchMode}
				<WornIconButton class={batchMode ? 'work-mode-active' : undefined} size="sm" label="Batch" title="Toggle batch select mode" data-action="batch-mode" aria-pressed={batchMode} disabled={busyId === 'batch'} onclick={toggleBatchMode}>
					<ListChecks aria-hidden="true" />
				</WornIconButton>
			{/if}
			{#if packs.length > 1 || focusMode}
				<WornIconButton class={focusMode ? 'work-mode-active' : undefined} size="sm" label="Focus" title="Focus on selected work (F)" data-action="focus-mode" aria-pressed={focusMode} onclick={toggleFocusMode}>
					<Focus aria-hidden="true" />
				</WornIconButton>
			{/if}
		</div>
	{/snippet}

	<!-- Keep the last good local view below a refresh error and offer Retry. -->
	{#if $demoStateError}
		<WornError message="Could not load work items." detail={$demoStateError} onretry={refreshWork} />
	{/if}

	{#if showWorkControls}
		<WorkFilterControls
			{filter}
			{statusFilterOptions}
			bind:query
			{workMetadata}
			bind:energyFilter
			bind:areaFilter
			bind:recurrenceFilter
			bind:ownerFilter
			bind:dueUrgencyFilter
			bind:sortBy
			bind:hideDone
			{hideDoneApplies}
			bind:density
			bind:secondaryFiltersOpen
			densityTabs={DENSITY_TABS}
			{energyDragTarget}
			packCount={packs.length}
			onStatusFilterChange={handleStatusFilterChange}
			onClearAllFilters={clearAllFilters}
			onEnergyDragOver={handleEnergyDragOver}
			onEnergyDragLeave={handleEnergyDragLeave}
			onEnergyDrop={handleEnergyDrop}
			onDensityChange={handleDensityChange}
		/>
	{/if}
	{#if batchMode}
		<div class="demo-batch-bar" class:is-active={batchSelected.size > 0} role="toolbar" aria-label="Batch actions">
			<span class="demo-batch-count" aria-live="polite" aria-atomic="true">{batchSelected.size} selected</span>
			<WornButton  size="sm" type="button" data-action="batch-done" disabled={batchSelected.size === 0 || busyId === 'batch'} onclick={() => batchAction('done')}>{batchBusyAction === 'done' ? 'Finishing…' : 'Done'}</WornButton>
			<WornButton  size="sm" type="button" data-action="batch-start" disabled={!hasDraftSelected || busyId === 'batch'} onclick={() => batchAction('start')}>{batchBusyAction === 'start' ? 'Starting…' : 'Start'}</WornButton>
			<WornButton  size="sm" type="button" data-action="batch-block" disabled={batchSelected.size === 0 || busyId === 'batch'} onclick={() => batchAction('block')}>{batchBusyAction === 'block' ? 'Blocking…' : 'Block'}</WornButton>
			<WornButton variant="danger" size="sm" type="button" data-action="batch-delete" disabled={batchSelected.size === 0 || busyId === 'batch'} onclick={requestBatchDelete}>Delete</WornButton>
			<WornButton  size="sm" type="button" data-action="batch-clear" disabled={busyId === 'batch'} onclick={clearBatchSelection}>Deselect</WornButton>
		</div>
	{/if}

	<WorkDeleteConfirmDialog
		bind:open={batchDeleteDialogOpen}
		selectedCount={batchDeleteTarget?.count || 0}
		returnFocus={batchDeleteReturnFocus}
		onconfirm={confirmBatchDelete}
	/>

	{#if receiptVisible && receipt}
		<WornReceipt id="work-receipt"
			summary={receipt.summary || ''}
			announce={false}
			cells={receipt.pack ? receiptCells(receipt.pack) : []}
			undoAvailable={$receiptUndo && receipt.pack?.id ? $receiptUndo.packId === receipt.pack.id : false}
			onundo={() => undoReceipt()}
			ondone={() => (dismissedReceiptSummary = receipt?.summary || '')}
		/>
	{/if}

	{#if errorText}
		<WornAlert tone="danger" dismissible dismissLabel="Dismiss work-list error">{errorText}</WornAlert>
	{/if}

	<WornDialog bind:open={showShortcutHelp} title="Keyboard shortcuts" size="sm">
		<dl class="shortcut-grid">
			<dt><WornKbd keys={['↑ / ↓']} /></dt><dd>Navigate</dd>
			<dt><WornKbd keys={['D']} /></dt><dd>Mark done</dd>
			<dt><WornKbd keys={['B']} /></dt><dd>Mark blocked</dd>
			<dt><WornKbd keys={['O']} /></dt><dd>Open details</dd>
			<dt><WornKbd keys={['Space']} /></dt><dd>Run action</dd>
			<dt><WornKbd keys={['/']} /></dt><dd>Search</dd>
			<dt><WornKbd keys={['C / N']} /></dt><dd>Focus quick-add when available</dd>
			<dt><WornKbd keys={['Esc']} /></dt><dd>Close / blur search</dd>
			<dt><WornKbd keys={['?']} /></dt><dd>Toggle help</dd>
		</dl>
		<div class="shortcut-actions">
			<WornButton variant="primary" type="button" onclick={() => (showShortcutHelp = false)}>Close</WornButton>
		</div>
	</WornDialog>

	{#if webMcpSearchReceipt}
		<WebMcpActivityStrip
			id="work-webmcp-activity"
			route="work"
			outcome={webMcpSearchReceipt.summary}
			toolName={webMcpSearchReceipt.toolName}
			cells={webMcpSearchReceipt.cells}
		/>
	{/if}

	<form class="quick-create-row" onsubmit={(e) => { e.preventDefault(); quickCreate(); }}>
		<WornInput class="quick-create-input" bind:value={quickTitle} placeholder="Quick-add a work item…" aria-label="Quick-add a work item" disabled={quickCreating} />
		<WornButton class="quick-create-submit" data-work-quick-create-submit type="submit" variant="primary" size="sm" disabled={quickCreating || !quickTitle.trim()}>{quickCreating ? 'Adding…' : 'Add'}</WornButton>
		<details class="quick-create-options">
			<summary>Proof target <span>Optional</span></summary>
			<WornInput
				id="work-quick-proof-target"
				class="quick-proof-input"
				bind:value={quickProofTarget}
				maxlength={1000}
				placeholder="What will prove this is done?"
				aria-label="Quick-add proof target"
				disabled={quickCreating}
			/>
		</details>
	</form>

	{#each densityPanelTabs as densityTab (densityTab.id)}
	<div
		role={packs.length > 1 && secondaryFiltersOpen ? 'tabpanel' : undefined}
		id={packs.length > 1 ? `work-density-panel-${densityTab.id}` : undefined}
		aria-labelledby={packs.length > 1 && secondaryFiltersOpen ? `work-density-tab-${densityTab.id}` : undefined}
		hidden={packs.length > 1 && densityTab.id !== density}
	>
	{#if densityTab.id === density}
	{#if density === 'grid'}
		<div class="demo-work-grid" class:batch-active={batchMode} role="list" aria-label="Work items grid">
			{#each renderedVisible as pack, i (pack.id)}
				<WorkGridCard
					{pack}
					index={i}
					selectedId={$demoState?.selectedId}
					{focusedIndex}
					{batchMode}
					batchSelected={batchSelected.has(pack.id!)}
					{busyId}
					{batchCheckbox}
					onCardClick={handleCardClick}
					onCardKeydown={handleCardKeys}
					onCardFocus={(index) => { focusedIndex = index; }}
					onPrimaryMutation={doAction}
				/>
			{/each}
		</div>
		{#if hasMoreVisible}
			<div class="work-load-more">
				<span aria-live="polite">{renderedVisible.length} of {visible.length} shown</span>
				<WornButton type="button" size="sm" data-action="show-more-work" onclick={showMoreWork}>Show {Math.min(WORK_RENDER_LIMIT, visible.length - renderedVisible.length)} more</WornButton>
			</div>
		{/if}
	{#if visible.length === 0}
		{@render workEmptyState()}
	{/if}
	{:else}
	<!-- Card density. The switcher offers two modes but this branch was deleted
	     along with the retired landing/table views, so choosing "Cards" rendered
	     an empty page — and the handlers it is the only caller of (snoozePack,
	     repeatPack, togglePin, selectPack) sat dead. Restored from 4682a52; the
	     .demo-work-card CSS was never removed. -->
	<div class="demo-work-list">
		{#if recentPacks.length > 0}
			<nav class="demo-chip-row" aria-label="Recently viewed work">
				{#each recentPacks as pack (pack.id)}
					<WornChip size="sm" label={workTitle(pack)} href={`/next?pack=${encodeURIComponent(pack.id || '')}`} data-action="recent-work" />
				{/each}
			</nav>
		{/if}
		{#each renderedVisible as pack, i (pack.id)}
			<WorkListCard
				{pack}
				index={i}
				selectedId={$demoState?.selectedId}
				{focusedIndex}
				{batchMode}
				{busyId}
				{busyAction}
				{batchCheckbox}
				{receipt}
				receiptUndo={$receiptUndo}
				{snoozeDays}
				onCardClick={handleCardClick}
				onCardKeydown={handleCardKeys}
				onCardFocus={(index) => { focusedIndex = index; }}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
				onDrop={handleDrop}
				onTrackRecent={trackRecent}
				onPrimaryMutation={doAction}
				onAction={doAction}
				onTogglePin={togglePin}
				onApplySnooze={applySnooze}
				onRepeatPack={repeatPack}
				onReactPack={reactPack}
				onUndoReceipt={undoReceipt}
			/>
		{/each}
		{#if hasMoreVisible}
			<div class="work-load-more">
				<span aria-live="polite">{renderedVisible.length} of {visible.length} shown</span>
				<WornButton type="button" size="sm" data-action="show-more-work" onclick={showMoreWork}>Show {Math.min(WORK_RENDER_LIMIT, visible.length - renderedVisible.length)} more</WornButton>
			</div>
		{:else if visible.length === 0}
			{@render workEmptyState()}
		{/if}
	</div>
{/if}
	{/if}
	</div>
	{/each}

{#if recentActivity.length > 0}
		<div class="demo-work-recent">
			<WornAccordion label="Recent activity">
				<WornTimeline
					class="demo-work-recent-timeline"
					entries={recentTimelineEntries}
					ariaLabel="Recent work activity"
					density="compact"
					headingLevel={2}
					formatDate={relativeActivityTime}
				/>
			</WornAccordion>
		</div>
{/if}
</WornPage>

<style>
	.work-head-actions {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}
	:global(.work-mode-active) {
		background: var(--worn-accent) !important;
		border-color: var(--worn-accent) !important;
		color: var(--worn-accent-text) !important;
	}
	.quick-create-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-block:8px 6px}
	:global(.quick-create-input){flex:1;min-width:0}
	.quick-create-row :global(.quick-create-submit){flex:0 0 auto;min-inline-size:max-content;white-space:nowrap}
	.quick-create-options{grid-column:1 / -1;min-width:0}
	.quick-create-options summary{align-items:center;color:var(--worn-text-secondary);cursor:pointer;display:flex;font-size:13px;font-weight:700;gap:8px;min-block-size:36px;width:max-content}
	.quick-create-options summary span{color:var(--worn-text-muted);font-family:var(--font-typewriter);font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
	.quick-create-options :global(.quick-proof-input){margin-top:4px;width:100%}
	@media(min-width:421px){
		.demo-batch-bar {
			align-items: center;
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			min-width: 0;
			padding: 8px;
		}
	}
	@media(max-width:420px){
		:global(.demo-panel-head:has(.work-head-actions)){align-items:flex-start;flex-wrap:wrap}
		.work-head-actions{flex-wrap:nowrap;gap:4px;justify-content:flex-start;width:100%}
		.demo-batch-bar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0}
		.demo-batch-count{grid-column:1 / -1}
		.demo-batch-bar :global(.worn-btn){min-width:0;width:100%}
		.quick-create-row{align-items:stretch}
		.quick-create-row :global(.quick-create-submit){min-block-size:44px}
		.quick-create-options summary{min-block-size:44px}
	}
	@media(max-width:700px){
		:global(.demo-panel-head:has(.work-head-actions)){gap:8px;padding-block:7px}
		:global(.demo-panel-head:has(.work-head-actions) .demo-panel-title){margin-block:0}
	}
	.demo-work-list {
		overflow: visible;
		padding-block-start: 8px;
	}
	/* Grid density view */
	/* minmax(280px, …) means each column is AT LEAST 280px wide — below that the
	   track stops shrinking and the grid overflows its container. min(280px,100%)
	   keeps the intent (roughly 280px cards) while letting a narrow screen win. */
	.demo-work-grid{display:grid;margin-top:4px;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:8px;max-width:100%;min-width:0}
	.work-load-more{align-items:center;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px;color:var(--worn-text-muted);font-size:12px}
	@media(max-width:800px){.demo-work-grid{grid-template-columns:1fr}}

	.demo-work-recent {
		margin-top: 16px;
	}
	:global(.demo-work-recent-timeline) {
		--worn-timeline-max-inline-size: 100%;
		margin-top: 6px;
	}
	.shortcut-grid {
		display: grid;
		grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
		gap: 8px 16px;
		font-size: 13px;
		line-height: 1.5;
		align-items: center;
		margin-bottom: 18px;
	}
	.shortcut-grid dt,
	.shortcut-grid dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.shortcut-grid dt {
		text-align: right;
	}
	.shortcut-actions {
		display: flex;
		justify-content: flex-end;
	}
	.shortcut-actions :global(.worn-btn) {
		min-height: 44px;
	}

</style>
