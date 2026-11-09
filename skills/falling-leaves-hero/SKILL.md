---
name: falling-leaves-hero
description: "Build a website hero that reads as one frame from a long lens at a quarter speed - sugar maple or ginkgo leaves painted in code falling through real light, with the headline as a sign standing in the focal plane. Leaves bend, twist, glow when backlit and blur by distance from focus; they flutter, spiral and tumble, a few land on the letters' top edges (solved from the glyph outlines), rest and slide off, and the pointer is a gust. Two worlds: golden hour in a maple wood (centred lockup) and a ginkgo avenue at night under one street lamp (editorial grid). One self-contained HTML page plus a paste-in embed on the Motion Heroes kit v2, checked at four widths for text size, contrast and clearance, with a check that no leaf sits over a letter at any still, a baked still picture when WebGL is off, and a seamless 20-second 1080p loop. Use for autumn stays, bookshops, cafes, gardens, wine and anything seasonal."
license: MIT
---

# Falling Leaves Hero

A photograph that moves. The camera is an 85 mm lens at a wide aperture,
filmed at 120 frames a second and played at 30: there is one plane of
focus, and the headline stands in it as a sign. Leaves in front of the
plane bloom into soft shapes and leaves behind it melt into the backdrop;
the light behind them shows through. The headline is drawn in the scene (the
page keeps the real text for readers and search), so leaves can land on it:
a few per cycle come down onto flat stretches of the letters' top edges, sit
there trembling for a few seconds, then slide along the edge, tip over its
end and fall again, past the lines below.

The leaves are painted in code when the page starts: four sugar-maple leaves
(five serrated lobes, palmate veins, muted crimson, rust, ochre and a turning
leaf, some with tar spots) or four ginkgo fans (a notched margin with small
splits, forked veins, gold to green-gold), each in six pre-blurred focus
levels. Each leaf is cupped, drooped and twisted so its shading changes
across it; the lit face has a waxy sheen, and a leaf between the lens and
the light glows with darker veins.

They fall the way leaves do, not straight down with a spin: about half
flutter (a pendulum zigzag that stalls and turns at each end), others glide
on a banked helix or tumble end over end and drift sideways. Every leaf
lives a whole number of times per cycle, so the video loops seamlessly.
Once per cycle (8 to 10.6 s) a gust crosses the frame from left to right:
it bends every path, flips leaves into a brief tumble and blows one leaf off
the top line. On a live page the pointer is a gust too: leaves near it are
pushed the way it moves, each on its own spring, and settle back onto their
paths.

Two worlds:

- **golden-hour**: a maple wood looking into a low sun. The sun is a hot
  core behind soft branches, with shafts through the haze and 7-blade
  bokeh where light comes through the crowns. The letters are flat, dark
  weathering steel seen against the light. Below the headline the wood
  opens onto a misty meadow in the copy plate's own colour, so the plate
  has no edge to see. On phones the scene continues under the copy as a
  forest floor carpeted with fallen leaves.
- **lamp-night**: a ginkgo avenue at night under one street lamp. Leaves in
  its cone glow; outside it they are silhouettes against the halo. Lamps
  recede down the street as bokeh. The letters are painted, with a thin top
  face lit from above.

