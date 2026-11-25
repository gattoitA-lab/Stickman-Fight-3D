/* Stickman Fight 3D — editor di mappe. */
(function () {
  'use strict';
  const G = window.GH;
  const KEY = 'gh-stickman-maps-v1';
  const COLS = 32, ROWS = 40, CELL = 30, VIEW_ROWS = 18;
  const LIQ = { acqua: '#123a63', lava: '#ff5a1f', acido: '#4ef07a' };
  const TOOLS = [
    { id: 'block', ico: '🧱', n: 'Blocco' },
    { id: 'spike', ico: '🔺', n: 'Trappola' },
    { id: 'p1', ico: '1️⃣', n: 'P1' },
    { id: 'p2', ico: '2️⃣', n: 'P2' },
    { id: 'erase', ico: '🧽', n: 'Gomma' }
  ];

  let blocks, spikes, spawns, liquid, themeId, tool, maps, activeName;
  let cv, ctx, hover = null, painting = false, lastKey = '', scrollRow = 0;

  const E = G.editor = {};

  function loadMaps() {
    try { maps = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { maps = []; }
    if (!Array.isArray(maps)) maps = [];
  }
  function saveMaps() {
    try { localStorage.setItem(KEY, JSON.stringify(maps.slice(0, 10))); } catch (e) {}
  }

  function blank() {
    blocks = new Map(); spikes = new Map(); spawns = {};
    const gy = ROWS - 5;
    for (let cx = 0; cx < COLS; cx++) {
      if (cx < 4 || cx > COLS - 5) continue;
      blocks.set(cx + ',' + gy, 1);
    }
    spawns.p1 = { cx: 7, cy: gy - 3 };
    spawns.p2 = { cx: 24, cy: gy - 3 };
    scrollRow = Math.max(0, Math.min(ROWS - VIEW_ROWS, gy - 12));
    liquid = 'acqua'; themeId = 'rebirth'; activeName = '';
  }

  function theme() {
    const m = G.MAPS.find(m => m.id === themeId) || G.MAPS[0];
    return m.th;
  }

  function draw() {
    if (!ctx) return;
    const th = theme();
    const off = scrollRow * CELL;
    const sky = ctx.createLinearGradient(0, 0, 0, 540);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
    // liquido in fondo al livello (anche fuori dalla vista)
    const liqY = ROWS * CELL - 44 - off;
    if (liqY < 540) {
      ctx.fillStyle = LIQ[liquid] || LIQ.acqua;
      ctx.fillRect(0, liqY, 960, 540 - liqY);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(0, liqY, 960, 3);
    }
    // griglia
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, 540); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) {
      const yy = y * CELL - off;
      if (yy < 0 || yy > 540) continue;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(960, yy); ctx.stroke();
    }
    // blocchi
    blocks.forEach((_, k) => {
      const [cx, cy] = k.split(',').map(Number);
      const x = cx * CELL, y = cy * CELL - off;
      if (y < -CELL || y > 540) return;
      ctx.fillStyle = th.ground; ctx.fillRect(x, y, CELL, CELL - 4);
      ctx.fillStyle = th.top; ctx.fillRect(x, y, CELL, 5);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, CELL - 1, CELL - 1);
    });
    // trappole
    spikes.forEach((_, k) => {
      const [cx, cy] = k.split(',').map(Number);
      const x = cx * CELL, y = cy * CELL - off;
      if (y < -CELL || y > 540) return;
      ctx.fillStyle = '#b9c6e2';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 10, y + CELL);
        ctx.lineTo(x + i * 10 + 5, y + 6);
        ctx.lineTo(x + i * 10 + 10, y + CELL);
        ctx.closePath(); ctx.fill();
      }
    });
    // spawn
    Object.keys(spawns).forEach((key, i) => {
      const s = spawns[key]; if (!s) return;
      const x = s.cx * CELL + CELL / 2, y = s.cy * CELL + CELL / 2 - off;
      if (y < -20 || y > 560) return;
      ctx.fillStyle = i === 0 ? '#4cc9ff' : '#ff6a57';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#08101f'; ctx.font = '800 14px Baloo 2, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 1);
    });
    // hover
    if (hover) {
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2;
      ctx.strokeRect(hover.cx * CELL, hover.cy * CELL - off, CELL, CELL);
    }
    // info
    ctx.fillStyle = 'rgba(6,16,32,.75)';
    ctx.fillRect(10, 10, 300, 30);
    ctx.fillStyle = '#dce8ff'; ctx.font = '700 13px Baloo 2, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Mappa ' + (activeName || 'senza nome') + ' · ' + blocks.size + ' blocchi · riga ' + (scrollRow + 1) + '-' + (scrollRow + VIEW_ROWS), 20, 26);
  }

  function cellFrom(ev) {
    const r = cv.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * 960;
    const y = (ev.clientY - r.top) / r.height * 540;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL) + scrollRow;
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
    return { cx, cy };
  }

  function paint(c) {
    if (!c) return;
    const k = c.cx + ',' + c.cy;
    if (k === lastKey) return;
    lastKey = k;
    if (tool === 'block') { if (blocks.has(k)) blocks.delete(k); else { blocks.set(k, 1); spikes.delete(k); } }
    else if (tool === 'spike') { if (spikes.has(k)) spikes.delete(k); else { spikes.set(k, 1); blocks.delete(k); } }
    else if (tool === 'erase') { blocks.delete(k); spikes.delete(k); }
    else if (tool === 'p1') spawns.p1 = { cx: c.cx, cy: c.cy };
    else if (tool === 'p2') spawns.p2 = { cx: c.cx, cy: c.cy };
    draw();
  }

  function buildMap() {
    const th = Object.assign({}, theme());
    const plats = [];
    for (let cy = 0; cy < ROWS; cy++) {
      let run = null;
      for (let cx = 0; cx <= COLS; cx++) {
        const on = cx < COLS && blocks.has(cx + ',' + cy);
        if (on && run == null) run = cx;
        else if (!on && run != null) {
          plats.push({ x: run * CELL, y: cy * CELL, w: (cx - run) * CELL });
          run = null;
        }
      }
    }
    const sp = [];
    spikes.forEach((_, k) => {
      const [cx, cy] = k.split(',').map(Number);
      sp.push({ x: cx * CELL, y: cy * CELL, w: CELL, h: CELL });
    });
    const s1 = spawns.p1 || { cx: 6, cy: 25 }, s2 = spawns.p2 || { cx: 25, cy: 25 };
    return {
      id: 'custom', n: activeName || 'Mappa personale',
      th: Object.assign(th, { liquid: LIQ[liquid] || LIQ.acqua }),
      worldW: COLS * CELL, worldH: ROWS * CELL,
      ground: false, plats, spikes: sp,
      spawns: [
        { x: s1.cx * CELL + CELL / 2, y: s1.cy * CELL },
        { x: s2.cx * CELL + CELL / 2, y: s2.cy * CELL }
      ]
    };
  }

  function openLoad() {
    const wrap = document.querySelector('.edWrap');
    const ov = document.createElement('div');
    ov.className = 'overlay on';
    ov.style.position = 'absolute';
    ov.innerHTML = '<div class="modal" style="max-height:80vh;overflow:auto"><h2>LE MIE MAPPE</h2><div id="edList"></div><button class="btn dark" data-close>CHIUDI</button></div>';
    wrap.appendChild(ov);
    const list = ov.querySelector('#edList');
    if (!maps.length) list.innerHTML = '<p>Nessuna mappa salvata. Disegna qualcosa e premi Salva.</p>';
    maps.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.margin = '6px 0';
      const b = document.createElement('button');
      b.className = 'btn sm green';
      b.style.flex = '1';
      b.textContent = m.name;
      b.onclick = () => {
        blocks = new Map(m.blocks || []);
        spikes = new Map(m.spikes || []);
        spawns = m.spawns || {};
        liquid = m.liquid || 'acqua';
        themeId = m.themeId || 'rebirth';
        activeName = m.name;
        scrollRow = 0;
        document.getElementById('edLiquid').value = liquid;
        document.getElementById('edTheme').value = themeId;
        ov.remove(); draw();
      };
      const del = document.createElement('button');
      del.className = 'btn sm red'; del.textContent = '✕';
      del.onclick = () => { maps.splice(i, 1); saveMaps(); ov.remove(); openLoad(); };
      row.appendChild(b); row.appendChild(del);
      list.appendChild(row);
    });
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  function save() {
    let name = activeName;
    try { name = window.prompt('Nome della mappa', activeName || 'Mappa ' + (maps.length + 1)) || activeName; } catch (e) {}
    if (!name) return;
    activeName = name.slice(0, 24);
    const data = {
      name: activeName,
      blocks: Array.from(blocks.entries()),
      spikes: Array.from(spikes.entries()),
      spawns, liquid, themeId
    };
    const i = maps.findIndex(m => m.name === activeName);
    if (i >= 0) maps[i] = data; else maps.unshift(data);
    saveMaps();
    const btn = document.getElementById('edSave');
    const old = btn.textContent;
    btn.textContent = 'SALVATA ✓';
    setTimeout(() => { btn.textContent = old; }, 1200);
    draw();
  }

  E.init = function () {
    cv = document.getElementById('edCanvas');
    if (!cv) return;
    ctx = cv.getContext('2d');
    loadMaps(); blank();

    // temi
    const sel = document.getElementById('edTheme');
    G.MAPS.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.n;
      sel.appendChild(o);
    });
    sel.value = themeId;
    sel.onchange = () => { themeId = sel.value; draw(); };
    document.getElementById('edLiquid').onchange = e => { liquid = e.target.value; draw(); };

    // strumenti
    const tools = document.getElementById('edTools');
    TOOLS.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tool' + (t.id === 'block' ? ' on' : '');
      b.dataset.tool = t.id;
      b.innerHTML = '<span class="ti">' + t.ico + '</span>' + t.n;
      b.onclick = () => {
        tool = t.id;
        tools.querySelectorAll('.tool').forEach(x => x.classList.toggle('on', x === b));
      };
      tools.appendChild(b);
    });
    tool = 'block';

    cv.addEventListener('pointerdown', ev => {
      ev.preventDefault(); painting = true;
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      lastKey = ''; paint(cellFrom(ev));
    });
    cv.addEventListener('pointermove', ev => {
      const c = cellFrom(ev);
      hover = c; if (painting) paint(c); else draw();
    });
    cv.addEventListener('pointerup', () => { painting = false; lastKey = ''; });
    cv.addEventListener('pointercancel', () => { painting = false; lastKey = ''; });
    cv.addEventListener('pointerleave', () => { hover = null; painting = false; draw(); });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      scrollRow = Math.max(0, Math.min(ROWS - VIEW_ROWS, scrollRow + (e.deltaY > 0 ? 1 : -1)));
      draw();
    }, { passive: false });
    const up = document.getElementById('edUp'), down = document.getElementById('edDown');
    if (up) up.onclick = () => { scrollRow = Math.max(0, scrollRow - 6); draw(); };
    if (down) down.onclick = () => { scrollRow = Math.min(ROWS - VIEW_ROWS, scrollRow + 6); draw(); };

    document.getElementById('edBack').onclick = () => G.ui.home();
    document.getElementById('edNew').onclick = () => { blank(); draw(); };
    document.getElementById('edSave').onclick = save;
    document.getElementById('edLoad').onclick = openLoad;
    document.getElementById('edPlay').onclick = () => {
      const map = buildMap();
      G.ui.playCustom(map);
    };

    draw();
  };

  E.open = function () {
    draw();
    G.ui.show('editor');
  };

  E.maps = () => maps;
})();
