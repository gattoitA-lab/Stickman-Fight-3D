/* Stickman Fight 3D — dati di gioco (armi, mappe, teste, varianti). */
window.GH = window.GH || {};
(function () {
  const G = window.GH;

  G.COLS = ['#4cc9ff', '#4ef07a', '#ffd24a', '#ff6a57', '#c58cff', '#ffffff', '#ff9ad5', '#9be36b', '#ffb86b', '#8fa8ff'];
  G.EXTRA_COLS = ['#ff9ad5', '#9be36b', '#ffb86b', '#8fa8ff'];

  /* armi: shape decide il disegno, kind decide il tipo di attacco */
  G.WEAPONS = {
    fist:     { n: 'Pugni',        cat: 'Mischia',  shape: 'fist',    kind: 'thrust', dmg: 7,  cd: .28, dur: .24, reach: 54,  kb: 320, abi: 'shock',  acd: 5,  col: '#ffd9b0', desc: 'Veloce, spinge indietro' },
    sword:    { n: 'Spada',        cat: 'Mischia',  shape: 'blade',   kind: 'swing',  dmg: 12, cd: .42, dur: .3,  reach: 92,  len: 66, kb: 360, abi: 'dash', acd: 5, col: '#d6e6ff', desc: 'Fendente equilibrato' },
    katana:   { n: 'Katana',       cat: 'Mischia',  shape: 'blade',   kind: 'swing',  dmg: 13, cd: .34, dur: .25, reach: 94,  len: 70, kb: 330, abi: 'dash', acd: 4.5, col: '#e8f4ff', desc: 'Rapida e affilata' },
    saber:    { n: 'Doppia Lama',  cat: 'Mischia',  shape: 'blade',   kind: 'swing',  dmg: 15, cd: .5,  dur: .34, reach: 100, len: 74, kb: 400, abi: 'shock', acd: 6, col: '#c58cff', desc: 'Due colpi in un fendente' },
    hammer:   { n: 'Martello',     cat: 'Mischia',  shape: 'hammer',  kind: 'swing',  dmg: 19, cd: .8,  dur: .42, reach: 88,  len: 62, kb: 620, abi: 'shock', acd: 7, col: '#9aa7c2', desc: 'Lento ma devastante' },
    spear:    { n: 'Lancia',       cat: 'Mischia',  shape: 'spear',   kind: 'thrust', dmg: 10, cd: .5,  dur: .32, reach: 128, len: 104,kb: 320, abi: 'dash', acd: 5, col: '#e0c689', desc: 'Lunga portata' },
    trident:  { n: 'Tridente',     cat: 'Mischia',  shape: 'trident', kind: 'thrust', dmg: 12, cd: .55, dur: .34, reach: 122, len: 98, kb: 380, abi: 'pull', acd: 6, col: '#8fe6ff', desc: 'Aggancia e tira' },
    axe:      { n: 'Ascia',        cat: 'Mischia',  shape: 'axe',     kind: 'swing',  dmg: 17, cd: .7,  dur: .4,  reach: 86,  len: 62, kb: 480, abi: 'shock', acd: 6, col: '#9aa7c2', desc: 'Taglio pesante' },
    scythe:   { n: 'Falce',        cat: 'Mischia',  shape: 'scythe',  kind: 'swing',  dmg: 16, cd: .62, dur: .36, reach: 104, len: 78, kb: 400, abi: 'pull', acd: 6, col: '#c9d8f0', desc: 'Ampio arco di taglio' },
    shield:   { n: 'Scudo',        cat: 'Mischia',  shape: 'shield',  kind: 'thrust', dmg: 8,  cd: .4,  dur: .26, reach: 58,  kb: 440, abi: 'shield', acd: 5, col: '#8fb8e8', desc: 'Para e respinge' },
    boots:    { n: 'Stivali',      cat: 'Mischia',  shape: 'boot',    kind: 'thrust', dmg: 9,  cd: .34, dur: .24, reach: 62,  kb: 380, abi: 'dash', acd: 4, col: '#b0743c', desc: 'Calci volanti' },
    laser:    { n: 'Spada Laser',  cat: 'Mischia',  shape: 'laser',   kind: 'swing',  dmg: 15, cd: .45, dur: .3,  reach: 100, len: 82, kb: 380, abi: 'laser', acd: 6, col: '#ff4d6d', desc: 'Raggio alla carica' },
    staff:    { n: 'Bastone',      cat: 'Mischia',  shape: 'staff',   kind: 'swing',  dmg: 12, cd: .55, dur: .34, reach: 96,  len: 80, kb: 340, abi: 'meteor', acd: 7, col: '#8a6a3a', desc: 'Evoca meteore' },
    gun:      { n: 'Pistola',      cat: 'Distanza', shape: 'gun',     kind: 'shoot',  dmg: 8,  cd: .34, dur: .2,  reach: 0,   kb: 240, abi: 'dash', acd: 5, col: '#2b2f3a', desc: 'Fuoco automatico', proj: { sp: 1050, dmg: 8, r: 3, type: 'bullet' } },
    sniper:   { n: 'Cecchino',     cat: 'Distanza', shape: 'longgun', kind: 'shoot',  dmg: 22, cd: 1.05,dur: .34, reach: 0,   kb: 480, abi: 'laser', acd: 6, col: '#39424f', desc: 'Colpo perforante', proj: { sp: 1600, dmg: 22, r: 3, type: 'bullet', pierce: true } },
    bow:      { n: 'Arco',         cat: 'Distanza', shape: 'bow',     kind: 'shoot',  dmg: 16, cd: .62, dur: .3,  reach: 0,   kb: 300, abi: 'meteor', acd: 7, col: '#b0743c', desc: 'Frecce precise', proj: { sp: 900, dmg: 16, r: 3, type: 'arrow', grav: 380 } },
    crossbow: { n: 'Balestra',     cat: 'Distanza', shape: 'bow',     kind: 'shoot',  dmg: 18, cd: .8,  dur: .32, reach: 0,   kb: 420, abi: 'pull', acd: 6, col: '#8a6a3a', desc: 'Dardo pesante', proj: { sp: 1200, dmg: 18, r: 3, type: 'arrow', grav: 120 } },
    boomerang:{ n: 'Boomerang',    cat: 'Distanza', shape: 'boomerang',kind: 'throw', dmg: 12, cd: .6,  dur: .26, reach: 0,   kb: 260, abi: 'dash', acd: 5, col: '#e0a040', desc: 'Torna indietro', proj: { sp: 720, dmg: 12, r: 7, type: 'boomerang' } },
    shuriken: { n: 'Shuriken',     cat: 'Distanza', shape: 'shuriken',kind: 'throw', dmg: 6,  cd: .42, dur: .22, reach: 0,   kb: 160, abi: 'dash', acd: 4, col: '#cfd9e8', desc: 'Tre stelle a ventaglio', proj: { sp: 900, dmg: 6, r: 4, type: 'shuriken', triple: true } },
    bomb:     { n: 'Bomba',        cat: 'Distanza', shape: 'bomb',    kind: 'throw', dmg: 24, cd: .9,  dur: .3,  reach: 0,   kb: 620, abi: 'bomb', acd: 5, col: '#2f3542', desc: 'Esplode al contatto', proj: { sp: 560, dmg: 24, r: 9, type: 'bomb', grav: 900, explode: 84 } },
    bazooka:  { n: 'Bazooka',      cat: 'Distanza', shape: 'bazooka', kind: 'shoot',  dmg: 26, cd: 1.2, dur: .4,  reach: 0,   kb: 700, abi: 'bomb', acd: 7, col: '#4d5a2c', desc: 'Razzo ad area', proj: { sp: 720, dmg: 26, r: 8, type: 'rocket', explode: 96 } },
    snowball: { n: 'Palla di Neve',cat: 'Distanza', shape: 'snowball',kind: 'throw', dmg: 6,  cd: .38, dur: .22, reach: 0,   kb: 200, abi: 'freeze', acd: 6, col: '#eaf6ff', desc: 'Rallenta i nemici', proj: { sp: 820, dmg: 6, r: 6, type: 'snow', grav: 420 } },
    grapple:  { n: 'Rampino',      cat: 'Speciale', shape: 'grapple', kind: 'shoot',  dmg: 10, cd: .75, dur: .3,  reach: 0,   kb: 300, abi: 'pull', acd: 4, col: '#7a8a9a', desc: 'Tira a sé il bersaglio', proj: { sp: 1200, dmg: 10, r: 4, type: 'hook' } },
    portal:   { n: 'Portale',      cat: 'Speciale', shape: 'orb',     kind: 'shoot',  dmg: 7,  cd: .5,  dur: .24, reach: 0,   kb: 200, abi: 'teleport', acd: 4, col: '#4ef07a', desc: 'Teletrasporto lampo', proj: { sp: 700, dmg: 7, r: 7, type: 'orb' } },
    gauntlet: { n: 'Guanto',       cat: 'Speciale', shape: 'gauntlet',kind: 'thrust', dmg: 14, cd: .6,  dur: .3,  reach: 66,  kb: 520, abi: 'meteor', acd: 6, col: '#c58cff', desc: 'Pugni dimensionali' },
    scepter:  { n: 'Scettro',      cat: 'Speciale', shape: 'orb',     kind: 'shoot',  dmg: 10, cd: .7,  dur: .28, reach: 0,   kb: 260, abi: 'meteor', acd: 6, col: '#ffd24a', desc: 'Magie a distanza', proj: { sp: 620, dmg: 10, r: 8, type: 'orb' } },
    /* --- altre armi --- */
    dagger:   { n: 'Pugnale',      cat: 'Mischia',  shape: 'blade',   kind: 'swing',  dmg: 9,  cd: .26, dur: .2,  reach: 74,  len: 48, kb: 240, abi: 'dash',   acd: 4,   col: '#eaf4ff', desc: 'Colpi rapidissimi' },
    rapier:   { n: 'Stocco',       cat: 'Mischia',  shape: 'blade',   kind: 'thrust', dmg: 11, cd: .34, dur: .26, reach: 106, len: 84, kb: 260, abi: 'dash',   acd: 4.5, col: '#dfe9ff', desc: 'Affondo elegante' },
    flail:    { n: 'Flagello',     cat: 'Mischia',  shape: 'hammer',  kind: 'swing',  dmg: 15, cd: .7,  dur: .4,  reach: 94,  len: 70, kb: 540, abi: 'shock',  acd: 6,   col: '#8a94a8', desc: 'Sfera chiodata' },
    boxing:   { n: 'Guantoni',     cat: 'Mischia',  shape: 'fist',    kind: 'thrust', dmg: 8,  cd: .22, dur: .2,  reach: 58,  kb: 300, abi: 'shock',  acd: 4.5, col: '#ff6a57', desc: 'Raffica di jab' },
    ironhand: { n: 'Mano di Ferro', cat: 'Mischia',  shape: 'gauntlet',kind: 'thrust', dmg: 12, cd: .45, dur: .26, reach: 68,  kb: 460, abi: 'shock',  acd: 5,   col: '#9aa7c2', desc: 'Pugno corazzato' },
    nunchucks:{ n: 'Nunchaku',     cat: 'Mischia',  shape: 'staff',   kind: 'swing',  dmg: 10, cd: .3,  dur: .24, reach: 90,  len: 66, kb: 280, abi: 'dash',   acd: 4,   col: '#b0743c', desc: 'Rotazione continua' },
    lance:    { n: 'Lancia Lunga', cat: 'Mischia',  shape: 'spear',   kind: 'thrust', dmg: 14, cd: .75, dur: .36, reach: 152, len: 126,kb: 380, abi: 'dash',   acd: 5,   col: '#e0c689', desc: 'Portata enorme' },
    pickaxe:  { n: 'Piccone',      cat: 'Mischia',  shape: 'axe',     kind: 'swing',  dmg: 15, cd: .68, dur: .4,  reach: 90,  len: 64, kb: 460, abi: 'shock',  acd: 6,   col: '#9aa7c2', desc: 'Colpo da minatore' },
    saw:      { n: 'Sega Circolare',cat: 'Mischia', shape: 'blade',   kind: 'swing',  dmg: 13, cd: .4,  dur: .3,  reach: 90,  len: 62, kb: 320, abi: 'dash',   acd: 4,   col: '#c9d8f0', desc: 'Lama rotante' },
    yoyo:     { n: 'Yo-Yo',        cat: 'Distanza', shape: 'boomerang',kind: 'throw', dmg: 9,  cd: .5,  dur: .24, reach: 0,   kb: 200, abi: 'dash',   acd: 4,   col: '#4cc9ff', desc: 'Va e torna' , proj: { sp: 760, dmg: 9, r: 7, type: 'boomerang' } },
    icecream: { n: 'Gelato',       cat: 'Mischia',  shape: 'orb',     kind: 'swing',  dmg: 8,  cd: .45, dur: .3,  reach: 80,  kb: 260, abi: 'freeze', acd: 6,   col: '#ff9ad5', desc: 'Freddo e appiccicoso' },
    lollipop: { n: 'Lecca-Lecca',  cat: 'Mischia',  shape: 'orb',     kind: 'swing',  dmg: 10, cd: .55, dur: .32, reach: 86,  kb: 300, abi: 'freeze', acd: 6,   col: '#ff6ad5', desc: 'Dolce mazzata' },
    plasma:   { n: 'Plasma',       cat: 'Distanza', shape: 'gun',     kind: 'shoot',  dmg: 10, cd: .3,  dur: .2,  reach: 0,   kb: 240, abi: 'laser',  acd: 6,   col: '#4ef07a', desc: 'Raggi di plasma', proj: { sp: 1000, dmg: 10, r: 4, type: 'orb' } },
    armcannon:{ n: 'Cannone',      cat: 'Distanza', shape: 'bazooka', kind: 'shoot',  dmg: 15, cd: .8,  dur: .34, reach: 0,   kb: 500, abi: 'bomb',   acd: 6,   col: '#4d5a2c', desc: 'Colpi esplosivi', proj: { sp: 800, dmg: 15, r: 7, type: 'rocket', explode: 70 } },
    flashlight:{ n: 'Torcia',      cat: 'Distanza', shape: 'gun',     kind: 'shoot',  dmg: 5,  cd: .5,  dur: .24, reach: 0,   kb: 140, abi: 'laser',  acd: 5,   col: '#b0c0d0', desc: 'Fascio accecante', proj: { sp: 900, dmg: 5, r: 5, type: 'orb' } },
    kunai:    { n: 'Kunai',        cat: 'Distanza', shape: 'shuriken',kind: 'throw', dmg: 9,  cd: .36, dur: .22, reach: 0,   kb: 220, abi: 'dash',   acd: 4,   col: '#cfd9e8', desc: 'Lame da lancio', proj: { sp: 1000, dmg: 9, r: 4, type: 'shuriken' } },
    cards:    { n: 'Carte',        cat: 'Distanza', shape: 'shuriken',kind: 'throw', dmg: 5,  cd: .5,  dur: .24, reach: 0,   kb: 140, abi: 'dash',   acd: 4,   col: '#ffffff', desc: 'Ventaglio di carte', proj: { sp: 780, dmg: 5, r: 4, type: 'shuriken', triple: true } },
    slingshot:{ n: 'Fionda',       cat: 'Distanza', shape: 'bow',     kind: 'shoot',  dmg: 8,  cd: .5,  dur: .26, reach: 0,   kb: 200, abi: 'meteor', acd: 6,   col: '#8a6a3a', desc: 'Sassi veloci', proj: { sp: 900, dmg: 8, r: 4, type: 'bullet' } },
    shell:    { n: 'Guscio',       cat: 'Distanza', shape: 'bomb',    kind: 'throw',  dmg: 12, cd: .65, dur: .28, reach: 0,   kb: 380, abi: 'bomb',   acd: 5,   col: '#c9a06a', desc: 'Guscio esplosivo', proj: { sp: 620, dmg: 12, r: 8, type: 'bomb', grav: 800, explode: 60 } },
    football: { n: 'Pallone',      cat: 'Distanza', shape: 'boomerang',kind: 'throw', dmg: 13, cd: .65, dur: .26, reach: 0,   kb: 340, abi: 'dash',   acd: 4,   col: '#ffffff', desc: 'Tiro a effetto', proj: { sp: 800, dmg: 13, r: 9, type: 'boomerang' } },
    fan:      { n: 'Ventaglio',    cat: 'Distanza', shape: 'orb',     kind: 'shoot',  dmg: 6,  cd: .38, dur: .22, reach: 0,   kb: 260, abi: 'shock',  acd: 4.5, col: '#c58cff', desc: 'Raffica d\'aria', proj: { sp: 820, dmg: 6, r: 6, type: 'orb', triple: true } },
    laptop:   { n: 'Laptop',       cat: 'Distanza', shape: 'bomb',    kind: 'throw',  dmg: 18, cd: .9,  dur: .32, reach: 0,   kb: 420, abi: 'bomb',   acd: 6,   col: '#6b7488', desc: 'Lancio pesante', proj: { sp: 520, dmg: 18, r: 10, type: 'bomb', grav: 1000, explode: 80 } },
    thunderbolt:{ n: 'Fulmine',    cat: 'Distanza', shape: 'orb',     kind: 'shoot',  dmg: 12, cd: .85, dur: .3,  reach: 0,   kb: 380, abi: 'laser',  acd: 6,   col: '#ffe07a', desc: 'Scarica elettrica', proj: { sp: 900, dmg: 12, r: 6, type: 'orb', explode: 50 } },
    atom:     { n: 'Atomo',        cat: 'Speciale', shape: 'orb',     kind: 'shoot',  dmg: 9,  cd: .5,  dur: .24, reach: 0,   kb: 200, abi: 'meteor', acd: 6,   col: '#4cc9ff', desc: 'Energia instabile', proj: { sp: 640, dmg: 9, r: 8, type: 'orb' } },
    potion:   { n: 'Pozione',      cat: 'Speciale', shape: 'orb',     kind: 'throw',  dmg: 7,  cd: .7,  dur: .28, reach: 0,   kb: 180, abi: 'freeze', acd: 6,   col: '#c58cff', desc: 'Rallenta chi colpisce', proj: { sp: 620, dmg: 7, r: 8, type: 'snow', grav: 700 } },
    lantern:  { n: 'Lanterna',     cat: 'Speciale', shape: 'orb',     kind: 'shoot',  dmg: 8,  cd: .6,  dur: .26, reach: 0,   kb: 220, abi: 'freeze', acd: 6,   col: '#ffd24a', desc: 'Luce che gela', proj: { sp: 700, dmg: 8, r: 7, type: 'orb' } },
    snowflake:{ n: 'Fiocco di Neve',cat: 'Speciale', shape: 'snowball',kind: 'throw',  dmg: 7,  cd: .42, dur: .24, reach: 0,   kb: 180, abi: 'freeze', acd: 5,   col: '#eaf6ff', desc: 'Venti di ghiaccio', proj: { sp: 760, dmg: 7, r: 7, type: 'snow', grav: 300 } },
    magnet:   { n: 'Magnete',      cat: 'Speciale', shape: 'orb',     kind: 'shoot',  dmg: 6,  cd: .6,  dur: .26, reach: 0,   kb: 120, abi: 'pull',   acd: 5,   col: '#ff6a57', desc: 'Attira il nemico', proj: { sp: 600, dmg: 6, r: 7, type: 'orb' } },
    paintbrush:{ n: 'Pennello',    cat: 'Speciale', shape: 'grapple', kind: 'shoot',  dmg: 6,  cd: .55, dur: .26, reach: 0,   kb: 160, abi: 'pull',   acd: 5,   col: '#4ef07a', desc: 'Traccia e trascina', proj: { sp: 900, dmg: 6, r: 5, type: 'hook' } },
    hoverboard:{ n: 'Hoverboard',  cat: 'Speciale', shape: 'boot',    kind: 'thrust', dmg: 8,  cd: .4,  dur: .26, reach: 70,  kb: 320, abi: 'dash',   acd: 3.5, col: '#4cc9ff', desc: 'Scatto fluttuante' },
    lightwheels:{ n: 'Ruote Luminose',cat:'Speciale', shape: 'boot',  kind: 'thrust', dmg: 9,  cd: .42, dur: .26, reach: 68,  kb: 340, abi: 'dash',   acd: 3.5, col: '#4ef07a', desc: 'Scie di luce' },
    spring:   { n: 'Molla',        cat: 'Speciale', shape: 'boot',    kind: 'thrust', dmg: 10, cd: .5,  dur: .28, reach: 66,  kb: 520, abi: 'shock',  acd: 5,   col: '#ffd24a', desc: 'Rimbalzo potente' },
    umbrella: { n: 'Ombrello',     cat: 'Speciale', shape: 'shield',  kind: 'thrust', dmg: 7,  cd: .4,  dur: .26, reach: 60,  kb: 300, abi: 'shield', acd: 4.5, col: '#c58cff', desc: 'Parasole difensivo' },
    wrench:   { n: 'Chiave Inglese',cat:'Speciale', shape: 'hammer',  kind: 'swing',  dmg: 13, cd: .6,  dur: .34, reach: 84,  len: 58, kb: 420, abi: 'shock',  acd: 5.5, col: '#9aa7c2', desc: 'Colpo meccanico' },
    shovel:   { n: 'Pala',         cat: 'Speciale', shape: 'axe',     kind: 'swing',  dmg: 14, cd: .7,  dur: .38, reach: 90,  len: 70, kb: 460, abi: 'shock',  acd: 6,   col: '#8a6a3a', desc: 'Scava e spinge' },
    anchor:   { n: 'Ancora',       cat: 'Speciale', shape: 'hammer',  kind: 'swing',  dmg: 20, cd: 1,   dur: .46, reach: 92,  len: 66, kb: 680, abi: 'pull',   acd: 7,   col: '#7a8a9a', desc: 'Peso inarrestabile' },
    battleaxe:{ n: 'Ascia da Guerra',cat:'Mischia',  shape: 'axe',     kind: 'swing',  dmg: 19, cd: .85, dur: .42, reach: 94,  len: 72, kb: 540, abi: 'shock',  acd: 6,   col: '#c9d8f0', desc: 'Taglio brutale' },
    basketball:{ n: 'Palla da Basket',cat:'Distanza',shape: 'boomerang',kind:'throw',  dmg: 11, cd: .6,  dur: .26, reach: 0,   kb: 300, abi: 'dash',   acd: 4,   col: '#ff9a4a', desc: 'Palleggio aggressivo', proj: { sp: 780, dmg: 11, r: 8, type: 'boomerang' } },
    guitar:   { n: 'Chitarra',     cat: 'Speciale', shape: 'staff',   kind: 'swing',  dmg: 15, cd: .62, dur: .36, reach: 98,  len: 78, kb: 380, abi: 'shock',  acd: 5.5, col: '#b0743c', desc: 'Accordo devastante' },
    harp:     { n: 'Arpa',         cat: 'Speciale', shape: 'bow',     kind: 'shoot',  dmg: 9,  cd: .45, dur: .24, reach: 0,   kb: 180, abi: 'meteor', acd: 6,   col: '#ffd24a', desc: 'Note magiche', proj: { sp: 700, dmg: 9, r: 6, type: 'orb', triple: true } }
  };
  G.WLIST = Object.keys(G.WEAPONS);

  G.DIFF = {
    easy:   { think: .55, acc: .42, jump: .05, abi: .18, shield: .05, name: 'Facile' },
    normal: { think: .3,  acc: .62, jump: .09, abi: .3,  shield: .12, name: 'Normale' },
    hard:   { think: .16, acc: .9,  jump: .12, abi: .45, shield: .22, name: 'Difficile' }
  };

  /* ---------- mappe ---------- */
  const P = (x, y, w) => ({ x, y, w });
  G.MAPS = [
    { id: 'rebirth', n: 'Rebirth', th: { sky: ['#3f7fc0', '#8fc4ea'], far: '#1b3f6b', ground: '#0f2338', top: '#2f5f8f', liquid: '#123a63' }, ground: true, maxY: 452, plats: [P(110, 352, 160), P(690, 352, 160), P(420, 292, 120)] },
    { id: 'dojo', n: 'Dojo', th: { sky: ['#5b3a2a', '#c98a4b'], far: '#3a2317', ground: '#20150f', top: '#8a5a33', liquid: '#1b0f08' }, ground: true, plats: [P(200, 348, 140), P(620, 348, 140), P(400, 256, 160), P(40, 240, 90)] },
    { id: 'highway', n: 'Highway', th: { sky: ['#22314f', '#6b8bb5'], far: '#141e30', ground: '#1b2434', top: '#465a78', liquid: '#0b1220' }, ground: true, plats: [P(0, 372, 170), P(790, 372, 170), P(380, 300, 200), P(300, 200, 120)] },
    { id: 'inferno', n: 'Inferno', th: { sky: ['#3a0d12', '#a8301a'], far: '#22070a', ground: '#2a0d0d', top: '#a3461c', liquid: '#ff5a1f', liquidName: 'lava' }, ground: false, plats: [P(0, 452, 300), P(660, 452, 300), P(390, 360, 180), P(180, 280, 120), P(660, 280, 120)] },
    { id: 'valhalla', n: 'Valhalla', th: { sky: ['#13325e', '#5f8fc4'], far: '#0c2144', ground: '#122238', top: '#3f6a96', liquid: '#081428' }, ground: true, plats: [P(0, 360, 210), P(750, 360, 210), P(330, 330, 300), P(430, 240, 100)] },
    { id: 'cold', n: 'Cold Storage', th: { sky: ['#2a4f6e', '#a8d8e8'], far: '#1d3a52', ground: '#22384a', top: '#8fd0e0', liquid: '#0f2634' }, ground: true, plats: [P(0, 372, 240), P(720, 372, 240), P(400, 300, 160), P(380, 208, 200)] },
    { id: 'relic', n: 'Relic', th: { sky: ['#3b2a1f', '#b88a55'], far: '#241610', ground: '#231710', top: '#8a6236', liquid: '#140c07' }, ground: true, plats: [P(0, 400, 190), P(770, 400, 190), P(250, 340, 120), P(590, 340, 120), P(420, 250, 120)] },
    { id: 'desolation', n: 'Desolation', th: { sky: ['#3a2a4a', '#9a7bb5'], far: '#211830', ground: '#1a1424', top: '#5f4a7a', liquid: '#0a0710' }, ground: true, plats: [] },
    { id: 'jurassic', n: 'Jurassic Spin', th: { sky: ['#2a4a2a', '#9ac46a'], far: '#1a2f1a', ground: '#1d2a1d', top: '#5f8a3a', liquid: '#8a2a0a', liquidName: 'lava' }, ground: false, plats: [P(0, 462, 340), P(700, 462, 260), P(400, 330, 170)], movers: [{ x: 170, y: 300, w: 130, axis: 'x', amp: 150, sp: .5 }] },
    { id: 'kraken', n: 'Kraken', th: { sky: ['#14243a', '#3f6f8a'], far: '#0b1826', ground: '#13202e', top: '#3a6a7a', liquid: '#0f4a6a' }, ground: false, plats: [P(300, 380, 360), P(90, 296, 130), P(740, 296, 130), P(430, 260, 100)], movers: [{ x: 350, y: 440, w: 260, axis: 'x', amp: 40, sp: .3 }] },
    { id: 'colossus', n: 'Colossus', th: { sky: ['#1b2a44', '#567a9a'], far: '#101b2c', ground: '#141f30', top: '#3c5876', liquid: '#080f1a' }, ground: true, plats: [P(120, 380, 90), P(750, 380, 90), P(330, 300, 300), P(430, 208, 100)] },
    { id: 'castle', n: 'Castle Rock', th: { sky: ['#243a2e', '#7ba68a'], far: '#132018', ground: '#18241c', top: '#4f7a5c', liquid: '#07120c' }, ground: true, plats: [P(0, 360, 150), P(810, 360, 150), P(200, 300, 120), P(640, 300, 120), P(420, 240, 120)], spikes: [{ x: 350, y: 500, w: 260, h: 40 }] },
    { id: 'forge', n: 'Forge', th: { sky: ['#2a1414', '#8a4a2a'], far: '#180b0b', ground: '#1e1210', top: '#8a5a2a', liquid: '#ff7a2a', liquidName: 'lava' }, ground: true, plats: [P(0, 400, 220), P(740, 400, 220), P(380, 320, 200), P(200, 240, 130), P(630, 240, 130)] },
    { id: 'ghost', n: 'Ghost Town', th: { sky: ['#2a2440', '#6a5f8a'], far: '#161128', ground: '#191426', top: '#4a3f6a', liquid: '#08050f' }, ground: true, plats: [P(60, 350, 180), P(720, 350, 180), P(380, 280, 200)], movers: [{ x: 430, y: 400, w: 100, axis: 'y', amp: 70, sp: .45 }] },
    { id: 'werewolf', n: 'Werewolf', th: { sky: ['#1b2438', '#4a5a6a'], far: '#0e1420', ground: '#121a22', top: '#3a4a56', liquid: '#060a10' }, ground: true, plats: [P(0, 360, 200), P(760, 360, 200), P(320, 300, 140), P(500, 240, 140)] },
    { id: 'lockout', n: 'Lockout', th: { sky: ['#141c2c', '#3c5470'], far: '#0b1220', ground: '#111a26', top: '#38506a', liquid: '#060c14' }, ground: false, plats: [P(0, 400, 280), P(680, 400, 280), P(380, 320, 200), P(100, 280, 120), P(740, 280, 120)] },
    { id: 'seaport', n: 'Seaport', th: { sky: ['#183a4a', '#6aa8b8'], far: '#0d2430', ground: '#14232c', top: '#3f7a8a', liquid: '#0a3a5a' }, ground: true, plats: [P(120, 350, 180), P(660, 350, 180), P(410, 270, 140)], movers: [{ x: 300, y: 420, w: 120, axis: 'x', amp: 110, sp: .4 }] },
    { id: 'equilibrium', n: 'Equilibrium', th: { sky: ['#232c4a', '#7a86c0'], far: '#141a30', ground: '#181d2c', top: '#4a5378', liquid: '#080a14' }, ground: true, plats: [P(0, 400, 160), P(800, 400, 160), P(240, 330, 160), P(560, 330, 160), P(400, 240, 160)] },
    { id: 'fossil', n: 'Fossil Rift', th: { sky: ['#3a3020', '#b8a070'], far: '#221a10', ground: '#241d12', top: '#8a7040', liquid: '#120c06' }, ground: true, plats: [P(0, 380, 220), P(740, 380, 220), P(380, 300, 200)], spikes: [{ x: 280, y: 500, w: 120, h: 40 }, { x: 560, y: 500, w: 120, h: 40 }] },
    { id: 'legacy', n: 'Legacy', th: { sky: ['#20304a', '#6f8fb0'], far: '#101b2a', ground: '#141e2a', top: '#456a86', liquid: '#070c12' }, ground: true, plats: [P(0, 360, 260), P(700, 360, 260), P(330, 290, 300), P(430, 210, 100)], movers: [{ x: 460, y: 420, w: 90, axis: 'y', amp: 60, sp: .5 }] },
    { id: 'guardian', n: 'Guardian', th: { sky: ['#2a1a3a', '#8a6ab0'], far: '#180e24', ground: '#1c1428', top: '#5a4276', liquid: '#0a0610' }, ground: true, plats: [P(140, 400, 120), P(700, 400, 120), P(340, 320, 280), P(430, 230, 100)] }
  ];

  /* ---------- teste ---------- */
  G.HEADS = {
    none: { n: 'Nessuna', price: 0 }, cap: { n: 'Berretto', price: 80 },
    crown: { n: 'Corona', price: 150 }, tophat: { n: 'Cilindro', price: 120 },
    helm: { n: 'Elmo', price: 200 }, skull: { n: 'Teschio', price: 250 },
    ninja: { n: 'Ninja', price: 180 }, halo: { n: 'Aureola', price: 400 },
    viking: { n: 'Vichingo', price: 300 }
  };

  /* ---------- varianti Battle Mode ---------- */
  G.VARIANTS = [
    { id: 'double', n: 'Double Trouble', d: 'Due armi in mano: la seconda colpisce da sola.', cost: 100 },
    { id: 'boots', n: 'Boots Fight', d: 'Stivali permanenti più un\'arma casuale.', cost: 100 },
    { id: 'radioactive', n: 'Radioactive', d: 'Corpi deformati: arti che cambiano misura.', cost: 100 },
    { id: 'giant', n: 'Giant Weapons', d: 'Armi giganti, colpi ad area più forti.', cost: 100 },
    { id: 'mirror', n: 'Mirror Mode', d: 'Tutti con la stessa arma: duello alla pari.', cost: 100 },
    { id: 'gravity', n: 'Random Gravity', d: 'La gravità cambia durante il match.', cost: 100 },
    { id: 'superjump', n: 'Super Jump', d: 'Salti molto più alti e caricati.', cost: 100 },
    { id: 'nohealth', n: 'No Health Bar', d: 'Niente vita: si vince spingendo nel vuoto.', cost: 100 }
  ];

  /* ---------- monete / livelli ---------- */
  G.XP_PER_LEVEL = 60;
  G.level = (xp) => 1 + Math.floor((xp || 0) / G.XP_PER_LEVEL);
  G.xpInLevel = (xp) => (xp || 0) % G.XP_PER_LEVEL;

  /* ---------- minigiochi ---------- */
  G.MINIGAMES = [
    { id: 'targets', n: 'Tiro al Bersaglio', d: '30 secondi per distruggere più bersagli possibile.', ico: '🎯' },
    { id: 'lastman', n: 'Ultimo in Piedi', d: 'Tu contro 3 CPU: chi resta vivo vince.', ico: '👑' }
  ];

  /* ---------- negozio sfondi (temi arena) ---------- */
  G.BGS = [
    { id: 'tramonto', n: 'Tramonto', price: 0, sky: ['#3a2a5a', '#ff9a6a'], far: '#241a3a', ground: '#1a1424', top: '#7a4a6a', liquid: '#120c1a' },
    { id: 'ghiaccio', n: 'Ghiaccio', price: 150, sky: ['#1b3a5a', '#a8e0f0'], far: '#122a40', ground: '#162a3a', top: '#7fc0d8', liquid: '#0a1a26' },
    { id: 'foresta', n: 'Foresta', price: 150, sky: ['#1a3a2a', '#8ac48a'], far: '#102418', ground: '#14201a', top: '#4a7a52', liquid: '#08120c' },
    { id: 'notte', n: 'Mezzanotte', price: 200, sky: ['#070b1a', '#243a6a'], far: '#0a1228', ground: '#0c1220', top: '#3a4a72', liquid: '#050810' }
  ];
})();
