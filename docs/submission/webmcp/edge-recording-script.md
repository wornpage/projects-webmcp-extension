# Edge-only WebMCP recording cue sheet

Target final length: **2:10**. Hard stop: **2:20**. Record one continuous Microsoft Edge clip. Do not speed up footage, remove pauses inside the accepted take, or hide a failed state transition with an edit.

## Fixed setup

- Use Microsoft Edge at 100% zoom in one clean profile window with the installed recording extension and browser-agent side panel.
- Keep the laptop's native Edge viewport; do not apply a viewport override. Record its observed dimensions and require zero horizontal overflow before T0.
- Production URL: `https://projects-webmcp-extension.pages.dev/`.
- Before the take, use Guide **Reset live sample**. Require exactly 8 workspace items and no Pending link.
- Keep the safe default Guide brief for the opening Guide and Priority shots. After returning from Priority, activate **Use fast-create brief** with Shift+Tab and Enter; do not load it before navigating away because this page-local state does not survive Guide → Priority → Guide.
- Side-panel instruction: `Follow the brief on this page.` The side-panel agent reads the selected brief and executes the page's WebMCP tools; it must stop without Save or Start.
- Park the pointer in the bottom-right corner before T0 and leave it there for the entire clip.
- Disable unrelated notifications. Keep the URL, keyboard focus rings, activity receipts, denominators, and human-authority copy readable.

## Browser-control ownership

- Tab control observes—but does not override—the native Edge viewport and owns the monotonic timeline, route navigation, fixed holds, DOM checkpoints, focus checks, and abort decision.
- Every timed route change—including Guide → Work → Review → Next → Work—uses real Tab or Shift+Tab focus movement to an existing visible link, followed by Enter.
- Do not click route links, use full-document `goto`, address-bar navigation, browser Back, pointer activation, retry a transition, or extend a hold to hide late execution.
- The side-panel agent owns every WebMCP call. Tab control never substitutes a direct workspace API, server request, or second mutation path.
- Record a four-second setup pad on the settled landing hero. Remove only that setup pad afterward; all timestamps below are final-video timestamps after the trim.

## Keyboard preflight

Complete this exact path once immediately before recording. Any mismatch cancels the take.

1. Landing → Guide: six Tab presses, then Enter on **Open the handoff workflow**.
2. Guide → Priority: four Tab presses, then Enter.
3. Priority → Guide: three Tab presses, then Enter.
4. Returned Guide → fast brief: five Shift+Tab presses, then Enter on **Use fast-create brief**.
5. Fast brief → Work: press Tab once on the page body to reclaim page focus from the completed reader, then advance visibly with Tab until **1 Work** receives focus. Require the target within five moves and press Enter; fail if focus reaches a later route first.
6. Work receipt → Review: seven Shift+Tab presses, then Enter on **Review in queue**.
7. Review receipt → Next: one Shift+Tab press, then Enter on **3 Next**.
8. Prepared Next receipt → Work: four Shift+Tab presses, then Enter on **1 Work**.
9. Work Draft receipt → pending decision: nine Shift+Tab presses, then Enter on **Pending 1**.
10. Confirm **Reader API detected**, exact 8-item state, visible focus at every destination, and no browser error or warning.

Use a fixed **2.25-second settle window** after every route activation. Abort instead of retrying, double-activating, clicking, or relaxing a checkpoint.

## One continuous Edge clip — 00:00–02:10

