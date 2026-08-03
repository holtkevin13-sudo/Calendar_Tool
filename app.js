/* Dormition Fast Companion — vanilla JS, no dependencies, no network calls.
   Fasting data comes from the GOARCH Planner ICS for the 2025-2026 ecclesiastical year. */
(function () {
  'use strict';

  var NS = 'dfc.v1.';
  var DATA = { year: null, overlay: null, meals: null, recipes: null, byDate: {}, ov: {} };
  var state = {
    view: 'today', filter: 'all', level: 'strict', tag: '', plan: 'A',
    month: null, span: 'fast', indexSet: 'great', pantry: []
  };

  /* ---------- storage ---------- */
  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function set(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ---------- IndexedDB, for the two feast icons ---------- */
  var IDB = (function () {
    var dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        var r = indexedDB.open('dfc-icons', 1);
        r.onupgradeneeded = function () {
          if (!r.result.objectStoreNames.contains('icons')) r.result.createObjectStore('icons');
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
      return dbp;
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction('icons', mode);
          var req = fn(t.objectStore('icons'));
          req.onsuccess = function () { res(req.result); };
          req.onerror = function () { rej(req.error); };
        });
      });
    }
    return {
      put: function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); },
      get: function (k) { return tx('readonly', function (s) { return s.get(k); }); },
      del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }); }
    };
  })();

  /* ---------- DOM helpers (no innerHTML anywhere) ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function link(href, text) {
    var a = el('a', null, text);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  function btn(cls, text, fn) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------- favourite meals ---------- */
  function favKey(level, id) { return 'fav.' + level + '|' + id; }
  function isFav(level, id) { return !!get(favKey(level, id), false); }
  function toggleFav(level, id) {
    var now = !isFav(level, id);
    if (now) set(favKey(level, id), true); else localStorage.removeItem(NS + favKey(level, id));
    return now;
  }
  function favCount(level) {
    return (DATA.meals.levels[level] || []).filter(function (m) { return isFav(level, m.id); }).length;
  }

  /* ---------- dates ---------- */
  var DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function parseISO(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayISO() { return isoOf(new Date()); }
  function longDate(iso) {
    var d = parseISO(iso);
    return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function shortDate(iso) {
    var d = parseISO(iso);
    return MON[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }

  var SYM = { 'strict': '✕', 'wine-oil': '◑', 'fish-oil-wine': '◆', 'dairy': '◐', 'fast-free': '★', 'none': '·' };
  var CLS = { 'strict': 'b-strict', 'wine-oil': 'b-wine-oil', 'fish-oil-wine': 'b-fish', 'dairy': 'b-dairy', 'fast-free': 'b-free', 'none': 'b-none' };
  var LEGEND_ORDER = ['strict', 'wine-oil', 'fish-oil-wine', 'dairy', 'fast-free', 'none'];
  var SWATCH = { 'strict': '#8d2a3c', 'wine-oil': '#c6a15b', 'fish-oil-wine': '#527aa8', 'dairy': '#8b7a68', 'fast-free': '#2f5e35', 'none': '#c9bda8' };

  function lg(levelId) { return DATA.overlay.legend[levelId] || DATA.overlay.legend.none; }

  function badge(levelId, large) {
    var l = lg(levelId);
    var b = el('span', 'badge ' + CLS[levelId] + (large ? ' badge-lg' : ''), l.goarchLabel);
    b.setAttribute('data-sym', SYM[levelId] || '·');
    return b;
  }


  /* Merge the planner day with the Dormition devotional overlay. */
  function dayFor(iso) {
    var base = DATA.byDate[iso];
    if (!base) return null;
    var o = DATA.ov[iso];
    var merged = {
      date: iso,
      title: (o && o.title) || base.title,
      plannerTitle: base.title,
      fastingLevel: base.fastingLevel,
      plannerLabel: base.fastingLabel,
      saints: base.saints || [],
      readings: base.readings || []
    };
    if (o) {
      ['isPersonalMilestone', 'personalMilestoneLabel', 'spiritualFocus',
       'prayerReminder', 'journalPrompt', 'mercyPrompt'].forEach(function (k) {
        if (o[k] !== undefined) merged[k] = o[k];
      });
    }
    merged.inDormitionFast = iso >= DATA.overlay.rangeStart && iso <= DATA.overlay.rangeEnd;
    merged.isGreatFeast = !!base.greatFeast;
    merged.greatFeast = base.greatFeast || null;
    merged.rank = base.rank || 'ordinary';
    merged.cycle = base.cycle || null;
    return merged;
  }

  function seasonFor(iso) {
    var ss = DATA.year.seasons || [];
    for (var i = 0; i < ss.length; i++) {
      if (iso >= ss[i].start && iso <= ss[i].end) return ss[i];
    }
    return null;
  }

  function sourceLine() {
    var p = el('p', 'small');
    p.appendChild(document.createTextNode('Designation, saints and readings from the '));
    p.appendChild(link(DATA.year.sourceUrl, DATA.year.sourceName));
    p.appendChild(document.createTextNode('. Full readings on the '));
    p.appendChild(link(DATA.year.chapelUrl, 'Online Chapel'));
    p.appendChild(document.createTextNode('.'));
    return p;
  }

  function foodColumns(levelId) {
    var l = lg(levelId);
    var wrap = el('div', 'food-cols');
    [['yes', 'Permitted', l.permittedFoods], ['no', 'Set aside', l.restrictedFoods]].forEach(function (pair) {
      var col = el('div', pair[0]);
      col.appendChild(el('h4', null, pair[1]));
      if (!pair[2].length) { col.appendChild(el('p', 'small', 'Nothing is set aside today.')); }
      else {
        var ul = el('ul');
        pair[2].forEach(function (f) { ul.appendChild(el('li', null, f)); });
        col.appendChild(ul);
      }
      wrap.appendChild(col);
    });
    return wrap;
  }

  /* ---------- saved text fields ---------- */
  function fieldGroup(container, key, defs) {
    defs.forEach(function (d) {
      var id = key + '.' + d.k;
      var lab = el('label', 'field-label', d.label);
      lab.htmlFor = 'f_' + id.replace(/\W/g, '_');
      var input = d.long ? el('textarea') : el('input');
      if (!d.long) input.type = d.type || 'text';
      if (d.long && d.rows) input.rows = d.rows;
      input.id = lab.htmlFor;
      input.value = get(id, '');
      if (d.hint) input.placeholder = d.hint;
      var tick = el('span', 'saved-tick', '');
      var t;
      input.addEventListener('input', function () {
        set(id, input.value);
        tick.textContent = 'Saved';
        clearTimeout(t);
        t = setTimeout(function () { tick.textContent = ''; }, 1400);
      });
      lab.appendChild(tick);
      container.appendChild(lab);
      container.appendChild(input);
    });
  }

  /* ---------- original feast emblems ----------
     Ornamental marks drawn in code for each Great Feast. These are decorations
     from this companion, NOT icons: no figures, no faces, nothing canonical.
     Each references the feast's traditional visual language in abstract form. */
  var EMBLEMS = {
    'Nativity of the Theotokos':  [['c',60,52,26],['p','M60 30 L60 74 M38 52 L82 52 M45 37 L75 67 M75 37 L45 67']],
    'Elevation of the Holy Cross':[['p','M60 18 L60 92'],['p','M44 34 L76 34'],['p','M36 48 L84 48'],['p','M46 76 L74 68'],['p','M24 30 L36 42 M96 30 L84 42 M24 74 L36 62 M96 74 L84 62']],
    'Entrance of the Theotokos':  [['p','M36 90 L36 46 Q60 26 84 46 L84 90'],['p','M48 90 L48 60 Q60 50 72 60 L72 90'],['p','M28 90 L92 90']],
    'Nativity of Christ':         [['p','M60 20 L64 40 L84 44 L64 48 L60 68 L56 48 L36 44 L56 40 Z'],['p','M30 92 Q60 60 90 92']],
    'Theophany':                  [['p','M60 18 L60 52 M48 26 L60 40 M72 26 L60 40'],['p','M24 66 Q36 58 48 66 T72 66 T96 66'],['p','M24 80 Q36 72 48 80 T72 80 T96 80']],
    'Presentation of Our Lord':   [['p','M40 92 L40 50 Q60 32 80 50 L80 92'],['p','M60 46 L60 74'],['p','M60 40 Q56 32 60 26 Q64 32 60 40']],
    'Annunciation':               [['p','M60 92 L60 40'],['p','M60 56 Q42 52 40 34 Q56 36 60 52'],['p','M60 56 Q78 52 80 34 Q64 36 60 52'],['p','M60 40 Q52 28 60 18 Q68 28 60 40']],
    'Palm Sunday':                [['p','M60 92 L60 34'],['p','M60 76 Q40 70 32 52 M60 76 Q80 70 88 52'],['p','M60 60 Q44 54 38 40 M60 60 Q76 54 82 40'],['p','M60 44 Q50 38 46 28 M60 44 Q70 38 74 28']],
    'Pascha':                     [['c',60,55,18],['p','M60 12 L60 30 M60 80 L60 98 M17 55 L35 55 M85 55 L103 55 M30 25 L42 37 M90 25 L78 37 M30 85 L42 73 M90 85 L78 73']],
    'Ascension':                  [['p','M32 74 Q40 64 52 68 Q54 56 66 56 Q78 56 80 68 Q90 66 92 74'],['p','M60 48 L60 16 M50 28 L60 16 L70 28']],
    'Pentecost':                  [['p','M42 30 Q38 46 42 58 Q46 46 42 30'],['p','M60 22 Q56 42 60 58 Q64 42 60 22'],['p','M78 30 Q74 46 78 58 Q82 46 78 30'],['p','M30 78 Q60 64 90 78'],['p','M34 90 Q60 78 86 90']],
    'Transfiguration':            [['c',60,44,22],['c',60,44,15],['p','M60 8 L60 20 M28 44 L16 44 M104 44 L92 44 M34 22 L42 30 M86 22 L78 30'],['c',52,80,5],['c',62,84,5],['c',72,79,5],['c',57,90,5],['c',67,91,5],['p','M62 74 Q66 64 74 62']],
    'Dormition of the Theotokos': [['p','M28 66 L92 66 M28 74 L92 74 M34 66 L34 60 M86 66 L86 60'],['c',60,42,16],['c',60,42,10],['p','M60 22 L63 30 L71 32 L63 34 L60 42 L57 34 L49 32 L57 30 Z']]
  };

  function feastEmblem(name, size) {
    var spec = EMBLEMS[name];
    if (!spec) return null;
    var svg = svgEl('svg', { viewBox: '0 0 120 110', 'class': 'emblem', 'aria-hidden': 'true', width: size || 44, height: (size || 44) * 0.92 });
    spec.forEach(function (sh) {
      var n;
      if (sh[0] === 'c') n = svgEl('circle', { cx: sh[1], cy: sh[2], r: sh[3] });
      else n = svgEl('path', { d: sh[1] });
      n.setAttribute('fill', 'none');
      n.setAttribute('stroke', 'currentColor');
      n.setAttribute('stroke-width', '3');
      n.setAttribute('stroke-linecap', 'round');
      n.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(n);
    });
    return svg;
  }

  /* ---------- devotional prompt selection ----------
     Order: overlay > rank > cycle > fasting season > Wed/Fri fast > ordinary.
     Deterministic by date, so a day always shows the same prompt. */
  function promptFor(day) {
    if (day.spiritualFocus) return null; // the overlay already speaks for this day
    var P = DATA.prompts.pools;
    function pool(name) { return (P[name] && P[name].length) ? P[name] : null; }
    var chosen = null;
    if (day.rank === 'pascha') chosen = pool('pascha');
    if (!chosen && day.rank === 'great-feast') chosen = pool('great-feast');
    if (!chosen && day.rank === 'forefeast') chosen = pool('forefeast');
    if (!chosen && (day.rank === 'apodosis' || day.rank === 'afterfeast')) chosen = pool('apodosis');
    if (!chosen && day.rank === 'sunday') chosen = pool('sunday');
    if (!chosen && day.cycle) chosen = pool(day.cycle);
    if (!chosen) {
      var season = seasonFor(day.date);
      if (season) {
        if (/Nativity/.test(season.name)) chosen = pool('nativity-fast');
        else if (/Apostles/.test(season.name)) chosen = pool('apostles-fast');
        else if (/Lent/.test(season.name)) chosen = pool('great-lent');
      }
    }
    if (!chosen) {
      var dow = parseISO(day.date).getDay();
      var fasting = day.fastingLevel !== 'none' && day.fastingLevel !== 'fast-free';
      if ((dow === 3 || dow === 5) && fasting) chosen = pool('wedfri');
    }
    if (!chosen) chosen = pool('ordinary');
    if (!chosen) return null;
    var seed = 0;
    for (var i = 0; i < day.date.length; i++) seed = (seed * 31 + day.date.charCodeAt(i)) % 99991;
    return chosen[seed % chosen.length];
  }

  /* ---------- what is coming ---------- */
  function nextWhere(fromIso, test) {
    for (var i = 0; i < DATA.year.days.length; i++) {
      var d = DATA.year.days[i];
      if (d.date > fromIso && test(d)) return d;
    }
    return null;
  }
  function untilLabel(fromIso, iso) {
    var n = daysBetween(fromIso, iso);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n < 14) return 'in ' + n + ' days';
    return shortDate(iso);
  }

  function renderUpcoming(host, iso) {
    var rows = [
      ['Next Great Feast', nextWhere(iso, function (d) { return !!d.greatFeast; }), function (d) { return d.greatFeast; }],
      ['Next fish day', nextWhere(iso, function (d) { return d.fastingLevel === 'fish-oil-wine'; }), function (d) { return d.title; }],
      ['Next strict day', nextWhere(iso, function (d) { return d.fastingLevel === 'strict'; }), function (d) { return d.title; }],
      ['Next day without restrictions', nextWhere(iso, function (d) { return d.fastingLevel === 'none' || d.fastingLevel === 'fast-free'; }), function (d) { return d.title; }]
    ].filter(function (r) { return r[1]; });
    var seenDate = {};
    rows = rows.filter(function (r) {
      if (seenDate[r[1].date]) return false;
      seenDate[r[1].date] = 1;
      return true;
    });
    if (!rows.length) return;
    var c = el('div', 'card');
    c.appendChild(el('h3', null, 'Coming up'));
    rows.forEach(function (r) {
      var raw = r[1];
      var row = el('button', 'up-row');
      row.type = 'button';
      row.setAttribute('data-level', raw.fastingLevel);
      var l = el('div', 'up-left');
      l.appendChild(el('span', 'up-label', r[0]));
      l.appendChild(el('span', 'up-title', r[2](raw)));
      row.appendChild(l);
      var rr = el('div', 'up-right');
      rr.appendChild(el('span', 'up-when', untilLabel(iso, raw.date)));
      rr.appendChild(el('span', 'up-date', shortDate(raw.date)));
      row.appendChild(rr);
      row.addEventListener('click', function () { openDay(dayFor(raw.date)); });
      c.appendChild(row);
    });
    host.appendChild(c);
  }

  /* ================= TODAY ================= */
  function renderToday() {
    var host = document.getElementById('today-content');
    clear(host);
    var iso = todayISO();
    var day = dayFor(iso);
    var dStart = DATA.overlay.rangeStart, dEnd = DATA.overlay.rangeEnd;

    if (!day) {
      var c = el('div', 'card');
      c.appendChild(el('h3', null, 'Outside the loaded year'));
      c.appendChild(el('p', null, 'Today is ' + longDate(iso) + '. This app holds the ecclesiastical year from ' +
        longDate(DATA.year.rangeStart) + ' to ' + longDate(DATA.year.rangeEnd) + ', so there is no designation to show for today.'));
      c.appendChild(el('p', 'small', 'The README explains how to build the next year from the GOARCH Planner — it is one command.'));
      c.appendChild(btn('btn', 'Browse the calendar', function () { go('calendar'); }));
      host.appendChild(c);
      return;
    }

    var season = seasonFor(iso);
    var hero = el('div', 'today-hero' + (day.isGreatFeast ? ' is-feast' : ''));
    hero.appendChild(el('p', 'today-eyebrow',
      day.isGreatFeast ? 'Great Feast' : (season ? season.name : 'Ecclesiastical year')));
    hero.appendChild(el('p', 'today-date', longDate(iso)));
    hero.appendChild(el('p', 'today-title', day.title));
    hero.appendChild(badge(day.fastingLevel, true));
    if (day.isPersonalMilestone) {
      var m = el('p'); m.style.marginTop = '.9rem';
      m.appendChild(el('span', 'marker marker-ours', day.personalMilestoneLabel));
      hero.appendChild(m);
    }
    host.appendChild(hero);

    if (day.inDormitionFast) {
      var prog = el('div', 'card');
      var n = daysBetween(dStart, iso) + 1, total = daysBetween(dStart, dEnd) + 1;
      prog.appendChild(el('h3', null, 'Day ' + n + ' of ' + total + ' of the Dormition journey'));
      var track = el('div', 'progress-track');
      var fill = el('div', 'progress-fill');
      fill.style.width = Math.round((n / total) * 100) + '%';
      track.appendChild(fill);
      prog.appendChild(track);
      host.appendChild(prog);
    } else {
      var next = el('div', 'card');
      var delta = daysBetween(iso, dStart);
      if (delta > 0) {
        next.appendChild(el('h3', null, 'The Dormition Fast begins in ' + delta + (delta === 1 ? ' day' : ' days')));
        next.appendChild(el('p', null, longDate(dStart) + ' through ' + longDate(dEnd) + '.'));
      } else {
        next.appendChild(el('h3', null, 'The Dormition journey has ended'));
        next.appendChild(el('p', null, 'It ran ' + longDate(dStart) + ' to ' + longDate(dEnd) + '. Everything you wrote is still here.'));
      }
      if (season) next.appendChild(el('p', 'small', 'Today falls in ' + season.name + '.'));
      next.appendChild(btn('btn', 'Open the journey', function () { go('journey'); }));
      host.appendChild(next);
    }

    renderDayDetail(host, day, false);
    renderUpcoming(host, iso);
  }

  /* shared detail block, used by Today and the dialog */
  function renderDayDetail(host, day, compact) {
    var l = lg(day.fastingLevel);

    var fc = el('div', 'card');
    if (day.isGreatFeast) {
      var eb = feastEmblem(day.greatFeast, 64);
      if (eb) {
        var ew = el('div', 'emblem-banner');
        ew.appendChild(eb);
        ew.appendChild(el('span', 'emblem-label', 'Ornament from this companion — not an icon'));
        fc.appendChild(ew);
      }
    }
    if (compact) {
      fc.appendChild(el('h3', null, longDate(day.date)));
      fc.appendChild(badge(day.fastingLevel, false));
    }
    fc.appendChild(el('h4', null, 'The GOARCH designation'));
    if (day.plannerLabel) fc.appendChild(el('p', 'planner-label', day.plannerLabel));
    fc.appendChild(el('p', null, l.goarchText));
    if (l.informal) fc.appendChild(el('p', 'small', l.informal));
    fc.appendChild(foodColumns(day.fastingLevel));
    var season = seasonFor(day.date);
    if (season) fc.appendChild(el('p', 'small', 'Part of ' + season.name + ' — ' + shortDate(season.start) + ' to ' + shortDate(season.end) + '.'));
    fc.appendChild(sourceLine());
    host.appendChild(fc);

    if (day.saints.length || day.readings.length) {
      var cc = el('div', 'card');
      cc.appendChild(el('h3', null, 'Commemorated'));
      if (day.saints.length) {
        var ul = el('ul');
        day.saints.forEach(function (c) { ul.appendChild(el('li', null, c)); });
        cc.appendChild(ul);
      }
      if (day.readings.length) {
        cc.appendChild(el('h4', null, 'Readings'));
        var ur = el('ul');
        day.readings.forEach(function (r) { ur.appendChild(el('li', null, r.label + ' — ' + r.citation)); });
        cc.appendChild(ur);
        cc.appendChild(el('p', 'small', 'Citations only. The Planner\u2019s scripture text is a copyrighted translation, so it is not republished here — open the Online Chapel to read it.'));
      }
      host.appendChild(cc);
    }

    var mc = el('div', 'card');
    var mlevel = mealLevelFor(day.fastingLevel);
    mc.appendChild(el('h3', null, 'What to eat'));
    var mlist = el('div', 'idea-list');
    mc.appendChild(mlist);

    function drawIdeas(nudge) {
      clear(mlist);
      var favs = (DATA.meals.levels[mlevel] || []).filter(function (m) { return isFav(mlevel, m.id); });
      if (favs.length) {
        var fh = el('p', 'idea-head', 'Your favourites for this designation');
        mlist.appendChild(fh);
        favs.slice(0, 6).forEach(function (m) { mlist.appendChild(ideaRow(m, mlevel, true)); });
      }
      var picks = pickMeals(day.fastingLevel, day.date + (nudge || ''), 3);
      if (picks.length) {
        mlist.appendChild(el('p', 'idea-head', favs.length ? 'Or try' : 'Three ideas for today'));
        picks.forEach(function (m) { mlist.appendChild(ideaRow(m, mlevel, false)); });
      } else {
        mlist.appendChild(el('p', 'small', 'No restrictions today — anything is on the table.'));
      }
    }
    var nudge = 0;
    drawIdeas('');
    var row = el('div', 'btn-row');
    row.appendChild(btn('btn btn-print', 'Show me others', function () { nudge++; drawIdeas('#' + nudge); }));
    row.appendChild(btn('btn', 'Open the meal library', function () {
      state.level = mlevel;
      go('meals');
      document.querySelectorAll('[data-level]').forEach(function (x) {
        x.classList.toggle('is-on', x.getAttribute('data-level') === state.level);
      });
      renderMeals();
      closeDialog();
    }));
    mc.appendChild(row);
    host.appendChild(mc);

    var sc = el('div', 'card');
    var pr = promptFor(day);
    if (day.spiritualFocus) {
      sc.appendChild(el('h3', null, 'A spiritual focus'));
      sc.appendChild(el('p', null, day.spiritualFocus));
      if (day.prayerReminder) {
        sc.appendChild(el('h4', null, 'Prayer'));
        sc.appendChild(el('p', null, day.prayerReminder));
      }
      if (day.mercyPrompt) {
        sc.appendChild(el('h4', null, 'An act of mercy'));
        sc.appendChild(el('p', null, day.mercyPrompt));
      }
    } else if (pr) {
      sc.appendChild(el('h3', null, 'A spiritual focus'));
      sc.appendChild(el('p', null, pr.focus));
      if (pr.mercy) {
        sc.appendChild(el('h4', null, 'An act of mercy'));
        sc.appendChild(el('p', null, pr.mercy));
      }
      sc.appendChild(el('p', 'prompt-label', DATA.prompts.label));
    } else {
      sc.appendChild(el('h3', null, 'Journal'));
    }
    fieldGroup(sc, 'journal.' + day.date, [
      { k: 'entry', label: day.journalPrompt || (pr && pr.journal) || ('Notes for ' + shortDate(day.date)), long: true, rows: 5 },
      { k: 'evening', label: 'Evening review — how did the day actually go?', long: true, rows: 3 }
    ]);
    var pc = btn('btn btn-print', 'Open the prayer corner', function () {
      go('more');
      var t = document.querySelector('[data-otab="prayer"]');
      if (t) t.click();
      closeDialog();
    });
    pc.style.marginTop = '.8rem';
    sc.appendChild(pc);
    host.appendChild(sc);
  }

  function starButton(level, m, onChange) {
    var b = el('button', 'star');
    b.type = 'button';
    function paint() {
      var on = isFav(level, m.id);
      b.textContent = on ? '\u2605' : '\u2606';
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + m.name + (on ? ' from' : ' to') + ' favourites');
    }
    paint();
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFav(level, m.id);
      paint();
      if (onChange) onChange();
    });
    return b;
  }

  function ideaRow(m, level, fav) {
    var r = el('div', 'idea-row' + (fav ? ' is-fav' : ''));
    var t = el('div', 'idea-text');
    t.appendChild(el('span', 'idea-name', m.name));
    t.appendChild(el('span', 'idea-meta', m.meal + ' · ' + m.cuisine));
    r.appendChild(t);
    r.appendChild(starButton(level, m));
    return r;
  }

  /* the meal library only carries the fasting categories */
  function mealLevelFor(id) { return DATA.meals.levels[id] ? id : 'fast-free'; }
  function pickMeals(levelId, seedStr, count) {
    var list = DATA.meals.levels[mealLevelFor(levelId)] || [];
    var wanted = ['breakfast', 'lunch', 'dinner'];
    var seed = 0;
    for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 99991;
    var out = [];
    wanted.slice(0, count).forEach(function (m, idx) {
      var pool = list.filter(function (x) { return x.meal === m; });
      if (pool.length) out.push(pool[(seed + idx * 17) % pool.length]);
    });
    return out;
  }

  /* ================= CALENDAR — Dormition strip ================= */
  function renderFastStrip() {
    var grid = document.getElementById('cal-grid');
    clear(grid);
    var iso = todayISO();
    DATA.overlay.days.forEach(function (o) {
      var day = dayFor(o.date);
      if (!day) return;
      if (state.filter === 'milestone' && !day.isPersonalMilestone) return;
      if (state.filter !== 'all' && state.filter !== 'milestone' && day.fastingLevel !== state.filter) return;
      grid.appendChild(dayCard(day, iso));
    });
    if (!grid.children.length) grid.appendChild(el('p', 'view-note', 'No days match that filter.'));
    drawLegend();
  }

  function dayCard(day, todayIso) {
    var d = parseISO(day.date);
    var b = el('button', 'cal-day' + (day.isGreatFeast ? ' is-feast' : '') + (day.date === todayIso ? ' is-today' : ''));
    b.type = 'button';
    b.setAttribute('data-level', day.fastingLevel);
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-label', longDate(day.date) + '. ' + lg(day.fastingLevel).goarchLabel + '. ' + day.title);
    var top = el('div', 'cal-top');
    top.appendChild(el('span', 'cal-num', d.getDate()));
    top.appendChild(el('span', 'cal-dow', DOW[d.getDay()].slice(0, 3)));
    b.appendChild(top);
    b.appendChild(el('div', 'cal-level', SYM[day.fastingLevel] + '  ' + lg(day.fastingLevel).goarchLabel));
    b.appendChild(el('div', 'cal-meta', day.title));
    if (day.isGreatFeast) b.appendChild(el('span', 'marker marker-feast', 'Great Feast'));
    if (day.isPersonalMilestone) b.appendChild(el('span', 'marker marker-ours', day.personalMilestoneLabel));
    b.addEventListener('click', function () { openDay(day); });
    return b;
  }

  function drawLegend() {
    var ll = document.getElementById('legend-list');
    if (ll.children.length) return;
    LEGEND_ORDER.forEach(function (k) {
      var l = DATA.overlay.legend[k];
      if (!l) return;
      var li = el('li');
      var sw = el('span', 'sw'); sw.style.background = SWATCH[k];
      li.appendChild(sw);
      var t = el('div');
      t.appendChild(el('strong', null, SYM[k] + '  ' + l.goarchLabel));
      if (l.plannerLabel && l.plannerLabel !== l.goarchLabel) t.appendChild(el('div', 'small', 'Planner: ' + l.plannerLabel));
      t.appendChild(el('div', 'small', l.goarchText));
      li.appendChild(t);
      ll.appendChild(li);
    });
  }

  /* ================= CALENDAR — full year month grid ================= */
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthList() {
    var out = [], seen = {};
    DATA.year.days.forEach(function (d) {
      var k = monthKey(d.date);
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out;
  }

  function renderMonth() {
    var months = monthList();
    if (!state.month || months.indexOf(state.month) === -1) {
      var t = monthKey(todayISO());
      state.month = months.indexOf(t) !== -1 ? t : months[0];
    }
    var idx = months.indexOf(state.month);
    var y = +state.month.slice(0, 4), mo = +state.month.slice(5, 7) - 1;

    document.getElementById('month-label').textContent = MON[mo] + ' ' + y;
    var prev = document.getElementById('month-prev'), next = document.getElementById('month-next');
    prev.disabled = idx <= 0;
    next.disabled = idx >= months.length - 1;
    prev.onclick = function () { state.month = months[idx - 1]; renderMonth(); };
    next.onclick = function () { state.month = months[idx + 1]; renderMonth(); };

    var grid = document.getElementById('month-grid');
    clear(grid);
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function (d) {
      grid.appendChild(el('div', 'mg-head', d));
    });
    var first = new Date(y, mo, 1);
    for (var i = 0; i < first.getDay(); i++) grid.appendChild(el('div', 'mg-pad'));
    var iso = todayISO();
    var last = new Date(y, mo + 1, 0).getDate();
    for (var dnum = 1; dnum <= last; dnum++) {
      var key = isoOf(new Date(y, mo, dnum));
      var day = dayFor(key);
      if (!day) {
        var blank = el('div', 'mg-pad');
        blank.appendChild(el('span', 'mg-num', dnum));
        grid.appendChild(blank);
        continue;
      }
      var cell = el('button', 'mg-cell');
      cell.type = 'button';
      cell.setAttribute('data-level', day.fastingLevel);
      if (day.date === iso) cell.classList.add('is-today');
      if (day.isGreatFeast) cell.classList.add('is-feast');
      if (day.isPersonalMilestone) cell.classList.add('is-ours');
      cell.setAttribute('aria-label', longDate(key) + '. ' + lg(day.fastingLevel).goarchLabel + '. ' + day.title);
      cell.appendChild(el('span', 'mg-num', dnum));
      cell.appendChild(el('span', 'mg-sym', SYM[day.fastingLevel]));
      (function (dd) { cell.addEventListener('click', function () { openDay(dd); }); })(day);
      grid.appendChild(cell);
    }

    var sh = document.getElementById('season-list');
    clear(sh);
    (DATA.year.seasons || []).forEach(function (s) {
      var row = el('div', 'season-row');
      var inIt = iso >= s.start && iso <= s.end;
      if (inIt) row.classList.add('is-now');
      row.appendChild(el('strong', null, s.name));
      row.appendChild(el('span', 'small', shortDate(s.start) + ' – ' + shortDate(s.end) + ' · ' + s.days + ' days' + (inIt ? ' · we are in it now' : '')));
      if (s.blurb) row.appendChild(el('span', 'small', s.blurb));
      row.appendChild(btn('chip chip-sm', 'Go to ' + shortDate(s.start), function () {
        state.month = monthKey(s.start);
        renderMonth();
        document.getElementById('month-label').scrollIntoView({ block: 'center' });
      }));
      sh.appendChild(row);
    });
    drawLegend();
  }

  /* ================= CALENDAR — search ================= */
  function runSearch(q) {
    var host = document.getElementById('search-results');
    clear(host);
    q = (q || '').trim().toLowerCase();
    if (q.length < 3) {
      host.appendChild(el('p', 'view-note', 'Type at least three letters. Try a saint\u2019s name, a feast, or a word like "martyr".'));
      return;
    }
    var hits = [];
    for (var i = 0; i < DATA.year.days.length && hits.length < 120; i++) {
      var d = DATA.year.days[i];
      var hay = (d.title + ' ' + (d.saints || []).join(' ')).toLowerCase();
      if (hay.indexOf(q) !== -1) hits.push(d);
    }
    if (!hits.length) {
      host.appendChild(el('p', 'view-note', 'Nothing in this year matches. Spelling of saints\u2019 names varies a great deal — try a shorter fragment.'));
      return;
    }
    host.appendChild(el('p', 'view-note', hits.length + (hits.length === 120 ? '+' : '') + ' day' + (hits.length === 1 ? '' : 's') + ' in this ecclesiastical year.'));
    hits.forEach(function (raw) {
      var day = dayFor(raw.date);
      var row = el('button', 'search-row');
      row.type = 'button';
      row.setAttribute('data-level', day.fastingLevel);
      var head = el('div', 'search-head');
      head.appendChild(el('strong', null, longDate(raw.date)));
      head.appendChild(el('span', 'search-sym', SYM[day.fastingLevel] + ' ' + lg(day.fastingLevel).goarchLabel));
      row.appendChild(head);
      row.appendChild(el('div', 'search-title', raw.title));
      var matched = (raw.saints || []).filter(function (s) { return s.toLowerCase().indexOf(q) !== -1; });
      if (matched.length) row.appendChild(el('div', 'small', matched.join(' · ')));
      row.addEventListener('click', function () { openDay(day); });
      host.appendChild(row);
    });
  }

  /* ================= CALENDAR — the index ================= */
  var INDEX_SETS = {
    'great': {
      label: 'The Great Feasts',
      note: 'The Twelve Great Feasts of the Church year, and Pascha, which stands above them. The designation beside each is what the Planner gives for that date.',
      rows: function () {
        return DATA.year.greatFeasts.map(function (g) {
          return { date: g.date, primary: g.name, secondary: g.title, level: g.fastingLevel };
        });
      }
    },
    'seasons': {
      label: 'The fasting seasons',
      note: 'The four fasting periods of the year. Dates are read from the Planner; the app has grouped consecutive fasting days and named the run. A season can begin a day early because the Wednesday or Friday before it is already a fast day.',
      rows: function () {
        return (DATA.year.seasons || []).map(function (sn) {
          return { date: sn.start, primary: sn.name, secondary: sn.blurb || '', span: sn.start + '|' + sn.end, count: sn.days };
        });
      }
    },
    'freeweeks': {
      label: 'Fast-free weeks',
      note: 'Stretches of six days or more with no fasting obligation at all — the Nativity season through Theophany, the week after the Publican and the Pharisee, Bright Week, and the week after Pentecost.',
      rows: function () {
        return (DATA.year.fastFreePeriods || []).map(function (f) {
          return { date: f.start, primary: shortDate(f.start) + ' – ' + shortDate(f.end), secondary: f.days + ' days without fasting', span: f.start + '|' + f.end, count: f.days };
        });
      }
    },
    'fish': {
      label: 'Every fish day',
      note: 'Days inside a fast when fish, oil and wine are allowed — usually a feast falling within a fasting season.',
      rows: function () { return levelRows('fish-oil-wine'); }
    },
    'strict': {
      label: 'Every strict day',
      note: 'Refrain from meat, fish, oil, wine, dairy and eggs.',
      rows: function () { return levelRows('strict'); }
    },
    'dairy': {
      label: 'Dairy days',
      note: 'The Planner\u2019s Dairy, Eggs and Fish Allowed designation — Cheesefare week, when meat has gone but the rest of the table has not.',
      rows: function () { return levelRows('dairy'); }
    },
    'paschal': {
      label: 'The Paschal cycle',
      note: 'The movable calendar in order — Triodion, Great Lent, Holy Week, Bright Week, and the fifty days to All Saints. Every date here moves with Pascha; everything not listed keeps a fixed date. All anchors are the Planner\u2019s own titles.',
      rows: function () {
        var names = { 'triodion': 'Triodion', 'great-lent': 'Great Lent', 'holy-week': 'Holy Week', 'bright-week': 'Bright Week', 'pentecostarion': 'Pentecostarion' };
        return (DATA.year.paschalCycle || []).map(function (m) {
          return { date: m.date, primary: m.title, secondary: names[m.cycle] || '', level: m.fastingLevel };
        });
      }
    },
    'lentsundays': {
      label: 'Sundays of Great Lent',
      note: 'The five Sundays inside the Great Fast, each with its own name, plus Palm Sunday which closes it.',
      rows: function () {
        return (DATA.year.paschalCycle || []).filter(function (m) {
          return (m.cycle === 'great-lent') && /Sunday/.test(m.title);
        }).map(function (m) {
          return { date: m.date, primary: m.title, secondary: '', level: m.fastingLevel };
        });
      }
    },
    'marian': {
      label: 'Feasts of the Theotokos',
      note: 'The great Marian feasts of the year — her Nativity, Entrance, Annunciation and Dormition — together with the Protection, the Conception by St. Anna, and the Synaxis after Christmas.',
      rows: function () {
        return (DATA.year.marianFeasts || []).map(function (m) {
          return { date: m.date, primary: m.title, secondary: '', level: m.fastingLevel };
        });
      }
    },
    'fore': {
      label: 'Forefeasts & leavetakings',
      note: 'The days that frame each feast — the forefeast leaning toward it, the afterfeast carrying it, the apodosis or leavetaking that sets it aside. A feast in the Church is a season, not a date.',
      rows: function () {
        return DATA.year.days.filter(function (d) {
          return d.rank === 'forefeast' || d.rank === 'afterfeast' || d.rank === 'apodosis';
        }).map(function (d) {
          var kind = d.rank === 'forefeast' ? 'Forefeast' : d.rank === 'afterfeast' ? 'Afterfeast' : 'Leavetaking';
          return { date: d.date, primary: d.title, secondary: kind, level: d.fastingLevel };
        });
      }
    },
    'wedfri': {
      label: 'Wednesdays & Fridays',
      note: 'Nearly every Wednesday and Friday of the year is a fast day — Wednesday for the betrayal, Friday for the Cross. Listing all of them would drown the calendar, so this shows the opposite: the handful of Wednesdays and Fridays this year with no fasting at all, which the fast-free weeks create.',
      rows: function () {
        return (DATA.year.wedFriExceptions || []).map(function (d) {
          return { date: d.date, primary: d.title, secondary: DOW[parseISO(d.date).getDay()] + ' — no fast', level: d.fastingLevel };
        });
      }
    },
    'sundays': {
      label: 'Named Sundays',
      note: 'Sundays that carry their own name in the Church year rather than a number — the Triodion Sundays, the Sundays of Great Lent, and the Paschal cycle.',
      rows: function () {
        return DATA.year.days.filter(function (d) {
          return d.rank === 'sunday' && !/^\d+(st|nd|rd|th) Sunday/.test(d.title);
        }).map(function (d) {
          return { date: d.date, primary: d.title, secondary: '', level: d.fastingLevel };
        });
      }
    }
  };

  function levelRows(level) {
    return DATA.year.days.filter(function (d) { return d.fastingLevel === level; })
      .map(function (d) {
        return { date: d.date, primary: d.title, secondary: '', level: d.fastingLevel };
      });
  }

  function renderIndex() {
    var host = document.getElementById('index-list');
    clear(host);
    var setKey = state.indexSet || 'great';
    var cfg = INDEX_SETS[setKey];
    var iso = todayISO();

    var counts = document.getElementById('index-counts');
    clear(counts);

    host.appendChild(el('p', 'view-note', cfg.note));
    var rows = cfg.rows();
    if (!rows.length) { host.appendChild(el('p', 'view-note', 'Nothing in this year.')); return; }
    counts.textContent = rows.length + (rows.length === 1 ? ' entry' : ' entries') + ' this year';

    var past = 0;
    rows.forEach(function (r) {
      var endIso = r.span ? r.span.split('|')[1] : r.date;
      var done = endIso < iso;
      if (done) past++;
      var row = el('button', 'idx-row' + (done ? ' is-past' : ''));
      row.type = 'button';
      if (r.level) row.setAttribute('data-level', r.level);
      var main = el('div', 'idx-main');
      if (setKey === 'great') {
        var em = feastEmblem(r.primary, 40);
        if (em) {
          var wrap = el('div', 'idx-emblem-row');
          wrap.appendChild(em);
          wrap.appendChild(el('span', 'idx-primary', r.primary));
          main.appendChild(wrap);
        } else main.appendChild(el('span', 'idx-primary', r.primary));
      } else main.appendChild(el('span', 'idx-primary', r.primary));
      if (r.secondary) main.appendChild(el('span', 'idx-secondary', r.secondary));
      if (r.level) main.appendChild(el('span', 'idx-level', SYM[r.level] + ' ' + lg(r.level).goarchLabel));
      row.appendChild(main);
      var side = el('div', 'idx-side');
      side.appendChild(el('span', 'idx-date', r.span
        ? shortDate(r.span.split('|')[0]) + ' – ' + shortDate(r.span.split('|')[1])
        : longDate(r.date).replace(/,\s\d{4}$/, '')));
      if (!done) side.appendChild(el('span', 'idx-when', untilLabel(iso, r.date)));
      else side.appendChild(el('span', 'idx-when', 'past'));
      row.appendChild(side);
      row.addEventListener('click', function () {
        var d = dayFor(r.date);
        if (d) openDay(d);
      });
      host.appendChild(row);
    });
    if (past) counts.textContent += ' · ' + past + ' already past';
  }

  /* ================= THE YEAR WHEEL ================= */
  var wheelBuilt = false;
  function renderWheel() {
    if (wheelBuilt) return;
    var host = document.getElementById('wheel-host');
    if (!host) return;
    wheelBuilt = true;

    var W = 790, C = W / 2;
    var R_OUT = 330, R_IN = 250;         // day rays
    var R_SEASON = 236, R_SEASON_W = 10; // fasting-season arcs
    var R_FEAST = 348;                   // feast dots
    var R_MONTH = 368;                   // month labels
    var days = DATA.year.days;
    var N = days.length;
    var TAU = Math.PI * 2;

    function ang(i) { return (i / N) * TAU - Math.PI / 2; }
    function pt(r, a) { return [C + r * Math.cos(a), C + r * Math.sin(a)]; }

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + W,
      'class': 'wheel',
      role: 'img',
      'aria-label': 'The ecclesiastical year ' + DATA.year.rangeStart.slice(0, 4) + ' to ' + DATA.year.rangeEnd.slice(0, 4) + ' drawn as a wheel. Each of the ' + N + ' rays is one day, coloured by its fasting designation. The month grid presents the same days accessibly.'
    });

    // quiet ring guides
    [R_IN - 4, R_OUT + 4].forEach(function (r) {
      svg.appendChild(svgEl('circle', { cx: C, cy: C, r: r, fill: 'none', stroke: 'rgba(198,161,91,.35)', 'stroke-width': 1 }));
    });

    // fasting-season arcs
    (DATA.year.seasons || []).forEach(function (sn) {
      var i0 = days.findIndex(function (d) { return d.date === sn.start; });
      var i1 = days.findIndex(function (d) { return d.date === sn.end; });
      if (i0 < 0 || i1 < 0) return;
      var a0 = ang(i0), a1 = ang(i1 + 1);
      var p0 = pt(R_SEASON, a0), p1 = pt(R_SEASON, a1);
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      svg.appendChild(svgEl('path', {
        d: 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) +
           ' A' + R_SEASON + ' ' + R_SEASON + ' 0 ' + large + ' 1 ' +
           p1[0].toFixed(1) + ' ' + p1[1].toFixed(1),
        fill: 'none', stroke: 'rgba(118,26,44,.5)', 'stroke-width': R_SEASON_W, 'stroke-linecap': 'round'
      }));
    });

    // day rays — a wide invisible hit line over a coloured visible line
    var todayIdx = -1, iso = todayISO();
    days.forEach(function (d, i) {
      var a = ang(i);
      var isFeast = !!d.greatFeast;
      var r2 = isFeast ? R_OUT + 10 : R_OUT;
      var v0 = pt(R_IN, a), v1 = pt(r2, a);
      if (d.date === iso) todayIdx = i;

      var g = svgEl('g', { 'class': 'wheel-day' });
      g.appendChild(svgEl('line', {
        x1: v0[0].toFixed(1), y1: v0[1].toFixed(1), x2: v1[0].toFixed(1), y2: v1[1].toFixed(1),
        stroke: SWATCH[d.fastingLevel] || '#c9bda8',
        'stroke-width': isFeast ? 3.4 : 2.2, 'stroke-linecap': 'round'
      }));
      var h0 = pt(R_IN - 8, a), h1 = pt(R_OUT + 18, a);
      var hit = svgEl('line', {
        x1: h0[0].toFixed(1), y1: h0[1].toFixed(1), x2: h1[0].toFixed(1), y2: h1[1].toFixed(1),
        stroke: 'rgba(0,0,0,0)', 'stroke-width': 7, 'class': 'wheel-hit'
      });
      hit.addEventListener('click', function () {
        var dd = dayFor(d.date);
        if (dd) openDay(dd);
      });
      var t = svgEl('title', {});
      t.textContent = longDate(d.date) + ' — ' + lg(d.fastingLevel).goarchLabel + ' — ' + d.title;
      hit.appendChild(t);
      g.appendChild(hit);
      svg.appendChild(g);

      if (isFeast) {
        var fp = pt(R_FEAST, a);
        svg.appendChild(svgEl('circle', { cx: fp[0].toFixed(1), cy: fp[1].toFixed(1), r: 5, fill: '#c6a15b', stroke: '#3b0b17', 'stroke-width': 1 }));
      }
      var ov = DATA.ov[d.date];
      if (ov && ov.isPersonalMilestone) {
        var mp = pt(R_FEAST + (isFeast ? 14 : 0), a);
        svg.appendChild(svgEl('circle', { cx: mp[0].toFixed(1), cy: mp[1].toFixed(1), r: 6, fill: '#243f67', stroke: '#dfc88d', 'stroke-width': 1.5 }));
      }
    });

    // month labels at each month's first day
    var seenM = {};
    days.forEach(function (d, i) {
      var mk = d.date.slice(0, 7);
      if (seenM[mk]) return;
      seenM[mk] = 1;
      var a = ang(i);
      var mp = pt(R_MONTH, a);
      var lbl = svgEl('text', {
        x: mp[0].toFixed(1), y: mp[1].toFixed(1),
        'text-anchor': 'middle', 'dominant-baseline': 'middle', 'class': 'wheel-month'
      });
      lbl.textContent = MON[+d.date.slice(5, 7) - 1].slice(0, 3);
      svg.appendChild(lbl);
    });

    // today needle
    if (todayIdx >= 0) {
      var na = ang(todayIdx);
      var n0 = pt(90, na), n1 = pt(R_IN - 12, na);
      svg.appendChild(svgEl('line', {
        x1: n0[0].toFixed(1), y1: n0[1].toFixed(1), x2: n1[0].toFixed(1), y2: n1[1].toFixed(1),
        stroke: '#761a2c', 'stroke-width': 3, 'stroke-linecap': 'round'
      }));
      var tipP = pt(R_IN - 12, na);
      svg.appendChild(svgEl('circle', { cx: tipP[0].toFixed(1), cy: tipP[1].toFixed(1), r: 5, fill: '#761a2c' }));
    }

    // centre: three-bar cross + labels
    var cg = svgEl('g', { 'class': 'wheel-centre' });
    var cross = [
      ['rect', { x: C - 1.6, y: C - 62, width: 3.2, height: 60 }],
      ['rect', { x: C - 12, y: C - 54, width: 24, height: 2.6 }],
      ['rect', { x: C - 19, y: C - 42, width: 38, height: 3.2 }],
      ['path', { d: 'M' + (C - 12) + ' ' + (C - 12) + ' L' + (C + 12) + ' ' + (C - 18) + ' L' + (C + 12) + ' ' + (C - 15) + ' L' + (C - 12) + ' ' + (C - 9) + ' Z' }]
    ];
    cross.forEach(function (c) { var n = svgEl(c[0], c[1]); n.setAttribute('fill', '#c6a15b'); cg.appendChild(n); });
    var t1 = svgEl('text', { x: C, y: C + 24, 'text-anchor': 'middle', 'class': 'wheel-title' });
    t1.textContent = 'The Year of the Church';
    var t2 = svgEl('text', { x: C, y: C + 44, 'text-anchor': 'middle', 'class': 'wheel-sub' });
    t2.textContent = shortDate(DATA.year.rangeStart) + ' ' + DATA.year.rangeStart.slice(0, 4) + ' — ' + shortDate(DATA.year.rangeEnd) + ' ' + DATA.year.rangeEnd.slice(0, 4);
    var t3 = svgEl('text', { x: C, y: C + 62, 'text-anchor': 'middle', 'class': 'wheel-sub2' });
    t3.textContent = 'Fasting designations: GOARCH Planner';
    cg.appendChild(t1); cg.appendChild(t2); cg.appendChild(t3);
    svg.appendChild(cg);

    host.appendChild(svg);

    document.getElementById('wheel-print').addEventListener('click', function () {
      document.body.classList.add('print-wheel-only');
      var undo = function () { document.body.classList.remove('print-wheel-only'); window.removeEventListener('afterprint', undo); };
      window.addEventListener('afterprint', undo);
      window.print();
      setTimeout(undo, 2000); // safety for browsers without afterprint
    });
  }

  /* ---------- day dialog ---------- */
  var dlg = document.getElementById('day-dialog');
  function openDay(day) {
    document.getElementById('dlg-title').textContent = longDate(day.date) + ' — ' + day.title;
    var body = document.getElementById('dlg-body');
    clear(body);
    renderDayDetail(body, day, true);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    body.scrollTop = 0;
  }
  function closeDialog() { if (dlg.open) dlg.close(); }
  document.getElementById('dlg-close').addEventListener('click', closeDialog);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(); });

  /* ================= MEALS ================= */
  function renderMeals() {
    var host = document.getElementById('meal-list');
    clear(host);
    var ph = document.getElementById('pantry-chips');
    if (ph && !ph.children.length) {
      ph.appendChild(el('p', 'small', DATA.meals.pantryNote));
      var wrap = el('div', 'filters filters-sm');
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'What is in your kitchen');
      (DATA.meals.pantry || []).forEach(function (k) {
        var c = el('button', 'chip chip-sm', k);
        c.type = 'button';
        c.setAttribute('aria-pressed', 'false');
        c.addEventListener('click', function () {
          var i = state.pantry.indexOf(k);
          if (i === -1) state.pantry.push(k); else state.pantry.splice(i, 1);
          c.classList.toggle('is-on', i === -1);
          c.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
          renderMeals();
        });
        wrap.appendChild(c);
      });
      var clearB = el('button', 'chip chip-sm chip-clear', 'Clear');
      clearB.type = 'button';
      clearB.addEventListener('click', function () {
        state.pantry = [];
        wrap.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
        renderMeals();
      });
      wrap.appendChild(clearB);
      ph.appendChild(wrap);
    }
    var sm = document.getElementById('strict-methods');
    clear(sm);
    if (state.level === 'strict') {
      sm.hidden = false;
      sm.appendChild(el('h4', null, 'Cooking without added oil'));
      var ul = el('ul');
      DATA.meals.strictMethods.forEach(function (m) { ul.appendChild(el('li', null, m)); });
      sm.appendChild(ul);
      sm.appendChild(el('p', 'small', DATA.meals.strictNote));
    } else { sm.hidden = true; }

    var list = (DATA.meals.levels[state.level] || []).filter(function (m) {
      if (state.tag === '__fav') { if (!isFav(state.level, m.id)) return false; }
      else if (state.tag && m.tags.indexOf(state.tag) === -1) return false;
      if (state.pantry.length) {
        var mine = m.pantry || [];
        var hit = state.pantry.some(function (k) { return mine.indexOf(k) !== -1; });
        if (!hit) return false;
      }
      return true;
    });
    var fc = favCount(state.level);
    var favChip = document.querySelector('[data-tag="__fav"]');
    if (favChip) favChip.textContent = fc ? 'Favourites (' + fc + ')' : 'Favourites';
    var groups = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
    var labels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks', dessert: 'Simple desserts' };
    groups.forEach(function (g) {
      var items = list.filter(function (m) { return m.meal === g; });
      if (!items.length) return;
      var sec = el('div', 'meal-group');
      sec.appendChild(el('h3', null, labels[g] + ' (' + items.length + ')'));
      items.forEach(function (m) {
        var row = el('div', 'meal-item');
        var body = el('div', 'meal-body');
        body.appendChild(el('div', 'meal-name', m.name));
        var meta = [m.cuisine].concat(m.tags.map(function (t) { return DATA.meals.tagLabels[t] || t; }));
        body.appendChild(el('div', 'meal-tags', meta.join(' · ')));
        if (m.note) body.appendChild(el('div', 'small', m.note));
        row.appendChild(body);
        row.appendChild(starButton(state.level, m, function () {
          if (state.tag === '__fav') renderMeals(); else {
            var c = favCount(state.level);
            var chip = document.querySelector('[data-tag="__fav"]');
            if (chip) chip.textContent = c ? 'Favourites (' + c + ')' : 'Favourites';
          }
        }));
        sec.appendChild(row);
      });
      host.appendChild(sec);
    });
    if (!host.children.length) {
      host.appendChild(el('p', 'view-note', state.pantry.length
        ? 'Nothing here is built mainly on ' + state.pantry.join(' or ') + ' for this designation. Clear a pantry chip or try another.'
        : state.tag === '__fav'
        ? 'No favourites saved for this designation yet. Tap the star beside any meal to keep it here.'
        : 'Nothing matches that combination. Try a different tag.'));
    }
  }

  function planFor(day, planKey) {
    var list = DATA.meals.levels[mealLevelFor(day.fastingLevel)] || [];
    var seed = 0;
    var s = day.date + planKey;
    for (var i = 0; i < s.length; i++) seed = (seed * 33 + s.charCodeAt(i)) % 99991;
    var mlevel = mealLevelFor(day.fastingLevel);
    function pick(meal, prefer) {
      var pool = list.filter(function (x) { return x.meal === meal; });
      var starred = pool.filter(function (x) { return isFav(mlevel, x.id); });
      if (starred.length) return starred[seed % starred.length].name;
      var pref = pool.filter(function (x) { return x.tags.indexOf(prefer) !== -1; });
      var use = pref.length ? pref : pool;
      return use.length ? use[seed % use.length].name : '\u2014';
    }
    var prefer = planKey === 'A' ? 'family' : 'batch';
    return {
      Breakfast: pick('breakfast', prefer),
      Lunch: pick('lunch', prefer),
      Dinner: pick('dinner', prefer),
      Snack: pick('snack', prefer),
      Dessert: pick('dessert', prefer)
    };
  }

  function plannerDates() {
    if (state.span === 'week') {
      var out = [], base = parseISO(todayISO());
      for (var i = 0; i < 7; i++) {
        var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
        if (DATA.byDate[isoOf(d)]) out.push(isoOf(d));
      }
      return out;
    }
    return DATA.overlay.days.map(function (o) { return o.date; });
  }

  function renderPlanner() {
    var host = document.getElementById('planner-list');
    clear(host);
    var own = state.plan === 'own';
    var dates = plannerDates();
    if (!dates.length) {
      host.appendChild(el('p', 'view-note', 'Today falls outside the loaded year, so there is no week to plan. Rebuild the calendar from the current Planner — the README has the command.'));
      return;
    }
    if (state.span === 'week') {
      host.appendChild(el('p', 'view-note', 'The seven days from today, whatever the season. Each day is planned against its own designation.'));
    }
    if (own) host.appendChild(el('p', 'warn', 'Each list is filtered to that day\u2019s designation, so a meal cannot be placed on a day it does not match.'));

    dates.forEach(function (dateIso) {
      var day = dayFor(dateIso);
      if (!day) return;
      var card = el('div', 'plan-day');
      var head = el('div', 'plan-head');
      var d = parseISO(day.date);
      head.appendChild(el('strong', null, MON[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ' · ' + DOW[d.getDay()].slice(0, 3)));
      head.appendChild(badge(day.fastingLevel, false));
      card.appendChild(head);

      if (day.isGreatFeast) head.appendChild(el('span', 'marker marker-feast', day.greatFeast));
      var meals = planFor(day, own ? 'A' : state.plan);
      ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].forEach(function (slot) {
        var row = el('div', 'plan-row');
        row.appendChild(el('span', null, slot));
        if (own) {
          var sel = el('select', 'select');
          var key = 'plan.own.' + day.date + '.' + slot;
          var pool = (DATA.meals.levels[mealLevelFor(day.fastingLevel)] || []).filter(function (m) {
            return m.meal === slot.toLowerCase();
          });
          var blank = el('option', null, '— choose —'); blank.value = '';
          sel.appendChild(blank);
          pool.forEach(function (m) {
            var op = el('option', null, m.name); op.value = m.name; sel.appendChild(op);
          });
          sel.value = get(key, '');
          if (sel.selectedIndex === -1) sel.value = '';
          sel.setAttribute('aria-label', slot + ' for ' + longDate(day.date));
          sel.addEventListener('change', function () { set(key, sel.value); });
          row.appendChild(sel);
        } else {
          row.appendChild(el('span', null, meals[slot]));
        }
        card.appendChild(row);
      });

      var notes = el('div');
      fieldGroup(notes, 'plan.notes.' + day.date, [
        { k: 'prep', label: 'Preparation and leftovers', long: true, rows: 2, hint: 'What to cook ahead, what carries over' }
      ]);
      card.appendChild(notes);
      host.appendChild(card);
    });
  }

  function renderRecipes() {
    var host = document.getElementById('recipe-list');
    if (host.children.length) return;
    host.appendChild(el('p', 'view-note', DATA.recipes.note));
    DATA.recipes.recipes.forEach(function (r) {
      var wrap = el('div', 'recipe');
      var det = el('details');
      det.appendChild(el('summary', null, r.name));
      det.appendChild(el('div', 'rmeta', [lg(r.level).goarchLabel, r.cuisine, 'Prep ' + r.prep, 'Cook ' + r.cook, r.servings + ' servings', r.difficulty].join(' · ')));
      det.appendChild(el('h4', null, 'Ingredients'));
      var ui = el('ul'); r.ingredients.forEach(function (x) { ui.appendChild(el('li', null, x)); }); det.appendChild(ui);
      det.appendChild(el('h4', null, 'Directions'));
      var ol = el('ol'); r.directions.forEach(function (x) { ol.appendChild(el('li', null, x)); }); det.appendChild(ol);
      [['Oil-free', r.oilFree], ['For children', r.childFriendly], ['Batch cooking', r.batch],
       ['Storage', r.storage], ['Leftovers', r.leftovers], ['Allergens', r.allergens]].forEach(function (pair) {
        if (!pair[1]) return;
        det.appendChild(el('h4', null, pair[0]));
        det.appendChild(el('p', null, pair[1]));
      });
      det.appendChild(btn('btn btn-print', 'Print this recipe', function () { det.open = true; window.print(); }));
      wrap.appendChild(det);
      host.appendChild(wrap);
    });
  }

  function renderCelebration() {
    var host = document.getElementById('celebration-list');
    if (host.children.length) return;
    var c = el('div', 'callout');
    c.appendChild(el('p', null, DATA.meals.celebrationNote));
    host.appendChild(c);
    DATA.meals.celebrationMenus.forEach(function (m) {
      var card = el('div', 'card');
      card.appendChild(el('h3', null, m.title));
      card.appendChild(el('p', 'small', m.for));
      var ul = el('ul');
      m.items.forEach(function (i) { ul.appendChild(el('li', null, i)); });
      card.appendChild(ul);
      host.appendChild(card);
    });
  }

  /* ================= JOURNEY ================= */
  var JOURNEY_FIELDS = {
    '2026-08-01': [
      { k: 'intent', label: 'What am I praying for during this fast?', long: true, rows: 4 },
      { k: 'prep', label: 'What are we changing in the household for these two weeks?', long: true, rows: 3 }
    ],
    '2026-08-05': [
      { k: 'checklist', label: 'Baptism and Chrismation checklist — what still needs doing', long: true, rows: 4, hint: 'Garment, cross, towels, candles, who is bringing what' },
      { k: 'intentions', label: 'Prayer intentions for tomorrow', long: true, rows: 3 }
    ],
    '2026-08-14': [
      { k: 'vigil', label: 'Vespers or vigil tonight — where and when', long: false },
      { k: 'final', label: 'Final reflection on the fourteen days', long: true, rows: 4 }
    ],
    '2026-08-15': [
      { k: 'liturgy', label: 'Where we attended the Divine Liturgy', long: false },
      { k: 'thanks', label: 'Thanksgiving — what we are grateful for at the end of this fast', long: true, rows: 4 },
      { k: 'family', label: 'Family feast-day memories', long: true, rows: 4 }
    ]
  };

  function renderJourney() {
    var host = document.getElementById('timeline');
    if (host.children.length) return;
    DATA.overlay.days.forEach(function (o, i) {
      var day = dayFor(o.date);
      if (!day) return;
      var li = el('li', 'tl-item' + (day.isGreatFeast ? ' is-feast' : '') + (day.isPersonalMilestone ? ' is-ours' : ''));
      var d = parseISO(day.date);
      li.appendChild(el('p', 'tl-date', MON[d.getMonth()] + ' ' + d.getDate() + ' · ' + DOW[d.getDay()]));
      li.appendChild(el('h3', 'tl-title', day.title));
      li.appendChild(badge(day.fastingLevel, false));
      if (day.spiritualFocus) li.appendChild(el('p', null, day.spiritualFocus));
      if (JOURNEY_FIELDS[day.date]) fieldGroup(li, 'journey.' + day.date, JOURNEY_FIELDS[day.date]);
      host.appendChild(li);

      if (i === 0) {
        var p = el('li', 'tl-item');
        p.appendChild(el('p', 'tl-date', 'August 1–14'));
        p.appendChild(el('h3', 'tl-title', 'Paraklesis during the Dormition Fast'));
        p.appendChild(el('p', null, 'The Small and Great Paraklesis canons to the Theotokos are served through these two weeks. Parish schedules vary considerably — this app does not generate one. Write yours here as you learn it.'));
        fieldGroup(p, 'journey.paraklesis', [
          { k: 'parish', label: 'Parish', long: false },
          { k: 'small', label: 'Small Paraklesis — dates and times', long: true, rows: 3 },
          { k: 'great', label: 'Great Paraklesis — dates and times', long: true, rows: 2 },
          { k: 'notes', label: 'Notes from the services', long: true, rows: 4 }
        ]);
        host.appendChild(p);
      }
    });
  }

  /* ================= FEASTS ================= */
  var ICONS = {
    transfiguration: {
      alt: 'Icon of the Transfiguration: Christ within a mandorla of light on the mountain, Moses and Elijah to either side, and the three apostles below.',
      feast: 'https://www.goarch.org/transfiguration'
    },
    dormition: {
      alt: 'Icon of the Dormition: the Theotokos on her bier surrounded by the apostles, with Christ behind her holding her soul.',
      feast: 'https://www.goarch.org/dormition'
    }
  };

  function mountIcon(slot) {
    var frame = document.querySelector('[data-icon-slot="' + slot + '"]');
    if (!frame) return;
    var cfg = ICONS[slot];
    IDB.get(slot).then(function (rec) {
      clear(frame);
      if (rec && rec.dataUrl) {
        var fig = el('figure', 'icon-fig');
        var img = el('img');
        img.src = rec.dataUrl;
        img.alt = cfg.alt;
        img.loading = 'lazy';
        if (rec.w) img.width = rec.w;
        if (rec.h) img.height = rec.h;
        fig.appendChild(img);
        var cap = el('figcaption', 'icon-cap');
        cap.appendChild(el('span', null, rec.title || 'Icon added by you'));
        if (rec.credit) cap.appendChild(el('span', 'small', rec.credit));
        if (rec.license) cap.appendChild(el('span', 'small', rec.license));
        fig.appendChild(cap);
        frame.appendChild(fig);
        var row = el('div', 'icon-actions');
        row.appendChild(btn('chip chip-sm', 'Replace', function () { iconPrompt(slot); }));
        row.appendChild(btn('chip chip-sm', 'Remove', function () {
          if (window.confirm('Remove this icon from the app?')) IDB.del(slot).then(function () { mountIcon(slot); });
        }));
        frame.appendChild(row);
      } else {
        frame.appendChild(placeholderArt(slot));
        frame.appendChild(btn('btn', 'Add an icon', function () { iconPrompt(slot); }));
      }
    }).catch(function () {
      clear(frame);
      frame.appendChild(placeholderArt(slot));
    });
  }

  function placeholderArt(slot) {
    var box = el('div', 'icon-placeholder');
    var svg = svgEl('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true', 'class': 'mandorla' });
    var shapes = slot === 'transfiguration'
      ? [['circle', { cx: 60, cy: 52, r: 34 }], ['circle', { cx: 60, cy: 52, r: 26 }], ['circle', { cx: 60, cy: 52, r: 18 }]]
      : [['rect', { x: 24, y: 54, width: 72, height: 12 }], ['circle', { cx: 60, cy: 40, r: 20 }], ['circle', { cx: 60, cy: 40, r: 12 }]];
    shapes.forEach(function (s) {
      var a = s[1];
      a.fill = 'none'; a.stroke = 'currentColor'; a['stroke-width'] = '1.2';
      svg.appendChild(svgEl(s[0], a));
    });
    box.appendChild(svg);
    box.appendChild(el('p', null, 'No icon added yet.'));
    var p2 = el('p', 'small');
    p2.appendChild(document.createTextNode('Add a properly licensed image from this device, or view the feast on the '));
    p2.appendChild(link(ICONS[slot].feast, 'GOARCH feast page'));
    p2.appendChild(document.createTextNode('. The README names two public-domain files that fit.'));
    box.appendChild(p2);
    return box;
  }

  function iconPrompt(slot) {
    var input = document.getElementById('icon-file');
    input.onchange = function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { window.alert('That is not an image file.'); return; }
      if (f.size > 6 * 1024 * 1024) {
        window.alert('That image is over 6 MB. Resize it to roughly 1000 pixels wide first — the app keeps it on your device.');
        return;
      }
      var r = new FileReader();
      r.onload = function () {
        var probe = new Image();
        probe.onload = function () {
          var title = window.prompt('What is this icon? e.g. The Transfiguration, c. 1403, Tretyakov Gallery', '') || '';
          var credit = window.prompt('Creator or holding institution?', '') || '';
          var licence = window.prompt('Licence, so the attribution travels with the image. e.g. Public domain (PD-Art)', '') || '';
          IDB.put(slot, {
            dataUrl: r.result, title: title, credit: credit, license: licence,
            w: probe.naturalWidth, h: probe.naturalHeight, added: new Date().toISOString()
          }).then(function () { mountIcon(slot); })
            .catch(function () { window.alert('That image could not be stored. It may be too large for this browser.'); });
        };
        probe.src = r.result;
      };
      r.readAsDataURL(f);
    };
    input.click();
  }

  function renderFeastFields() {
    mountIcon('transfiguration');
    mountIcon('dormition');
    var t = document.getElementById('transfig-fields');
    if (!t.children.length) {
      fieldGroup(t, 'transfig', [
        { k: 'myname', label: 'My baptismal or saint name', long: false },
        { k: 'sonname', label: 'My son\u2019s baptismal or saint name', long: false },
        { k: 'sponsors', label: 'Godparents and sponsors', long: false },
        { k: 'parish', label: 'Parish', long: false },
        { k: 'priest', label: 'Priest', long: false },
        { k: 'when', label: 'Date and time of the service', long: false },
        { k: 'scripture', label: 'Scripture or hymn I want to remember', long: true, rows: 2 },
        { k: 'before', label: 'What I felt before the service', long: true, rows: 3 },
        { k: 'remember', label: 'What I want to remember from this day', long: true, rows: 4 },
        { k: 'homily', label: 'Notes from the homily', long: true, rows: 3 },
        { k: 'communion', label: 'First Holy Communion — what it was like', long: true, rows: 3 },
        { k: 'gifts', label: 'Gifts and icons received', long: true, rows: 2 },
        { k: 'photos', label: 'Where our photographs from today are kept', long: false, hint: 'A folder, an album, a link' },
        { k: 'letterself', label: 'A letter to my future self', long: true, rows: 6 },
        { k: 'letterson', label: 'A letter to my son, to read when he is older', long: true, rows: 6 }
      ]);
    }
    var d = document.getElementById('dormition-fields');
    if (!d.children.length) {
      fieldGroup(d, 'dormfeast', [
        { k: 'services', label: 'Notes from Vespers, Orthros or the Divine Liturgy', long: true, rows: 4 },
        { k: 'thanks', label: 'Thanksgiving at the end of the fast', long: true, rows: 4 },
        { k: 'family', label: 'How the fast affected our family', long: true, rows: 4 },
        { k: 'feastday', label: 'Our feast-day table — who was there, what we ate', long: true, rows: 3 }
      ]);
    }
  }

  /* ================= MEMORIES ================= */
  function renderMemories() {
    var host = document.getElementById('memories-fields');
    if (host.children.length) return;
    fieldGroup(host, 'keepsake', [
      { k: 'parish', label: 'Our parish', long: false },
      { k: 'reception', label: 'Date we were received', long: false },
      { k: 'mypatron', label: 'My patron saint', long: false },
      { k: 'sonpatron', label: 'My son\u2019s patron saint', long: false },
      { k: 'sponsors', label: 'Sponsors and godparents', long: false },
      { k: 'priest', label: 'Our priest', long: false },
      { k: 'service', label: 'Our favourite service this year', long: false },
      { k: 'hymn', label: 'Our favourite hymn', long: false },
      { k: 'meal', label: 'Our favourite fasting meal', long: false },
      { k: 'surprised', label: 'What surprised us', long: true, rows: 3 },
      { k: 'challenged', label: 'What challenged us', long: true, rows: 3 },
      { k: 'joy', label: 'What brought us joy', long: true, rows: 3 },
      { k: 'taught', label: 'What Christ taught our family', long: true, rows: 4 },
      { k: 'photos', label: 'Where our photographs are kept', long: false },
      { k: 'intentions', label: 'Our family prayer intentions', long: true, rows: 4 },
      { k: 'letter', label: 'A letter to our future family', long: true, rows: 6 },
      { k: 'later1', label: 'Returning later — one year on', long: true, rows: 4 },
      { k: 'later2', label: 'Returning later — further reflections', long: true, rows: 4 }
    ]);
  }

  /* ================= MORE ================= */
  function renderParish() {
    var host = document.getElementById('parish-fields');
    if (host.children.length) return;
    fieldGroup(host, 'parish', [
      { k: 'name', label: 'Parish name', long: false },
      { k: 'priest', label: 'Priest', long: false },
      { k: 'website', label: 'Parish website', long: false },
      { k: 'confession', label: 'Confession — date and time', long: false },
      { k: 'paraklesis', label: 'Paraklesis schedule', long: true, rows: 3 },
      { k: 'vespers', label: 'Vespers schedule', long: true, rows: 2 },
      { k: 'orthros', label: 'Orthros schedule', long: true, rows: 2 },
      { k: 'liturgy', label: 'Divine Liturgy schedule', long: true, rows: 2 },
      { k: 'baptismprep', label: 'Baptism rehearsal or preparation', long: true, rows: 2 },
      { k: 'chrismprep', label: 'Chrismation preparation', long: true, rows: 2 },
      { k: 'questions', label: 'Questions for my priest', long: true, rows: 4 },
      { k: 'commemorate', label: 'Names to commemorate', long: true, rows: 4 },
      { k: 'requests', label: 'Prayer requests', long: true, rows: 4 },
      { k: 'homilies', label: 'Notes from homilies', long: true, rows: 4 },
      { k: 'reminders', label: 'Service reminders', long: true, rows: 3 }
    ]);
  }

  var PRACTICES = ['Prayer', 'Scripture', 'Fasting intention', 'Almsgiving or generosity', 'An act of kindness', 'Attended a service', 'Gratitude', 'Journal'];
  function renderPractice() {
    var sel = document.getElementById('practice-date');
    if (!sel.children.length) {
      DATA.overlay.days.forEach(function (d) {
        var o = el('option', null, longDate(d.date));
        o.value = d.date;
        sel.appendChild(o);
      });
      var t = todayISO();
      sel.value = DATA.ov[t] ? t : DATA.overlay.days[0].date;
      sel.addEventListener('change', drawPractice);
    }
    drawPractice();
  }
  function drawPractice() {
    var sel = document.getElementById('practice-date');
    var host = document.getElementById('practice-list');
    clear(host);
    PRACTICES.forEach(function (p, i) {
      var key = 'practice.' + sel.value + '.' + i;
      var row = el('div', 'check-row');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.id = 'pr_' + i;
      cb.checked = !!get(key, false);
      cb.addEventListener('change', function () { set(key, cb.checked); });
      var lab = el('label', null, p);
      lab.htmlFor = cb.id;
      row.appendChild(cb);
      row.appendChild(lab);
      host.appendChild(row);
    });
  }

  /* ---------- prayer rope counter (session only, never saved) ---------- */
  (function () {
    var count = 0, goal = 33;
    var btn = document.getElementById('rope-btn');
    var out = document.getElementById('rope-count');
    if (!btn) return;
    function paint() {
      out.textContent = count;
      btn.classList.toggle('rope-done', count >= goal);
      if (count >= goal && count === goal) {
        // one gentle acknowledgement at the goal, nothing more
        btn.setAttribute('aria-label', goal + ' prayers. The rope is complete; continue or begin again.');
      }
    }
    btn.addEventListener('click', function () { count++; paint(); });
    document.getElementById('rope-reset').addEventListener('click', function () { count = 0; paint(); });
    document.querySelectorAll('.rope-goal').forEach(function (g) {
      g.addEventListener('click', function () {
        goal = +g.getAttribute('data-goal');
        document.querySelectorAll('.rope-goal').forEach(function (x) { x.classList.remove('is-on'); });
        g.classList.add('is-on');
        paint();
      });
    });
    paint();
  })();

  /* ---------- export / import / clear ---------- */
  function collect() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(NS) === 0) out[k.slice(NS.length)] = localStorage.getItem(k);
    }
    return { app: 'dormition-fast-companion', version: 1, exported: new Date().toISOString(), data: out };
  }
  document.getElementById('export-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dormition-companion-' + todayISO() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    say('Exported. Keep that file somewhere that is actually backed up. Icons you added are stored separately and are not in it — they can be re-added.');
  });
  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var parsed = JSON.parse(r.result);
        if (!parsed || parsed.app !== 'dormition-fast-companion') throw new Error('not ours');
        var keys = Object.keys(parsed.data || {});
        if (!window.confirm('Import ' + keys.length + ' saved items? Anything with the same name will be replaced. Entries not in the file are kept.')) return;
        keys.forEach(function (k) { localStorage.setItem(NS + k, parsed.data[k]); });
        say('Imported ' + keys.length + ' items. Reloading.');
        setTimeout(function () { location.reload(); }, 700);
      } catch (err) {
        say('That file could not be read as a Dormition Companion export. Nothing was changed.');
      }
    };
    r.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('clear-btn').addEventListener('click', function () {
    if (!window.confirm('Delete every journal entry, note, memory, added icon and setting stored in this browser?\n\nThis cannot be undone. Export first if you have not.')) return;
    if (!window.confirm('Last check — permanently delete all of it?')) return;
    var kill = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(NS) === 0) kill.push(k);
    }
    kill.forEach(function (k) { localStorage.removeItem(k); });
    IDB.del('transfiguration').catch(function () {});
    IDB.del('dormition').catch(function () {});
    say('All local data cleared. Reloading.');
    setTimeout(function () { location.reload(); }, 700);
  });
  document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
  function say(msg) { document.getElementById('storage-note').textContent = msg; }

  /* ---------- text size ---------- */
  var SIZES = ['', 'lg', 'xl'];
  function applyTextSize() {
    var s = get('settings.textSize', '');
    if (s) document.body.setAttribute('data-text', s); else document.body.removeAttribute('data-text');
  }
  document.getElementById('text-size-btn').addEventListener('click', function () {
    var cur = get('settings.textSize', '');
    set('settings.textSize', SIZES[(SIZES.indexOf(cur) + 1) % SIZES.length]);
    applyTextSize();
  });

  /* ---------- routing ---------- */
  var VIEWS = ['today', 'calendar', 'meals', 'journey', 'feasts', 'memories', 'more'];
  function go(view) {
    if (VIEWS.indexOf(view) === -1) view = 'today';
    state.view = view;
    VIEWS.forEach(function (v) { document.getElementById('view-' + v).hidden = (v !== view); });
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      var on = b.getAttribute('data-view') === view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    if (view === 'today') renderToday();
    if (view === 'calendar') { renderFastStrip(); renderMonth(); renderIndex(); }
    if (view === 'meals') { renderMeals(); renderPlanner(); renderRecipes(); renderCelebration(); }
    if (view === 'journey') renderJourney();
    if (view === 'feasts') renderFeastFields();
    if (view === 'memories') renderMemories();
    if (view === 'more') { renderParish(); renderPractice(); }
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    window.scrollTo(0, 0);
    document.getElementById('main').focus({ preventScroll: true });
  }
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-view')); });
  });

  function chipGroup(attr, apply) {
    document.querySelectorAll('[' + attr + ']').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('[' + attr + ']').forEach(function (x) { x.classList.remove('is-on'); });
        c.classList.add('is-on');
        apply(c.getAttribute(attr));
      });
    });
  }
  chipGroup('data-filter', function (v) { state.filter = v; renderFastStrip(); });
  chipGroup('data-level', function (v) { state.level = v; renderMeals(); });
  chipGroup('data-tag', function (v) { state.tag = v; renderMeals(); });
  chipGroup('data-plan', function (v) { state.plan = v; renderPlanner(); });
  chipGroup('data-span', function (v) { state.span = v; renderPlanner(); });
  chipGroup('data-index', function (v) { state.indexSet = v; renderIndex(); });

  function tabs(attr, prefix, after) {
    document.querySelectorAll('[' + attr + ']').forEach(function (t) {
      t.addEventListener('click', function () {
        var key = t.getAttribute(attr);
        document.querySelectorAll('[' + attr + ']').forEach(function (x) {
          x.classList.remove('is-on'); x.setAttribute('aria-selected', 'false');
          var pane = document.getElementById(prefix + x.getAttribute(attr));
          if (pane) pane.hidden = true;
        });
        t.classList.add('is-on'); t.setAttribute('aria-selected', 'true');
        var p = document.getElementById(prefix + key);
        if (p) p.hidden = false;
        if (after) after(key);
      });
    });
  }
  tabs('data-ctab', 'cpane-', function (k) {
    if (k === 'year') renderMonth();
    if (k === 'wheel') renderWheel();
    if (k === 'index') renderIndex();
    if (k === 'search') document.getElementById('search-box').focus();
  });
  tabs('data-mtab', 'mpane-');
  tabs('data-ftab', 'fpane-');
  tabs('data-otab', 'opane-');

  var sb = document.getElementById('search-box');
  var sTimer;
  sb.addEventListener('input', function () {
    clearTimeout(sTimer);
    sTimer = setTimeout(function () { runSearch(sb.value); }, 180);
  });

  /* ---------- offline ---------- */
  function net() { document.getElementById('offline-banner').hidden = navigator.onLine; }
  window.addEventListener('online', net);
  window.addEventListener('offline', net);

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        function offerUpdate(worker) {
          var banner = document.getElementById('update-banner');
          banner.hidden = false;
          document.getElementById('update-now').onclick = function () {
            worker.postMessage({ type: 'SKIP_WAITING' });
          };
        }
        if (reg.waiting) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(nw);
          });
        });
      }).catch(function () { /* offline or unsupported — the app still runs */ });

      var reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
    });
  }

  /* ---------- boot ---------- */
  function loadJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path);
      return r.json();
    });
  }

  applyTextSize();
  net();

  Promise.all([
    loadJSON('data/calendar-year.json'),
    loadJSON('data/dormition-overlay-2026.json'),
    loadJSON('data/meals.json'),
    loadJSON('data/recipes.json'),
    loadJSON('data/devotional-prompts.json')
  ]).then(function (res) {
    DATA.year = res[0]; DATA.overlay = res[1]; DATA.meals = res[2]; DATA.recipes = res[3]; DATA.prompts = res[4];
    DATA.year.days.forEach(function (d) { DATA.byDate[d.date] = d; });
    DATA.overlay.days.forEach(function (d) { DATA.ov[d.date] = d; });

    document.getElementById('header-sub').textContent =
      DATA.year.dayCount + ' days · ' + shortDate(DATA.year.rangeStart) + ' ' + DATA.year.rangeStart.slice(0, 4) +
      ' – ' + shortDate(DATA.year.rangeEnd) + ' ' + DATA.year.rangeEnd.slice(0, 4);
    document.getElementById('verify-note').textContent = DATA.overlay.verificationNote;

    var start = (location.hash || '').replace('#', '');
    go(VIEWS.indexOf(start) !== -1 ? start : 'today');
  }).catch(function () {
    var m = document.getElementById('today-content');
    clear(m);
    var c = el('div', 'card');
    c.appendChild(el('h3', null, 'The calendar data did not load'));
    c.appendChild(el('p', null, 'The app could not read its data files. If you opened index.html directly from the file system, that is the cause — browsers block it. Serve the folder over http instead, or open the published address.'));
    c.appendChild(el('p', 'small', 'From the project folder: python3 -m http.server 8000, then visit http://localhost:8000'));
    m.appendChild(c);
  });
})();
