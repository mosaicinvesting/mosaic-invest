/* ===========================================================
   Mosaic, Our Impact page
   Reads the public impact_summary view (aggregates only, never
   a raw row) and renders stat tiles plus a before/after
   confidence chart per course. Shows an honest empty state if
   there isn't enough data yet, including whenever this page is
   opened from disk instead of the published site.
   =========================================================== */
(function () {
  'use strict';

  var TEAL = '#0083A8';
  var GOLD = '#E09F37';
  var MIN_STARTS_TO_SHOW = 5;

  var COURSES = [
    { key: 'foundations', label: 'Investing Foundations' },
    { key: 'markets', label: 'Markets 101' }
  ];

  var loadingEl = document.getElementById('impact-loading');
  var emptyEl = document.getElementById('impact-empty');
  var contentEl = document.getElementById('impact-content');

  function showEmpty() {
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
  }

  function showContent() {
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  if (!window.MOSAIC_SB) { showEmpty(); return; }

  fetch(window.MOSAIC_SB.url + '/rest/v1/impact_summary?select=*', {
    headers: { apikey: window.MOSAIC_SB.key, Authorization: 'Bearer ' + window.MOSAIC_SB.key }
  })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (rows) {
      var byCourse = {};
      (rows || []).forEach(function (r) { byCourse[r.course] = r; });

      var totalStarts = 0, totalCompletions = 0;
      (rows || []).forEach(function (r) {
        totalStarts += r.starts || 0;
        totalCompletions += r.completions || 0;
      });

      if (totalStarts < MIN_STARTS_TO_SHOW) { showEmpty(); return; }

      showContent();
      setText('stat-starts', totalStarts.toLocaleString('en-US'));
      setText('stat-completions', totalCompletions.toLocaleString('en-US'));
      setText('stat-rate', totalStarts ? Math.round((totalCompletions / totalStarts) * 100) + '%' : '0%');

      COURSES.forEach(function (c) {
        var section = document.getElementById('course-' + c.key);
        var chartWrap = document.getElementById('chart-' + c.key);
        var row = byCourse[c.key];
        if (!section || !chartWrap) return;
        if (!row || !row.starts) { section.style.display = 'none'; return; }
        renderCourseChart(chartWrap, row, c.label);
        renderCourseTable(document.getElementById('table-' + c.key), row);
      });
    })
    .catch(function () { showEmpty(); });

  /* ---------- rounded-top bar path (4px, anchored to baseline) ---------- */
  function roundedTopRect(x, y, width, height, r) {
    if (height <= 0) return '';
    r = Math.min(r, width / 2, height);
    return 'M' + x + ',' + (y + height) +
      ' L' + x + ',' + (y + r) +
      ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      ' L' + (x + width - r) + ',' + y +
      ' Q' + (x + width) + ',' + y + ' ' + (x + width) + ',' + (y + r) +
      ' L' + (x + width) + ',' + (y + height) +
      ' Z';
  }

  function renderCourseChart(wrap, row, label) {
    var before = row.avg_confidence_before, after = row.avg_confidence_after;
    var hasBefore = before !== null && before !== undefined;
    var hasAfter = after !== null && after !== undefined;

    if (!hasBefore && !hasAfter) {
      wrap.innerHTML = '<p class="impact-nodata">Not enough responses yet for ' + label + '.</p>';
      return;
    }

    var w = wrap.clientWidth || 380, h = 240;
    var padL = 34, padR = 16, padT = 20, padB = 34;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var max = 10;
    function sy(v) { return padT + (1 - v / max) * plotH; }

    var barW = Math.min(72, plotW * 0.28);
    var gap = 20;
    var groupW = barW * 2 + gap;
    var startX = padL + (plotW - groupW) / 2;

    var svg = '<svg width="' + w + '" height="' + h + '" role="img" aria-label="' +
      label + ': self-reported confidence before and after, on a 1 to 10 scale">';

    [0, 5, 10].forEach(function (v) {
      var y = sy(v);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y +
        '" stroke="#F0ECE2" stroke-width="1"/>';
      svg += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#6B7B78">' + v + '</text>';
    });

    if (hasBefore) {
      var bh = plotH * (before / max), by = padT + plotH - bh, bx = startX;
      svg += '<path d="' + roundedTopRect(bx, by, barW, bh, 4) + '" fill="' + TEAL + '"/>';
      svg += '<text x="' + (bx + barW / 2) + '" y="' + (by - 8) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#18333C">' + before + '</text>';
      svg += '<text x="' + (bx + barW / 2) + '" y="' + (padT + plotH + 22) + '" text-anchor="middle" font-size="12.5" fill="#41524F">Before</text>';
    }
    if (hasAfter) {
      var bx2 = startX + barW + gap, bh2 = plotH * (after / max), by2 = padT + plotH - bh2;
      svg += '<path d="' + roundedTopRect(bx2, by2, barW, bh2, 4) + '" fill="' + GOLD + '"/>';
      svg += '<text x="' + (bx2 + barW / 2) + '" y="' + (by2 - 8) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#18333C">' + after + '</text>';
      svg += '<text x="' + (bx2 + barW / 2) + '" y="' + (padT + plotH + 22) + '" text-anchor="middle" font-size="12.5" fill="#41524F">After</text>';
    }
    svg += '</svg>';
    wrap.innerHTML = svg;

    if (!hasAfter) {
      wrap.insertAdjacentHTML('beforeend', '<p class="impact-nodata">Not enough course completions yet to show an "after" average.</p>');
    }
  }

  function renderCourseTable(table, row) {
    if (!table) return;
    table.innerHTML = '';
    var thr = table.insertRow();
    ['Course starts', 'Course completions', 'Avg. confidence before', 'Avg. confidence after'].forEach(function (txt) {
      var th = document.createElement('th'); th.textContent = txt; thr.appendChild(th);
    });
    var tr = table.insertRow();
    tr.insertCell().textContent = row.starts || 0;
    tr.insertCell().textContent = row.completions || 0;
    var c3 = tr.insertCell(); c3.textContent = row.avg_confidence_before != null ? row.avg_confidence_before + ' / 10' : '—';
    var c4 = tr.insertCell(); c4.textContent = row.avg_confidence_after != null ? row.avg_confidence_after + ' / 10' : '—';
  }

  window.addEventListener('resize', function () {
    // re-render is cheap and avoids stale widths after a layout change
    var evt = new Event('mosaic-impact-resize');
    document.dispatchEvent(evt);
  });
})();
