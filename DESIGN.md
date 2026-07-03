# DESIGN.md - NUCLEO

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

Aree (Flexoki del vault, NON cambiare):
inbox #E8B84A · design #D97757 · finanze #D6A53A · archviz #4FA3A5 · content #C77B91 ·
pc #6487B6 · casa #7D9D78 · idee #9886B8 · ai #B07AA1 · archivio #77736B · logs #979293 ·
sistema #E8D5A8

## Tipografia

- UI: Instrument Sans Variable (unica famiglia; pesi 400/500/600).
- Dati e numeri: JetBrains Mono Variable, `font-variant-numeric: tabular-nums`.
- Scala fissa rem (product): 12 / 13 / 15 (base) / 17 / 20 / 24 / 32. HUD galassia max 44.
- Tracking mai sotto -0.03em. `text-wrap: balance` sui titoli.

## Materia

- Grana fotografica: overlay noise SVG, opacity 0.04-0.06, `pointer-events: none`.
- Pannelli opachi (#100f14 al 96%) sopra galassia scurita; MAI backdrop blur decorativo.
- Z-scale semantica: `--z-hud: 10, --z-pannello: 20, --z-drawer: 30, --z-modal: 40,
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
- Etichette: HTML overlay, solo god nodes + hover + selezione + nomi area; fade con zoom.
- Filamenti: edge on-demand (hover/selezione/toggle); sorprendenti in oro tenue.
- Sfondo: campo stelle ambientale decorativo (dichiarato non-dato) + vignettatura.
