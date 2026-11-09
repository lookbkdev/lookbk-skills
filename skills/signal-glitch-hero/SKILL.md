---
name: signal-glitch-hero
description: "Build a website hero where your own photograph and headline arrive through a corrupted broadcast signal that locks on - vertical hold, horizontal sync and colour burst lock in turn while a stream joined without a key frame smears its macroblocks until a refresh sweeps the frame clean - then holds a sharp, readable frame for about 70% of a 12-second loop; the pointer is interference that drags blocks and tears lines. Your photo, colours, fonts and copy; lockup or editorial layout; dark or light pages with on-brand failure colours. Raw WebGL1, no libraries. One self-contained HTML page plus a paste-in embed on the Motion Heroes kit v2, checked at four widths, a title-safe grade that guarantees the headline's contrast over the photo, a still picture for reduced motion and failures, and a frame-exact looping 1080p MP4. Use for a film, TV, streaming or radio brand, a festival, an audio or camera product, a launch or any brand whose photo deserves an entrance."
license: MIT
---

# Signal Glitch Hero

The first screen of a website, shown the way a receiver shows a channel it
is tuning in. Your photograph and your headline are one broadcast frame (the
letters are burned into the picture; the page keeps the real text for
readers and search). The frame reaches the screen through two real chains,
each with its own lock, and every artefact you see is one named failure that
ends when its circuit locks:

- **The cable (analog).** Vertical hold: the frame rolls upward, the
  blanking bar between frames passing through, and slows to a stop.
  Horizontal sync: the lines shear, the top of the frame flags, the lines
  jitter, then the oscillator rings once and settles. Colour: the colour
  killer holds the picture monochrome (on a light page it takes the paper's
  white, not grey) until the colour burst locks; colour then swings into hue
  and sits off the edges by a chroma delay that settles to zero.
- **The stream (compressed).** Joined without a key frame, the decoder has
  only an empty reference: motion vectors drag and stretch the macroblocks
  (the datamosh melt), some blocks take a wrong vector and copy a neighbour,
  residuals paint the picture in, detailed blocks first. A rolling intra
  refresh then sweeps the frame clean, by columns (the headline locks in
  reading order) or by rows (the picture locks before a headline at the
  foot).

Then the frame **holds, clean and still**: 8.5 of every 12 seconds at the
defaults, with one 0.2 s burst error that the next refresh repairs. At the
end the signal fades (blocks freeze and drift, colour is lost, the frame
accelerates into a roll) straight into the next acquisition, so the loop
closes with no cut. The plates under the lede and the call to action are
the receiver's own on-screen display, keyed over the picture after the
decoder: they never tear, and while the signal is unlocked a clean margin,
a hairline and a soft shadow show them sitting on top of it.

On a live page the pointer is interference: its speed becomes the motion
vectors of the blocks near it and tears the lines it crosses; standing
still lets the stream repair it within a second.

**Bring your own photo.** The two examples ship pictures made for Lookbk;
the hero is meant for yours. The build resizes it to at most 1920 px wide,
encodes it as a JPEG of 400 KB or less and ships only that file.

Layouts: the kit's **lockup** (the photo is the whole hero, the headline
fitted across it, a colophon band under it) or **editorial** (the photo in
columns 4 to 12 bleeding off the right edge, the headline at the foot of
columns 1 to 8, the copy in a ruled column). On phones the kit's single
column, macroblocks at three quarters of their size. No chip, no pill
button, no second headline colour.

## What you need

