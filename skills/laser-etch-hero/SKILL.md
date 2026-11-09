---
name: laser-etch-hero
description: "Build a website hero where a laser engraver cuts the headline into a real plate - a vector contour pass, then a gantry raster that scans the whole job line by line or a galvo that hatches glyph by glyph at 45 and 135 degrees - and one low raking lamp shows the cut's depth, with shadows cast inside each letter, char, smoke and a glowing front on maple, sparks and frosted bright metal on black anodised aluminium, or a pale frost on slate; the spot is a second, point light on the surface around it, and the pointer moves the lamp. Two art-directed layouts: a maple board lying on a bench with its ends in view and the copy printed on a clamp bar across it (centred lockup), or a full-bleed anodised plate with the headline across the width and a ruled band (type as the effect). One self-contained HTML page plus a paste-in embed on the Motion Heroes kit v2, checked at four widths for text size, contrast, clearance under the bar and the v1 template, with a baked still picture if WebGL fails and a frame-exact looping 1080p MP4 that opens on the settled plate. Use for makers, engravers, workshops, tools, instruments, gifts or any product that is made, marked or personalised."
license: MIT
---

# Laser Etch Hero

The headline is not printed on the hero. It is cut into it. A laser
engraver works the plate the way the real machines do: a fast vector
pass traces every outline, then the fill. On maple, a gantry raster scans
the whole job box line by line in both directions, firing only inside the
letters, so the char comes down as one glowing front across all the
lines at once. On aluminium, a galvo hatches each glyph at 45 degrees and
then again at 135 degrees, jumping from glyph to glyph. The material
answers: maple chars near-black-brown with the grain showing as lighter
ridges, scan lines in the floor of the cut, a toasted rim and a slightly
raised, fuzzy lip, and it smokes while it burns; black anodise ablates
to bright metal, frosted once crosshatched, and throws sparks; slate pales
to a grey frost.

Every letter is a height field lit by one low raking lamp. The walls
facing the lamp catch it, the floor under the far wall falls into shadow,
and the lamp's falloff, the maple's satin sheen and the anodise glare
cross the frame. While it works, the spot is a white-hot point with a
soft glow and no flare, and it is a second light: it lights the surface
and the walls around it. On a live page the pointer is the lamp, the way
a conservator reads a worn inscription with a hand-held light: move it and
every shadow swings.

The loop (20 s on maple, 16 s on aluminium) opens on the finished plate
at rest. The lamp swings across and rests (the shadows change sides), the
finished plate slides out as a blank one slides in, the contour pass and
the fill run, the lamp swings back, and the loop closes on the same
settled plate. `window.__laserEtchHolds` lists the settled stretches, so
stills and posters can be taken from inside them.

Two compositions of the kit:

- **lockup** (maple, `layout: "board"`): a maple board lies on a bench
  with its top edge and both ends in view, a roundover on its edges and a
  soft contact shadow. The copy is printed on a clamp bar that crosses the
  board and the bench (the bar is the plate colour, so the copy plate is
  part of a physical object, not a box pasted on wood); it lifts a little
  when the boards swap. A maker's mark (one or two letters in a double
  ring) is burned in the board's free corner, or under the clamp bar on
  phones. On phones the board runs off both sides; its top edge and the
  clamp bar keep it a board.
- **type-effect** (aluminium, `layout: "full"`): the plate fills the hero,
  the headline runs across the width (on phones it turns and runs up the
  screen), an optional graduation scale is burned along the foot of the
  plate (down its edge on phones), and the copy sits in the kit's ruled
  band.

