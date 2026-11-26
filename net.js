/* Stickman Fight 3D — LAN P2P (PeerJS): lobby fino a 4 posti, host, espulsioni, partita veloce. */
(function () {
  'use strict';
  const G = window.GH = window.GH || {};
  const N = G.net = {};
  const PREFIX = 'ghsf3d-';
  const CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const MAX = 4;
  const BOTS = ['BOT OMEGA', 'BOT NEON', 'BOT VIPERA', 'BOT TURBO'];
  let loading = null;

  N.MAX = MAX;

  function load() {
    if (window.Peer) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = CDN;
      s.onload = () => resolve(!!window.Peer);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
      setTimeout(() => resolve(!!window.Peer), 7000);
    });
    return loading;
  }
  N.load = load;

  function norm(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }
  N.norm = norm;
  N.newCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

  function nowName(me) {
    return String((me && me.name) || 'GIOCATORE').slice(0, 14);
  }

  /* ---------------- stanza ---------------- */
  // Host: tiene l'elenco dei giocatori (posti 0..3), accetta connessioni, espelle e avvia.
  // Ospite: manda il suo profilo (nome + livello), riceve la lobby e i comandi.
  function makeRoom(peer, code, isHost, me, guestConn) {
    const room = {
      code: norm(code), isHost: !!isHost, peer: peer, closed: false,
      me: { name: nowName(me), level: (me && me.level) || 1 },
      players: [], conns: [], mySlot: isHost ? 0 : null,
      onUpdate: null, onStart: null, onKick: null, onData: null, onStatus: null,
      onFull: null, seq: 1
    };
    if (isHost) {
      room.players.push({ id: 'host', slot: 0, name: room.me.name, level: room.me.level, bot: false, host: true });
    }

    function fail(msg) { if (room.onStatus) room.onStatus(msg); }

    room.broadcast = function (msg) {
      for (const c of room.conns) {
        try { if (c.conn && c.conn.open) c.conn.send(msg); } catch (e) {}
      }
    };
    room.sendToSlot = function (slot, msg) {
      const c = room.conns.find(x => x.slot === slot);
      try { if (c && c.conn && c.conn.open) c.conn.send(msg); } catch (e) {}
    };
    room.lobbyMsg = function () {
      return { t: 'lobby', max: MAX, players: room.players.map(p => ({ slot: p.slot, name: p.name, level: p.level, bot: !!p.bot, host: !!p.host })) };
    };
    room.pushLobby = function () {
      const msg = room.lobbyMsg();
      for (const c of room.conns) {
        try { if (c.conn && c.conn.open) c.conn.send(Object.assign({ you: c.slot }, msg)); } catch (e) {}
      }
      if (room.onUpdate) room.onUpdate();
    };
    room.freeSlot = function () {
      for (let i = 1; i < MAX; i++) if (!room.players.some(p => p.slot === i)) return i;
      return -1;
    };
    room.addBot = function () {
      if (!room.isHost) return;
      const slot = room.freeSlot();
      if (slot < 0) return;
      const name = BOTS[(room.players.length - 1) % BOTS.length];
      room.players.push({ id: 'bot' + (room.seq++), slot: slot, name: name, level: 1 + Math.floor(Math.random() * 9), bot: true, host: false });
      room.players.sort((a, b) => a.slot - b.slot);
      room.pushLobby();
    };
    room.removeBot = function (slot) {
      if (!room.isHost) return;
      room.players = room.players.filter(p => !(p.bot && p.slot === slot));
      room.pushLobby();
    };
    room.kick = function (slot) {
      if (!room.isHost) return;
      const c = room.conns.find(x => x.slot === slot);
      if (c) {
        try { if (c.conn.open) c.conn.send({ t: 'kick' }); } catch (e) {}
        room.conns = room.conns.filter(x => x !== c);
        // chiudo solo dopo: chiudere subito può scartare il messaggio di espulsione
        setTimeout(() => { try { c.conn.close(); } catch (e) {} }, 400);
      }
      room.players = room.players.filter(p => p.slot !== slot);
      room.pushLobby();
    };
    room.start = function (mapId, players) {
      if (!room.isHost) return;
      const ordered = room.players.slice().sort((a, b) => (a.host ? -1 : b.host ? 1 : a.slot - b.slot));
      ordered.forEach((p, i) => {
        const msg = { t: 'start', slot: i, mapId: mapId, players: players };
        if (p.host) { if (room.onStart) room.onStart(msg); }
        else if (!p.bot) {
          const c = room.conns.find(x => x.slot === p.slot);
          try { if (c && c.conn && c.conn.open) c.conn.send(msg); } catch (e) {}
        }
      });
    };
    room.close = function () {
      room.closed = true;
      if (room.watchdog) { clearInterval(room.watchdog); room.watchdog = null; }
      if (room.hb) { clearInterval(room.hb); room.hb = null; }
      for (const c of room.conns) { try { if (c.conn && c.conn.open) c.conn.send({ t: 'bye' }); } catch (e) {} try { c.conn.close(); } catch (e) {} }
      room.conns = [];
      try { room.peer && room.peer.destroy(); } catch (e) {}
    };

    if (isHost) {
      peer.on('connection', conn => {
        if (room.players.filter(p => !p.bot).length >= MAX) {
          try { conn.send({ t: 'full' }); } catch (e) {}
          try { conn.close(); } catch (e) {}
          return;
        }
        const entry = { conn: conn, slot: -1, id: 'g' + (room.seq++), last: Date.now() };
        room.conns.push(entry);
        conn.on('data', d => {
          if (!d || !d.t) return;
          entry.last = Date.now();
          if (d.t === 'hb') return;
          if (d.t === 'hello') {
            if (entry.slot >= 0) return;
            const slot = room.freeSlot();
            if (slot < 0) { try { conn.send({ t: 'full' }); conn.close(); } catch (e) {} room.conns = room.conns.filter(x => x !== entry); return; }
            entry.slot = slot;
            entry.name = String(d.name || 'GIOCATORE').slice(0, 14);
            entry.level = Math.max(1, Math.min(999, parseInt(d.level, 10) || 1));
            room.players.push({ id: entry.id, slot: slot, name: entry.name, level: entry.level, bot: false, host: false });
            room.players.sort((a, b) => a.slot - b.slot);
            room.pushLobby();
            // se la partita è in corso l'host decide se far entrare subito o rifiutare
            if (room.onJoin && room.onJoin(slot) === 'busy') {
              try { conn.send({ t: 'busy' }); } catch (e) {}
              room.players = room.players.filter(p => p.slot !== slot);
              room.conns = room.conns.filter(x => x !== entry);
              room.pushLobby();
              try { conn.close(); } catch (e) {}
              return;
            }
            fail(entry.name + ' (liv. ' + entry.level + ') è entrato');
            return;
          }
          if (d.t === 'in') { if (entry.slot >= 0) room.onData && room.onData(d, entry.slot); return; }
          if (d.t === 'leave' || d.t === 'bye') {
            room.players = room.players.filter(p => p.slot !== entry.slot);
            room.conns = room.conns.filter(x => x !== entry);
            if (!entry.gone) { entry.gone = true; if (entry.slot >= 0 && room.onLeave) room.onLeave(entry.slot); }
            room.pushLobby();
            return;
          }
          if (room.onData) room.onData(d, entry.slot);
        });
        conn.on('close', () => {
          if (entry.slot >= 0) {
            room.players = room.players.filter(p => p.id !== entry.id);
            if (!entry.gone) { entry.gone = true; if (room.onLeave) room.onLeave(entry.slot); }
            fail(entry.name + ' è uscito');
          }
          room.conns = room.conns.filter(x => x !== entry);
          room.pushLobby();
        });
        conn.on('error', () => {});
      });
      // watchdog: se un ospite sparisce senza chiudere (chiude la scheda, perde la rete)
      room.watchdog = setInterval(() => {
        if (room.closed) return;
        const now = Date.now();
        for (const c of room.conns.slice()) {
          if (c.last && now - c.last > 9000) {
            try { c.conn.close(); } catch (e) {}
            room.conns = room.conns.filter(x => x !== c);
            if (c.slot >= 0 && !c.gone) {
              c.gone = true;
              room.players = room.players.filter(p => p.slot !== c.slot);
              if (room.onLeave) room.onLeave(c.slot);
              room.pushLobby();
            }
          }
        }
      }, 3000);
    } else {
      const conn = guestConn;
      room.pendingConn = conn;
      if (conn) {
        conn.on('data', d => {
          if (!d || !d.t) return;
          if (d.t === 'lobby') {
            room.players = (d.players || []).slice(0, MAX);
            room.mySlot = d.you != null ? d.you : room.mySlot;
            if (room.onUpdate) room.onUpdate();
            return;
          }
          if (d.t === 'start') { if (room.onStart) room.onStart(d); return; }
          if (d.t === 'kick') { room.kickedByHost = true; if (room.onKick) room.onKick('kick'); return; }
          if (d.t === 'bye') { fail('La lobby è stata chiusa'); if (room.onKick) room.onKick('bye'); return; }
          if (d.t === 'full') { if (room.onFull) room.onFull(); return; }
          if (d.t === 'busy') { fail('Partita in corso: riprova tra poco'); if (room.onKick) room.onKick('busy'); return; }
          if (room.onData) room.onData(d, null);
        });
        conn.on('close', () => {
          if (room.closed || room.kickedByHost) return;
          fail('Host disconnesso');
          if (room.onKick) room.onKick('close');
        });
        conn.on('error', () => {});
      }
    }

    room.send = function (msg) {
      try { if (room.pendingConn && room.pendingConn.open) room.pendingConn.send(msg); } catch (e) {}
    };
    room.sendInput = function (i) {
      if (room.isHost) return;
      const slot = room.matchSlot != null ? room.matchSlot : room.mySlot;
      room.send({ t: 'in', slot: slot, i: i });
    };
    return room;
  }

  function hostAt(id, code, me) {
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(id, { debug: 0 });
      let done = false;
      peer.on('open', () => {
        done = true;
        const room = makeRoom(peer, code, true, me);
        if (room.onStatus) room.onStatus('Stanza aperta: ' + room.code);
        resolve(room);
      });
      peer.on('error', e => {
        if (done) return;
        done = true;
        try { peer.destroy(); } catch (x) {}
        reject(e || new Error('Errore host'));
      });
      setTimeout(() => { if (!done) { done = true; try { peer.destroy(); } catch (x) {} reject(new Error('Timeout host')); } }, 9000);
    });
  }

  N.hostRoom = function (code, me) {
    return load().then(ok => {
      if (!ok) throw new Error('PeerJS non raggiungibile: controlla la connessione');
      const c = norm(code) || N.newCode();
      return hostAt(PREFIX + c.toLowerCase(), c, me);
    });
  };

  function tryJoinRoom(id, me, ms) {
    return new Promise(resolve => {
      const peer = new window.Peer(null, { debug: 0 });
      let done = false, conn = null;
      const finish = v => {
        if (done) return;
        done = true;
        clearTimeout(to);
        if (!v) { try { conn && conn.close(); } catch (e) {} try { peer.destroy(); } catch (e) {} }
        resolve(v);
      };
      const to = setTimeout(() => finish(null), ms);
      peer.on('open', () => {
        conn = peer.connect(id, { reliable: true });
        const room = makeRoom(peer, id.replace(PREFIX, '').toUpperCase(), false, me, conn);
        conn.on('open', () => {
          try { conn.send({ t: 'hello', name: room.me.name, level: room.me.level }); } catch (e) {}
          // battito: fa capire all'host che ci sono anche se non mando comandi
          room.hb = setInterval(() => { try { if (conn.open) conn.send({ t: 'hb' }); } catch (e) {} }, 2000);
        });
        conn.on('close', () => { if (room.hb) { clearInterval(room.hb); room.hb = null; } });
        conn.on('error', () => finish(null));
        peer.on('error', () => finish(null));
        // la prima lobby conferma che la stanza esiste ed è libera
        room.onUpdate = () => finish(room);
        room.onFull = () => finish(null);
      });
      peer.on('error', () => finish(null));
    });
  }

  N.joinRoom = function (code, me) {
    const c = norm(code);
    if (!c) return Promise.reject(new Error('Codice non valido'));
    return load().then(ok => {
      if (!ok) throw new Error('PeerJS non raggiungibile: controlla la connessione');
      return tryJoinRoom(PREFIX + c.toLowerCase(), me, 9000);
    }).then(r => {
      if (!r) throw new Error('Stanza non trovata, piena o host offline');
      return r;
    });
  };

  N.quick = function (me) {
    return load().then(async ok => {
      if (!ok) throw new Error('PeerJS non raggiungibile: controlla la connessione');
      const ids = [];
      for (let i = 1; i <= 4; i++) ids.push(PREFIX + 'q' + i);
      for (const id of ids) {
        const room = await tryJoinRoom(id, me, 1600);
        if (room) { room.code = 'VELOCE'; return room; }
      }
      for (const id of ids) {
        try { return await hostAt(id, 'VELOCE', me); } catch (e) {}
      }
      throw new Error('Nessuna lobby veloce disponibile');
    });
  };
})();
