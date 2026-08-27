import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutSource = readFileSync(path.join(repoRoot, 'svelte-frontend', 'src', 'routes', '+layout.svelte'), 'utf8');

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
