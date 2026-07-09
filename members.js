/* ===========================================================
   Mosaic, members area
   Auth (magic link), pitch submission with the AI quality gate,
   discussion + voting, and officer tools. Talks to Supabase; the
   only server secret (the Gemini key) lives in the submit-pitch
   Edge Function, never here.

   >>> FILL THESE IN (see PHASE2-SETUP.md). The anon key is safe to
       ship publicly; row-level security is what protects the data.
   =========================================================== */
var SUPABASE_URL = 'https://acormyhaxaerwbkzcvag.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_W4wKpdrhSlVWJVKrC8T6wQ_09Jcl_WI';

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var flash = $('#flash');
  var configured = SUPABASE_URL.indexOf('YOUR-') === -1 && SUPABASE_ANON_KEY.indexOf('YOUR-') === -1;

  if (!configured) {
    $('#cfg-warning').style.display = 'block';
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var me = null;          // profile row
  var memberCount = 0;
  var openHoldings = [];

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d)) return esc(v);
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function fromNow(v) {
    var ms = new Date(v) - new Date();
    if (isNaN(ms)) return '';
    if (ms <= 0) return 'closing';
    var days = Math.floor(ms / 86400000);
    var hrs = Math.floor((ms % 86400000) / 3600000);
    if (days >= 1) return days + (days === 1 ? ' day' : ' days') + ' left';
    if (hrs >= 1) return hrs + (hrs === 1 ? ' hour' : ' hours') + ' left';
    return 'under an hour left';
  }
  function say(msg, kind) {
    flash.className = 'notice' + (kind ? ' notice--' + kind : '');
    flash.innerHTML = msg;
    flash.style.display = 'block';
  }
  function clearSay() { flash.style.display = 'none'; }

  var PILLS = {
    in_discussion: ['pill--discussion', 'In discussion'],
    voting: ['pill--voting', 'Voting open'],
    approved_pending_execution: ['pill--approved', 'Approved, pending execution'],
    executed: ['pill--approved', 'Executed'],
    declined: ['pill--declined', 'Declined'],
    expired: ['pill--closed', 'Expired']
  };

  /* ---------- auth ---------- */
  $('#signin-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#email').value.trim();
    if (!email) return;
    sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: window.location.href.split('#')[0] }
    }).then(function (res) {
      if (res.error) say('Could not send the link: ' + esc(res.error.message), 'warn');
      else say('Check <b>' + esc(email) + '</b> for a sign-in link. You can close this tab.', 'ok');
    });
  });

  $('#nav-signout').addEventListener('click', function (e) {
    e.preventDefault();
    sb.auth.signOut().then(function () { location.reload(); });
  });

  sb.auth.onAuthStateChange(function () { boot(); });
  boot();

  function boot() {
    sb.auth.getSession().then(function (res) {
      var session = res.data.session;
      if (!session) return showSignedOut();
      sb.from('profiles').select('*').eq('id', session.user.id).single()
        .then(function (r) {
          me = r.data;
          if (!me || !me.active || ['member', 'officer'].indexOf(me.role) === -1) {
            showSignedOut();
            say('You\'re signed in as <b>' + esc(session.user.email) + '</b>, but that email isn\'t on the member '
              + 'list yet. Ask an officer to add you, then sign in again.', 'warn');
            $('#nav-signout-wrap').style.display = '';
            return;
          }
          showApp();
        });
    });
  }

  function showSignedOut() {
    $('#view-auth').style.display = '';
    $('#view-app').style.display = 'none';
    $('#nav-signout-wrap').style.display = 'none';
  }

  function showApp() {
    clearSay();
    $('#view-auth').style.display = 'none';
    $('#view-app').style.display = '';
    $('#nav-signout-wrap').style.display = '';
    $('#members-sub').textContent = 'Signed in as ' + me.first_name + ' ' + me.last_initial + '. '
      + (me.role === 'officer' ? 'You have officer tools.' : 'One member, one vote.');
    if (me.role === 'officer') $('#tab-officer').style.display = '';

    sb.rpc('active_member_count').then(function (r) { memberCount = r.data || 0; });
    loadHoldings();
    loadPitches();
  }

  /* ---------- tabs ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.mtab'), function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mtab').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.mtab-panel').forEach(function (p) {
        p.style.display = p.getAttribute('data-panel') === tab ? '' : 'none';
      });
      if (tab === 'pitches') loadPitches();
      if (tab === 'officer') loadOfficer();
    });
  });

  /* ---------- holdings (for sell pitches + officer export) ---------- */
  function loadHoldings() {
    sb.from('holdings').select('*').eq('status', 'open').order('date_added')
      .then(function (r) {
        openHoldings = r.data || [];
        var sel = $('#p-holding');
        sel.innerHTML = openHoldings.map(function (h) {
          return '<option value="' + h.id + '">' + esc(h.ticker) + (h.company ? ' (' + esc(h.company) + ')' : '') + '</option>';
        }).join('');
      });
  }

  $('#p-type').addEventListener('change', function () {
    $('#holding-wrap').style.display = this.value === 'sell' ? '' : 'none';
  });

  /* ---------- submit a pitch (AI gate) ---------- */
  $('#pitch-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#pitch-submit');
    var fb = $('#ai-feedback');
    fb.style.display = 'none';
    var body = {
      ticker: $('#p-ticker').value.trim(),
      pitch_type: $('#p-type').value,
      thesis: $('#p-thesis').value.trim(),
      key_risks: $('#p-risks').value.trim(),
      valuation: $('#p-val').value.trim()
    };
    if (body.pitch_type === 'sell') body.related_holding = $('#p-holding').value || null;

    btn.disabled = true; btn.textContent = 'Checking...';
    sb.functions.invoke('submit-pitch', { body: body }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Run quality check & submit';
      var data = res.data, err = res.error;
      if (err) { say('Something went wrong: ' + esc(err.message || 'please try again'), 'warn'); return; }
      if (data && data.error) { say(esc(data.error), 'warn'); return; }

      if (data && data.needs_revision) {
        var f = data.feedback, c = data.checks || {};
        fb.innerHTML =
          '<b>Almost there, revise and resubmit.</b> The reviewer wants a bit more before this goes to the club:' +
          '<ul>' +
          '<li><span class="' + (c.thesis_ok ? 'ok' : 'no') + '">Thesis</span> ' + esc(f.thesis) + '</li>' +
          '<li><span class="' + (c.risks_ok ? 'ok' : 'no') + '">Risks</span> ' + esc(f.risks) + '</li>' +
          '<li><span class="' + (c.valuation_ok ? 'ok' : 'no') + '">Valuation</span> ' + esc(f.valuation) + '</li>' +
          '</ul>';
        fb.style.display = 'block';
        fb.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // success
      $('#pitch-form').reset();
      $('#holding-wrap').style.display = 'none';
      say('Pitch submitted. It\'s now in discussion for the club to weigh in before voting opens.', 'ok');
      document.querySelector('.mtab[data-tab="pitches"]').click();
    });
  });

  /* ---------- pitch list + detail ---------- */
  function loadPitches() {
    var list = $('#pitch-list');
    list.innerHTML = '<p class="load-err">Loading pitches...</p>';
    Promise.all([
      sb.from('pitches').select('*').order('created_at', { ascending: false }),
      sb.from('votes').select('pitch_id, voter_id, choice')
    ]).then(function (out) {
      var pitches = out[0].data || [];
      var votes = out[1].data || [];
      if (out[0].error) { list.innerHTML = '<p class="load-err">Could not load pitches.</p>'; return; }
      if (!pitches.length) { list.innerHTML = '<p class="load-err">No pitches yet. Be the first, use the “Submit a pitch” tab.</p>'; return; }
      list.innerHTML = pitches.map(function (p) { return pitchCard(p, votes); }).join('');
      wireVoteButtons();
    });
  }

  function pitchCard(p, votes) {
    var pv = votes.filter(function (v) { return v.pitch_id === p.id; });
    var yes = pv.filter(function (v) { return v.choice === 'yes'; }).length;
    var no = pv.length - yes;
    var mine = pv.filter(function (v) { return v.voter_id === me.id; })[0];
    var pill = PILLS[p.status] || ['pill--closed', p.status];
    var typeLabel = p.pitch_type === 'sell' ? 'Sell' : p.pitch_type === 'review' ? '6-month review' : 'Buy';

    var timing = '';
    if (p.status === 'in_discussion') timing = 'Discussion: ' + fromNow(p.discussion_ends_at) + ' before voting opens';
    else if (p.status === 'voting') timing = 'Voting: ' + fromNow(p.voting_ends_at);

    var counter = p.ai_counterargument
      ? '<div class="counter"><b>Devil\'s advocate</b>' + esc(p.ai_counterargument) + '</div>' : '';

    // vote block
    var voteBlock = '';
    if (p.status === 'voting') {
      if (mine) {
        voteBlock = '<p class="voted">You voted <b>' + (mine.choice === 'yes' ? 'Yes' : 'No') + '</b>.</p>';
      } else {
        voteBlock =
          '<div class="vote-actions" data-pitch="' + p.id + '">' +
          '<button class="btn btn--gold vote-btn" data-choice="yes">Vote Yes</button>' +
          '<button class="btn btn--ghost vote-btn" data-choice="no">Vote No</button>' +
          '</div>';
      }
    }

    // tally bar (visible once anyone has voted)
    var tally = '';
    if (pv.length) {
      var total = pv.length;
      var pctYes = Math.round(yes / total * 100);
      var need = memberCount ? Math.ceil(0.30 * memberCount) : 0; // display hint; real threshold from config server-side
      tally =
        '<div class="tally">' +
          '<div class="bar"><span style="width:' + pctYes + '%"></span></div>' +
          '<div class="tally-meta"><span>' + yes + ' yes / ' + no + ' no</span>' +
          '<span>' + total + ' vote' + (total === 1 ? '' : 's') + ' cast</span></div>' +
        '</div>';
    }

    var outcome = '';
    if (p.status === 'approved_pending_execution')
      outcome = '<p class="voted">Passed. Waiting for an officer to execute.</p>';
    else if (p.status === 'executed')
      outcome = '<p class="voted">Executed and recorded in the portfolio.</p>';
    else if (p.status === 'declined')
      outcome = '<p class="voted">Did not pass. On to the next one, the reasoning is the win.</p>';

    return '<article class="pitch-card">' +
      '<div class="h-top">' +
        '<div class="h-id"><span class="h-tick">' + esc(p.ticker) + '</span>' +
          '<span class="h-co">' + typeLabel + (p.submitted_by ? '' : ' · auto') + '</span></div>' +
        '<span class="pill ' + pill[0] + '">' + pill[1] + '</span>' +
      '</div>' +
      (timing ? '<p class="timing">' + timing + '</p>' : '') +
      '<div class="pfield"><b>Thesis</b>' + esc(p.thesis) + '</div>' +
      '<div class="pfield"><b>Key risks</b>' + esc(p.key_risks) + '</div>' +
      '<div class="pfield"><b>Valuation</b>' + esc(p.valuation) + '</div>' +
      counter + tally + voteBlock + outcome +
    '</article>';
  }

  function wireVoteButtons() {
    document.querySelectorAll('.vote-actions').forEach(function (box) {
      var pid = box.getAttribute('data-pitch');
      box.querySelectorAll('.vote-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          box.querySelectorAll('.vote-btn').forEach(function (x) { x.disabled = true; });
          sb.from('votes').insert({ pitch_id: pid, voter_id: me.id, choice: b.getAttribute('data-choice') })
            .then(function (r) {
              if (r.error) {
                if ((r.error.message || '').match(/duplicate|unique/i)) say('You\'ve already voted on that pitch.', 'warn');
                else say('Could not record your vote: ' + esc(r.error.message), 'warn');
                loadPitches();
                return;
              }
              say('Vote recorded.', 'ok');
              loadPitches();
            });
        });
      });
    });
  }

  /* ---------- officer tools ---------- */
  function loadOfficer() {
    if (me.role !== 'officer') return;
    var panel = $('#officer-panel');
    panel.innerHTML = '<p class="load-err">Loading...</p>';
    Promise.all([
      sb.from('member_allowlist').select('*').order('added_at'),
      sb.from('profiles').select('*').order('created_at'),
      sb.from('app_config').select('*').single(),
      sb.from('pitches').select('*').eq('status', 'approved_pending_execution').order('updated_at')
    ]).then(function (out) {
      var allow = out[0].data || [], profiles = out[1].data || [], cfg = out[2].data || {}, pending = out[3].data || [];

      panel.innerHTML =
        officerConfig(cfg) +
        officerExecute(pending) +
        officerAllowlist(allow) +
        officerMembers(profiles) +
        officerExports();

      wireOfficer(cfg);
    });
  }

  function officerConfig(cfg) {
    return '<section class="ocard"><h3>Voting rules</h3>' +
      '<div class="ogrid">' +
      cfgField('discussion_days', 'Discussion days', cfg.discussion_days) +
      cfgField('voting_days', 'Voting days', cfg.voting_days) +
      cfgField('quorum_pct', 'Quorum %', cfg.quorum_pct) +
      cfgField('approval_pct', 'Approval %', cfg.approval_pct) +
      cfgField('holding_review_months', 'Review after (months)', cfg.holding_review_months) +
      '</div><button class="btn" id="cfg-save">Save rules</button></section>';
  }
  function cfgField(name, label, val) {
    return '<div class="field"><label>' + label + '</label>' +
      '<input type="number" id="cfg-' + name + '" value="' + esc(val) + '"></div>';
  }

  function officerExecute(pending) {
    var rows = pending.length ? pending.map(function (p) {
      return '<li><span><b>' + esc(p.ticker) + '</b> · ' + (p.pitch_type === 'buy' ? 'Buy' : 'Sell/Exit') + '</span>' +
        '<button class="btn btn--gold exec-btn" data-id="' + p.id + '" data-type="' + p.pitch_type + '">Mark executed</button></li>';
    }).join('') : '<li class="muted">Nothing waiting on execution.</li>';
    return '<section class="ocard"><h3>Approved, pending execution</h3>' +
      '<p class="muted">Approved pitches never trade automatically. After you place the trade in the real account, mark it executed here, that\'s what adds it to (or removes it from) the portfolio.</p>' +
      '<ul class="olist">' + rows + '</ul></section>';
  }

  function officerAllowlist(allow) {
    var rows = allow.map(function (a) {
      return '<li><span><b>' + esc(a.email) + '</b> · ' + esc(a.role) + '</span>' +
        '<button class="btn btn--ghost del-allow" data-email="' + esc(a.email) + '">Remove</button></li>';
    }).join('') || '<li class="muted">No one on the allowlist yet.</li>';
    return '<section class="ocard"><h3>Member allowlist</h3>' +
      '<p class="muted">Only emails here can sign in and vote.</p>' +
      '<ul class="olist">' + rows + '</ul>' +
      '<div class="ogrid">' +
        '<div class="field"><label>Email</label><input type="email" id="al-email" placeholder="student@example.com"></div>' +
        '<div class="field"><label>First name</label><input type="text" id="al-first"></div>' +
        '<div class="field"><label>Last initial</label><input type="text" id="al-last" maxlength="1"></div>' +
        '<div class="field"><label>Role</label><select id="al-role"><option value="member">member</option><option value="officer">officer</option></select></div>' +
      '</div><button class="btn" id="al-add">Add to allowlist</button></section>';
  }

  function officerMembers(profiles) {
    var rows = profiles.map(function (p) {
      return '<li><span><b>' + esc((p.first_name || '') + ' ' + (p.last_initial || '')) + '</b> · ' +
        esc(p.email) + ' · ' + esc(p.role) + (p.active ? '' : ' · inactive') + '</span>' +
        '<button class="btn btn--ghost toggle-active" data-id="' + p.id + '" data-active="' + p.active + '">' +
        (p.active ? 'Deactivate' : 'Reactivate') + '</button></li>';
    }).join('') || '<li class="muted">No one has signed in yet.</li>';
    return '<section class="ocard"><h3>Members who have signed in</h3><ul class="olist">' + rows + '</ul></section>';
  }

  function officerExports() {
    return '<section class="ocard"><h3>Publish to the public site</h3>' +
      '<p class="muted">Download the current data as the two JSON files the public pages read, then commit them to the repo.</p>' +
      '<div class="obtns"><button class="btn" id="exp-portfolio">Export portfolio-data.json</button>' +
      '<button class="btn" id="exp-pitches">Export pitches.json</button></div></section>';
  }

  function wireOfficer(cfg) {
    $('#cfg-save').addEventListener('click', function () {
      var patch = {};
      ['discussion_days', 'voting_days', 'quorum_pct', 'approval_pct', 'holding_review_months'].forEach(function (k) {
        patch[k] = Number($('#cfg-' + k).value);
      });
      patch.updated_at = new Date().toISOString();
      sb.from('app_config').update(patch).eq('id', true).then(function (r) {
        say(r.error ? 'Could not save: ' + esc(r.error.message) : 'Voting rules saved.', r.error ? 'warn' : 'ok');
      });
    });

    document.querySelectorAll('.exec-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var learned = null;
        if (b.getAttribute('data-type') !== 'buy') {
          learned = prompt('Optional: what did we learn from this exit? (added to the closed position)') || null;
        }
        b.disabled = true;
        sb.rpc('execute_pitch', { p_id: b.getAttribute('data-id'), p_what_we_learned: learned })
          .then(function (r) {
            say(r.error ? 'Could not execute: ' + esc(r.error.message) : 'Marked executed.', r.error ? 'warn' : 'ok');
            loadOfficer(); loadHoldings();
          });
      });
    });

    $('#al-add').addEventListener('click', function () {
      var email = $('#al-email').value.trim();
      if (!email) return;
      sb.from('member_allowlist').upsert({
        email: email.toLowerCase(),
        role: $('#al-role').value,
        first_name: $('#al-first').value.trim(),
        last_initial: $('#al-last').value.trim()
      }).then(function (r) {
        say(r.error ? 'Could not add: ' + esc(r.error.message) : 'Added ' + esc(email) + '.', r.error ? 'warn' : 'ok');
        loadOfficer();
      });
    });

    document.querySelectorAll('.del-allow').forEach(function (b) {
      b.addEventListener('click', function () {
        sb.from('member_allowlist').delete().eq('email', b.getAttribute('data-email'))
          .then(function () { loadOfficer(); });
      });
    });

    document.querySelectorAll('.toggle-active').forEach(function (b) {
      b.addEventListener('click', function () {
        var makeActive = b.getAttribute('data-active') !== 'true';
        sb.from('profiles').update({ active: makeActive }).eq('id', b.getAttribute('data-id'))
          .then(function (r) {
            if (r.error) say('Could not update: ' + esc(r.error.message), 'warn');
            loadOfficer();
          });
      });
    });

    $('#exp-portfolio').addEventListener('click', exportPortfolio);
    $('#exp-pitches').addEventListener('click', exportPitches);
  }

  function download(name, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function iso(d) { return d ? new Date(d).toISOString().slice(0, 10) : null; }

  function exportPortfolio() {
    sb.from('holdings').select('*').order('date_added', { ascending: false }).then(function (r) {
      var h = r.data || [];
      var out = {
        _note: 'Exported from the members area. Fill in any missing company/sector before publishing.',
        sampleData: false,
        asOf: new Date().toISOString().slice(0, 10),
        holdings: h.map(function (x) {
          var o = {
            ticker: x.ticker, company: x.company || '', sector: x.sector || '',
            dateAdded: iso(x.date_added), pitchedBy: x.pitched_by || '',
            status: x.status, thesis: x.thesis || ''
          };
          if (x.status === 'closed') { o.dateClosed = iso(x.date_closed); o.whatWeLearned = x.what_we_learned || ''; }
          return o;
        })
      };
      download('portfolio-data.json', out);
    });
  }

  function exportPitches() {
    sb.from('pitches').select('*').order('created_at', { ascending: false }).then(function (r) {
      var map = { in_discussion: 'in discussion', voting: 'voting soon',
        approved_pending_execution: 'approved', executed: 'approved', declined: 'declined' };
      var out = {
        _note: 'Exported from the members area. Public, read-only pitch board.',
        sampleData: false,
        pitches: (r.data || []).filter(function (p) { return map[p.status]; }).map(function (p) {
          return {
            ticker: p.ticker, pitcher: p.submitted_by ? 'Member' : 'Auto review',
            date: iso(p.created_at), status: map[p.status],
            thesisSummary: p.thesis, keyRisks: p.key_risks
          };
        })
      };
      download('pitches.json', out);
    });
  }
})();
