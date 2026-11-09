---
name: parallax-depth-hero
description: "Build a centred-lockup website hero that works like a multiplane camera - a scene painted in code on 6 plates at real distances from the lens (a mountain range at first light with eroded rock, old snow, spruce, valley fog and grass at the lens; or a city at night with towers lit by floor, a moon, roofs with chimneys and a gable, a water tower and a festoon of lamps), where the headline is the plate between them - the far plates drift against the pointer, the near ones move with it, the words never move, and the near plates pass in front of the foot of the letters. Scrolling raises the camera over 1.25 screen heights: the near ridge drops clear of the words while the far ranges and the sun (or moon) rise behind them. Air, mist, defocus and light are computed, no near plate ever covers more than 30% of any letter (measured per letter in the real font), and the copy plate sits in the scene (in the fog, or on the roof). One self-contained HTML page plus a paste-in embed on the Motion Heroes kit v2, checked at four widths, with a baked still of the scene when WebGL is off and a 1080p MP4 of the scroll. Use for walking holidays, guesthouses, outdoor brands, rooftop restaurants, hotels and any brand whose pitch is a view."
license: MIT
---

# Parallax Depth Hero

A multiplane camera, in code. The old animation rigs painted a landscape on
sheets of glass stacked at real distances from the lens; when the camera
moved, each sheet moved by its distance and the picture gained depth that no
single painting has. This hero is that rig with the headline as one of the
sheets. Six plates sit at distances 9, 5.4 and 3.4 (behind the words), 2.5
(the headline), 1.6 and 1 (in front), and every plate moves by
`cam × (2.5 / z − 1)`: the headline is the pivot that never moves, the far
plates drift against the pointer, the near ones move with it, faster the
nearer they are.

The look comes from the air, not from styling. Every plate is mixed toward
the colour of the air by its distance (`1 − exp(−z·k)`), the air brightens
and warms toward the light, mist lies in each valley, the near plates are
drawn out of focus by their circle of confusion (a grass blade thinner than
the blur turns wide and faint, highlights bloom into discs), and the low sun
lays a rim of light only on the crests near it.

**scene `range`** (light): a far range with old snow, a second range, a
wooded shoulder with a canopy of crowns, a near ridge of ragged spruce in
front of the words, a sea of valley fog where the copy sits, spruce tops
standing out of the fog and grass at the lens. The sun stands behind the
first line at rest and rises as you scroll.

**scene `city`** (dark): a far skyline of soft lit-floor bands, a nearer one
with big framed windows, masts with blinking red lights, a moon placed so it
never sits behind a letter, and the roofs across the street in front of the
words: a parapet with a lit coping, chimney stacks with caps and pots, a
gable with a ridge, a water tower past the end of the headline and a festoon
of lamps strung between two poles. A terrace railing at the lens, far out of
focus, catches the lamps.

**The letters stay readable, by construction.** At every resize each letter
(letters and digits) is drawn alone in the page's real font and the height
is found that leaves `cover` (default 30%) of its ink below it. No near plate
is drawn above that line in that letter's columns, and the trees, chimneys
and gable are grown to fit under it, so nothing looks sliced.
`scripts/coverage.mjs` measures the real share over the whole scroll at 4
widths and fails above a third.

