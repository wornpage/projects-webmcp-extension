from __future__ import annotations

import re
from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    target = Path(path)
    source = target.read_text(encoding="utf-8")
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}")
    target.write_text(source.replace(before, after, 1), encoding="utf-8")


def replace_regex(path: str, pattern: str, replacement: str) -> None:
    target = Path(path)
    source = target.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}")
    target.write_text(updated, encoding="utf-8")


layout = "svelte-frontend/src/routes/+layout.svelte"

replace_once(
    layout,
    """\timport { WornButton } from '$lib/components';
\timport PendingApprovalsCenter from '$lib/PendingApprovalsCenter.svelte';

\ttype RouteItem = {
\t\thref: '/webmcp-challenge' | '/priority' | '/work' | '/review' | '/next';
\t\tlabel: string;
\t};

\tconst ROUTES: readonly RouteItem[] = [
\t\t{ href: '/webmcp-challenge', label: 'Guide' },
\t\t{ href: '/priority', label: 'Priority' },
\t\t{ href: '/work', label: '1 Work' },
\t\t{ href: '/review', label: '2 Review' },
\t\t{ href: '/next', label: '3 Next' }
\t];
""",
    """\timport { WornButton, WornDialog } from '$lib/components';
\timport PendingApprovalsCenter from '$lib/PendingApprovalsCenter.svelte';

\ttype RoutePath = '/webmcp-challenge' | '/priority' | '/work' | '/review' | '/next';
\ttype RouteItem = {
\t\thref: RoutePath;
\t\tlabel: string;
\t\tdescription?: string;
\t};

\tconst ROUTES: readonly RouteItem[] = [
\t\t{ href: '/work', label: 'Work' },
\t\t{ href: '/webmcp-challenge', label: 'Guide' },
\t\t{ href: '/priority', label: 'Priority', description: 'Standalone recommendation view' },
\t\t{ href: '/review', label: 'Review', description: 'Full evidence queue' },
\t\t{ href: '/next', label: 'Next', description: 'Full next-action editor' }
\t];
\tconst TOOL_ROUTES = ROUTES.filter((item) =>
\t\titem.href === '/priority' || item.href === '/review' || item.href === '/next'
\t);
"""
)

replace_once(
    layout,
    """\tlet pathname = $derived($page.url.pathname);
\tlet routeLabel = $derived(ROUTES.find((item) => item.href === pathname)?.label ?? 'WebMCP demo');
\tlet pendingApprovals = $derived(pendingNextActionDrafts($demoState));
""",
    """\tlet pathname = $derived($page.url.pathname);
\tlet routeLabel = $derived(ROUTES.find((item) => item.href === pathname)?.label ?? 'WebMCP demo');
\tlet activeToolRoute = $derived(TOOL_ROUTES.find((item) => item.href === pathname) ?? null);
\tlet pendingApprovals = $derived(pendingNextActionDrafts($demoState));
"""
)

replace_once(
    layout,
    """\tlet recoveryError = $state('');
\tlet pendingCenterOpen = $state(false);
\tlet online = $state(true);
""",
    """\tlet recoveryError = $state('');
\tlet pendingCenterOpen = $state(false);
\tlet toolsOpen = $state(false);
\tlet toolsTrigger: HTMLButtonElement | null = $state(null);
\tlet online = $state(true);
"""
)

replace_once(
    layout,
    """\tfunction dismissToast(id: string) {
\t\ttoasts.update((items) => items.filter((item) => item.id !== id));
\t}
""",
    """\tfunction restoreToolsFocus() {
\t\trequestAnimationFrame(() => toolsTrigger?.focus({ preventScroll: true }));
\t}

\tfunction dismissToast(id: string) {
\t\ttoasts.update((items) => items.filter((item) => item.id !== id));
\t}
"""
)

