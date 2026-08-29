# Reviewer test plan

Run these checks in the ChatGPT or Codex in-app browser, the demonstrated WebMCP client path for this edition.

## Automated gate

```sh
npm ci --ignore-scripts
npm --prefix svelte-frontend ci --ignore-scripts
npm run verify
```

Expected: zero Svelte errors and warnings, all focused contracts pass, and `dist/static-publish` contains the prerendered challenge.

## Local verification record — August 26, 2026

Source baseline: `57d0fe1de5c3ef8d1d22a38cf363394968f0870c`, committed at `2026-08-26T17:31:15-04:00` with the message `Create minimal static WebMCP challenge edition`.

| Gate | Result |
| --- | --- |
| Clean dependency install | Root and frontend installs completed with 0 reported vulnerabilities |
| Svelte diagnostics | 0 errors, 0 warnings |
| Focused WebMCP contracts | 21 passed, 0 failed |
| Static artifact contracts | 4 passed, 0 failed |
| Production build | Completed; final artifact contains static files only and no `_worker.js` or Functions directory |
| Codex in-app browser | Exact tool catalog discovered on all four routes; no console errors or warnings |
| 390px responsive check | No horizontal document overflow on Work, Review, or Next |
| Previously clipped title | `Garage reset: clear the floor` rendered in a full 18.2px line box with visible overflow |
| Reversibility | Work search and Review scope matched their visible pages; prepared Next choice reverted after reload |

That baseline preceded the dated hosted pass recorded below. This historical record does not establish current submission accessibility.

## Podium-pass verification — August 26, 2026

Verified at `2026-08-26T18:51:22-04:00` from source `c88575e0cfd9b24a4de3c958adc8bbeb70e6f9dc`. The main product pass is `fb2e7366f30e06683a8649e63472350ed3fdbf19`; `c88575e` is the narrow deterministic-Work follow-up.

Public judge URL (no account required): <https://projects-webmcp-extension.pages.dev/webmcp-challenge>

| Gate | Exact result |
| --- | --- |
| Source boundary | Public manifest matched exactly 76 files; four Svelte app routes plus the landing artifact; no Worker, Pages Function, backend, auth, billing, secret, or production-domain fallback |
| Automated gate | Svelte 0 errors/0 warnings; WebMCP 21 passed/0 failed; static artifact 4 passed/0 failed; production static build accepted |
| Historical GitHub verification | Run `33020885056` completed successfully for exact source `c88575e0cfd9b24a4de3c958adc8bbeb70e6f9dc`; it is retained as dated evidence, not a claim about the current tree. |
| Cloudflare production | Deployment `ffd5ac2b` recorded branch `main`, source `c88575e`, and Production environment |
| Tool inventory | 7 total: Guide 1; Work 2; Review 2; Next 2; route navigation invalidated the prior page catalog |
| Guide | Exact rendered projection returned 3 steps, 3 authority statements, and the `Confirm storage bin delivery` prompt |
| Work | Started 8 shown/8 matching/8 workspace/3 blocked; `Garage reset` returned 4 shown/4 matching/8 workspace/2 blocked, including `Garage reset: clear the floor` with workflow `Done` |
| Review | Started 5 shown/5 filtered/5 total review/3 blocked; blocked `Garage reset` scope returned 2 shown/2 filtered/3 search matches/5 total review/2 blocked and the visible reason `Blocked: Waiting on storage bins.` |
| Next | Started with exact custom action `Clear the garage floor`; prepared `Confirm storage bin delivery` with the visible evidence note; receipt reported `workspaceChanged: false` and `requiresHumanSave: true`; exact repeat returned `changed: false`; reload retained the pending approval and the shared navigation showed its exact resume count |
| Receipt truthfulness | Work and Review receipts each measured 1 immediately after their tool action and 0 after a later human search edit made the receipt stale |
| Focus | Work result, Review result, and Next receipt were all the active `:focus-visible` destination and fully in viewport; Next focus contrast measured 15.76:1 |
| 390 × 844 dark matrix | Guide, Work, Review, and Next each applied `rgb(15, 23, 20)` body background with one navigation row and no horizontal overflow; landing also had no horizontal overflow |
| Public request ledger | 79/79 captured requests used `https://projects-webmcp-extension.pages.dev`; 0 `/api/` requests; 0 external requests; 0 browser errors or warnings |
| Human authority | No tool called Save or wrote workspace data; `Approve and save` remained the only consequential boundary and was not invoked during verification |

