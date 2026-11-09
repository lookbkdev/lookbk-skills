---
name: snow-globe-hero
description: "Build a website hero that is one still-life photograph of a glass snow globe on a stone plinth, ray traced in the browser - thick glass with Fresnel and total internal reflection, a water core that magnifies a handmade miniature, a caustic on the ledge - with the headline cut into the plinth as a V-cut inscription filled with paint or gilt and lit by the same light. Every loop the globe is shaken, flakes or glitter swirl, glint and settle, and the room goes still. Two art-directed sets on the editorial composition: a winter café in low sun, and a night observatory in moonlight with gold glitter. One self-contained HTML page plus a paste-in embed on the Motion Heroes kit v2, checked at four widths for text size, contrast and clearance, with a baked still picture if WebGL fails and a frame-exact seamless 14 s 1080p MP4. Use for cafés, bakeries, hotels, observatories, shops, gifts, seasonal launches or any brand that wants one quiet, real object instead of a decorated layout."
license: MIT
---

# Snow Globe Hero

The hero is not a layout with a snow globe in it. It is one photograph of
an object that happens to move. A glass globe on a turned walnut (or
ebonised) base stands on a stone plinth by a window, and the headline is
cut into the plinth's front face: a 45 degree V-cut, built from the
browser's own placement of the headline, filled with dark paint (or gilt),
so the lit wall of each stroke catches the light and the other falls into
shadow. The page keeps its real `h1`; the letters you see are in the
stone.

The glass is traced, not faked. The ball has a thick wall (it goes green
where the path through it is long), it reflects the room in front of it and
the window the light comes through, and near its rim the light runs on
inside the glass (total internal reflection). The water inside magnifies
the miniature and, like any ball lens, shows the room behind it small and
upside down: the window bars on the wall behind come through the glass as
curved dark bands. Under the top of the glass sits a small air cap; where
the water meets the glass there is a thin dark meniscus line with a bright
edge below it. The sun (or the moon) throws the globe's shadow on the
ledge, pale with a darker rim, and inside it the caustic: the light the
ball focuses, about two radii behind its centre, with a red outside and a
blue inside.

The miniature is made in code to read as cast resin: rounded forms joined
with smooth unions, hand-painted colour that wanders a little, a glossy
coat, warm windows that glow through the plaster round them, and snow that
gathers in clumps on whatever faces up. The café set has a small café with
a snow-capped roof and lit windows, two firs, a lamp post and a figure in a
scarf holding a cup, on a drifted mound with a path dug to the door. The
observatory set has a ribbed dome with its slit open and a warm light
inside, a telescope, a fir and a figure looking up, on a crag.

The flakes are a particle system in the globe's own units: drag, a vortex
that spins down, a lift through the middle, flutter, and landing on a
height map of the miniature. It is integrated once for a whole loop and
each flake is eased onto its own resting place over the last of the settle,
so the last frame is the first. Every frame each flake is put on screen
through the glass by solving the refraction for the pixel whose ray passes
through it, and drawn as a flat irregular flake that tumbles (thin when
edge on), glints when its face lines up with the light, stretches along its
motion and softens when it is close to the front glass. Glitter is gold
and silver and flashes a small star.

