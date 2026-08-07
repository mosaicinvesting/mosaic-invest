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
})();
