# Hybrid Edge + in-app WebMCP recording cue sheet

Target final length: **2:35**. Hard stop: **2:45**. Use exactly two independently accepted source clips and one visible hard cut at 02:05. Do not speed up footage or trim out a failed state transition.

## Fixed setup

- Edge primary clip: Microsoft Edge at 100% zoom, one clean profile window, silent capture through the installed recording extension. Keep the laptop's native Edge viewport; do not apply a viewport override. Record its observed dimensions and require zero horizontal overflow before T0.
- In-app insert: ChatGPT in-app browser on the production Work page, recorded separately without microphone audio.
- Production URL: `https://projects-webmcp-extension.pages.dev/`.
- Before each clip, reset that browser's live sample; Guide or Work must show exactly 8 workspace items and no Pending link.
- Edge prompt: `Follow the brief on this page.` Keep the safe default Guide brief; do not load **Use fast-create brief** for the Edge clip.
- In-app prompt: `Read this Work page, then create these as Draft work items: Confirm donation pickup window; Print shelf labels; Prepare bike rack checklist. Do not start them.`
- Open and pin the Edge browser-agent panel before recording. Leave its prompt field empty and keep the pointer outside page content until the timed cue.
- Treat Edge chat as the trigger only. After submission, return visual focus to the product; visible `Agent activity · WebMCP` receipts are the evidence.
- Disable unrelated notifications. Keep the production URL, page focus rings, receipts, denominators, and human-authority copy readable.

## Browser-control ownership

- Tab control observes—but does not override—the Edge viewport and owns the monotonic timeline, route navigation, fixed holds, DOM checkpoints, focus checks, and abort decision.
- Timed route changes focus the existing visible landing/workflow links and activate them with Enter. Do not use full-document `goto`, address-bar navigation, browser Back, pointer-only activation, or retries inside the timed clip; the Edge control path measured full-document operations at about 10 seconds while visible SPA links settled within 1.1 seconds.
- The user manually starts and stops the Edge recorder and submits the single Edge side-panel prompt.
- The Edge page must report **Reader API detected** before rehearsal. Tab control does not invoke Edge WebMCP directly; the side-panel agent owns those calls.
- The in-app browser insert is directly repeatable: the agent reads Work, invokes the bounded Draft tool once, and stops on the exact receipt.
- Record a four-second setup pad before the Edge hero. Remove only that pad during editing; all timestamps below are final-video timestamps after the trim.

## Keyboard preflight

Complete this three times before recording. Any failure cancels the take.

1. On Guide, Tab through the skip link, brand, workflow navigation, scope choices, brief, and action buttons; every focused control must show a visible ring.
2. On Work, press `N`; focus must land in **Quick-add a work item**.
3. On Review, focus **Garage reset: sort shelves** and press `Enter`; Next must load that exact item and visibly focus the next-action preview.
4. Return to Guide. Confirm only `get_projects_handoff_guide` is active, **Reader API detected** is visible, the safe default brief forbids workspace changes, and the browser console has no error or warning.

Use a fixed **2.25-second settle window** after every route activation. If the named destination is not ready by the deadline, abort rather than retrying, clicking twice, or extending the take.

## Edge primary clip — 00:00–02:05

