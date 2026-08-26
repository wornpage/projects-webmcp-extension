// The challenge landing page keeps behavior in one external file so its CSP
// can reject inline scripts.
(function () {
  var footerScope = document.getElementById("lp-footer-scope");
  if (footerScope) {
    footerScope.textContent = "The sample opens in Work and stays in this browser.";
  }
})();

// Work-loop replay: Review → Act → Record → Resume.
(function () {
  var btn = document.getElementById("replay-play");
  var tour = document.getElementById("replay-tour");
  var steps = document.querySelectorAll(".lp-replay-step");
  var note = document.getElementById("replay-note");
  if (!btn || !steps.length) return;

  var STEP_MS = 2200;
  var DEFAULT_NOTE = "Press play — four steps, about ten seconds. No account, no setup.";
  var timer = null;
  var index = -1;
  var stepNotes = [
    "Reviewed “Garage reset: sort shelves” — blocked, next action: clear the garage floor.",
    "Acted on it — the floor is clear and shelf sorting can continue.",
    "Recorded the change — the receipt keeps the result with the work.",
    "Storage bins are still missing, so the blocker and next useful step are ready for later."
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

  function advance() {
    // Loop back around so the demo keeps living until the visitor leaves.
    selectStep((index + 1) % steps.length);
  }

  function pause() {
    if (timer) { clearInterval(timer); timer = null; }
    btn.textContent = "▶ Watch the loop";
    btn.setAttribute("aria-pressed", "false");
  }

  function start() {
    pause();
    index = -1;
    clearAll();
    advance();
    btn.textContent = "❚❚ Stop the loop";
    btn.setAttribute("aria-pressed", "true");
    timer = setInterval(advance, STEP_MS);
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
      advance(); // wraps: 1 → 2 → 3 → 4 → 1
    });
  } else {
    btn.addEventListener("click", function () {
      if (timer) stop(); else start();
    });
  }

  // Keep the hero CTA as a real #replay link, while letting its native click
  // activation also reach the replay control. That gives pointer and Enter
  // activations the same replay behavior without taking over anchor scrolling
  // or changing the reduced-motion control path above.
  if (tour) {
    tour.addEventListener("click", function () {
      btn.click();
    });
  }
})();