## Natural-prompt discovery recheck — August 26, 2026

### Browser-observed evidence

Observed in the Codex in-app browser against the local Vite server at `http://127.0.0.1:5197` from source `80f9804b265d48eb7829e0ac35bc4239556f5fa6`. This is browser evidence from the assigned worktree, not a hosted-access or automated-contract result.

For each verbatim prompt below, the browser agent used only the current route catalog; the prompt itself did not contain a registered tool name. A pass required the catalog to supply the matching page capability, the returned projection to agree with the rendered page, and any page-local action to leave a visible receipt without saving workspace data.

| # | Route | Natural prompt (verbatim; tool-name-free) | Browser-observed result |
| --- | --- | --- | --- |
| 1 | Guide | What does this demo recommend I do, and which decisions stay mine? | Returned 3/3 guide steps and 3/3 authority statements; approval, saving, and discard stayed person-owned. |
| 2 | Work | How much work is visible right now, what is blocked, and what remains outside the visible page? | Returned 8 shown / 8 matching / 8 workspace / 0 remaining, with 3 blocked. |
| 3 | Work | Show only the Garage reset work and keep the full workspace denominator visible. | Returned 4 shown / 4 matching / 8 workspace / 0 remaining, with 2 blocked; the visible receipt repeated `4 shown of 4 matching · 8 workspace` and `Workspace data: Unchanged`. |
| 4 | Review | What currently needs attention in Review, and what are the total, filtered, shown, and remaining counts? | Returned 5 total review / 5 filtered / 5 shown / 0 remaining, with 3 blocked. |
| 5 | Review | Narrow Review to blocked Garage reset items and tell me why each one needs attention. | Returned 2 shown / 2 filtered / 3 search matches / 5 total review / 0 remaining, with 2 blocked; visible reasons were `Waiting on storage bins` and `Donation center pickup is not confirmed`, and the receipt said workspace data was unchanged. |
| 6 | Next | For Garage reset: sort shelves, what is currently in the next-action editor and what blocker is visible? | Returned custom action `Clear the garage floor`, blocker `Waiting on storage bins`, and no preparation receipt. |
| 7 | Next | Prepare “Confirm storage bin delivery” for my review, with a short note that the floor is already done and shelf sorting still waits on storage bins. Stop before saving. | Returned `changed: true`, `workspaceChanged: false`, and `requiresHumanSave: true`; the visible receipt repeated the action and note and ended with `Authority: Awaiting your Save`. |

| Route | Passed | Prompt denominator |
| --- | ---: | ---: |
| Guide | 1 | 1 |
| Work | 2 | 2 |
| Review | 2 | 2 |
| Next | 2 | 2 |
| **Total** | **7** | **7** |

Result: 7/7 natural prompts passed; 0/7 prompts contained a registered tool name.

### Automated contract evidence

The automated contracts are a separate denominator and are not counted as natural-prompt passes. `npm run test:webmcp` reported 24 passed / 24 total / 0 failed after the focused manifest rework. Its manifest fixture checks every reserved root entry once as a file and once as a directory, keeps all seven same-named nested source files in the exact manifest, and confirms that adding one legitimate source file makes the stale-manifest gate fail in both fixture shapes.

## Merged-main cold-start portability recheck — August 26, 2026

This recheck started from clean merged source `ba7efb131448b9f24f178a36ba9c897ce576f257`. It is the current cold-start record; the earlier records above remain dated historical evidence rather than claims about the present source tree.

