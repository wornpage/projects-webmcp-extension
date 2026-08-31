// The landing page keeps behavior in one external file so its CSP
// can reject inline scripts.
(function () {
  var footerScope = document.getElementById("lp-footer-scope");
  if (footerScope) {
    footerScope.textContent = "The sample opens in Work and stays in this browser.";
  }
})();

// Visible WebMCP handoff replay: Observe → Narrow → Prepare → Decide.
(function () {
  var btn = document.getElementById("replay-play");
  var steps = document.querySelectorAll(".lp-replay-step");
  var note = document.getElementById("replay-note");
  if (!btn || !steps.length) return;

  var STEP_MS = 2200;
  var DEFAULT_NOTE = "Press play — four steps, about ten seconds. No account, no setup.";
  var timer = null;
  var index = -1;
  var stepNotes = [
    "Observed the exact visible queue — a client handoff is blocked while details are pending.",
    "Narrowed Work and Review to the relevant items — the denominators stay visible and workspace data is unchanged.",
    "Prepared a next action from verified workspace facts — the draft is still unsaved.",
    "Decision stays with the person — approve and save the draft, edit it, or discard it."
  ];

  function clearAll() {
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.remove("is-on");
      steps[i].removeAttribute("aria-current");
    }
  }

  function setNote(text) {
    if (note) note.textContent = text;
  }

  function selectStep(nextIndex) {
    clearAll();
    index = nextIndex;
    steps[index].classList.add("is-on");
    steps[index].setAttribute("aria-current", "step");
    if (index < stepNotes.length) setNote(stepNotes[index]);
  }

  function advance(wrap) {
    if (index >= steps.length - 1) {
      if (wrap === false) { pause(); return; }
      selectStep(0);
      return;
    }
    selectStep(index + 1);
  }

  function pause() {
    if (timer) { clearInterval(timer); timer = null; }
    btn.textContent = "▶ Watch the handoff";
    btn.setAttribute("aria-pressed", "false");
  }

  function start() {
    pause();
    index = -1;
    clearAll();
    advance(true);
    btn.textContent = "❚❚ Stop the handoff";
    btn.setAttribute("aria-pressed", "true");
    timer = setInterval(function () { advance(false); }, STEP_MS);
  }

  function stop() {
    pause();
    clearAll();
    index = -1;
    setNote(DEFAULT_NOTE);
  }

  // Native controls share one path; direct selection pauses playback.
  steps.forEach(function (step, stepIndex) {
    step.addEventListener("click", function () {
      pause();
      selectStep(stepIndex);
    });
  });

  // Reduced motion advances one step per activation and never starts a timer.
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    btn.addEventListener("click", function () {
      advance(true); // wraps: 1 → 2 → 3 → 4 → 1
    });
  } else {
    btn.addEventListener("click", function () {
      if (timer) stop(); else start();
    });
  }

})();
