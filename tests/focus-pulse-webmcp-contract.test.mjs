import assert from 'node:assert/strict';
import test from 'node:test';

import { focusAndPulse } from '../svelte-frontend/src/lib/focus-pulse.mjs';

function focusTarget(rect, { width = 320, height = 180 } = {}) {
	let focusVisible = false;
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
		setAttribute() {}
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
