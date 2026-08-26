const FOCUS_PULSE_DURATION_MS = 1800;

const focusPulseTimers = new WeakMap();
const FOCUSABLE_SELECTOR = 'a, button, input, select, textarea, [tabindex]';

function prefersReducedMotion() {
	return typeof globalThis.matchMedia === 'function' &&
		globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Move the viewport and keyboard focus to a guided destination, then briefly
 * mark the arrival point without creating a second navigation path.
 *
 * @param {HTMLElement} target
 * @param {{ behavior?: ScrollBehavior, block?: ScrollLogicalPosition, pulseTarget?: HTMLElement }} [options]
 */
export function focusAndPulse(target, options = {}) {
	const behavior = prefersReducedMotion() ? 'auto' : (options.behavior || 'auto');
	const block = options.block || 'center';
	const pulseTarget = options.pulseTarget || target;

	pulseTarget.scrollIntoView({ behavior, block, inline: 'nearest' });
	if (!target.matches(FOCUSABLE_SELECTOR)) target.setAttribute('tabindex', '-1');
	target.focus({ preventScroll: true });

	const pendingTimer = focusPulseTimers.get(pulseTarget);
	if (pendingTimer !== undefined) globalThis.clearTimeout(pendingTimer);
	pulseTarget.classList.remove('demo-focus-pulse');
	void pulseTarget.offsetWidth;
	pulseTarget.classList.add('demo-focus-pulse');

	const timer = globalThis.setTimeout(() => {
		pulseTarget.classList.remove('demo-focus-pulse');
		focusPulseTimers.delete(pulseTarget);
	}, FOCUS_PULSE_DURATION_MS);
	focusPulseTimers.set(pulseTarget, timer);
}
