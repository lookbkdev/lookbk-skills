---
name: phone-screen-showcase
description: "Build the hero section of a mobile app's landing page around one phone that walks through 3 to 5 real screens of the app, tap by tap. A fingertip ring lands beside the thing to tap (never over its label), and the next screen arrives the way the app itself moves (a push, a sheet rising, a tab change), while numbered chapters beside the phone fill a progress bar in step. The phone is drawn in HTML and CSS and stands in one light from the product's world. Screens are the buyer's screenshots or composed from a JSON spec. Scrolling drives the story and plays it backwards, or it runs on a timer; on a phone it becomes the phone plus a caption, and reduced motion gets a still stack. One page.json in, a self-contained index.html and a paste-in embed.html out, a check at four widths, and a frame-by-frame recorder. Use when someone wants an app landing page hero, an app walkthrough, a \"how it works\" phone, a scroll-driven phone mockup or an App Store style hero that tells a short story."
license: MIT
---

# Phone Screen Showcase

The top of an app's landing page: the bar, an eyebrow, the headline, an introduction, a numbered list of chapters, two buttons, and beside them one phone. The phone does not crossfade screenshots. It walks through one task in the app, the way a person would: a fingertip ring lands next to "Log watering", the button dips, a sheet rises; a ring lands next to "Pay", the ticket pushes in. The chapter beside it opens, its bar fills as the visitor scrolls, and the next chapter takes over when the next screen arrives.

**What moves** (transforms and opacity only, every moment a pure function of the story position, so it can be scrubbed both ways and recorded frame by frame):

