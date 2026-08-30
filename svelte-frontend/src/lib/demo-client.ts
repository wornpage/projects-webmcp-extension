// Browser-local state owner for the Projects workflow and its sample workspace.

import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { DemoPack, DemoReceipt, DemoState } from '$lib/demo-workflow';
import {
	formatWorkTitle,
	nextChoiceForwardPath,
	rebaseSeedPacks,
	PACK_ACTIONS,
	STATE_FILTERS,
	VALID_PACK_STATUSES,
	workflowLabel,
	hasBlocker,
	blockerText,
	workTitle
} from '$lib/demo-workflow';
import {
	DEMO_BLOCKER_NONE,
	formatActivityEntry,
	forwardPathStatusForBlocker,
	normalizeStoredBlocker,
	normalizeText,
	packActionEffect,
	unblockPacksBlockedBy,
	unblockedReceiptSentence
} from './workflow-rules.mjs';
import { approvePendingDraft, cloneMutatePersist, discardPendingDraft, hydrateSerializedState, pendingDraftFingerprint as fingerprintPendingDraft, resetPersistedState, restorePendingDraft, upsertPendingDraft } from './pending-next-action.mjs';

const STORAGE_KEY = 'projects-webmcp-challenge-state-v1';
const SEED_URL = '/data/demo-packs.json';
const FORWARD_PATH_FIELDS = [
	'title',
	'status',
	'blocker',
	'blockedBy',
	'owner',
	'due',
	'next',
	'doneWhen',
	'purpose'
] as const;

export const DEMO_WORK_TITLE_MAX_LENGTH = 200;

export const demoState = writable<DemoState | null>(null);
export const demoStateLoading = writable(false);
export const demoStateError = writable('');
export const actionBusy = writable('');

export interface DemoToast {
	id: string;
	message: string;
	kind?: 'info' | 'error' | 'success';
}

export const toasts = writable<DemoToast[]>([]);

export type PendingNextActionDraft = {
	workId: string;
	choice: string;
	mode: 'preset' | 'custom';
	evidenceNote: string;
	evidence: Array<{ workId: string; field: 'workflow' | 'blocker'; expectedValue: string }>;
	originFingerprint: string;
	source: 'human' | 'webmcp';
};

export class ChallengeStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ChallengeStateError';
	}
}

let toastCounter = 0;
let stateRevision = 0;
let refreshFlight: Promise<DemoState | null> | null = null;

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

function assertDemoState(value: unknown): asserts value is DemoState {
	if (!value || typeof value !== 'object' || !Array.isArray((value as DemoState).packs)) {
		throw new ChallengeStateError('Saved workspace data is not a valid work-item state.');
	}
	const ids = new Set<string>();
	for (const pack of (value as DemoState).packs) {
		if (!pack || typeof pack !== 'object' || typeof pack.id !== 'string' || !pack.id.trim()) {
			throw new ChallengeStateError('Saved workspace data contains a work item without an id.');
		}
		if (ids.has(pack.id)) {
			throw new ChallengeStateError(`Saved workspace data contains duplicate id "${pack.id}".`);
		}
		ids.add(pack.id);
	}
	const pending = (value as DemoState).pendingNextActionDrafts;
	if (pending !== undefined && (!Array.isArray(pending) || pending.some((draft) => !isPendingNextActionDraft(draft)))) {
		throw new ChallengeStateError('Saved pending approvals are invalid. Clear this site\'s local data to restart.');
	}
}

function isPendingNextActionDraft(value: unknown): value is PendingNextActionDraft {
	if (!value || typeof value !== 'object') return false;
	const draft = value as PendingNextActionDraft;
	return typeof draft.workId === 'string' && Boolean(draft.workId.trim()) &&
		typeof draft.choice === 'string' && Boolean(draft.choice.trim()) &&
		(draft.mode === 'preset' || draft.mode === 'custom') &&
		typeof draft.evidenceNote === 'string' && Array.isArray(draft.evidence) &&
		typeof draft.originFingerprint === 'string' && Boolean(draft.originFingerprint) &&
		(draft.source === 'human' || draft.source === 'webmcp') &&
		draft.evidence.every((fact) => fact && typeof fact.workId === 'string' && (fact.field === 'workflow' || fact.field === 'blocker') && typeof fact.expectedValue === 'string');
}

