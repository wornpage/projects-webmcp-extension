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

These results describe the local candidate. The hosted judging URL must be checked again after the final deployment is unlocked.

## Browser-agent path

1. Open `/webmcp-challenge`.
   - Discover `get_webmcp_challenge_guide`.
   - Confirm its result matches the visible three-step prompt and safety copy.
2. Open `/work`.
   - Discover `get_current_work_view` and `show_work_search` only.
   - Read the view; verify workspace, matching, shown, and remaining denominators are explicit.
   - Set a search and verify the visible page and returned projection agree.
3. Open `/review`.
   - Discover `get_current_review_queue` and `set_review_scope` only.
   - Apply the blocked scope; verify total and filtered denominators remain distinct.
4. Open `/next`.
   - Discover `get_current_next_editor` and `prepare_next_action` only.
   - Prepare a different valid choice; verify the visible preview changes.
   - Reload and verify the prepared choice was not persisted.
5. Navigate between routes.
   - Verify tools from the previous page are aborted and no longer active.
   - Verify ordinary page use still works when `document.modelContext` is unavailable.

## Security and scope checks

- Network activity contains static GET requests only during WebMCP operations.
- No `/api`, authentication, billing, account, or production-domain request is made.
- No secret, customer record, or private workspace data appears in source or rendered output.
- Unknown routes use the bounded challenge 404 page.