The root and frontend locked installs completed from empty dependency directories with 0 reported vulnerabilities. `npm run verify` then matched 78/78 public source files, reported 0 Svelte errors and 0 warnings, passed 24/24 WebMCP contracts and 4/4 static-artifact contracts, and completed the production prerender. The built artifact was served with `npm --prefix svelte-frontend run preview -- --host 127.0.0.1 --port 5197` before any browser check.

| Client path | Tested | Supported | Exact result |
| --- | ---: | ---: | --- |
| Codex in-app browser | 1/1 | 1/1 | All four direct routes loaded and exposed their route-scoped WebMCP catalogs. |
| Connected Chrome extension | 0/1 | 0/1 | Unavailable in this environment; no Chrome WebMCP execution is claimed. |
| Independent Playwright Chrome | 0/1 | 0/1 | Chrome was not installed at the expected local channel; no execution is claimed. |
| Independent installed Edge (Chromium) | 0/1 | 0/1 observable runs | The browser process exited before a page session became observable; this is recorded as unavailable, not as a product pass or failure. |
| No-WebMCP registration path | 1/1 contract | 1/1 | The ordinary page path returned without inspecting tool descriptors; browser-level comparison was unavailable because neither independent Chromium path produced an observable session. |

| Route | Direct loads | Catalog tools | Exact observed catalog |
| --- | ---: | ---: | --- |
| Guide | 1/1 | 1/1 | `get_projects_handoff_guide` |
| Work | 1/1 | 2/2 | `get_current_work_view`, `show_work_search` |
| Review | 1/1 | 2/2 | `get_current_review_queue`, `set_review_scope` |
| Next | 1/1 | 2/2 | `get_current_next_editor`, `prepare_next_action` |
| **Total** | **4/4** | **7/7** | No cross-route or extra tools were present. |

| Behavior | Exact observed result |
| --- | --- |
| Registration teardown | 1/1 prior-route handle rejected after navigation as stale; registration contracts passed 6/6, including synchronous and asynchronous mixed-failure aborts. |
| Tool aborts | 7/7 route tools retain an explicit already-aborted execution contract in the 24/24 focused gate. |
| Work scope | 8 shown / 8 matching / 8 workspace / 3 blocked became 4 shown / 4 matching / 8 workspace / 2 blocked for `Garage reset`. |
| Review scope | 5 total review / 5 filtered / 5 shown / 3 blocked became 5 total review / 3 search matches / 2 filtered / 2 shown / 2 blocked. |
| Visible focus | Work result, Review result, and Next receipt passed 3/3 active-focus, `:focus-visible`, and in-viewport checks. |
| Reduced motion | 1/1 emulated reduced-motion Work action retained verified visible focus with the reduced-motion media query active. |
| Next authority | 1/1 current-editor read preserved `Clear the garage floor`; preparation reported `workspaceChanged: false` and `requiresHumanSave: true`; 1/1 exact repeat returned `changed: false`; 1/1 reload retained the proposal and note as a pending approval. |
| Clone-safe results | All 7/7 unique route tools returned through the browser WebMCP boundary without a serialization failure. |
| Request ledger | 79/79 requests used `http://127.0.0.1:5197`; 0/79 targeted `/api/`; 0/79 used an external origin; 0 browser errors or warnings were observed. |

Supported-client denominator: 1 tested / 1 supported. Independent Chrome-family denominator: 0 observable / 3 attempted paths (connected Chrome, local Chrome, installed Edge). The independent denominator is deliberately not combined with the in-app browser pass and does not imply Chrome WebMCP support.

## Current assigned-worktree reviewer-readiness state — August 28, 2026

This record covers the discoverable Guide scope rework on top of the earlier reviewer-readiness work. It supersedes the current-source counts in the earlier dated records without rewriting their historical observations.