export function pendingNextActionDrafts(state: DemoState | null): PendingNextActionDraft[] {
	return state?.pendingNextActionDrafts && Array.isArray(state.pendingNextActionDrafts)
		? state.pendingNextActionDrafts.filter(isPendingNextActionDraft)
		: [];
}

export function pendingNextActionDraftFor(state: DemoState | null, workId: string): PendingNextActionDraft | null {
	return pendingNextActionDrafts(state).find((draft) => draft.workId === workId) ?? null;
}

export async function savePendingNextActionDraft(draft: PendingNextActionDraft): Promise<DemoState | null> {
	if (!isPendingNextActionDraft(draft)) throw new ChallengeStateError('Pending approval draft is invalid.');
	return saveBrowserState((state) => {
		upsertPendingDraft(state, draft);
	});
}

export async function restorePendingNextActionDraft(workId: string, priorDraft: PendingNextActionDraft | null): Promise<DemoState | null> {
	return saveBrowserState((state) => restorePendingDraft(state, workId, priorDraft));
}

export async function discardPendingNextActionDraft(workId: string): Promise<DemoState | null> {
	return saveBrowserState((state) => {
		discardPendingDraft(state, workId);
	});
}

export function pendingDraftFingerprint(state: DemoState, draft: PendingNextActionDraft): string {
	return fingerprintPendingDraft(state, draft, (pack: DemoPack) => ({ title: workTitle(pack), workflow: workflowLabel(pack), blocker: hasBlocker(pack) ? blockerText(pack) : 'None', next: pack.next || '' }));
}

export async function setPackNextAction(workId: string): Promise<{ saved: true; pack: DemoPack; receipt: DemoReceipt; state: DemoState }> {
	const written = await saveBrowserState((state) => {
		let approved;
		try {
			approved = approvePendingDraft(state, workId, {
				projectPack: (pack: DemoPack) => ({ title: workTitle(pack), workflow: workflowLabel(pack), blocker: hasBlocker(pack) ? blockerText(pack) : 'None', next: pack.next || '' }),
				nextPath: nextChoiceForwardPath
			});
		} catch (error) {
			throw new ChallengeStateError(error instanceof Error ? error.message : 'Pending approval could not be saved.');
		}
		const pack = approved.pack;
		const summary = `Next action set to "${pack.next || 'open'}".`;
		const receipt: DemoReceipt = { summary, pack };
		state.selectedId = pack.id;
		state.status = summary;
		state.actionReceipt = receipt;
	});
	if (!written?.actionReceipt?.pack) throw new ChallengeStateError('Pending next action was not saved.');
	return { saved: true, pack: written.actionReceipt.pack, receipt: written.actionReceipt, state: written };
}

function cloneState(state: DemoState): DemoState {
	try {
		const clone = JSON.parse(JSON.stringify(state)) as unknown;
		assertDemoState(clone);
		return clone;
	} catch (error) {
		if (error instanceof ChallengeStateError) throw error;
		throw new ChallengeStateError('Workspace data could not be copied for a local save.');
	}
}

function readStoredState(): DemoState | null {
	let serialized: string | null;
	try {
		serialized = localStorage.getItem(STORAGE_KEY);
	} catch {
		throw new ChallengeStateError('Browser storage is unavailable. Local changes cannot be loaded.');
	}
	try {
		return hydrateSerializedState(serialized, assertDemoState) as DemoState | null;
	} catch (error) {
		if (error instanceof ChallengeStateError) throw error;
		throw new ChallengeStateError('Saved workspace data is invalid JSON. Clear this site\'s local data to restart.');
	}
}

function persistState(state: DemoState): void {
	assertDemoState(state);
	let serialized: string;
	try {
		serialized = JSON.stringify(state);
	} catch {
		throw new ChallengeStateError('Workspace data could not be serialized for a local save.');
	}
	try {
		localStorage.setItem(STORAGE_KEY, serialized);
	} catch {
		throw new ChallengeStateError('Browser storage is full or unavailable. The change was not saved.');
	}
}