replace_once(
    layout,
    """\t\t<nav aria-label=\"Projects workflow navigation\">
\t\t\t{#each ROUTES as item (item.href)}
\t\t\t\t<a href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
\t\t\t\t\t{item.label}
\t\t\t\t</a>
\t\t\t{/each}
\t\t\t{#if pendingNavigation.count > 0}
\t\t\t\t<a class=\"pending-approval-link\" href={pendingResumeHref} aria-label={`Resume ${pendingNavigation.count} pending approval${pendingNavigation.count === 1 ? '' : 's'}`} onclick={(event) => { event.preventDefault(); pendingCenterOpen = true; }}>
\t\t\t\t\tPending {pendingNavigation.count}
\t\t\t\t</a>
\t\t\t{/if}
\t\t</nav>
""",
    """\t\t<nav aria-label=\"Projects application navigation\">
\t\t\t<a
\t\t\t\tclass=\"challenge-nav-control challenge-work-link\"
\t\t\t\thref=\"/work\"
\t\t\t\tdata-nav-label=\"Work\"
\t\t\t\taria-current={pathname === '/work' ? 'page' : undefined}
\t\t\t>Work</a>
\t\t\t{#if pendingNavigation.count > 0}
\t\t\t\t<a
\t\t\t\t\tclass=\"challenge-nav-control pending-approval-link\"
\t\t\t\t\thref={pendingResumeHref}
\t\t\t\t\tdata-nav-label={`Pending ${pendingNavigation.count}`}
\t\t\t\t\taria-label={`Resume ${pendingNavigation.count} pending approval${pendingNavigation.count === 1 ? '' : 's'}`}
\t\t\t\t\tonclick={(event) => { event.preventDefault(); pendingCenterOpen = true; }}
\t\t\t\t>Pending {pendingNavigation.count}</a>
\t\t\t{/if}
\t\t\t<a
\t\t\t\tclass=\"challenge-nav-control\"
\t\t\t\thref=\"/webmcp-challenge\"
\t\t\t\tdata-nav-label=\"Guide\"
\t\t\t\taria-current={pathname === '/webmcp-challenge' ? 'page' : undefined}
\t\t\t>Guide</a>
\t\t\t<button
\t\t\t\tclass=\"challenge-nav-control tools-trigger\"
\t\t\t\tclass:contains-current-route={Boolean(activeToolRoute)}
\t\t\t\ttype=\"button\"
\t\t\t\tdata-tools-trigger
\t\t\t\tdata-nav-label=\"Tools\"
\t\t\t\tdata-route-active={activeToolRoute ? 'true' : undefined}
\t\t\t\taria-haspopup=\"dialog\"
\t\t\t\taria-expanded={toolsOpen}
\t\t\t\taria-controls=\"workflow-tools-panel\"
\t\t\t\taria-label={activeToolRoute ? `Tools, ${activeToolRoute.label} is the current view` : 'Tools'}
\t\t\t\tbind:this={toolsTrigger}
\t\t\t\tonclick={() => (toolsOpen = true)}
\t\t\t>
\t\t\t\t<span>Tools</span>
\t\t\t\t{#if activeToolRoute}<small aria-hidden=\"true\">{activeToolRoute.label}</small>{/if}
\t\t\t</button>
\t\t</nav>
"""
)

replace_once(
    layout,
    """\t<PendingApprovalsCenter bind:open={pendingCenterOpen} drafts={pendingApprovals} packs={($demoState?.packs ?? []) as any} />
</div>
""",
    """\t<PendingApprovalsCenter bind:open={pendingCenterOpen} drafts={pendingApprovals} packs={($demoState?.packs ?? []) as any} />

\t<WornDialog bind:open={toolsOpen} title=\"Tools\" size=\"sm\" onclose={restoreToolsFocus}>
\t\t<div id=\"workflow-tools-panel\" class=\"workflow-tools-panel\" data-workflow-tools-panel>
\t\t\t<p class=\"workflow-tools-intro\">Focused views support the Work decision workspace without turning them back into mandatory steps.</p>
\t\t\t<nav class=\"workflow-tools-list\" aria-label=\"Project tools\">
\t\t\t\t{#each TOOL_ROUTES as item (item.href)}
\t\t\t\t\t<a
\t\t\t\t\t\tclass=\"workflow-tools-link\"
\t\t\t\t\t\thref={item.href}
\t\t\t\t\t\tdata-workflow-tool-link
\t\t\t\t\t\tdata-tool-label={item.label}
\t\t\t\t\t\taria-current={pathname === item.href ? 'page' : undefined}
\t\t\t\t\t\tonclick={() => (toolsOpen = false)}
\t\t\t\t\t>
\t\t\t\t\t\t<strong>{item.label}</strong>
\t\t\t\t\t\t<span>{item.description}</span>
\t\t\t\t\t</a>
\t\t\t\t{/each}
\t\t\t</nav>
\t\t</div>
\t</WornDialog>
</div>
"""
)

