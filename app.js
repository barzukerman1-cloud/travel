// See The World — client-side app logic.
// Ported from the Claude Design prototype (project/See The World.dc.html):
// same screens, same mock data, same state machine, rebuilt as a plain
// vanilla-JS single page app instead of the design tool's DC runtime.
(function () {
  'use strict';

  // ── "Feel" tokens ──────────────────────────────────────────────────────
  // In the design tool these were tweakable knobs (dc_set_props) for
  // exploring the system. The chat landed on pastel pink / Paper / Editorial
  // as the shipped defaults, so they're fixed here rather than exposed as
  // end-user settings.
  const FEEL = { accent: '#f0b0cd', mapSkin: 'Paper', chrome: 'Editorial' };

  const SKINS = {
    Paper: { ground: '#eae9e9', inkHex: '#201e1d', line: 'rgba(32,30,29,.12)', block: '#d7d3d3', road: '#f3f2f2', label: 'rgba(32,30,29,.5)', chip: '#f3f2f2', chipFg: '#201e1d' },
    Ink: { ground: '#201e1d', inkHex: '#f3f2f2', line: 'rgba(243,242,242,.16)', block: '#2d2b2b', road: 'rgba(243,242,242,.5)', label: 'rgba(243,242,242,.5)', chip: '#201e1d', chipFg: '#f3f2f2' },
    Blueprint: { ground: '#e4ebef', inkHex: '#1f3a4f', line: 'rgba(31,58,79,.28)', block: '#cfdde5', road: '#f5f9fb', label: 'rgba(31,58,79,.6)', chip: '#f5f9fb', chipFg: '#1f3a4f' }
  };

  function relLuminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function mix(accHex, pct, other) { return 'color-mix(in srgb, ' + accHex + ' ' + pct + '%, ' + other + ')'; }

  function computeTokens() {
    const accHex = FEEL.accent;
    const accLum = relLuminance(accHex);
    const accOn = accLum > 0.55 ? '#201e1d' : '#f3f2f2';
    const sk = SKINS[FEEL.mapSkin] || SKINS.Paper;
    const poster = FEEL.chrome === 'Poster';
    return {
      accHex,
      accDeep: mix(accHex, 80, '#2b211c'),
      accInk: mix(accHex, accLum > 0.7 ? 30 : 52, '#2b211c'),
      accTint: mix(accHex, accLum > 0.7 ? 55 : 22, '#f3f2f2'),
      accOn,
      mapGround: sk.ground, mapInkHex: sk.inkHex, mapLine: sk.line, mapBlock: sk.block,
      mapRoad: sk.road, mapLabel: sk.label, mapChip: sk.chip, mapChipFg: sk.chipFg,
      hdrBg: poster ? accHex : 'transparent', hdrFg: poster ? accOn : '#201e1d'
    };
  }

  function applyTokens() {
    const t = computeTokens();
    const r = document.documentElement.style;
    r.setProperty('--acc', t.accHex);
    r.setProperty('--accDeep', t.accDeep);
    r.setProperty('--accInk', t.accInk);
    r.setProperty('--accTint', t.accTint);
    r.setProperty('--accOn', t.accOn);
    r.setProperty('--mapGround', t.mapGround);
    r.setProperty('--mapLine', t.mapLine);
    r.setProperty('--mapBlock', t.mapBlock);
    r.setProperty('--mapRoad', t.mapRoad);
    r.setProperty('--mapLabel', t.mapLabel);
    r.setProperty('--mapChip', t.mapChip);
    r.setProperty('--mapChipFg', t.mapChipFg);
    r.setProperty('--hdrBg', t.hdrBg);
    r.setProperty('--hdrFg', t.hdrFg);
    return t;
  }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Mock data ───────────────────────────────────────────────────────────
  const PLACES = {
    toriki: { kicker: 'Yakitori · Meguro', name: 'Toriki', meta: '12 min from your hotel · queue by 17:30', blurb: "Six seats, one grill, no menu in English. The kind of place a reel finds and a guidebook doesn't.", best: '17:30', queue: '~35 min', travel: '12 min', savedBy: 'Mika + 3', source: '@tokyofoodgirl — reel', stamp: '0:09' },
    fuglen: { kicker: 'Coffee · Tomigaya', name: 'Fuglen Tomigaya', meta: 'Norwegian coffee, 8 min walk from Yoyogi', blurb: 'Oslo furniture, Tokyo pour-over. Empty at 08:00, impossible at 11:00.', best: '08:00', queue: 'none', travel: '9 min', savedBy: 'Mika', source: '@tokyofoodgirl — reel', stamp: '0:25' },
    canal: { kicker: 'Walk · Nakameguro', name: 'Nakameguro canal', meta: '1.4 km of cherry trees along the water', blurb: 'The walk everyone films in April. Quieter and better at dusk in any other month.', best: 'dusk', queue: 'none', travel: '6 min', savedBy: 'Mika + 8', source: '@tokyofoodgirl — reel', stamp: '0:41' },
    meiji: { kicker: 'Shrine · Shibuya', name: 'Meiji Jingu', meta: 'Forest shrine, open sunrise to sunset', blurb: 'A hundred thousand donated trees pretending to be an ancient forest. It works.', best: '07:00', queue: 'none', travel: '18 min', savedBy: '4 friends', source: 'saved from search', stamp: '—' },
    fish: { kicker: 'Market · Toyosu', name: 'Toyosu market', meta: 'Tuna auction viewing deck, 05:30', blurb: "Set an alarm you'll resent, then eat the best breakfast of the trip.", best: '05:30', queue: '~20 min', travel: '26 min', savedBy: 'Mika + 12', source: 'saved from search', stamp: '—' }
  };

  const PALETTE = [
    { c: '#c04a2b', n: 'Terracotta' },
    { c: '#8f3623', n: 'Rust' },
    { c: '#e8a98d', n: 'Clay' },
    { c: '#201e1d', n: 'Ink' },
    { c: '#7d7979', n: 'Grey' },
    { c: '#f3f2f2', n: 'Paper' }
  ];

  function swatchesFor(current) {
    return PALETTE.map(p => ({
      color: p.c,
      border: current === p.c ? 'var(--acc)' : '#201e1d',
      tick: current === p.c ? '✓' : '',
      tickFg: (p.c === '#f3f2f2' || p.c === '#e8a98d') ? '#201e1d' : '#f3f2f2'
    }));
  }

  const WORLD_PINS = [
    { name: 'TOKYO', lon: 139.7, lat: 35.68 },
    { name: 'LISBON', lon: -9.14, lat: 38.72, anchor: 'end' },
    { name: 'CDMX', lon: -99.13, lat: 19.43 },
    { name: 'REYKJAVÍK', lon: -21.9, lat: 64.14 },
    { name: 'HANOI', lon: 105.85, lat: 21.03, kind: 'friend' },
    { name: 'ATHENS', lon: 23.73, lat: 37.98, kind: 'friend' }
  ];

  const COUNTRY_DEFS = [
    ['Japan', '8 days · in 3 weeks', 'NEXT', 'Tokyo → Hakone → Kyoto'],
    ['Portugal', 'Sep 2025 · 11 days', 'BEEN', '24 places saved'],
    ['Mexico', 'Feb 2025 · 9 days', 'BEEN', '31 places saved'],
    ['Iceland', 'Jun 2024 · 6 days', 'BEEN', '12 places saved'],
    ['Vietnam', 'Mika, last month', 'FRIEND', '19 places you can steal']
  ];

  const CITY_PIN_DEFS = [
    ['toriki', 'Toriki', 132, 392, 22, 'var(--acc)', '#f3f2f2', '▮'],
    ['fuglen', 'Fuglen', 78, 216, 20, '#f3f2f2', '#201e1d', '▮'],
    ['canal', 'Nakameguro', 268, 470, 20, 'var(--acc)', '#f3f2f2', '▮'],
    ['meiji', 'Meiji Jingu', 96, 156, 20, '#f3f2f2', '#201e1d', '▮'],
    ['fish', 'Toyosu', 300, 290, 26, '#201e1d', '#f3f2f2', '7']
  ];

  const FEED = [
    { initials: 'MK', name: 'Mika Kondo', meta: 'Kyoto · 4 days ago', shot: 'Pontocho at dusk', tag: 'FROM A REEL', places: 6, body: 'Ate my way down one alley. Third door on the left is the one.' },
    { initials: 'DV', name: 'Dan Vermeer', meta: 'Lisbon · last week', shot: 'Alfama rooftops', tag: 'TRAIL SHARED', places: 11, body: 'Nine of these came out of one TikTok. Eight of them were good.' },
    { initials: 'RA', name: 'Rania A.', meta: 'Hakone · 2 weeks ago', shot: 'onsen courtyard', tag: 'FROM A REEL', places: 3, body: 'The onsen nobody films. Now slightly filmed. Sorry.' }
  ];

  const RECENTS = [
    { title: '@tokyofoodgirl — 6 Tokyo counters', meta: 'Instagram reel · 1:06 · shared 2 min ago' },
    { title: '@kyotoslow — machiya breakfast', meta: 'TikTok · 0:48 · shared yesterday' },
    { title: '@hakonelocal — onsen no one films', meta: 'TikTok · 1:31 · shared Tuesday' }
  ];

  const FOUND_DEFS = [
    ['toriki', 'Toriki', 'Yakitori · Meguro · matched from caption', '0:09'],
    ['fuglen', 'Fuglen Tomigaya', 'Coffee · Tomigaya · matched from sign', '0:25'],
    ['canal', 'Nakameguro canal', 'Walk · matched from geotag', '0:41'],
    ['meiji', 'Meiji Jingu', 'Shrine · mentioned in comments', '0:58']
  ];

  const TRAIL = [
    { name: 'Pontocho alley', meta: 'Kyoto · "third door on the left"' },
    { name: 'Toyosu market', meta: 'Tokyo · went twice' },
    { name: 'Gora Kadan', meta: 'Hakone · same ryokan as you' },
    { name: 'Hanoi — Bún chả Hương Liên', meta: 'Vietnam · last month' }
  ];

  const CHANGES = [
    { day: 'Day 4 · morning', from: '11:40 NH106', to: '07:15 NH106', name: 'HND → ITM', why: 'Airline schedule change, same fare class' },
    { day: 'Day 4 · midday', from: 'Romancecar 14:10', to: 'Romancecar 10:40', name: 'To Hakone', why: 'Rebooked to match the earlier landing' },
    { day: 'Day 4 · afternoon', from: 'Free 3h', to: 'Onsen 13:00', name: 'Gora Kadan check-in', why: 'You gain three hours — we parked them at the ryokan' }
  ];

  const RESULTS_DEFS = [
    ['Toriki', 'Yakitori · Meguro · 12 min', 'FROM VIDEO', 'var(--acc)', 'toriki'],
    ['Toyosu market', 'Market · 26 min', 'SAVED', '#201e1d', 'fish'],
    ['Fuglen Tomigaya', 'Coffee · 9 min', 'FROM VIDEO', 'var(--acc)', 'fuglen'],
    ['Meiji Jingu', 'Shrine · 18 min', 'FRIENDS', '#f3f2f2', 'meiji'],
    ['Nakameguro canal', 'Walk · 6 min', 'FROM VIDEO', 'var(--acc)', 'canal']
  ];

  const LISTS_DEFS = [
    ['19', 'Pulled from videos', 'Tokyo, Kyoto, Hakone · 7 reels', 'var(--acc)', '#f3f2f2', 'map'],
    ['24', 'Japan — everything', 'The whole trip pool', 'transparent', '#201e1d', 'map'],
    ['14', "Mika's picks", 'Stolen with permission', 'transparent', '#201e1d', 'friend'],
    ['10', 'Someday', 'Vietnam, Georgia, Chile', '#201e1d', '#f3f2f2', 'map']
  ];

  const TOGGLE_DEFS = [
    { name: 'Google sync', desc: 'Read flights + stays from Gmail', k: 'gmail' },
    { name: 'Share my trail', desc: 'Per trip, off by default', k: 'share' },
    { name: 'Change alerts', desc: 'Push me when a booking moves', k: 'push' },
    { name: 'Offline maps', desc: 'Download Japan before you fly', k: 'offline' }
  ];

  // ── Route math (ported verbatim from the prototype's Component) ───────
  function legBetween(a, b) {
    if (!a || !a.xy || !b.xy) return null;
    const km = Math.hypot(b.xy[0] - a.xy[0], b.xy[1] - a.xy[1]) * 1.25;
    if (km < 0.05) return { km, d: '90 m', t: '2 min', mode: 'WALK' };
    const train = km > 3.2;
    const mins = train ? km / 25 * 60 + 8 : km / 4.8 * 60;
    return {
      km, d: (km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'),
      t: Math.round(mins) + ' min', mode: train ? (km > 25 ? 'TRAIN + AIR' : 'TRAIN') : 'WALK'
    };
  }
  function legFor(prev, it) { return it.legFixed || legBetween(prev, it); }
  function routeLen(list) { return list.reduce((sum, it, i) => sum + (i ? (legFor(list[i - 1], it) || { km: 0 }).km : 0), 0); }
  function nearestFirst(list) {
    if (list.length < 3) return list;
    const rest = list.slice(1), out = [list[0]];
    while (rest.length) {
      let bi = 0, bd = Infinity;
      rest.forEach((c, i) => { const l = legBetween(out[out.length - 1], c); const d = l ? l.km : 0; if (d < bd) { bd = d; bi = i; } });
      out.push(rest.splice(bi, 1)[0]);
    }
    return out;
  }
  function legMins(l) {
    if (!l) return 0;
    const p = l.t.match(/(?:(\d+)\s*h)?\s*(\d+)?/);
    return l.t.includes('h') ? Number(p[1] || 0) * 60 + Number(p[2] || 0) : Number(p[2] || 0);
  }

  function getDayPlans(alertState) {
    const accent = 'var(--acc)';
    return {
      1: { title: 'Arrive Tokyo', meta: 'Shinjuku · arrival day', items: [
        { time: '14:20', xy: [0, 0], name: 'HND → hotel', note: 'Airport limousine bus, 55 min', rule: 'rgba(32,30,29,.25)' },
        { time: '17:00', xy: [0.3, 0.2], name: 'Omoide Yokocho', note: 'Smoke, beer, no plan', rule: 'rgba(32,30,29,.25)' },
        { time: '20:30', xy: [4.5, -4.2], name: 'Toriki', note: 'From @tokyofoodgirl', rule: accent, flag: true, flagText: 'FROM A VIDEO' }
      ] },
      2: { title: 'Shibuya + Meguro', meta: '2 stops from videos', items: [
        { time: '08:00', xy: [0, 0], name: 'Fuglen Tomigaya', note: 'Before the queue exists', rule: accent, flag: true, flagText: 'FROM A VIDEO' },
        { time: '09:30', xy: [1.1, 0.4], name: 'Meiji Jingu', note: 'Enter from Harajuku gate', rule: 'rgba(32,30,29,.25)' },
        { time: '13:00', xy: [2.6, -2.9], name: 'Nakameguro canal', note: 'Same afternoon as Fuglen — we paired them', rule: accent, flag: true, flagText: 'AUTO-PAIRED' },
        { time: '19:00', xy: [1.4, -0.9], name: 'Free', note: '3 saved places within 1 km', rule: 'rgba(32,30,29,.25)' }
      ] },
      3: { title: 'Toyosu + Ginza', meta: 'Early start', items: [
        { time: '05:30', xy: [0, 0], name: 'Toyosu market', note: 'Tuna auction deck', rule: 'rgba(32,30,29,.25)' },
        { time: '09:00', xy: [0.4, 0.2], name: 'Sushi breakfast', note: 'Whatever has the shortest line', rule: 'rgba(32,30,29,.25)' },
        { time: '15:00', xy: [4.8, 1.6], name: 'Ginza wander', note: 'Itoya, then Dover Street', rule: 'rgba(32,30,29,.25)' }
      ] },
      4: { title: 'Tokyo → Hakone', meta: 'Travel day · flight changed', travel: true, items: [
        { time: alertState === 'accepted' ? '07:15' : '11:40', xy: [0, 0], name: 'NH106 HND → ITM', note: alertState === 'accepted' ? 'Moved earlier — plan rebuilt' : 'Airline moved this 4h 25m earlier', rule: accent, flag: true, flagText: alertState === 'accepted' ? 'UPDATED' : 'NEEDS REVIEW' },
        { time: alertState === 'accepted' ? '10:40' : '14:10', legFixed: { km: 92, d: '92 km', t: '2 h 05', mode: 'FLIGHT + TRAIN' }, name: 'Romancecar to Hakone', note: 'Seat 4A booked', rule: 'rgba(32,30,29,.25)' },
        { time: alertState === 'accepted' ? '13:00' : '16:30', legFixed: { km: 1.8, d: '1.8 km', t: '12 min', mode: 'BUS' }, name: 'Gora Kadan check-in', note: 'Onsen, ryokan dinner at 18:30', rule: 'rgba(32,30,29,.25)' }
      ] },
      5: { title: 'Hakone', meta: 'Lake day', items: [
        { time: '09:00', xy: [0, 0], name: 'Open-Air Museum', note: 'Rain plan: it is mostly outdoors', rule: 'rgba(32,30,29,.25)' },
        { time: '14:00', xy: [3.6, -2.1], name: 'Lake Ashi ferry', note: 'Fuji, if she shows up', rule: 'rgba(32,30,29,.25)' }
      ] },
      6: { title: 'Hakone → Kyoto', meta: 'Travel day', travel: true, items: [
        { time: '10:12', xy: [0, 0], name: 'Shinkansen to Kyoto', note: 'Right side for Fuji', rule: 'rgba(32,30,29,.25)' },
        { time: '16:00', legFixed: { km: 2.2, d: '2.2 km', t: '14 min', mode: 'TAXI' }, name: 'Machiya check-in', note: 'Nishijin', rule: 'rgba(32,30,29,.25)' }
      ] },
      7: { title: 'Kyoto east', meta: 'East side on foot', items: [
        { time: '07:00', xy: [0, 0], name: 'Fushimi Inari', note: 'Before the tour buses', rule: 'rgba(32,30,29,.25)' },
        { time: '12:00', xy: [6.4, 3.8], name: 'Nishiki market', note: 'Lunch by grazing', rule: 'rgba(32,30,29,.25)' },
        { time: '18:00', xy: [6.9, 3.6], name: 'Pontocho alley', note: 'Mika: the third door on the left', rule: accent, flag: true, flagText: 'FROM MIKA' }
      ] },
      8: { title: 'Kyoto → home', meta: 'Last morning', travel: true, items: [
        { time: '08:30', xy: [0, 0], name: 'Coffee + pastry', note: '% Arabica, Higashiyama', rule: 'rgba(32,30,29,.25)' },
        { time: '13:40', legFixed: { km: 105, d: '105 km', t: '1 h 40', mode: 'TRAIN' }, name: 'KIX → home', note: 'Check-in opens 10:40', rule: 'rgba(32,30,29,.25)' }
      ] }
    };
  }

  function computeDay(state) {
    const dayPlans = getDayPlans(state.alert);
    const plan = dayPlans[state.day];
    const times = plan.items.map(i => i.time);
    const asPlanned = plan.items;
    const best = plan.travel ? asPlanned : nearestFirst(asPlanned);
    const plannedKm = routeLen(asPlanned), bestKm = routeLen(best);
    const optimised = !!state.routeOpt[state.day];
    const ordered = (optimised ? best : asPlanned).map((it, i) => Object.assign({}, it, { time: times[i] }));
    const totalKm = routeLen(ordered);
    const totalMin = ordered.reduce((m, it, i) => m + (i ? legMins(legFor(ordered[i - 1], it)) : 0), 0);
    const saving = plannedKm - bestKm;

    const dayItems = ordered.map((it, i) => {
      const key = state.day + '-' + i;
      const rule = state.itemColors[key] || it.rule;
      const named = PALETTE.find(p => p.c === rule);
      const leg = i ? legFor(ordered[i - 1], it) : null;
      return Object.assign({}, it, {
        key, rule, picking: state.picking === key,
        leg: !!leg, legText: leg ? leg.d + ' · ' + leg.t : '', legMode: leg ? leg.mode : '',
        colorName: named ? named.n : 'Default'
      });
    });

    return {
      plan, dayItems,
      dayTitle: 'Day ' + state.day + ' — ' + plan.title, dayMeta: plan.meta,
      routeTotal: totalKm.toFixed(1) + ' km',
      routeTime: (totalMin >= 60 ? Math.floor(totalMin / 60) + ' h ' + (totalMin % 60) + ' min' : totalMin + ' min') + ' moving',
      routeStops: ordered.length + ' stops',
      optimised,
      routeHint: plan.travel ? 'Fixed by your bookings — we left the order alone'
        : optimised ? 'Best route — ' + saving.toFixed(1) + ' km shorter than planned'
        : (saving > 0.15 ? 'Reordering saves ' + saving.toFixed(1) + ' km' : 'Already the shortest way round'),
      routeCanOpt: (!plan.travel && saving > 0.15) || optimised,
      routeBtnLabel: optimised ? 'BACK TO MY ORDER' : 'USE BEST ROUTE'
    };
  }

  // ── State ───────────────────────────────────────────────────────────────
  let state = {
    itemColors: {}, pinColors: {}, picking: null, routeOpt: {},
    screen: 'onboard', level: 'world', country: 'Japan',
    place: 'toriki', day: 2, filter: 'ALL', added: {},
    importStep: 'paste', parsePct: 0, keep: { toriki: true, fuglen: true, canal: true, meiji: false },
    following: true, alert: null, toggles: { gmail: true, share: false, push: true, offline: false },
    searchQuery: 'yakitori',
    isPremium: false, freeImportUsed: false, paywallFrom: 'settings',
    premiumPlan: 'annual', activePlan: null
  };
  let parseTimer = null;

  const PLANS = {
    monthly: { id: 'monthly', label: 'Monthly', price: '₪15', period: '/month' },
    annual: { id: 'annual', label: 'Annual', price: '₪120', period: '/year', badge: 'SAVE 33%' }
  };
  const PREMIUM_FEATURES = [
    'Unlimited video imports — past your first one, every Reel and TikTok you share still gets read',
    'Best-route ordering for every itinerary day, not just a preview of the savings',
    'Offline maps — download a country before you fly'
  ];

  function setState(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    Object.assign(state, next);
    render();
  }

  function startParse() {
    setState({ importStep: 'parsing', parsePct: 0 });
    clearInterval(parseTimer);
    parseTimer = setInterval(() => {
      const p = state.parsePct + 7;
      if (p >= 100) { clearInterval(parseTimer); setState({ parsePct: 100, importStep: 'results' }); }
      else setState({ parsePct: p });
    }, 170);
  }

  // ── Screen renderers ────────────────────────────────────────────────────
  // Original illustration (not a stock photo) — a lantern-lit Pontocho-style
  // alley, drawn flat in the app's own ink/paper tones with the accent hue
  // carrying the lantern glow, matching the Modernist system's "no photos of
  // convenience" rule (real content prints black and white; this is a mono
  // scene by construction).
  const HERO_ART = `
    <svg class="hero-art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of a lantern-lit alley in Kyoto at night">
      <rect width="300" height="400" fill="#201e1d"/>
      <polygon points="100,400 100,250 135,260 140,400" fill="#3a3736"/>
      <polygon points="200,400 200,250 165,260 160,400" fill="#3a3736"/>
      <polygon points="0,400 0,160 90,190 100,400" fill="#2d2b2b"/>
      <polygon points="300,400 300,160 210,190 200,400" fill="#2d2b2b"/>
      <rect x="14" y="278" width="34" height="15" fill="#f3f2f2" opacity=".14"/>
      <rect x="20" y="330" width="26" height="12" fill="#f3f2f2" opacity=".1"/>
      <rect x="252" y="258" width="30" height="16" fill="#f3f2f2" opacity=".14"/>
      <rect x="248" y="316" width="24" height="12" fill="#f3f2f2" opacity=".1"/>
      <polyline points="90,190 150,232 210,190" fill="none" stroke="#f3f2f2" stroke-opacity=".25" stroke-width="1.5"/>
      <circle cx="90" cy="190" r="3.5" fill="#f3f2f2" opacity=".65"/>
      <circle class="hero-lantern" cx="121" cy="212" r="6"/>
      <circle class="hero-lantern" cx="150" cy="232" r="8"/>
      <circle class="hero-lantern" cx="179" cy="212" r="6"/>
      <circle cx="210" cy="190" r="3.5" fill="#f3f2f2" opacity=".65"/>
    </svg>
    <span class="onboard-hero-caption">Kyoto · Pontocho alley, night</span>`;

  function renderOnboard() {
    return `
    <div class="onboard">
      <div class="onboard-hero">${HERO_ART}</div>
      <h1>SEE THE<br>WORLD</h1>
      <p class="onboard-sub">Where do we go next? Drop a video, get a map. We keep the plan honest when the airline changes its mind.</p>
      <button class="btn btn-primary btn-block" data-act="connect"><span class="google-icon"></span>Continue with Google</button>
      <button class="btn btn-secondary btn-block" style="margin-top:8px" data-act="connect">Use email instead</button>
      <p class="onboard-fine">Google gives us your flight and hotel confirmations only. Nothing is posted, nothing is public.</p>
    </div>`;
  }

  function renderFeed() {
    return `
    <div class="screen-body">
      <div class="feed-header">
        <h2 class="h-screen">FEED</h2>
        <button class="btn btn-primary" style="padding:9px 12px;font-size:12px;gap:7px" data-act="go-import">+ PASTE VIDEO</button>
      </div>
      <div class="feed-alert">
        <span class="feed-alert-dot"></span>
        <div style="flex:1">
          <div class="feed-alert-title">Flight NH106 moved</div>
          <div class="feed-alert-body">Departs 07:15 instead of 11:40 — Day 4 needs a shuffle</div>
        </div>
        <button class="btn-small" data-act="go-alert">REVIEW</button>
      </div>
      ${FEED.map(p => `
      <div class="feed-post">
        <div class="feed-post-head">
          <span class="avatar">${esc(p.initials)}</span>
          <div style="flex:1;min-width:0"><div class="feed-post-name">${esc(p.name)}</div><div class="feed-post-meta">${esc(p.meta)}</div></div>
          <button class="btn-chip" data-act="go-friend">TRAIL</button>
        </div>
        <div class="placeholder feed-post-shot"><span class="placeholder-label">placeholder — ${esc(p.shot)}</span></div>
        <div class="feed-post-tags">
          <span class="tag tag-tint">${esc(p.tag)}</span>
          <span class="tag tag-neutral">${p.places} PLACES</span>
        </div>
        <p class="feed-post-body">${esc(p.body)}</p>
      </div>`).join('')}
    </div>`;
  }

  function getCountryRows(st) {
    return COUNTRY_DEFS.map(([name, meta, tag, sub]) => ({
      name, meta, tag, sub,
      bg: st.country === name ? '#eae9e9' : 'transparent',
      tagBg: tag === 'BEEN' ? 'rgba(32,30,29,.09)' : tag === 'FRIEND' ? 'rgba(32,30,29,.85)' : 'var(--accTint)',
      tagFg: tag === 'FRIEND' ? '#f3f2f2' : tag === 'BEEN' ? '#201e1d' : 'var(--accInk)'
    }));
  }

  function renderWorld(st, t) {
    const rows = getCountryRows(st);
    const head = st.country === 'Japan' ? 'Next up — 8 days' : st.country === 'Vietnam' ? "Mika's trail" : 'You have been here';
    return `
    <div class="world-wrap">
      <div class="world-map-mount"><world-map ground="${t.mapGround}" ink="${t.mapInkHex}" accent="${t.accHex}"
        visited="Portugal, Mexico, Iceland, Greece, Vietnam" planned="Japan" selected="${esc(st.country)}"
        pins='${JSON.stringify(WORLD_PINS)}'></world-map></div>
      <div class="world-stats">
        <div class="world-stat"><div class="world-stat-n">14</div><div class="world-stat-label">Countries</div></div>
        <div class="world-stat"><div class="world-stat-n">67</div><div class="world-stat-label">Places saved</div></div>
        <div class="world-stat"><div class="world-stat-n accent">19</div><div class="world-stat-label">From videos</div></div>
      </div>
      <div class="world-list">
        <div class="world-list-head">${esc(head)} — ${esc(st.country)}</div>
        ${rows.map(c => `
        <button class="country-row" data-country="${esc(c.name)}" style="background:${c.bg}">
          <span style="flex:1;min-width:0"><span class="country-name">${esc(c.name)}</span><span class="country-meta">${esc(c.meta)} · ${esc(c.sub)}</span></span>
          <span class="country-tag" style="background:${c.tagBg};color:${c.tagFg}">${esc(c.tag)}</span>
        </button>`).join('')}
        <div class="world-open">
          <button class="btn btn-secondary btn-block" data-act="set-city">Open the ${esc(st.country)} city plan →</button>
        </div>
      </div>
    </div>`;
  }

  function getCityPins(st) {
    return CITY_PIN_DEFS.map(([id, name, x, y, size, bg, fg, badge]) => {
      const col = st.pinColors[id] || bg;
      const light = col === '#f3f2f2' || col === '#ff9793' || col === '#e8a98d';
      return { id, name, x, y, size, badge, bg: col, fg: light ? '#201e1d' : '#f3f2f2' };
    });
  }

  function renderCity(st) {
    const pins = getCityPins(st);
    const sel = PLACES[st.place];
    const addLabel = st.added[st.place] ? '✓ IN DAY ' + st.day : '+ ADD TO DAY ' + st.day;
    const filters = ['ALL', 'FOOD', 'FROM VIDEOS', 'FRIENDS'];
    const pinSwatches = swatchesFor(st.pinColors[st.place] || '');
    return `
    <div class="city-map">
      <div class="city-block" style="left:-40px;top:400px;width:480px;height:200px;border-top:2px solid var(--mapLine)"></div>
      <div class="city-block" style="left:36px;top:120px;width:120px;height:96px;border:1px solid var(--mapLine)"></div>
      <div class="city-road" style="left:0;top:300px;width:390px;height:8px"></div>
      <div class="city-road" style="left:212px;top:30px;width:8px;height:400px"></div>
      <div class="city-label" style="left:42px;top:124px">Yoyogi park</div>
      <div class="city-label" style="left:8px;top:530px">Tokyo bay</div>
      <div class="city-filters">
        ${filters.map(f => `<button data-filter="${f}" style="background:${st.filter === f ? '#201e1d' : 'transparent'};color:${st.filter === f ? '#f3f2f2' : '#201e1d'}">${f}</button>`).join('')}
      </div>
      ${pins.map(p => `
      <button class="pin" data-place="${p.id}" style="left:${p.x}px;top:${p.y}px">
        <span class="pin-badge" style="width:${p.size}px;height:${p.size}px;background:${p.bg};color:${p.fg}">${p.badge}</span>
        <span class="pin-chip">${esc(p.name)}</span>
      </button>`).join('')}
      <div class="map-card">
        <div class="map-card-photo placeholder"></div>
        <div class="map-card-body">
          <div class="kicker-accent">${esc(sel.kicker)}</div>
          <div class="map-card-name">${esc(sel.name)}</div>
          <div class="map-card-meta">${esc(sel.meta)}</div>
          <div class="map-card-pins">
            <span class="map-card-pin-label">Pin</span>
            ${pinSwatches.map(sw => `<button class="swatch" data-pin-color="${sw.color}" style="width:20px;height:20px;background:${sw.color};border-color:${sw.border};color:${sw.tickFg}">${sw.tick}</button>`).join('')}
          </div>
          <div class="map-card-actions">
            <button class="btn btn-primary" data-act="go-place">OPEN</button>
            <button class="btn btn-secondary" data-act="add-to-day">${esc(addLabel)}</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderMap(st, t) {
    return `
    <div class="map-screen">
      <div class="map-toolbar">
        <div class="map-level">
          <button data-level="world" style="background:${st.level === 'world' ? '#201e1d' : 'transparent'};color:${st.level === 'world' ? '#f3f2f2' : '#201e1d'}">WORLD</button>
          <button data-level="city" style="background:${st.level === 'city' ? '#201e1d' : 'transparent'};color:${st.level === 'city' ? '#f3f2f2' : '#201e1d'}">TOKYO</button>
        </div>
        <button class="map-search" data-act="go-search"><span class="map-search-dot"></span>Search</button>
        <button class="map-add" data-act="go-import">+</button>
      </div>
      ${st.level === 'world' ? renderWorld(st, t) : renderCity(st)}
    </div>`;
  }

  function renderPlace(st) {
    const sel = PLACES[st.place];
    const addLabel = st.added[st.place] ? '✓ IN DAY ' + st.day : '+ ADD TO DAY ' + st.day;
    return `
    <div class="screen-body">
      <div class="place-hero placeholder">
        <button class="place-back" data-act="go-map">← MAP</button>
        <span class="placeholder-label">placeholder — b&amp;w photo, ${esc(sel.name)}</span>
      </div>
      <div class="place-body">
        <div class="kicker-accent">${esc(sel.kicker)}</div>
        <h2 class="place-title">${esc(sel.name)}</h2>
        <p class="place-blurb">${esc(sel.blurb)}</p>
        <div class="place-facts">
          <div class="place-fact"><div class="place-fact-label">Best time</div><div class="place-fact-value">${esc(sel.best)}</div></div>
          <div class="place-fact"><div class="place-fact-label">Queue</div><div class="place-fact-value">${esc(sel.queue)}</div></div>
          <div class="place-fact"><div class="place-fact-label">From hotel</div><div class="place-fact-value">${esc(sel.travel)}</div></div>
          <div class="place-fact"><div class="place-fact-label">Saved by</div><div class="place-fact-value">${esc(sel.savedBy)}</div></div>
        </div>
        <div class="place-source">
          <div class="place-source-head">Found in</div>
          <div class="place-source-row">
            <span class="place-source-play">▶</span>
            <div style="flex:1;min-width:0"><div class="place-source-name">${esc(sel.source)}</div><div class="place-source-stamp">timestamp ${esc(sel.stamp)}</div></div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="add-to-day">${esc(addLabel)}</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" data-act="go-itinerary">See the day →</button>
      </div>
    </div>`;
  }

  function renderItinerary(st) {
    const d = computeDay(st);
    const savedCount = 67;
    return `
    <div class="screen-body">
      <div class="header-band">
        <div class="kicker">Japan · 8 days · Tokyo → Hakone → Kyoto</div>
        <h2 class="h-screen" style="margin:4px 0 12px">ITINERARY</h2>
        <div class="day-tabs">
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button data-day="${n}" style="background:${st.day === n ? '#201e1d' : 'transparent'};color:${st.day === n ? '#f3f2f2' : '#201e1d'}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="day-heading">
        <div class="day-title">${esc(d.dayTitle)}</div>
        <div class="day-meta">${esc(d.dayMeta)}</div>
      </div>
      <div class="route-card">
        <div class="route-stats">
          <div class="route-stat"><div class="route-stat-n">${d.routeTotal}</div><div class="route-stat-label">Route today</div></div>
          <div class="route-stat"><div class="route-stat-n">${d.routeTime}</div><div class="route-stat-label">Door to door</div></div>
          <div class="route-stat"><div class="route-stat-n">${d.routeStops}</div><div class="route-stat-label">In order</div></div>
        </div>
        <div class="route-hint-row">
          <span class="route-hint">${esc(d.routeHint)}</span>
          ${d.routeCanOpt ? `<button class="route-btn" data-act="toggle-route" style="background:${d.optimised ? 'transparent' : 'var(--acc)'};color:${d.optimised ? '#201e1d' : '#f3f2f2'}">${esc(d.routeBtnLabel)}${!st.isPremium ? '<span class="pro-tag">PRO</span>' : ''}</button>` : ''}
        </div>
      </div>
      ${d.dayItems.map(it => `
      <div class="day-item">
        <div class="day-item-time">${esc(it.time)}</div>
        <div class="day-item-body" style="border-left-color:${it.rule}">
          ${it.leg ? `<div class="day-item-leg"><span class="day-item-leg-rule"></span><span class="day-item-leg-mode">${esc(it.legMode)}</span><span class="day-item-leg-text">${esc(it.legText)} from the last stop</span></div>` : ''}
          <div class="day-item-row">
            <div style="flex:1;min-width:0">
              <div class="day-item-name">${esc(it.name)}</div>
              <div class="day-item-note">${esc(it.note)}</div>
            </div>
            <button class="day-item-color-btn" title="Choose a colour" data-edit-color="${it.key}" style="background:${it.rule}"></button>
          </div>
          ${it.picking ? `
          <div class="day-item-swatches">
            ${swatchesFor(it.rule).map(sw => `<button class="swatch" data-item-color="${it.key}|${sw.color}" style="width:24px;height:24px;background:${sw.color};border-color:${sw.border};color:${sw.tickFg}">${sw.tick}</button>`).join('')}
            <span class="day-item-color-name">${esc(it.colorName)}</span>
          </div>` : ''}
          ${it.flag ? `<div class="day-item-flag">${esc(it.flagText)}</div>` : ''}
        </div>
      </div>`).join('')}
      <div class="itinerary-footer">
        <button class="btn btn-dashed btn-block" data-act="go-saved">+ Add from your saved places (${savedCount})</button>
      </div>
    </div>`;
  }

  function importDerived(st) {
    const p = st.parsePct;
    const logStage = p < 30 ? 'Reading captions' : p < 60 ? 'Matching signs in frames' : p < 90 ? 'Cross-checking with maps' : 'Almost there';
    const parseLog = [
      { text: 'Caption parsed — 3 names', stamp: '0:02', dot: 'var(--acc)', fg: '#201e1d' },
      { text: p > 35 ? 'Sign matched: FUGLEN' : 'Scanning frames…', stamp: '0:25', dot: p > 35 ? 'var(--acc)' : 'rgba(32,30,29,.25)', fg: p > 35 ? '#201e1d' : 'rgba(32,30,29,.45)' },
      { text: p > 70 ? 'Geotag resolved: Nakameguro' : 'Waiting on geotag…', stamp: '0:41', dot: p > 70 ? 'var(--acc)' : 'rgba(32,30,29,.25)', fg: p > 70 ? '#201e1d' : 'rgba(32,30,29,.45)' }
    ];
    return { logStage, parseLog };
  }

  function getFound(st) {
    return FOUND_DEFS.map(([id, name, meta, stamp]) => {
      const on = !!st.keep[id];
      return { id, name, meta, stamp, on, bg: on ? 'var(--accTint)' : 'transparent', box: on ? 'var(--acc)' : 'transparent', check: on ? '✓' : '' };
    });
  }

  function renderImport(st) {
    const importTitle = st.importStep === 'paste' ? 'FIND THE PLACES' : st.importStep === 'parsing' ? 'READING VIDEO' : st.importStep === 'results' ? 'WE FOUND THESE' : 'SAVED';
    let body = '';
    if (st.importStep === 'paste') {
      body = `
      <div style="padding:18px">
        <div class="import-drop">
          <div class="import-drop-head">Share sheet target</div>
          <div class="import-drop-title">Paste a Reel or TikTok link and we'll read every place in it.</div>
          <div class="import-url-row">
            <div class="import-url">instagram.com/reel/C8xk2…/</div>
            <button class="import-read-btn" data-act="start-parse">READ IT</button>
          </div>
        </div>
        <div class="import-recents-head">Recently shared to us</div>
        ${RECENTS.map(r => `
        <button class="import-recent-row" data-recent="1">
          <span class="placeholder import-recent-thumb"></span>
          <span style="flex:1;min-width:0"><span class="import-recent-title">${esc(r.title)}</span><span class="import-recent-meta">${esc(r.meta)}</span></span>
          <span class="import-recent-arrow">→</span>
        </button>`).join('')}
      </div>`;
    } else if (st.importStep === 'parsing') {
      const { logStage, parseLog } = importDerived(st);
      body = `
      <div class="import-parsing">
        <div class="placeholder-dark import-parsing-video"><span class="placeholder-label-light">scanning frames + captions</span></div>
        <div class="import-progress-track"><div class="import-progress-fill" style="width:${st.parsePct}%"></div></div>
        <div class="import-progress-row"><span>${esc(logStage)}</span><span class="import-progress-pct">${st.parsePct}%</span></div>
        <div class="import-log">
          ${parseLog.map(l => `<div class="import-log-row"><span class="import-log-dot" style="background:${l.dot}"></span><span class="import-log-text" style="color:${l.fg}">${esc(l.text)}</span><span class="import-log-stamp">${esc(l.stamp)}</span></div>`).join('')}
        </div>
      </div>`;
    } else if (st.importStep === 'results') {
      const found = getFound(st);
      const keepCount = Object.values(st.keep).filter(Boolean).length;
      body = `
      <div style="flex:1;overflow:auto">
        <div class="import-results-banner">4 places pulled out of the video. Keep what you want.</div>
        ${found.map(f => `
        <button class="found-row" data-toggle-found="${f.id}" style="background:${f.bg}">
          <span class="found-check" style="background:${f.box}">${f.check}</span>
          <span style="flex:1;min-width:0"><span class="found-name">${esc(f.name)}</span><span class="found-meta">${esc(f.meta)}</span></span>
          <span class="found-stamp">${esc(f.stamp)}</span>
        </button>`).join('')}
        <div class="import-results-actions">
          <button class="btn btn-primary btn-block" data-act="save-found">Save ${keepCount} to the Japan map</button>
          <button class="btn btn-secondary btn-block" style="margin-top:8px" data-act="go-map">Not now</button>
        </div>
      </div>`;
    } else if (st.importStep === 'done') {
      const keepCount = Object.values(st.keep).filter(Boolean).length;
      body = `
      <div class="import-done">
        <div class="import-done-check">✓</div>
        <h3>On the map.</h3>
        <p>${keepCount} places added to Tokyo. Two of them sit on the same line — want them on the same afternoon?</p>
        <button class="btn btn-primary btn-block" data-act="go-itinerary">Slot into Day 2</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" data-act="go-map">Back to the map</button>
      </div>`;
    }
    return `
    <div class="import-screen">
      <div class="import-header">
        <h2>${esc(importTitle)}</h2>
        <button class="btn-small" data-act="go-map">CLOSE</button>
      </div>
      ${body}
    </div>`;
  }

  function renderFriend(st, t) {
    return `
    <div class="screen-body">
      <div class="friend-header">
        <span class="friend-avatar">MK</span>
        <div style="flex:1">
          <h3 class="friend-name">Mika Kondo</h3>
          <div class="friend-meta">14 countries · 3 trips shared with you</div>
          <button class="follow-btn" data-act="toggle-follow" style="background:${st.following ? '#201e1d' : 'transparent'};color:${st.following ? '#f3f2f2' : '#201e1d'}">${st.following ? 'FOLLOWING' : 'FOLLOW'}</button>
        </div>
      </div>
      <div class="trail-head">Where she has been</div>
      <div class="friend-map-mount"><world-map ground="${t.mapGround}" ink="${t.mapInkHex}" accent="${t.accHex}" visited="Japan, Vietnam, Thailand, Portugal, Peru, Georgia"></world-map></div>
      ${TRAIL.map(tr => `
      <div class="trail-item">
        <span class="placeholder trail-thumb"></span>
        <span style="flex:1;min-width:0"><span class="trail-name">${esc(tr.name)}</span><span class="trail-meta">${esc(tr.meta)}</span></span>
        <button class="btn-small" data-trail-save="1">SAVE</button>
      </div>`).join('')}
      <div class="friend-footnote">You only see trips Mika opted to share. Yours stay private until you flip a trip on.</div>
    </div>`;
  }

  function renderAlert(st) {
    const status = st.alert === 'accepted' ? '✓ Plan updated. Day 4 rebuilt.' : st.alert === 'rejected' ? 'Kept as is. We will stop nagging.' : 'Nothing applied yet.';
    const fg = st.alert === 'accepted' ? 'var(--accInk)' : 'rgba(32,30,29,.55)';
    return `
    <div class="screen-body">
      <div class="alert-hero">
        <div class="alert-hero-kicker">From your Google inbox · 2 min ago</div>
        <h3>NH106 moved<br>4h 25m earlier.</h3>
        <p>Nothing changed in your plan yet. Here's what we'd do.</p>
      </div>
      ${CHANGES.map(c => `
      <div class="alert-change">
        <div class="alert-change-day">${esc(c.day)}</div>
        <div class="alert-change-times"><span class="alert-change-from">${esc(c.from)}</span><span class="alert-change-to">→ ${esc(c.to)}</span></div>
        <div class="alert-change-name">${esc(c.name)}</div>
        <div class="alert-change-why">${esc(c.why)}</div>
      </div>`).join('')}
      <div class="alert-actions">
        <div class="alert-status" style="color:${fg}">${esc(status)}</div>
        <button class="btn btn-primary btn-block" data-act="accept-all">Accept all 3 changes</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" data-act="reject-all">Keep my plan as is</button>
        <p class="alert-fine">The ryokan in Hakone was told about the later check-in. Nothing was cancelled.</p>
      </div>
    </div>`;
  }

  function renderSearch(st) {
    return `
    <div class="screen-body">
      <div class="search-header">
        <div class="search-input">${esc(st.searchQuery)}</div>
        <button class="btn-small" data-act="go-map">CANCEL</button>
      </div>
      ${RESULTS_DEFS.map(([name, meta, src, dot, placeId]) => `
      <button class="search-row" data-search-place="${placeId}">
        <span class="search-dot" style="background:${dot}"></span>
        <span style="flex:1;min-width:0"><span class="search-name">${esc(name)}</span><span class="search-meta">${esc(meta)}</span></span>
        <span class="search-src">${esc(src)}</span>
      </button>`).join('')}
    </div>`;
  }

  function renderSaved() {
    return `
    <div class="screen-body">
      <div class="header-band">
        <h2 class="h-screen">SAVED</h2>
        <div class="saved-count">67 places · 4 lists</div>
      </div>
      ${LISTS_DEFS.map(([n, name, meta, bg, fg, dest]) => `
      <button class="saved-row" data-saved-dest="${dest}">
        <span class="saved-icon" style="background:${bg};color:${fg}">${n}</span>
        <span style="flex:1"><span class="saved-name">${esc(name)}</span><span class="saved-meta">${esc(meta)}</span></span>
        <span class="saved-arrow">→</span>
      </button>`).join('')}
    </div>`;
  }

  function renderSettings(st) {
    const active = PLANS[st.activePlan] || PLANS.annual;
    const premiumCard = st.isPremium ? `
      <div class="premium-card premium-card-on">
        <div class="premium-card-body"><div class="premium-card-title">★ PREMIUM</div><div class="premium-card-desc">${active.price}${active.period} · unlimited imports, best route, offline maps</div></div>
        <button class="btn-small btn-small-inverse" data-act="cancel-premium">CANCEL</button>
      </div>` : `
      <div class="premium-card">
        <div class="premium-card-body"><div class="premium-card-title">Go Premium</div><div class="premium-card-desc">${PLANS.monthly.price}${PLANS.monthly.period} or ${PLANS.annual.price}${PLANS.annual.period} · unlimited imports, best route, offline maps</div></div>
        <button class="btn btn-primary" style="padding:9px 12px;font-size:12px" data-act="go-premium-card">UPGRADE</button>
      </div>`;
    return `
    <div class="screen-body">
      <div class="header-band"><h2 class="h-screen">YOU</h2></div>
      ${premiumCard}
      <div class="settings-user">
        <span class="settings-user-icon">AY</span>
        <div style="flex:1"><div class="settings-user-name">Ayelet</div><div class="settings-user-meta">google · synced 2 min ago</div></div>
      </div>
      ${TOGGLE_DEFS.map(t => {
        const on = !!st.toggles[t.k];
        const locked = t.k === 'offline' && !st.isPremium;
        return `
        <div class="settings-toggle-row">
          <div style="flex:1"><div class="settings-toggle-name">${esc(t.name)}${locked ? '<span class="pro-tag">PRO</span>' : ''}</div><div class="settings-toggle-desc">${esc(t.desc)}</div></div>
          <button class="toggle" data-toggle-key="${t.k}" style="background:${on ? 'var(--acc)' : 'transparent'};justify-content:${on ? 'flex-end' : 'flex-start'}">
            <span class="toggle-knob" style="background:${on ? '#f3f2f2' : '#201e1d'}"></span>
          </button>
        </div>`;
      }).join('')}
      <div class="settings-footer">
        <button class="btn btn-secondary btn-block" data-act="restart">Replay onboarding</button>
      </div>
    </div>`;
  }

  function renderPaywall(st) {
    const chosen = PLANS[st.premiumPlan] || PLANS.annual;
    return `
    <div class="import-screen">
      <div class="import-header">
        <h2>PREMIUM</h2>
        <button class="btn-small" data-act="decline-paywall">CLOSE</button>
      </div>
      <div class="paywall-body">
        <div class="kicker-accent">See the world · Premium</div>
        <h1 class="paywall-title">See more of the world.</h1>
        <p class="paywall-sub">That feature is part of Premium. Here's everything it unlocks.</p>
        <div class="paywall-features">
          ${PREMIUM_FEATURES.map(f => `<div class="paywall-feature"><span class="paywall-feature-mark">✓</span><span>${esc(f)}</span></div>`).join('')}
        </div>
        <div class="plan-options">
          ${Object.values(PLANS).map(p => `
          <button class="plan-option${st.premiumPlan === p.id ? ' plan-option-on' : ''}" data-plan="${p.id}">
            ${p.badge ? `<span class="plan-badge">${esc(p.badge)}</span>` : ''}
            <span class="plan-option-label">${esc(p.label)}</span>
            <span class="plan-option-price">${p.price}<span class="plan-option-period">${p.period}</span></span>
          </button>`).join('')}
        </div>
        <button class="btn btn-primary btn-block" data-act="subscribe">Subscribe — ${chosen.price}${chosen.period}</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" data-act="decline-paywall">Not now</button>
        <p class="onboard-fine">Cancel anytime from Settings. This is a demo — no card is charged.</p>
      </div>
    </div>`;
  }

  function renderTabbar(S) {
    const tabDefs = [['feed', 'FEED'], ['map', 'MAP'], ['itinerary', 'PLAN'], ['friend', 'FRIENDS'], ['settings', 'YOU']];
    return `
    <div class="tabbar">
      ${tabDefs.map(([id, label]) => {
        const on = S === id || (id === 'map' && (S === 'place' || S === 'search')) || (id === 'feed' && S === 'alert') || (id === 'itinerary' && S === 'saved');
        return `
        <button data-tab="${id}">
          <span class="tab-dot" style="background:${on ? 'var(--acc)' : 'transparent'};border:2px solid ${on ? '#201e1d' : 'rgba(32,30,29,.45)'}"></span>
          <span class="tab-label" style="color:${on ? '#201e1d' : 'rgba(32,30,29,.5)'}">${label}</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function renderScreen(st, t) {
    let content;
    switch (st.screen) {
      case 'onboard': content = renderOnboard(); break;
      case 'feed': content = renderFeed(); break;
      case 'map': content = renderMap(st, t); break;
      case 'place': content = renderPlace(st); break;
      case 'itinerary': content = renderItinerary(st); break;
      case 'import': content = renderImport(st); break;
      case 'friend': content = renderFriend(st, t); break;
      case 'alert': content = renderAlert(st); break;
      case 'search': content = renderSearch(st); break;
      case 'saved': content = renderSaved(); break;
      case 'settings': content = renderSettings(st); break;
      case 'paywall': content = renderPaywall(st); break;
      default: content = '';
    }
    return content + renderTabbar(st.screen);
  }

  function render() {
    const t = applyTokens();
    const app = document.getElementById('app');
    app.innerHTML = `<div class="frame"><div class="screen">${renderScreen(state, t)}</div></div>`;
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  function handleAct(act) {
    switch (act) {
      case 'connect': setState({ screen: 'feed' }); break;
      case 'go-import':
        if (!state.isPremium && state.freeImportUsed) setState(s => ({ paywallFrom: s.screen, screen: 'paywall' }));
        else setState({ screen: 'import', importStep: 'paste' });
        break;
      case 'go-map': setState({ screen: 'map' }); break;
      case 'go-place': setState({ screen: 'place' }); break;
      case 'go-itinerary': setState({ screen: 'itinerary' }); break;
      case 'go-search': setState({ screen: 'search' }); break;
      case 'go-saved': setState({ screen: 'saved' }); break;
      case 'go-friend': setState({ screen: 'friend' }); break;
      case 'go-alert': setState({ screen: 'alert' }); break;
      case 'set-city': setState({ level: 'city' }); break;
      case 'add-to-day': setState(s => ({ added: Object.assign({}, s.added, { [s.place]: true }) })); break;
      case 'toggle-route':
        if (!state.isPremium) setState(s => ({ paywallFrom: 'itinerary', screen: 'paywall' }));
        else setState(s => ({ routeOpt: Object.assign({}, s.routeOpt, { [s.day]: !s.routeOpt[s.day] }) }));
        break;
      case 'start-parse': startParse(); break;
      case 'save-found': setState({ importStep: 'done', freeImportUsed: true }); break;
      case 'toggle-follow': setState(s => ({ following: !s.following })); break;
      case 'accept-all': setState({ alert: 'accepted', screen: 'itinerary', day: 4 }); break;
      case 'reject-all': setState({ alert: 'rejected' }); break;
      case 'restart': setState({ screen: 'onboard' }); break;
      case 'go-premium-card': setState({ paywallFrom: 'settings', screen: 'paywall' }); break;
      case 'subscribe': setState(s => ({ isPremium: true, activePlan: s.premiumPlan, screen: s.paywallFrom || 'settings' })); break;
      case 'decline-paywall': setState(s => ({ screen: s.paywallFrom || 'settings' })); break;
      case 'cancel-premium': setState({ isPremium: false }); break;
    }
  }

  function onAppClick(e) {
    const el = e.target.closest(
      '[data-act],[data-tab],[data-level],[data-filter],[data-country],[data-set-city],' +
      '[data-place],[data-pin-color],[data-day],[data-edit-color],[data-item-color],' +
      '[data-toggle-found],[data-trail-save],[data-search-place],[data-saved-dest],' +
      '[data-toggle-key],[data-recent],[data-plan]'
    );
    if (!el) return;
    if (el.dataset.act) return handleAct(el.dataset.act);
    if (el.dataset.tab) return setState({ screen: el.dataset.tab });
    if (el.dataset.level) return setState({ level: el.dataset.level });
    if (el.dataset.filter) return setState({ filter: el.dataset.filter });
    if (el.dataset.country) return setState({ country: el.dataset.country });
    if (el.dataset.place) return setState({ place: el.dataset.place });
    if (el.dataset.pinColor) return setState(s => ({ pinColors: Object.assign({}, s.pinColors, { [s.place]: el.dataset.pinColor }) }));
    if (el.dataset.day) return setState({ day: Number(el.dataset.day) });
    if (el.dataset.editColor) { const key = el.dataset.editColor; return setState(s => ({ picking: s.picking === key ? null : key })); }
    if (el.dataset.itemColor) {
      const [key, color] = el.dataset.itemColor.split('|');
      return setState(s => ({ itemColors: Object.assign({}, s.itemColors, { [key]: color }), picking: null }));
    }
    if (el.dataset.toggleFound) { const id = el.dataset.toggleFound; return setState(s => ({ keep: Object.assign({}, s.keep, { [id]: !s.keep[id] }) })); }
    if (el.dataset.trailSave !== undefined) return setState({ screen: 'saved' });
    if (el.dataset.searchPlace) return setState({ screen: 'place', place: el.dataset.searchPlace });
    if (el.dataset.savedDest) return setState({ screen: el.dataset.savedDest });
    if (el.dataset.toggleKey) {
      const k = el.dataset.toggleKey;
      if (k === 'offline' && !state.toggles.offline && !state.isPremium) return setState({ paywallFrom: 'settings', screen: 'paywall' });
      return setState(s => ({ toggles: Object.assign({}, s.toggles, { [k]: !s.toggles[k] }) }));
    }
    if (el.dataset.recent !== undefined) return startParse();
    if (el.dataset.plan) return setState({ premiumPlan: el.dataset.plan });
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    document.getElementById('app').addEventListener('click', onAppClick);
    document.addEventListener('country-pick', e => setState({ country: e.detail, level: 'world' }));
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
