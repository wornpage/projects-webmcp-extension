import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { focusAndPulse } from '../svelte-frontend/src/lib/focus-pulse.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const focusPulseSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/lib/focus-pulse.mjs'), 'utf8');
const layoutSource = fs.readFileSync(path.join(repoRoot, 'svelte-frontend/src/routes/+layout.svelte'), 'utf8');

function focusTarget(rect, { width = 320, height = 180 } = {}) {
	let focusVisible = false;
	const attributes = new Map();
	const classes = new Set();
	const ownerDocument = {
		activeElement: null,
		defaultView: { innerWidth: width, innerHeight: height }
	};
	const calls = { blur: 0, focus: [] };
	const target = {
		ownerDocument,
		classList: {
			add(value) { classes.add(value); },
			contains(value) { return classes.has(value); },
			remove(value) { classes.delete(value); }
		},
		offsetWidth: rect.right - rect.left,
		blur() {
			calls.blur += 1;
			ownerDocument.activeElement = null;
			focusVisible = false;
		},
		focus(options) {
			calls.focus.push(options);
			ownerDocument.activeElement = target;
			focusVisible = options.focusVisible === true;
		},
		getBoundingClientRect() { return rect; },
		matches(selector) { return selector === ':focus-visible' ? focusVisible : true; },
		scrollIntoView() {},
		getAttribute(name) { return attributes.get(name) ?? null; },
		removeAttribute(name) { attributes.delete(name); },
		setAttribute(name, value) { attributes.set(name, value); }
	};
	ownerDocument.activeElement = target;
	return { calls, target };
}

test('required visible focus accepts an on-screen target taller than a tiny viewport', (t) => {
	t.mock.method(globalThis, 'setTimeout', () => 1);
	t.mock.method(globalThis, 'clearTimeout', () => {});
	const { calls, target } = focusTarget({ left: 0, right: 320, top: -50, bottom: 230 });

	const receipt = focusAndPulse(target, { behavior: 'auto', requireVisibleFocus: true });

	assert.deepEqual(receipt, { focused: true, focusVisible: true, inViewport: true, pulsed: true });
	assert.equal(calls.blur, 1);
	assert.deepEqual(calls.focus, [{ preventScroll: true, focusVisible: true }]);
	assert.equal(target.getAttribute('data-focus-arrival'), 'true');
});

test('the route arrival treatment is explicit, lasts long enough to notice, and clears cleanly', (t) => {
	let scheduled;
	t.mock.method(globalThis, 'setTimeout', (callback) => {
		scheduled = callback;
		return 1;
	});
	t.mock.method(globalThis, 'clearTimeout', () => {});
	const { target } = focusTarget({ left: 0, right: 320, top: 0, bottom: 120 });

	focusAndPulse(target, { behavior: 'auto' });
	assert.equal(target.getAttribute('data-focus-arrival'), 'true');
	assert.equal(target.classList.contains('demo-focus-pulse'), true);
	scheduled();
	assert.equal(target.getAttribute('data-focus-arrival'), null);
	assert.equal(target.classList.contains('demo-focus-pulse'), false);
	assert.match(focusPulseSource, /FOCUS_PULSE_DURATION_MS = 4200/u);
	assert.match(layoutSource, /\.demo-focus-pulse\[data-focus-arrival='true'\]/u);
	assert.match(layoutSource, /content: 'Focused item'/u);
	assert.match(layoutSource, /outline: 3px solid var\(--worn-focus\)/u);
	assert.match(layoutSource, /box-shadow:/u);
});

test('required visible focus still rejects fit-sized clipping and wholly off-screen oversized targets', (t) => {
	t.mock.method(globalThis, 'setTimeout', () => 1);
	t.mock.method(globalThis, 'clearTimeout', () => {});
	const clipped = focusTarget({ left: 0, right: 320, top: -1, bottom: 100 }).target;
	const offscreen = focusTarget({ left: 0, right: 320, top: 181, bottom: 461 }).target;

	assert.throws(
		() => focusAndPulse(clipped, { behavior: 'auto', requireVisibleFocus: true }),
		/Visible focus verification failed: .*"inViewport":false/u
	);
	assert.throws(
		() => focusAndPulse(offscreen, { behavior: 'auto', requireVisibleFocus: true }),
		/Visible focus verification failed: .*"inViewport":false/u
	);
});
