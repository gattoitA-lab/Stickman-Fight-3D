/* Stickman Fight 3D — interfaccia, profilo, negozio, modalità. */
(function () {
  'use strict';
  const G = window.GH, WP = G.WEAPONS;
  const PKEY = 'gh-stickman-profile-v1';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const NAME_A = ['Fulmine', 'Falco', 'Lupo', 'Tigre', 'Vipera', 'Spettro', 'Ninja', 'Cometa', 'Turbine', 'Lama', 'Ombra', 'Drago'];
  const NAME_B = ['Neon', 'Turbo', 'Oscuro', 'Veloce', 'Furioso', 'Silenzioso', 'Elettrico', 'Dorato'];
  function randomName() {
    const n = pick(NAME_A) + ' ' + pick(NAME_B);
    return Math.random() < .35 ? n + ' ' + (10 + Math.floor(Math.random() * 90)) : n;
  }

  const DEF = {
    name: randomName(), coins: 0, xp: 0, best: 0,
    heads: ['none'], head: 'none', bg: '', bgs: [],
    skin: null, variants: [], bossTier: 0, bestWave: 0,
    lastDaily: '', streak: 0, sound: true, music: true, sfx: true,
    adDay: '', adCount: 0,
    skyWeapons: false, controls: null
  };
  const DEFAULT_CTRL = {
    p1: { l: 'KeyA', r: 'KeyD', j: 'KeyW', d: 'KeyS', a: 'KeyF', abi: 'KeyE', sw: 'KeyR' },
    p2: { l: 'ArrowLeft', r: 'ArrowRight', j: 'ArrowUp', d: 'ArrowDown', a: 'KeyL', abi: 'KeyK', sw: 'KeyJ' }
  };
  let P = loadProfile();
  let netSession = null, netSlot = null, netTimers = [];
  let setup = null;
  let lastConfig = null;
  let pageBack = null;
  let adsTimer = null;

  function loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(PKEY) || '{}');
      const p = Object.assign({}, DEF, raw);
      let dirty = false;
      // il nome non è mai un valore copiato: se manca o è il vecchio default, ne generiamo uno
      if (!raw.name || raw.name === 'GattoHub') { p.name = randomName(); dirty = true; }
      // profili vecchi: il vecchio interruttore AUDIO valeva per musica ed effetti
      if (raw.music == null) { p.music = raw.sound !== false; dirty = true; }
      if (raw.sfx == null) { p.sfx = raw.sound !== false; dirty = true; }
      p.sound = p.music || p.sfx;
      p.controls = Object.assign({}, DEFAULT_CTRL, p.controls || {});
      p.controls.p1 = Object.assign({}, DEFAULT_CTRL.p1, p.controls.p1 || {});
      p.controls.p2 = Object.assign({}, DEFAULT_CTRL.p2, p.controls.p2 || {});
      if (dirty) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
      return p;
    } catch (e) { return Object.assign({}, DEF); }
  }
  function saveProfile() {
    try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {}
  }
  function lvl() { return G.level(P.xp); }

  /* ---------------- HUD / schermate ---------------- */
  function renderHUD() {
    const coins = $('#coinsVal'), lv = $('#lvlVal'), best = $('#bestVal'), fill = $('#xpFill'), nm = $('#profileName');
    if (coins) coins.textContent = P.coins;
    if (lv) lv.textContent = lvl();
    if (best) best.textContent = P.best || 0;
    if (fill) fill.style.width = (G.xpInLevel(P.xp) / G.XP_PER_LEVEL * 100) + '%';
    if (nm) nm.textContent = P.name;
    const pc = $('#pageCoins'); if (pc) pc.textContent = P.coins;
    const sc = $('#setupCoins'); if (sc) sc.textContent = P.coins;
  }

  function show(name) {
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
    document.body.classList.toggle('gaming', name === 'game');
  }

  function stopNet() {
    netTimers.forEach(t => clearInterval(t));
    netTimers = [];
    if (netSession) { try { netSession.close(); } catch (e) {} }
    netSession = null; netSlot = null;
  }

  function home() {
    stopNet();
    if (G.engine) G.engine.quit();
    if (G.audio) { G.audio.duck(false); G.audio.music('menu'); }
    $('#endOverlay').classList.remove('on');
    $('#pauseOverlay').classList.remove('on');
    renderHUD();
    show('home');
  }

  function page(title, render, back) {
    $('#pageTitle').textContent = title;
    const body = $('#pageBody');
    body.innerHTML = '';
    pageBack = back || home;
    renderHUD();
    show('page');
    render(body);
    $('#scr-page').scrollTop = 0;
  }

  function toast(msg) {
    const t = el('div', 'pill', msg);
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80;background:#17345c;border-color:#4a7ab8;padding:10px 18px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.45)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  /* ---------------- negozio ---------------- */
  const HEAD_ICO = { none: '🚫', cap: '🧢', crown: '👑', tophat: '🎩', helm: '⛑️', skull: '💀', ninja: '🥷', halo: '😇', viking: '🪖' };

  function pageShop() {
    let tab = 'heads';
    page('NEGOZIO', body => {
      const tabs = el('div', 'row');
      const t1 = el('button', 'btn sm gold', 'CAPPELLI');
      const t2 = el('button', 'btn sm dark', 'SFONDI');
      tabs.appendChild(t1); tabs.appendChild(t2);
      const grid = el('div', 'grid4');
      grid.style.marginTop = '10px';
      body.appendChild(tabs); body.appendChild(grid);
      const hint = el('p', 'hint', 'Le monete si guadagnano vincendo duelli, ondate e minigiochi, oppure con i regali giornalieri.');
      body.appendChild(hint);

      function draw() {
        t1.className = 'btn sm ' + (tab === 'heads' ? 'gold' : 'dark');
        t2.className = 'btn sm ' + (tab === 'bgs' ? 'gold' : 'dark');
        grid.innerHTML = '';
        if (tab === 'heads') {
          Object.keys(G.HEADS).forEach(id => {
            const h = G.HEADS[id];
            const owned = P.heads.includes(id);
            const eq = P.head === id;
            const b = el('button', 'shopItem' + (eq ? ' equipped' : '') + (owned ? ' owned' : ''));
            b.innerHTML = '<div style="font-size:32px;line-height:1">' + (HEAD_ICO[id] || '🎩') + '</div><div>' + h.n + '</div>' +
              '<div class="pr">' + (owned ? (eq ? 'IN USO' : 'TOCCA PER USARE') : '★ ' + h.price) + '</div>';
            if (!owned) {
              const pr = el('div', 'pr', '★ ' + h.price);
              b.querySelector('.pr').replaceWith(pr);
            }
            b.onclick = () => {
              if (!owned) {
                if (P.coins < h.price) { G.audio.sfx('error'); toast('Servono ' + h.price + ' monete'); return; }
                P.coins -= h.price; P.heads.push(id); P.head = id;
                G.audio.sfx('buy');
                toast('Sbloccato: ' + h.n);
              } else {
                P.head = id;
              }
              saveProfile(); renderHUD(); draw();
            };
            grid.appendChild(b);
          });
        } else {
          G.BGS.forEach(bg => {
            const owned = bg.price === 0 || P.bgs.includes(bg.id);
            const eq = P.bg === bg.id;
            const b = el('button', 'shopItem' + (eq ? ' equipped' : '') + (owned ? ' owned' : ''));
            b.innerHTML = '<canvas width="90" height="54"></canvas><div>' + bg.n + '</div><div class="pr">' +
              (owned ? (eq ? 'IN USO' : 'TOCCA PER USARE') : '★ ' + bg.price) + '</div>';
            const c = b.querySelector('canvas'), ctx = c.getContext('2d');
            const gr = ctx.createLinearGradient(0, 0, 0, 54);
            gr.addColorStop(0, bg.sky[0]); gr.addColorStop(1, bg.sky[1]);
            ctx.fillStyle = gr; ctx.fillRect(0, 0, 90, 54);
            ctx.fillStyle = bg.far; ctx.fillRect(6, 26, 22, 28); ctx.fillRect(34, 34, 20, 20); ctx.fillRect(62, 22, 22, 32);
            ctx.fillStyle = bg.ground; ctx.fillRect(0, 46, 90, 8);
            b.onclick = () => {
              if (!owned) {
                if (P.coins < bg.price) { G.audio.sfx('error'); toast('Servono ' + bg.price + ' monete'); return; }
                P.coins -= bg.price; P.bgs.push(bg.id);
                G.audio.sfx('buy');
                toast('Sbloccato: ' + bg.n);
              }
              P.bg = eq ? '' : bg.id;
              saveProfile(); renderHUD(); draw();
            };
            grid.appendChild(b);
          });
        }
      }
      t1.onclick = () => { tab = 'heads'; draw(); };
      t2.onclick = () => { tab = 'bgs'; draw(); };
      draw();
    });
  }

  /* ---------------- regali / ads ---------------- */
  function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  function pageDaily() {
    page('REGALI GIORNALIERI', body => {
      const amount = 50 + Math.min(P.streak, 5) * 10;
      const claimed = P.lastDaily === today();
      const card = el('div', 'card');
      card.innerHTML = '<h3>BONUS DI OGGI</h3>' +
        '<div class="big" style="font:400 38px/1 Bungee, Impact, sans-serif;color:#ffd24a;-webkit-text-stroke:3px #06142a;text-shadow:0 4px 0 #06142a">+' + amount + ' ★</div>' +
        '<p class="hint" style="margin-top:8px">Serie di giorni: ' + P.streak + '. Torna ogni giorno per aumentare il bonus (massimo 100 monete).</p>';
      const btn = el('button', 'btn gold', claimed ? 'GIÀ RITIRATO OGGI' : 'RITIRA');
      btn.disabled = claimed;
      if (claimed) btn.style.opacity = '.55';
      btn.onclick = () => {
        if (P.lastDaily === today()) return;
        P.coins += amount;
        P.streak = (P.lastDaily === yesterday()) ? P.streak + 1 : 1;
        P.lastDaily = today();
        saveProfile(); renderHUD(); G.audio.sfx('coin'); toast('+' + amount + ' monete!');
        pageDaily();
      };
      card.appendChild(btn);
      body.appendChild(card);
      const note = el('p', 'hint', 'Il bonus si azzera se salti un giorno. Le monete sono salvate su questo dispositivo.');
      body.appendChild(note);
    });
  }

  function yesterday() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ---------------- ADS: video premio localizzati ---------------- */
  const ADS_PER_DAY = 4;
  const AD_CATALOG = {
    IT: [{ n: 'CAFFÈ MOKA MAX', t: 'Sveglia il quartiere, non la nonna.', c1: '#8a3b1e', c2: '#ff8a3d', ico: '☕' },
         { n: 'PIZZA TURBO', t: 'Consegna in otto minuti o è gratis.', c1: '#a32020', c2: '#ffd24a', ico: '🍕' },
         { n: 'GELATO NONNO', t: 'Tre gusti, zero rimpianti.', c1: '#2a6fb0', c2: '#9fe6ff', ico: '🍨' },
         { n: 'SCOOTER VOLA', t: 'Parcheggi dove gli altri non arrivano.', c1: '#4a2a8a', c2: '#c58cff', ico: '🛵' }],
    ES: [{ n: 'TAPAS EXPRESS', t: 'Cena in piedi, felicità lunga.', c1: '#a34b12', c2: '#ffc24a', ico: '🥘' },
         { n: 'SOL Y SIESTA', t: 'Il materasso che sa di vacanza.', c1: '#0f6b8a', c2: '#7ee6ff', ico: '🛏️' },
         { n: 'FÚTBOL 24H', t: 'Novantacinque minuti di emozioni.', c1: '#1d6b34', c2: '#8be36b', ico: '⚽' },
         { n: 'CHURRO LOCO', t: 'Croccante fuori, dolce dentro.', c1: '#8a2c5a', c2: '#ff9ad5', ico: '🍩' }],
    FR: [{ n: 'BAGUETTE PLUS', t: 'Il pane che fa il rumore giusto.', c1: '#8a6a2c', c2: '#ffe08a', ico: '🥖' },
         { n: 'PARFUM ÉCLAIR', t: 'Ti seguono tutti, anche i piccioni.', c1: '#5a2a8a', c2: '#d8a6ff', ico: '🧴' },
         { n: 'VÉLO VITE', t: 'In salita sembra discesa.', c1: '#0f5a8a', c2: '#8fd8ff', ico: '🚲' },
         { n: 'CRÊPE ROYALE', t: 'Doppio ripieno, nessun rimorso.', c1: '#a34b12', c2: '#ffd24a', ico: '🥞' }],
    DE: [{ n: 'BRATWURST BLITZ', t: 'Salsiccia veloce come un treno.', c1: '#7a3a12', c2: '#ffb86b', ico: '🌭' },
         { n: 'AUTOBAHN TURBO', t: 'Nessun limite, nemmeno al divertimento.', c1: '#22304a', c2: '#8fa8ff', ico: '🚗' },
         { n: 'KUCHEN KÖNIG', t: 'La torta che mette d’accordo tutti.', c1: '#5a2a3a', c2: '#ff9ad5', ico: '🍰' },
         { n: 'WALD WANDER', t: 'Scarpe da bosco, non da ufficio.', c1: '#1d4a2c', c2: '#9be36b', ico: '🥾' }],
    PT: [{ n: 'PASTEL RÁPIDO', t: 'Crema dentro, fretta fuori.', c1: '#8a5a12', c2: '#ffd24a', ico: '🥧' },
         { n: 'ONDA AZUL', t: 'Il mare in salotto, senza sabbia.', c1: '#0f4a8a', c2: '#8fd8ff', ico: '🌊' },
         { n: 'CAFÉ LIGEIRO', t: 'Forte come un tuono, leggero come un sospiro.', c1: '#3a2a1e', c2: '#e0c689', ico: '☕' },
         { n: 'SAPATILHA TOP', t: 'Passi silenziosi, stile rumoroso.', c1: '#2a6b4a', c2: '#9be36b', ico: '👟' }],
    EN: [{ n: 'BURGER BOLT', t: 'Fast food, faster delivery.', c1: '#8a3a12', c2: '#ffb86b', ico: '🍔' },
         { n: 'SNEAKER SPRINT', t: 'Run like the wifi is back.', c1: '#22304a', c2: '#8fa8ff', ico: '👟' },
         { n: 'CLOUD COLA', t: 'Tastes like a Monday off.', c1: '#8a1a2a', c2: '#ff6a57', ico: '🥤' },
         { n: 'PIXEL PIZZA', t: 'One more slice, one more level.', c1: '#5a2a8a', c2: '#c58cff', ico: '🍕' }]
  };

  function adCountry() {
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    const base = String(list[0] || 'en').toLowerCase().split('-')[0];
    return ({ it: 'IT', es: 'ES', fr: 'FR', de: 'DE', pt: 'PT', en: 'EN' })[base] || 'EN';
  }

  function adsLeft() {
    if (P.adDay !== today()) return ADS_PER_DAY;
    return Math.max(0, ADS_PER_DAY - (P.adCount || 0));
  }

  function takeAd() {
    if (P.adDay !== today()) { P.adDay = today(); P.adCount = 0; }
    P.adCount = (P.adCount || 0) + 1;
    saveProfile();
  }

  function closeAdOverlay() {
    if (adsTimer) { clearInterval(adsTimer); adsTimer = null; }
    const ov = document.getElementById('adOverlay');
    if (ov) ov.remove();
  }

  function playAd(country, ad, onDone) {
    closeAdOverlay();
    const ov = el('div', 'adOverlay');
    ov.id = 'adOverlay';
    ov.innerHTML =
      '<div class="adBox" style="--c1:' + ad.c1 + ';--c2:' + ad.c2 + '">' +
        '<div class="adBadge">PUBBLICITÀ · ' + country + '</div>' +
        '<div class="adScene">' +
          '<span class="adIco">' + ad.ico + '</span>' +
          '<b class="adBrand">' + ad.n + '</b>' +
          '<span class="adTag">' + ad.t + '</span>' +
        '</div>' +
        '<div class="adBar"><i></i></div>' +
        '<div class="adFoot"><span class="adCount">6</span></div>' +
      '</div>';
    document.body.appendChild(ov);
    const bar = ov.querySelector('.adBar i');
    const cnt = ov.querySelector('.adCount');
    const total = 6;
    let left = total;
    G.audio.sfx('buy');
    adsTimer = setInterval(() => {
      left -= .1;
      if (left < 0) left = 0;
      bar.style.width = ((total - left) / total * 100) + '%';
      cnt.textContent = left > 0 ? Math.ceil(left) + 's' : 'FATTO';
      if (left > 0) return;
      clearInterval(adsTimer); adsTimer = null;
      takeAd();
      P.coins += 50; saveProfile(); renderHUD();
      G.audio.sfx('coin');
      ov.querySelector('.adScene').classList.add('done');
      cnt.textContent = '+50 ★';
      const close = el('button', 'btn gold', 'RITIRA E CHIUDI');
      close.onclick = () => { closeAdOverlay(); if (onDone) onDone(); };
      ov.querySelector('.adFoot').appendChild(close);
    }, 100);
  }

  function pageAds() {
    page('MONETE EXTRA', body => {
      const country = adCountry();
      const card = el('div', 'card');
      card.innerHTML = '<h3>VIDEO PREMIO · ' + country + '</h3>' +
        '<p class="hint">Guarda una pubblicità del tuo paese e ricevi <b style="color:#ffd24a">50 monete</b>. Puoi guardare al massimo <b>' + ADS_PER_DAY + ' video al giorno</b>: quando finiscono devi aspettare domani.</p>';
      const pips = el('div', 'adPips');
      const note = el('p', 'hint');
      const btn = el('button', 'btn gold');
      card.appendChild(pips); card.appendChild(btn); card.appendChild(note);
      body.appendChild(card);
      body.appendChild(el('p', 'hint', 'Le pubblicità sono simulate dal gioco e cambiano in base alla lingua del dispositivo. Le monete sono salvate su questo dispositivo.'));

      const draw = () => {
        const left = adsLeft();
        pips.innerHTML = '';
        for (let i = 0; i < ADS_PER_DAY; i++) {
          const p = el('span', 'adPip' + (i < left ? ' on' : ''));
          pips.appendChild(p);
        }
        if (left > 0) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.textContent = 'GUARDA UN VIDEO (+50 ★) · ' + left + '/' + ADS_PER_DAY;
          note.textContent = 'Video disponibili oggi: ' + left + ' su ' + ADS_PER_DAY + '.';
        } else {
          btn.disabled = true;
          btn.style.opacity = '.5';
          btn.textContent = 'VIDEO FINITI PER OGGI';
          note.textContent = 'Hai già guardato ' + ADS_PER_DAY + ' video. Torna domani per altri ' + ADS_PER_DAY + '.';
        }
      };

      btn.onclick = () => {
        if (adsLeft() <= 0) { G.audio.sfx('error'); toast('Torna domani per altri video'); return; }
        G.audio.sfx('click');
        const pool = AD_CATALOG[country] || AD_CATALOG.EN;
        const ad = pool[Math.floor(Math.random() * pool.length)];
        playAd(country, ad, draw);
      };
      draw();
    });
    $('#pageBack').addEventListener('click', () => { closeAdOverlay(); }, { once: true });
  }

  /* ---------------- editor skin ---------------- */
  function pageEdit() {
    let skin = P.skin ? Object.assign({}, P.skin) : { head: '#4cc9ff', torso: '#4cc9ff', arm: '#ffffff', leg: '#ffffff' };
    let part = 'torso';
    page('PERSONALIZZA STICKMAN', body => {
      const wrap = el('div', 'card');
      wrap.innerHTML = '<h3>COLORA LE PARTI</h3>';
      const stage = el('div');
      stage.style.cssText = 'display:grid;place-items:center;padding:8px 0';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 80 130');
      svg.style.cssText = 'height:220px;width:auto;cursor:pointer';
      const gEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gEl.setAttribute('stroke-width', '10');
      gEl.setAttribute('stroke-linecap', 'round');
      gEl.setAttribute('fill', 'none');
      const headC = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      headC.setAttribute('cx', '40'); headC.setAttribute('cy', '20'); headC.setAttribute('r', '14');
      const torso = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      torso.setAttribute('d', 'M40 36V72');
      const legs = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      legs.setAttribute('d', 'M40 72 22 120M40 72 58 120');
      const arms = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arms.setAttribute('d', 'M40 46 16 66M40 46 64 62');
      [headC, torso, legs, arms].forEach(x => gEl.appendChild(x));
      svg.appendChild(gEl);
      stage.appendChild(svg);
      wrap.appendChild(stage);

      const partsRow = el('div', 'grid4');
      const parts = [['head', 'TESTA'], ['torso', 'BUSTO'], ['arm', 'BRACCIA'], ['leg', 'GAMBE']];
      partsRow.innerHTML = '';
      const pbtns = {};
      parts.forEach(([id, label]) => {
        const b = el('button', 'btn sm dark', label);
        b.onclick = () => { part = id; sync(); };
        pbtns[id] = b;
        partsRow.appendChild(b);
      });
      wrap.appendChild(partsRow);

      const pal = el('div', 'row');
      pal.style.marginTop = '10px';
      const palColors = G.COLS.concat(['#000000', '#5a5a5a', '#ff9ad5', '#7a4fd0', '#0b1224']);
      palColors.forEach(c => {
        const b = el('button', 'swatch');
        b.style.cssText = 'width:28px;height:28px;background:' + c;
        b.onclick = () => { skin[part] = c; sync(); };
        pal.appendChild(b);
      });
      wrap.appendChild(pal);

      const actions = el('div', 'row');
      actions.style.marginTop = '10px';
      const save = el('button', 'btn green', 'SALVA SKIN');
      const reset = el('button', 'btn dark', 'RIPRISTINA');
      save.onclick = () => { P.skin = Object.assign({}, skin); saveProfile(); toast('Skin salvata'); };
      reset.onclick = () => { P.skin = null; saveProfile(); skin = { head: '#4cc9ff', torso: '#4cc9ff', arm: '#ffffff', leg: '#ffffff' }; sync(); toast('Skin rimossa'); };
      actions.appendChild(save); actions.appendChild(reset);
      wrap.appendChild(actions);
      body.appendChild(wrap);
      const note = el('p', 'hint', 'Tocca una parte dello stickman per selezionarla, poi scegli il colore. La skin si usa per il giocatore 1.');
      body.appendChild(note);

      svg.addEventListener('click', ev => {
        const t = ev.target;
        if (t === headC) part = 'head';
        else if (t === torso) part = 'torso';
        else if (t === arms) part = 'arm';
        else if (t === legs) part = 'leg';
        sync();
      });

      function sync() {
        headC.setAttribute('fill', skin.head);
        torso.setAttribute('stroke', skin.torso);
        legs.setAttribute('stroke', skin.leg);
        arms.setAttribute('stroke', skin.arm);
        Object.keys(pbtns).forEach(k => pbtns[k].className = 'btn sm ' + (k === part ? 'gold' : 'dark'));
      }
      sync();
    });
  }

  /* ---------------- impostazioni ---------------- */
  function pageSettings() {
    page('IMPOSTAZIONI', body => {
      const card = el('div', 'card');
      card.innerHTML = '<h3>AUDIO E SCHERMO</h3>';
      const row = el('div', 'row');
      const toggle = (label, key) => {
        const b = el('button', 'btn ' + (P[key] ? 'green' : 'dark'), '');
        const paint = () => {
          b.className = 'btn ' + (P[key] ? 'green' : 'dark');
          b.textContent = label + (P[key] ? ' ON' : ' OFF');
        };
        b.onclick = () => {
          P[key] = !P[key];
          P.sound = P.music || P.sfx;
          saveProfile();
          if (key === 'music') G.audio.setMusic(P.music); else G.audio.setSfx(P.sfx);
          G.engine.setSound(P.sound);
          paint();
          G.audio.sfx('click');
        };
        paint();
        return b;
      };
      row.appendChild(toggle('🎵 MUSICA', 'music'));
      row.appendChild(toggle('🔊 EFFETTI', 'sfx'));
      const skyB = el('button', 'btn ' + (P.skyWeapons ? 'green' : 'dark'), '🪂 ARMI DAL CIELO ' + (P.skyWeapons ? 'ON' : 'OFF'));
      skyB.onclick = () => {
        P.skyWeapons = !P.skyWeapons; saveProfile();
        skyB.className = 'btn ' + (P.skyWeapons ? 'green' : 'dark');
        skyB.textContent = '🪂 ARMI DAL CIELO ' + (P.skyWeapons ? 'ON' : 'OFF');
        G.audio.sfx('click');
        toast(P.skyWeapons ? 'Si parte disarmati: armi dal cielo ogni 10 secondi' : 'Armi dal cielo disattivate');
      };
      row.appendChild(skyB);
      const fsB = el('button', 'btn dark', '⛶ SCHERMO INTERO');
      fsB.onclick = toggleFS;
      row.appendChild(fsB);
      card.appendChild(row);
      body.appendChild(card);

      const card2 = el('div', 'card');
      card2.innerHTML = '<h3>PROFILO</h3>';
      const nameRow = el('div', 'row');
      const nameIn = el('input', 'nameInput');
      nameIn.type = 'text'; nameIn.maxLength = 18; nameIn.value = P.name;
      nameIn.placeholder = 'Il tuo nome'; nameIn.setAttribute('aria-label', 'Nome giocatore');
      const nameSave = el('button', 'btn green', 'SALVA NOME');
      nameSave.onclick = () => {
        const v = nameIn.value.trim().replace(/\s+/g, ' ').slice(0, 18);
        if (!v) { G.audio.sfx('error'); toast('Scrivi un nome'); return; }
        P.name = v; saveProfile(); renderHUD();
        G.audio.sfx('click'); toast('Nome salvato: ' + v);
      };
      nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') nameSave.click(); });
      const nameRnd = el('button', 'btn gold', '🎲 CASUALE');
      nameRnd.onclick = () => {
        nameIn.value = randomName();
        P.name = nameIn.value; saveProfile(); renderHUD();
        G.audio.sfx('coin'); toast('Nuovo nome: ' + P.name);
      };
      nameRow.appendChild(nameIn); nameRow.appendChild(nameSave); nameRow.appendChild(nameRnd);
      card2.appendChild(nameRow);
      card2.appendChild(el('p', 'hint', 'Livello ' + lvl() + ' · ' + P.xp + ' EXP · Miglior punteggio ' + (P.best || 0) + ' · Tornei boss superati ' + (P.bossTier || 0) + '. Monete e livello sono solo i tuoi progressi salvati su questo dispositivo.'));
      const reset = el('button', 'btn red', 'AZZERA PROGRESSI');
      reset.onclick = () => {
        if (!window.confirm('Azzerare monete, livelli, skin e sblocchi?')) return;
        P = Object.assign({}, DEF);
        saveProfile(); renderHUD(); home(); toast('Progressi azzerati');
      };
      card2.appendChild(reset);
      body.appendChild(card2);

      const card3 = el('div', 'card');
      card3.innerHTML = '<h3>COMANDI</h3><p class="hint">Tocca un comando e premi il nuovo tasto. Con un controller collegato: levetta per muoversi, A salta, X attacca, B abilità, Y cambia arma, LT/RT scudo.</p>';
      const ACTIONS = [['l', 'Sinistra'], ['r', 'Destra'], ['j', 'Salto'], ['d', 'Scudo'], ['a', 'Attacco'], ['abi', 'Abilità'], ['sw', 'Arma']];
      const keyLabel = code => !code ? '—' : code.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('Numpad', 'NUM ').replace('Space', 'SPAZIO');
      const renderControls = () => {
        card3.querySelectorAll('.ctrlBlock').forEach(n => n.remove());
        ['p1', 'p2'].forEach(pk => {
          const block = el('div', 'ctrlBlock');
          block.appendChild(el('p', 'hint', '<b>' + (pk === 'p1' ? 'GIOCATORE 1' : 'GIOCATORE 2') + '</b>'));
          const row = el('div', 'row');
          ACTIONS.forEach(a => {
            const b = el('button', 'btn sm dark', a[1] + ': ' + keyLabel(P.controls[pk][a[0]]));
            b.onclick = () => {
              b.textContent = a[1] + ': premi un tasto...';
              const grab = ev => {
                ev.preventDefault(); ev.stopPropagation();
                document.removeEventListener('keydown', grab, true);
                P.controls[pk][a[0]] = ev.code; saveProfile(); renderControls();
                G.audio.sfx('click'); toast('Comando aggiornato');
              };
              document.addEventListener('keydown', grab, true);
            };
            row.appendChild(b);
          });
          block.appendChild(row);
          card3.appendChild(block);
        });
      };
      renderControls();
      const ctrlReset = el('button', 'btn red', 'RIPRISTINA COMANDI');
      ctrlReset.onclick = () => {
        P.controls = JSON.parse(JSON.stringify(DEFAULT_CTRL)); saveProfile(); renderControls();
        G.audio.sfx('click'); toast('Comandi ripristinati');
      };
      card3.appendChild(ctrlReset);
      body.appendChild(card3);

      const card4 = el('div', 'card');
      card4.innerHTML = '<h3>CREDITI</h3><p class="hint">Stickman Fight 3D · v2.0 · un gioco <b>GattoHub / GattoItaliano</b>. Motore, personaggi e interfaccia originali, disegnati da zero.</p>';
      body.appendChild(card4);
    });
  }

  function toggleFS() {
    try {
      if (!document.fullscreenElement) (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) { toast('Schermo intero non disponibile'); }
  }

  /* ---------------- battle mode ---------------- */
  function pageModes() {
    page('BATTLE MODE', body => {
      const intro = el('p', 'hint', 'Varianti speciali del duello. Ognuna costa 100 monete e si sblocca per sempre. Scegli una variante e prepara il match.');
      body.appendChild(intro);
      const list = el('div', 'grid2');
      G.VARIANTS.forEach(v => {
        const owned = P.variants.includes(v.id);
        const b = el('button', 'modeCard');
        const ico = { double: '🗡️', boots: '👟', radioactive: '☢️', giant: '🗿', mirror: '🪞', gravity: '🌌', superjump: '🚀', nohealth: '💀' }[v.id] || '⭐';
        b.innerHTML = '<span class="ico">' + ico + '</span><span class="txt"><b>' + v.n + '</b><span>' + v.d + '</span></span>' +
          '<span class="price">' + (owned ? 'GIOCA' : '★ 100') + '</span>';
        b.onclick = () => {
          if (!owned) {
            if (P.coins < 100) { G.audio.sfx('error'); toast('Servono 100 monete'); return; }
            P.coins -= 100; P.variants.push(v.id); G.audio.sfx('buy'); saveProfile(); renderHUD();
            toast('Sbloccato: ' + v.n); pageModes(); return;
          }
          openSetup(2, { variant: v.id });
        };
        list.appendChild(b);
      });
      body.appendChild(list);
    });
  }

  /* ---------------- minigiochi ---------------- */
  function pageMinigames() {
    page('MINI-GIOCHI', body => {
      const list = el('div', 'grid2');
      G.MINIGAMES.forEach(m => {
        const b = el('button', 'modeCard');
        b.innerHTML = '<span class="ico">' + m.ico + '</span><span class="txt"><b>' + m.n + '</b><span>' + m.d + '</span></span><span class="price">▶</span>';
        b.onclick = () => startMinigame(m.id);
        list.appendChild(b);
      });
      body.appendChild(list);
      body.appendChild(el('p', 'hint', 'Altri minigiochi in arrivo: per ora Bersagli e Ultimo in Piedi.'));
    });
  }

  /* ---------------- boss ---------------- */
  function pageBoss() {
    page('BOSS FIGHT', body => {
      const need = 12;
      const locked = lvl() < need;
      const card = el('div', 'card');
      if (locked) {
        card.innerHTML = '<h3>SBLOCCATO AL LIVELLO ' + need + '</h3><p class="hint">Sei al livello <b>' + lvl() + '</b>. Vinci duelli e ondate per salire di livello: la modalità Boss si sblocca al livello ' + need + '.</p>' +
          '<div class="xpBar" style="width:100%;height:14px;margin-top:10px"><i style="width:' + (G.xpInLevel(P.xp) / G.XP_PER_LEVEL * 100) + '%"></i></div>';
        body.appendChild(card);
        return;
      }
      const tier = P.bossTier || 0;
      card.innerHTML = '<h3>TORNEO ' + (tier + 1) + ' / 100</h3>' +
        '<p class="hint">Cinque scontri contro un boss gigante con due armi. Vinci per passare al torneo successivo: ogni torneo aumenta la vita del boss e il premio in monete.</p>';
      const ally = el('button', 'btn dark', '👥 ALLEATO CPU: NO');
      ally.onclick = () => {
        ally.dataset.on = ally.dataset.on === '1' ? '0' : '1';
        ally.textContent = '👥 ALLEATO CPU: ' + (ally.dataset.on === '1' ? 'SÌ' : 'NO');
        ally.className = 'btn ' + (ally.dataset.on === '1' ? 'green' : 'dark');
      };
      ally.dataset.on = '0';
      card.appendChild(ally);
      body.appendChild(card);

      const go = el('button', 'btn gold', 'AFFRONTA IL BOSS');
      go.style.alignSelf = 'flex-start';
      go.onclick = () => startBoss(ally.dataset.on === '1');
      body.appendChild(go);
      body.appendChild(el('p', 'hint', 'Suggerimento: le armi a distanza funzionano bene contro i boss, ma le abilità ad area sono più potenti.'));
    });
  }

  /* ---------------- survival ---------------- */
  function pageSurvival() {
    page('SURVIVAL', body => {
      body.appendChild(el('p', 'hint', 'Ondate infinite di nemici: zombie, ninja, scheletri, fantasmi e titani. Ogni ondata è più dura, ma ricarica la vita. Il record viene salvato.'));
      const list = el('div', 'grid3');
      const modes = [
        { id: 'solo', ico: '🧍', n: '1 Giocatore', d: 'Resisti da solo alle ondate.' },
        { id: 'duo', ico: '👥', n: '2 Giocatori', d: 'Due giocatori sullo stesso dispositivo.' },
        { id: 'ally', ico: '🤖', n: 'Solo + Alleato', d: 'Un bot combatte al tuo fianco.' }
      ];
      modes.forEach(m => {
        const b = el('button', 'modeCard');
        b.innerHTML = '<span class="ico">' + m.ico + '</span><span class="txt"><b>' + m.n + '</b><span>' + m.d + '</span></span><span class="price">▶</span>';
        b.onclick = () => startSurvival(m.id);
        list.appendChild(b);
      });
      body.appendChild(list);
      body.appendChild(el('p', 'hint', 'Record ondate: ' + (P.bestWave || 0) + '. I nemici attaccano chi è più vicino: muoviti e usa lo scudo.'));
    });
  }

  /* ---------------- LAN ---------------- */
  let lanRoom = null;

  function meInfo() {
    return { name: String(P.name || 'GIOCATORE').slice(0, 14), level: lvl() };
  }

  function netCfg(map, players, localSlot, netClient) {
    return {
      mode: 'battle', map: map, players: players, rounds: 3, mods: {},
      switchWep: true, hideBars: false, spawns: map.spawns,
      localSlot: localSlot, netClient: !!netClient
    };
  }

  // ordine dei posti: host per primo, poi gli altri per posto -> l'indice è lo slot della partita
  function lobbyMatchPlayers(room) {
    const ordered = room.players.slice().sort((a, b) => (a.host ? -1 : b.host ? 1 : a.slot - b.slot));
    return ordered.map((p, i) => ({
      human: !p.bot,
      name: String(p.name || 'GIOCATORE').toUpperCase().slice(0, 14),
      color: G.COLS[i % 6], color2: '#ffffff',
      head: i === 0 ? P.head : 'none',
      weapon: p.bot ? pick(G.WLIST) : 'sword',
      alt: p.bot ? pick(G.WLIST) : 'gun',
      diff: 'normal',
      skin: i === 0 ? P.skin : null
    }));
  }

  function beginNet(room, slot) {
    netSession = room; netSlot = slot;
    room.matchSlot = slot;
    room.onData = (d, from) => {
      if (!d || !d.t) return;
      if (d.t === 'in') G.engine.setRemoteInput(d.slot != null ? d.slot : from, d.i);
      else if (d.t === 'st' && slot !== 0) G.engine.applyNetState(d.s);
      else if (d.t === 'end' && slot !== 0) onMatchEnd(d.res);
    };
    if (slot !== 0) {
      const inputTimer = setInterval(() => {
        if (!G.engine.isPlaying()) return;
        const i = G.engine.getInput(slot);
        if (i) room.sendInput(i);
      }, 50);
      netTimers.push(inputTimer);
    } else {
      const snapTimer = setInterval(() => {
        if (!G.engine.isPlaying()) return;
        room.broadcast({ t: 'st', s: G.engine.netSnapshot() });
      }, 100);
      netTimers.push(snapTimer);
    }
  }

  function startLanMatch(room) {
    if (!room.isHost) return;
    const mapRaw = pick(G.MAPS.filter(m => m.ground));
    room.start(mapRaw.id, lobbyMatchPlayers(room));
  }

  function openLanLobby(room) {
    netSession = room; lanRoom = room;
    const body = $('#pageBody');
    body.innerHTML = '';
    const card = el('div', 'card lanCard');
    const badge = el('div', 'pill', 'STANZA: ' + room.code + ' · ' + (room.isHost ? 'HOST' : 'OSPITE'));
    const status = el('p', 'hint', room.isHost ? 'Lobby aperta: condividi il codice. Entrano al massimo 4 giocatori (tu compreso).' : 'Sei nella lobby: attendo che l\'host avvii la partita.');
    const list = el('div', 'lanList');
    const actions = el('div', 'row');
    const foot = el('div', 'row');
    card.appendChild(badge); card.appendChild(status); card.appendChild(list);
    body.appendChild(card);
    body.appendChild(actions);
    body.appendChild(foot);

    room.onStatus = m => { if (status) status.textContent = m; };
    room.onStart = msg => {
      const raw = G.MAPS.find(m => m.id === msg.mapId) || G.MAPS[0];
      const map = mapWithBg(raw);
      launch(netCfg(map, msg.players, msg.slot, msg.slot !== 0));
      beginNet(room, msg.slot);
    };
    room.onKick = reason => {
      if (lanRoom !== room) return;
      lanRoom = null; netSession = null;
      room.closed = true;
      stopNet();
      G.audio.sfx('error');
      toast(reason === 'kick' ? 'Sei stato espulso dalla lobby' : reason === 'close' ? 'Host disconnesso' : 'La lobby è stata chiusa');
      pageLan();
    };

    const draw = () => {
      list.innerHTML = '';
      for (let i = 0; i < G.net.MAX; i++) {
        const p = room.players.find(x => x.slot === i);
        const row = el('div', 'lanRow' + (p ? '' : ' free'));
        const num = el('span', 'lanIdx', String(i + 1));
        row.appendChild(num);
        if (!p) {
          row.appendChild(el('span', 'lanName', 'POSTO LIBERO'));
          row.appendChild(el('span', 'lanLvl', 'in attesa…'));
        } else {
          const isMe = p.slot === room.mySlot;
          row.appendChild(el('span', 'lanName', p.name + (isMe ? ' (tu)' : '')));
          row.appendChild(el('span', 'lanLvl', 'LIV ' + p.level));
          if (p.host) row.appendChild(el('span', 'pill lanTag', 'HOST'));
          else if (p.bot) row.appendChild(el('span', 'pill lanTag', 'BOT'));
          if (room.isHost && !p.host) {
            const k = el('button', 'btn sm dark', p.bot ? '✕' : 'ESPelli');
            k.onclick = () => { if (p.bot) room.removeBot(p.slot); else room.kick(p.slot); };
            row.appendChild(k);
          }
        }
        list.appendChild(row);
      }
      const n = room.players.length;
      status.textContent = room.isHost
        ? (n < 2 ? 'Aggiungi un bot o aspetta che entri qualcuno: servono almeno 2 giocatori.' : n + '/4 in lobby. Tutti pronti: avvia la partita.')
        : n + '/4 in lobby. Attendo che l\'host avvii la partita…';
      actions.innerHTML = '';
      if (room.isHost) {
        const add = el('button', 'btn sm green', '🤖 AGGIUNGI BOT');
        add.disabled = n >= G.net.MAX;
        if (add.disabled) add.style.opacity = '.5';
        add.onclick = () => { G.audio.sfx('click'); room.addBot(); };
        const go = el('button', 'btn gold', '▶ AVVIA PARTITA');
        go.disabled = n < 2;
        if (go.disabled) go.style.opacity = '.5';
        go.onclick = () => { G.audio.sfx('click'); startLanMatch(room); };
        actions.appendChild(add); actions.appendChild(go);
      } else {
        actions.appendChild(el('p', 'hint', 'L\'host può avviare la partita o espellerti. Resta in questa schermata.'));
      }
      foot.innerHTML = '';
      const leave = el('button', 'btn dark', '← ESCI DALLA LOBBY');
      leave.onclick = () => { lanRoom = null; stopNet(); pageLan(); };
      foot.appendChild(leave);
    };

    room.onUpdate = draw;
    draw();
  }

  function pageLan() {
    page('LAN MULTIGIOCATORE', body => {
      lanRoom = null;
      const card = el('div', 'card');
      card.innerHTML = '<h3>LOBBY FINO A 4 GIOCATORI</h3><p class="hint">Crea una lobby LAN (stessa rete, o internet per il collegamento iniziale): entrano fino a 3 ospiti e vedi nome e livello di ognuno, oppure riempi i posti con i bot. L\'host può espellere chi vuole e avviare la partita.</p>';
      const status = el('p', 'hint', 'Scegli come iniziare.');
      const badge = el('div', 'pill', 'LOBBY: —');
      const quick = el('button', 'btn green', '⚡ PARTITA VELOCE');
      const hostB = el('button', 'btn gold', '🏠 CREA LOBBY');
      const codeIn = el('input', 'nameInput');
      codeIn.type = 'text'; codeIn.maxLength = 6; codeIn.placeholder = 'CODICE (es. A7K2)';
      codeIn.setAttribute('aria-label', 'Codice lobby');
      const joinB = el('button', 'btn dark', '🔑 ENTRA CON CODICE');
      const row1 = el('div', 'row');
      row1.appendChild(quick); row1.appendChild(hostB);
      const row2 = el('div', 'row');
      row2.appendChild(codeIn); row2.appendChild(joinB);
      card.appendChild(row1); card.appendChild(row2); card.appendChild(badge); card.appendChild(status);
      body.appendChild(card);
      body.appendChild(el('p', 'hint', 'Livello e nome arrivano dal profilo di ogni dispositivo. Metti il telefono in orizzontale e attiva lo schermo intero: in 4 sullo stesso schermo conviene il formato orizzontale.'));

      const fail = e => { status.textContent = (e && e.message) || 'Connessione non riuscita'; G.audio.sfx('error'); };
      const open = room => {
        G.audio.sfx('coin');
        openLanLobby(room);
      };
      quick.onclick = () => {
        stopNet(); badge.textContent = 'LOBBY: …'; status.textContent = 'Cerco una lobby veloce...'; G.audio.sfx('click');
        G.net.quick(meInfo()).then(open).catch(fail);
      };
      hostB.onclick = () => {
        stopNet(); const code = G.net.norm(codeIn.value) || G.net.newCode();
        status.textContent = 'Creo la lobby ' + code + '...'; G.audio.sfx('click');
        G.net.hostRoom(code, meInfo()).then(open).catch(fail);
      };
      joinB.onclick = () => {
        const code = G.net.norm(codeIn.value);
        if (!code) { status.textContent = 'Scrivi il codice della lobby.'; G.audio.sfx('error'); return; }
        stopNet(); status.textContent = 'Mi collego alla lobby ' + code + '...'; G.audio.sfx('click');
        G.net.joinRoom(code, meInfo()).then(open).catch(fail);
      };
    });
  }

  /* ---------------- setup partita ---------------- */
  const MAPLIST = G.MAPS.concat([{ id: '__random', n: 'Casuale', th: G.MAPS[0].th, ground: true, plats: [] }]);

  function bgTheme() {
    if (!P.bg) return null;
    return G.BGS.find(b => b.id === P.bg) || null;
  }

  function mapWithBg(map) {
    const bg = bgTheme();
    if (!bg) return map;
    return Object.assign({}, map, {
      th: Object.assign({}, map.th, { sky: bg.sky, far: bg.far, ground: bg.ground, top: bg.top, liquid: bg.liquid })
    });
  }

  function variantMods(id) {
    if (!id) return {};
    return { [id]: 1 };
  }

  function openSetup(count, opts) {
    opts = opts || {};
    const slots = count === 1 ? 2 : count;
    const v = opts.variant ? G.VARIANTS.find(x => x.id === opts.variant) : null;
    setup = {
      count: slots, mode: opts.mode || 'battle', variant: opts.variant || null,
      showBars: true, switchWep: true,
      mapIndex: Math.min(P.lastMap || 0, MAPLIST.length - 1),
      players: []
    };
    for (let i = 0; i < slots; i++) {
      const human = count === 1 ? i === 0 : true;
      setup.players.push({
        human, weapon: 'random', head: i === 0 ? P.head : 'none',
        c1: G.COLS[i % 6], c2: '#ffffff', diff: 'normal'
      });
    }
    if (setup.count === 2 && count === 1) setup.players[1].human = false;
    renderSetup(v ? v.n : (setup.mode === 'battle' ? 'BATTAGLIA' : 'PARTITA'));
    show('setup');
  }

  function renderSetup(title) {
    $('#setupTitle').textContent = title || 'BATTAGLIA';
    const slotsEl = $('#setupSlots');
    slotsEl.innerHTML = '';
    setup.players.forEach((p, i) => slotsEl.appendChild(slotEl(p, i)));

    const center = $('#setupCenter');
    center.innerHTML = '';
    const mapBox = el('div', 'mapBox');
    const map = MAPLIST[setup.mapIndex];
    mapBox.innerHTML = '<div class="rowM"><button class="arr" data-map="-1">◀</button><span class="mapName">' + map.n + '</span><button class="arr" data-map="1">▶</button></div>';
    const prev = document.createElement('canvas');
    prev.className = 'mapPrev'; prev.width = 220; prev.height = 124;
    mapBox.appendChild(prev);
    center.appendChild(mapBox);
    drawMapPrev(prev, map);

    mapBox.querySelectorAll('[data-map]').forEach(b => {
      b.onclick = () => {
        setup.mapIndex = (setup.mapIndex + Number(b.dataset.map) + MAPLIST.length) % MAPLIST.length;
        P.lastMap = setup.mapIndex; saveProfile();
        renderSetup(title);
      };
    });

    const toggles = el('div', 'toggles');
    const t1 = el('button', 'tgl ' + (setup.showBars ? 'on' : ''), '❤️ VITA');
    const t2 = el('button', 'tgl ' + (setup.switchWep ? 'on' : ''), '🔄 CAMBIO');
    t1.onclick = () => { setup.showBars = !setup.showBars; renderSetup(title); };
    t2.onclick = () => { setup.switchWep = !setup.switchWep; renderSetup(title); };
    toggles.appendChild(t1); toggles.appendChild(t2);
    center.appendChild(toggles);

    const go = el('button', 'goBtn', 'GO!');
    go.onclick = startBattle;
    center.appendChild(go);

    const foot = $('#setupFoot');
    foot.innerHTML = '<span>' + (setup.variant ? 'VARIANTE ATTIVA' : '1v1 · al meglio dei 5 round') + '</span>' +
      (setup.count >= 3 ? '<span>· Stesso colore = stessa squadra</span>' : '');

    $('#setupCoins').textContent = P.coins;
  }

  function slotEl(p, i) {
    const w = el('div', 'slot');
    const isHuman = p.human;
    const tag = el('button', 'tag' + (isHuman ? '' : ' cpu'), isHuman ? 'GIOCATORE ' + (i + 1) : 'CPU · ' + G.DIFF[p.diff].name.toUpperCase());
    tag.onclick = () => {
      if (i === 0) { toast('Il giocatore 1 è sempre umano'); return; }
      if (p.human) { p.human = false; }
      else {
        const order = ['easy', 'normal', 'hard'];
        const k = order.indexOf(p.diff);
        if (k === order.length - 1) p.human = true;
        else p.diff = order[k + 1];
      }
      renderSetup($('#setupTitle').textContent);
    };
    w.appendChild(tag);

    const side = el('div', 'side');
    const acts = [['weapon', '🗡️', 'Arma'], ['head', '🎩', 'Testa'], ['c1', '🎨', 'Colore 1'], ['c2', '🖌️', 'Colore 2']];
    acts.forEach(([act, ico, lbl]) => {
      const b = el('button', 'iBtn', ico);
      b.setAttribute('aria-label', lbl);
      b.title = lbl;
      b.onclick = () => openPicker(act, i);
      side.appendChild(b);
    });
    w.appendChild(side);

    const stage = el('div', 'pstage');
    const skin = i === 0 && P.skin ? P.skin : null;
    const cTorso = skin ? skin.torso : p.c1;
    const cArm = skin ? skin.arm : p.c2;
    const cLeg = skin ? skin.leg : p.c2;
    const cHead = skin ? skin.head : p.c1;
    stage.innerHTML = '<div class="stick"><svg viewBox="0 0 70 118">' +
      '<circle cx="35" cy="18" r="12" fill="' + cHead + '"/>' +
      '<g stroke-width="8" stroke-linecap="round" fill="none">' +
      '<path d="M35 34V64" stroke="' + cTorso + '"/>' +
      '<path d="M35 64 20 106M35 64 50 106" stroke="' + cLeg + '"/>' +
      '<path d="M35 42 16 58M35 42 54 54" stroke="' + cArm + '"/>' +
      '</g></svg></div>';
    w.appendChild(stage);

    const wn = el('div', 'wname', p.weapon === 'random' ? 'Casuale' : WP[p.weapon].n);
    w.appendChild(wn);

    const sw = el('div', 'sw');
    G.COLS.slice(0, 6).forEach(c => {
      const b = el('button', 'swatch' + (c === p.c1 ? ' on' : ''));
      b.style.background = c;
      b.onclick = () => { p.c1 = c; renderSetup($('#setupTitle').textContent); };
      sw.appendChild(b);
    });
    w.appendChild(sw);

    const rnd = el('button', 'randBtn', '🎲 CASUALE');
    rnd.onclick = () => {
      p.weapon = pick(G.WLIST);
      p.head = pick(P.heads.length ? P.heads : ['none']);
      p.c1 = pick(G.COLS);
      p.c2 = pick(G.COLS);
      renderSetup($('#setupTitle').textContent);
    };
    w.appendChild(rnd);
    return w;
  }

  function drawMapPrev(canvas, map) {
    const g = canvas.getContext('2d');
    const sx = canvas.width / 960, sy = canvas.height / 540;
    const bg = bgTheme();
    const th = bg ? Object.assign({}, map.th, { sky: bg.sky, far: bg.far, ground: bg.ground, top: bg.top, liquid: bg.liquid }) : map.th;
    const gr = g.createLinearGradient(0, 0, 0, canvas.height);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = th.far;
    for (let x = 0; x < canvas.width; x += 18) g.fillRect(x, canvas.height * .45 + (x % 3) * 6, 14, canvas.height);
    g.fillStyle = th.liquid;
    g.fillRect(0, canvas.height * .92, canvas.width, canvas.height);
    if (map.ground) {
      g.fillStyle = th.ground;
      g.fillRect(0, (map.maxY || 452) * sy, canvas.width, canvas.height - (map.maxY || 452) * sy);
      g.fillStyle = th.top;
      g.fillRect(0, (map.maxY || 452) * sy, canvas.width, 4);
    }
    (map.plats || []).forEach(p => {
      g.fillStyle = th.ground; g.fillRect(p.x * sx, p.y * sy, p.w * sx, 7);
      g.fillStyle = th.top; g.fillRect(p.x * sx, p.y * sy, p.w * sx, 2.5);
    });
    if (map.id === '__random') {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#fff'; g.font = '700 18px Baloo 2, sans-serif'; g.textAlign = 'center';
      g.fillText('?', canvas.width / 2, canvas.height / 2 + 6);
    }
  }

  function openPicker(kind, i) {
    const p = setup.players[i];
    const ov = el('div', 'overlay on');
    ov.style.zIndex = 40;
    const box = el('div', 'modal');
    box.style.maxHeight = '80vh';
    box.style.width = 'min(94vw,520px)';
    const title = kind === 'weapon' ? 'SCEGLI ARMA' : kind === 'head' ? 'SCEGLI TESTA' : kind === 'c1' ? 'COLORE 1' : 'COLORE 2';
    box.appendChild(el('h2', '', title));
    const grid = el('div', 'weaponGrid');
    grid.style.overflow = 'auto';

    if (kind === 'weapon') {
      const rb = el('button', 'wepBtn' + (p.weapon === 'random' ? ' on' : ''));
      rb.innerHTML = '<div style="font-size:26px">🎲</div>Casuale<small>ogni round</small>';
      rb.onclick = () => { p.weapon = 'random'; close(); };
      grid.appendChild(rb);
      G.WLIST.forEach(id => {
        const b = el('button', 'wepBtn' + (p.weapon === id ? ' on' : ''));
        const c = document.createElement('canvas');
        G.engine.weaponIcon(c, id, p.c2);
        b.appendChild(c);
        b.appendChild(el('span', '', WP[id].n));
        b.appendChild(el('small', '', WP[id].cat));
        b.onclick = () => { p.weapon = id; close(); };
        grid.appendChild(b);
      });
    } else if (kind === 'head') {
      Object.keys(G.HEADS).forEach(id => {
        const owned = P.heads.includes(id) || id === 'none';
        const b = el('button', 'wepBtn' + (p.head === id ? ' on' : ''));
        b.innerHTML = '<div style="font-size:24px">' + (HEAD_ICO[id] || '🎩') + '</div>' + G.HEADS[id].n +
          '<small>' + (owned ? (id === 'none' ? 'libera' : 'sbloccata') : '★ ' + G.HEADS[id].price) + '</small>';
        b.onclick = () => {
          if (!owned) { toast('Sbloccala nello Shop'); return; }
          p.head = id; close();
        };
        grid.appendChild(b);
      });
    } else {
      const extra = ['#000000', '#5a5a5a', '#ff9ad5', '#7a4fd0'];
      const all = G.COLS.concat(extra);
      all.forEach(c => {
        const b = el('button', 'wepBtn' + ((kind === 'c1' ? p.c1 : p.c2) === c ? ' on' : ''));
        b.innerHTML = '<div style="width:38px;height:38px;border-radius:50%;background:' + c + ';border:2px solid #081625"></div><small>' + c + '</small>';
        b.onclick = () => { if (kind === 'c1') p.c1 = c; else p.c2 = c; close(); };
        grid.appendChild(b);
      });
    }
    box.appendChild(grid);
    const closeBtn = el('button', 'btn dark', 'CHIUDI');
    closeBtn.onclick = close;
    box.appendChild(closeBtn);
    ov.appendChild(box);
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    function close() {
      ov.remove();
      renderSetup($('#setupTitle').textContent);
    }
  }

  /* ---------------- avvio partite ---------------- */
  function readyPlayers() {
    return setup.players.map((p, i) => ({
      human: p.human,
      color: p.c1, color2: p.c2, head: p.head,
      weapon: p.weapon === 'random' ? pick(G.WLIST) : p.weapon,
      alt: pick(G.WLIST),
      diff: p.diff,
      skin: i === 0 ? P.skin : null
    }));
  }

  function startBattle() {
    const mapRaw = MAPLIST[setup.mapIndex];
    const map = mapRaw.id === '__random' ? mapWithBg(pick(G.MAPS)) : mapWithBg(mapRaw);
    const cfg = {
      mode: 'battle',
      players: readyPlayers(),
      map,
      rounds: 3,
      mods: variantMods(setup.variant),
      switchWep: setup.switchWep,
      hideBars: !setup.showBars,
      spawns: map.spawns,
      randomMap: mapRaw.id === '__random'
    };
    launch(cfg);
  }

  function startSurvival(kind) {
    const players = [{
      human: true, color: G.COLS[0], color2: '#ffffff', head: P.head,
      weapon: pick(G.WLIST), alt: pick(G.WLIST), skin: P.skin, diff: 'normal'
    }];
    if (kind === 'duo') {
      players.push({ human: true, color: G.COLS[3], color2: '#ffffff', head: 'none', weapon: pick(G.WLIST), alt: pick(G.WLIST), diff: 'normal' });
    }
    const map = mapWithBg(pick(G.MAPS.filter(m => m.ground)));
    launch({ mode: 'survival', players, map, ally: kind === 'ally', mods: {}, switchWep: true, hideBars: false, spawns: map.spawns });
  }

  function startBoss(ally) {
    const players = [{
      human: true, color: G.COLS[0], color2: '#ffffff', head: P.head,
      weapon: pick(G.WLIST), alt: pick(G.WLIST), skin: P.skin, diff: 'normal'
    }];
    if (ally) players.push({ human: false, color: G.COLS[1], color2: '#0d3a1c', head: 'cap', weapon: pick(G.WLIST), diff: 'normal' });
    const map = mapWithBg(G.MAPS.find(m => m.id === 'colossus'));
    launch({ mode: 'boss', players, map, bossTier: P.bossTier || 0, ally, mods: {}, switchWep: true, hideBars: false });
  }

  function startMinigame(id) {
    const map = mapWithBg(pick(G.MAPS));
    if (id === 'targets') {
      launch({
        mode: 'targets', map, mods: {}, switchWep: true, hideBars: false,
        players: [{ human: true, color: G.COLS[0], color2: '#fff', head: P.head, weapon: 'gun', alt: 'sword', skin: P.skin }]
      });
    } else {
      launch({
        mode: 'lastman', map, mods: {}, switchWep: true, hideBars: false, rounds: 1,
        players: [{ human: true, color: G.COLS[0], color2: '#fff', head: P.head, weapon: pick(G.WLIST), alt: pick(G.WLIST), skin: P.skin }]
      });
    }
  }

  function playCustom(map) {
    launch({
      mode: 'battle',
      map: Object.assign({}, map, { th: Object.assign({}, map.th) }),
      rounds: 2, mods: {}, switchWep: true, hideBars: false, spawns: map.spawns,
      players: [
        { human: true, color: G.COLS[0], color2: '#ffffff', head: P.head, weapon: 'sword', alt: 'gun', skin: P.skin },
        { human: false, color: G.COLS[3], color2: '#ffffff', head: 'none', weapon: 'sword', alt: 'bow', diff: 'normal' }
      ]
    });
  }

  function launch(config) {
    lastConfig = config;
    $('#endOverlay').classList.remove('on');
    $('#pauseOverlay').classList.remove('on');
    show('game');
    G.engine.setSound(P.sound);
    G.audio.setMusic(P.music);
    G.audio.setSfx(P.sfx);
    if (config.localSlot == null) config.skyWeapons = P.skyWeapons;
    config.controls = P.controls;
    G.engine.start(config);
  }

  /* ---------------- fine partita ---------------- */
  function onMatchEnd(res) {
    const before = lvl();
    P.coins += res.coins || 0;
    P.xp += res.xp || 0;
    P.best = Math.max(P.best || 0, res.score || 0, res.wave || 0, res.kills || 0);
    if (res.mode === 'survival') P.bestWave = Math.max(P.bestWave || 0, res.wave || 0);
    if (res.mode === 'boss' && res.result === 'win') P.bossTier = Math.min(99, (P.bossTier || 0) + 1);
    saveProfile(); renderHUD();
    const after = lvl();

    const box = $('#endBox');
    const won = res.result === 'win';
    const titles = {
      battle: won ? 'HAI VINTO!' : res.result === 'draw' ? 'PAREGGIO' : 'HAI PERSO',
      lastman: res.result === 'win' ? 'ULTIMO IN PIEDI!' : 'ELIMINATO',
      survival: 'ONDATE SUPERATE: ' + (res.wave || 0),
      boss: won ? 'BOSS SCONFITTO!' : 'BOSS TROPPO FORTE',
      targets: 'PUNTEGGIO: ' + (res.score || 0)
    };
    const champ = res.champ ? res.champ.name : '';
    box.innerHTML = '<h2>' + (res.mode === 'survival' ? 'SURVIVAL' : res.mode === 'boss' ? 'BOSS FIGHT' : res.mode === 'targets' ? 'BERSAGLI' : 'BATTAGLIA') + '</h2>' +
      '<div class="big">' + (titles[res.mode] || 'FINE') + '</div>' +
      (champ ? '<p>' + champ + ' si aggiudica il match.</p>' : '') +
      '<div class="statRow"><span>Monete</span><b>+' + (res.coins || 0) + ' ★</b></div>' +
      '<div class="statRow"><span>Esperienza</span><b>+' + (res.xp || 0) + ' EXP</b></div>' +
      (res.mode === 'survival' ? '<div class="statRow"><span>Nemici abbattuti</span><b>' + (res.kills || 0) + '</b></div>' : '') +
      (res.mode === 'targets' ? '<div class="statRow"><span>Bersagli</span><b>' + (res.score || 0) + '</b></div>' : '') +
      (after > before ? '<div class="statRow"><span>Livello</span><b>' + before + ' → ' + after + '</b></div>' : '') +
      (after >= 12 && before < 12 ? '<p style="color:#ffd24a">BOSS FIGHT SBLOCCATO!</p>' : '') +
      '<div class="row" style="justify-content:center;margin-top:4px">' +
      '<button class="btn gold" id="endAgain">RIGIOCA</button>' +
      '<button class="btn dark" id="endHome">MENU</button></div>' +
      '<div class="row" id="endMaps" style="justify-content:center;margin-top:6px"></div>';
    $('#endOverlay').classList.add('on');
    G.audio.sfx(res.result === 'win' ? 'win' : res.result === 'lose' ? 'lose' : 'coin');
    const again = $('#endAgain');
    if (netSession || netSlot != null) {
      again.style.display = 'none';
      const em = $('#endMaps'); if (em) em.style.display = 'none';
    } else {
      again.onclick = () => launch(lastConfig);
      // alla vittoria: prossima mappa + due mappe scelte a caso, con gli stessi giocatori
      if (won && lastConfig && res.mode !== 'survival' && res.mode !== 'targets') {
        const mapsRow = $('#endMaps');
        const curId = lastConfig.map && lastConfig.map.id;
        const idx = G.MAPS.findIndex(m => m.id === curId);
        const next = G.MAPS[(idx + 1 + G.MAPS.length) % G.MAPS.length];
        const relaunchOn = map => {
          launch(Object.assign({}, lastConfig, { map: mapWithBg(map), spawns: map.spawns }));
        };
        const nextB = el('button', 'btn green', 'PROSSIMA: ' + next.n);
        nextB.onclick = () => relaunchOn(next);
        mapsRow.appendChild(nextB);
        const pool = G.MAPS.filter(m => m.id !== curId && m.id !== next.id)
          .sort(() => Math.random() - .5).slice(0, 2);
        pool.forEach(m => {
          const b = el('button', 'btn dark', '🗺️ ' + m.n);
          b.onclick = () => relaunchOn(m);
          mapsRow.appendChild(b);
        });
      }
    }
    $('#endHome').onclick = () => { stopNet(); G.engine.quit(); home(); };
  }

  /* ---------------- init ---------------- */
  function init() {
    G.engine.init({ canvas: $('#c'), touch: $('#touchLayer') });
    G.engine.setEndHandler(res => {
      if (netSession && netSlot === 0 && netSession.broadcast) { try { netSession.broadcast({ t: 'end', res: res }); } catch (e) {} }
      onMatchEnd(res);
    });
    G.engine.setPauseHandler(paused => {
      $('#pauseOverlay').classList.toggle('on', !!paused);
    });
    G.editor.init();
    G.ui.show = show;
    G.ui.home = home;
    G.ui.playCustom = playCustom;
    G.ui.openSetup = openSetup;
    G.ui.page = page;

    renderHUD();
    G.audio.setMusic(P.music);
    G.audio.setSfx(P.sfx);
    G.audio.setEnabled(P.sound);
    G.audio.music('menu');

    document.addEventListener('click', e => {
      const tapped = e.target.closest('button');
      if (tapped) {
        G.audio.sfx('click');
        tapped.classList.remove('tap');
        void tapped.offsetWidth;
        tapped.classList.add('tap');
        setTimeout(() => tapped.classList.remove('tap'), 340);
      }
      const nav = e.target.closest('[data-nav]');
      if (nav) { handleNav(nav.dataset.nav); return; }
      const pl = e.target.closest('[data-players]');
      if (pl) { openSetup(Number(pl.dataset.players)); return; }
      if (e.target.closest('#pageBack')) { pageBack ? pageBack() : home(); return; }
      if (e.target.closest('#setupBack')) { home(); return; }
    });

    $('#btnResume').onclick = () => G.engine.pause(false);
    $('#btnRestart').onclick = () => { if (lastConfig) launch(lastConfig); };
    $('#btnQuit').onclick = () => { G.engine.quit(); home(); };
    $('#pauseBtn').onclick = () => G.engine.togglePause();

    $('#fs').onclick = toggleFS;
    $('#splash').addEventListener('click', hideSplash);
    setTimeout(hideSplash, 2400);

    // tasto indietro del browser / ESC
    document.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if ($('#scr-page').classList.contains('on')) { pageBack ? pageBack() : home(); }
        else if ($('#scr-setup').classList.contains('on')) home();
        else if ($('#scr-editor').classList.contains('on')) home();
      }
    });
  }

  function handleNav(nav) {
    if (nav === 'shop') pageShop();
    else if (nav === 'daily') pageDaily();
    else if (nav === 'ads') pageAds();
    else if (nav === 'edit') pageEdit();
    else if (nav === 'settings') pageSettings();
    else if (nav === 'modes') pageModes();
    else if (nav === 'minigames') pageMinigames();
    else if (nav === 'boss') pageBoss();
    else if (nav === 'survival') pageSurvival();
    else if (nav === 'lan') pageLan();
    else if (nav === 'editor') { show('editor'); G.editor.open(); }
  }

  function hideSplash() {
    const sp = $('#splash');
    if (!sp || sp.classList.contains('gone')) return;
    sp.classList.add('gone');
    setTimeout(() => { sp.style.display = 'none'; }, 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  G.ui = { show, home, playCustom, openSetup, page };
})();