The compositions are the kit's **lockup** (an 88 px bar with the brand
centred, the headline centred and fitted to 80% of the width, the copy
under it) and **editorial** (a mono bar with numbered links, the headline at
the foot of columns 1 to 8, the copy in a ruled column at 10 to 12). No
chip, no pill button, no second headline colour.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks, the stills and the recording (set `CHROME_PATH` if it isn't found).
- ffmpeg, for the video (or set `FFMPEG_PATH`).
- Internet access when the page is opened, for three.js r180 and the fonts (pinned with integrity hashes).

## Steps

### 1. Collect the brand and the words

- **Name** and a logo (`.svg`) or a monogram.
- **Colours**: a light theme for golden-hour (background, ink at 7:1 on the plate, a plate in the meadow's pale) or a dark theme for lamp-night; one accent.
- **The words**: a headline of two or three short lines, a lede of one or two sentences, one call to action, up to four links and one bar link.

### 2. Write hero.json

Copy `examples/aldermoor/hero.json` (golden hour, lockup) or `examples/lantern-row/hero.json` (night, editorial) and replace everything.

| Field | What it is | Limit |
| --- | --- | --- |
| `composition` | `lockup` or `editorial` | – |
| `brand`, `nav[]`, `action` | The bar | 28 / 16 / 20 |
| `hero.title` | The headline; `\n` breaks a line (3 lines at most) | 60 |
| `hero.lede`, `hero.cta` | The lede and the call to action | 200 / 26 |
| `theme` | `mode`, `background`, `ink`, `accent`, `plate`, `rules` (editorial: `off` suits a photograph), `fonts { display, body, mono, weight, advance }` | – |
| `motion`, `meta` | As in every Motion Heroes package | – |

The `effect` settings:

| Setting | Range | Default | What it does |
| --- | --- | --- | --- |
| `scene` | golden-hour, lamp-night | follows theme.mode | The world |
| `leaf` | maple, ginkgo | by scene | The species |
| `sign` | steel, painted | by scene | The letters' material |
| `letters` | colour | by scene | The letters' colour (kept at 3:1 or more on everything behind them) |
| `light` | 0.1 to 0.9 | 0.2 / 0.68 | Where the sun or lamp stands across the width on wide screens |
| `air` | colour | by scene | What far leaves fade into |
| `crown` | colour | #d9b83a | lamp-night: the lit ginkgo crown |
| `density` | 0.4 to 1.6 | 1 | How many leaves fall |
| `landings` | 0 to 3 | 3 | Leaves that land on the letters per cycle (2 at most on phones) |
| `gust` | 0 to 1.5 | 1 | Strength of the cycle's gust and of the pointer's |
| `cycle` | 16 to 30 | 20 | Seconds per cycle: the loop of the video |
| `follow` | true, false | true | The pointer is a gust on a live page |
| `grain` | 0 to 1 | 0.5 | Fixed film grain, the same on every frame |
| `seed` | 1 to 9999 | 7 | Where the leaves, crowns and bokeh fall |

### 3. Build, check, look, record

```sh
node <skill>/scripts/build.mjs hero.json out
node <skill>/scripts/effect/still.mjs out/index.html
node <skill>/scripts/check.mjs out/index.html
node <skill>/scripts/effect/coverage.mjs out/index.html
node <skill>/scripts/record.mjs out/index.html --still 1 --png out/still.png
node <skill>/scripts/record.mjs out/index.html --still 1 --size 390x844 --scale 2 --png out/phone.png
node <skill>/scripts/record.mjs out/index.html --seconds 20 --size 1920x1080 --fps 30 --poster 1
```

`still.mjs` bakes the picture shown when WebGL is off (and until the first
frame): the backdrop and the leaves at the still moment, without the letters,
since the page then shows the real headline. Run it whenever you change the
words, colours, scene or seed.

`coverage.mjs` sweeps the whole cycle at 1920, 1440 and 390 px and prints
the settled stretches (no landing, slide or gust in progress) and the
moments inside them where no letter is more than 8% covered by leaves. Leaves
may cross the headline in transit; a poster or a still may not. Take stills
only at the moments it lists, and check them with `--at 1,2.5,7.5` (it exits
1 if one fails). Both examples' still moment is 1 s.

Record `cycle` seconds for a seamless loop.

### 4. Put it live

Upload `index.html` with its `assets/` folder, or paste `embed.html` into your page and copy `assets/` next to it.

## Troubleshooting

- **The page shows the headline in plain text over a still picture**: WebGL isn't available; the baked still and the real headline stay. Run `still.mjs` again if the picture doesn't match your words.
- **No leaf lands on the headline**: the landings need flat stretches on the letters' top edges with free space above them; very light display faces or one-line headlines give fewer. Try another `seed` or a heavier weight.
- **A leaf sits over a letter in your poster**: pick the poster moment from the times `coverage.mjs` lists.
- **A word is too long for the phone layout**: the build says which; shorten it or split the line.

## Files

- `scripts/build.mjs`: builds the page and the embed from hero.json (entry point).
- `scripts/check.mjs`: the page checks and the hero rules H6 and H9 at four widths (entry point).
- `scripts/record.mjs`: the frame-exact recording, stills and poster (entry point).
- `scripts/kit/`: the Motion Heroes kit v2 (see `KIT.md`).
- `scripts/effect/effect.mjs`: the settings, checks, contrast pairs and the still picture.
- `scripts/effect/effect.js`: the leaf atlas, the backdrop, the sign, the paths, the landings and the gust (three.js).
- `scripts/effect/coverage.mjs`: measures how much of each letter the leaves cover, over the cycle.
- `scripts/effect/still.mjs`: bakes the still picture shown when WebGL is off.
- `scripts/effect/stills/`: the two worlds' baked stills, shipped with every build.
- `examples/aldermoor/`, `examples/lantern-row/`: two examples.
