---
name: aperture-reveal-hero
description: "Build a website hero that looks through a real lens iris whose aperture lives in the headline - nine curved blades, each turning on its own pin, centred in the counter of an O so that at f/22 the opening fits inside the letter and opened up the scene pours out of it. The scene behind is re-rendered for every f-number (depth of field, bokeh in the iris's own shape, diffraction stars stopped down, exposure), the ring clicks from stop to stop and the pointer turns it. Two scenes: a timber pier with lanterns at night (dark), or a stone cloister at noon. One self-contained HTML page plus a paste-in embed on the Motion Heroes kit v2 lockup or editorial composition, checked at four widths for text size, contrast and clearance, with a baked still picture for WebGL failure and reduced motion, and a 1080p MP4 of one 12 s loop. Use for camera and lens makers, photographers, eyewear, opticians, studios, cafes, hotels or any brand whose promise is seeing clearly or letting the light in."
license: MIT
---

# Aperture Reveal Hero

The view through a real lens. Nine curved blades of satin black steel
fill the hero; the only way through them is the opening, and the opening
sits in the counter of an O in the headline. Stopped down to f/22 it is a
small sharp nine-sided window inside the letter, with a ring of blade
between the window and the letter's inner edge, and the lights in the
scene burst into 18-point stars. The aperture ring clicks open stop by
stop: the blades swing back on their pins, the opening rounds off and
outgrows the letter, and the scene floods the frame, brighter and shallow,
its lights melted into soft discs in the shape of the iris. Then it clicks
closed to a different stop and holds, and back.

The iris is built like the real mechanism. Each blade's cutting edge is an
arc of one fixed radius and each blade turns about its own pin; for any
opening the turn is solved in closed form, so the polygon turns a few
degrees as it closes, exactly as a real one does. Blade i lies over blade
i+1, the seams are the blades' own edge arcs, each blade shades the one
under it and has a thin bevel catching one key light. The opening's
diameter is k / N: the printed scale tells the truth.

The scene behind is painted in code and rendered for the current f-number:
a circle of confusion per depth (near posts and far shores melt wide open,
everything is sharp stopped down), every light drawn as a disc in the
iris's current shape (rebuilt from the blades each frame, so at f/4 the
bokeh are visible nine-gons), clipped toward a cat's eye near the frame's
edges wide open only, two diffraction spikes per straight edge stopped
down (nine edges: 18 spikes), and an exposure that grows by about three
stops from f/22 to f/1.4 on the pier and two in the courtyard.

The headline lives in the scene (typeMode `scene`): the page keeps the
real text for readers and search, and the letters you see are drawn by the
effect, in `theme.ink` over the scene and in `effect.bladeInk` over the
blades, so where the iris's edge crosses a word the letters change colour
exactly at the edge. Behind every letter a guard holds the scene under a
soft ceiling (dark themes) or over a soft floor (light themes), and the
package measures it: on every hold of the loop, the darkest contrast under
any letter pixel is 4.7:1 or better (see Performance and checks).

