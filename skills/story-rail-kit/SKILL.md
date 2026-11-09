---
name: story-rail-kit
description: Build a horizontal rail of rich cards for a website from one rail.json - projects, recipes, articles, collections or products - done properly instead of as a janky carousel. Native scroll-snap with the browser's own momentum, Previous and Next buttons that move by exactly one card whatever its width, and under the rail a scale drawn from the cards themselves (wide cards long, quotes in the accent, numbers outlined) with a bracket that frames exactly what is on screen, so a visitor always knows where they are and how much is left. Five card kinds in a rhythm the config sets and the build checks (wide, tall, quote, number with its source, and a view-all end card), one claim and one link per card, edge fades that never cover the card you snapped to, pictures and short loops that play only while on screen, keyboard support, a mouse drag that coasts and never opens a card by accident, and touch that never traps the page's vertical scroll. No auto-advance unless you turn it on. Self-hosted fonts, a self-contained page plus a paste-in embed, a check at four widths that also tests the keyboard, drag-without-click and vertical scrolling, and a frame-by-frame recorder for a preview video. Use for a home page band of case studies, recipes, articles, collections or products that leads to a "view all" page.
license: MIT
---

# Story Rail

One section of a page: a heading, then a horizontal rail of cards you can scroll, swipe, drag or step through, then a **scale** drawn from the cards themselves. Every segment of the scale is one card, as long as that card is wide: wide picture cards are long, tall ones short, quotes are tinted with the accent, number cards and the end card are outlined. A bracket in the accent frames the part of the rail that is on screen and moves with it, one to one. The counter in the header says the same thing in words ("02–04 of 07"). Each segment is a button that brings its card to the start.

The governing idea: **the rail always shows its own shape**, and every control moves by one whole card. Dots under a carousel say nothing when cards have different widths, and arrows that scroll "a page" land mid-card. Here a step is always exactly one card, a drag always ends on a card, and the scale tells you what a step will do before you take it.

**The card kinds** (`kind`), all sharing one picture height, one caption line and one link line:

- `wide` (landscape, 1.42 × the height) and `tall` (portrait, 0.74 ×): a picture or short loop, the card number and name, a meta line (type and year, time and servings), **one claim** in a sentence, and a link.
- `quote` (0.86 ×): a block in the accent with the quote set large, who said it and their role.
- `number` (0.8 ×): a figure with its unit, a label, a small honest chart (`compare` bars, or a `split` of a whole) and the **source**, which is required.
- the end card, always last: "All 32 projects" and an arrow, linking to the full list.

**Behaviour.** The rail is plain CSS scroll-snap, so momentum on phones and trackpads is the browser's own and the rail still works with no script at all. The script adds the buttons (disabled at the ends, never hidden, so nothing shifts), the scale, the counter, the fades and the drag. Vertical wheel and vertical swipes are never captured: the page always scrolls past the rail. A mouse drag starts after 6 px, follows the pointer, coasts, and settles on a card in the direction you dragged, and the click that would follow is swallowed, so a fling never opens a card. Arrow keys move one card on the focused rail, Home and End go to the ends, Tab reaches each card's link once and brings it fully into view. The right edge fades only across the page's side margin, and the left edge fades in only after the rail has moved, so the card you snapped to is never under a fade; captions of cards that have slid past the left margin fade out and their pictures dim, so no clipped words sit in the margin. Loops (an MP4, or the two moving drawn scenes) play only while at least 35 % on screen. Autoplay is off by default; turned on, it waits at least 6 seconds per card, pauses on hover, focus, touch and a hidden tab, shows a Pause button, and never runs under reduced motion.

**Counts agree with the copy.** The counter counts stops (every card plus the end card). Write `{Count}` or `{count}` in the heading lines and the build fills in the number of story cards (wide and tall); a number typed there that matches neither is refused.

**What you can change, honestly.** Every word, picture, loop, link, the order and mix of cards, the seven colours, the two type voices and the corner radius. The proportions, the scale, the step rule, the fade rule and the motion are the design and stay as they are. The build enforces each field's limit and the rhythm rules; the check fails if anything spills, falls under the size or contrast minimums, hides its focus, or if a step, drag, swipe or key does not do exactly what is described above.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the recorder (the scripts find it; set `CHROME_PATH` if they don't).
- The cards' content: for each story a name, a meta line, one claim in a sentence, a link and a picture or loop with its alt text. Pictures: WebP, JPG, PNG or AVIF about 1600 px wide. A loop: an MP4 or WebM under 4 MB with a poster picture. No pictures yet: use the drawn set (below).
- ffmpeg, only for the preview video.