- **The tap**: the ring appears at 60% size and settles in 0.16 s, beside the label of the thing it taps (the runtime measures the letters and finds the clear space; a chip with no room gets the ring just under its label). The thing itself dips to 96% and darkens by 12%, and a chip fills with the accent: the press is the cue.
- **The change**: `push` (the new screen slides in from the right, the old one slides 28% left and darkens), `sheet` (the sheet rises, the screen behind scales to 94%, rounds its corners and dims), `tab` and `fade` (a crossfade with a 12 px rise). All on cubic-bezier(.32,.72,0,1), the shape of a native navigation spring. The arriving screen's blocks settle in order, top to bottom.
- **The copy**: the open chapter crossfades to the next after the tap; its bar shows how far through the step the visitor is (the scroll, or the timer). The note beside the phone ("02 / 04 · TAP / LOG WATERING") follows the ring's height.
- **The phone**: turns 2.2 degrees toward the light during each change and back; on desktop it follows the mouse by up to 3 degrees and the glass glare slides with it. It does not float.
- **The light**: the window's panes and mullions fall across the wall behind the phone, and a faint copy of them sits on the phone's glass; or the projector beam enters from off-frame, top right, with soft falloff and dust motes drifting in it. Either light is masked so it never reaches the copy or the bar.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the video (found automatically; set `CHROME_PATH` otherwise).
- ffmpeg, only for the video (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Steps

### 1. Find the story

Before any config: what single task should a visitor watch someone do in the app? Write it as 3 to 5 steps, one screen each, each step caused by one tap on the screen before it:

- Fernhouse (plant care): see today's list, tap the thirsty plant / the plant's moisture line, tap Log watering / the sheet, tap Save / the streak calendar.
- Latecomer (cinema): tonight's films, tap 21:40 / the seat map, tap Pay / the ticket.

Rules that make it read: one task, not a feature tour; each screen visibly different from the last (a list, then a chart, then a sheet, then a calendar); the last step is the payoff (the ticket, the streak), not a settings page; every number on a screen looks like the person's real data. Ask the person for their real copy, colours and screens. Do not invent ratings, user counts or prices for the page copy.

### 2. Write page.json

Copy `examples/fernhouse/page.json` (light, window light, 4 steps) or `examples/latecomer/page.json` (dark, projector beam, 3 steps) and replace every value. Every field:

**Page**

| field | what | range / default |
|---|---|---|
| `title` | browser tab title | up to 70 characters, required |
| `description` | meta description | up to 170, required |
| `lang` | page language | default `en` |
| `fonts.href` | a Google Fonts css2 link with your three families | required |
| `fonts.display`, `fonts.body`, `fonts.mono` | CSS font stacks | required, up to 120 each |
| `type.h1Size` | headline size at 1440 wide, px (it scales with the window and grows to 1.34 times on very large screens) | 40 to 120, default 66 |
| `type.h1Phone` | headline size on a phone and a portrait tablet, px | 32 to 64, default 40 |
| `type.h1Weight`, `type.h1Line`, `type.h1Tracking` | weight, line height, tracking in em | 100 to 900 (400); 0.8 to 1.3 (1.02); -0.05 to 0.05 (0) |
| `type.case` | `none` or `uppercase` for the headline and chapter titles | default `none` |
| `type.chapterSize`, `type.chapterWeight` | the open chapter's title, px and weight | 22 to 44 (30); 100 to 900 (the headline's) |
| `type.brandWeight`, `type.brandCase`, `type.brandTracking`, `type.buttonRadius`, `type.em` | brand name weight, case and tracking, button corner radius in px, style of the accent words (`normal` or `italic`) | 600, `none`, 0, 99, `normal` |
| `colors.bg`, `ink`, `ink2`, `muted`, `line` | page background, headline ink, body ink, quiet text, rules (`#rrggbb`, or `#rrggbbaa` for a see-through rule) | required |
| `colors.accent`, `accentInk`, `onAccent` | button fill, accent text on the page, text on the button | required |
| `colors.shadow` | the phone's cast shadow colour | required |
| `light.kind` | `window`, `beam` or `none` | required |
| `light.color` | the light's colour | required unless `none` |
| `light.strength` | 0 to 1 | default 0.9 |
| `light.grain` | film grain over the page | 0 to 0.15, default 0.07 |
| `phone.finish` | `titanium`, `graphite`, `silver` or `sand` | default `titanium` |
| `brand.name`, `brand.icon`, `brand.href` | the wordmark, an icon from the list below, its link | name up to 20; icon default `sparkle` |
| `nav` | up to 3 links: `label` (16), `href` | optional |
| `cta` | the bar's button: `label` (18), `href` | required |
| `eyebrow` | small line over the headline | up to 44 |
| `headline` | up to 48 characters; mark the accent words with `_underscores_` | required |
| `lede` | the introduction; `*bold*` allowed | up to 180 |
| `buttons` | one or two: `label` (28), `href` | required |
| `play` | `scroll` (the section pins and scrolling drives the story, 70% of a screen of scroll per step) or `timed` (it plays on its own, pausing on hover, focus or off screen) | default `scroll` |
| `stepSeconds` | in timed play, how long each step rests before the next tap | 3 to 8, default 4 |

**The app**

| field | what | range / default |
|---|---|---|
| `app.colors` | `bg`, `surface`, `sheet`, `ink`, `muted`, `line`, `tint`, `accent`, `onAccent`, `accent2`, `onAccent2`, optional `paper` (the ticket) | required `#rrggbb` |
| `app.statusBar` | `dark` (dark status text, for a light app) or `light` | required |
| `app.fonts` | `display`, `body`, `mono` if the app's fonts differ from the page's | default the page's |
| `app.titleWeight`, `app.titleCase`, `app.titleTracking` | the app's large titles | 400, `none`, 0 |
| `app.time` | the status bar clock | default `9:41` |
| `app.tabs` | 2 to 5 tabs: `icon`, `label` (10) | optional |

**Steps** (3 to 5)

| field | what | range |
|---|---|---|
| `title` | the chapter's title | up to 30 |
| `body` | one or two sentences on what this screen does for the person | 20 to 150 |
| `via` | how this screen arrives (not on the first step): `push`, `sheet`, `tab`, `fade`. A sheet cannot open on another sheet. | required from step 2 |
| `screen.tab` | which of `app.tabs` is lit, or `null` for no tab bar (sheets never have one) | optional |
| `screen.blocks` | the screen, top to bottom (below) | or `screen.image` |
| `screen.image` | a screenshot next to page.json instead (portrait, 9:19.5 such as 1179 x 2556, under 600 KB) | optional |
| `tap` | the `id` of the block, row, chip or card the visitor taps to reach the next step | every step but the last |
| `tapAt`, `tapLabel` | for a screenshot: where the tap lands, `[x, y]` in percent, and what it is called (24) | screenshot steps |
| `tapLabel` | the note's name for the tap, if the label on screen is not what you want shown | optional |
| `note` | the last step's note beside the phone: `label` (14), `value` (22) | optional |
| `alt` | how a screen reader hears this screen | up to 140 |

