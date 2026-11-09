# Motion Heroes kit, v2

Every Motion Heroes v2 package (an animated website hero) is this kit plus
one effect. The kit owns everything that isn't the picture: it reads and
checks `hero.json`, lays the hero out as one of five art-directed
**compositions**, writes the page and the embed, runs the clock in the
browser, falls back to a still picture, checks the page and records the
video. The effect only draws.

v2 exists because the v1 shell owned the composition (logo left, a pill
nav, an eyebrow chip, a two-colour headline, two pill buttons, the effect
boxed on the right) and three review rounds shipped nothing built on it.
In v2 that template cannot be built: the fields that made it are refused,
the effect's CSS may not touch the layout, and `check.mjs` fails a page
that shows any of its parts (H9).

Copy `scripts/kit/` and the entry points byte for byte into a new package;
write `scripts/effect/` for the new effect. Nothing in the kit may name a
particular effect. If the kit changes, change it in every v2 package at
once (`md5` the folder to compare).

## Files

| File | What it does |
| --- | --- |
| `scripts/build.mjs`, `record.mjs`, `check.mjs` | Entry points the buyer runs; each calls the kit file of the same name. Identical in every package. |
| `scripts/kit/build.mjs` | Validates `hero.json` (lists every problem at once), checks the headline can be set at 7% of the viewport's height, lints the effect's CSS, checks contrast by the headline's type mode, resolves defaults and colours, writes `out/index.html`, `out/embed.html` and `out/assets/` (the logo, and files the effect ships). |
| `scripts/kit/shell.css` | The five compositions, the bar, the plates, the type scale, the call to action, the phone layouts and the intro. Scoped under `.mh`, themed by `--mh-*` variables. |
| `scripts/kit/runtime.js` | Inlined into the page. The clock, `seek(t)`, pausing off screen, the DPR cap, reduced motion, the fallback, the layout measurements the effect draws from (`view.stage`, `view.type`, `view.bar`, `view.plates`), headline fitting (type-effect), `ctx.light`, `ctx.front`, `ctx.asset`, pinned-scroll stories, `window.MotionHero` for recording. |
| `scripts/kit/check.mjs` | Lookbk's page checks plus the hero rules H6 and H9 at 390, 768, 1024 and 1440 px; prints the measured numbers. |
| `scripts/kit/record.mjs` | Steps the clock frame by frame in headless Chrome and pipes PNG frames to ffmpeg: `preview.mp4` + `poster.png`, or one PNG with `--still T`. Awaits `effect.prepare(t)` when the effect has one (footage). |
| `scripts/kit/cdp.mjs` | A tiny DevTools-protocol client (no npm packages). Chrome runs with `--allow-file-access-from-files` so a page opened from disk can use its own `assets/`. |
| `scripts/kit/three.json`, `fonts.json` | three.js r180 and font families pinned with SRI hashes, as in v1. |
| `scripts/chrome.mjs`, `color.mjs`, `markup.mjs`, `inline.mjs`, `screenshot.mjs` | Lookbk's shared helpers, unchanged. |

## hero.json

```json
{
  "composition": "editorial",
  "brand": { "name": "Holm & Vey", "logo": "logo.svg", "href": "/" },
  "nav": [{ "label": "Machine", "href": "/h3" }],
  "action": { "label": "Order the H3", "href": "/order" },
  "hero": {
    "title": "Built to be\ntaken apart.",
    "subtitle": "optional, one line",
    "lede": "What it is and for whom.",
    "cta": { "label": "Request the drawings", "href": "/drawings" },
    "link": { "label": "optional plain link", "href": "/more" },
    "steps": [{ "title": "story only", "text": "…" }]
  },
  "theme": { "background": "#123a7a", "ink": "#f4f7ff", "accent": "#ffd9a0", "plate": "#123a7a",
             "fonts": { "display": "Big Shoulders Display", "body": "Inter", "mono": "IBM Plex Mono", "weight": 800, "advance": 0.5 } },
  "effect": { },
  "motion": { "speed": 1, "pointer": true },
  "meta": { "title": "…", "description": "…", "url": "https://…", "lang": "en" }
}
```

| Field | Rule |
| --- | --- |
| `composition` | Required: one of the five below, and one the effect lists in `compositions`. |
| `nav` | Up to 4 links. `action` is the bar's one link, always plain underlined text. |
| `hero.title` | Up to 60 characters, 3 lines (`\n`). `*words*` set the display face's italic **in the same colour**: there is no second headline colour. |
| `hero.subtitle`, `hero.lede` | A display-face line (64) and the lede (200, inline Markdown). There is no label/value spec table: it became the new chip. |
| `hero.cta`, `hero.link` | One call to action, styled by the composition (never a pill), and an optional plain text link. |
| `hero.steps` | The story composition only: 2 to 5 `{ title, text }`. |
| `theme.plate` | The solid colour under all small text and the bar (default `theme.background`). `theme.ink` must reach 7:1 on it. |
| `theme.fonts.mono` | The editorial and story compositions set their bar, index and call to action in a mono face (default IBM Plex Mono, pinned). |
| `theme.fonts.advance` | The display face's average letter width as a share of its size (default 0.55, 0.64 for capitals); used by the 7% size check. |