| Gate | Current result |
| --- | --- |
| Public source boundary | 84 tracked public paths, including the route-owned editable Guide brief, scope chooser, Work action mapping, and verified Next evidence contract; no replacement CI or compatibility path remains. |
| Local automated gate | `npm run verify` passes with 84 tracked public paths, 0 Svelte errors, 0 warnings, 62/62 WebMCP contracts, 6/6 static-artifact contracts, and a completed static build. The earlier 47-contract denominator is superseded, not combined with this one. |
| Guide default | `All visible work` is selected immediately and exposes `Open all 8 work items` to `/work` in the current sample. |
| Discovered choices | The current sample renders `Household · 4` and `Research · 4` from observed area data and Work's shared search counter; these names are not fixed chooser behavior. |
| Custom truth | Custom keeps the shared 120-character/control-character validation; an unmatched term projects 0 matching of 8 workspace and exposes disabled `No work matches`, without a fallback Work link or invented work. |
| Focused arrival state | `/work?focus=garage-reset-sort-shelves` focuses and centers the matching card, applies a selected-surface wash, accent rail, 4px ring, and `Focused item` label for 4.2 seconds, then removes the arrival treatment while visible keyboard focus remains. |
| Action accountability | Work and Review getters leave no agent-change receipt. Successful scope presenters show the normalized visible scope and exact live denominators. Next accepts 1–3 exact Work or Review field/value references, requires one for the current item, rejects stale or mismatched facts, and generates its visible evidence note from the verified values. The draft remains unsaved and Save stays human-owned. Human edits or route teardown clear the affected attribution. |
| Verified Next evidence | Bare `/next` resumes the visible work item's human draft without agent provenance; a differing-choice WebMCP takeover presents Focus, rolls back exactly to the human draft on failure, and retains the WebMCP draft after success. Reload retains pending drafts, Discard restores the saved editor baseline without workspace writes, and approval atomically updates the target workspace item and consumes its draft. |

## Priority read-only checkpoint — August 29, 2026

This local checkpoint starts from merged source `b6d79be54124c8a94479023cf5369c3c9e5ca90e` on `newwork/priority-next-recommendation`. It is not a hosted-access claim. **Priority** is the competition-facing name and has one canonical `/priority` route; no prior route alias is retained.

| Gate | Exact result |
| --- | --- |
| Public source boundary | Manifest matched 87/87 paths; the artifact contains `priority.html`, while the retired route name remains in the forbidden-route contract only. |
| Automated gate | `npm run verify` passed: 0 Svelte errors, 0 warnings, 65/65 WebMCP contracts, 6/6 static-artifact contracts, and a completed static build. The focused Priority subset passed 3/3. |
| Visible projection | Priority rendered one recommendation with 4/4 fields: id `garden-study-log-interviews`, title `Garden study: log interviews`, href `/next?pack=garden-study-log-interviews`, and reason `Due in 6 days · No blocker or pending decision.` |
| Tool parity | The route catalog contained exactly 1/1 tool, `get_next_recommendation`. Its returned 4/4 fields matched the visible projection exactly, and the page URL was unchanged after invocation. |
| Read-only authority | The descriptor is closed and declares `readOnlyHint: true`, `openWorldHint: false`, and `untrustedContentHint: true`. Focused source contracts reject navigation, fetch, storage, and workspace mutation paths; the browser invocation used no write-capable operation. |
| Empty and unsupported fallback | With page scripts disabled, 1/1 direct `/priority` render showed `No actionable recommendation`, retained ordinary Guide/Priority/Work/Review/Next links, and exposed 0 WebMCP tools. |
| Lifecycle teardown | After navigation, the prior Priority handle failed as stale and `get_next_recommendation` was absent from the destination route catalog. |
| Responsive themes | At 390 × 844 with the single dark theme and reduced motion, document width was exactly 390px, horizontal overflow was false, all 5 nav links occupied 1 grid row, the recommendation stayed contained, and route animation was `none`. At 1280 × 720 in light mode, horizontal overflow was false and the 760px recommendation remained contained. |
| Browser console | 0 warnings and 0 errors on a fresh direct Priority load. |

