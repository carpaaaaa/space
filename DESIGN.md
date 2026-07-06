# DESIGN.md - space

Estetica: cosmica ma calda e fotografica. Reference: `public/reference/NGC_4414.jpg`.
Un solo registro tipografico (product), una superficie brand (la galassia).

## Token (globals.css, sempre via CSS variables)

Fondo e superfici (scuri caldi, mai blu freddo):
- `--fondo: #05060a` -> `--fondo-2: #0a0c14` (gradiente radiale di scena)
- `--superficie: #100f14` (pannelli, opachi + grana; niente vetro)
- `--superficie-2: #16141c` (righe, hover)
- `--linea: rgba(190, 160, 110, 0.14)` (bordi caldi polvere)

Inchiostri (contrasto verificato su --superficie):
- `--inchiostro: #ece5d8` (~13:1)
- `--inchiostro-2: #b0a795` (~5.6:1, testo secondario)
- `--inchiostro-3: #837a6b` (~3.1:1, SOLO etichette grandi/aux)

Nucleo e accenti:
- `--oro: #f6e7c1`, `--oro-2: #ffd98a`, `--ambra: #ffbf69` (azioni primarie, selezione)
- `--polvere: #8a6a44`, `--polvere-2: #6b4f34`
- `--stella: #dfe9ff`, `--stella-2: #bcd3ff`
- `--errore: #c96a5a`, `--ok: #7d9d78`

Aree: i colori vengono da space.config.json (o dalla palette auto-generata) e
diventano CSS var runtime `--area-<key>`. Sceglili desaturati e leggibili su
fondo scuro; il default in globals.css e solo un fallback.

## Tipografia

- UI: Instrument Sans Variable (unica famiglia; pesi 400/500/600).
- Dati e numeri: JetBrains Mono Variable, `font-variant-numeric: tabular-nums`.
- Scala fissa rem (product): 12 / 13 / 15 (base) / 17 / 20 / 24 / 32. HUD galassia max 44.
- Tracking mai sotto -0.03em. `text-wrap: balance` sui titoli.

## Materia

- Grana fotografica: overlay noise SVG, opacity 0.04-0.06, `pointer-events: none`.
- Pannelli opachi (#100f14 al 96%) sopra galassia scurita; MAI backdrop blur decorativo.
- Z-scale semantica: `--z-pannello: 8, --z-hud: 10, --z-drawer: 30, --z-modal: 40,
  --z-toast: 50, --z-tooltip: 60`.

## Motion

- Pannelli/hover: CSS 160-220ms ease-out. Nessuna coreografia di caricamento.
- Scena galassia: GSAP, fly-to camera 0.9-1.4s expo.out; drift lentissimo della scena.
- Il nucleo respira: glow che varia su ~7s, sinusoide, MAI un dot/anello che pulsa.
- `prefers-reduced-motion`: drift fermo, fly-to istantaneo, transizioni a crossfade.

## Componenti (vocabolario unico)

- Bottone primario: fondo `--oro-2` inchiostro scuro; secondario: bordo `--linea` testo
  `--inchiostro`; ghost per azioni in riga. Focus ring `--oro` 2px offset 2px.
- Riga task: checkbox quadrata, data mono, tag area con pallino PIENO STATICO colore area
  (statico = ok; vietato solo il pulsare).
- Empty state: una riga di testo caldo che spiega, mai illustrazioni generiche.
- Tooltip stella: superficie scura, titolo + meta in mono, bordo colore area.

## Galassia (brand surface)

- Disco inclinato ~55 gradi come la foto NGC; camera orbitale con damping.
- Stelle: sprite radiali additivi, alone morbido; god nodes con alone maggiorato.
- Polvere: sprite seppia blending normale (occlude), corsie tra i bracci.
- Etichette: HTML overlay, una per ogni nota + nomi area + hover + selezione.
  Declutter a ogni frame: area e god node hanno la precedenza, le altre note
  compaiono solo se non si sovrappongono a una gia' mostrata (ordinate per
  dimensione). Avvicinandosi a una zona i suoi nomi si distanziano e altri
  emergono: nessun nome e' perso, la vista d'insieme resta leggibile. Toggle
  "nomi" nei filtri per spegnerle tutte.
- Filamenti: edge on-demand (hover/selezione/toggle); sorprendenti in oro tenue.
- Sfondo: campo stelle ambientale decorativo (dichiarato non-dato) + vignettatura.
