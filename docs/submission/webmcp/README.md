# Submission record

## Positioning

> A visible agent-to-human handoff: the browser agent finds the next move, explains it from page evidence, and stops at an unsaved proposal for the person to decide.

The agent reads bounded page projections, can change reversible page scope, can atomically add at most three browser-local Draft items, and can prepare—but not silently save—a next action from exact Work or Review facts. Next requires one to three structured references, rejects stale or mismatched values, and generates the visible evidence note from the verified facts rather than agent prose. Successful actions leave a visible, screen-reader-announced receipt derived from the resulting page state; read-only getters do not impersonate a change. Scope and preparation receipts state that the workspace is unchanged; draft-creation receipts disclose the exact before/after workspace counts and require a visible human Start.

Priority adds a deliberately smaller read-only checkpoint: one canonical selector chooses the visible actionable recommendation, and the route-owned `get_next_recommendation` tool returns only that same id, title, destination, and reason. It cannot navigate, fetch, or write, returns `null` for the visible empty state, and is removed with the page catalog on navigation.

Work keeps active execution human-owned. Its single Quick Add form is available in both density modes and can disclose optional owner, area, type, due, energy, recurrence, and proof-target fields; every value travels through the existing `createPack` state owner. The bounded `create_work_drafts` tool reuses that normalization through one atomic state transaction to add at most three browser-local items in Draft status. Its one visible activity receipt names every created Draft even when the current Work filter hides those cards. It cannot start, block, complete, or delete them; a person must use the existing visible controls. No second storage path, request, or compatibility route is added.

The exact under-three-minute Edge choreography, keyboard preflight, narration, settle windows, and abort conditions are in [edge-recording-script.md](edge-recording-script.md).

## Eligibility record

Projects is a pre-existing product. The submitted work is the WebMCP extension and the challenge-only public static edition documented in the repository-root `SOURCE_PROVENANCE.md`.

The public Git history begins during the official submission period and is intentionally fresh so unrelated production source is not recoverable from earlier commits.

## Submission checklist

- Working static URL accessible without an account during judging.
- Public source repository with a visible MIT license.
- Complete source, deterministic sample data, locked dependencies, and build instructions.
- Text description covering WebMCP fit, shared person-agent capability, and implementation.
- Public demonstration video under three minutes with audio.
- The recording follows the checked-in 2:10 Edge-only cue sheet, passes its keyboard preflight, and ends on the visible human approval boundary in one continuous take without route cuts, speeding, or hidden failed transitions.
- Dated public commits and `SOURCE_PROVENANCE.md` distinguishing prior work from the challenge extension.