The loop (14 s) opens on the settled globe. At 2.2 s the globe is shaken:
it jolts side to side, the surface under the air cap sloshes and settles,
the flakes lift off every surface, swirl round the miniature and come down
again; by 12.7 s everything is home and the loop closes on the same frame.
`window.__snowGlobeHolds` lists the settled stretches ([0, 2.2] and
[12.7, 14] at the defaults), so stills and posters come from inside them.
On a live page a quick move across the globe, or a press on it, shakes it
again (once the snow has settled; the loop's phase moves, nothing jumps).

Editorial composition of the kit: the photograph is full bleed, the
headline sits at the foot over columns 1 to 8 (cut into the plinth), and
the copy sits in the kit's plate, framed by a brass card holder let into
the stone. The set is solved from the layout: the plinth face is the page
plane, the camera height, the ledge's depth and the globe's size and place
come from the headline's and the bar's positions, and on tall screens the
globe stands clear of the copy. No chip, no pill button, no second headline
colour. Raw WebGL1, no libraries.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the recording (set `CHROME_PATH` if it isn't found).
- ffmpeg, for the video (or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the fonts (pinned with integrity hashes).

## Steps

### 1. Collect the brand and the words

- **Name** and a logo (`.svg`) or a monogram. Keep the name short enough for a phone's bar next to the bar link (two words).
- **Colours**: the plate colour (the bar and the card in the brass holder), the ink at 7:1 on it, one accent; then the stone (the plinth's face as it looks in the shade) and a paint for the letters at 3:1 or more on it: dark paint on light stone, or gilt on dark stone.
- **The words**: a headline of two short lines (it is cut into the stone at the foot of the hero), a lede, one call to action, up to four links and one bar link.

### 2. Write hero.json

Copy `examples/alder/hero.json` (the café in winter sun, snow, limestone and walnut) or `examples/pell-ridge/hero.json` (the observatory at night, glitter, black basalt and gilt) and replace everything.

| Field | What it is | Limit |
| --- | --- | --- |
| `composition` | `editorial` | – |
| `brand`, `nav[]`, `action` | The bar | 28 / 16 / 20 |
| `hero.title` | The headline; `\n` breaks a line (two lines read best in the stone) | 60 |
| `hero.lede` | The lede, in the brass-framed card | 200 |
| `hero.cta` | The call to action | 26 |
| `theme` | `mode`, `rules` (`off` for this photograph), `background`, `ink`, `accent`, `plate`, `fonts { display, body, mono, weight, advance }` | – |
| `motion`, `meta` | As in every Motion Heroes package | – |

The `effect` settings:

| Setting | Range | Default | What it does |
| --- | --- | --- | --- |
| `scene` | cafe, observatory | cafe (light), observatory (dark) | The miniature and its light: a low sun through a side window, or one shaft of moonlight |
| `flakeKind` | snow, glitter | snow (light), glitter (dark) | Flat white flakes, or gold and silver glitter |
| `flakes` | 60 to 320 | 220 | How many are in the liquid |
| `wall` | colour | the background, 6% toward the ink | The wall behind, in the shade |
| `stone` | colour | the background | The plinth's face in the shade (the ground of the headline) |
| `ledge` | colour | the background, 6% toward white | The plinth's top in the shade |
| `paint` | colour | the ink | The paint or gilt in the cut letters (3:1 on the stone) |
| `sun` | colour | warm (light), cool moonlight (dark) | The key light |
| `sunStrength` | 0.5 to 3 | 1.5 | The key against the fill |
| `fill` | colour | cool grey-blue | The room's fill |
| `base` | walnut, ebony | walnut (light), ebony (dark) | The turned base, with a brass ring |
| `lipLight` | 0 to 2 | 0 (light), 1.25 (dark) | A warm strip light under the ledge lip that grazes the letters |
| `polish` | 0 to 1 | 0 (light), 0.9 (dark) | How mirror-like the plinth's top is (it reflects the globe and base) |
| `cycle` | 12 to 20 | 14 | Seconds for one loop |
| `shakeAt` | 0.5 to 4 | 2.2 | When in the loop the globe is shaken |
| `shake` | 0.4 to 1.4 | 1 | How hard: the jolt, the slosh and the swirl |
| `follow` | true, false | true | A quick move across the globe, or a press on it, shakes it on a live page |
| `grain` | 0 to 1 | 0.5 | A fixed grain, the same on every frame so the loop closes |

### 3. Build, check, look, record

```sh
node <skill>/scripts/build.mjs hero.json out
node <skill>/scripts/check.mjs out/index.html
node <skill>/scripts/record.mjs out/index.html --still 0 --png out/still.png
node <skill>/scripts/record.mjs out/index.html --still 0 --size 390x844 --scale 2 --png out/phone.png
node <skill>/scripts/record.mjs out/index.html --seconds 14 --size 1920x1080 --fps 30 --poster 0
```

Record `cycle` seconds for a seamless loop. Take stills from the settled holds: 0 to 2.2 s and 12.7 to 14 s at the defaults (from `shakeAt` to `cycle - 3.5 + shakeAt` the flakes are in motion).

### 4. Put it live

Upload `index.html` with its `assets/` folder, or paste `embed.html` into your page and copy `assets/` next to it.

## Troubleshooting

- **The page shows the headline in plain text over a photograph of the globe**: WebGL isn't available; the baked still and the real headline stay.
- **The letters are hard to read in the stone**: raise the contrast between `paint` and `stone` (the build stops under 3:1), or add `lipLight` on a dark set.
- **The glass shows one flat colour behind the miniature**: the wall needs some light and shade behind the globe; keep the default sun, or raise `sunStrength`.
- **A slow machine**: the room and the traced object are drawn once per size and cached; each frame only composites them with the moving parts, and the kit lowers the pixel density if frames still run long.

## Files

- `scripts/build.mjs`: builds the page and the embed from `hero.json`.
- `scripts/check.mjs`: the page checks and the hero rules H6 and H9 at four widths.
- `scripts/record.mjs`: records the looping MP4, the poster or one still.
- `scripts/kit/`: the Motion Heroes kit v2 (see `KIT.md`).
- `scripts/effect/effect.mjs`: the settings, checks, letter grounds and the still.
- `scripts/effect/effect.js`: the set solved from the layout, the room and inscription, the traced globe and miniature, the air cap and meniscus, the flake simulation and its drawing (WebGL1).
- `assets/cafe-wide.webp`, `assets/cafe-tall.webp`, `assets/observatory-wide.webp`, `assets/observatory-tall.webp`: baked stills of each set (wide and tall) for the WebGL-off picture.
- `examples/alder/`, `examples/pell-ridge/`: two examples.