**Blocks** (give any block, row, chip or card an `id` to tap it):

| type | fields |
|---|---|
| `nav` | `back` (a back label, 14), or `location` (26), or `left` (18); `title` (20); `icons` (round buttons) |
| `title` | `over` (32), `text` (22; 16 with `size: "xl"`) |
| `head` | `text` (22), `meta` (22): a section heading with a note on the right |
| `chips` | `items`: 2 to 5 labels (12) or `{label, id}`; `on` (index, default 0); `style`: `pill`, `small`, `mono` |
| `rows` | `items`: 1 to 5 of `{icon or initials, title (26), line (32), value (10) or pill (8), tone: hot or soft, id}` |
| `tiles` | `items`: 2 or 3 of `{label (10), value (7)}`; with `title` and `meta` they sit in a card |
| `chart` | `title`, `meta`, `kind`: `line` or `bars`, `values` (4 to 30 numbers), `threshold: {value, label}`, `highlight` (the lit bar) |
| `note` | a tinted card: `title`, `meta`, `text` (24) in the display face |
| `toggles` | `items`: 1 to 4 of `{label, on: true, false or a short word}` |
| `calendar` | `start` (weekday of the 1st, 0 = Monday), `days` (28 to 31), `filled` (days or `[from, to]`), `today`, optional `title`, `meta` |
| `seats` | `rows` (4 to 12), `cols` (6 to 14), `aisles` (column numbers), `taken` and `mine` (`"F7"`), `label` |
| `cards` | `items`: 2 to 5 posters or photos `{title (18), line (30), image or colors [c1, c2] with pattern glow, stripes or fade, id}` |
| `ticket` | `over`, `title` (18), `fields` (3 to 6 `[label, value]`), `code`, `image` or `colors` |
| `text` | a short centred line (60) |
| `button` | `label` (22), `right` (14, a second label at the right end), `dock: true` to sit at the bottom of the screen |

Icons: `home`, `leaf`, `drop`, `sun`, `calendar`, `search`, `user`, `more`, `film`, `ticket`, `pin`, `close`, `plus`, `bell`, `heart`, `star`, `chart`, `wallet`, `card`, `bag`, `cart`, `coffee`, `bolt`, `map`, `plane`, `music`, `dumbbell`, `moon`, `gift`, `check`, `chevron`, `back`, `arrow`, `settings`, `lock`, `globe`, `sparkle`, `clock`.

#### Make it not look like a template

- **The light comes from the product.** A window on a wall for anything domestic, slow or natural (plants, home, food, wellness); a projector beam for anything that happens in the dark (cinema, music, nightlife, sleep); `none` with a strong palette for software where the screen itself is the subject. Never a purple glow.
- **Every screen has a job.** Mix a list, a chart, a sheet and a payoff. Two list screens in a row read as one.
- **Fill the screen.** A composed screen should reach the tab bar or its docked button; the check fails a screen that is more than 32% empty.
- **Name the tap.** The note beside the phone shows "TAP / LOG WATERING": tap targets with short verbs or names read best.
- **Chapters are not features.** "Know why, not just when" tells what the person gets; "Advanced analytics" does not.

### 3. Build

```
node <skill>/scripts/build.mjs page.json out
```