replace_once(
    layout,
    """\t.challenge-shell-nav nav {
\t\tdisplay: flex;
\t\tflex: 0 1 auto;
\t\tflex-wrap: wrap;
\t\tgap: 4px;
\t\tjustify-content: flex-end;
\t}

\t/* At tablet widths the brand and status share a compact row, while the
\t   complete workflow (including Pending) stays together below it. */
\t@media (max-width: 900px) and (min-width: 701px) {
\t\t.challenge-shell-nav {
\t\t\tdisplay: grid;
\t\t\tgap: 6px 10px;
\t\t\tgrid-template-columns: minmax(0, 1fr) auto;
\t\t\tpadding: 6px 8px;
\t\t}
\t\t.challenge-shell-nav :global(.webmcp-status-pill) { grid-column: 2; grid-row: 1; }
\t\t.challenge-shell-nav nav { flex-wrap: nowrap; gap: 2px; grid-column: 1 / -1; justify-content: stretch; }
\t\t.challenge-shell-nav nav a { flex: 1 1 auto; font-size: 11px; justify-content: center; min-height: 36px; padding-inline: 7px; }
\t\t.challenge-brand { min-height: 36px; padding-inline: 8px; }
\t}

\t.challenge-shell-nav nav a {
\t\talign-items: center;
\t\tborder: 1px solid transparent;
\t\tborder-radius: var(--worn-radius-sm);
\t\tcolor: var(--worn-text-secondary);
\t\tdisplay: inline-flex;
\t\tfont-family: var(--font-typewriter);
\t\tfont-size: 12px;
\t\tfont-weight: 650;
\t\tmin-height: 44px;
\t\tpadding: 0 12px;
\t\ttext-decoration: none;
\t\ttransition:
\t\t\tbackground-color 180ms ease,
\t\t\tborder-color 180ms ease,
\t\t\tbox-shadow 180ms ease,
\t\t\tcolor 180ms ease,
\t\t\ttranslate 180ms ease;
\t}

\t.challenge-shell-nav nav a[aria-current='page'] {
\t\tbackground: var(--worn-selected-bg);
\t\tborder-color: var(--worn-border-strong);
\t\tbox-shadow: inset 0 -2px 0 var(--worn-accent);
\t\tcolor: var(--worn-selected-fg);
\t\ttranslate: 0 -1px;
\t}

\t.challenge-brand:focus-visible,
\t.challenge-shell-nav nav a:focus-visible {
\t\toutline: 2px solid var(--challenge-focus-mint);
\t\toutline-offset: 2px;
\t}
""",
    """\t.challenge-shell-nav nav {
\t\talign-items: center;
\t\tdisplay: flex;
\t\tflex: 0 1 auto;
\t\tflex-wrap: nowrap;
\t\tgap: 4px;
\t\tjustify-content: flex-end;
\t\tmin-width: 0;
\t}

\t/* Tablet and compact layouts retain one deliberate application row:
\t   Work, Pending when present, Guide, and the secondary Tools surface. */
\t@media (max-width: 900px) and (min-width: 701px) {
\t\t.challenge-shell-nav {
\t\t\tdisplay: grid;
\t\t\tgap: 6px 10px;
\t\t\tgrid-template-columns: minmax(0, 1fr) auto;
\t\t\tpadding: 6px 8px;
\t\t}
\t\t.challenge-shell-nav :global(.webmcp-status-pill) { grid-column: 2; grid-row: 1; }
\t\t.challenge-shell-nav nav { gap: 4px; grid-column: 1 / -1; justify-content: stretch; }
\t\t.challenge-shell-nav .challenge-nav-control { flex: 1 1 0; font-size: 11px; justify-content: center; min-height: 38px; padding-inline: 8px; }
\t\t.challenge-brand { min-height: 36px; padding-inline: 8px; }
\t}

\t.challenge-nav-control {
\t\talign-items: center;
\t\tappearance: none;
\t\tbackground: transparent;
\t\tborder: 1px solid transparent;
\t\tborder-radius: var(--worn-radius-sm);
\t\tbox-sizing: border-box;
\t\tcolor: var(--worn-text-secondary);
\t\tcursor: pointer;
\t\tdisplay: inline-flex;
\t\tfont-family: var(--font-typewriter);
\t\tfont-size: 12px;
\t\tfont-weight: 650;
\t\tjustify-content: center;
\t\tline-height: 1;
\t\tmargin: 0;
\t\tmin-height: 44px;
\t\tmin-width: 0;
\t\tpadding: 0 12px;
\t\ttext-decoration: none;
\t\twhite-space: nowrap;
\t\ttransition:
\t\t\tbackground-color 180ms ease,
\t\t\tborder-color 180ms ease,
\t\t\tbox-shadow 180ms ease,
\t\t\tcolor 180ms ease,
\t\t\ttranslate 180ms ease;
\t}

\t.challenge-work-link {
\t\tbackground: color-mix(in srgb, var(--worn-accent) 8%, transparent);
\t\tcolor: var(--worn-text);
\t\tfont-weight: 800;
\t}

\t.pending-approval-link {
\t\tborder-color: color-mix(in srgb, var(--worn-warning-text) 35%, var(--worn-border));
\t}

\t.tools-trigger {
\t\tflex-direction: column;
\t\tgap: 2px;
\t}

\t.tools-trigger small {
\t\tcolor: inherit;
\t\tfont-family: var(--font-typewriter);
\t\tfont-size: 9px;
\t\tfont-weight: 750;
\t\tline-height: 1;
\t}

\t.challenge-nav-control[aria-current='page'],
\t.tools-trigger[data-route-active='true'] {
\t\tbackground: var(--worn-selected-bg);
\t\tborder-color: var(--worn-border-strong);
\t\tbox-shadow: inset 0 -2px 0 var(--worn-accent);
\t\tcolor: var(--worn-selected-fg);
\t\ttranslate: 0 -1px;
\t}

\t.workflow-tools-panel {
\t\tdisplay: grid;
\t\tgap: 14px;
\t\tmax-inline-size: 100%;
\t\tmin-inline-size: 0;
\t}

\t.workflow-tools-intro {
\t\tcolor: var(--worn-text-secondary);
\t\tfont-size: 14px;
\t\tline-height: 1.5;
\t\tmargin: 0;
\t}

\t.workflow-tools-list {
\t\tdisplay: grid;
\t\tgap: 8px;
\t}

\t.workflow-tools-link {
\t\tbackground: var(--worn-surface);
\t\tborder: 1px solid var(--worn-border);
\t\tborder-radius: var(--worn-radius-sm);
\t\tcolor: var(--worn-text);
\t\tdisplay: grid;
\t\tgap: 3px;
\t\tmin-width: 0;
\t\tpadding: 12px 14px;
\t\ttext-decoration: none;
\t}

\t.workflow-tools-link strong {
\t\tfont-size: 15px;
\t}

\t.workflow-tools-link span {
\t\tcolor: var(--worn-text-secondary);
\t\tfont-size: 13px;
\t\tline-height: 1.4;
\t}

\t.workflow-tools-link[aria-current='page'] {
\t\tbackground: var(--worn-selected-bg);
\t\tborder-color: var(--worn-border-strong);
\t\tbox-shadow: inset 0 -2px 0 var(--worn-accent);
\t}

\t.challenge-brand:focus-visible,
\t.challenge-nav-control:focus-visible,
\t.workflow-tools-link:focus-visible {
\t\toutline: 2px solid var(--challenge-focus-mint);
\t\toutline-offset: 2px;
\t}
"""
)

