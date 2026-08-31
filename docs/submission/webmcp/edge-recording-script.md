# Edge recording cue sheet

Target length: **2:45**. Hard stop: **2:50**. Do not speed up footage or trim out a failed state transition.

## Fixed setup

- Microsoft Edge at 1440 × 900, 100% zoom, one clean profile window.
- Production URL: `https://projects-webmcp-extension.pages.dev/`.
- Reset the live sample before recording; the Guide must show 8 visible of 8 workspace and no Pending link.
- Copy this exact prompt before recording: `Follow the brief on this page.`
- Open and pin the Edge browser-agent panel before recording. Leave its prompt field empty and keep the pointer outside the page content until the timed cue.
- Treat chat as the trigger only. After submitting the prompt, return the camera to the product immediately; the visible `Agent activity · WebMCP` receipts are the evidence shown to the viewer.
- Disable unrelated notifications. Keep the address bar, page focus ring, WebMCP receipts, and final authority copy visible.

## Keyboard preflight

Complete this three times before recording. Any failure cancels the take.

1. On Guide, Tab through the skip link, brand, and workflow navigation; every focused control must show a visible ring.
2. On Work, press `N`; focus must land in **Quick-add a work item**.
3. On Review, focus **Garage reset: sort shelves** and press `Enter`; Next must load that exact item and visibly focus the next-action preview.
4. Return to Guide. Confirm only `get_projects_handoff_guide` is active and the browser console has no error or warning.

Use a fixed **2.25-second settle window** after every route activation. If the named destination is not ready by the end of that window, stop the recording and restart; do not click twice or extend the take.

## Timed take

| Time | Edge action | Required visible checkpoint | Narration |
| --- | --- | --- | --- |
| 00:00–00:08 | Start on `/`. Hold the landing hero. | “Let an agent find the next move. Keep the final say.” | “Projects gives a browser agent the same bounded work a person can see, while the person keeps the final say.” |
| 00:08 | `Ctrl+L`, paste `/webmcp-challenge`, `Enter`. | Guide H1 by 00:10.25. | — |
| 00:10.25–00:24 | Hold Guide and the counted All visible work scope. | 8 visible of 8 workspace; editable brief; workspace unchanged. | “The Guide publishes the exact visible denominator and an editable brief. It has no save or navigation authority.” |
| 00:24 | `Ctrl+L`, paste `/priority`, `Enter`. | Priority H1 by 00:26.25. | — |
| 00:26.25–00:35 | Hold the single recommendation. | Exact title, reason, and `/next` destination. | “Priority is deliberately smaller: one read-only recommendation from the same canonical selector.” |
| 00:35 | `Alt+Left`. | Guide H1 by 00:37.25. | — |
| 00:37.25 | Click the already-open agent prompt field, then press `Ctrl+V`, `Enter`; immediately return the camera to the page. | Submitted prompt reads “Follow the brief on this page.” Chat is no longer the visual focus. | “Now the browser agent follows the page-owned brief.” |
| 00:40–01:10 | Let the agent reach Work. Hold on the in-app receipt and Decision Workspace. | `Agent activity · WebMCP · show_work_search`; 8 workspace; Decision context shows Household once; `Not saved`. Hard cutoff 01:10. | “On Work, the agent reads the same filtered list and exact counts. The Decision Workspace explains why this item needs attention.” |
| 01:10–01:35 | Let the agent reach Review and narrow the queue. Hold on the in-app receipt. | `Agent activity · WebMCP · set_review_scope`; blocker evidence; shown, filtered, search-match, and total-review denominators; `Not saved`. Hard cutoff 01:35. | “Review narrows presentation only. The blocker and the reason it surfaced stay visible beside the item.” |
| 01:35–02:10 | Let the agent reach Next and prepare the proposal. Hold on the in-app receipt. | `Agent activity · WebMCP · prepare_next_action`; exact verified facts; Draft pending approval; Save `Not saved`; Workspace unchanged; Approve and save visible. Hard cutoff 02:10. | “Next accepts only current Work or Review facts. It prepares an unsaved draft and generates the evidence note from those verified values.” |
| 02:10–02:25 | Hold the authority line and receipt. Do not activate Save. | “Only you can approve Save.” Pending link visible. | “The consequential action never moves into the tool. The person can approve, edit, or discard.” |
| 02:25 | Focus **Discard draft** and press `Enter`. | Pending link disappears by 02:27.25; Draft none; Workspace unchanged. | — |
| 02:27.25–02:40 | Hold restored Next state. | Save disabled; no pending draft; no error toast. | “Discard returns to the original editor without a workspace change.” |
| 02:40–02:45 | End on the authority line. | No browser error, warning, or unexpected request. | “Visible evidence in, human decision out.” |

## Abort conditions

Abort the take immediately if any of these occurs:

- A route misses its 2.25-second settle window.
- Chat remains the visual focus after prompt submission, or any named in-app WebMCP receipt is absent.
- The agent reads or prepares a different work item than the one visible in the receipt.
- Any denominator disappears or changes without a visible filter/action explanation.
- Save is activated, the workspace changes before human approval, or Discard leaves a Pending link.
- Focus is lost after the Review-to-Next handoff.
- A browser error, warning, CSP violation, duplicate tool, or unexpected network write appears.

The run is accepted only when every checkpoint is visible in one continuous Edge recording under three minutes.

## Optional custom-worker fast ending

Use this only after a separate Edge rehearsal completes the full preset before the cutoff. It replaces the default 02:10–02:45 ending.

Before the timed take, reset the sample, open Guide, and click **Use fast-create brief**. Confirm the visible brief explicitly says to return to Work, read the latest workspace count, create exactly three browser-local Draft items, and stop on the creation receipt. Keep the copied Edge prompt exactly `Follow the brief on this page.`; the visible page-owned preset, not extra chat instructions, grants this bounded creation authority.

| Time | Edge action | Required visible checkpoint | Narration |
| --- | --- | --- | --- |
| 02:10–02:22 | Return to Work and let the custom workers call `create_work_drafts` with three bounded items and the latest workspace count. | In-app `Agent activity · WebMCP · create_work_drafts`; Created `3 · Draft`; the three custom Draft titles remain named even if the current filter hides their cards; Workspace `8 → 11`; Human Start required. Abort at 02:22 if absent. | “Custom workers can create the next work in one bounded batch—but only as drafts.” |
| 02:22–02:35 | Hold the receipt and the three new Draft cards. Do not press Start. | Three visible Draft items; no active work started; no server request. | “The workspace records what was proposed. A person still decides what actually starts.” |
| 02:35–02:40 | End on the receipt and Draft cards. | No browser error, warning, partial batch, duplicate title, or unexpected write. | “Create fast. Start deliberately.” |

After recording, use the visible batch controls or Reset live sample to remove all three recording drafts and confirm the original 8-item sample. Do not perform cleanup inside the fast ending.
