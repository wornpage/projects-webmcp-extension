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
| GitHub verification | Run `33020885056` completed successfully for exact source `c88575e0cfd9b24a4de3c958adc8bbeb70e6f9dc` |
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
