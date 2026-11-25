# Stickman Fight 3D — GattoHub

Duello stickman 2D in stile arcade, con fisica ragdoll, 26 armi e abilità speciali. Intro **GattoHub · GattoItaliano**, home completa con profilo, monete e livelli, poi tutte le modalità.

## Cosa c'è

| Area | Dettagli |
| --- | --- |
| **Home** | profilo con livello ed EXP, monete, Shop, Regali giornalieri, Edit skin, Battle Mode, Map Editor, Mini-game, Boss Fight, Survival, LAN, 1/2/3/4 player |
| **Battle** | 2–4 combattenti sullo stesso dispositivo (umani o CPU), al meglio dei 5 round, 60 s a round, barre vita e cambio arma attivabili, 22 mappe tra cui Rebirth, Dojo, Inferno, Valhalla, Kraken, Colossus, Castle Rock, Seaport e Guardian |
| **Battle Mode** | 8 varianti da 100 monete: Double Trouble, Boots Fight, Radioactive, Giant Weapons, Mirror, Random Gravity, Super Jump, No Health Bar |
| **Survival** | ondate infinite di zombie, ninja, scheletri, fantasmi e titani; solo, in due, o con alleato CPU; record salvato |
| **Boss Fight** | sbloccato al livello 12, 100 tornei con boss gigante e vita crescente, alleato CPU opzionale |
| **Mini-giochi** | Tiro al Bersaglio (30 s) e Ultimo in Piedi |
| **Map Editor** | griglia 32×18, blocchi, trappole, spawn P1/P2, liquido e tema, salvataggio locale e prova immediata |
| **Negozio** | cappelli (corona, cilindro, elmo, teschio, ninja, aureola, vichingo) e sfondi arena |
| **Edit** | colorazione parte per parte dello stickman (testa, busto, braccia, gambe) |

Progressione salvata in `localStorage`: monete, EXP/livello, sblocchi, skin, mappe e record.

## Comandi

**Tastiera**

| | Muovi | Salta | Scudo | Attacca | Abilità | Cambia arma |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | `A` `D` | `W` | `S` | `F` | `E` | `R` |
| P2 | `←` `→` | `↑` | `↓` | `L` | `K` | `J` |

`Esc` mette in pausa.

**Touch / mobile**

- joystick rotondo in basso a sinistra: inclina per muoverti, in alto per saltare, in basso per lo scudo;
- rilascia il joystick inclinato per scatenare l'abilità dell'arma;
- pulsante ⚔ per attaccare, ✦ per l'abilità (con anello di ricarica);
- con 2–4 giocatori ogni giocatore ha il suo joystick in un angolo (P1 in basso a sinistra, P2 in basso a destra, P3/P4 in alto);
- ⏸ in alto a sinistra per la pausa.

## Armi

66 armi in tre categorie (mischia, distanza, speciale), ognuna con danno, portata, recupero, spinta e abilità: pugni, spada, katana, doppia lama, pugnale, stocco, martello, flagello, guantoni, mano di ferro, nunchaku, lancia, lancia lunga, tridente, ascia, ascia da guerra, falce, piccone, sega, scudo, stivali, spada laser, bastone, yo-yo, gelato, lecca-lecca, pistola, cecchino, plasma, cannone, torcia, arco, balestra, fionda, boomerang, shuriken, kunai, carte, bomba, guscio, bazooka, palla di neve, pallone, pallacanestro, ventaglio, laptop, fulmine, rampino, portale, guanto, scettro, atomo, pozione, lanterna, fiocco di neve, magnete, pennello, hoverboard, ruote luminose, molla, ombrello, chiave inglese, pala, ancora, chitarra e arpa.

Abilità: scatto, onda d'urto, scudo, raggio laser, meteore, aggancio, congelamento, teletrasporto e bomba.

## File

| File | Cosa è |
| --- | --- |
| `index.html` | struttura delle schermate (home, pagina, setup, editor, gioco) |
| `style.css` | tutto lo stile, inclusi joystick e HUD |
| `data.js` | armi, mappe, teste, varianti, negozio, minigiochi |
| `engine.js` | motore: fisica, ragdoll, combattimento, IA, modalità, comandi touch, disegno |
| `editor.js` | editor mappe con salvataggio locale |
| `ui.js` | profilo, negozio, regali, setup, avvio partite, fine partita |
| `sw.js` | service worker: rete prima, offline dopo il primo caricamento |
| `manifest.webmanifest` | dati PWA (installazione / APK) |
| `variante-3d/` | vecchia versione 3D, solo riferimento: **non** fa parte del gioco pubblicato |

## Provarlo in locale

```bash
python -m http.server 8147
# http://127.0.0.1:8147/Stickman-Fight-3D/
```

## Come funziona

- Canvas 960×540 disegnato in coordinate fisse e scalato a tutto schermo.
- Ogni combattente ha uno scheletro procedurale (`skel`) e un ragdoll Verlet al K.O., con slow motion, scintille e scie delle armi.
- Le mappe sono dati (`plats`, `movers`, `spikes`, tema) e l'editor produce lo stesso formato, quindi le mappe create si giocano con lo stesso motore.
- Le abilità sono gestite da `doAbility` con raffreddamento per arma; i proiettili hanno gravità, esplosione e ritorno (boomerang).
- L'IA sceglie distanza ideale in base all'arma, salta, si protegge e usa l'abilità in base alla difficoltà.
