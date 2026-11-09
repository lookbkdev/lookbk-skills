---
name: proof-band-kit
description: "Build the \"trusted by\" band that sits under a hero from one proof.json - customer logos and a few numbers, set like the figures page of an annual report. Every logo is measured from its own SVG (ink box, aspect, ink density) and sized to the same visual weight on one baseline per row. Every figure is in tabular numerals with a numbered note giving its basis, source and as-of date; the build refuses a figure without a source, a future date, \"+\" or \"up to\", and any number not tied to a note. Each logo opens on hover, focus or tap to one line on what that customer uses the product for. Three layouts, two finished looks (ledger and signal), an optional slow marquee that pauses, phone and tablet layouts, a paste-in embed, a check at four widths that re-measures the balance, and a frame-by-frame recorder. Use for customer logos, operating figures and \"in use at\" bands on product, SaaS and B2B pages."
license: MIT
---

# Proof Band Kit

The band under a hero that says who uses the product and what it has done. The governing idea: **a proof band is a set of claims, so set it the way an annual report sets its figures.** Every customer mark sits at the same optical weight on one baseline. Every number is in tabular figures with a numbered note that gives its basis, its source and its as-of date. **The build refuses a number with no source.**

**What makes it different from a logo strip and three counters:**

- **Optical balance, measured.** Each SVG is drawn on a canvas and measured: its real ink box (the whitespace inside the file is cropped away), its aspect ratio and its ink density (inked area over ink box). Every mark is then sized so that `ink width × ink height × density^0.5` is the same for all of them. A dense black slab is set smaller and a thin serif larger until they read as equally heavy. One weight is used for the whole band; it is raised if any mark would fall under 14 px tall and lowered if any mark would outgrow its cell, and if no single weight can satisfy both the build page says which logo is the cause.
- **One baseline per row.** Wordmarks sit their baseline (from the SVG's `data-baseline`, or the config) on the row's baseline, which is snapped to an 8 px grid. Stacked or symbol-led lock-ups (`"align": "center"`) centre on half the wordmarks' cap height above it, so a two-line logo doesn't float.
- **Numbers with receipts.** Figures never count up. Each one has a marker that links to its note (and the note links back). The notes list basis, source and as-of date for every figure.
- **Logos that say something.** Each mark opens to "what they use it for" and a link to the case: in its own cell on the grid, in a caption line under the row, or in a full-width drawer under the tapped row on a phone.

The balance code is one file, `kit/balance.js`. The page runs it, and the check loads the same file into the built page again to re-measure what was drawn: it fails if any two marks differ in ink weight by more than 10 % or sit more than 1 px off their row's baseline.

**The three layouts** (`"layout"`):

1. **grid**: a ruled specimen table. Ink rules top and bottom, hairlines between cells, 3 to 6 across on a desktop (`columns`), 2 on tablets and phones. Each cell has the customer's sector in small capitals and the mark on the baseline. Open, the mark lifts 24 px, the cell takes a shade, and the use line and "Read the case" rise into it. Under the table: the figures, then the notes.
2. **row**: one ruled line of equal cells under the statement, a caption line under it, then the figures and the notes. If the marks don't fit one row at their weight, it wraps to two balanced rows (6 becomes 3 + 3, 7 becomes 4 + 3), then three, before any mark would shrink; every mark is centred in its own cell, so none touches the edge of the band. With `marquee` the row becomes a slow loop instead (see below).
3. **figures**: the numbers are the headline. Two to four figures across between vertical hairlines, then the "Run by" marks in a ruled grid with the caption line, then the notes.

**Motion**: an entrance that plays once, when the band comes into view: the rules draw from the left (600 ms), the marks fade and rise 8 px (420 ms, 45 ms apart), the figures fade in at their value (360 ms, 80 ms apart), and the note markers arrive last. Under 1.6 s in all, then still. Opening a mark takes 320 ms. **Marquee** (row only, off unless `marquee` is set): 12 to 32 px a second, stops while the pointer is over it or focus is inside it, has a visible Pause button, and never starts under reduced motion (the row is a static grid then). With `prefers-reduced-motion` everything is in place from the start and opening a mark is instant. Without JavaScript every use line is shown under its mark.

**What you can change, honestly**: every word, number, note, logo and link; the layout and column count; the look (`ledger` or `signal`) and its page, ink and accent colours; the balance's size. The type, spacing and motion of each look are the design.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the video (found automatically; set `CHROME_PATH` if not).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`, or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the look's fonts (pinned on jsDelivr with an integrity hash). Without it system fonts stand in.
- **The customers' logos as SVG files** with a viewBox and the type converted to outlines (no live `<text>`, no embedded bitmaps). A PNG cannot be measured or recoloured.
- **The real numbers and where they come from.** For each figure: the value, what it measures, the source (a ledger, a report, a meter) and the date it is true as of. If a number has no source, leave it out; the build will not take it.
- Permission to show each customer's logo.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/balance.js`: the optical balance. Measures each SVG's ink box, aspect, density and baseline on a canvas, and works out one shared weight and every mark's size. Used by the page and, a second time, by the check.
- `kit/runtime.js`: the browser runtime, inlined into every build. Places the marks on their baselines, picks the column count, fits the figures, opens marks (cell, caption line or phone drawer), plays the entrance once, runs the marquee, and the recording clock.
- `kit/proof.css`: the whole design, scoped to `.pb`. The three layouts, the two looks, the tablet and phone rules, the debug view and the demo page around the band.
- `scripts/build.mjs`: proof.json to `out/index.html` (a short hero with the band under it) and `out/proof-embed.html` (the band to paste in).
- `scripts/kit/schema.mjs`: every field, its limits, the honesty rules for numbers and the colour rules; lists every problem at once.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, including the balance and the baseline.
- `scripts/record.mjs`: the preview video, stills, the debug still (`--debug`) and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/quaywise/proof.json` (grid, ledger), `examples/quaywise/proof.row.json` (the same customers as a row with the marquee), `examples/gridmere/proof.json` (figures, signal), each with its `logos/` folder.

## Steps

### 1. Collect the content

- **4 to 12 customers**: the name, the SVG logo, one line (90 characters at most) on what they use the product for, and the link to their case study if there is one. On the grid, a short sector label too ("Cold chain").
- **2 to 4 figures**: the value, a unit, a one-line label, and a note for each: the **basis** (what was counted, over what, how many), the **source**, and the **as-of date**. Ask for the source; don't supply one.
- A **statement** of up to 110 characters, with one phrase to turn (`_like this_`), and a short eyebrow.

Words such as "Eight" are fine in the copy. Digits anywhere outside the figures need a `[n]` marker pointing at a note, or the build stops.

### 2. Write proof.json

Start from the example closest to what you need and change it. Keep the logos in a folder next to the config; paths are relative to it.

```
cp -r <skill>/examples/quaywise my-band
```

### 3. Build

```
node <skill>/scripts/build.mjs my-band/proof.json out
```

The build lists every problem at once and writes nothing until they are fixed: a figure without a note, a note without a source, an as-of date in the future, "+", "up to", "over" or "more than" next to a number, a digit in the copy with no marker, a logo that is not a clean SVG. Warnings (a figure older than 18 months, a note nothing uses, a stat that reads like a rating) are printed but don't stop it.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

Each line reports the contrast, the number of marks and rows, the weight spread and how far any mark sits off its baseline, for example `8 marks in 2 rows, weight spread 1.003x (max 1.1), baseline off by 0.03px`. Fix every failure before you ship.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Hover, tab to and click the marks. Add `?pb-debug=1` to see each mark's measured ink box, its size and density, and the shared baseline. That is the quickest way to see why a logo was set the size it was.

### 6. Put it on the site

Paste `out/proof-embed.html` under your hero. It brings its fonts, styles and script, and every class starts with `pb-`. Use one band per page.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 8 --poster 5
node <skill>/scripts/record.mjs out/index.html --still 5 --size 390x844 --scale 2 --png phone.png
```

`--moments` prints the stretches where nothing on the band is changing; take stills and posters from inside them. The script scrolls from the hero onto the band (0.8 to 2.4 s), plays the entrance, opens the marks in `preview.open` in turn (from 3.6 s and 6.4 s), and ends at 8 s.

## proof.json, every field

| Field | Required | What it is | Range / default |
| --- | --- | --- | --- |
| `layout` | yes | `grid`, `row` or `figures` | |
| `brand` | yes | your brand, for the page title and the demo hero | up to 40 characters |
| `theme.preset` | yes | `ledger` (light, Newsreader figures, Geist text) or `signal` (dark, Inter Tight figures, JetBrains Mono labels) | |
| `theme.page`, `theme.ink`, `theme.accent` | no | `#rrggbb` overrides | ink on page at least 7:1; accent on page at least 4.5:1 |
| `eyebrow` | yes | one or two short lines above the statement | first up to 32 characters, second up to 56 |
| `statement` | yes | the line under the eyebrow; `_turn_` one phrase | up to 110 characters |
| `columns` | no | grid columns on a desktop | 3 to 6, default 4 |
| `marks[]` | yes | the customers | 4 to 12 |
| `marks[].name` | yes | the customer's name; the logo's accessible name | up to 48 characters |
| `marks[].svg` | yes | path to the SVG, relative to proof.json | a viewBox, outlines, no script or bitmaps |
| `marks[].use` | yes | what they use the product for | up to 90 characters |
| `marks[].href` | no | the case study | `https://`, `/` or `#` |
| `marks[].sector` | no | grid only: a small label in the cell's corner | up to 24 characters |
| `marks[].align` | no | `baseline`, or `center` for stacked and symbol-led lock-ups | default `baseline` |
| `marks[].baseline` | no | where the baseline is, as a share of the SVG's height from the top | 0 to 1; default the SVG's `data-baseline`, else 1 |
| `marks[].keepColour` | no | keep the logo's own colours instead of the band's single ink | default false |
| `stats[]` | yes | the figures | 2 to 4 |
| `stats[].value` | yes | a plain number as text: `"4.1"`, `"38,200"` | no "+", ranges or words |
| `stats[].prefix`, `stats[].unit` | no | set smaller beside the number: `"$"`, `"%"`, `"days"` | up to 2 and 5 characters |
| `stats[].label` | yes | what the number measures | up to 80 characters |
| `stats[].note` | yes | which note gives its source (counting from 1) | must exist |
| `notes[]` | yes | one per sourced figure | |
| `notes[].basis` | yes | what was counted, over what, how many | up to 180 characters |
| `notes[].source` | yes | where the number comes from | up to 70 characters |
| `notes[].asOf` | yes | the date it is true as of | `YYYY-MM-DD`, not in the future; a warning after 18 months |
| `notesHead` | no | the notes' heading | default `Notes` |
| `runLabel` | no | row and figures: the label beside the marks ("Run by") | up to 24 characters |
| `captionLabel`, `captionHint` | no | row and figures: the caption line's label and its text before a mark is opened | |
| `balance.area` | no | how big a mark of median density is, in square px of ink | 1200 to 9000, default 3300 |
| `balance.densityWeight` | no | how much ink density counts (0 sizes by area alone) | 0 to 1, default 0.5 |
| `balance.maxHeight` | no | the tallest a mark may be on a desktop | 24 to 96 px, default 54 |
| `marquee.speed` | no | row only: turns on the slow loop | 12 to 32 px a second |
| `preview.open` | no | the two marks the recorder opens | two indexes, default `[1, 3]` |
| `demo` | no | the demo page's hero: `headline`, `lede`, `cta {label, href}`, `nav [{label, href}]`, `footer` | |
| `lang` | no | the page's language | default `en` |

## Troubleshooting

- **The build lists problems and writes nothing.** Fix them all and build again; it reports everything at once.
- **"stats[1] has no source".** Give the figure a note with its basis, source and as-of date, or remove it. There is no switch to turn this off.
- **"marks[0].use has a number with no source".** Add a `[n]` marker that points at a note, or say it without the digit.
- **A logo looks too big or too small.** Open the page with `?pb-debug=1`. If the dashed ink box includes something that isn't the logo (a stray point, a white rectangle behind it), clean the SVG. A logo with lots of empty space inside its own artwork will look light; that is the logo, not the balance.
- **A logo floats above or below the others.** Set its `baseline` (the share of its height where the letters sit), or `"align": "center"` for a stacked lock-up.
- **"cannot be 14 px tall and still match the weight the widest mark can reach".** One very wide wordmark is forcing everything small. Use a stacked or shorter version of that logo, or fewer columns.
- **The check says the marks are not balanced.** Something in your own CSS is resizing `.pb-logo svg`. Remove it; the runtime sets the sizes.
- **The row wrapped to two lines.** The marks didn't fit one row at their weight. Lower `balance.area` a little, or use fewer marks.
- **No video.** Install ffmpeg or set `FFMPEG_PATH`. The checks and stills don't need it.
