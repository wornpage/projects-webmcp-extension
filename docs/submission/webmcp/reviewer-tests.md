# Reviewer test plan

Run these checks in the ChatGPT/Codex in-app browser or Chrome with WebMCP testing enabled.

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

That baseline preceded the final hosted check. The current public result is recorded below.

## Podium-pass verification — August 26, 2026

Verified at `2026-08-26T18:51:22-04:00` from source `c88575e0cfd9b24a4de3c958adc8bbeb70e6f9dc`. The main product pass is `fb2e7366f30e06683a8649e63472350ed3fdbf19`; `c88575e` is the narrow deterministic-Work follow-up.

Public judge URL: <https://projects-webmcp-extension.pages.dev/webmcp-challenge>

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
| Next | Started with exact custom action `Clear the garage floor`; prepared `Confirm storage bin delivery` with the visible evidence note; receipt reported `workspaceChanged: false` and `requiresHumanSave: true`; exact repeat returned `changed: false`; reload discarded the proposal |
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
| Guide | 1/1 | 1/1 | `get_webmcp_challenge_guide` |
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
| Next authority | 1/1 current-editor read preserved `Clear the garage floor`; preparation reported `workspaceChanged: false` and `requiresHumanSave: true`; 1/1 exact repeat returned `changed: false`; 1/1 reload discarded the proposal and note. |
| Clone-safe results | All 7/7 unique route tools returned through the browser WebMCP boundary without a serialization failure. |
| Request ledger | 79/79 requests used `http://127.0.0.1:5197`; 0/79 targeted `/api/`; 0/79 used an external origin; 0 browser errors or warnings were observed. |

Supported-client denominator: 1 tested / 1 supported. Independent Chrome-family denominator: 0 observable / 3 attempted paths (connected Chrome, local Chrome, installed Edge). The independent denominator is deliberately not combined with the in-app browser pass and does not imply Chrome WebMCP support.

## Current merged reviewer-readiness state — August 26, 2026

This record follows the merged reviewer-readiness work at `0284712edfd08d3f5cf02b9d76ac11b3d1297075`. It supersedes the current-source counts in the earlier dated records without rewriting their historical observations.

| Gate | Current result |
| --- | --- |
| Public source boundary | 77 tracked public paths after removing the inactive GitHub Actions workflow; no replacement CI or compatibility path remains. |
| Local automated gate | `npm run verify` passed with 0 Svelte errors, 0 warnings, 25 WebMCP contracts, 4 static-artifact contracts, and a completed static build. |
| Focused arrival state | `/work?focus=garage-reset-sort-shelves` focuses and centers the matching card, applies a selected-surface wash, accent rail, 4px ring, and `Focused item` label for 4.2 seconds, then removes the arrival treatment while visible keyboard focus remains. |
| Hosted status | No post-merge Pages deployment was performed; the protected production URL is not presented as a verification result for this source. |

## Browser-agent path

1. Open `/webmcp-challenge`.
   - Discover `get_webmcp_challenge_guide`.
   - Confirm its result matches the visible three-step prompt and safety copy.
2. Open `/work`.
   - Discover `get_current_work_view` and `show_work_search` only.
   - Read the view; verify workspace, matching, shown, and remaining denominators are explicit.
   - Set search to `Garage reset`; verify the visible page, returned projection, and page receipt agree while preserving the full workspace denominator.
3. Open `/review`.
   - Discover `get_current_review_queue` and `set_review_scope` only.
   - Apply query `Garage reset` and the blocked scope; verify total and filtered denominators remain distinct.
   - Verify each returned `attentionReasons` entry is rendered verbatim beside the corresponding item.
4. Open `/next`.
   - Discover `get_current_next_editor` and `prepare_next_action` only.
   - Open `?pack=garage-reset-sort-shelves` and confirm the exact stored action `Clear the garage floor` is not collapsed to a generic command.
   - Prepare `Confirm storage bin delivery` with an evidence note explaining that the floor is already done and the bins remain the blocker.
   - Verify the visible receipt says no workspace data was saved and requires a human Save.
   - Repeat the exact call and verify `changed` is `false`; reload or choose Discard and verify the proposal and note were not persisted.
5. Navigate between routes.
   - Verify tools from the previous page are aborted and no longer active.
   - Verify ordinary page use still works when `document.modelContext` is unavailable.

## Security and scope checks

- Network activity contains static GET requests only during WebMCP operations.
- No `/api`, authentication, billing, account, or production-domain request is made.
- No secret, customer record, or private workspace data appears in source or rendered output.
- Unknown routes use the bounded challenge 404 page.