It lists every problem at once (lengths, colours, unknown blocks or icons, a `tap` that names no id on its screen, missing pictures) and writes nothing until they are fixed.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390x844, 768x1024, 1024x768 and 1440x900, then at 1440x900 and 390x844 with reduced motion, walks every step and fails on: script errors; sideways scrolling or text off the screen or cut off; page text under 14 px (16 px on a phone), labels under 12 px; contrast under WCAG AA; any layout shift of the buttons, the chapters, the caption or the phone between steps (measured at rest and mid-change); a screen not fully there when its step rests; the ring touching any letter of what it taps, or the target not dipping; a composed screen more than 32% empty or running under its tabs; the phone running into the copy or below the first screen (and on desktop the buttons, on a phone the caption's title); scrolling down not reaching every step or scrolling back up not playing them backwards; a chapter bar that does not follow the scroll; controls without a focus ring; reduced motion that still moves, or (phone) does not show every step as a still stack. Fix and build again until every line says `ok`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Scroll through it, scroll back up, click a chapter, narrow the window to a phone, and turn on reduced motion in your system settings once.

### 6. Record a video (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920x1080, 30 fps, one whole story in timed play, which loops) and `out/poster.png` (step 1 with the fingertip down). `--step 2 --png s2.png` saves step 2 at rest; `--still 4.3` any moment; `--size 390x844 --scale 2` the phone layout.

### 7. Hand off

`out/index.html` (plus `out/assets/` for screenshots) is the whole section, ready to host. `out/embed.html` is the same section to paste into an existing page: put its font lines in the `<head>`, the rest where the hero goes. Everything is scoped under `.pss`; the runtime is one inline script with no dependencies. Tell the person the story you chose and point out any number you could not confirm.

## How it behaves

- **Landscape, 760 px and wider**: copy on the left, the phone on the right sized to the window's height, the note beside it when there is room (the phone moves left to make room, or the note hides).
- **Phones, and portrait tablets up to 1100 px**: bar, eyebrow, headline, then the phone and a caption (segment bars you can tap, the step's number, title and body) pinned together on the first screen; scroll, swipe the phone or tap a segment to move. The buttons follow the pinned stretch.
- **Reduced motion**: nothing moves. On a laptop the chapters switch the screen at once; on a phone the steps are a stack of still phones, each with its caption.

## Troubleshooting

- **"`tap`: no block ... with id"**: give the thing to tap an `id` (a row's, a chip's or a button's own `id`) and name it in the step's `tap`.
- **"the fingertip ring covers ..."**: the target is all label (a long button text edge to edge). Shorten the label, or use `right` on a button so there is a gap.
- **"the screen is N% empty"**: add a block (a `rows` list, a `tiles` card, a `text` line) or dock the button.
- **"the buttons are below the first screen"** at 1024x768: shorten the lede or the longest step body. The lede already hides on screens shorter than 820 px.
- **"layout shift between steps"**: a chapter title wraps when it opens. Shorten it (it must fit one line in the display face).
- **Fonts look wrong in the check**: the page loads Google Fonts; the machine needs to be online.
- **The beam or window is too strong behind the note**: lower `light.strength`.

## Files

- `scripts/build.mjs`: entry point; reads page.json, lists every problem, writes `index.html`, `embed.html` and `assets/`.
- `scripts/check.mjs`: entry point; the checks above at four sizes and with reduced motion.
- `scripts/record.mjs`: entry point; the preview video, the poster and single stills.
- `scripts/serve.mjs`: entry point; serves a built folder on localhost.
- `scripts/kit/build.mjs`: validation and the HTML for the page, the phone, the chapters and every screen block.
- `scripts/kit/page.css`: all the styles, scoped under `.pss`, inlined into the built page.
- `scripts/kit/runtime.js`: the story: tap placement, the push, sheet and tab changes, chapters, scroll and timed play, light and dust, the reduced-motion stack, `window.PSS` for the recorder.
- `scripts/kit/icons.mjs`: the line icons.
- `scripts/kit/check.mjs`, `scripts/kit/record.mjs`: the check and the recorder.
- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs`, `scripts/chrome.mjs`: shared helpers that drive Chrome and serve files.
- `examples/fernhouse/page.json`: light example, plant care, window light, 4 steps.
- `examples/latecomer/page.json`: dark example, cinema tickets, projector beam, 3 steps.
- `NOTICE.md`: licences. `TESTED.json`: what was run.