replace_once(
    layout,
    """\t@media (hover: hover) and (pointer: fine) {
\t\t.challenge-brand:hover,
\t\t.challenge-shell-nav nav a:hover {
\t\t\tbackground: var(--worn-hover-bg);
\t\t\tcolor: var(--worn-text);
\t\t}
\t}
""",
    """\t@media (hover: hover) and (pointer: fine) {
\t\t.challenge-brand:hover,
\t\t.challenge-nav-control:hover,
\t\t.workflow-tools-link:hover {
\t\t\tbackground: var(--worn-hover-bg);
\t\t\tcolor: var(--worn-text);
\t\t}
\t}
"""
)

replace_once(
    layout,
    """\t\t.challenge-shell-nav nav {
\t\t\tdisplay: grid;
\t\t\tgrid-column: 1 / -1;
\t\t\tgrid-row: 2;
\t\t\tgrid-template-columns: repeat(5, minmax(0, 1fr));
\t\t}

\t\t.challenge-shell-nav nav a {
\t\t\tjustify-content: center;
\t\t\tpadding-inline: 4px;
\t\t}

\t\t.challenge-shell-nav nav .pending-approval-link {
\t\t\tgrid-column: 1 / -1;
\t\t}
""",
    """\t\t.challenge-shell-nav nav {
\t\t\tdisplay: flex;
\t\t\tflex-wrap: nowrap;
\t\t\tgrid-column: 1 / -1;
\t\t\tgrid-row: 2;
\t\t\tjustify-content: stretch;
\t\t\twidth: 100%;
\t\t}

\t\t.challenge-shell-nav .challenge-nav-control {
\t\t\tflex: 1 1 0;
\t\t\tfont-size: 11px;
\t\t\tjustify-content: center;
\t\t\tpadding-inline: 4px;
\t\t}

\t\t.tools-trigger small {
\t\t\tdisplay: none;
\t\t}
"""
)