| Final time | Keyboard/WebMCP action | Required visible checkpoint | Narration track |
| --- | --- | --- | --- |
| 00:00–00:07 | Hold the canonical landing hero. | `Let an agent find the next move. Keep the final say.`; 9 tools; 4 bounded actions; No automatic starts. | “Projects gives a browser agent the same bounded work a person can see, while the person keeps the final say.” |
| 00:07–00:20 | Tab to Guide and hold the safe default brief. | Guide ready by 00:09.25; 8 visible of 8 workspace; brief forbids workspace changes. | “The Guide publishes the exact denominator and authority boundary the agent must follow.” |
| 00:20–00:29 | Tab to Priority and hold the single recommendation. | Priority ready by 00:22.25; one exact title, reason, and Next destination. | “Priority is deliberately smaller: one read-only recommendation from the canonical selector.” |
| 00:29–00:34 | Tab back to Guide, activate **Use fast-create brief**, and let the side-panel reader inspect it. | Guide ready by 00:31.25; fast brief selected only now; workspace remains 8. | “The handoff can now finish with bounded Draft creation, while Start and Save remain human-owned.” |
| 00:34–00:54 | Tab to Work; read the 8-item view and show the `Garage reset` search. | `WebMCP · show_work_search`; 4 matching of 8 workspace; 2 blocked; Decision Workspace; Not saved. | “Work narrows the visible list and explains the decision context without changing workspace data.” |
| 00:54–01:12 | Shift+Tab to Review and apply `Garage reset` + Blocked. | `WebMCP · set_review_scope`; 2 shown, 2 filtered, 3 search matches, 5 total review; Not saved. | “Review keeps every denominator visible and shows the two blocker facts behind the queue.” |
| 01:12–01:36 | Shift+Tab to Next and prepare `Confirm storage bin delivery`. | `WebMCP · prepare_next_action`; exact Blocked and Waiting on storage bins evidence; Not saved; human approval required. | “Next accepts exact live facts, generates the evidence note, and stops at an unsaved proposal.” |
| 01:36–01:44 | Use four Shift+Tab presses and Enter to return to Work, then invoke `get_current_work_view`. | Workspace is still exactly 8 before creation; no work was started or saved. | “The agent rereads the live denominator before creating anything.” |
| 01:44–01:54 | Invoke one `create_work_drafts` call and hold the receipt. | Exact titles `Confirm donation pickup window`, `Print shelf labels`, and `Prepare bike rack checklist`; `3 · Draft`; `8 → 11`; Human Start required; no Start activated. | “One atomic WebMCP call records three Drafts. Create fast; start deliberately.” |
| 01:54–02:10 | Use nine Shift+Tab presses and Enter on **Pending 1**, then hold the restored Next decision receipt. | `Review the proposed next action`; exact blocker and proposal; `Draft: pending approval`; `Workspace: unchanged`; `only you can approve Save`; **Discard draft** and **Approve and save** visible and untouched. | “Automation can prepare and record the work, but the consequential decision still returns to a person. Nothing is saved until they approve it.” |

Stop the recorder at 02:10 on the human approval frame. Do not activate **Approve and save**, **Start**, or **Discard** during capture.

## Abort conditions

Abort the take immediately if any of these occurs:

- A route misses its 2.25-second settle window or any section crosses its hard timestamp.
- The pointer leaves its corner, a route uses a click, or the expected Tab/Shift+Tab destination differs.
- Guide does not begin at 8, the fast brief is loaded before the final Guide return, or the side-panel reader sees a different brief.
- Work, Review, or Next names a different item, fact, query, filter, or denominator than the visible receipt.
- Next Save or any Draft Start is activated.
- Draft creation does not reread workspace 8, creates anything other than the three exact titles, reports a partial batch, or performs a server write.
- The final Pending navigation does not restore the exact verified Next receipt, unchanged-workspace statement, and visible human Save/Discard controls.
- Focus is not visible at a required receipt or destination.
- A browser error, warning, CSP violation, duplicate tool, unexpected request, or horizontal overflow appears.

The video is accepted only when this one continuous Edge clip passes every checkpoint, ends no later than 02:20 on the human approval frame, and remains below the official three-minute limit after narration.

## Post-capture cleanup and edit

1. In the same Edge profile, use Guide **Reset live sample**; confirm the pending Next proposal and all three recording Drafts are absent, no Pending link remains, and the workspace is exactly 8.
2. Trim only the four-second setup pad. Do not add a route cut, speed up the clip, or remove an in-take pause.
3. Add narration and export MP4 with H.264 video and AAC audio on a 1920 × 1080, 30 fps canvas. Preserve the native Edge aspect ratio without cropping; letterbox when needed. Target approximately -16 LUFS integrated audio with a peak no higher than -1.5 dB.
4. Watch the complete export twice. Confirm intelligible audio, readable URL and receipts, no private tabs or notifications, and a final duration below three minutes before public YouTube upload.
