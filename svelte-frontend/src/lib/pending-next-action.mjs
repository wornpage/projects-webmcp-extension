// @ts-nocheck

export function pendingDraftFingerprint(state, draft, projectPack) {
	const origin = state.packs.find((pack) => pack.id === draft.workId);
	return JSON.stringify({
		workId: draft.workId,
		origin: origin ? projectPack(origin) : null,
		facts: draft.evidence.map((reference) => {
			const pack = state.packs.find((item) => item.id === reference.workId);
			return { workId: reference.workId, field: reference.field, value: pack ? projectPack(pack)[reference.field] : null };
		})
	});
}

export function pendingDraftFor(state, workId) {
	return (state.pendingNextActionDrafts || []).find((draft) => draft.workId === workId) || null;
}

export function discardPendingDraft(state, workId) {
	state.pendingNextActionDrafts = (state.pendingNextActionDrafts || []).filter((draft) => draft.workId !== workId);
}

export function upsertPendingDraft(state, draft) {
	state.pendingNextActionDrafts = [...(state.pendingNextActionDrafts || []).filter((item) => item.workId !== draft.workId), structuredClone(draft)];
}

export function restorePendingDraft(state, workId, priorDraft) {
	if (priorDraft) upsertPendingDraft(state, priorDraft);
	else discardPendingDraft(state, workId);
}

export function pendingDraftNavigation(state) {
	const drafts = state.pendingNextActionDrafts || [];
	return { count: drafts.length, resumeHref: drafts[0] ? `/next?pack=${encodeURIComponent(drafts[0].workId)}` : '/next' };
}

export function cloneMutatePersist({ current, clone, mutate, persist, install }) {
	const next = clone(current);
	mutate(next);
	persist(next);
	return install(next);
}

export function approvePendingDraft(state, workId, { projectPack, nextPath }) {
	const draft = pendingDraftFor(state, workId);
	if (!draft) throw new Error('Pending approval draft was not found.');
	if (pendingDraftFingerprint(state, draft, projectPack) !== draft.originFingerprint) {
		throw new Error('Draft is stale. Refresh the evidence and prepare it again before approval.');
	}
	const pack = state.packs.find((item) => item.id === workId);
	if (!pack) throw new Error('Pending approval work item was not found.');
	Object.assign(pack, nextPath(pack, draft.choice));
	discardPendingDraft(state, workId);
	return { pack, draft };
}
