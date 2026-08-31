# Edge-only WebMCP recording cue sheet

Target final length: **1:50**. Hard stop: **2:00**. Record one continuous Microsoft Edge clip. Do not speed up footage, remove pauses inside the accepted take, or hide a failed state transition with an edit.

## Fixed setup

- Use Microsoft Edge at 100% zoom in one clean profile window with the installed recording extension and browser-agent side panel.
- Keep the laptop's native Edge viewport; do not apply a viewport override. Record its observed dimensions and require zero horizontal overflow before T0.
- Production URL: `https://projects-webmcp-extension.pages.dev/`.
- Before the take, use Guide **Reset live sample**. Require exactly 8 workspace items, no Pending link, and a clean **Live WebMCP handoff** rail showing `0 of 5 steps` and `0 saved · 0 started`.
- Keep the safe default Guide brief for the opening Guide and Priority shots. After returning from Priority, activate **Use fast-create brief** with Shift+Tab and Enter; do not load it before navigating away because this page-local state does not survive Guide → Priority → Guide.
- Side-panel instruction: `Follow the brief on this page.` The side-panel agent reads the selected brief and executes the page's WebMCP tools; it must stop without Save or Start.
- Park the pointer in the bottom-right corner before T0 and leave it there for the entire clip.
- Disable unrelated notifications. Keep the URL, keyboard focus rings, activity receipts, denominators, and human-authority copy readable.

## Browser-control ownership

- Tab control observes—but does not override—the native Edge viewport and owns the monotonic timeline, route navigation, fixed holds, DOM checkpoints, focus checks, and abort decision.
- Every timed route change—including Guide → Work → Review → Next → Work—uses real Tab or Shift+Tab focus movement to an existing visible link, followed by Enter.
- Vertical reveals use keyboard PageDown only. Guide sends PageDown to the page body so the scroll has one deterministic owner; Next keeps PageDown on its focused receipt. The pointer stays parked; do not use the wheel or drag a scrollbar.
- Visible focus is required when each WebMCP receipt first appears. PageDown may then transfer focus to the page while scrolling; acceptance depends on the named receipt and controls remaining simultaneously visible, not on claiming the receipt retained focus after the scroll.
- Do not click route links, use full-document `goto`, address-bar navigation, browser Back, pointer activation, retry a transition, or extend a hold to hide late execution.
- The side-panel agent owns every WebMCP call. Tab control never substitutes a direct workspace API, server request, or second mutation path.
- Record a four-second setup pad on the settled landing hero. Remove only that setup pad afterward; all timestamps below are final-video timestamps after the trim.

## Keyboard preflight

Complete this exact path once immediately before recording. Any mismatch cancels the take.

1. Landing → Guide: press Tab on the page body to reclaim focus, then advance visibly with Tab until **Open the handoff workflow** receives focus. Require the target within five additional moves, then press Enter.
2. Guide → Priority: four Tab presses, then Enter.
3. Priority → Guide: three Tab presses, then Enter.
4. Returned Guide → fast brief: five Shift+Tab presses, then Enter on **Use fast-create brief**.
5. Fast brief → Work: press Tab once on the page body to reclaim page focus from the completed reader, then advance visibly with Tab until **1 Work** receives focus. Require the target within five moves and press Enter; fail if focus reaches a later route first.
6. Work receipt → Review: seven Shift+Tab presses, then Enter on **Review in queue**.
7. Review receipt → Next: one Shift+Tab press, then Enter on **3 Next**.
8. Prepared Next receipt → Work: four Shift+Tab presses, then Enter on **1 Work**.
9. Work Draft receipt → pending decision: nine Shift+Tab presses, then Enter on **Pending 1**.
10. Guide: the upper view must first show the counted scope; one PageDown pressed on the page body must then reveal the complete brief and fast-brief control.
11. Next: two PageDown presses must keep the WebMCP receipt visible while bringing **Discard draft** and **Approve and save** fully into view.
12. Confirm **Reader API detected**, exact 8-item state, visible focus at every destination, and no browser error or warning.
13. Confirm the shared rail advances exactly 1 → 2 → 3 → 5 steps across Work, Review, Next, and Draft creation while agent authority stays `0 saved · 0 started`.

Use a fixed **2.25-second settle window** after every route activation. Abort instead of retrying, double-activating, clicking, or relaxing a checkpoint.

## One continuous Edge clip — 00:00–01:50

