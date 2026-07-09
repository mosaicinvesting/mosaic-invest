/* ===========================================================
   Mosaic, portfolio page
   Renders the public holdings from portfolio-data.json so
   students can update them without touching HTML. The live
   pitches & voting section is handled by members.js.
   =========================================================== */
(function () {
  'use strict';

  var holdingsGrid = document.getElementById('holdings-grid');
  var closedGrid = document.getElementById('closed-grid');
  var closedSection = document.getElementById('closed-section');
  var sampleNote = document.getElementById('sample-note');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function fmtDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return esc(iso);
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }

  function markSample(data) {
    if (data && data.sampleData && sampleNote) sampleNote.classList.add('show');
  }

  function fail(el, what) {
    if (el) el.innerHTML = '<p class="load-err">Could not load ' + what +
      '. If you opened this page directly from disk, view the published site or run a local server instead.</p>';
  }

  /* ---------- holdings ---------- */
  function holdingCard(h) {
    var closed = h.status === 'closed';
    return '<article class="holding-card">' +
      '<div class="h-top">' +
        '<div class="h-id"><span class="h-tick">' + esc(h.ticker) + '</span>' +
        '<span class="h-co">' + esc(h.company) + '</span></div>' +
        '<div class="h-tags">' +
          (h.sector ? '<span class="tag">' + esc(h.sector) + '</span>' : '') +
          (closed ? '<span class="pill pill--closed">Closed</span>' : '') +
        '</div>' +
      '</div>' +
      '<p class="h-thesis">' + esc(h.thesis) + '</p>' +
      (closed && h.whatWeLearned
        ? '<div class="lesson"><b>What we learned</b><p>' + esc(h.whatWeLearned) + '</p></div>'
        : '') +
      '<div class="h-meta">' +
        (h.pitchedBy ? '<span>Pitched by <b>' + esc(h.pitchedBy) + '</b></span>' : '') +
        (h.dateAdded ? '<span>Added ' + fmtDate(h.dateAdded) + '</span>' : '') +
        (closed && h.dateClosed ? '<span>Exited ' + fmtDate(h.dateClosed) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  fetch('portfolio-data.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      markSample(data);

      var asof = document.getElementById('asof-date');
      if (asof && data.asOf) asof.textContent = fmtDate(data.asOf);

      var holdings = data.holdings || [];
      var open = holdings.filter(function (h) { return h.status !== 'closed'; });
      var closed = holdings.filter(function (h) { return h.status === 'closed'; });

      holdingsGrid.innerHTML = open.length
        ? open.map(holdingCard).join('')
        : '<p class="load-err">No current holdings listed yet.</p>';

      if (closed.length) {
        closedGrid.innerHTML = closed.map(holdingCard).join('');
      } else if (closedSection) {
        closedSection.style.display = 'none';
      }
    })
    .catch(function () {
      var line = document.getElementById('asof-line');
      if (line) line.style.display = 'none';
      if (closedSection) closedSection.style.display = 'none';
      fail(holdingsGrid, 'portfolio data');
    });
})();