## Priority single-destination focus — August 29, 2026

This local follow-up keeps Priority's visible and WebMCP projection unchanged while removing redundant navigation semantics from the recommendation card. It does not change selection, page registration, data, storage, or Wornpage.

| Gate | Exact result |
| --- | --- |
| Before baseline | The recommendation card exposed 3 links to the identical Next URL: its title, the literal Destination value, and `Open next action`. Under compact coarse-pointer emulation, the standalone Destination link was 288.2 × 21.5px. |
| One explicit action | The title and Destination remain visible text, while `Open next action` is the sole linked control. A red-first contract observed 3 destination bindings before the change and now requires exactly 1 plus all four visible projection fields. |
| Focused and full gates | Priority passed 3/3 focused contracts. `npm run verify` passed: manifest 87/87, Svelte 0 errors and 0 warnings, WebMCP 66/66, static artifacts 6/6, and a completed production build. |
| Compact rendered result | At 390 × 844 in dark mode with reduced motion and a coarse pointer, the card exposed exactly 1 link, `Open next action`, at 156.3 × 44px. Its real focus-visible state used a dashed 1.74px outline; route animation was `none` and horizontal overflow was false. |
| Rendered/tool parity | Title, reason, id, and href remained visible and matched the `get_next_recommendation` result exactly 4/4. Calling the getter did not change the URL. |
| Wide rendered result | At 1280 × 720 in forced light mode, the 759.9px card retained exactly 1 destination control at 147.5 × 36px with no horizontal overflow. |
| Lifecycle and fallback | Navigating to Work made the prior Priority handle fail as stale and exposed only Work's two page tools. With scripts disabled, Priority retained its empty explanation, `Open Work`, all five workflow links, no recommendation card, and 0 WebMCP tools. |
| Ownership and console | Route-specific composition stayed in Projects; no Wornpage extraction or compatibility path was added. Browser console remained at 0 warnings and 0 errors, and validation performed no workspace write or network mutation. |

## Work Quick Add density and compact parity — August 29, 2026

This local checkpoint keeps Quick Add on Work's existing `createPack` path. It makes the form density-independent and adds one optional, human-owned proof-target disclosure without adding storage, requests, or a WebMCP write operation.

| Gate | Exact result |
| --- | --- |
| Before baseline | Cards rendered 0 Quick Add forms while Grid rendered 1. At a requested 390 × 844 compact viewport (375px document client width), the form remained in the DOM but computed to `display: none`; the form, input, and button were all 0 × 0. The workspace stayed at `8 shown · 8 matching · 8 workspace · 3 blocked`. |
| One active path | The route now renders exactly 1 density-independent form before the repeated density panels. Its submit handler trims both values and calls the one canonical `createPack` owner with `doneWhen`; the focused contract rejects direct storage, state-save, and fetch paths. No Wornpage extraction was warranted for this route-specific composition. |
| Optional proof target | A native `details` disclosure labels the field `Proof target · Optional`, bounds it to 1,000 characters, and keeps the title-only path valid. Both fields reset after a successful create. Priority remains a separate read-only projection. |
| Focused contract | `node --test tests/work-webmcp-page-contract.test.mjs` passed 11/11, including form cardinality, density independence, compact availability, proof-target bounds, field reset, and canonical create-path assertions. |
| Automated gate | `npm run verify` passed: manifest 87/87, Svelte 0 errors and 0 warnings, WebMCP 67/67, static artifacts 6/6, and a completed production build. |
| Compact Cards | With dark color scheme, reduced motion, and coarse pointer enabled, Cards rendered exactly 1 form at 359.3 × 44px. Its 16px input was 307.1 × 44px and Add was 44.2 × 44px. Document width and scroll width were both 375px, horizontal overflow was false, and route animation was `none`. |
| Compact Grid | Switching to Grid retained exactly 1 form with the same dimensions and no horizontal overflow. Returning to Cards and collapsing filters left the input keyboard-focusable; the active element was `Quick-add a work item`, its value remained empty, and the workspace denominator stayed 8/8. |
| Wide and theme parity | At 1265 × 720, Cards and Grid each rendered exactly 1 visible 1176px-wide form with no horizontal overflow. Forced light mode rendered the light surface and retained the form; the default dark surface also retained it. |
| Rendered proof flow | In the production preview, opening the disclosure exposed one focusable proof-target textbox. Submitting title `Release proof target check` with proof `A reviewer can open the published proof note.` produced one success receipt, increased every honest workspace denominator from 8 to 9, rendered one new Work item, and cleared both inputs. The visible Guide reset restored the bundled 8-item sample afterward. |
| WebMCP boundary | The live Work catalog remained exactly `get_current_work_view` and `show_work_search`; no create tool was registered. Only the explicit human Add submission changed browser-local workspace state; tool discovery and inspection performed no workspace write, navigation, or network mutation. |
| Browser console | 0 warnings and 0 errors across the fresh production-preview acceptance. |
| Remaining boundary | Quick Add is intentionally human-owned browser-local demo state. Exposing creation as a WebMCP write remains a separate authority decision and is not implied by the optional proof target. |

