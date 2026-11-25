/* Stickman Fight 3D — motore di gioco (fisica, armi, modalità, comandi touch). */
(function () {
  'use strict';
  const G = window.GH, WP = G.WEAPONS;
  const W = 960, H = 540;
  let LIQUID = 496, worldW = W, worldH = H, camX = 0, camY = 0;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const TAU = Math.PI * 2;

  const E = G.engine = {};
  const MODS = () => (cfg && cfg.mods) || {};

  let cv, g, tLayer;
  let F = [], projs = [], parts = [], rings = [], floats = [], beams = [], targets = [];
  let plats = [], spikes = [], theme = null, mapDef = null, bgCity = [];
  let pickups = [], pickupT = 0, skyW = false, ambient = [], iconCache = {}, bgStyle = 'city';
  let cfg = null, mode = 'battle', state = 'idle', round = 1, winsNeeded = 3, wins = {};
  let timeLeft = 60, introT = 0, koT = 0, wave = 0, waveDelay = 0, wavePending = false, score = 0, kills = 0;
  let banner = '', bannerSub = '', bannerT = 0, slowT = 0, shake = 0, flash = 0;
  let lock = true, running = false, active = false, paused = false, endSent = false;
  let gravityBase = 1900, gravityMod = 1, gravT = 0, gameT = 0;
  let keys = {}, humans = [], last = 0, ac = null, soundOn = true, spawnOverride = null, rafId = 0;
  let onEnd = null, onPauseChange = null;
  let remoteIn = [], netLocalSlot = null, padPrev = [];
  let randomMaps = false, specF = null;

  /* ---------------- utils ---------------- */
  const foe = (a, b) => a.team !== b.team;
  const alive = () => F.filter(f => !f.dead);

  function sfx(f1, d, type, v, f2) {
    if (!soundOn) return;
    if (G.audio) G.audio.tone(f1, d, type, v, f2);
  }

  /* ---------------- fighter ---------------- */
  function mk(o) {
    const w = o.weapon || 'sword';
    const hp = o.hp != null ? o.hp : 100;
    return {
      id: o.id || ('f' + (Math.random() * 1e9 | 0)),
      name: o.name || 'Giocatore', team: o.team != null ? o.team : 0,
      human: !!o.human, cpu: !o.human, diff: o.diff || 'normal',
      color: o.color || '#4cc9ff', color2: o.color2 || '#ffffff',
      skin: o.skin || null, head: o.head || 'none',
      weapon: w, alt: o.alt || pick(G.WLIST), w2: null, w2T: 1.2,
      x: o.x != null ? o.x : 300, y: o.y != null ? o.y : 452,
      vx: 0, vy: 0, face: o.face || 1, hp, maxhp: hp,
      ground: true, shield: 0, block: false, stun: 0, cd: 0, abiCd: 0,
      atkT: -1, atkDone: false, hitSet: null, walk: 0, moved: 0,
      dead: false, rag: null, deadT: 0, s: o.s || 1, giant: false,
      aiT: 0, jumpCool: 0, hitT: 0, slowT: 0, dashT: 0, kills: 0,
      in: { l: 0, r: 0, j: 0, d: 0, a: 0, abi: 0, sw: 0 },
      keys: null, touch: null, slot: -1, riding: null,
      trail: [], deform: { a: 1, l: 1 }, defT: 0, shieldT: 0
    };
  }

  function jump(f) {
    if (!f.ground || f.jumpCool > 0) return;
    const p = MODS().superjump ? 1.42 : 1;
    f.vy = -680 * p;
    f.ground = false; f.jumpCool = .3;
    sfx(430, .1, 'triangle', .045, 760);
    burst(f.x, f.y, 5, '#ffffff', 120);
  }

  function tryAttack(f) {
    const w = WP[f.weapon];
    if (f.cd > 0 || f.stun > 0 || f.atkT >= 0) return;
    f.cd = w.cd * (f.slowT > 0 ? 1.35 : 1) * (f.s > 1.5 ? 1.45 : 1);
    f.atkT = 0; f.atkDone = false; f.hitSet = new Set();
    sfx(w.kind === 'shoot' || w.kind === 'throw' ? 340 : 240, .09, 'sawtooth', .028, w.kind === 'shoot' ? 90 : 520);
    if (w.kind === 'shoot' || w.kind === 'throw') fire(f, w);
  }

  function fire(f, w) {
    const pr = w.proj || { sp: 800, dmg: w.dmg, r: 5, type: 'bullet' };
    const mul = f.s;
    const hx = f.x + f.face * 34 * mul, hy = f.y - 58 * mul;
    const shoot = (ang, spd, dmgMul) => {
      projs.push({
        x: hx, y: hy, vx: Math.cos(ang) * pr.sp * spd, vy: Math.sin(ang) * pr.sp * spd - (pr.grav ? 60 : 0),
        grav: pr.grav || 0, dmg: pr.dmg || w.dmg, kb: w.kb, own: f, r: pr.r || 5,
        type: pr.type || 'bullet', explode: pr.explode || 0, life: pr.type === 'boomerang' ? 2.4 : 2,
        pierce: !!pr.pierce, hitSet: new Set(), back: false, src: w
      });
    };
    // niente mira assistita: si spara solo nella direzione in cui è girato il personaggio
    const base = f.face < 0 ? Math.PI : 0;
    if (pr.triple) { shoot(base - .14, 1, 1); shoot(base, 1.05, 1); shoot(base + .14, 1, 1); }
    else shoot(base, 1, 1);
    burst(hx, hy, 4, '#ffd24a', 160);
    shake = Math.max(shake, 1.6);
  }

  function switchWeapon(f) {
    if (!cfg || !cfg.switchWep || f.atkT >= 0) return;
    const cur = f.weapon;
    f.weapon = f.alt || 'sword';
    f.alt = cur;
    f.atkT = -1; f.cd = Math.max(f.cd, .2);
    burst(f.x, f.y - 60 * f.s, 6, f.color, 140);
    sfx(500, .08, 'sine', .05, 800);
  }

  /* ---------------- abilità ---------------- */
  function doAbility(f) {
    if (!f || f.dead || f.stun > 0 || f.abiCd > 0) return;
    const w = WP[f.weapon];
    f.abiCd = w.acd;
    sfx(520, .18, 'sine', .06, 180);
    const foes = F.filter(o => !o.dead && foe(f, o));
    switch (w.abi) {
      case 'dash':
        f.vx = f.face * 860; f.vy = -180; f.dashT = .34;
        burst(f.x, f.y - 40, 12, f.color, 220);
        shake = Math.max(shake, 3);
        break;
      case 'shock':
        rings.push({ x: f.x, y: f.y - 30 * f.s, r: 10, max: 210 * f.s, life: .42, maxLife: .42, dmg: 9, kb: 620, own: f });
        burst(f.x, f.y - 30, 14, '#ffd24a', 260);
        shake = Math.max(shake, 5);
        break;
      case 'shield':
        f.shield = 60; f.block = true; f.shieldT = 3.2;
        burst(f.x, f.y - 50, 12, '#7fd4ff', 180);
        break;
      case 'laser':
        beams.push({ x1: f.x, y1: f.y - 58 * f.s, x2: f.x + f.face * 900, y2: f.y - 58 * f.s + rnd(-6, 6), life: .28, own: f, dmg: 20 });
        shake = Math.max(shake, 7); flash = .35;
        break;
      case 'meteor': {
        const n = Math.min(4, Math.max(1, foes.length + 1));
        for (let i = 0; i < n; i++) {
          const t = foes[i % Math.max(1, foes.length)];
          const tx = t ? t.x + rnd(-40, 40) : f.x + rnd(-160, 160);
          projs.push({ x: tx, y: -60 - i * 40, vx: rnd(-40, 40), vy: 420, grav: 600, dmg: 16, kb: 520, own: f, r: 14, type: 'meteor', explode: 70, life: 4, hitSet: new Set(), back: false });
        }
        break;
      }
      case 'pull': {
        let best = null, bd = 1e9;
        for (const o of foes) { const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } }
        if (best && bd < 460) {
          best.vx = (f.x - best.x) * 3.2; best.vy = -260;
          best.stun = Math.max(best.stun, .35);
          best.hp = Math.max(0, best.hp - 6);
          beams.push({ x1: f.x, y1: f.y - 55, x2: best.x, y2: best.y - 55, life: .22, own: f, dmg: 0, hook: true });
          hurt(best, 6, 120, Math.sign(f.x - best.x), f);
          burst(best.x, best.y - 50, 8, '#8fe6ff', 180);
        } else {
          beams.push({ x1: f.x, y1: f.y - 55, x2: f.x + f.face * 260, y2: f.y - 60, life: .2, own: f, dmg: 0, hook: true });
        }
        break;
      }
      case 'freeze':
        for (const o of foes) {
          if (Math.hypot(o.x - f.x, o.y - f.y) < 420) { o.slowT = 2.6; burst(o.x, o.y - 50, 10, '#8fe6ff', 160); }
        }
        rings.push({ x: f.x, y: f.y - 30, r: 10, max: 360, life: .5, maxLife: .5, dmg: 0, kb: 0, own: f });
        break;
      case 'teleport': {
        burst(f.x, f.y - 40, 14, '#4ef07a', 220);
        f.x = clamp(f.x + f.face * 170, 30, worldW - 30);
        burst(f.x, f.y - 40, 14, '#4ef07a', 220);
        break;
      }
      case 'bomb':
        projs.push({ x: f.x + f.face * 30, y: f.y - 60, vx: f.face * 420, vy: -380, grav: 1200, dmg: 22, kb: 640, own: f, r: 10, type: 'bomb', explode: 96, life: 4, hitSet: new Set(), back: false });
        break;
      default:
        rings.push({ x: f.x, y: f.y - 30, r: 10, max: 180, life: .4, maxLife: .4, dmg: 8, kb: 500, own: f });
    }
  }

  /* ---------------- danno / morte ---------------- */
  function hurt(o, dmg, kb, dirx, src) {
    if (!o || o.dead) return;
    if (o.block && o.shield > 0) {
      o.shield = Math.max(0, o.shield - dmg * 1.7);
      dmg *= .16;
      burst(o.x, o.y - 50, 5, '#8fe6ff', 160);
    }
    const noHp = MODS().nohealth;
    if (mode === 'survival' && src && src.team === 2) dmg *= .8;
    if (src && src.s > 1.5) dmg *= .6;
    if (!noHp) o.hp = Math.max(0, o.hp - dmg);
    o.stun = Math.max(o.stun, .16 + kb / 3000);
    const kbm = kb * (o.s > 1.4 ? .45 : 1) * (noHp ? 1.25 : 1);
    o.vx = dirx * kbm; o.vy = -kbm * .4; o.ground = false;
    o.atkT = -1; o.hitT = .16; o.dashT = 0;
    burst(o.x, o.y - 50 * o.s, 7, o.color, 220);
    floatText(o.x, o.y - 74 * o.s, noHp ? '—' : Math.round(dmg), dmg >= 15 ? '#ffd24a' : '#fff');
    shake = Math.max(shake, Math.min(10, dmg * .55));
    sfx(140, .1, 'square', .06, 60);
    if (!noHp && o.hp <= 0) kill(o, src);
  }

  // l'arma del caduto resta a terra come bottino per chi è ancora in piedi
  function dropWeapon(o) {
    if (!o || !WP[o.weapon] || o.weapon === 'fist') return;
    pickups.push({
      id: o.weapon, x: clamp(o.x, 60, worldW - 60), y: o.y - 56 * o.s,
      vy: -300, spin: rnd(0, 6), landed: false, dead: false
    });
    o.weapon = 'fist'; o.alt = 'fist'; o.atkT = -1; o.hitSet = null;
  }

  function kill(o, src) {
    if (o.dead) return;
    o.dead = true; o.deadT = 0; o.hp = 0;
    dropWeapon(o);
    o.rag = makeRag(o, o.vx + (src ? src.face * 120 : 0), Math.min(o.vy, -320));
    burst(o.x, o.y - 50 * o.s, 22, o.color, 340);
    slowT = 1.15; shake = Math.max(shake, 9); flash = .3;
    sfx(90, .5, 'sawtooth', .09, 40);
    if (src) src.kills++;
    if (o.team === 2) { kills++; score += 1; }
  }

  function hazardKill(o) {
    if (o.dead) return;
    o.dead = true; o.deadT = 0; o.hp = 0;
    dropWeapon(o);
    // anche chi cade nel vuoto/liquido lascia un cadavere che rimbalza sulla superficie
    o.y = Math.min(o.y, LIQUID - 86);
    o.rag = makeRag(o, o.vx * .6, -320);
    burst(o.x, LIQUID, 18, theme ? theme.liquid : '#1b3b6f', 300);
    sfx(120, .45, 'sine', .07, 50);
    shake = Math.max(shake, 4);
  }

  function floatText(x, y, txt, col) {
    floats.push({ x, y, txt: String(txt), life: .7, col: col || '#fff' });
  }

  function burst(x, y, n, col, spd) {
    const sp = spd || 200;
    for (let i = 0; i < n; i++) {
      parts.push({
        x, y, vx: rnd(-sp, sp), vy: rnd(-sp * 1.2, sp * .35),
        life: rnd(.28, .6), max: .6, col, size: rnd(2, 5), grav: 1300
      });
    }
  }

  /* ---------------- ragdoll ---------------- */
  function makeRag(f, vx, vy) {
    const s = skel(f);
    const src = { head: s.head, neck: s.neck, hip: s.hip, eF: s.eF, hF: s.hF, eB: s.eB, hB: s.hB, kA: s.ka, fA: s.fa, kB: s.kb, fB: s.fb };
    const pts = {};
    for (const k in src) pts[k] = { x: src[k].x, y: src[k].y, px: src[k].x - vx / 60 + rnd(-1.5, 1.5), py: src[k].y - vy / 60 + rnd(-1.5, 1.5) };
    const link = (a, b) => ({ a, b, l: Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) });
    const cons = [link('head', 'neck'), link('neck', 'hip'), link('head', 'hip'), link('neck', 'eF'), link('eF', 'hF'), link('neck', 'eB'), link('eB', 'hB'), link('hip', 'kA'), link('kA', 'fA'), link('hip', 'kB'), link('kB', 'fB')];
    return { pts, cons };
  }

  function stepRag(r, dt) {
    const k = Math.min(dt, .033);
    // integrazione Verlet
    for (const key in r.pts) {
      const p = r.pts[key];
      const vx = (p.x - p.px) * .995, vy = (p.y - p.py) * .995;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + 1900 * k * k;
    }
    // vincoli dello scheletro
    for (let i = 0; i < 6; i++) {
      for (const c of r.cons) {
        const a = r.pts[c.a], b = r.pts[c.b];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4, df = (d - c.l) / d * .5;
        a.x += dx * df; a.y += dy * df; b.x -= dx * df; b.y -= dy * df;
      }
    }
    // urto col suolo risolto una volta sola, fuori dalle iterazioni: dentro il ciclo di
    // vincoli il rimbalzo veniva azzerato e il cadavere si fermava di colpo
    let impact = 0;
    for (const key in r.pts) {
      const p = r.pts[key];
      let floor = null;
      for (const pl of plats) {
        if (p.x > pl.x && p.x < pl.x + pl.w && p.py <= pl.y + 8 && p.y >= pl.y) {
          if (floor === null || pl.y < floor) floor = pl.y;
        }
      }
      // fondo del livello (acqua/lava/vuoto): vale se non c'è una piattaforma più in alto
      if (p.y >= LIQUID && (floor === null || LIQUID < floor)) floor = LIQUID;
      if (floor !== null) {
        const vy = p.y - p.py;                    // velocità verticale del frame
        p.y = floor;
        if (vy > impact) impact = vy;
        if (vy > 1.9) {                           // rimbalza perdendo energia a ogni urto
          p.py = p.y + vy * .62;
          p.px = p.x - (p.x - p.px) * .78;
        } else {                                  // striscia e si ferma
          p.py = p.y;
          p.px = p.x - (p.x - p.px) * .82;
        }
      }
      p.x = clamp(p.x, 8, worldW - 8);
      p.y = Math.min(p.y, LIQUID);
    }
    // il cadavere rimbalza in blocco: i piedi toccano per primi e i vincoli mangerebbero
    // il rimbalzo, così tutto il corpo riparte verso l'alto perdendo energia a ogni salto
    if (impact > 2.8) {
      const kick = Math.min(impact * .72, 10);
      for (const key in r.pts) { const p = r.pts[key]; p.py += kick; p.px += (p.x - p.px) * .18; }
    }
  }

  /* ---------------- scheletro ---------------- */
  function skel(f) {
    const w = WP[f.weapon], s = f.s, face = f.face, t = f.atkT;
    const reg = MODS().radioactive && f.deform;
    const defA = reg ? f.deform.a : 1, defL = reg ? f.deform.l : 1;
    const mv = f.ground && Math.abs(f.vx) > 25;
    const hip = { x: f.x, y: f.y - 38 * s - (mv ? Math.abs(Math.sin(f.walk)) * 3 * s : 0) };
    const lean = (f.ground ? clamp(f.vx / 260, -1, 1) * 5 * s : 0) - (f.stun > 0 ? face * 7 * s : 0);
    const neck = { x: f.x + lean, y: hip.y - 32 * s };
    const head = { x: neck.x + lean * .4, y: neck.y - 14 * s };
    const sh = { x: neck.x, y: neck.y + 5 * s };
    let fa, fb;
    if (f.ground) {
      const sg = mv ? Math.sin(f.walk) : 0;
      fa = { x: f.x + 7 * s + sg * 18 * s * defL, y: f.y - Math.max(0, Math.cos(f.walk)) * 9 * s };
      fb = { x: f.x - 7 * s - sg * 18 * s * defL, y: f.y - Math.max(0, -Math.cos(f.walk)) * 9 * s };
    } else {
      fa = { x: f.x + face * 14 * s, y: hip.y + 24 * s };
      fb = { x: f.x - face * 10 * s, y: hip.y + 34 * s };
    }
    const ka = { x: (hip.x + fa.x) / 2 + face * 5 * s, y: (hip.y + fa.y) / 2 };
    const kb = { x: (hip.x + fb.x) / 2 + face * 5 * s, y: (hip.y + fb.y) / 2 };
    let hF, dx = face, dy = 0;
    if (w.kind === 'shoot') {
      const r = (t >= 0 && t < .45) ? (1 - t / .45) : 0;
      hF = { x: sh.x + face * (30 - r * 7) * s, y: sh.y + 7 * s };
      dy = -.12 * r;
    } else if (w.kind === 'thrust') {
      let e = 0;
      if (t >= 0) e = t < .35 ? -.25 * (t / .35) : t < .62 ? lerp(-.25, 1, (t - .35) / .27) : lerp(1, 0, (t - .62) / .38);
      hF = { x: sh.x + face * (16 + e * (w.len ? 26 : 30)) * s, y: sh.y + (w.len ? 12 : 10) * s };
    } else {
      let d = -55;
      if (t >= 0) d = t < .3 ? lerp(-55, -125, t / .3) : t < .66 ? lerp(-125, 65, (t - .3) / .36) : lerp(65, -55, (t - .66) / .34);
      const r = d * Math.PI / 180;
      hF = { x: sh.x + face * (8 + Math.cos(r) * 10) * s, y: sh.y + 8 * s + Math.sin(r) * 10 * s };
      dx = face * Math.cos(r); dy = Math.sin(r);
    }
    const hB = (w.kind === 'thrust' && !w.len) ? { x: sh.x + face * 10 * s, y: sh.y + 16 * s } : { x: sh.x - face * 9 * s + (mv ? Math.sin(f.walk) * 8 * s : 0), y: sh.y + 24 * s };
    const eF = { x: (sh.x + hF.x) / 2, y: (sh.y + hF.y) / 2 + 6 * s };
    const eB = { x: (sh.x + hB.x) / 2, y: (sh.y + hB.y) / 2 + 5 * s };
    return { hip, neck, head, sh, ka, fa, kb, fb, eF, hF, eB, hB, dx, dy };
  }

  /* ---------------- tiro / collisioni ---------------- */
  function meleeHit(f) {
    const w = WP[f.weapon], s = f.s;
    const giant = f.giant ? 1.55 : 1;
    const reach = (w.reach || 60) * s * giant;
    const dmg = w.dmg * (f.giant ? 1.3 : 1);
    let hitAny = false;
    for (const o of F) {
      if (o === f || o.dead || !foe(f, o)) continue;
      if (f.hitSet && f.hitSet.has(o.id)) continue;
      const dx = (o.x - f.x) * f.face;
      const dy = Math.abs(o.y - f.y);
      if (dx > -26 && dx < reach + 18 * o.s && dy < 64 * s + 26) {
        if (f.hitSet) f.hitSet.add(o.id);
        hurt(o, dmg, w.kb, f.face, f);
        hitAny = true;
        burst(o.x, o.y - 55 * o.s, 8, '#ffe9a8', 260);
      }
    }
    if (mode === 'targets') {
      for (const t of targets) {
        if (!t.alive) continue;
        const dx = (t.x - f.x) * f.face;
        if (dx > -30 && dx < reach + t.r && Math.abs(t.y - (f.y - 50)) < 90) {
          t.hp -= dmg; hitAny = true;
          burst(t.x, t.y, 8, '#ffd24a', 240);
          if (t.hp <= 0) popTarget(t);
        }
      }
    }
    if (hitAny) { shake = Math.max(shake, 4); sfx(300, .08, 'square', .05, 130); }
  }

  function popTarget(t) {
    t.alive = false; score += 1;
    burst(t.x, t.y, 16, '#ffd24a', 300);
    sfx(700, .18, 'sine', .07, 1200);
    setTimeout(() => {
      if (mode !== 'targets' || !active) return;
      t.x = rnd(90, worldW - 90); t.y = rnd(120, 380); t.hp = t.maxhp; t.alive = true;
      t.vx = rnd(-70, 70); t.vy = rnd(-50, 50);
    }, 500);
  }

  function updateProjs(dt) {
    for (const p of projs) {
      p.life -= dt;
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'boomerang') {
        if (!p.back && p.life < 1.9) p.back = true;
        if (p.back) {
          const o = p.own;
          const a = Math.atan2(o.y - 55 - p.y, o.x - p.x);
          p.vx = lerp(p.vx, Math.cos(a) * 700, .06);
          p.vy = lerp(p.vy, Math.sin(a) * 700, .06);
        }
      }
      if (p.x < -40 || p.x > worldW + 40 || p.y > worldH + 60) { p.life = 0; continue; }
      // piattaforme
      let blocked = false;
      for (const pl of plats) {
        if (p.x > pl.x && p.x < pl.x + pl.w && p.y > pl.y && p.y < pl.y + 12) { blocked = true; break; }
      }
      if (blocked) { if (p.explode) explode(p); p.life = 0; continue; }
      // combattenti
      for (const o of F) {
        if (o.dead || !foe(p.own, o)) continue;
        if (p.hitSet.has(o.id)) continue;
        const cy = o.y - 46 * o.s;
        if (Math.abs(p.x - o.x) < 16 * o.s + p.r && Math.abs(p.y - cy) < 42 * o.s + p.r) {
          p.hitSet.add(o.id);
          if (p.type === 'hook') {
            o.vx = (p.own.x - o.x) * 3; o.vy = -240; o.stun = Math.max(o.stun, .3);
            beams.push({ x1: p.x, y1: p.y, x2: p.own.x, y2: p.own.y - 50, life: .2, own: p.own, hook: true });
          }
          if (p.type === 'snow') o.slowT = 2;
          hurt(o, p.dmg, p.kb, Math.sign(p.vx) || p.own.face, p.own);
          if (p.explode) { explode(p); p.life = 0; }
          else if (!p.pierce) p.life = Math.min(p.life, .01);
          break;
        }
      }
      if (mode === 'targets') {
        for (const t of targets) {
          if (!t.alive) continue;
          if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + p.r) {
            t.hp -= p.dmg; burst(t.x, t.y, 6, '#ffd24a', 200);
            if (t.hp <= 0) popTarget(t);
            if (!p.pierce) p.life = 0;
          }
        }
      }
    }
    projs = projs.filter(p => p.life > 0);
  }

  function explode(p) {
    rings.push({ x: p.x, y: p.y, r: 8, max: p.explode, life: .3, maxLife: .3, dmg: p.dmg, kb: p.kb, own: p.own });
    burst(p.x, p.y, 22, '#ffb347', 380);
    shake = Math.max(shake, 8);
    sfx(120, .3, 'sawtooth', .08, 40);
  }

  function updateRings(dt) {
    for (const r of rings) {
      const prev = r.r;
      r.life -= dt;
      r.r = r.max * (1 - r.life / r.maxLife);
      if (r.dmg > 0) {
        for (const o of F) {
          if (o.dead || !foe(r.own, o)) continue;
          const d = Math.hypot(o.x - r.x, o.y - 40 - r.y);
          if (d < r.r && d > prev - 20) hurt(o, r.dmg, r.kb, Math.sign(o.x - r.x) || 1, r.own);
        }
      }
    }
    rings = rings.filter(r => r.life > 0);
  }

  function updateBeams(dt) {
    for (const b of beams) {
      b.life -= dt;
      if (b.dmg > 0 && !b.done) {
        b.done = true;
        for (const o of F) {
          if (o.dead || !foe(b.own, o)) continue;
          const vx = b.x2 - b.x1, vy = b.y2 - b.y1;
          const t = clamp(((o.x - b.x1) * vx + ((o.y - 50) - b.y1) * vy) / (vx * vx + vy * vy), 0, 1);
          const px = b.x1 + vx * t, py = b.y1 + vy * t;
          if (Math.hypot(o.x - px, (o.y - 50) - py) < 60) hurt(o, b.dmg, 420, Math.sign(vx) || 1, b.own);
        }
      }
    }
    beams = beams.filter(b => b.life > 0);
  }

  function updateTargets(dt) {
    for (const t of targets) {
      if (!t.alive) continue;
      t.x += t.vx * dt; t.y += t.vy * dt;
      if (t.x < 60 || t.x > worldW - 60) t.vx *= -1;
      if (t.y < 100 || t.y > 380) t.vy *= -1;
      t.spin += dt;
    }
  }

  /* ---------------- armi dal cielo ---------------- */
  function weaponIconEl(id) {
    if (!iconCache[id]) {
      const c = document.createElement('canvas');
      E.weaponIcon(c, id, '#ffffff');
      iconCache[id] = c;
    }
    return iconCache[id];
  }

  function spawnPickup() {
    const pool = G.WLIST.filter(id => id !== 'fist');
    pickups.push({ id: pick(pool), x: rnd(140, worldW - 140), y: -40, vy: 80, landed: false, spin: rnd(0, 6), dead: false });
  }

  function updatePickups(dt) {
    // le armi cadute dai caduti restano in gioco anche senza l'opzione "armi dal cielo"
    if (skyW) {
      pickupT -= dt;
      if (pickupT <= 0) { pickupT = 10; spawnPickup(); }
    }
    for (const pk of pickups) {
      pk.spin += dt * 2;
      if (!pk.landed) {
        pk.vy += 520 * dt;
        pk.y += pk.vy * dt;
        for (const p of plats) {
          if (pk.x > p.x && pk.x < p.x + p.w && pk.y > p.y - 6 && pk.y < p.y + 30 && pk.vy > 0) {
            pk.y = p.y - 4; pk.landed = true; pk.vy = 0;
            burst(pk.x, pk.y, 8, WP[pk.id].col, 160);
            break;
          }
        }
        if (pk.y > LIQUID + 30) pk.dead = true;
      }
      for (const f of F) {
        if (f.dead) continue;
        if (Math.hypot(f.x - pk.x, (f.y - 46 * f.s) - pk.y) < 44) {
          f.weapon = pk.id; f.alt = 'fist';
          f.atkT = -1; f.cd = Math.max(f.cd, .18);
          floatText(f.x, f.y - 84 * f.s, WP[pk.id].n, '#ffd24a');
          burst(pk.x, pk.y, 16, WP[pk.id].col, 280);
          if (G.audio) G.audio.sfx('buy');
          pk.dead = true;
          break;
        }
      }
    }
    pickups = pickups.filter(p => !p.dead);
  }

  /* ---------------- IA ---------------- */
  function platformAt(x, y) {
    for (const p of plats) if (x > p.x - 8 && x < p.x + p.w + 8 && Math.abs(y - p.y) < 12) return p;
    return null;
  }

  // ripiano intermedio per arrivare a un bottino più in alto: uno scalino alla volta
  function ladderFor(f, ty) {
    let best = null, bs = 1e9;
    for (const p of plats) {
      if (p.y > f.y - 30) continue;      // deve stare sopra i piedi
      if (p.y < ty - 8) continue;        // e non oltre il bottino
      if (f.y - p.y > 150) continue;     // irraggiungibile con un salto
      const cx = p.x + p.w / 2;
      const dx = Math.abs(cx - f.x);
      if (dx > 460) continue;
      const sc = dx + (f.y - p.y) * .25;
      if (sc < bs) { bs = sc; best = p; }
    }
    return best;
  }

  function ai(f, dt) {
    const d = G.DIFF[f.diff] || G.DIFF.normal;
    const w = WP[f.weapon];
    f.aiT -= dt;
    if (f.aiT > 0) return;
    f.aiT = Math.min(.16, d.think) * rnd(.7, 1.25);
    const foes = F.filter(o => !o.dead && foe(f, o));
    if (!foes.length) { f.in.l = f.in.r = f.in.a = f.in.j = f.in.abi = 0; return; }
    let t = foes[0], bd = 1e9;
    for (const o of foes) { const dd = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * .6; if (dd < bd) { bd = dd; t = o; } }

    // armi cadute: le vuole chi è disarmato o chi ne ha una più debole
    let loot = null;
    if (pickups.length) {
      const myDmg = (WP[f.weapon] || {}).dmg || 0;
      let bl = 1e9;
      for (const pk of pickups) {
        const w2 = WP[pk.id];
        if (!w2) continue;
        if (f.weapon !== 'fist' && w2.dmg < myDmg + 1) continue;
        const dd = Math.hypot(pk.x - f.x, (pk.y - f.y) * 1.3);
        if (dd < bl) { bl = dd; loot = pk; }
      }
    }
    // contesa: se un avversario è addosso al bottino, prima sistemo lui
    let rival = null;
    if (loot) {
      let rd = 1e9;
      for (const o of foes) {
        const dd = Math.hypot(o.x - loot.x, (o.y - loot.y) * .7);
        if (dd < 110 && dd < rd) { rd = dd; rival = o; }
      }
    }

    const goLoot = !!loot && !rival;
    let tx = rival ? rival.x : loot ? loot.x : t.x;
    let ty = rival ? rival.y : loot ? loot.y : t.y;
    // bottino sopra la testa: punta al ripiano intermedio, non saltare sul posto
    if (goLoot && loot.y < f.y - 44) {
      const step = ladderFor(f, loot.y);
      if (step) {
        const onStep = Math.abs(f.y - step.y) < 18 && f.x > step.x - 18 && f.x < step.x + step.w + 18;
        if (!onStep) tx = clamp(loot.x, step.x + 20, step.x + step.w - 20);
      }
    }
    f.face = tx >= f.x ? 1 : -1;

    const dist = Math.abs(tx - f.x);
    const dy = ty - f.y;
    const below = dy > 50, above = dy < -50;
    const ranged = w.kind === 'shoot' || w.kind === 'throw';
    const ideal = ranged ? 290 : (w.reach || 60) * f.s * .72;
    f.in.l = f.in.r = 0;
    f.in.j = 0; f.in.a = 0; f.in.d = 0; f.in.abi = 0;

    if (dist > (goLoot ? 26 : ideal + 26)) { if (tx > f.x) f.in.r = 1; else f.in.l = 1; }
    else if (!goLoot && !rival && dist < ideal - 46 && Math.random() < .7) { if (tx > f.x) f.in.l = 1; else f.in.r = 1; }
    const reach = ranged ? 640 : (w.reach || 60) * f.s + 40;
    if (rival) {
      // rissa per l'arma: colpisce chi sta provando a prenderla
      if (Math.abs(rival.x - f.x) < reach + 30) f.in.a = 1;
    } else if (!goLoot) {
      f.in.a = Math.abs(t.x - f.x) < reach ? 1 : 0;
      if (Math.random() > d.acc) f.in.a = 0;
      f.in.d = Math.random() < d.shield ? 1 : 0;
      f.in.abi = Math.random() < d.abi ? 1 : 0;
    } else if (Math.abs(t.x - f.x) < reach && Math.random() < d.acc * .5) {
      f.in.a = 1;
    }

    // navigazione verticale: se il bersaglio è sopra salta, se è sotto si lascia cadere dal bordo
    if (f.ground && above && Math.abs(tx - f.x) < 300) f.in.j = 1;
    const myP = platformAt(f.x, f.y), tP = platformAt(tx, ty);
    if (f.ground && below && myP) {
      f.in.j = 0;
      const goLeft = tx < f.x;
      if (goLeft) { f.in.l = 1; f.in.r = 0; } else { f.in.r = 1; f.in.l = 0; }
    }
    // salta i vuoti solo se il bersaglio non è più in basso
    if (f.ground && !below && !onSolid(f.x + f.face * 44, f.y) && Math.abs(tx - f.x) > 46) f.in.j = 1;
    // se resta bloccato contro un muro, salta
    if (f.ground && (f.in.l || f.in.r)) {
      const movedX = Math.abs(f.x - (f._aiX == null ? f.x : f._aiX));
      f._stuck = movedX < 1.1 ? (f._stuck || 0) + .12 : 0;
      if (f._stuck > .4) { f.in.j = 1; f._stuck = 0; }
    } else f._stuck = 0;
    f._aiX = f.x;
    if (Math.random() < d.jump && !below) f.in.j = 1;
  }

  function onSolid(x, y) {
    for (const p of plats) if (x > p.x && x < p.x + p.w && Math.abs(y - p.y) < 6) return true;
    return false;
  }

  function padFor(i) {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (!pads) return null;
      const arr = [];
      for (const p of pads) if (p && p.connected) arr.push(p);
      if (!arr.length) return null;
      return arr[Math.min(arr.length - 1, Math.max(0, i))];
    } catch (e) { return null; }
  }

  function readInput(f, dt) {
    if (f.cpu) { ai(f, dt); return; }
    if (f.local === false) {
      const r = remoteIn[f.slot] || {};
      f.in.l = r.l ? 1 : 0; f.in.r = r.r ? 1 : 0; f.in.j = r.j ? 1 : 0;
      f.in.d = r.d ? 1 : 0; f.in.a = r.a ? 1 : 0;
      if (r.abi) { f.in.abi = 1; r.abi = 0; }
      if (r.sw) { f.in.sw = 1; r.sw = 0; }
      return;
    }
    const k = f.keys, t = f.touch;
    const kd = c => c && keys[c] ? 1 : 0;
    let l = 0, r = 0, j = 0, d = 0, a = 0, abi = 0, sw = 0;
    if (k) {
      l = kd(k.l); r = kd(k.r); j = kd(k.j); d = kd(k.d); a = kd(k.a); abi = kd(k.abi); sw = kd(k.sw);
    }
    // controller (gamepad standard)
    const gpi = netLocalSlot != null && f.slot === netLocalSlot ? 0 : f.slot;
    const gp = padFor(gpi);
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -.3) l = 1; if (ax > .3) r = 1;
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      if (ay < -.55 || b(0) || b(12)) j = 1;
      if (ay > .55 || b(13) || b(6) || b(7)) d = 1;
      if (b(2) || b(5)) a = 1;
      const prev = padPrev[f.slot] || {};
      if ((b(1) || b(4)) && !prev.abi) abi = 1;
      if ((b(3) || b(11)) && !prev.sw) sw = 1;
      padPrev[f.slot] = { abi: b(1) || b(4), sw: b(3) || b(11) };
    }
    if (t) {
      l = l || t.l; r = r || t.r; j = j || t.j; d = d || t.d; a = a || t.a;
      if (t.abi) { abi = 1; t.abi = 0; }
      if (t.sw) { sw = 1; t.sw = 0; }
    }
    f.in.l = l ? 1 : 0; f.in.r = r ? 1 : 0; f.in.j = j ? 1 : 0;
    f.in.d = d ? 1 : 0; f.in.a = a ? 1 : 0;
    if (abi) f.in.abi = 1;
    if (sw) f.in.sw = 1;
  }

  /* ---------------- update fighter ---------------- */
  function updateFighter(f, dt) {
    if (f.dead) { f.deadT += dt; if (f.rag) stepRag(f.rag, dt); return; }
    const w = WP[f.weapon];
    f.cd -= dt; f.abiCd -= dt; f.stun -= dt; f.jumpCool -= dt; f.hitT -= dt;
    if (f.slowT > 0) f.slowT -= dt;
    if (f.shieldT > 0) { f.shieldT -= dt; if (f.shieldT <= 0) f.block = false; }
    if (MODS().radioactive) {
      f.defT -= dt;
      if (f.defT <= 0) { f.defT = rnd(.4, .9); f.deform = { a: rnd(.75, 1.55), l: rnd(.75, 1.55) }; }
    }
    readInput(f, dt);

    if (f.stun <= 0 && !lock) {
      const dir = (f.in.r ? 1 : 0) - (f.in.l ? 1 : 0);
      const spd = 240 * (f.slowT > 0 ? .55 : 1);
      const acc = f.ground ? 14 : 5;
      f.vx += (dir * spd - f.vx) * Math.min(1, acc * dt);
      if (dir) f.face = dir;
      if (f.in.j) jump(f);
      if (f.in.d) { f.block = true; f.shield = Math.min(60, f.shield + 90 * dt); }
      else if (f.shieldT <= 0) { f.block = false; f.shield = Math.max(0, f.shield - 70 * dt); }
      if (f.in.a) tryAttack(f);
      if (f.in.abi) doAbility(f);
      if (f.in.sw) switchWeapon(f);
    } else if (f.stun <= 0 && lock) {
      f.vx *= Math.pow(.02, dt);
    } else {
      f.vx *= Math.pow(.25, dt);
    }
    f.in.abi = 0; f.in.sw = 0;

    if (f.dashT > 0) {
      f.dashT -= dt;
      if (!f.hitSet) f.hitSet = new Set();
      for (const o of F) {
        if (o === f || o.dead || !foe(f, o) || f.hitSet.has(o.id)) continue;
        if (Math.abs(o.x - f.x) < 40 * f.s + 20 * o.s && Math.abs(o.y - f.y) < 60) {
          f.hitSet.add(o.id); hurt(o, 9, 560, Math.sign(f.vx) || f.face, f);
        }
      }
    }

    if (MODS().double && f.w2) {
      f.w2T -= dt;
      if (f.w2T <= 0) {
        f.w2T = 1.3;
        const foes = F.filter(o => !o.dead && foe(f, o) && Math.abs(o.x - f.x) < 90 * f.s);
        if (foes.length) hurt(foes[0], 6, 300, Math.sign(foes[0].x - f.x), f);
        burst(f.x + f.face * 40, f.y - 70, 4, f.color2, 140);
      }
    }

    f.vy += gravityBase * gravityMod * dt;
    const py = f.y;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.x = clamp(f.x, 22, worldW - 22);
    f.ground = false; f.riding = null;
    for (const p of plats) {
      if (f.x > p.x - 8 && f.x < p.x + p.w + 8) {
        if (py <= p.y + 3 && f.y >= p.y && f.y < p.y + 34 && f.vy >= 0) {
          f.y = p.y; f.vy = 0; f.ground = true;
          if (p.mover) f.riding = p;
        }
      }
    }
    if (f.riding) {
      f.x = clamp(f.x + (f.riding.dx || 0), 22, worldW - 22);
      if (f.riding.dy) f.y += f.riding.dy;
    }
    if (f.y > LIQUID + 6) hazardKill(f);
    for (const s of spikes) {
      if (f.x > s.x && f.x < s.x + s.w && f.y > s.y - 30 && f.y < s.y + s.h) {
        hurt(f, 12, 420, f.x < s.x + s.w / 2 ? -1 : 1, null);
        f.y = s.y - 40; f.vy = -420;
      }
    }

    if (f.atkT >= 0) {
      f.atkT += dt / w.dur;
      if ((w.kind === 'swing' || w.kind === 'thrust') && f.atkT >= .34 && !f.atkDone) {
        f.atkDone = true; meleeHit(f);
      }
      if (f.atkT >= 1) { f.atkT = -1; f.hitSet = null; }
    }
    f.walk += Math.abs(f.vx) * dt * .055;

    // scia arma
    if (f.atkT >= 0 && (w.kind === 'swing')) {
      const sk = skel(f);
      f.trail.push({ x: sk.hF.x, y: sk.hF.y, life: .18 });
      if (f.trail.length > 14) f.trail.shift();
    }
    for (const t of f.trail) t.life -= dt;
    f.trail = f.trail.filter(t => t.life > 0);
  }

  /* ---------------- mappe / setup ---------------- */
  function buildMap(map) {
    theme = Object.assign({}, map.th);
    plats = []; spikes = []; bgCity = []; pickups = []; ambient = [];
    // arena larga: tutte le mappe built-in sono circa 1.7x, le mappe dell'editor usano la loro misura
    worldW = map.worldW || (map.id === 'custom' ? W : 1600);
    worldH = map.worldH || H;
    LIQUID = worldH - 44;
    const sx = worldW / 960;
    if (map.ground) {
      const y = map.maxY || 452;
      // isola centrale: ai lati resta il vuoto, così si può cadere nel liquido
      const edge = (map.edgeGap != null ? map.edgeGap : 96) * sx;
      plats.push({ x: edge, y, w: worldW - edge * 2 });
    }
    (map.plats || []).forEach(p => plats.push({ x: p.x * sx, y: p.y, w: p.w * sx }));
    (map.movers || []).forEach(m => plats.push({ x: m.x * sx, y: m.y, w: m.w * sx, mover: { axis: m.axis, amp: (m.amp || 0) * sx, sp: m.sp, baseX: m.x * sx, baseY: m.y, t: Math.random() * 6, dx: 0, dy: 0 } }));
    // piattaforme volanti: ogni livello senza mover ne riceve una orizzontale e una verticale
    if (!(map.movers || []).length) {
      const auto = [
        { x: worldW * .17, y: worldH * .54, w: 112, axis: 'x', amp: Math.min(150, worldW * .1), sp: .4 },
        { x: worldW * .63, y: worldH * .36, w: 104, axis: 'y', amp: 58, sp: .5 }
      ];
      auto.forEach(m => plats.push({ x: m.x, y: m.y, w: m.w, mover: { axis: m.axis, amp: m.amp, sp: m.sp, baseX: m.x, baseY: m.y, t: Math.random() * 6, dx: 0, dy: 0 } }));
    }
    bgStyle = ({
      dojo: 'forest', jurassic: 'forest', castle: 'forest', werewolf: 'forest', guardian: 'forest',
      inferno: 'volcano', forge: 'volcano', colossus: 'volcano', fossil: 'volcano',
      cold: 'ice', lockout: 'ice',
      relic: 'ruins', ghost: 'ruins', desolation: 'ruins', valhalla: 'ruins', equilibrium: 'ruins',
      kraken: 'ocean', seaport: 'ocean', legacy: 'ocean'
    })[map.id] || 'city';
    spikes = (map.spikes || []).map(s => Object.assign({}, s, { x: s.x * sx, w: s.w * sx }));
    // scenario
    let seed = 1;
    for (let i = 0; i < map.id.length; i++) seed += map.id.charCodeAt(i) * (i + 3);
    const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = -20; x < worldW + 40;) {
      const w = 34 + rr() * 60, h = 40 + rr() * 150;
      bgCity.push({ x, w, h, lit: rr() });
      x += w + 6;
    }
    for (let i = 0; i < 54; i++) ambient.push({ x: rr() * worldW, y: rr() * (LIQUID - 40), s: 1 + rr() * 2.4, sp: .25 + rr() * 1.3, a: rr() });
  }

  function updateMovers(dt) {
    gameT += dt;
    for (const p of plats) {
      if (!p.mover) continue;
      const m = p.mover;
      m.t += dt * m.sp;
      const off = Math.sin(m.t) * m.amp;
      if (m.axis === 'x') { const nx = m.baseX + off; m.dx = nx - p.x; p.x = nx; }
      else { const ny = m.baseY + off; m.dy = ny - p.y; p.y = ny; }
    }
  }

  function spawnPositions(n) {
    const f = k => Math.round(worldW * k);
    if (n <= 1) return [f(.42)];
    if (n === 2) return [f(.28), f(.72)];
    if (n === 3) return [f(.2), f(.5), f(.8)];
    return [f(.15), f(.38), f(.62), f(.85)];
  }

  E.start = function (config) {
    cfg = config || {};
    mode = cfg.mode || 'battle';
    randomMaps = !!cfg.randomMap;
    specF = null;
    spawnOverride = cfg.spawns || null;
    mapDef = cfg.map || G.MAPS[0];
    buildMap(mapDef);
    F = []; projs = []; parts = []; rings = []; floats = []; beams = []; targets = [];
    pickups = []; pickupT = 1.2; skyW = !!cfg.skyWeapons;
    wins = {}; round = 1; wave = 0; waveDelay = 0; wavePending = false; score = 0; kills = 0;
    endSent = false; paused = false; state = 'intro'; introT = 1.25; lock = true; banner = 'ROUND 1'; bannerSub = ''; bannerT = 1.3;
    slowT = 0; shake = 0; flash = 0; gravityMod = 1; gravT = 0; gameT = 0;
    winsNeeded = cfg.rounds || 3;
    timeLeft = mode === 'targets' ? 30 : (mode === 'battle' || mode === 'lastman' ? 60 : 0);
    humans = [];

    const players = (cfg.players || []).filter(p => p);
    const pos = spawnPositions(players.length + (mode === 'boss' ? 1 : 0));

    if (mode === 'boss') {
      players.forEach((p, i) => {
        const f = mk(Object.assign({}, p, {
          team: 1, name: p.human ? (i === 0 ? 'TU' : 'ALLEATO') : 'ALLEATO CPU',
          x: i === 0 ? 230 : 360, y: 300, face: 1,
          weapon: p.weapon || 'sword'
        }));
        F.push(f); if (f.human) humans.push(f);
      });
      const bossW = pick(G.WLIST);
      const boss = mk({
        team: 2, name: 'BOSS', color: '#ff4d4d', color2: '#2b0710', head: 'viking',
        weapon: bossW, hp: 260 + (cfg.bossTier || 0) * 90, s: 2.05, x: 720, y: 300, diff: 'hard'
      });
      if (MODS().mirror) boss.weapon = F[0] ? F[0].weapon : 'sword';
      F.push(boss);
    } else if (mode === 'survival') {
      players.forEach((p, i) => {
        const f = mk(Object.assign({}, p, { team: 1, name: i === 0 ? 'TU' : 'GIOCATORE ' + (i + 1), x: i === 0 ? 250 : 420, y: 300, face: 1 }));
        F.push(f); if (f.human) humans.push(f);
      });
      if (cfg.ally) {
        const a = mk({ team: 1, name: 'ALLEATO', color: '#4ef07a', color2: '#0d3a1c', weapon: pick(G.WLIST), x: 460, y: 300, diff: 'normal', head: 'cap' });
        F.push(a);
      }
      spawnWave(1);
    } else if (mode === 'targets') {
      const p = players[0] || { human: true, weapon: 'gun' };
      const f = mk(Object.assign({}, p, { team: 1, name: 'TU', x: 480, y: 300, face: 1 }));
      F.push(f); humans.push(f);
      for (let i = 0; i < 3; i++) targets.push({ x: rnd(140, worldW - 140), y: rnd(120, 360), vx: rnd(-90, 90), vy: rnd(-60, 60), r: 30, hp: 24, maxhp: 24, alive: true, spin: 0 });
    } else {
      // battle / lastman
      players.forEach((p, i) => {
        const f = mk(Object.assign({}, p, {
          team: i + 1, name: p.name || (p.human ? (players.filter(x => x.human).length > 1 ? 'GIOCATORE ' + (humans.length + 1) : 'GIOCATORE 1') : 'CPU ' + (i + 1)),
          x: pos[i] != null ? pos[i] : 300, y: 300, face: (pos[i] != null && pos[i] > W / 2) ? -1 : 1
        }));
        if (MODS().mirror && players[0]) f.weapon = players[0].weapon || 'sword';
        if (MODS().boots) { f.weapon = 'boots'; f.alt = pick(G.WLIST); }
        F.push(f); if (f.human) humans.push(f);
      });
      // controllo nomi umani (in rete i nomi arrivano dal profilo)
      if (cfg.localSlot == null) {
        let hm = 0, cm = 0;
        const cpuTot = F.filter(f => !f.human).length;
        for (const f of F) {
          if (f.human) { hm++; f.name = hm === 1 ? 'GIOCATORE 1' : 'GIOCATORE ' + hm; }
          else { cm++; f.name = cpuTot > 1 ? 'CPU ' + cm : 'CPU'; }
        }
      }
      if (mode === 'lastman') { for (let i = 0; i < 3; i++) F.push(mk({ team: 10 + i, name: 'CPU ' + (i + 1), color: pick(G.COLS), color2: '#fff', weapon: pick(G.WLIST), x: rnd(.12, .88) * worldW, y: 260, diff: 'normal', cpu: true })); }
    }

    // modificatori
    // colori: stesso colore = stessa squadra (solo in Battaglia e se i colori sono diversi)
    if (mode === 'battle') {
      const cols = new Set(F.map(f => f.color));
      if (cols.size > 1) F.forEach(f => { f.team = f.color; f.teamKey = f.color; });
    }
    for (const f of F) {
      if (!f.teamKey) f.teamKey = f.id;
      if (MODS().giant) f.giant = true;
      if (MODS().double) f.w2 = pick(G.WLIST);
      if (MODS().boots && f.weapon !== 'boots') { f.weapon = 'boots'; }
      if (MODS().nohealth) f.hp = f.maxhp = 9999;
      if (skyW) { f.weapon = 'fist'; f.alt = 'fist'; }
    }
    // slot input
    const C = cfg.controls || {};
    const KMAP = [
      C.p1 || { l: 'KeyA', r: 'KeyD', j: 'KeyW', d: 'KeyS', a: 'KeyF', abi: 'KeyE', sw: 'KeyR' },
      C.p2 || { l: 'ArrowLeft', r: 'ArrowRight', j: 'ArrowUp', d: 'ArrowDown', a: 'KeyL', abi: 'KeyK', sw: 'KeyJ' }
    ];
    netLocalSlot = cfg.localSlot != null ? cfg.localSlot : null;
    remoteIn = []; padPrev = [];
    humans.forEach((f, i) => {
      f.slot = i;
      f.local = netLocalSlot == null || i === netLocalSlot;
      const kset = netLocalSlot != null && i === netLocalSlot ? KMAP[0] : KMAP[i];
      f.keys = f.local ? (kset || null) : null;
      if (!f.local) f.touch = null;
    });

    if (spawnOverride) {
      F.forEach((f, i) => {
        const sp = spawnOverride[i] || spawnOverride[0];
        if (sp) { f.x = clamp(sp.x, 30, W - 30); f.y = Math.max(40, sp.y - 60); }
      });
    }
    buildTouch();
    active = true; running = true; paused = false;
    if (G.audio) {
      G.audio.duck(false);
      G.audio.music(mode === 'boss' ? 'boss' : (mode === 'targets' ? 'menu' : 'battle'));
    }
    if (onPauseChange) onPauseChange(false);
  };

  function spawnWave(n) {
    wave = n;
    // pulizia dei cadaveri della ondata precedente, non durante l'ondata
    F = F.filter(f => !f.dead);
    const types = [
      { n: 'ZOMBIE', c: '#8ac46a', s: 1 },
      { n: 'NINJA', c: '#7a8fb5', s: 1 },
      { n: 'SCHIELETRO', c: '#e8e0c0', s: 1.05 },
      { n: 'FANTASMA', c: '#b9a8ff', s: 1 },
      { n: 'TITANO', c: '#ff9a6a', s: 1.45 }
    ];
    const count = Math.min(6, 1 + Math.floor(n * .9));
    const heroXs = F.filter(f => f.team === 1).map(f => f.x);
    for (let i = 0; i < count; i++) {
      const t = pick(types);
      const enemies = F.filter(f => f.team === 2 && !f.dead).length;
      if (enemies + F.filter(f => f.team === 1 && !f.dead).length >= 8) break;
      const candidates = [.12, .22, .78, .88].map(k => Math.round(worldW * k));
      let sx = pick(candidates);
      for (let k = 0; k < 4; k++) {
        if (heroXs.every(hx => Math.abs(hx - sx) > 230)) break;
        sx = pick(candidates);
      }
      F.push(mk({
        team: 2, name: t.n, color: t.c, color2: '#1a1a1a', weapon: pick(G.WLIST),
        hp: 40 + n * 10, s: t.s, x: sx + rnd(-20, 20), y: -70 - i * 90,
        diff: n < 3 ? 'easy' : n < 6 ? 'normal' : 'hard', head: pick(['none', 'skull', 'ninja', 'helm'])
      }));
    }
    banner = 'ONDATA ' + n; bannerSub = count + ' nemici'; bannerT = 1.5;
    burst(W / 2, 120, 20, '#ff8a75', 300);
    for (const f of F) if (f.team === 1 && !f.dead) { f.hp = Math.min(f.maxhp, f.hp + 18); f.shield = 0; }
  }

  /* ---------------- turni ---------------- */
  function endRound(winner) {
    if (state !== 'fight') return;
    state = 'ko'; koT = 3.2; lock = true;
    slowT = 1.2;
    let label = winner ? winner.name + ' vince il round' : 'Pareggio';
    if (winner) {
      const k = winner.teamKey || winner.id;
      wins[k] = (wins[k] || 0) + 1;
      const mates = F.filter(f => (f.teamKey || f.id) === k).length;
      if (mates > 1) label = 'SQUADRA ' + (winner.name || '') + ' vince il round';
    }
    banner = 'K.O.'; bannerSub = label; bannerT = koT + .5;
    sfx(240, .5, 'triangle', .07, 520);
  }

  function afterKO() {
    if (mode === 'lastman') {
      const w = F.filter(f => !f.dead && f.team < 10)[0];
      finish(w && w.human ? 'win' : 'lose');
      return;
    }
    let champ = null;
    for (const f of F) if ((wins[f.teamKey || f.id] || 0) >= winsNeeded) champ = f;
    if (champ) { finish(champ.human || champ.team === 1 ? 'win' : 'lose', champ); return; }
    if (round >= 9) { finish('draw'); return; }
    round++; startRound();
  }

  function startRound() {
    // mappa casuale: ogni round un'arena diversa
    if (randomMaps) {
      const pool = G.MAPS.filter(m => !mapDef || m.id !== mapDef.id);
      const nm = pool[Math.floor(Math.random() * pool.length)] || G.MAPS[0];
      mapDef = nm;
      buildMap(nm);
      camX = 0; camY = 0;
    }
    projs = []; rings = []; beams = []; floats = []; parts = []; pickups = []; pickupT = 1.2;
    const ps = F.filter(f => !f.dead);
    const pos = spawnPositions(F.length);
    F.forEach((f, i) => {
      f.hp = f.maxhp; f.dead = false; f.rag = null; f.deadT = 0;
      f.x = spawnOverride && spawnOverride[i] ? spawnOverride[i].x : (pos[i] != null ? pos[i] : 300); f.y = 300;
      f.vx = 0; f.vy = 0; f.stun = 0; f.cd = 0; f.abiCd = 0; f.atkT = -1;
      f.face = f.x > W / 2 ? -1 : 1; f.shield = 0; f.block = false;
      f.ground = false; f.trail = [];
      if (skyW) { f.weapon = 'fist'; f.alt = 'fist'; }
      if (MODS().mirror && F[0]) f.weapon = F[0].weapon;
      if (MODS().nohealth) f.hp = f.maxhp = 9999;
    });
    timeLeft = 60;
    state = 'intro'; introT = 1.1; lock = true;
    banner = 'ROUND ' + round; bannerSub = ''; bannerT = 1.3;
    slowT = 0;
  }

  function checkEnd() {
    if (mode === 'battle') {
      const al = alive();
      const teams = new Set(al.map(f => f.teamKey || f.id));
      if (teams.size <= 1) endRound(al[0] || null);
    } else if (mode === 'survival') {
      const heroes = F.filter(f => f.team === 1);
      if (heroes.length && heroes.every(f => f.dead)) { finish('lose'); return; }
      const enemies = F.filter(f => f.team === 2 && !f.dead);
      if (!enemies.length && !wavePending) { wavePending = true; waveDelay = 1.6; banner = 'ONDATA COMPLETATA'; bannerSub = '+' + (10 + wave * 3) + ' monete'; bannerT = 1.6; }
    } else if (mode === 'boss') {
      const boss = F.find(f => f.team === 2);
      const heroes = F.filter(f => f.team === 1);
      if (boss && boss.dead) finish('win');
      else if (heroes.every(f => f.dead)) finish('lose');
    } else if (mode === 'targets') {
      if (timeLeft <= 0) finish('score');
    }
  }

  function finish(result, champ) {
    if (endSent) return;
    endSent = true; running = false; state = 'end'; lock = true; paused = false;
    if (onPauseChange) onPauseChange(false);
    let coins = 0, xp = 0;
    if (mode === 'targets') { coins = Math.round(score * 1.5) + 5; xp = score * 3 + 10; }
    else if (mode === 'survival') { coins = 20 + wave * 8 + kills * 2; xp = 25 + wave * 10; }
    else if (mode === 'boss') {
      if (result === 'win') { coins = 120 + (cfg.bossTier || 0) * 30; xp = 120; }
      else { coins = 10; xp = 25; }
    } else {
      const won = result === 'win';
      coins = won ? 7 : 3; xp = won ? 45 : 15;
    }
    onEnd && onEnd({
      result, mode, champ: champ || null,
      coins, xp, score, wave, kills,
      round, wins,
      fighters: F.map(f => ({ name: f.name, color: f.color, human: f.human, dead: f.dead, kills: f.kills, hp: f.hp, maxhp: f.maxhp }))
    });
    banner = result === 'win' ? 'VITTORIA!' : result === 'lose' ? 'SCONFITTA' : 'FINE';
    bannerSub = ''; bannerT = 1e9;
  }

  /* ---------------- pause / quit ---------------- */
  E.pause = function (v) {
    if (!active) return;
    paused = !!v;
    if (G.audio) G.audio.duck(paused);
    if (onPauseChange) onPauseChange(paused);
  };
  E.togglePause = function () { E.pause(!paused); };
  E.isPaused = () => paused;
  E.isPlaying = () => active && running;
  E.quit = function () {
    active = false; running = false; paused = false; state = 'idle';
    if (tLayer) tLayer.innerHTML = '';
    humans = []; F = [];
    if (G.audio) { G.audio.duck(false); G.audio.music('menu'); }
    if (onPauseChange) onPauseChange(false);
  };
  E.setSound = function (v) { soundOn = !!v; if (G.audio) G.audio.setEnabled(soundOn); };
  E.tick = function (dt) {
    if (!active || paused) return;
    step(dt || (1 / 60));
    syncTouch();
    draw();
  };
  E.sim = function (secs) {
    if (!active || paused) return;
    const n = Math.round((secs || 1) * 60);
    for (let i = 0; i < n; i++) step(1 / 60);
    syncTouch(); draw();
  };
  E.debug = function () {
    return {
      state, running, paused, active, lock, mode, slowT, round, timeLeft,
      camX: Math.round(camX), camY: Math.round(camY), worldW, worldH, pickups: pickups.length,
      map: mapDef ? mapDef.id : null, bg: bgStyle, spec: specF ? specF.name : null,
      n: F.length,
      mv: plats.filter(p => p.mover).map(p => ({ x: Math.round(p.x), y: Math.round(p.y), axis: p.mover.axis })),
      pv: projs.slice(0, 4).map(p => ({ x: Math.round(p.x), vx: Math.round(p.vx), type: p.type })),
      f: F.map(x => ({ n: x.name, w: x.weapon, x: Math.round(x.x), y: Math.round(x.y), vy: Math.round(x.vy), ground: x.ground, dead: x.dead, hp: Math.round(x.hp), team: x.team, ragY: x.rag ? Math.round(x.rag.pts.hip.y) : null }))
    };
  };
  E.setEndHandler = fn => { onEnd = fn; };
  E.setRemoteInput = function (slot, inp) { if (inp) remoteIn[slot] = inp; };

  E.netSnapshot = function () {
    return {
      state: state, round: round, time: timeLeft,
      banner: banner, bannerSub: bannerSub, bannerT: bannerT,
      f: F.map(f => ({
        x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10,
        vx: Math.round(f.vx), vy: Math.round(f.vy),
        hp: Math.round(f.hp), maxhp: f.maxhp, dead: f.dead, face: f.face,
        weapon: f.weapon, atkT: f.atkT, ground: f.ground, shield: f.shield
      })),
      pr: projs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), type: p.type, r: p.r })),
      pk: pickups.map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) }))
    };
  };
  E.applyNetState = function (s) {
    if (!s) return;
    state = s.state || state;
    round = s.round || round;
    timeLeft = s.time != null ? s.time : timeLeft;
    banner = s.banner || banner; bannerSub = s.bannerSub || '';
    if (s.bannerT != null) bannerT = s.bannerT;
    for (let i = 0; i < s.f.length && i < F.length; i++) F[i].net = s.f[i];
    // le armi a terra arrivano dall'host: il client non simula i bottini
    if (s.pk) pickups = s.pk.map(p => ({ id: p.id, x: p.x, y: p.y, vy: 0, spin: 0, landed: true, dead: false }));
    projs = (s.pr || []).map(p => ({
      x: p.x, y: p.y, nx: p.x, ny: p.y,
      type: p.type, r: p.r || 5, own: null, life: 1, hitSet: new Set()
    }));
  };
  E.getInput = function (slot) {
    const f = F[slot];
    if (!f) return null;
    const i = f._netIn || f.in;
    return { l: i.l, r: i.r, j: i.j, d: i.d, a: i.a, abi: i.abi, sw: i.sw };
  };
  E.setPauseHandler = fn => { onPauseChange = fn; E.onPauseChange = fn; };

  /* ---------------- touch ---------------- */
  function buildTouch() {
    if (!tLayer) return;
    tLayer.innerHTML = '';
    tLayer.classList.toggle('solo', humans.filter(f => f.local !== false).length === 1);
    humans.filter(f => f.local !== false).forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'ctrl';
      el.dataset.slot = i;
      el.style.setProperty('--c', f.color);
      el.innerHTML =
        '<div class="stick"><div class="ring"></div><div class="knob"></div></div>' +
        '<div class="acts">' +
        '<button class="ab atk" aria-label="Attacco">⚔</button>' +
        '<button class="ab abi" aria-label="Abilità">✦<span class="cd"></span></button>' +
        '</div>';
      tLayer.appendChild(el);
      const stick = el.querySelector('.stick');
      const knob = el.querySelector('.knob');
      const cd = el.querySelector('.cd');
      const t = { l: 0, r: 0, j: 0, d: 0, a: 0, abi: 0, sw: 0, active: false, id: null };
      f.touch = t;
      let cx = 0, cy = 0, R = 1;

      const apply = (nx, ny) => {
        const mag = Math.hypot(nx, ny);
        const clamped = Math.min(mag, 1);
        const kx = mag > 0 ? nx / mag * clamped : 0;
        const ky = mag > 0 ? ny / mag * clamped : 0;
        knob.style.transform = 'translate(-50%,-50%) translate(' + (kx * 26) + 'px,' + (ky * 26) + 'px)';
        t.l = kx < -.28 ? 1 : 0;
        t.r = kx > .28 ? 1 : 0;
        t.j = ky < -.38 ? 1 : 0;
        t.d = ky > .42 ? 1 : 0;
        return Math.hypot(kx, ky);
      };
      const reset = () => {
        t.l = t.r = t.j = t.d = 0; t.active = false; t.id = null;
        knob.style.transform = 'translate(-50%,-50%)';
      };
      const fireAbi = () => {
        if (cfg && cfg.netClient) t.abi = 1;
        else doAbility(f);
      };
      stick.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        const r = stick.getBoundingClientRect();
        cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2;
        t.active = true; t.id = ev.pointerId;
        try { stick.setPointerCapture(ev.pointerId); } catch (e) {}
        apply((ev.clientX - cx) / R, (ev.clientY - cy) / R);
      });
      stick.addEventListener('pointermove', ev => {
        if (!t.active || ev.pointerId !== t.id) return;
        ev.preventDefault();
        apply((ev.clientX - cx) / R, (ev.clientY - cy) / R);
      });
      stick.addEventListener('pointerup', ev => {
        if (t.active && Math.abs(ev.clientX - cx) + Math.abs(ev.clientY - cy) > R * .5) fireAbi();
        reset();
      });
      stick.addEventListener('pointercancel', reset);
      stick.addEventListener('lostpointercapture', reset);
      stick.addEventListener('contextmenu', e => e.preventDefault());

      const atk = el.querySelector('.atk');
      atk.addEventListener('pointerdown', ev => { ev.preventDefault(); t.a = 1; try { atk.setPointerCapture(ev.pointerId); } catch (e) {} });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => atk.addEventListener(ev, () => { t.a = 0; }));
      atk.addEventListener('contextmenu', e => e.preventDefault());

      const abi = el.querySelector('.abi');
      abi.addEventListener('pointerdown', ev => { ev.preventDefault(); fireAbi(); });
      abi.addEventListener('contextmenu', e => e.preventDefault());

      f._cdEl = cd;
    });
  }

  function syncTouch() {
    for (const f of humans) {
      if (!f._cdEl) continue;
      const w = WP[f.weapon];
      const p = clamp(f.abiCd / w.acd, 0, 1);
      f._cdEl.style.transform = 'scaleY(' + p + ')';
      if (f._cdEl.parentElement) f._cdEl.parentElement.style.opacity = f.abiCd > 0 ? .55 : 1;
    }
  }

  /* ---------------- input tastiera ---------------- */
  function onKey(e) {
    if (!active) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = 1;
    if (e.code === 'Escape' && running) E.togglePause();
  }
  function onKeyUp(e) { keys[e.code] = 0; }

  /* ---------------- loop ---------------- */
  function step(dt) {
    if (cfg && cfg.netClient) { stepNetClient(dt); return; }
    updateMovers(dt);
    if (slowT > 0) slowT -= dt;
    const sdt = slowT > 0 ? dt * .32 : dt;
    if (shake > 0) shake *= Math.pow(.004, dt);
    if (flash > 0) flash -= dt;
    if (bannerT > 0) bannerT -= dt;

    if (mode === 'targets') timeLeft -= dt;

    if (state === 'intro') {
      introT -= dt;
      if (introT <= 0) { state = 'fight'; lock = false; banner = 'VIA!'; bannerT = .7; bannerSub = ''; }
    } else if (state === 'ko') {
      koT -= dt;
      if (koT <= 0) { afterKO(); return; }
    } else if (state === 'fight') {
      if (mode === 'battle' || mode === 'lastman') {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          const al = alive();
          al.sort((a, b) => b.hp - a.hp);
          endRound(al[0] || null);
        }
      }
    }

    if (state !== 'end') {
      for (const f of F) updateFighter(f, sdt);
      updateProjs(sdt); updateRings(sdt); updateBeams(sdt); updateTargets(sdt); updatePickups(sdt);
      for (const p of parts) { p.vy += p.grav * sdt; p.x += p.vx * sdt; p.y += p.vy * sdt; p.life -= sdt; }
      parts = parts.filter(p => p.life > 0);
      for (const fl of floats) { fl.y -= 60 * sdt; fl.life -= sdt; }
      floats = floats.filter(fl => fl.life > 0);
      if (mode === 'lastman' && state === 'fight') {
        const hum = F.filter(f => f.team < 10 && !f.dead);
        const others = F.filter(f => f.team >= 10 && !f.dead);
        if (!hum.length || !others.length) finish(hum.length ? 'win' : 'lose');
      }
      if (checkEnd && state === 'fight') checkEnd();
      if (mode === 'survival' && wavePending) {
        waveDelay -= sdt;
        if (waveDelay <= 0) { wavePending = false; spawnWave(wave + 1); }
      }
      if (mode === 'battle' && MODS().gravity) {
        gravT -= sdt;
        if (gravT <= 0) { gravT = 2.2; gravityMod = rnd(.5, 1.7); flash = .2; }
      }
      E.time = gameT;
    }
    updateCamera(dt);
  }

  function stepNetClient(dt) {
    gameT += dt;
    if (bannerT > 0) bannerT -= dt;
    if (slowT > 0) slowT -= dt * 2;
    // il client non simula la fisica ma deve comunque leggere i comandi locali
    for (const f of F) {
      if (f.cpu || f.local === false) continue;
      readInput(f, dt);
      f._netIn = { l: f.in.l, r: f.in.r, j: f.in.j, d: f.in.d, a: f.in.a, abi: f.in.abi, sw: f.in.sw };
      f.in.abi = 0; f.in.sw = 0;
    }
    for (const f of F) {
      const t = f.net;
      if (t) {
        const k = Math.min(1, 14 * dt);
        f.x += (t.x - f.x) * k;
        f.y += (t.y - f.y) * k;
        f.vx = t.vx || 0; f.vy = t.vy || 0;
        f.face = t.face || f.face;
        f.ground = !!t.ground;
        f.hp = t.hp; f.maxhp = t.maxhp || f.maxhp;
        f.shield = t.shield || 0;
        f.dead = !!t.dead;
        if (t.weapon && WP[t.weapon]) { f.weapon = t.weapon; f.alt = 'fist'; }
        f.atkT = t.atkT != null ? t.atkT : -1;
        if (f.dead) {
          f.deadT += dt;
          if (!f.rag) f.rag = makeRag(f, 0, -120);
          stepRag(f.rag, dt);
        } else { f.rag = null; f.deadT = 0; f.walk += Math.abs(f.vx) * dt * .055; }
      }
    }
    for (const p of projs) { p.x += (p.nx != null ? (p.nx - p.x) * .3 : 0); p.y += (p.ny != null ? (p.ny - p.y) * .3 : 0); p.life = 1; }
    for (const r of rings) r.life -= dt;
    rings = rings.filter(r => r.life > 0);
    for (const p of parts) { p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    updateCamera(dt);
  }

  function updateCamera(dt) {
    const local = humans.filter(f => !f.dead && (netLocalSlot == null || f.slot === netLocalSlot))[0];
    let focus = local;
    if (!focus) {
      // giocatore morto: si guarda la partita dalla visuale di un bot ancora vivo
      if (!specF || specF.dead) {
        const alive = F.filter(f => !f.dead);
        specF = alive.filter(f => f.cpu)[0] || alive[0] || null;
      }
      focus = specF || humans.filter(f => !f.dead)[0] || humans[0] || F[0];
    }
    let fx = worldW / 2, fy = worldH / 2;
    if (focus) { fx = focus.x; fy = focus.y; }
    const tx = clamp(fx - W / 2, 0, Math.max(0, worldW - W));
    const ty = clamp(fy - H * .58, 0, Math.max(0, worldH - H));
    camX += (tx - camX) * Math.min(1, 9 * dt);
    camY += (ty - camY) * Math.min(1, 9 * dt);
  }

  /* ---------------- disegno ---------------- */
  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawBg() {
    const sky = g.createLinearGradient(0, 0, 0, LIQUID);
    sky.addColorStop(0, theme.sky[0]); sky.addColorStop(1, theme.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, worldW, worldH);
    // sole
    g.fillStyle = 'rgba(255,255,255,.16)';
    const px = camX * .45;
    g.beginPath(); g.arc(worldW * .78 + px * .5, 110, 60, 0, TAU); g.fill();
    // sfondo dedicato al livello (parallasse)
    if (bgStyle === 'forest') {
      g.fillStyle = theme.far;
      for (let i = 0; i < 12; i++) {
        const bx = ((i * 190 + 40 - px) % (worldW + 260) + worldW + 260) % (worldW + 260) - 130;
        const bh = 90 + (i % 4) * 40;
        g.beginPath(); g.moveTo(bx - 80, LIQUID); g.lineTo(bx, LIQUID - bh); g.lineTo(bx + 80, LIQUID); g.closePath(); g.fill();
      }
      g.fillStyle = theme.ground;
      for (let i = 0; i < 16; i++) {
        const bx = ((i * 150 + 30 - px * .7) % (worldW + 200) + worldW + 200) % (worldW + 200) - 100;
        g.fillRect(bx, LIQUID - 70, 10, 70);
        g.beginPath(); g.moveTo(bx - 42, LIQUID - 68); g.lineTo(bx + 5, LIQUID - 150); g.lineTo(bx + 52, LIQUID - 68); g.closePath(); g.fill();
      }
    } else if (bgStyle === 'volcano') {
      g.fillStyle = theme.far;
      for (let i = 0; i < 8; i++) {
        const bx = ((i * 260 + 80 - px) % (worldW + 320) + worldW + 320) % (worldW + 320) - 160;
        g.beginPath(); g.moveTo(bx - 150, LIQUID); g.lineTo(bx, LIQUID - 230 - (i % 3) * 40); g.lineTo(bx + 150, LIQUID); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(255,120,40,.35)';
      g.fillRect(0, LIQUID - 4, worldW, 8);
    } else if (bgStyle === 'ice') {
      g.fillStyle = theme.far;
      for (let i = 0; i < 9; i++) {
        const bx = ((i * 230 + 60 - px) % (worldW + 300) + worldW + 300) % (worldW + 300) - 150;
        const bh = 150 + (i % 4) * 50;
        g.beginPath(); g.moveTo(bx - 130, LIQUID); g.lineTo(bx, LIQUID - bh); g.lineTo(bx + 130, LIQUID); g.closePath(); g.fill();
        g.fillStyle = 'rgba(240,250,255,.7)';
        g.beginPath(); g.moveTo(bx, LIQUID - bh); g.lineTo(bx - 30, LIQUID - bh + 55); g.lineTo(bx + 30, LIQUID - bh + 55); g.closePath(); g.fill();
        g.fillStyle = theme.far;
      }
    } else if (bgStyle === 'ruins') {
      g.fillStyle = theme.far;
      for (let i = 0; i < 10; i++) {
        const bx = ((i * 210 + 50 - px) % (worldW + 260) + worldW + 260) % (worldW + 260) - 120;
        const bh = 90 + (i % 5) * 35;
        g.fillRect(bx, LIQUID - bh, 26, bh);
        g.fillRect(bx - 14, LIQUID - bh - 12, 54, 12);
        g.fillRect(bx + 54, LIQUID - bh * .7, 20, bh * .7);
        g.fillRect(bx - 32, LIQUID - bh * .55, 20, bh * .55);
      }
      g.fillStyle = 'rgba(255,210,140,.16)';
      g.beginPath(); g.arc(worldW * .35 + px * .3, 120, 34, 0, TAU); g.fill();
    } else if (bgStyle === 'ocean') {
      g.fillStyle = theme.far;
      for (let i = 0; i < 7; i++) {
        const bx = ((i * 280 + 90 - px) % (worldW + 340) + worldW + 340) % (worldW + 340) - 170;
        const ss = 40 + (i % 3) * 20;
        g.fillRect(bx, LIQUID - 30, ss * 1.8, 10);
        g.beginPath(); g.moveTo(bx + ss * .4, LIQUID - 30); g.lineTo(bx + ss * .8, LIQUID - 90); g.lineTo(bx + ss * .9, LIQUID - 30); g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const yy = LIQUID - 80 + i * 16;
        g.beginPath(); g.moveTo(0, yy);
        for (let x = 0; x <= worldW; x += 40) g.lineTo(x, yy + Math.sin((x + gameT * 25 + i * 60) / 90) * 4);
        g.stroke();
      }
    } else {
      g.fillStyle = theme.far;
      for (const b of bgCity) {
        g.fillRect(b.x + px, LIQUID - b.h, b.w, b.h);
        g.fillStyle = 'rgba(255,220,140,' + (.10 + b.lit * .16) + ')';
        for (let y = LIQUID - b.h + 12; y < LIQUID - 14; y += 24) {
          for (let x = b.x + px + 8; x < b.x + px + b.w - 8; x += 18) {
            if (((x * 7 + y * 3) | 0) % 5 === 0) g.fillRect(x, y, 6, 8);
          }
        }
        g.fillStyle = theme.far;
      }
    }
    // liquido
    const liq = theme.liquid || '#123a63';
    const lg = g.createLinearGradient(0, LIQUID - 10, 0, worldH);
    lg.addColorStop(0, liq); lg.addColorStop(1, shade(liq, -.45));
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(0, LIQUID + 6);
    for (let x = 0; x <= worldW; x += 24) g.lineTo(x, LIQUID + 6 + Math.sin((x + gameT * 40) / 60) * 4);
    g.lineTo(worldW, worldH); g.lineTo(0, worldH); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= worldW; x += 24) {
      const y = LIQUID + 6 + Math.sin((x + gameT * 40) / 60) * 4;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    // pulviscolo / braci / neve
    const mote = theme.liquidName === 'lava' ? '255,150,60' : (theme.sky && theme.sky[1] === '#a8d8e8' ? '255,255,255' : '185,220,255');
    for (const a of ambient) {
      const ax = ((a.x + gameT * 18 * a.sp) % worldW + worldW) % worldW;
      const ay = ((a.y - gameT * 22 * a.sp) % Math.max(1, LIQUID - 30) + Math.max(1, LIQUID - 30)) % Math.max(1, LIQUID - 30);
      g.fillStyle = 'rgba(' + mote + ',' + (.1 + a.a * .3) + ')';
      g.beginPath(); g.arc(ax, ay + 10, a.s, 0, TAU); g.fill();
    }
    // piattaforme
    for (const p of plats) {
      g.fillStyle = theme.ground;
      rr(p.x, p.y, p.w, 26, 6); g.fill();
      g.fillStyle = theme.top;
      rr(p.x, p.y, p.w, 9, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.fillRect(p.x + 4, p.y + 1, p.w - 8, 2);
      if (p.mover) {
        g.fillStyle = 'rgba(255,210,74,.5)';
        g.fillRect(p.x + p.w / 2 - 10, p.y + 13, 20, 4);
      }
    }
    // trappole
    for (const s of spikes) {
      g.fillStyle = '#9aa7c2';
      const n = Math.max(1, Math.floor(s.w / 22));
      for (let i = 0; i < n; i++) {
        const x = s.x + i * (s.w / n);
        g.beginPath(); g.moveTo(x, s.y + s.h); g.lineTo(x + (s.w / n) / 2, s.y); g.lineTo(x + s.w / n, s.y + s.h); g.closePath(); g.fill();
      }
    }
  }

  function shade(hex, amt) {
    try {
      const c = hex.replace('#', '');
      let r = parseInt(c.substr(0, 2), 16), gg = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
      const f = v => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
      return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
    } catch (e) { return hex; }
  }

  function drawWeapon(f, h, dx, dy) {
    const w = WP[f.weapon];
    if (w.shape === 'fist' || !w.shape) {
      g.fillStyle = f.color2; g.beginPath(); g.arc(h.x, h.y, 5.5 * f.s, 0, TAU); g.fill();
      return;
    }
    const L = (w.len || 34) * f.s * (f.giant ? 1.6 : 1);
    const nx = -dy, ny = dx;
    const P = (k, o) => ({ x: h.x + dx * k + nx * o, y: h.y + dy * k + ny * o });
    const line = (a, b, col, wd) => {
      g.strokeStyle = col; g.lineWidth = wd;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    };
    g.lineCap = 'round';
    switch (w.shape) {
      case 'blade':
        line(P(-8, 0), P(L, 0), w.col, 4 * f.s);
        line(P(8, -9), P(8, 9), '#8fa0c4', 4 * f.s);
        break;
      case 'laser':
        g.save(); g.shadowColor = w.col; g.shadowBlur = 14;
        line(P(-8, 0), P(L, 0), w.col, 5 * f.s);
        g.restore();
        line(P(6, -8), P(6, 8), '#555', 4 * f.s);
        break;
      case 'hammer':
        line(P(-6, 0), P(L * .8, 0), '#7a5230', 5 * f.s);
        g.save(); g.translate(P(L * .82, 0).x, P(L * .82, 0).y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = w.col; g.fillRect(-8 * f.s, -14 * f.s, 16 * f.s, 28 * f.s);
        g.restore();
        break;
      case 'axe':
        line(P(-6, 0), P(L, 0), '#7a5230', 5 * f.s);
        g.fillStyle = w.col; g.beginPath();
        { const a = P(L + 4, 0), b = P(L - 20, -18), c = P(L - 20, 12); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.closePath(); g.fill(); }
        break;
      case 'scythe':
        line(P(-20, 0), P(L * .7, 0), '#6a4a2a', 4 * f.s);
        g.strokeStyle = w.col; g.lineWidth = 4 * f.s;
        g.beginPath();
        { const c = P(L * .7, 0); g.arc(c.x, c.y, L * .3, -.4, 1.9); }
        g.stroke();
        break;
      case 'spear':
      case 'trident':
        line(P(-26, 0), P(L - 26, 0), '#8a6a3a', 4 * f.s);
        g.fillStyle = w.col;
        if (w.shape === 'spear') {
          const a = P(L - 26, 0), b = P(L - 40, 7), c = P(L - 40, -7);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.closePath(); g.fill();
        } else {
          for (const o of [-9, 0, 9]) {
            const a = P(L - 26, o), b = P(L - 44, o - 4), c = P(L - 44, o + 4);
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.closePath(); g.fill();
          }
        }
        break;
      case 'shield':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = w.col; rr(-4 * f.s, -18 * f.s, 12 * f.s, 36 * f.s, 5 * f.s); g.fill();
        g.strokeStyle = '#2a3a63'; g.lineWidth = 2; g.stroke();
        g.restore();
        break;
      case 'boot':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = w.col; g.fillRect(-6 * f.s, -7 * f.s, 20 * f.s, 14 * f.s);
        g.fillStyle = '#5a3820'; g.fillRect(8 * f.s, -9 * f.s, 8 * f.s, 18 * f.s);
        g.restore();
        break;
      case 'gun':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = w.col; g.fillRect(-6 * f.s, -5 * f.s, 26 * f.s, 8 * f.s);
        g.fillRect(-6 * f.s, 2 * f.s, 8 * f.s, 10 * f.s);
        g.fillStyle = '#6b7488'; g.fillRect(16 * f.s, -5 * f.s, 6 * f.s, 3 * f.s);
        g.restore();
        break;
      case 'longgun':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = w.col; g.fillRect(-14 * f.s, -4 * f.s, 46 * f.s, 7 * f.s);
        g.fillStyle = '#222'; g.fillRect(20 * f.s, -6 * f.s, 18 * f.s, 4 * f.s);
        g.fillStyle = '#6b7488'; g.fillRect(-2 * f.s, -10 * f.s, 12 * f.s, 4 * f.s);
        g.restore();
        break;
      case 'bow':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx));
        g.strokeStyle = w.col; g.lineWidth = 3 * f.s;
        g.beginPath(); g.arc(6 * f.s, 0, 22 * f.s, -1.1, 1.1); g.stroke();
        g.strokeStyle = '#e8e8e8'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(14 * f.s, -19 * f.s); g.lineTo(14 * f.s, 19 * f.s); g.stroke();
        g.restore();
        break;
      case 'bazooka':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = w.col; g.fillRect(-16 * f.s, -8 * f.s, 42 * f.s, 16 * f.s);
        g.fillStyle = '#222'; g.fillRect(22 * f.s, -9 * f.s, 8 * f.s, 18 * f.s);
        g.restore();
        break;
      case 'boomerang':
        g.save(); g.translate(h.x, h.y); g.rotate(Math.atan2(dy, dx) + gameT * 6);
        g.strokeStyle = w.col; g.lineWidth = 6 * f.s;
        g.beginPath(); g.arc(0, 0, 13 * f.s, -.4, 2.2); g.stroke();
        g.restore();
        break;
      case 'shuriken':
        g.save(); g.translate(h.x, h.y); g.rotate(gameT * 10);
        g.fillStyle = w.col;
        for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -4 * f.s); g.lineTo(10 * f.s, 0); g.lineTo(0, 4 * f.s); g.closePath(); g.fill(); }
        g.restore();
        break;
      case 'snowball':
        g.fillStyle = w.col; g.beginPath(); g.arc(h.x + dx * 10, h.y + dy * 10, 8 * f.s, 0, TAU); g.fill();
        break;
      case 'bomb':
        g.fillStyle = '#2f3542'; g.beginPath(); g.arc(h.x + dx * 10, h.y + dy * 10, 9 * f.s, 0, TAU); g.fill();
        g.strokeStyle = '#ffd24a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(h.x + dx * 12, h.y + dy * 12 - 8); g.lineTo(h.x + dx * 16, h.y + dy * 16 - 16); g.stroke();
        break;
      case 'staff':
        line(P(-10, 0), P(L, 0), w.col, 5 * f.s);
        g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(P(L, 0).x, P(L, 0).y, 5 * f.s, 0, TAU); g.fill();
        break;
      case 'orb':
        g.save(); g.shadowColor = w.col; g.shadowBlur = 16;
        g.fillStyle = w.col; g.beginPath(); g.arc(h.x + dx * 12, h.y + dy * 12, 8 * f.s, 0, TAU); g.fill();
        g.restore();
        break;
      case 'grapple':
        g.strokeStyle = w.col; g.lineWidth = 3 * f.s;
        g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(h.x + dx * 24, h.y + dy * 24); g.stroke();
        g.beginPath(); g.arc(h.x + dx * 30, h.y + dy * 30, 6 * f.s, .4, 2.6); g.stroke();
        break;
      case 'gauntlet':
        g.fillStyle = w.col; rr(h.x - 6 * f.s, h.y - 8 * f.s, 18 * f.s, 16 * f.s, 4 * f.s); g.fill();
        g.strokeStyle = '#7a4fd0'; g.lineWidth = 2; g.stroke();
        break;
      default:
        line(P(-6, 0), P(L, 0), w.col, 5 * f.s);
    }
  }

  function partColors(f) {
    const sk = f.skin || {};
    return {
      torso: sk.torso || f.color,
      head: sk.head || f.color,
      arm: sk.arm || f.color2,
      leg: sk.leg || f.color2
    };
  }

  function drawHat(f, head) {
    const s = f.s, r = 11 * s;
    g.save(); g.translate(head.x, head.y - r * .9);
    switch (f.head) {
      case 'crown':
        g.fillStyle = '#ffd24a';
        g.beginPath();
        g.moveTo(-11 * s, 0); g.lineTo(-11 * s, -10 * s); g.lineTo(-5 * s, -4 * s); g.lineTo(0, -13 * s); g.lineTo(5 * s, -4 * s); g.lineTo(11 * s, -10 * s); g.lineTo(11 * s, 0);
        g.closePath(); g.fill();
        g.strokeStyle = '#a97a08'; g.lineWidth = 1.5; g.stroke();
        break;
      case 'tophat':
        g.fillStyle = '#141414';
        g.fillRect(-12 * s, -2 * s, 24 * s, 4 * s);
        g.fillRect(-7 * s, -20 * s, 14 * s, 18 * s);
        g.fillStyle = '#c33'; g.fillRect(-7 * s, -8 * s, 14 * s, 3 * s);
        break;
      case 'helm':
        g.fillStyle = '#9aa7c2';
        g.beginPath(); g.arc(0, -2 * s, 12 * s, Math.PI, 0); g.fill();
        g.fillRect(-12 * s, -2 * s, 24 * s, 4 * s);
        g.fillStyle = '#5a6a86'; g.fillRect(-2 * s, -14 * s, 4 * s, 12 * s);
        break;
      case 'skull':
        g.fillStyle = '#e8e0c0';
        g.beginPath(); g.arc(0, -4 * s, 11 * s, 0, TAU); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(-4 * s, -5 * s, 3 * s, 0, TAU); g.arc(4 * s, -5 * s, 3 * s, 0, TAU); g.fill();
        g.fillRect(-1.5 * s, -2 * s, 3 * s, 5 * s);
        break;
      case 'ninja':
        g.fillStyle = '#1a2233'; g.fillRect(-12 * s, -10 * s, 24 * s, 7 * s);
        g.fillStyle = '#c33'; g.fillRect(-2 * s, -11 * s, 6 * s, 9 * s);
        break;
      case 'cap':
        g.fillStyle = '#2f7ec6';
        g.beginPath(); g.arc(0, -3 * s, 11 * s, Math.PI, 0); g.fill();
        g.fillStyle = '#1d6f96'; g.fillRect(-13 * s, -4 * s, 10 * s, 4 * s);
        break;
      case 'halo':
        g.strokeStyle = '#ffe07a'; g.lineWidth = 3 * s;
        g.beginPath(); g.ellipse(0, -18 * s, 11 * s, 4 * s, 0, 0, TAU); g.stroke();
        break;
      case 'viking':
        g.fillStyle = '#8a6a3a';
        g.beginPath(); g.arc(0, -2 * s, 12 * s, Math.PI, 0); g.fill();
        g.fillStyle = '#e8e0c0';
        g.beginPath(); g.moveTo(-12 * s, -6 * s); g.lineTo(-20 * s, -18 * s); g.lineTo(-12 * s, -12 * s); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(12 * s, -6 * s); g.lineTo(20 * s, -18 * s); g.lineTo(12 * s, -12 * s); g.closePath(); g.fill();
        break;
    }
    g.restore();
  }

  function limb(a, b, c) {
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.stroke();
  }

  function drawFighter(f) {
    if (f.dead) {
      if (!f.rag) return;
      const P = f.rag.pts, c = partColors(f);
      g.lineWidth = 6 * f.s; g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = c.leg; limb(P.hip, P.kB, P.fB); limb(P.hip, P.kA, P.fA);
      g.strokeStyle = c.torso;
      g.beginPath(); g.moveTo(P.hip.x, P.hip.y); g.lineTo(P.neck.x, P.neck.y); g.stroke();
      g.strokeStyle = c.arm; limb(P.neck, P.eB, P.hB); limb(P.neck, P.eF, P.hF);
      g.fillStyle = c.head; g.beginPath(); g.arc(P.head.x, P.head.y, 11 * f.s, 0, TAU); g.fill();
      return;
    }
    const s = skel(f);
    const c = partColors(f);
    const hurt = f.hitT > 0;
    g.lineWidth = 6 * f.s; g.lineCap = 'round'; g.lineJoin = 'round';
    // colore squadra a terra: resta sempre il colore scelto dal giocatore
    g.globalAlpha = .55;
    g.fillStyle = f.color;
    g.beginPath(); g.ellipse(f.x, shadowY(f) + 2, 18 * f.s, 4.5 * f.s, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
    // ombra
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(f.x, shadowY(f), 20 * f.s, 5 * f.s, 0, 0, TAU); g.fill();
    // scia
    if (f.trail.length > 1) {
      g.strokeStyle = WP[f.weapon].col; g.globalAlpha = .3;
      g.lineWidth = 5 * f.s;
      g.beginPath();
      f.trail.forEach((t, i) => i ? g.lineTo(t.x, t.y) : g.moveTo(t.x, t.y));
      g.stroke(); g.globalAlpha = 1;
    }
    g.globalAlpha = .62;
    g.strokeStyle = hurt ? '#fff' : c.leg; limb(s.hip, s.kb, s.fb);
    g.strokeStyle = hurt ? '#fff' : c.arm; limb(s.sh, s.eB, s.hB);
    g.globalAlpha = 1;
    g.strokeStyle = hurt ? '#fff' : c.leg; limb(s.hip, s.ka, s.fa);
    g.strokeStyle = hurt ? '#fff' : c.torso;
    g.beginPath(); g.moveTo(s.hip.x, s.hip.y); g.lineTo(s.neck.x, s.neck.y); g.stroke();
    g.strokeStyle = hurt ? '#fff' : c.arm; limb(s.sh, s.eF, s.hF);
    g.fillStyle = hurt ? '#fff' : c.head;
    g.beginPath(); g.arc(s.head.x, s.head.y, 11 * f.s, 0, TAU); g.fill();
    // occhio
    g.fillStyle = '#0d1322';
    g.beginPath(); g.arc(s.head.x + f.face * 5 * f.s, s.head.y - 2 * f.s, 2.2 * f.s, 0, TAU); g.fill();
    drawHat(f, s.head);
    // seconda arma (Double Trouble)
    if (f.w2 && MODS().double) {
      g.save(); g.globalAlpha = .85;
      g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(s.eB.x, s.eB.y, WP[f.w2].shape === 'fist' ? 4 : 6, 0, TAU); g.fill();
      g.strokeStyle = '#ffd24a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(s.eB.x, s.eB.y); g.lineTo(s.eB.x + f.face * 26, s.eB.y - 8); g.stroke();
      g.restore();
    }
    drawWeapon(f, s.hF, s.dx, s.dy);
    if (f.w === 'fist') { g.fillStyle = c.arm; g.beginPath(); g.arc(s.hF.x, s.hF.y, 4.5 * f.s, 0, TAU); g.fill(); }
    // scudo
    if (f.shield > 0) {
      g.strokeStyle = 'rgba(140,220,255,' + (0.25 + f.shield / 120) + ')';
      g.lineWidth = 3;
      g.beginPath(); g.arc(f.x, f.y - 46 * f.s, 34 * f.s, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(120,210,255,.10)'; g.fill();
    }
    // boss aura
    if (f.team === 2 && mode === 'boss') {
      g.strokeStyle = 'rgba(255,80,80,' + (.25 + Math.sin(gameT * 4) * .1) + ')';
      g.lineWidth = 4;
      g.beginPath(); g.arc(f.x, f.y - 40 * f.s, 44 * f.s, 0, TAU); g.stroke();
    }
  }

  function shadowY(f) {
    for (const p of plats) if (f.x > p.x && f.x < p.x + p.w && f.y <= p.y + 4) return p.y;
    return LIQUID;
  }

  function drawProjs() {
    for (const p of projs) {
      if (p.type === 'bullet') {
        g.fillStyle = p.own ? '#ffd24a' : '#fff';
        g.fillRect(p.x - 9, p.y - 2, 18, 4);
      } else if (p.type === 'arrow') {
        g.strokeStyle = '#e0c689'; g.lineWidth = 3;
        const a = Math.atan2(p.vy, p.vx);
        g.beginPath(); g.moveTo(p.x - Math.cos(a) * 14, p.y - Math.sin(a) * 14); g.lineTo(p.x, p.y); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 3, 0, TAU); g.fill();
      } else if (p.type === 'boomerang') {
        g.strokeStyle = '#e0a040'; g.lineWidth = 5;
        g.beginPath(); g.arc(p.x, p.y, 9, gameT * 12, gameT * 12 + 3.6); g.stroke();
      } else if (p.type === 'shuriken') {
        g.fillStyle = '#cfd9e8';
        g.beginPath(); g.arc(p.x, p.y, 6, 0, TAU); g.fill();
      } else if (p.type === 'snow') {
        g.fillStyle = '#eaf6ff'; g.beginPath(); g.arc(p.x, p.y, 7, 0, TAU); g.fill();
      } else if (p.type === 'bomb') {
        g.fillStyle = '#2f3542'; g.beginPath(); g.arc(p.x, p.y, 10, 0, TAU); g.fill();
        g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(p.x + 3, p.y - 10, 3, 0, TAU); g.fill();
      } else if (p.type === 'rocket') {
        g.fillStyle = '#7a8a4a'; g.fillRect(p.x - 12, p.y - 4, 24, 8);
        g.fillStyle = '#ffb347'; g.beginPath(); g.arc(p.x - 14, p.y, 6, 0, TAU); g.fill();
      } else if (p.type === 'meteor') {
        g.fillStyle = '#8a5a3a'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
        g.fillStyle = '#ffb347'; g.globalAlpha = .7;
        g.beginPath(); g.arc(p.x, p.y, p.r * .6, 0, TAU); g.fill(); g.globalAlpha = 1;
      } else if (p.type === 'orb') {
        g.save(); g.shadowColor = '#4ef07a'; g.shadowBlur = 14;
        g.fillStyle = '#4ef07a'; g.beginPath(); g.arc(p.x, p.y, 8, 0, TAU); g.fill(); g.restore();
      } else {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      }
    }
  }

  function drawPickups() {
    for (const pk of pickups) {
      const bob = pk.landed ? Math.sin(gameT * 3 + pk.spin) * 3 : 0;
      const w = WP[pk.id];
      g.save();
      g.translate(pk.x, pk.y + bob - 14);
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(0, 24, 26, 6, 0, 0, TAU); g.fill();
      g.shadowColor = w.col; g.shadowBlur = 18;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
      rr(-30, -20, 60, 40, 9); g.fillStyle = 'rgba(8,20,38,.75)'; g.fill(); g.stroke();
      const ico = weaponIconEl(pk.id);
      g.shadowBlur = 0;
      g.drawImage(ico, -26, -16, 52, 32);
      g.restore();
      g.fillStyle = '#fff'; g.font = '700 10px Baloo 2, sans-serif'; g.textAlign = 'center';
      g.fillText(w.n, pk.x, pk.y + 26);
    }
  }

  function drawHUD() {
    const list = F.filter(f => mode === 'survival' ? f.team === 1 : true);
    const n = Math.max(1, list.length);
    const bw = clamp((W - 60) / n - 10, 90, 320);
    list.forEach((f, i) => {
      const x = 30 + i * (bw + 10), y = 14;
      if (!cfg.hideBars) {
        const hp = MODS().nohealth ? 1 : clamp(f.hp / f.maxhp, 0, 1);
        g.fillStyle = 'rgba(4,10,20,.72)'; rr(x, y, bw, 14, 7); g.fill();
        g.fillStyle = f.color; rr(x + 2, y + 2, (bw - 4) * hp, 10, 5); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2; rr(x, y, bw, 14, 7); g.stroke();
      }
      g.fillStyle = '#dce8ff'; g.font = '700 10px Baloo 2, sans-serif'; g.textAlign = 'left';
      g.fillText(f.name, x + 2, y + 26);
      g.fillStyle = 'rgba(220,232,255,.65)';
      g.font = '700 9px Baloo 2, sans-serif'; g.textAlign = 'right';
      g.fillText(WP[f.weapon].n, x + bw - 2, y + 26);
      if (mode === 'battle' || mode === 'lastman') {
        const w = wins[f.teamKey || f.id] || 0;
        for (let k = 0; k < winsNeeded; k++) {
          g.beginPath(); g.arc(x + 7 + k * 12, y + 38, 3.5, 0, TAU);
          g.fillStyle = k < w ? '#ffd24a' : 'rgba(255,255,255,.2)'; g.fill();
        }
      }
    });

    g.textAlign = 'center';
    if (mode === 'survival') {
      g.fillStyle = '#dce8ff'; g.font = '700 15px Baloo 2, sans-serif';
      g.fillText('ONDATA ' + wave, W / 2, 24);
      g.fillStyle = '#9db4dd'; g.font = '700 11px Baloo 2, sans-serif';
      g.fillText(kills + ' nemici abbattuti', W / 2, 40);
    } else if (mode === 'targets') {
      g.fillStyle = '#ffd24a'; g.font = '700 18px Baloo 2, sans-serif';
      g.fillText(Math.ceil(timeLeft) + 's', W / 2, 28);
      g.fillStyle = '#fff'; g.font = '700 13px Baloo 2, sans-serif';
      g.fillText('PUNTI ' + score, W / 2, 48);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '700 10px Baloo 2, sans-serif';
      g.fillText('colpisci i bersagli con l\'arma', W / 2, 64);
    } else if (mode === 'boss') {
      g.fillStyle = '#ffd24a'; g.font = '700 12px Baloo 2, sans-serif';
      g.fillText('TORNEO ' + ((cfg.bossTier || 0) + 1) + ' / 100', W / 2, 24);
    } else if (mode === 'lastman') {
      g.fillStyle = '#dce8ff'; g.font = '700 13px Baloo 2, sans-serif';
      g.fillText('ULTIMO IN PIEDI', W / 2, 24);
    } else {
      g.fillStyle = 'rgba(4,10,20,.7)'; rr(W / 2 - 34, 44, 68, 24, 8); g.fill();
      g.fillStyle = '#fff'; g.font = '700 15px Baloo 2, sans-serif';
      g.fillText(Math.ceil(Math.max(0, timeLeft)), W / 2, 61);
      g.fillStyle = 'rgba(220,232,255,.7)'; g.font = '700 10px Baloo 2, sans-serif';
      g.fillText('ROUND ' + round, W / 2, 84);
    }
    // spettatore: quando il giocatore locale è morto si segue un bot
    if (humans.length && humans.every(f => f.dead) && specF && !specF.dead) {
      g.textAlign = 'center';
      g.fillStyle = 'rgba(4,10,20,.7)'; rr(W / 2 - 130, H - 54, 260, 26, 9); g.fill();
      g.fillStyle = '#ffd24a'; g.font = '700 12px Baloo 2, sans-serif';
      g.fillText('VISUALE: ' + specF.name + (specF.cpu ? ' · BOT' : ''), W / 2, H - 36);
    }
    // varianti attive
    const act = Object.keys(MODS()).filter(k => MODS()[k] && k !== 'name');
    if (act.length) {
      const names = {
        double: 'DOPPIA ARMA', boots: 'STIVALI', radioactive: 'RADIOATTIVO', giant: 'ARMI GIGANTI',
        mirror: 'SPECCHIO', gravity: 'GRAVITÀ CASUALE', superjump: 'SUPER SALTO', nohealth: 'SENZA VITA'
      };
      g.textAlign = 'center'; g.font = '700 9px Baloo 2, sans-serif';
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillText(act.map(a => names[a] || a).join(' · '), W / 2, H - 12);
    }
  }

  function drawBanner() {
    if (bannerT <= 0 || !banner) return;
    const big = state === 'ko' || state === 'end';
    g.save();
    g.textAlign = 'center';
    g.translate(W / 2, H / 2 - 30);
    const sc = big ? 1 : 1 + Math.max(0, bannerT > .6 ? 0 : (0.2 - bannerT) * 1.5);
    g.scale(sc, sc);
    g.font = '400 ' + (state === 'end' ? 54 : 62) + 'px Bungee, Impact, sans-serif';
    g.lineWidth = 9; g.strokeStyle = '#06142a'; g.lineJoin = 'round';
    g.strokeText(banner, 0, 0);
    const grad = g.createLinearGradient(0, -40, 0, 20);
    grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ffd24a');
    g.fillStyle = grad; g.fillText(banner, 0, 0);
    if (bannerSub) {
      g.font = '700 17px Baloo 2, sans-serif';
      g.lineWidth = 6; g.strokeStyle = '#06142a';
      g.strokeText(bannerSub, 0, 42); g.fillStyle = '#eaf2ff'; g.fillText(bannerSub, 0, 42);
    }
    g.restore();
  }

  function drawTargets() {
    for (const t of targets) {
      if (!t.alive) continue;
      const r = t.r;
      g.save(); g.translate(t.x, t.y);
      g.fillStyle = '#f4f6fb'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = '#e33d3d'; g.beginPath(); g.arc(0, 0, r * .72, 0, TAU); g.fill();
      g.fillStyle = '#f4f6fb'; g.beginPath(); g.arc(0, 0, r * .44, 0, TAU); g.fill();
      g.fillStyle = '#e33d3d'; g.beginPath(); g.arc(0, 0, r * .18, 0, TAU); g.fill();
      const hp = clamp(t.hp / t.maxhp, 0, 1);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-r, -r - 12, r * 2, 6);
      g.fillStyle = '#4ef07a'; g.fillRect(-r, -r - 12, r * 2 * hp, 6);
      g.restore();
    }
  }

  function draw() {
    if (!theme) return;
    g.save();
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(-camX, -camY);
    if (shake > .3) g.translate(rnd(-shake, shake), rnd(-shake, shake));
    drawBg();
    if (mode === 'targets') drawTargets();
    drawPickups();
    if (F.length) {
      const sorted = F.slice().sort((a, b) => a.dead - b.dead);
      for (const f of sorted) drawFighter(f);
      drawProjs();
      for (const p of parts) {
        g.globalAlpha = clamp(p.life / p.max, 0, 1);
        g.fillStyle = p.col; g.fillRect(p.x, p.y, p.size, p.size);
      }
      g.globalAlpha = 1;
      for (const r of rings) {
        g.strokeStyle = r.own && r.own.color ? r.own.color : '#fff';
        g.globalAlpha = clamp(r.life / r.maxLife, 0, 1) * .9;
        g.lineWidth = 4;
        g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
        g.globalAlpha = clamp(r.life / r.maxLife, 0, 1) * .15;
        g.fillStyle = r.own && r.own.color ? r.own.color : '#fff';
        g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      for (const b of beams) {
        g.save();
        g.globalAlpha = clamp(b.life / .28, 0, 1);
        g.strokeStyle = b.hook ? '#8fe6ff' : '#ff4d6d';
        g.shadowColor = g.strokeStyle; g.shadowBlur = 14;
        g.lineWidth = b.hook ? 3 : 7;
        g.beginPath(); g.moveTo(b.x1, b.y1); g.lineTo(b.x2, b.y2); g.stroke();
        g.restore();
      }
      for (const fl of floats) {
        g.globalAlpha = clamp(fl.life / .7, 0, 1);
        g.fillStyle = fl.col; g.font = '700 16px Baloo 2, sans-serif'; g.textAlign = 'center';
        g.fillText(fl.txt, fl.x, fl.y);
      }
      g.globalAlpha = 1;
    }
    g.restore();
    drawHUD();
    drawBanner();
    if (flash > 0) {
      g.fillStyle = 'rgba(255,255,255,' + (flash * .7) + ')';
      g.fillRect(0, 0, W, H);
    }

    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
  }

  let lastFrameAt = 0;

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    lastFrameAt = performance.now();
    if (!active) return;
    const dt = Math.min(.033, last ? (ts - last) / 1000 : .016);
    last = ts;
    if (!paused) {
      if (running) step(dt);
      syncTouch();
    }
    draw();
  }

  E.init = function (opts) {
    cv = opts.canvas; g = cv.getContext('2d'); tLayer = opts.touch;
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKeyUp);
    addEventListener('blur', () => {
      for (const k in keys) keys[k] = 0;
      if (running && !paused) E.pause(true);
    });
    addEventListener('visibilitychange', () => {
      if (document.hidden && running && !paused) E.pause(true);
    });
    if (!rafId) rafId = requestAnimationFrame(frame);
    // fallback: alcuni browser sospendono requestAnimationFrame (finestra occlusa);
    // se il loop non riceve frame da troppo tempo lo facciamo avanzare a mano.
    setInterval(() => {
      if (!active || paused) return;
      if (performance.now() - lastFrameAt > 180) frame(performance.now());
    }, 60);
  };

  /* util per la UI */
  E.weaponIcon = function (canvas, id, col) {
    const ctx = canvas.getContext('2d');
    const w = WP[id];
    if (!w) return;
    canvas.width = 112; canvas.height = 80;
    ctx.clearRect(0, 0, 112, 80);
    ctx.save();
    ctx.translate(22, 52);
    ctx.rotate(-.6);
    ctx.lineCap = 'round';
    const fake = { f: { weapon: id, s: .62, giant: false, color2: col || '#fff' } };
    // disegno semplificato direttamente
    const L = (w.len || 40) * 1.1;
    ctx.strokeStyle = w.col; ctx.lineWidth = 4;
    if (w.shape === 'fist') {
      ctx.fillStyle = '#ffd9b0'; ctx.beginPath(); ctx.arc(30, 0, 9, 0, 7); ctx.fill();
    } else if (w.shape === 'gun' || w.shape === 'longgun' || w.shape === 'bazooka') {
      ctx.fillStyle = w.col; ctx.fillRect(10, -5, 52, 10);
      ctx.fillStyle = '#222'; ctx.fillRect(10, 5, 10, 16);
    } else if (w.shape === 'bow') {
      ctx.strokeStyle = w.col; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(18, 0, 26, -1.1, 1.1); ctx.stroke();
    } else if (w.shape === 'shield') {
      ctx.fillStyle = w.col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(16, -20, 18, 40, 6) : ctx.rect(16, -20, 18, 40); ctx.fill();
    } else if (w.shape === 'bomb') {
      ctx.fillStyle = '#2f3542'; ctx.beginPath(); ctx.arc(34, 0, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(40, -10); ctx.lineTo(48, -20); ctx.stroke();
    } else if (w.shape === 'orb') {
      ctx.fillStyle = w.col; ctx.beginPath(); ctx.arc(38, 0, 12, 0, 7); ctx.fill();
    } else if (w.shape === 'boomerang') {
      ctx.strokeStyle = w.col; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(30, 4, 18, -.5, 2.2); ctx.stroke();
    } else {
      ctx.strokeStyle = w.col; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
      if (w.shape === 'axe' || w.shape === 'hammer') {
        ctx.fillStyle = '#9aa7c2'; ctx.fillRect(L - 10, -14, 14, 28);
      }
    }
    ctx.restore();
  };
})();