replace_once(
    layout,
    """\t\t.challenge-shell-nav nav a {
\t\t\ttransition: none;
\t\t}
""",
    """\t\t.challenge-nav-control,
\t\t.workflow-tools-link {
\t\t\ttransition: none;
\t\t}
"""
)

replace_once(
    layout,
    """\t\t.challenge-shell-nav nav a {
\t\t\tfont-size: 11px;
\t\t}
""",
    """\t\t.challenge-nav-control {
\t\t\tfont-size: 10px;
\t\t}
"""
)

challenge_contract = "tests/challenge-webmcp-page-contract.test.mjs"
replace_once(
    challenge_contract,
    """\tassert.match(layoutSource, /<nav aria-label=\"Projects workflow navigation\">/u);
\tassert.doesNotMatch(layoutSource, /aria-label=\"Challenge pages\"/u);
""",
    """\tassert.match(layoutSource, /<nav aria-label=\"Projects application navigation\">/u);
\tassert.doesNotMatch(layoutSource, /aria-label=\"Challenge pages\"|Projects workflow navigation/u);
"""
)

replace_regex(
    challenge_contract,
    r"""test\('compact navigation gives pending approvals the existing second row', \(\) => \{.*?\n\}\);""",
    """test('work-first navigation keeps Pending and Tools in one compact row', () => {
\tassert.match(layoutSource, /class=\"challenge-nav-control challenge-work-link\"[\\s\\S]*?href=\"\\/work\"[\\s\\S]*?data-nav-label=\"Work\"/u);
\tassert.match(layoutSource, /data-nav-label=\\{`Pending \\$\\{pendingNavigation\\.count\\}`\\}/u);
\tassert.match(layoutSource, /data-nav-label=\"Guide\"[\\s\\S]*?data-tools-trigger[\\s\\S]*?data-nav-label=\"Tools\"/u);
\tassert.match(layoutSource, /aria-label=\\{activeToolRoute \\? `Tools, \\$\\{activeToolRoute\\.label\\} is the current view` : 'Tools'\\}/u);
\tassert.match(layoutSource, /<WornDialog bind:open=\\{toolsOpen\\} title=\"Tools\" size=\"sm\" onclose=\\{restoreToolsFocus\\}>/u);
\tassert.match(layoutSource, /requestAnimationFrame\\(\\(\\) => toolsTrigger\\?\\.focus\\(\\{ preventScroll: true \\}\\)\\)/u);
\tassert.match(layoutSource, /Priority[\\s\\S]*?Standalone recommendation view[\\s\\S]*?Review[\\s\\S]*?Full evidence queue[\\s\\S]*?Next[\\s\\S]*?Full next-action editor/u);
\tassert.doesNotMatch(layoutSource, /label: '1 Work'|label: '2 Review'|label: '3 Next'/u);
\tconst compactStart = layoutSource.indexOf('@media (max-width: 700px)');
\tconst compactEnd = layoutSource.indexOf('@media (prefers-reduced-motion: reduce)', compactStart);
\tassert.notEqual(compactStart, -1);
\tassert.notEqual(compactEnd, -1);
\tconst compactSource = layoutSource.slice(compactStart, compactEnd);
\tassert.match(compactSource, /\\.challenge-shell-nav nav \\{[\\s\\S]*?display: flex;[\\s\\S]*?flex-wrap: nowrap;[\\s\\S]*?width: 100%;/u);
\tassert.match(compactSource, /\\.challenge-shell-nav \\.challenge-nav-control \\{[\\s\\S]*?flex: 1 1 0;/u);
\tassert.doesNotMatch(compactSource, /pending-approval-link[^}]*grid-column:\\s*1\\s*\\/\\s*-1/u);
});"""
)

