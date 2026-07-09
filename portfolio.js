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

      initChart(data.valueHistory || []);
    })
    .catch(function () {
      var line = document.getElementById('asof-line');
      if (line) line.style.display = 'none';
      if (closedSection) closedSection.style.display = 'none';
      var perf = document.getElementById('performance');
      if (perf) perf.style.display = 'none';
      fail(holdingsGrid, 'portfolio data');
    });

  /* ===========================================================
     Performance chart: interactive single-series line chart of
     officer-logged portfolio value snapshots (valueHistory).
     Line #0083A8 and delta green #1F8A45 / red #B4441F are
     palette-validator-passing steps of the brand hues.
     =========================================================== */
  var CHART_LINE = '#0083A8';
  var MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function initChart(history) {
    var section = document.getElementById('performance');
    var card = document.getElementById('chart-card');
    var wrap = document.getElementById('chart-wrap');
    if (!section || !card || !wrap) return;

    var pts = (history || []).map(function (p) {
      return { t: new Date(String(p.date) + 'T00:00:00').getTime(), date: String(p.date), v: +p.value };
    }).filter(function (p) { return isFinite(p.t) && isFinite(p.v); })
      .sort(function (a, b) { return a.t - b.t; });

    if (pts.length < 2) { section.style.display = 'none'; return; }
    card.style.display = '';

    var range = 'all';

    // tooltip (values lead, label follows), text set via textContent only
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    var tipVal = document.createElement('b');
    var tipDate = document.createElement('span');
    tip.appendChild(tipVal); tip.appendChild(tipDate);

    function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
    function dShort(iso) {
      var p = iso.split('-');
      return MONTHS_S[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
    }

    function sliceFor(r) {
      if (r === 'all') return pts;
      var cutoff = pts[pts.length - 1].t - r * 30.44 * 86400000;
      var s = pts.filter(function (p) { return p.t >= cutoff; });
      return s.length >= 2 ? s : pts.slice(-2);
    }

    function niceStep(raw) {
      var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
      var n = raw / mag;
      return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
    }

    function yTicks(min, max) {
      var pad = (max - min) * 0.06 || 1;
      min -= pad; max += pad;
      var step = niceStep((max - min) / 4);
      var t0 = Math.floor(min / step) * step;
      var ticks = [];
      for (var v = t0; v < max + step * 0.5; v += step) ticks.push(v);
      return ticks;
    }

    function render() {
      var s = sliceFor(range);
      var first = s[0], last = s[s.length - 1];

      // stat header
      var valEl = document.getElementById('chart-value');
      var deltaEl = document.getElementById('chart-delta');
      valEl.textContent = money(last.v);
      var diff = last.v - first.v;
      var pct = first.v ? (diff / first.v) * 100 : 0;
      var up = diff >= 0;
      var label = range === 'all' ? 'since ' + dShort(first.date)
        : 'past ' + (range === 1 ? 'month' : range + ' months');
      deltaEl.textContent = (up ? '▲ +$' : '▼ −$') +
        Math.round(Math.abs(diff)).toLocaleString('en-US') +
        ' (' + (up ? '+' : '−') + Math.abs(pct).toFixed(1) + '%) · ' + label;
      deltaEl.className = 'chart-delta ' + (up ? 'up' : 'down');

      // geometry
      var w = wrap.clientWidth || 640;
      var h = w < 560 ? 240 : 300;
      var padL = 62, padR = 16, padT = 14, padB = 30;
      var plotW = w - padL - padR, plotH = h - padT - padB;

      var ticks = yTicks(
        Math.min.apply(null, s.map(function (p) { return p.v; })),
        Math.max.apply(null, s.map(function (p) { return p.v; }))
      );
      var y0 = ticks[0], y1 = ticks[ticks.length - 1];
      var t0 = first.t, t1 = last.t;
      function sx(t) { return padL + (t - t0) / (t1 - t0 || 1) * plotW; }
      function sy(v) { return padT + (1 - (v - y0) / (y1 - y0 || 1)) * plotH; }

      var svg = '<svg width="' + w + '" height="' + h + '" role="img" aria-label="Line chart of portfolio value from ' +
        dShort(first.date) + ' to ' + dShort(last.date) + '">';

      // recessive gridlines + y labels (text tokens, never the series color)
      ticks.forEach(function (v) {
        var y = sy(v);
        svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y +
          '" stroke="#F0ECE2" stroke-width="1"/>';
        svg += '<text x="' + (padL - 10) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#6B7B78">' +
          money(v) + '</text>';
      });

      // x labels: up to 6 evenly spaced dates
      var nx = Math.min(6, s.length);
      for (var i = 0; i < nx; i++) {
        var p = s[Math.round(i * (s.length - 1) / (nx - 1 || 1))];
        var parts = p.date.split('-');
        svg += '<text x="' + sx(p.t) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="#6B7B78">' +
          MONTHS_S[+parts[1] - 1] + ' ' + (+parts[2]) + '</text>';
      }

      // area wash (~10% opacity) + 2px line, round joins
      var lineD = s.map(function (p, idx) { return (idx ? 'L' : 'M') + sx(p.t).toFixed(1) + ' ' + sy(p.v).toFixed(1); }).join(' ');
      var areaD = lineD + ' L' + sx(last.t).toFixed(1) + ' ' + (padT + plotH) + ' L' + sx(first.t).toFixed(1) + ' ' + (padT + plotH) + ' Z';
      svg += '<path d="' + areaD + '" fill="' + CHART_LINE + '" opacity="0.1"/>';
      svg += '<path d="' + lineD + '" fill="none" stroke="' + CHART_LINE + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

      // end marker with 2px surface ring
      svg += '<circle cx="' + sx(last.t) + '" cy="' + sy(last.v) + '" r="4.5" fill="' + CHART_LINE + '" stroke="#fff" stroke-width="2"/>';

      // crosshair + focus dot (hidden until hover)
      svg += '<line id="ch-x" y1="' + padT + '" y2="' + (padT + plotH) + '" stroke="#41524F" stroke-width="1" opacity="0" />';
      svg += '<circle id="ch-dot" r="4.5" fill="' + CHART_LINE + '" stroke="#fff" stroke-width="2" opacity="0"/>';

      // hover overlay: the whole plot is the hit target
      svg += '<rect id="ch-overlay" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" fill="transparent"/>';
      svg += '</svg>';

      wrap.innerHTML = svg;
      wrap.appendChild(tip);

      // table view: everything the tooltip shows, reachable without hover
      var table = document.getElementById('chart-table');
      table.innerHTML = '';
      var thr = table.insertRow();
      ['Date', 'Portfolio value'].forEach(function (txt) {
        var th = document.createElement('th'); th.textContent = txt; thr.appendChild(th);
      });
      s.slice().reverse().forEach(function (p) {
        var tr = table.insertRow();
        tr.insertCell().textContent = dShort(p.date);
        var c2 = tr.insertCell(); c2.textContent = money(p.v); c2.className = 'num';
      });

      // crosshair interaction: snap to the nearest data x
      var overlay = wrap.querySelector('#ch-overlay');
      var chx = wrap.querySelector('#ch-x');
      var chdot = wrap.querySelector('#ch-dot');

      function showAt(clientX) {
        var rect = wrap.getBoundingClientRect();
        var x = clientX - rect.left;
        var best = s[0], bd = Infinity;
        s.forEach(function (p) {
          var d = Math.abs(sx(p.t) - x);
          if (d < bd) { bd = d; best = p; }
        });
        var px = sx(best.t), py = sy(best.v);
        chx.setAttribute('x1', px); chx.setAttribute('x2', px); chx.setAttribute('opacity', '0.25');
        chdot.setAttribute('cx', px); chdot.setAttribute('cy', py); chdot.setAttribute('opacity', '1');
        tipVal.textContent = money(best.v);
        tipDate.textContent = dShort(best.date);
        tip.style.display = 'block';
        var left = px + 14;
        if (left + tip.offsetWidth > w - 4) left = px - tip.offsetWidth - 14;
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = Math.max(4, py - tip.offsetHeight - 12) + 'px';
      }
      function hide() {
        chx.setAttribute('opacity', '0');
        chdot.setAttribute('opacity', '0');
        tip.style.display = 'none';
      }
      overlay.addEventListener('pointermove', function (e) { showAt(e.clientX); });
      overlay.addEventListener('pointerleave', hide);
    }

    // range buttons scope the chart, the stat header, and the table together
    document.querySelectorAll('#range-btns .rbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#range-btns .rbtn').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var r = b.getAttribute('data-range');
        range = r === 'all' ? 'all' : +r;
        render();
      });
    });

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(render, 150);
    });

    render();
  }
})();
