// Receipt-scoped undo for visible, browser-local Projects workflow actions.

import { get, writable } from 'svelte/store';
import { demoState, displayToast, savePackPath } from '$lib/demo-client';
import { workTitle, type DemoPack } from '$lib/demo-workflow';

interface ForwardPathFields {
	title: string;
	status: string;
	blocker: string;
	blockedBy: string;
	owner: string;
	due: string;
	next: string;
	doneWhen: string;
	purpose: string;
	[key: string]: string;
}

interface ReceiptUndo {
	type: 'action';
	packId: string;
	fields: ForwardPathFields;
	dependents: Array<{ packId: string; fields: ForwardPathFields }>;
}

export const receiptUndo = writable<ReceiptUndo | null>(null);

let restoring = false;

function normalized(value: unknown): string {
	return String(value ?? '').trim();
}

function forwardPathSnapshot(pack: DemoPack): ForwardPathFields {
	return {
		title: normalized(pack.title),
		status: normalized(pack.status),
		blocker: normalized(pack.blocker),
		blockedBy: normalized(pack.blockedBy),
		owner: normalized(pack.owner),
		due: normalized(pack.due),
		next: normalized(pack.next),
		doneWhen: normalized(pack.doneWhen),
		purpose: normalized(pack.purpose)
	};
}

/** Capture the local fields changed by a supported receipt action. */
export function buildActionUndoSnapshot(
	packs: DemoPack[],
	packId: string,
	action: string
): ReceiptUndo | null {
	if (!['start', 'unblock', 'block', 'done'].includes(action)) return null;
	const pack = packs.find((item) => item.id === packId);
	if (!pack) return null;
	const dependents = action === 'done'
		? packs
			.filter((item) => item.id !== packId && normalized(item.blockedBy) === packId)
			.map((item) => ({ packId: item.id || '', fields: forwardPathSnapshot(item) }))
		: [];
	return { type: 'action', packId, fields: forwardPathSnapshot(pack), dependents };
}

export function commitActionUndo(snapshot: ReceiptUndo | null): void {
	if (snapshot) receiptUndo.set(snapshot);
}

export async function undoReceipt(): Promise<void> {
	const undo = get(receiptUndo);
	if (!undo || restoring) return;
	restoring = true;
	try {
		const targets = [{ packId: undo.packId, fields: undo.fields }, ...undo.dependents];
		for (const target of targets) {
			if (target.packId) await savePackPath(target.packId, target.fields);
		}
		const pack = get(demoState)?.packs?.find((item) => item.id === undo.packId);
		displayToast(`Undo complete. ${pack ? workTitle(pack) : 'The work'} is back to its previous state.`, 'success');
		receiptUndo.set(null);
	} catch (error) {
		displayToast(
			error instanceof Error && error.message
				? `Undo failed: ${error.message}`
				: 'Undo failed — the local state is unchanged.',
			'error'
		);
	} finally {
		restoring = false;
	}
}
