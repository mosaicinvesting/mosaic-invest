/* ===========================================================
   Mosaic, curriculum interactions
   - click-to-answer quiz cards (reveal correct + explanation)
   - one-sentence responses saved locally (no account needed)
   All client-side; the curriculum is open-access.
   =========================================================== */
(function () {
  'use strict';

  /* ---------- quiz cards ---------- */
  document.querySelectorAll('.quiz').forEach(function (quiz) {
    var opts = Array.prototype.slice.call(quiz.querySelectorAll('.opt'));
    var explain = quiz.querySelector('.explain');

    opts.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (quiz.classList.contains('answered')) return;
        quiz.classList.add('answered');

        var choseRight = btn.getAttribute('data-correct') === 'true';

        opts.forEach(function (o) {
          o.disabled = true;
          var isRight = o.getAttribute('data-correct') === 'true';
          if (isRight) {
            o.classList.add('is-correct');
            o.insertAdjacentHTML('beforeend', '<span class="mk" aria-hidden="true">✓</span>');
          } else if (o === btn) {
            o.classList.add('is-wrong');
            o.insertAdjacentHTML('beforeend', '<span class="mk" aria-hidden="true">✕</span>');
          }
        });

        if (explain) explain.classList.add('show');
        quiz.setAttribute('data-result', choseRight ? 'right' : 'wrong');
        updateProgress(quiz.closest('.module'));
        checkCourseComplete();
      });
    });
  });

  /* ---------- one-sentence responses persist on this device ---------- */
  document.querySelectorAll('textarea[data-key]').forEach(function (ta) {
    var key = 'mosaic-curric-' + ta.getAttribute('data-key');
    try {
      var saved = localStorage.getItem(key);
      if (saved) ta.value = saved;
    } catch (e) { /* storage may be blocked; feature is optional */ }
    ta.addEventListener('input', function () {
      try { localStorage.setItem(key, ta.value); } catch (e) {}
    });
  });

  /* ---------- lightweight per-module checkpoint progress ---------- */
  function updateProgress(mod) {
    if (!mod) return;
    var quizzes = mod.querySelectorAll('.quiz');
    var done = mod.querySelectorAll('.quiz.answered');
    var pill = mod.querySelector('.cp-progress');
    if (pill && quizzes.length) {
      pill.textContent = done.length + ' / ' + quizzes.length + ' answered';
      pill.classList.add('show');
    }
  }

  /* ===========================================================
     Impact tracking: one confidence question before a course and
     one after, so Mosaic can show real numbers on the Impact page.
     Never blocks reading; fires at most once per browser per course.
     =========================================================== */
  var COURSE = /markets/.test(location.pathname) ? 'markets' : 'foundations';

  function sendSignal(event, confidence) {
    if (!window.MOSAIC_SB) return;
    try {
      fetch(window.MOSAIC_SB.url + '/rest/v1/impact_signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: window.MOSAIC_SB.key,
          Authorization: 'Bearer ' + window.MOSAIC_SB.key,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ course: COURSE, event: event, confidence: confidence || null })
      }).catch(function () {});
    } catch (e) { /* best-effort; never blocks the reader */ }
  }

  function flagKey(kind) { return 'mosaic-impact-' + COURSE + '-' + kind; }
  function flagged(kind) {
    try { return !!localStorage.getItem(flagKey(kind)); } catch (e) { return false; }
  }
  function setFlag(kind) {
    try { localStorage.setItem(flagKey(kind), '1'); } catch (e) {}
  }

  function buildPrompt(question, onAnswer) {
    var card = document.createElement('div');
    card.className = 'impact-prompt';
    card.innerHTML =
      '<p class="ip-q">' + question + '</p>' +
      '<div class="ip-scale" role="group" aria-label="Confidence, 1 to 10"></div>' +
      '<div class="ip-foot">' +
        '<span class="ip-note">Shown only as an average on our Impact page.</span>' +
        '<button type="button" class="ip-skip">Skip</button>' +
      '</div>';
    var scale = card.querySelector('.ip-scale');
    for (var i = 1; i <= 10; i++) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = i; b.setAttribute('data-v', i);
      scale.appendChild(b);
    }
    function finish(v) {
      card.innerHTML = '<p class="ip-thanks">Thanks, that helps us measure whether this actually works.</p>';
      setTimeout(function () { card.classList.add('ip-done'); }, 1400);
      onAnswer(v);
    }
    scale.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-v]');
      if (!btn) return;
      finish(+btn.getAttribute('data-v'));
    });
    card.querySelector('.ip-skip').addEventListener('click', function () {
      card.classList.add('ip-done');
      onAnswer(null);
    });
    return card;
  }

  function showStartPrompt() {
    var firstModule = document.querySelector('.module');
    if (!firstModule || !firstModule.parentNode) return;
    var card = buildPrompt(
      'Before you start: on a scale of 1–10, how confident do you feel managing money right now?',
      function (v) { sendSignal('start', v); }
    );
    firstModule.parentNode.insertBefore(card, firstModule);
    setFlag('started');
  }

  function showCompletePrompt() {
    var modules = document.querySelectorAll('.module');
    var last = modules[modules.length - 1];
    if (!last || !last.parentNode) return;
    var card = buildPrompt(
      'You made it through the course. Now, on that same scale of 1–10, how confident do you feel managing money?',
      function (v) { sendSignal('complete', v); }
    );
    last.parentNode.insertBefore(card, last.nextSibling);
    setFlag('completed');
  }

  function checkCourseComplete() {
    if (flagged('completed')) return;
    var all = document.querySelectorAll('.quiz');
    var done = document.querySelectorAll('.quiz.answered');
    if (all.length && done.length === all.length) showCompletePrompt();
  }

  if (document.querySelector('.module')) {
    setTimeout(function () {
      if (!flagged('started')) showStartPrompt();
    }, 1200);
  }
})();
