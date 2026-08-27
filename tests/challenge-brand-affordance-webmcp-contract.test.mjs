import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', '+layout.svelte'), 'utf8');
const nextRouteSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', 'next', '+page.svelte'), 'utf8');

test('shared challenge brand keeps a padded, keyboard-visible landing affordance', () => {
	assert.match(
		layoutSource,
		/<a\s+class="challenge-brand"[\s\S]*?href="\/landing\.html"[\s\S]*?aria-label="Wornpage Projects landing page"/u
	);
	assert.match(
		layoutSource,
		/\.challenge-brand \{[\s\S]*?min-height: 44px;[\s\S]*?padding: 0 12px;[\s\S]*?text-decoration: none;/u
	);
	assert.match(layoutSource, /\.challenge-brand:focus-visible,[\s\S]*?outline: 2px dashed var\(--worn-focus\);/u);
	assert.match(layoutSource, /\.challenge-brand:hover,[\s\S]*?background: var\(--worn-hover-bg\);/u);
	assert.match(layoutSource, /\.challenge-brand span \{[\s\S]*?text-overflow: ellipsis;/u);
});

test('shared challenge layout keeps content compact and receipts comfortably separated', () => {
	assert.match(layoutSource, /\.challenge-shell \{[\s\S]*?align-content: start;/u);
	assert.match(
		layoutSource,
		/\.challenge-route :global\(\.worn-receipt\) \{[\s\S]*?margin-block: 14px 16px;[\s\S]*?padding: 16px 18px;/u
	);
	assert.match(layoutSource, /@media \(max-width: 700px\) \{[\s\S]*?padding: 14px;/u);
	assert.match(nextRouteSource, /data-webmcp-receipt="next"[\s\S]*?<WornReceipt[\s\S]*?id=\{NEXT_PREPARATION_RECEIPT_ID\}/u);
});

test('challenge motion is visible by default and removed for reduced motion', () => {
	assert.match(layoutSource, /animation: challenge-route-arrive 380ms/u);
	assert.match(layoutSource, /animation: challenge-receipt-arrive 440ms/u);
	assert.match(
		layoutSource,
		/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?data-webmcp-receipt[\s\S]*?animation: none;/u
	);
});