- Node.js 18 or newer. Nothing to install.
- Your photograph (JPEG, PNG or WebP, ideally 1920 px wide or more), with room for a headline.
- ffmpeg, to resize and encode the photo at build time and for the video (or set `FFMPEG_PATH`). Without it a JPEG of 400 KB or less is shipped as it is.
- Chrome, Chromium or Edge, for the checks and the recording (set `CHROME_PATH` if it isn't found).
- Internet access when the page is opened, for the fonts (pinned with integrity hashes).

## Steps

### 1. Collect the brand, the photo and the words

- **Name** and a logo (`.svg`) or the name set in the display face.
- **Your photograph.** Look at where the headline will sit: lockup puts it across the middle, editorial at the bottom left. The title-safe grade keeps the headline readable over anything, but a calm area there looks best.
- **Colours**: the page ground, the ink at 7:1 on it, one accent (the call to action's rule).
- **The words**: a headline of two or three short lines, a lede, one call to action, an optional plain link, up to four links and one bar link.

### 2. Write hero.json

Copy `examples/late-reel/hero.json` (dark, lockup, column refresh) or `examples/halde/hero.json` (light, editorial, row refresh), put your photo next to it, and replace everything.

| Field | What it is | Limit |
| --- | --- | --- |
| `composition` | `lockup` or `editorial` | – |
| `brand`, `nav[]`, `action` | The bar | 28 / 16 / 20 |
| `hero.title` | The headline; `\n` breaks a line (3 lines at most); `*words*` set the italic in the same colour | 60 |
| `hero.lede`, `hero.cta`, `hero.link` | The copy on the plates | 200 / 26 / 26 |
| `theme` | `mode`, `background`, `ink`, `accent`, `plate`, `fonts { display, body, mono, weight, advance }`, `rules` (editorial) | – |
| `motion`, `meta` | As in every Motion Heroes package | – |

The `effect` settings:

| Setting | Range | Default | What it does |
| --- | --- | --- | --- |
| `picture` | path | (required) | Your photo, relative to hero.json. Resized to at most 1920 px and encoded to 400 KB or less; the build stops if it can't |
| `focusX`, `focusY` | 0 to 1 | 0.5 | Which part of the photo stays in view when it is cropped to the field |
| `phoneFocusX` | 0 to 1 | 0.5 | `focusX` on phones (a narrow, tall crop) |
| `cycle` | 10 to 20 | 12 | Seconds from one acquisition to the next: the loop of the video |
| `acquire` | 1.6 to 3.6 | 2.4 | Seconds from the first sync to a clean lock |
| `fade` | 0.6 to 1.8 | 1.1 | Seconds the signal takes to fade at the end. `acquire` + `fade` may be at most 40% of `cycle` |
| `refresh` | columns, rows | columns | How the intra refresh sweeps the frame clean |
| `block` | 8 to 32 | 16 | Macroblock size in CSS px (phones use three quarters) |
| `mosh` | 0 to 1 | 0.8 | How far the motion vectors drag the blocks |
| `tear` | 0 to 1 | 0.7 | Shear, flagging and line jitter while horizontal sync is unlocked |
| `roll` | true, false | true | The frame rolls with its blanking bar until vertical hold locks |
| `chroma` | 0 to 1 | 0.7 | The chroma delay while the colour burst settles |
| `burst` | true, false | true | One 0.2 s burst error in the middle of the held frame |
| `buffer` | colour | the ground, 25% darker or lighter | The decoder's empty reference, seen before the picture arrives |
| `blanking` | colour | #050505 | The blanking bar. On a light page use a warm paper tone (the example uses #d6ccbc) |
| `grade` | 3 to 7 | 4.5 | The contrast the headline is guaranteed over the photo (the photo is held darker, or lighter on a light page, in a feathered area under the lines only) |
| `follow` | true, false | true | The pointer as interference |
| `grain` | 0 to 1 | 0.4 | A fixed grain, the same on every frame so the loop closes |

### 3. Build, check, look, record

```sh
node <skill>/scripts/build.mjs hero.json out
node <skill>/scripts/check.mjs out/index.html
node <skill>/scripts/record.mjs out/index.html --still 6 --png out/still.png
node <skill>/scripts/record.mjs out/index.html --still 1.95 --png out/locking.png
node <skill>/scripts/record.mjs out/index.html --still 6 --size 390x844 --scale 2 --png out/phone.png
node <skill>/scripts/record.mjs out/index.html --seconds 12 --size 1920x1080 --fps 30
```

The build prints the photo's encoded size. Look at the held frame (6 s) for the composition and at 1 to 2.5 s for the acquisition. Record `cycle` seconds for a seamless loop; the video opens on the acquisition and its poster is the held frame.

### 4. Put it live

Upload `out/index.html` with `out/assets/`, or paste `out/embed.html` into your page and copy `assets/` next to it.

## Troubleshooting

- **The build says the photo is over 400 KB**: crop it to the part you use, or export it smaller; detailed, noisy photos compress worst.
- **The build says it needs ffmpeg**: install ffmpeg (or set `FFMPEG_PATH`), or save the photo yourself as a JPEG of 400 KB or less.
- **A haze shows around the headline**: the title-safe grade is lifting (light page) or dimming (dark page) a busy part of the photo. Move `focusX`/`focusY` so the headline sits on a calmer area, or lower `grade` toward 3.
- **The glitch feels too long**: lower `acquire` and `fade`, or raise `cycle`; the held frame is `cycle - acquire - fade` seconds.
- **No picture, just the headline on a dimmed photo**: WebGL isn't available or reduced motion is on; that is the still picture, by design.

## Files

- `scripts/build.mjs`, `scripts/check.mjs`, `scripts/record.mjs`: the entry points (build, page checks, recorder).
- `scripts/kit/`: the Motion Heroes kit v2, identical in every v2 package (see `KIT.md`).
- `scripts/effect/effect.mjs`: the settings, checks, the photo's resize and encode, and the still.
- `scripts/effect/effect.js`: the programme frame, the title-safe grade and the signal chains (WebGL1).
- `examples/late-reel/`, `examples/halde/`: two examples, each with its photo.