## Files

- `kit/rail.css`: the whole design, scoped to `.sr`: heading, controls, the rail and its five card kinds, the scale, the fades, tablet and phone rules (container queries, so the embed adapts to its column), reduced motion.
- `kit/runtime.js`: the browser runtime, inlined into every page: one-card steps, the scale and bracket, the counter, the fades, mouse drag with coasting and click suppression, the keyboard, loops in view only, optional autoplay, and the recording clock with its fixed script.
- `kit/drawn.mjs`: the drawn set, eight scenes drawn in code for brands with no photographs yet (two of them move).
- `kit/fonts/`: Geist, Fraunces, IBM Plex Mono and DM Mono as WOFF2, with their licences.
- `scripts/build.mjs`: rail.json to `out/index.html` (a whole page), `out/embed.html` (the section alone), `out/fonts/` and `out/media/`.
- `scripts/kit/schema.mjs`: every field, its limits, the rhythm and colour rules and the count check; lists every problem at once.
- `scripts/check.mjs`: checks the built page at 390, 768, 1024 and 1440 px and with reduced motion at 390 and 1440, including keyboard, drag-without-click, wheel and touch scrolling.
- `scripts/record.mjs`: the preview video, stills, and `--moments` (the stretches where nothing on the rail moves).
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/kestle/rail.json` (an architecture practice, light) and `examples/larder/rail.json` (a food brand's recipes, dark).

## Steps

### 1. Collect the cards

Pick 3 to 14 cards and an end card. For each story: a name (up to 32 characters), a meta line (up to 28), one claim (one sentence, up to 90; something specific that happened, not "Learn more"), a link, and a picture with alt text. Add one quote (a person, their role) and one number with how it was counted, if you have them; a rail of pictures alone is a gallery, not a story. Decide the end card: what the full list is called and where it lives.

### 2. Write rail.json

Copy `examples/kestle/rail.json` or `examples/larder/rail.json` next to your pictures and change it. Paths are relative to rail.json. Write `{Count}` where the heading says how many there are. Links are paths on your site (`/work/saltmarsh-house`) or full addresses on the domain you give as `site`.

### 3. Build

```bash
node scripts/build.mjs rail.json out
```

Every problem is listed at once, with the field and the limit, for example `cards[4].source: is required: say how the number was counted`. Notes (a drawn scene on the other card shape, no quote or number card) don't stop the build.

### 4. Check

```bash
node scripts/check.mjs out/index.html
```

One line per size with what was measured, for example `✓ 1440x900: 51 text pairs, lowest contrast 1.31× its minimum; 4 steps, 3 snap points; drag, click, wheel`. Anything wrong is listed under the line and the check exits with 1.

### 5. Look at it

```bash
node scripts/serve.mjs out
```

Open the address it prints. Press Next until it stops, drag with the mouse and let go fast, scroll the page with the pointer over the rail, press Tab through the cards, then make the window phone-sized and swipe.

### 6. Put it on the site

Upload `out/` as it is. To put the rail into an existing page, paste `out/embed.html` where the section goes and put `out/fonts/` (and `out/media/`, if you used your own pictures) next to that page. The section takes the width of whatever it sits in.

### 7. Record a preview (optional)

```bash
node scripts/record.mjs out/index.html --moments                  # when nothing moves, at 1920x1080
node scripts/record.mjs out/index.html --seconds 19 --poster 3.4
node scripts/record.mjs out/index.html --still 3.4 --size 390x844 --scale 2 --png phone.png
```

The video follows a fixed script, the same frame for frame on any machine: Next twice, a pause on a card (its picture zooms in), a mouse drag that coasts and settles, the last segment of the scale, then the first. On a phone size the same moves are swipes and taps. Take stills and posters from inside the stretches `--moments` prints.

## rail.json, every field

| Field | What it is | Limits / default |
| --- | --- | --- |
| `site` | your site's address, for full-address links | `https://…`; optional |
| `link` | the link label on story cards | up to 22 characters; default "See more" |
| `page.brand` | brand name in the slim bar of the standalone page | up to 40; optional (the embed has no bar) |
| `page.nav` | words in that bar | up to 6, each up to 16 |
| `theme.bg`, `surface`, `ink`, `mute`, `rule` | page, number card, text, muted text, hairlines | `#rrggbb`; ink 7:1 on bg; ink and mute 4.5:1 on surface; mute 4.5:1 on bg |
| `theme.accent`, `onAccent` | the accent (heading phrase, quote card, bracket) and text on it | onAccent 4.5:1 on accent; accent 3:1 on bg |
| `theme.chart` | colours for a number card's split | 2 to 4; default mute, accent, ink |
| `theme.display` | `geist` (a precise grotesk), `fraunces` (a soft serif, italic quotes) or `system` | default `geist` |
| `theme.mono` | `plex`, `dm-mono` or `system` | default `plex` |
| `theme.radius` | card corners | 0 to 8 px; default 2 |
| `theme.mode` | `light` or `dark` (the browser's colour scheme) | default `light` |
| `head.eyebrow` | small line above the heading | 1 to 40; `{Count}` allowed |
| `head.title` | the heading; one phrase as `_this_` is set in the accent | 1 to 70 |
| `head.dek` | one line under it | up to 140; optional |
| `cards` | the cards in order; the order is the rhythm | 3 to 14 |
| `cards[].kind` | `wide`, `tall`, `quote` or `number` | required |
| story: `name`, `meta`, `claim`, `href` | name, meta line, one-sentence claim, link | 32, 28, 90 characters; claim is one sentence |
| story: `link` | this card's link label | up to 22; default the top-level `link` |
| story: `media` | `{ "drawn", "alt" }`, `{ "image", "alt", "focus"? }` or `{ "loop", "poster", "seconds", "alt" }` | alt required, up to 160; focus like `"50% 40%"`; seconds 2 to 30 |
| quote: `text`, `by`, `role` | the quote and who said it | 120, 40, 48 |
| quote: `label`, `href`, `link` | a line above the quote (else a quote mark), a link and its label | 24; optional |
| number: `figure`, `unit`, `label` | the figure, its unit, what it counts | 4, 4, 90 |
| number: `source` | how it was counted | required, up to 80 |
| number: `compare` or `split` | `[[label, value], …]` bars, or the parts of a whole | 2 to 4 pairs; label up to 10 |
| `end.title`, `end.note`, `end.href` | the view-all card | 24, 40; title and href required |
| `behaviour.autoplay` | step by itself | `false` by default |
| `behaviour.seconds` | seconds per card with autoplay on | 6 to 20 |
| `behaviour.hint` | the line beside the scale, or `false` | up to 40; default "Drag, swipe or use ← →" |

**The rhythm rules** (the build refuses): the rail starts with a story card; no two quote cards and no two number cards in a row; no more than three wide cards in a row; a claim is one sentence.

**The drawn set** (`media.drawn`): `saltmarsh` (wide: a timber house below a sea wall), `stair` (tall: a concrete stair in raking light), `library` (wide, moves: fin shadows tracking the sun, 12 s), `orchard` (tall: a courtyard plan with its trees), `broth` (wide, moves: oil drifting on a broth, 8 s), `orange` (tall: a blood orange cut across), `beans` (wide: black beans in an enamelled pot), `jar` (tall: a jar of chilli oil). They are placeholders made for the examples; replace them with the brand's own pictures when there are some.

## Troubleshooting

- **The build says the heading's number disagrees with the rail.** The heading said "Seven projects" but the rail holds 4 story cards. Write `{Count} projects` and the build fills it in; it counts wide and tall cards only. The counter beside the buttons counts every stop, end card included.
- **The build refuses a link.** Links are paths on your site (`/work/x`), `#anchors`, or full addresses on the domain given as `site`. A card never links to another site.
- **The build refuses the order of the cards.** Two quotes or two numbers in a row, four wide cards in a row, or a first card that isn't a story. Move a story card between them.
- **The last cards never reach the left edge.** That is the end of the rail: there is no more to scroll, so the last stop shows the end card at the right margin. Next is disabled there and the bracket reaches the end of the scale.
- **The check fails on contrast after changing colours.** The build stops first with the exact ratio and the pair; `theme.mute` is usually the one to darken (light) or lighten (dark).
- **A loop does not play.** It plays only while at least 35 % on screen, muted, and not at all under reduced motion (the poster shows). Encode it as H.264 MP4 under 4 MB.
- **Chrome is not found.** Set `CHROME_PATH` to the browser's executable; the check and the recorder need it, the build does not.