Refused, with a message that says what to use instead: `hero.badge` (the
eyebrow chip), `hero.actions` (the pill pair), `hero.align` (the v1
left/right column), `hero.note`, `hero.facts` (the spec table), `theme.scrim`.

## The five compositions

Each archetype owns its bar (height, rule, typeface) and its shell typeface:

| `composition` | Layout | Headline | Bar | Call to action | Effect field |
| --- | --- | --- | --- | --- | --- |
| `type-effect` | Type as the effect, full bleed | Fitted to the width line by line (runtime), line box trimmed to the capitals; on portrait screens the word turns to run up a band a screen tall (`data-rot`, `view.type.rotate`) | 64 px, no rule; brand in the display face's spaced capitals, links in small spaced capitals | Large underlined link in the display face, bottom right of a ruled bottom band (subtitle and lede left) | The whole hero |
| `editorial` | Asymmetric 12-column grid, hairline column rules (`theme.rules`: `on` by default, `off`, or `fade-with-story` to fade them out over the first quarter of a story) | Columns 1-8 at the foot, `max(7.2vh, min(15vh, 9.4vw))` | 72 px ruled band in the mono face; links as a numbered index | A ruled mono row under the lede, in a ruled column in 10-12 | Columns 4-12, bar to bottom, bleeding off the right edge |
| `lockup` | Centred lockup, effect behind | Fitted to 85% of the width, at most 20% of the height | 88 px, no rule; brand centred in the display face between two groups of links (display face) | One ruled row (rule above and below, label and arrow) at the right of a full-width colophon band; the lede on the left | The whole hero |
| `split` | A solid panel and a full-height stage | In the panel, `max(7.2vh, min(13vh, 6.2vw))` | 72 px ruled band in the body face | A full-width solid block at the foot of the panel | The right 58% (above the panel on phones) |
| `story` | Scroll-pinned story | Columns 1-8 at the foot | 72 px ruled band in the mono face | Underlined link in a ruled plate | The whole hero; numbered steps light up |

Phones (under 760 px) get one column per composition: the bar's links go,
the bar link stays, the effect gets its own band, all text is 16 px or more.

## How the headline lives in the scene: `typeMode`

`effect.mjs` sets `typeMode` (a string, a map by composition, or a function
of `(composition, params, theme)`):

| Mode | What happens | What the build checks |
| --- | --- | --- |
| `ink` | Plain text over the effect | `theme.ink` reaches 3:1 on every `grounds()` colour |
| `lit` | The effect calls `ctx.light(x, y, r)` each frame with its light's position in hero pixels; the letters are filled with a radial gradient from `lit()`'s `lit` colour at the light to its `base` colour, so they catch the same light | effect.js calls `ctx.light`; both colours reach 3:1 on every ground |
| `occlude` | `ctx.front` is a canvas above the headline and below the plates; the effect draws what passes in front of the letters | effect.js draws on `ctx.front`; ink reaches 3:1 |
| `scene` | The effect draws the letters itself from `view.type` (each line's box, baseline, parts and the CSS font). The real `h1` stays in the page, transparent once the effect has drawn, shown in `theme.ink` before that and whenever the effect fails | effect.js reads `view.type`; `typeGrounds()` returns the `{ fg, bg }` pairs the effect guarantees, each 3:1 |

## Rules the build enforces (it stops otherwise)

- **Nav clearance and solid plates.** The bar is a solid plate 72 px tall
  (60 on phones) and every composition puts 40 px between it and the body.
  All small text sits on `.mh-plate` (opaque `theme.plate`). These live in
  `shell.css`, and the build refuses any effect CSS rule that names a kit
  class (`.mh-…`), styles page elements, or doesn't name the effect's own
  `cssPrefix`, so no effect can move the headline, thin a plate or slide
  under the bar.
- **Headline at least 7% of the viewport's height.** Every composition's
  CSS sets at least 7.2vh. The build estimates each line at 1440×900 and
  390×844 and stops when a word or line can't be set that large without
  overflowing (type-effect: a line too long to fit the width at 7%).
- **Text sizes.** Shell text is 14 px or more on wide screens and 16 px or
  more on phones (set in `shell.css`; measured by `check.mjs`).
- **Contrast.** `theme.ink` 7:1 on the plate; the headline per `typeMode` above.
- **No v1 template.** The v1 fields are refused; there is no chip, no
  second headline colour and no pill in `shell.css`.

## What check.mjs measures (and fails on)

At 390, 768, 1024 and 1440 px: Lookbk's page checks (overflow, contrast,
names, headings) and

