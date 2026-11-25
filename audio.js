/* Stickman Fight 3D — audio: musiche procedurali e effetti sonori (Web Audio). */
(function () {
  'use strict';
  const G = window.GH = window.GH || {};
  const A = G.audio = {};

  let ac = null, master = null, musicBus = null, sfxBus = null;
  let enabled = true, musicOn = true, sfxOn = true;
  let desired = null, playing = null, step = 0, nextTime = 0, timer = null;
  let noiseBuf = null, ducked = false;

  const TRACKS = {
    menu: {
      bpm: 92, drums: false, root: 45,
      arp: [0, 7, 12, 15, 12, 7, 3, 0],
      bass: [0, 0, -2, -2, -4, -4, -5, -5],
      pads: [[0, 3, 7], [-2, 1, 5], [-4, 0, 3], [-5, -1, 2]]
    },
    battle: {
      bpm: 138, drums: true, root: 38,
      arp: [0, 12, 7, 12, 3, 15, 10, 15],
      bass: [0, 0, 5, 5, -2, -2, 3, 3],
      pads: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, 0, 3]]
    },
    boss: {
      bpm: 124, drums: true, root: 33,
      arp: [0, 6, 12, 6, 1, 8, 13, 8],
      bass: [0, 0, -1, -1, -3, -3, -2, -2],
      pads: [[0, 1, 6], [0, 1, 6], [-1, 4, 8], [-3, 2, 7]]
    }
  };

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ac) {
      if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
      return ac;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = enabled ? .9 : .0001; master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = .3; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = .85; sfxBus.connect(master);
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * .4), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }

  /* ---------------- effetti ---------------- */
  function tone(f1, d, type, v, f2, when) {
    if (!enabled || !sfxOn) return;
    const c = ensure(); if (!c) return;
    try {
      const t = c.currentTime + (when || 0);
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, f1), t);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
      gn.gain.setValueAtTime(Math.max(.0001, v || .05), t);
      gn.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(gn); gn.connect(sfxBus);
      o.start(t); o.stop(t + d + .03);
    } catch (e) {}
  }
  A.tone = tone;

  const NAMED = {
    click: [[620, .06, 'square', .035, 900, 0]],
    coin: [[980, .08, 'square', .045, 1240, 0], [1480, .14, 'sine', .05, 1980, .07]],
    buy: [[520, .1, 'triangle', .06, 780, 0], [780, .16, 'sine', .05, 1040, .1]],
    error: [[240, .18, 'sawtooth', .05, 140, 0]],
    win: [[523, .16, 'square', .05, 523, 0], [659, .16, 'square', .05, 659, .16], [784, .2, 'square', .05, 784, .32], [1046, .4, 'triangle', .06, 1046, .5]],
    lose: [[392, .2, 'triangle', .055, 392, 0], [330, .2, 'triangle', .055, 330, .2], [262, .45, 'sawtooth', .05, 196, .4]]
  };

  A.sfx = function (name) {
    const list = NAMED[name];
    if (!list || !enabled || !sfxOn) return;
    for (const n of list) {
      tone(n[0], n[1], n[2], n[3], n[4], n[5]);
    }
  };

  /* ---------------- musica ---------------- */
  function note(midi, dur, type, vol, t, dest) {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(hz(midi), t);
      gn.gain.setValueAtTime(.0001, t);
      gn.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + .02);
      gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(gn); gn.connect(dest || musicBus);
      o.start(t); o.stop(t + dur + .03);
    } catch (e) {}
  }

  function kick(t) {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), gn = ac.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + .18);
      gn.gain.setValueAtTime(.55, t);
      gn.gain.exponentialRampToValueAtTime(.0008, t + .22);
      o.connect(gn); gn.connect(musicBus);
      o.start(t); o.stop(t + .25);
    } catch (e) {}
  }

  function noiseHit(t, vol, dur, hp) {
    if (!ac || !noiseBuf) return;
    try {
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 4000;
      const gn = ac.createGain();
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(.0008, t + dur);
      src.connect(f); f.connect(gn); gn.connect(musicBus);
      src.start(t); src.stop(t + dur + .02);
    } catch (e) {}
  }

  function playStep(tr, i, t) {
    const eight = 30 / tr.bpm;
    const bar = Math.floor(i / 8), s = i % 8;
    if (s === 0) {
      const ch = tr.pads[bar % tr.pads.length];
      for (const n of ch) note(tr.root + 36 + n, eight * 7.2, 'sine', .032, t);
    }
    if (s % 2 === 0) {
      const b = tr.bass[bar % tr.bass.length];
      note(tr.root + b + (s === 6 ? 12 : 0), eight * 1.7, 'triangle', .15, t);
    }
    note(tr.root + 24 + tr.arp[i % tr.arp.length], eight * .85, 'square', tr.drums ? .048 : .034, t);
    if (tr.drums) {
      if (s === 0 || s === 3 || s === 6) kick(t);
      if (s === 2 || s === 6) noiseHit(t, .2, .13, 1600);
      if (s % 2 === 0) noiseHit(t, .055, .045, 6500);
    }
  }

  function scheduler() {
    if (!ac || !playing) return;
    const tr = TRACKS[playing];
    const eight = 30 / tr.bpm;
    if (nextTime < ac.currentTime - .4) nextTime = ac.currentTime + .05;
    while (nextTime < ac.currentTime + .28) {
      playStep(tr, step, nextTime);
      nextTime += eight;
      step++;
    }
  }

  function begin(name) {
    if (!ac || !TRACKS[name]) return;
    clearInterval(timer);
    playing = name; step = 0; nextTime = ac.currentTime + .08;
    try {
      const t = ac.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), t);
      musicBus.gain.exponentialRampToValueAtTime(ducked ? .11 : .3, t + .7);
    } catch (e) {}
    timer = setInterval(scheduler, 60);
    scheduler();
  }

  function silence() {
    clearInterval(timer); timer = null; playing = null;
    if (!ac || !musicBus) return;
    try {
      const t = ac.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), t);
      musicBus.gain.exponentialRampToValueAtTime(.0001, t + .25);
    } catch (e) {}
  }

  A.music = function (name) {
    desired = name || null;
    if (!name) { silence(); return; }
    if (!enabled || !musicOn) { silence(); return; }
    const c = ensure();
    if (!c) return;
    if (playing === name) return;
    begin(name);
  };

  A.current = () => playing;
  A.duck = function (v) {
    ducked = !!v;
    if (!ac || !musicBus) return;
    try {
      const t = ac.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), t);
      musicBus.gain.exponentialRampToValueAtTime(ducked ? .1 : .3, t + .2);
    } catch (e) {}
  };

  A.setEnabled = function (v) {
    enabled = !!v;
    if (!ac || !master) return;
    try {
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(enabled ? .9 : .0001, t + .15);
    } catch (e) {}
    if (!enabled) silence();
    else if (desired) A.music(desired);
  };
  A.setMusic = function (v) {
    musicOn = !!v;
    if (!musicOn) silence();
    else if (desired) { if (ensure()) begin(desired); }
  };
  A.setSfx = function (v) { sfxOn = !!v; };
  A.getEnabled = () => enabled;
  A.getMusic = () => musicOn;
  A.getSfx = () => sfxOn;

  function unlock() {
    const c = ensure();
    if (!c) return;
    const go = () => {
      try { if (c.state === 'suspended') c.resume(); } catch (e) {}
      if (desired && !playing && enabled && musicOn) begin(desired);
    };
    go();
    setTimeout(go, 80);
  }
  A.unlock = unlock;
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    document.addEventListener('touchend', unlock, { passive: true });
  }

  A.debug = function () {
    return { enabled: enabled, musicOn: musicOn, sfxOn: sfxOn, track: playing, desired: desired, state: ac ? ac.state : 'none' };
  };
})();