header_smoke = "scripts/webmcp-header-responsive-smoke.mjs"
replace_regex(
    header_smoke,
    r"""\tasync function checkViewport\(width\) \{.*?\n\tawait checkViewport\(768\);""",
    """\tasync function checkViewport(width) {
\t\tawait page.setViewportSize({ width, height: 900 });
\t\tawait page.reload({ waitUntil: 'networkidle' });
\t\tawait page.waitForSelector('.pending-approval-link', { state: 'visible' });
\t\tconst result = await page.locator('.challenge-shell-nav').evaluate((header) => {
\t\t\tconst nav = header.querySelector(':scope > nav');
\t\t\tconst controls = [...nav.querySelectorAll(':scope > .challenge-nav-control')];
\t\t\tconst navRect = nav.getBoundingClientRect();
\t\t\tconst headerRect = header.getBoundingClientRect();
\t\t\tconst brandRect = header.querySelector('.challenge-brand').getBoundingClientRect();
\t\t\tconst pending = header.querySelector('.pending-approval-link');
\t\t\tconst work = header.querySelector('.challenge-work-link');
\t\t\tconst tools = header.querySelector('[data-tools-trigger]');
\t\t\treturn {
\t\t\t\tcontrolCount: controls.length,
\t\t\t\tlabels: controls.map((control) => control.dataset.navLabel),
\t\t\t\tcontrolTops: controls.map((control) => Math.round(control.getBoundingClientRect().top)),
\t\t\t\tnavTop: Math.round(navRect.top),
\t\t\t\tnavWidth: navRect.width,
\t\t\t\tpendingTop: Math.round(pending.getBoundingClientRect().top),
\t\t\t\tpendingWidth: pending.getBoundingClientRect().width,
\t\t\t\tworkTop: Math.round(work.getBoundingClientRect().top),
\t\t\t\ttoolsTop: Math.round(tools.getBoundingClientRect().top),
\t\t\t\tbrandWidth: brandRect.width,
\t\t\t\theaderHeight: headerRect.height,
\t\t\t\tstatusTop: Math.round(header.querySelector('.webmcp-status-pill').getBoundingClientRect().top),
\t\t\t\tdocumentWidth: document.documentElement.scrollWidth,
\t\t\t\tviewportWidth: document.documentElement.clientWidth,
\t\t\t\ttoolsActive: tools.dataset.routeActive === 'true',
\t\t\t\ttoolsLabel: tools.getAttribute('aria-label'),
\t\t\t\tworkDefault: work.classList.contains('challenge-work-link'),
\t\t\t\tworkCurrent: work.getAttribute('aria-current'),
\t\t\t\tsaveBoundary: [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Approve and save')
\t\t\t};
\t\t});
\t\tassert.equal(result.controlCount, 4);
\t\tassert.deepEqual(result.labels, ['Work', 'Pending 1', 'Guide', 'Tools']);
\t\tassert.ok(result.headerHeight < 180, `header should remain compact, got ${result.headerHeight}px`);
\t\tassert.ok(result.statusTop < result.navTop, 'WebMCP status should remain grouped above the application row');
\t\tassert.ok(result.navWidth > 0, 'application navigation should use the available row');
\t\tassert.ok(result.documentWidth <= result.viewportWidth, `header should not overflow horizontally: ${result.documentWidth}px > ${result.viewportWidth}px`);
\t\tassert.ok(result.brandWidth > 180, 'Wornpage Projects brand should retain readable width');
\t\tassert.ok(result.controlTops.every((top) => Math.abs(top - result.controlTops[0]) <= 1), 'all primary navigation controls should share one row');
\t\tassert.equal(result.pendingTop, result.workTop);
\t\tassert.equal(result.toolsTop, result.workTop);
\t\tassert.ok(result.pendingWidth > 0);
\t\tassert.equal(result.toolsActive, true, 'Tools should visibly own the current Next route');
\t\tassert.match(result.toolsLabel ?? '', /Tools, Next is the current view/u);
\t\tassert.equal(result.workDefault, true);
\t\tassert.equal(result.workCurrent, null, 'Work keeps default prominence without falsely claiming the current Next route');
\t\tassert.equal(result.saveBoundary, true, 'human-only Approve and save boundary remains visible');
\t\tconsole.log(JSON.stringify({ viewport: `${width}x900`, ...result }));
\t}
\tawait checkViewport(390);
\tawait checkViewport(700);
\tawait checkViewport(768);

\tconst toolsTrigger = page.locator('[data-tools-trigger]');
\tawait toolsTrigger.focus();
\tawait page.keyboard.press('Enter');
\tconst toolsDialog = page.getByRole('dialog', { name: 'Tools' });
\tawait toolsDialog.waitFor({ state: 'visible' });
\tconst toolsState = await toolsDialog.locator('[data-workflow-tool-link]').evaluateAll((links) =>
\t\tlinks.map((link) => ({
\t\t\tlabel: link.dataset.toolLabel,
\t\t\tcurrent: link.getAttribute('aria-current'),
\t\t\tdescription: link.querySelector('span')?.textContent?.trim()
\t\t}))
\t);
\tassert.deepEqual(toolsState, [
\t\t{ label: 'Priority', current: null, description: 'Standalone recommendation view' },
\t\t{ label: 'Review', current: null, description: 'Full evidence queue' },
\t\t{ label: 'Next', current: 'page', description: 'Full next-action editor' }
\t]);
\tawait page.keyboard.press('Escape');
\tawait toolsDialog.waitFor({ state: 'hidden' });
\tawait page.waitForFunction(() => document.activeElement?.hasAttribute('data-tools-trigger'));
\tassert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-tools-trigger')), true, 'Tools dismissal restores trigger focus');"""
)