## Work Recent activity heading hierarchy — August 29, 2026

This local checkpoint corrects the expanded Recent activity outline through Worn Timeline's existing public API. It changes no activity data, disclosure behavior, navigation, storage, or WebMCP operation.

| Gate | Exact result |
| --- | --- |
| Before baseline | With Recent activity expanded, the accessibility tree moved from Work's level-1 heading directly to 6 timeline entry headings at level 3. The accordion summary is a native disclosure control, not a level-2 heading. |
| Ownership decision | Work already supplied Worn Timeline's public `headingLevel` prop, so the route changed that value from 3 to 2. `@wornpage/data-display` remains unmodified; its installed source-delivery v2 package explicitly supports levels 2–6 and passed its complete 20/20 package contract. |
| Red-first contract | The new Work assertion failed with 10/11 passing while the route still supplied level 3, then passed 11/11 after the one-line correction. |
| Automated gate | `npm run verify` passed: manifest 87/87, Svelte 0 errors and 0 warnings, WebMCP 67/67, static artifacts 6/6, and a completed production build. |
| Compact rendered result | At a requested 390 × 844 compact viewport (375px document width) in dark mode with reduced motion and a coarse pointer, the expanded tree exposed exactly 6 level-2 and 0 level-3 entries. Cards and Grid retained the same six levels, no horizontal overflow, and `8 shown · 8 matching · 8 workspace · 3 blocked`. The disclosure was 359.3 × 44px and activity links were at least 65.1px tall. |
| Wide rendered result | At 1265 × 720 in forced light mode, the expanded timeline retained exactly 6 level-2 entries, no horizontal overflow, and the same 8/8 denominator. The disclosure was 1176 × 44px with a dashed 1.74px focus-visible outline; activity links were at least 48.1px tall. |
| WebMCP and console | Work's page catalog remained exactly `get_current_work_view` and `show_work_search`. Browser console remained at 0 warnings and 0 errors, and validation performed no workspace write or network mutation. |

## Browser-agent path