No chip, no pill button, no second headline colour. Raw WebGL2, no
libraries.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the recording (set `CHROME_PATH` if it isn't found).
- ffmpeg, for the video (or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the fonts (pinned with integrity hashes).

## Steps

### 1. Collect the brand and the words

- **Name** and a logo (`.svg`) or a monogram, and one or two letters for the maker's mark if you use one.
- **Colours**: the plate colour (the bar and the clamp bar or band), the ink at 7:1 on it, one accent. On maple, a bench a step darker than the plate, so the board stands out.
- **The words**: a headline of two or three short lines. Prefer words without descenders on the maple board (the last line sits close to the clamp bar). A lede, one call to action, up to four links and one bar link.

### 2. Write hero.json

Copy `examples/wrenfold/hero.json` (a maple board, gantry raster, lockup) or `examples/varde/hero.json` (black anodised aluminium, galvo, type as the effect) and replace everything.

| Field | What it is | Limit |
| --- | --- | --- |
| `composition` | `lockup` (with `layout: "board"`) or `type-effect` (with `layout: "full"`) | – |
| `brand`, `nav[]`, `action` | The bar | 28 / 16 / 20 |
| `hero.title` | The headline; `\n` breaks a line (3 lines at most; type-effect lines up to 8 characters) | 60 |
| `hero.subtitle`, `hero.lede` | The band's line (type-effect) and the lede | 64 / 200 |
| `hero.cta` | The call to action | 26 |
| `theme` | `mode`, `background`, `ink`, `accent`, `plate`, `fonts { display, body, weight, advance }` | – |
| `motion`, `meta` | As in every Motion Heroes package | – |

The `effect` settings:

| Setting | Range | Default | What it does |
| --- | --- | --- | --- |
| `material` | maple, anodised, slate | maple | What the headline is cut into |
| `machine` | gantry, galvo | gantry (light), galvo (dark) | Raster line by line, or hatch glyph by glyph at two angles |
| `layout` | board, full | board (lockup), full (otherwise) | A board on a bench with a clamp bar, or the plate edge to edge |
| `bench` | colour | 10% toward the ink | The bench under the board |
| `lamp` | colour | warm white (light), cool white (dark) | The raking lamp |
| `mark` | 1 or 2 letters | none | A maker's mark burned on the board |
| `scale` | true, false | false | A graduation scale burned along the plate (aluminium) |
| `depth` | 0.4 to 1.6 | 1 | How deep the cut reads |
| `smoke` | 0 to 1 | 0.8 | Smoke off maple while it burns |
| `sparks` | 0 to 1 | 0.8 | Sparks off aluminium while it is marked |
| `cycle` | 12 to 30 | 20 (light), 16 (dark) | Seconds for one loop |
| `follow` | true, false | true | The pointer moves the lamp on a spring |
| `grain` | 0 to 1 | 0.5 | A fixed grain, the same on every frame so the loop closes |

### 3. Build, check, look, record

```sh
node <skill>/scripts/build.mjs hero.json out
node <skill>/scripts/check.mjs out/index.html
node <skill>/scripts/record.mjs out/index.html --still 0 --png out/still.png
node <skill>/scripts/record.mjs out/index.html --still 0 --size 390x844 --scale 2 --png out/phone.png
node <skill>/scripts/record.mjs out/index.html --seconds 20 --size 1920x1080 --fps 30 --poster 0
```

Record `cycle` seconds for a seamless loop. Take stills from the settled holds: at a 20 s cycle, 0 to 2.5 s (lamp from the upper left), 5.65 to 7 s (lamp from the upper right) and 19.2 to 20 s.

### 4. Put it live

Upload `index.html` with its `assets/` folder, or paste `embed.html` into your page and copy `assets/` next to it.

## Troubleshooting

- **The page shows the headline in plain text over a photograph of the material**: WebGL2 isn't available; the baked still and the real headline stay.
- **The last line sits on the clamp bar**: shorten the headline, use words without descenders, or set two lines.
- **The cut reads too shallow or too heavy**: change `depth`; the lamp's elevation sets how long the shadows are.
- **A slow machine**: the kit lowers the pixel density when frames run long; the cut, shadows and smoke keep their size.

## Files

- `scripts/build.mjs`: builds the page and the embed from `hero.json`.
- `scripts/check.mjs`: the page checks and the hero rules H6 and H9 at four widths.
- `scripts/record.mjs`: records the looping MP4, the poster or one still.
- `scripts/kit/`: the Motion Heroes kit v2 (see `KIT.md`).
- `scripts/effect/effect.mjs`: the settings, checks, letter grounds and the still.
- `scripts/effect/effect.js`: the plate, the cut, the tool's paths, the lamp, smoke and sparks (WebGL2).
- `assets/maple.webp`, `assets/anodised.webp`, `assets/slate.webp`: baked material photographs for the WebGL-off still.
- `examples/wrenfold/`, `examples/varde/`: two examples.