async function loadSeedState(): Promise<DemoState> {
	let response: Response;
	try {
		response = await fetch(SEED_URL, { cache: 'no-store' });
	} catch {
		throw new ChallengeStateError('Could not load the bundled workspace data.');
	}
	if (!response.ok) {
		throw new ChallengeStateError(`Could not load the bundled workspace data (${response.status}).`);
	}
	let source: unknown;
	try {
		source = await response.json();
	} catch {
		throw new ChallengeStateError('The bundled workspace data is invalid JSON.');
	}
	if (!Array.isArray(source)) {
		throw new ChallengeStateError('The bundled workspace data is not a work-item list.');
	}
	const state: DemoState = { packs: rebaseSeedPacks(source as DemoPack[]) };
	assertDemoState(state);
	return state;
}

async function runDemoStateRefresh(): Promise<DemoState | null> {
	const startingRevision = stateRevision;
	demoStateLoading.set(true);
	try {
		const state = readStoredState() ?? (await loadSeedState());
		if (startingRevision !== stateRevision) return get(demoState);
		demoState.set(state);
		demoStateError.set('');
		return state;
	} catch (error) {
		if (startingRevision !== stateRevision) return get(demoState);
		demoStateError.set(errorMessage(error, 'Could not load workspace data.'));
		return null;
	} finally {
		if (startingRevision === stateRevision) demoStateLoading.set(false);
	}
}

function replaceDemoState(state: DemoState): DemoState {
	stateRevision += 1;
	demoState.set(state);
	demoStateError.set('');
	return state;
}

export function displayToast(
	message: string,
	kind: 'info' | 'error' | 'success' = 'info'
): void {
	if (!browser) return;
	const id = `toast-${++toastCounter}`;
	toasts.update((items) => [...items, { id, message, kind }]);
}

export async function refreshDemoState(
	{ reuseRecent = false }: { reuseRecent?: boolean } = {}
): Promise<DemoState | null> {
	if (!browser) return null;
	const current = get(demoState);
	if (reuseRecent && current) return current;
	if (refreshFlight) return refreshFlight;
	refreshFlight = runDemoStateRefresh();
	try {
		return await refreshFlight;
	} finally {
		refreshFlight = null;
	}
}

/**
 * Restore the bundled live sample only after a person explicitly requests it.
 * This stays in the single browser-state owner: it clears this demo's local
 * workspace snapshot, then replaces the live view with the immutable seed.
 */
export async function resetDemoSampleState(): Promise<DemoState | null> {
	if (!browser) return null;
	stateRevision += 1;
	try {
		return await resetPersistedState({
			remove: () => localStorage.removeItem(STORAGE_KEY),
			loadSeed: loadSeedState,
			install: replaceDemoState
		});
	} catch (error) {
		if (error instanceof ChallengeStateError) throw error;
		throw new ChallengeStateError('Browser storage is unavailable. The live sample could not be reset.');
	}
}

export async function saveBrowserState(
	mutate: (state: DemoState) => void
): Promise<DemoState | null> {
	if (!browser) return null;
	const current = get(demoState) ?? (await refreshDemoState());
	if (!current) return null;
	return cloneMutatePersist({ current, clone: cloneState, mutate, persist: persistState, install: replaceDemoState });
}

function appendActivity(pack: DemoPack, detail: string): boolean {
	const entry = formatActivityEntry(detail);
	if (!entry) return false;
	pack.activity = [...(pack.activity || []).slice(-99), entry];
	return true;
}

function actionSignature(pack: DemoPack): string {
	return `${normalizeText(pack.status, 40) || 'unknown'}|${normalizeStoredBlocker(pack.blocker)}|${normalizeText(pack.next, 200)}`;
}