| Final time | Edge action | Required visible checkpoint | Narration track |
| --- | --- | --- | --- |
| 00:00–00:08 | Hold canonical `/` landing hero. | `Let an agent find the next move. Keep the final say.`; 9 tools; 4 bounded actions; No automatic starts. | “Projects gives a browser agent the same bounded work a person can see, while the person keeps the final say.” |
| 00:08 | Tab control opens `/webmcp-challenge`. | Guide H1 by 00:10.25. | — |
| 00:10.25–00:24 | Hold Guide, counted All-visible scope, and safe default brief. | 8 visible of 8 workspace; default brief forbids workspace changes; truthful authority boundary. | “The Guide publishes the exact visible denominator and a page-owned brief without giving its reader navigation or write authority.” |
| 00:24 | Tab control opens `/priority`. | Priority H1 by 00:26.25. | — |
| 00:26.25–00:35 | Hold the single recommendation. | Exact title, reason, and `/next` destination. | “Priority is deliberately smaller: one read-only recommendation from the same canonical selector.” |
| 00:35 | Tab control returns to Guide. | Guide H1 by 00:37.25; safe brief still selected. | — |
| 00:37.25–00:40 | User submits `Follow the brief on this page.` in the already-open Edge agent panel, then restores page focus. | Submitted prompt exact; product regains visual focus; workspace still 8. | “Now the browser agent follows the page-owned safe handoff.” |
| 00:40–01:10 | Agent reaches Work; hold the receipt and Decision Workspace. | `Agent activity · WebMCP · show_work_search`; 8 workspace; Decision context shows Household once; Not saved. Hard cutoff 01:10. | “On Work, the agent reads the same filtered list and exact counts. The Decision Workspace explains why this item needs attention.” |
| 01:10–01:35 | Agent reaches Review and narrows the queue. | `Agent activity · WebMCP · set_review_scope`; blocker evidence; shown, filtered, search-match, and total-review denominators; Not saved. Hard cutoff 01:35. | “Review changes presentation only. The blocker and the reason it surfaced remain visible beside the work.” |
| 01:35–02:05 | Agent reaches Next and prepares the proposal. Do not activate Save or Discard during capture. | `Agent activity · WebMCP · prepare_next_action`; exact verified facts; Draft pending approval; Save Not saved; workspace unchanged; Approve and save visible. Hard cutoff 02:05. | “Next accepts only current Work or Review facts, prepares an unsaved proposal, and generates its evidence note from those verified values.” |

Stop the Edge clip at 02:05. A pending proposal is allowed only until post-capture cleanup.

## ChatGPT in-app WebMCP insert — 02:05–02:35

Start on production `/work` with exactly 8 shown, 8 matching, and 8 workspace. Record the in-app browser and submit the exact in-app prompt from Fixed setup.

| Final time | In-app action | Required visible checkpoint | Narration track |
| --- | --- | --- | --- |
| 02:05–02:10 | Show the exact natural-language prompt and the unchanged 8-item Work page. | Prompt names the three exact Draft titles and says not to start them. | “For the final handoff, the agent reads the live Work denominator before creating anything.” |
| 02:10–02:22 | Agent invokes `get_current_work_view`, then exactly one `create_work_drafts` call. | Reader workspace 8; no partial item; no server request; receipt appears by 02:22. | “One bounded WebMCP call creates the next work atomically, but only as drafts.” |
| 02:22–02:35 | Hold the final in-app receipt and three Draft controls. | Created `3 · Draft`; workspace `8 → 11`; all three exact titles; Human Start required; three visible Start controls; none activated. | “The workspace records what was proposed. A person still decides what actually starts. Create fast; start deliberately.” |

## Abort conditions

Abort the affected clip immediately if any of these occurs:

- A route misses its 2.25-second settle window or any hard cutoff.
- Edge chat remains the visual focus, the prompt differs, or a named Work/Review/Next receipt is absent.
- The agent reads or prepares a different work item than the visible receipt names.
- Any denominator disappears or changes without a visible filter/action explanation.
- Edge Save is activated or its workspace changes before human approval.
- In-app Work does not begin at 8, creates anything other than the three named Drafts, starts work, performs a server request, or reports a partial batch.
- Focus is lost after the Review-to-Next handoff.
- A browser error, warning, CSP violation, duplicate tool, or unexpected request appears.
- Either source clip contains a failed transition. Do not hide it with the hybrid edit.

The final video is accepted only when both source clips pass independently, the single cut occurs at 02:05, the final duration is no more than 2:45, and the complete video remains below the official three-minute limit.

## Post-capture cleanup and edit

1. In Edge, discard the pending Next proposal or use Guide **Reset live sample**; confirm no Pending link and exactly 8 workspace items.
2. In the in-app browser, use Guide **Reset live sample**; confirm the three recording Drafts are absent and the exact 8-item sample is restored.
3. Trim only the four-second Edge setup pad and any setup pad before the in-app prompt. Use one hard cut at final time 02:05; do not speed either clip.
4. Add the narration track against the final timeline and export MP4 with H.264 video and AAC audio on a 1920 × 1080, 30 fps canvas. Preserve each source clip's aspect ratio without cropping; use letterboxing when needed. Target approximately -16 LUFS integrated audio and a peak no higher than -1.5 dB.
5. Watch the complete export twice. Confirm intelligible audio, readable URL and receipts, no private tabs or notifications, and a final duration under three minutes before public YouTube upload.