Two compositions: the kit's **lockup** (the headline centred, the iris
full bleed, the scale as a column at the right edge) and **editorial** (the
headline at the foot of columns 1 to 8, the copy in a ruled column at the
right, the scale engraved over it). No chip, no pill button, no second
headline colour in the page. Raw WebGL2, no libraries.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the recording (set `CHROME_PATH` if it isn't found).
- ffmpeg, for the video (or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the fonts (pinned with integrity hashes).

## Steps

### 1. Collect the brand and the words

- **Name** and a logo (`.svg`) or a monogram.
- **Colours**: a plate colour (the bar and the copy), the ink at 7:1 on it, one accent. Dark themes take the `pier`, light themes the `court`.
- **The words**: a headline of two or three short lines **with a round O in it** (a geometric sans or a serif with a round O sets the best counter; the build picks the O in `effect.word`), a lede, one call to action and an optional plain link, up to four links and one bar link.

### 2. Write hero.json

Copy `examples/thale/hero.json` (the pier at night, lockup, dark) or `examples/corte/hero.json` (the courtyard at noon, editorial, light) and replace everything.

| Field | What it is | Limit |
| --- | --- | --- |
| `composition` | `lockup` or `editorial` | – |
| `brand`, `nav[]`, `action` | The bar | 28 / 16 / 20 |
| `hero.title` | The headline; `\n` breaks a line; it needs an O | 60 |
| `hero.lede`, `hero.cta`, `hero.link` | The copy plate | 200 / 26 / 26 |
| `theme` | `mode`, `background`, `ink`, `accent`, `plate`, `rules`, `fonts { display, body, mono, weight, advance }` | – |
| `motion`, `meta` | As in every Motion Heroes package | – |

The `effect` settings:

| Setting | Range | Default | What it does |
| --- | --- | --- | --- |
| `scene` | pier, court | by theme.mode | The pier with lanterns at night, or the stone cloister with a fountain at noon |
| `word` | text | the O nearest the middle | The word whose first O holds the iris |
| `loop` | three f-numbers | `22 1.4 4` (dark), `1.2 22 2.8` (light) | Frame 0's stop, the stop it clicks to, the different stop it clicks to before returning; one 12 s loop |
| `widest` | 1.2, 1.4 | 1.4 | The widest stop on the printed scale |
| `bladeInk` | colour | theme.ink (dark), #efe8dc (light) | The letters' colour over the blades; it needs 4.5:1 on them |
| `exposure` | 0.6 to 1.6 | 1 | Overall brightness of the scene |
| `scale` | true, false | true | Print the f-number scale |
| `follow` | true, false | true | The pointer turns the aperture ring on a live page |
| `grain` | 0 to 1 | 0.5 | A fixed grain, the same on every frame |

### 3. Build, check, look, record

```sh
node <skill>/scripts/build.mjs hero.json out
node <skill>/scripts/check.mjs out/index.html
node <skill>/scripts/record.mjs out/index.html --still 0 --png out/start.png
node <skill>/scripts/record.mjs out/index.html --still 5.6 --png out/open.png
node <skill>/scripts/record.mjs out/index.html --still 0 --size 390x844 --scale 2 --png out/phone.png
node <skill>/scripts/record.mjs out/index.html --seconds 12 --size 1920x1080 --fps 30
```

Take stills only from inside a hold: the page lists them as
`window.__apertureHolds` (for `22 1.4 4`: 0 to 2.4 s, 4.32 to 7 s, 7.96 to
10 s, 11.2 to 12 s). The 12 s recording is one whole loop; its last frame
meets its first.

### 4. Put it live

Upload `index.html` with its `assets/` folder, or paste `embed.html` into
your page and copy `assets/` next to it (the still picture lives there).
On a live page the pointer's position across the hero sets the f-stop,
in clicks; when it rests the ring goes back to the loop.

## Performance and checks

Two passes. The scene (the costly part: the painted place and every light
as a shaped disc) goes into a texture, at full resolution at rest and in
recordings, at a fixed budget while the ring moves (1.1 million pixels on
wide screens, 0.5 million on phones); the iris, the letters, the scale and
the grain are drawn on top at full resolution. Where the blades cover a
pixel the scene isn't computed. When the ring holds still nothing is drawn.

Measured by timing each draw with a GPU sync in Chrome on an Apple M5 (a
fast laptop, so treat these as a floor, not a promise), 360 frames over
the whole loop at 1440x900 on a 2x screen: the pier while moving median
1.9 ms, p95 3.0 ms; the courtyard median 1.9 ms, p95 2.5 ms; one
full-resolution frame at rest 1.7 to 9.9 ms. On a 390x844 phone at 2x,
moving p95 2.3 ms and 1.7 ms.

Legibility: in a recording, `window.__apertureCheck()` redraws the frame
without the letters, reads it back and returns the lowest contrast under
any pixel of the headline or the scale, against the colour that pixel is
drawn in (the one-pixel antialiased band where the iris's edge crosses a
letter is counted apart). On every hold of both examples, desktop and
phone, it is 4.7:1 or better.

## Troubleshooting

- **The page shows the plain headline over a picture of the scene**: WebGL2 isn't available; the baked still and the real headline stay. Rebake it with `node scripts/effect/bake.mjs out/index.html scripts/effect/stills/aperture-pier.jpg` after changing a scene.
- **The iris isn't in the O you wanted**: name the word in `effect.word`; the first O of that word holds it.
- **The build stops on `effect.scene`**: the pier needs a dark theme and the courtyard a light one, because the guard and the letters' colours depend on it.
- **The build stops on `effect.loop`**: give three different f-numbers from the ring, like `22 1.4 4`.
- **A word is too long for the phone layout**: the build says which; shorten it or split the line.

## Files

- `scripts/build.mjs`, `check.mjs`, `record.mjs`: the entry points the buyer runs.
- `scripts/kit/`: the Motion Heroes kit v2, unchanged (see `KIT.md`).
- `scripts/effect/effect.mjs`: the settings, the build checks, the guaranteed type grounds and the still picture.
- `scripts/effect/effect.js`: the iris on its pins, the two scenes, the lights and their bokeh, the loop and the ring under the pointer, the letters and the scale, and the legibility check (WebGL2).
- `scripts/effect/bake.mjs`: bakes the still pictures from a built page.
- `scripts/effect/stills/aperture-pier.jpg`, `aperture-court.jpg`: the baked still pictures, shown before the first frame and without WebGL.
- `examples/thale/`: the lens maker, the pier at night (dark, lockup).
- `examples/corte/`: the cloister cafe, the courtyard at noon (light, editorial).