1. Open `/webmcp-challenge`.
   - Keep **All visible work** selected. It is the default and exposes **Open all 8 work items** to `/work`; no taxonomy knowledge or editing is needed.
   - Ask the browser agent: `Follow the brief on this page.` Verify the returned projection contains the exact default `agentBrief`, empty `workQuery`, selected All scope, 8 matching, and 8 workspace for the current sample.
   - Choose one displayed alternative. In the current sample, the observed data-backed choices are `Household · 4` and `Research · 4`; verify the selected label, deterministic query, 4 matching, and 8 workspace agree in the visible Guide and tool result.
   - Choose **Research** and verify **Open 4 Research items** leads to `/work?search=Research`, where Work immediately shows 4 matching of 8. Choose **Custom**, enter `Definitely absent work term`, and verify disabled **No work matches** replaces the link; then ask `Follow the brief on this page.` Verify the Guide returns the exact normalized query with 0 matching of 8 workspace and Work reports 0 matching and 0 shown, preserves the full denominator, and invents no result.
   - Expand **Authority and browser status** only when needed. `Reader API detected` means this browser exposes the API; it is deliberately not a registration-success claim. The Guide reader cannot navigate, save, or change workspace data.
   - If it says `Reader API unavailable`, use Copy brief and follow the three visible buttons. A nonempty derived or Custom scope must remain in the copied instructions.
   - In a compatible browser, discover `get_projects_handoff_guide`.
   - Confirm its result matches the visible three-step workflow, safety copy, current editable brief, every displayed scope choice and count, the selected query, and the workspace denominator.
2. Open `/priority`.
   - Discover `get_next_recommendation` only.
   - Verify its id, title, href, and reason match the single visible recommendation exactly, and that invoking it neither navigates nor changes workspace data.
   - If no item is actionable, verify the visible empty state and a `null` result instead of an invented recommendation.
3. Open `/work`.
   - Discover `get_current_work_view` and `show_work_search` only.
   - Read the view; verify workspace, matching, shown, and remaining denominators are explicit and that the getter does not create an agent-change receipt.
   - Set search to `  Garage reset  `; verify the visible query and receipt use normalized `Garage reset`, report exact shown/matching/workspace denominators, identify only the visible Work search as changed, and state `Workspace data: Unchanged`.
   - Change the search as a person; verify the now-stale agent attribution clears.
4. Open `/review`.
   - Discover `get_current_review_queue` and `set_review_scope` only.
   - Read the queue and verify the getter does not create an agent-change receipt.
   - Apply query `Garage reset` and the blocked scope; verify shown, filtered, search-match, and total-review denominators remain distinct in both the returned projection and visible receipt, alongside the current blocked/missing-next/missing-owner evidence counts.
   - Verify each returned `attentionReasons` entry is rendered verbatim beside the corresponding item.
   - Change either human filter; verify the stale agent attribution clears.
5. Open `/next`.
   - Discover `get_current_next_editor` and `prepare_next_action` only.
   - Open `?pack=garage-reset-sort-shelves`, read the editor without creating a receipt, and confirm the exact stored action `Clear the garage floor` is not collapsed to a generic command.
   - Prepare `Confirm storage bin delivery` with two structured facts already returned by Work or Review: `{ workId: "garage-reset-sort-shelves", field: "blocker", expectedValue: "Waiting on storage bins" }` and `{ workId: "garage-reset-clear-floor", field: "workflow", expectedValue: "Done" }`.
   - Verify the visible receipt identifies an unsaved browser-agent draft and displays the page-generated note `Garage reset: sort shelves — Blocker: Waiting on storage bins. Garage reset: clear the floor — Workflow: Done.` Verify the returned receipt preserves both structured facts, says `workspaceChanged: false`, and says `requiresHumanSave: true`.
   - Retry with either expected value changed. Verify the tool rejects the stale evidence and preserves the prior valid draft.
   - Repeat the exact call and verify `changed` is `false`; reload and verify the pending count and resume link retain the proposal without changing workspace fields. Choose Discard and verify the draft clears without a workspace write.
6. Navigate between routes.
   - Verify tools from the previous page are aborted and no longer active.
   - Verify ordinary page use still works when `document.modelContext` is unavailable.

## Security and scope checks

- Network activity contains static GET requests only during WebMCP operations.
- No `/api`, authentication, billing, account, or production-domain request is made.
- No secret, customer record, or private workspace data appears in source or rendered output.
- Unknown routes use the bounded challenge 404 page.