- **H6**: text under 14 px (16 px under 760 px); a headline under 7% of
  the viewport's height; any text whose letters start within 40 px of the
  bar (the capitals' real top, from the font's metrics); small text with no
  opaque background between it and the effect; a bar that isn't opaque.
- **H9**: a pill-shaped nav, an eyebrow chip above the headline, a
  headline in two colours, two pill buttons side by side. Any one fails.

Each width prints its numbers, e.g. `1440px: ok (text >= 15px, headline
135px = 15% of the height, 76px under the bar, H9 signals 0)`.

## The effect: what a package provides

`scripts/effect/effect.mjs` (Node, read at build time) default-exports:

| Field | Required | Meaning |
| --- | --- | --- |
| `id`, `name` | yes | `id` names the section (`#mh-<id>`); `name` is printed. |
| `needs` | yes | `'webgl'`, `'canvas'` or `'none'`. |
| `compositions` | yes | The compositions the effect is art-directed for. |
| `typeMode` | yes | See above. |
| `params` | yes | The `effect` settings: `{ key: { type, min, max, default, doc } }` (types as in v1: number, integer, boolean, color, enum, text, list). `default` may be a function of `{ theme, composition }`. |
| `still(params, theme)` | yes | `{ backdrop, object? }` SVG strings, shown until the first frame and if the effect fails. |
| `grounds(params, theme)` | for `ink`, `lit`, `occlude` | Colours the effect can put behind the headline. |
| `lit(params, theme)` | for `lit` | `{ base, lit }` hex colours of the headline away from and under the light. |
| `typeGrounds(params, theme)` | for `scene` | `[{ fg, bg }]`: the letters the effect draws and what is around them. |
| `cssPrefix`, `css` | no | The effect's CSS; every rule must name a `.<cssPrefix>…` class and none may name a kit class. |
| `assets` | no | Package files to ship in `out/assets/` (footage); `ctx.asset(name)` gives their URL. |
| `libs`, `addons` | no | Pinned libraries and three.js add-ons with SRI hashes, as in v1. |
| `story` | no | `{ drive, pin, length, lead, hold, loop }`, as in v1 (needed by the `story` composition). |
| `check(params, theme, problems)`, `notes(params, theme)` | no | Extra rules and notes. |
| `stillTime`, `posterTime`, `stillScale` | no | As in v1. |

`scripts/effect/effect.js` (browser) has one `export default` and no static
imports. It exports `init(ctx)`, `resize(view)`, `seek(t, state)`, and
optionally `place(view, params)`, `script(seconds, story)` and
`prepare(t)` (async: called and awaited before `seek` in recordings, to
seek footage to the exact frame).

- `ctx`: as in v1 (`root, canvas, params, theme, recording, reduced, view,
  load, redraw, now, story, progress`) plus `front` (the occlude canvas or
  null), `composition`, `typeMode`, `light(x, y, r)` and `asset(name)`.
- `view`: `{ width, height, dpr, stage, mobile, stacked, composition,
  typeMode, bar, plates, type }` in CSS pixels; `type` is `{ lines: [{ text,
  x, y, w, h, baseline, parts: [{ text, x, w, italic }] }], size,
  letterSpacing, family, weight, font(italic), box, align, rotate, center }`;
  when `rotate` is set (a turned type-effect headline) the lines are upright
  and the effect turns its drawing by `rotate` about `center`.
- Grain must be fixed or repeat with the loop, so the recording's last frame meets its first.
- **Everything drawn is a function of `t` and `state`** (and footage seeked
  by `prepare`), so `record.mjs` gets the same frames on every machine.

Kept from v1 unchanged in meaning: the clock, off-screen pausing, the DPR
cap, reduced motion (one still frame), the never-blank fallback, pinned
scroll stories, the three.js import map and SRI pinning, the embed.

## A new package

1. Copy `scripts/kit/` and the entry points and shared helpers unchanged from a v2 package; check with `md5`.
2. Write the art-direction doc and a frame-0 mock first (`gen/backlog/ad/<slug>.md`).
3. Write `scripts/effect/effect.mjs` and `effect.js`; pick a composition and a type mode that put the headline in the scene.
4. Two examples in `examples/<name>/hero.json`, clearly different colour and treatment.
5. Build, `check.mjs` (must pass, H9 included), record stills at 1920×1080 and 390×844, look at them, then `tools/qgate`.