readme = "README.md"
replace_once(
    readme,
    """Work's Decision Workspace composes the selected open decision, current workflow and blocker evidence, browser-local draft preparation, and the human-only final Save in one surface. It reuses the same pending-draft fingerprint, stale check, and `setPackNextAction` owner as Next. Preparing or revising a draft leaves the work item unchanged; approval consumes that exact settled draft atomically. Pending approvals resume through one bounded `focus` value plus the explicit `pending-decision` context marker. Work revalidates the exact id after browser state loads, gives a valid open decision priority without rewriting saved filters, and labels a resumed decision that sits outside the current list scope. Invalid, duplicate, missing, archived, completed, and non-decision requests fail closed. Review and Next remain focused deep links rather than required intermediate steps. When a deep link carries the exact work id and bounded context marker into Next, Next still verifies the loaded item independently; no recommendation prose, workspace facts, new storage path, or expanded WebMCP authority is serialized.
""",
    """Work's Decision Workspace composes the selected open decision, current workflow and blocker evidence, browser-local draft preparation, and the human-only final Save in one surface. It reuses the same pending-draft fingerprint, stale check, and `setPackNextAction` owner as Next. Preparing or revising a draft leaves the work item unchanged; approval consumes that exact settled draft atomically. Pending approvals resume through one bounded `focus` value plus the explicit `pending-decision` context marker. Work revalidates the exact id after browser state loads, gives a valid open decision priority without rewriting saved filters, and labels a resumed decision that sits outside the current list scope. Invalid, duplicate, missing, archived, completed, and non-decision requests fail closed. The global shell keeps Work, Pending, and Guide top-level; Priority, Review, and Next remain accessible focused views inside Tools rather than presenting the old routes as mandatory numbered steps. When a deep link carries the exact work id and bounded context marker into Next, Next still verifies the loaded item independently; no recommendation prose, workspace facts, new storage path, or expanded WebMCP authority is serialized.
"""
)

print("Applied Work-first navigation source transforms.")