This is the kit's **lockup** composition: an 88 px bar with the brand
centred, the headline centred and fitted to 85% of the width, and under it
the lede and one ruled call to action. The scene meets that plate: in the
range it is the fog, in the city the roof, each in exactly the plate's
colour. On phones the lines wrap and the scene hangs from the last lines. No
chip, no pill button, no second headline colour. Raw WebGL1, no libraries.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks, the still and the recording (set `CHROME_PATH` if it isn't found).
- ffmpeg, for the video (or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the fonts (pinned with integrity hashes).

## Steps

### 1. Collect the brand and the words

- **Name** and a logo (`.svg`) or a monogram.
- **Colours**: a light theme for the range (dark ink) or a dark theme for the city (light ink); ink at 7:1 on the plate; one accent (the call to action's rule).
- **The words**: a headline of two short lines (it is set very large: on a phone each word may take its own line, so keep the hero to 844 px tall by checking with the phone still), a lede of one or two sentences, one call to action, up to four links and one bar link.

### 2. Write hero.json

Copy `examples/harrow-fell/hero.json` (the range, a walking company) or `examples/kestel-roof/hero.json` (the city, a rooftop restaurant) and replace everything.

| Field | What it is | Limit |
| --- | --- | --- |
| `composition` | Always `lockup` for this effect | – |
| `brand`, `nav[]`, `action` | The bar: brand centred, links split either side, the bar link at the right | 28 / 16 / 20 |
| `hero.title` | The headline; `\n` breaks a line (3 lines at most); `*words*` set the italic in the same colour | 60 |
| `hero.subtitle`, `hero.lede` | A display line and the lede | 64 / 200 |
| `hero.cta` | The ruled call to action | 26 |
| `theme` | `mode`, `background`, `ink`, `accent`, `plate`, `fonts { display, body, weight, advance }` | – |
| `motion`, `meta` | As in every Motion Heroes package | – |

The `effect` settings:

| Setting | Range | Default | What it does |
| --- | --- | --- | --- |
| `scene` | range, city | range on a light theme, city on a dark one | Which world is painted on the plates |
| `depth` | 0 to 1.5 | 1 | How far the plates travel against each other with the pointer; 0 holds them still |
| `rise` | 0 to 1 | 0.8 | How far the camera rises over the scroll (the near ridge drops clear, the far ranges and the sun rise) |
| `cover` | 0.1 to 0.33 | 0.3 | The most of any letter's ink a near plate may ever cover; the build refuses more than a third |
| `scroll` | true, false | true | Pin the hero for 1.25 screen heights and raise the camera as the visitor scrolls; false: no pin |
| `light` | 0.1 to 0.9 | 0.7 | Where the sun (or moon) stands across the width |
| `mist` | 0 to 1 | 0.6 | Mist in the valleys between the plates, and its drift |
| `sky` | colour | the scene's own | The sky overhead |
| `glow` | colour | the scene's own | The sky at the horizon, and the colour the air takes toward the light |
| `land` | colour | the scene's own | The nearest plate before any air; the far plates are this colour seen through more air |
| `grain` | 0 to 1 | 0.5 | Fixed film grain, the same on every frame |
| `seed` | 1 to 9999 | 3 | Where the peaks, trees and buildings fall |

### 3. Build, bake the still, check, look, record

```sh
node <skill>/scripts/build.mjs hero.json out
node <skill>/scripts/still.mjs out/index.html
node <skill>/scripts/check.mjs out/index.html
node <skill>/scripts/coverage.mjs out/index.html
node <skill>/scripts/record.mjs out/index.html --still 0 --png out/still.png
node <skill>/scripts/record.mjs out/index.html --still 0 --size 390x844 --scale 2 --png out/phone.png
node <skill>/scripts/record.mjs out/index.html --seconds 9 --size 1920x1080 --fps 30
```

`still.mjs` bakes the picture shown when WebGL is off (and before the first
frame): the whole scene at frame 0, wide and tall, into `out/assets/`.
`build.mjs` ships the examples' pictures until you bake your own, so run it
after every change of colours, scene or seed. `coverage.mjs` steps the
scroll at 0.5 s intervals with 6 pointer positions at 1440, 1024, 768 and
390 px and exits 1 if any letter is covered more than a third. The
recording rests 0.8 s, raises the camera for 6 s and holds; 9 seconds shows
all of it.

### 4. Put it live

Upload `index.html` and `assets/`, or paste `embed.html` into your page and copy `assets/` next to it.

## Troubleshooting

- **The page shows a still picture and the plates never move**: WebGL isn't available (or the visitor asked for reduced motion: then frame 0 is drawn once). The still is the baked scene; rebake it with `still.mjs` if it shows the example's colours.
- **The build refuses the scene**: a dark theme needs `scene: "city"` and a light theme `scene: "range"`, so the ink reads on the sky.
- **The near plate hardly crosses the letters**: raise `cover` toward 0.33, or use a display face with longer descenders and stems; the trees and chimneys grow as tall as each letter allows.
- **The phone still opens with the bar scrolled away**: the headline wraps into too many tall lines; use fewer or longer words so the fitted size drops.
- **Frames drop on an older machine**: the scene draws at most 1.5 device pixels per CSS pixel (measured 4.8 ms a frame at 1440×900 and 9.8 ms, p95 10.1 ms, on a 2x screen for the range on an Apple M5); the kit also lowers the pixel ratio on slow machines.

## Files

- `scripts/build.mjs`, `check.mjs`, `record.mjs`: the kit's entry points (build the page, check it at four widths, record the video and stills).
- `scripts/still.mjs`: bakes the WebGL-off still picture of your own scene into `out/assets/`.
- `scripts/coverage.mjs`: measures how much of each letter the near plates cover, over the scroll and the pointer's extremes.
- `scripts/kit/`: the Motion Heroes kit v2, unchanged (see `KIT.md`).
- `scripts/effect/effect.mjs`: the settings, checks, still picture and story.
- `scripts/effect/effect.js`: the plates, the air and the light (one WebGL1 shader, two passes), the per-letter ceiling and the roofs' layout.
- `scripts/effect/stills/`: the examples' baked still pictures.
- `examples/harrow-fell/`, `examples/kestel-roof/`: two examples.
