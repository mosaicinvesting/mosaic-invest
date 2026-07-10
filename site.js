/* ===========================================================
   Mosaic, shared site behaviour
   - mobile nav toggle
   - active nav link
   - reveal on scroll
   - animated stat counters
   - join form validation + application submission + success state
   =========================================================== */

/* Supabase project config (safe to be public; row-level security
   protects the data). Single source for site.js and members.js. */
window.MOSAIC_SB = {
  url: 'https://acormyhaxaerwbkzcvag.supabase.co',
  key: 'sb_publishable_W4wKpdrhSlVWJVKrC8T6wQ_09Jcl_WI'
};

(function () {
  'use strict';

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
      const open = document.body.classList.contains('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { document.body.classList.remove('nav-open'); });
    });
  }

  /* ---------- active nav link ---------- */
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a[data-page]').forEach(function (a) {
    if (a.getAttribute('data-page').toLowerCase() === path) a.classList.add('active');
  });

  /* ---------- reveal on scroll (position-based, robust) ---------- */
  const reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function showEl(el) {
    if (el.classList.contains('in')) return;
    el.classList.add('in');
    if (el.hasAttribute('data-count')) runCounter(el);
    el.querySelectorAll('[data-count]').forEach(runCounter);
    // lock final state after the transition so non-painting capture contexts
    // (and reduced-motion) never get stuck on the pre-animation opacity:0
    setTimeout(function () {
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }, 820);
  }

  function checkReveals() {
    const trigger = window.innerHeight * 0.92;
    for (let i = 0; i < reveals.length; i++) {
      const el = reveals[i];
      if (el.classList.contains('in')) continue;
      const top = el.getBoundingClientRect().top;
      if (top < trigger) showEl(el);
    }
  }

  checkReveals();
  requestAnimationFrame(checkReveals);
  window.addEventListener('scroll', checkReveals, { passive: true });
  window.addEventListener('resize', checkReveals, { passive: true });
  window.addEventListener('load', checkReveals);
  // failsafe: never leave content hidden
  setTimeout(function () {
    reveals.forEach(function (el) {
      el.classList.add('in');
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
      if (el.hasAttribute('data-count')) runCounter(el);
      el.querySelectorAll('[data-count]').forEach(runCounter);
    });
  }, 1600);

  /* ---------- animated counters ---------- */
  function runCounter(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const target = parseFloat(el.getAttribute('data-count'));
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const dur = 1500;
    const start = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.innerHTML = prefix + target + suffix; return; }
    function frame(now) {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(target * eased);
      el.innerHTML = prefix + val + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- join form ---------- */
  const form = document.getElementById('join-form');
  if (form) {
    const fields = form.querySelectorAll('input, select, textarea');

    function validateField(el) {
      const wrap = el.closest('.field');
      let ok = true;
      const v = el.value.trim();
      if (el.hasAttribute('required') && !v) ok = false;
      if (ok && el.type === 'email' && v) {
        ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      }
      if (ok && el.name === 'age' && v) {
        const n = parseInt(v, 10);
        ok = !isNaN(n) && n >= 10 && n <= 18;
      }
      if (wrap) wrap.classList.toggle('invalid', !ok);
      return ok;
    }

    fields.forEach(function (el) {
      el.addEventListener('blur', function () { validateField(el); });
      el.addEventListener('input', function () {
        const wrap = el.closest('.field');
        if (wrap && wrap.classList.contains('invalid')) validateField(el);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      let allOk = true;
      let firstBad = null;
      fields.forEach(function (el) {
        const ok = validateField(el);
        if (!ok && !firstBad) firstBad = el;
        if (!ok) allOk = false;
      });
      if (!allOk) {
        if (firstBad) firstBad.focus();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const errEl = document.getElementById('join-submit-error');
      if (errEl) errEl.style.display = 'none';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '.6'; }

      const val = function (n) {
        const el = form.querySelector('[name="' + n + '"]');
        return el ? el.value.trim() : '';
      };
      const application = {
        first_name: val('firstName'),
        last_name: val('lastName'),
        email: val('email').toLowerCase(),
        age: parseInt(val('age'), 10) || null,
        country: val('country'),
        why: val('why')
      };

      // primary: save the application where officers review it (same system
      // that runs member sign-in on the portfolio page)
      fetch(window.MOSAIC_SB.url + '/rest/v1/membership_applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: window.MOSAIC_SB.key,
          Authorization: 'Bearer ' + window.MOSAIC_SB.key,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(application)
      }).then(function (res) {
        if (!res.ok) throw new Error('Submission failed');
        // best-effort email notification; the application is already saved
        try {
          fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) })
            .catch(function () {});
        } catch (ignored) { /* notification only */ }
        const name = application.first_name;
        const success = document.getElementById('join-success');
        const nameSlot = document.getElementById('success-name');
        if (nameSlot) nameSlot.textContent = name ? (', ' + name.split(' ')[0]) : '';
        form.style.display = 'none';
        if (success) {
          success.classList.add('show');
          window.scrollTo({ top: Math.max(0, success.getBoundingClientRect().top + window.scrollY - 120), behavior: 'smooth' });
        }
      }).catch(function () {
        if (errEl) errEl.style.display = 'block';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
      });
    });
  }

  /* ---------- footer year ---------- */
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