function actionSummary(pack: DemoPack, action: string, changed: boolean): string {
	const title = workTitle(pack);
	if (action === 'done') return changed ? `Done saved for ${title}.` : `Done already saved for ${title}.`;
	if (action === 'start') return changed ? `Started ${title}.` : `${title} is already active.`;
	if (action === 'unblock') return changed ? `Blocker cleared for ${title}.` : `Blocker already clear for ${title}.`;
	if (action === 'block') return changed ? `Blocker added for ${title}.` : `${title} is already blocked.`;
	if (action === 'open') return changed ? `Work path opened for ${title}.` : `Work path already open for ${title}.`;
	return changed ? `${action} saved for ${title}.` : `${action} is already saved for ${title}.`;
}

function proofActivity(pack: DemoPack): string {
	const target = normalizeText(pack.doneWhen, 1000);
	return target ? `Proof saved: ${target}` : 'Finished work.';
}

export async function runPackAction(packId: string, rawAction: string): Promise<DemoReceipt | null> {
	const action = normalizeText(rawAction, 40).toLowerCase();
	if (!PACK_ACTIONS.has(action)) {
		throw new ChallengeStateError(`Unsupported work action: ${action || 'missing'}.`);
	}
	let current = get(demoState);
	if (!current) current = await refreshDemoState();
	if (!current) return null;
	if (!current.packs.some((pack) => pack.id === packId)) {
		displayToast('That work item is no longer in the current workspace state.', 'error');
		return null;
	}

	const written = await saveBrowserState((draft) => {
		const pack = draft.packs.find((item) => item.id === packId)!;
		const before = actionSignature(pack);
		const wasDone = pack.status === 'done';
		let changed = false;

		if (action === 'archive') {
			changed = pack.archived !== true;
			pack.archived = true;
			if (changed && pack.status !== 'done') appendActivity(pack, 'Archived.');
		} else if (action === 'open') {
			changed = appendActivity(pack, 'Opened.');
		} else {
			Object.assign(pack, packActionEffect(pack, action));
			changed = actionSignature(pack) !== before;
			if (changed) {
				const detail = action === 'start'
					? 'Started.'
					: action === 'unblock'
						? 'Blocker set to None.'
						: action === 'block'
							? 'Blocked.'
							: proofActivity(pack);
				appendActivity(pack, detail);
			}
		}

		const unblockedCount = action === 'done' && !wasDone
			? unblockPacksBlockedBy(draft.packs, pack, { onActivity: appendActivity, workTitle }).length
			: 0;
		const summary = [actionSummary(pack, action, changed), unblockedReceiptSentence(unblockedCount)]
			.filter(Boolean)
			.join(' ');
		const receipt: DemoReceipt = { summary, pack };
		draft.selectedId = pack.id;
		draft.status = summary;
		draft.actionReceipt = receipt;
	});
	const receipt = written?.actionReceipt || null;
	if (receipt?.summary) {
		displayToast(receipt.summary.replace(/(\.)?$/u, ' · Undo is available in the receipt.'), 'success');
	}
	return receipt;
}

export async function createPack(payload: Record<string, unknown>): Promise<{
	pack: DemoPack;
	state: DemoState;
}> {
	const title = normalizeText(payload.title, DEMO_WORK_TITLE_MAX_LENGTH);
	if (!title) throw new ChallengeStateError('A work title is required.');
	if (!globalThis.crypto?.randomUUID) {
		throw new ChallengeStateError('This browser cannot create a collision-safe local work id.');
	}
	const requestedStatus = normalizeText(payload.status, 40) || 'draft';
	if (!VALID_PACK_STATUSES.has(requestedStatus)) {
		throw new ChallengeStateError('Work path status is not supported.');
	}
	const id = `challenge-${globalThis.crypto.randomUUID()}`;
	const pack: DemoPack = {
		...payload,
		id,
		title,
		status: requestedStatus,
		blocker: normalizeStoredBlocker(payload.blocker),
		next: normalizeText(payload.next, 200) || (requestedStatus === 'active' ? 'Open' : 'Set next action'),
		activity: [formatActivityEntry('Created.')],
		pinned: false,
		archived: false
	};
	const state = await saveBrowserState((draft) => {
		draft.packs.push(pack);
		draft.selectedId = id;
		draft.status = `Created ${formatWorkTitle(title)}.`;
	});
	if (!state) throw new ChallengeStateError('Workspace data is not available.');
	const created = state.packs.find((item) => item.id === id)!;
	displayToast(`Created: ${formatWorkTitle(created.title)}`, 'success');
	return { pack: created, state };
}