| Final time | Keyboard/WebMCP action | Required visible checkpoint | Narration track |
| --- | --- | --- | --- |
| 00:00–00:06 | Hold the canonical landing hero. | `Let an agent find the next move. Keep the final say.`; 9 tools; 4 bounded actions; No automatic starts. | “Projects gives a browser agent bounded access to visible work while the person keeps the final say.” |
| 00:06–00:18 | Tab to Guide, show the clean 0-of-5 rail and upper scope, then press PageDown on the page body at 00:12. | Guide ready by 00:08.25; 8 visible of 8; rail says `0 saved · 0 started`; lower view shows the complete brief and fast-create control. | “The shared handoff rail will preserve each verified step across the workflow.” |
| 00:18–00:25 | Tab to Priority and hold the single recommendation. | Priority ready by 00:20.25; one exact title, reason, and Next destination. | “Priority contributes one read-only recommendation—nothing more.” |
| 00:25–00:30 | Tab back to Guide, activate **Use fast-create brief**, and let the side-panel reader inspect it. | Guide ready by 00:27.25; fast brief selected only now; workspace remains 8. | “The page-owned brief permits Draft staging but still forbids Save and Start.” |
| 00:30–00:46 | Tab to Work; read the 8-item view and show `Garage reset`. | Larger Step 1 `WebMCP · show_work_search` receipt; 4 matching of 8; 2 blocked; rail advances to 1 of 5; agent authority remains 0 saved / 0 started. | “Work narrows the visible list and records the first verified step.” |
| 00:46–01:00 | Shift+Tab to Review and apply `Garage reset` + Blocked. | Larger Step 2 `WebMCP · set_review_scope` receipt; 2 shown, 2 filtered, 3 search matches, 5 total; rail retains Work and advances to 2 of 5. | “Review verifies the blocker evidence without changing workspace data.” |
| 01:00–01:18 | Shift+Tab to Next and prepare `Confirm storage bin delivery`; hold the receipt, then PageDown twice at 01:10. | Larger Step 3 `WebMCP · prepare_next_action` receipt; exact evidence; rail preserves all three stages; proposal remains Not saved and human approval is required. | “Next prepares an evidence-backed proposal and stops before Save.” |
| 01:18–01:26 | Use four Shift+Tab presses to return to Work and invoke `get_current_work_view` for the exact denominator. | Workspace is still 8; no work was started or saved. | “Before creation, the agent rereads the live workspace count.” |
| 01:26–01:36 | Invoke one `create_work_drafts` call and hold the Step 4 receipt. | `Confirm donation pickup window`, `Print shelf labels`, and `Prepare bike rack checklist`; `3 · Draft`; `8 → 11`; Human Start required; rail points to Human decision; agent authority remains 0 saved / 0 started. | “One atomic call stages three Drafts. It cannot start them.” |
| 01:36–01:50 | Use nine Shift+Tab presses and Enter on **Pending 1**; hold the restored receipt, then PageDown twice at 01:43. | `Review the proposed next action`; rail remains 5 of 5; final viewport shows the preserved receipt, `Draft: pending approval`, `Workspace: unchanged`, `only you can approve Save`, and untouched **Discard draft** / **Approve and save**. | “The run ends where consequential work should end: with a person deciding.” |

Stop the recorder at 01:50 on the human approval frame. Do not activate **Approve and save**, **Start**, or **Discard** during capture.

## Abort conditions

Abort the take immediately if any of these occurs:

- A route misses its 2.25-second settle window or any section crosses its hard timestamp.
- The pointer leaves its corner, a route uses a click, or the expected Tab/Shift+Tab destination differs.
- A PageDown hides the required receipt, overshoots the named controls, or causes horizontal overflow.
- Guide does not begin at 8, the fast brief is loaded before the final Guide return, or the side-panel reader sees a different brief.
- Work, Review, or Next names a different item, fact, query, filter, or denominator than the visible receipt.
- Next Save or any Draft Start is activated.
- Draft creation does not reread workspace 8, creates anything other than the three exact titles, reports a partial batch, or performs a server write.
- The final Pending navigation does not restore the exact verified Next receipt, unchanged-workspace statement, and visible human Save/Discard controls.
- Focus is not visible at a required receipt or destination.
- A browser error, warning, CSP violation, duplicate tool, unexpected request, or horizontal overflow appears.

The video is accepted only when this one continuous Edge clip passes every checkpoint, ends no later than 02:00 on the human approval frame, and remains below the official three-minute limit after narration.

## Post-capture cleanup and edit

1. In the same Edge profile, use Guide **Reset live sample**; confirm the pending Next proposal and all three recording Drafts are absent, no Pending link remains, and the workspace is exactly 8.
2. Trim only the four-second setup pad. Do not add a route cut, speed up the clip, or remove an in-take pause.
3. Add narration and export MP4 with H.264 video and AAC audio on a 1920 × 1080, 30 fps canvas. Preserve the native Edge aspect ratio without cropping; letterbox when needed. Target approximately -16 LUFS integrated audio with a peak no higher than -1.5 dB.
4. Watch the complete export twice. Confirm intelligible audio, readable URL and receipts, no private tabs or notifications, and a final duration below three minutes before public YouTube upload.
