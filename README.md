# Wornpage Projects — WebMCP Challenge

A small, static edition of Wornpage Projects built for the 2026 WebMCP Challenge. People and browser agents operate the same visible Work, Review, and Next screens; the agent receives a bounded projection of what the person can already see.

Live submission: <https://projects-webmcp-extension.pages.dev/webmcp-challenge>

The submission URL is publicly accessible without an account. Deployment-specific preview URLs remain separate from this production judge path.

The deployment is intentionally static. It has no sign-in, payment flow, Worker Function, database, secret, or production API. Sample changes stay in this browser.

## Where this edition came from

Projects was not invented during the challenge. A private predecessor records
the earlier, human-operated workflow and broad application history. During the
submission period, that foundation was extended in this separate, sanitized
public repository with page-scoped WebMCP tools, a bounded four-route judge
experience, lifecycle and fallback contracts, and an independently buildable
static artifact.

The predecessor and current production application remain private because their
broader history and application logic are outside the submission boundary.
Neither is needed to build, run, or verify this submission. The exact boundary
between prior work and challenge-period work is recorded in
[SOURCE_PROVENANCE.md](SOURCE_PROVENANCE.md), alongside the dated commit history.

## Why WebMCP fits

Ordinary browser automation has to infer meaning from layout and scrape a page that was designed for people. This demo lets each page publish a small, explicit tool catalog instead:

| Page | Tool | Authority |
| --- | --- | --- |
| Guide | `get_webmcp_challenge_guide` | Read the visible judge path |
| Work | `get_current_work_view` | Read the bounded, filtered list and its denominators |
| Work | `show_work_search` | Change only the visible search scope |
| Review | `get_current_review_queue` | Read the bounded queue, denominators, and visible reasons each item surfaced |
| Review | `set_review_scope` | Change only the visible review filter and query |
| Next | `get_current_next_editor` | Read the visible next-action editor |
| Next | `prepare_next_action` | Prepare an unsaved choice and concise evidence note for the person to review |

The page owns registration and teardown through `document.modelContext.registerTool`. Every successful tool invocation leaves a polite, screen-reader-announced receipt naming the tool and what it read or prepared. Read receipts mark page presentation unchanged; reversible actions describe their page-local effect; all receipts report that saved workspace changes are `None`. Consequential saves remain visible, human-owned controls.

## WebMCP implementation

The challenge documentation's `search_products` descriptor illustrates the imperative API shape. Wornpage Projects registers project-specific tools instead. A minimal direct registration of the Guide reader has that same shape:

```js
const registrationController = new AbortController();

document.modelContext.registerTool({
	name: 'get_webmcp_challenge_guide',
	description: 'Read the exact public judge guide rendered on this page.',
	inputSchema: {
		type: 'object',
		properties: {},
		additionalProperties: false
	},
	execute: async () => readRenderedWebMcpChallengeGuide(document)
}, {
	signal: registrationController.signal
});
```

The shipped implementation adds exact-input rejection, validated current-page projections, truthful annotations, and complete descriptors in each route. It passes them to [`registerPageTools`](svelte-frontend/src/lib/webmcp.mjs), which performs this registration with one abort signal for the page-owned catalog. That lifecycle boundary removes the tools together when navigation leaves the page and aborts the catalog if any registration fails.

## Run locally

Requirements: Node.js 24.18.0 (pinned in `.node-version`).

```sh
npm ci --ignore-scripts
npm --prefix svelte-frontend ci --ignore-scripts
npm run verify
npm --prefix svelte-frontend run dev
```

Open the URL printed by Vite, then visit `/webmcp-challenge` in the ChatGPT or Codex in-app browser for WebMCP tool discovery. If WebMCP is unavailable, the ordinary page remains usable with browser-local sample data.

`npm run build` creates the complete static deployment in `dist/static-publish`. That directory can be uploaded directly to Cloudflare Pages; no Pages Functions or Worker are required.

For a Cloudflare Pages Git deployment, use:

| Setting | Value |
| --- | --- |
| Build command | `npm run build:pages` |
| Build output directory | `dist/static-publish` |
| Node version | Read from `.node-version` (`24.18.0`) |

The Pages build script performs the nested locked frontend install before building, so it does not depend on a pre-existing `node_modules` directory.

## Judge path

1. Open `/webmcp-challenge` and copy the deterministic judge prompt.
2. On `/work`, read the current view and show only `Garage reset` work. The receipt preserves the 8-item workspace denominator and says workspace data is unchanged.
3. On `/review`, set query `Garage reset` and filter `blocked`. The queue explains why each item surfaced using the same reasons returned to the agent.
4. On `/next?pack=garage-reset-sort-shelves`, read the exact current editor. It preserves the stored `Clear the garage floor` action even though the floor item is already done.
5. Prepare `Confirm storage bin delivery` with a concise evidence note. Review the unsaved receipt, then reload or choose Discard; no workspace value was saved.

## Repository boundary

This is a fresh, challenge-only public extraction—not the production repository or its history. It contains four Svelte routes, deterministic sample data, their required shared UI, route-owned WebMCP descriptors, focused contracts, and a static build. Production authentication, billing, storage, private content, MCP servers, Worker code, deployment credentials, and unrelated routes are absent.

See [SOURCE_PROVENANCE.md](SOURCE_PROVENANCE.md) for the required pre-existing-versus-new-work record and [docs/submission/webmcp/public-repository-boundary.md](docs/submission/webmcp/public-repository-boundary.md) for the exact publication policy.

| Directory | Why it is present |
| --- | --- |
| `svelte-frontend/src/routes/` | Guide, Work, Review, Next, their WebMCP descriptors, and the shared 404 shell |
| `svelte-frontend/src/lib/` | Browser-local state, visible work-item rules, and only the UI pieces those routes import |
| `assets/` and `data/` | Challenge styling, landing media, and synthetic sample work |
| `tests/` and `scripts/` | Focused WebMCP contracts and the reproducible static build |
| `docs/` and root policy files | Eligibility evidence, public boundary, security policy, licensing, and reviewer instructions |

There is no `server/`, `worker/`, Pages Functions, or hidden compatibility route in the source tree.

## Verification

```sh
npm run verify
```

The gate runs Svelte diagnostics, focused WebMCP contracts, static-artifact contracts, and a production prerender. Manual WebMCP checks are listed in [docs/submission/webmcp/reviewer-tests.md](docs/submission/webmcp/reviewer-tests.md).

## License and trademarks

Code is available under the [MIT License](LICENSE). MIT permits copying, modification, redistribution, sublicensing, and commercial use subject to its terms. Dependency licenses are summarized in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The Wornpage and Wornpage Projects names and marks are not licensed as product branding; see [TRADEMARKS.md](TRADEMARKS.md).