function pathSignature(pack: DemoPack): string {
	return JSON.stringify(Object.fromEntries(FORWARD_PATH_FIELDS.map((field) => [field, pack[field] ?? ''])));
}

export async function savePackPath(
	packId: string,
	values: Record<string, unknown>
): Promise<{ saved: true; pack: DemoPack; receipt: DemoReceipt; state: DemoState }> {
	const written = await saveBrowserState((draft) => {
		const pack = draft.packs.find((item) => item.id === packId);
		if (!pack) throw new ChallengeStateError('Work item was not found.');
		const before = pathSignature(pack);
		const statusBefore = normalizeText(pack.status, 40);

		for (const field of FORWARD_PATH_FIELDS) {
			if (!Object.prototype.hasOwnProperty.call(values, field)) continue;
			const value = normalizeText(values[field], field === 'purpose' || field === 'doneWhen' ? 1000 : 200);
			if (field === 'status') {
				if (!VALID_PACK_STATUSES.has(value)) throw new ChallengeStateError('Work path status is not supported.');
				pack.status = value;
			} else if (field === 'blocker') {
				pack.blocker = normalizeStoredBlocker(value);
				if (pack.blocker === DEMO_BLOCKER_NONE && !Object.prototype.hasOwnProperty.call(values, 'blockedBy')) {
					pack.blockedBy = '';
				}
			} else {
				pack[field] = value;
			}
		}

		if (!Object.prototype.hasOwnProperty.call(values, 'status') && pack.status !== 'done') {
			pack.status = pack.blockedBy
				? 'blocked'
				: forwardPathStatusForBlocker(pack.status, pack.blocker, pack.next);
		}
		let unblockedCount = 0;
		if (statusBefore !== 'done' && pack.status === 'done') {
			pack.blocker = DEMO_BLOCKER_NONE;
			pack.blockedBy = '';
			unblockedCount = unblockPacksBlockedBy(draft.packs, pack, { onActivity: appendActivity, workTitle }).length;
		}
		const summary = [
			pathSignature(pack) === before ? `${workTitle(pack)}: unchanged.` : `${workTitle(pack)}: path updated.`,
			unblockedReceiptSentence(unblockedCount)
		].filter(Boolean).join(' ');
		const receipt: DemoReceipt = { summary, pack };
		draft.status = summary;
		draft.actionReceipt = receipt;
	});
	if (!written?.actionReceipt?.pack) throw new ChallengeStateError('Work path was not saved.');
	displayToast('Saved.', 'success');
	return {
		saved: true,
		pack: written.actionReceipt.pack,
		receipt: written.actionReceipt,
		state: written
	};
}

export async function togglePackPinned(packId: string): Promise<void> {
	await saveBrowserState((draft) => {
		const pack = draft.packs.find((item) => item.id === packId);
		if (pack) pack.pinned = !pack.pinned;
	});
	displayToast('Pin toggled.', 'success');
}

export async function setStateFilter(filter: string): Promise<void> {
	const value = normalizeText(filter, 40);
	if (!STATE_FILTERS.includes(value)) throw new ChallengeStateError('Work filter is not supported.');
	await saveBrowserState((draft) => {
		draft.filter = value;
	});
}

export async function setSelectedWork(selectedId: string): Promise<void> {
	let current = get(demoState);
	if (!current) current = await refreshDemoState();
	if (!current?.packs.some((pack) => pack.id === selectedId)) return;
	await saveBrowserState((draft) => {
		draft.selectedId = selectedId;
	});
}

export async function savePackBrowserFields(
	packId: string,
	mutate: (pack: DemoPack) => void
): Promise<DemoState | null> {
	return saveBrowserState((draft) => {
		const pack = draft.packs.find((item) => item.id === packId);
		if (pack) mutate(pack);
	});
}
