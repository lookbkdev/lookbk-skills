---
name: pricing-kit
description: Build a pricing section from one pricing.json - 2 to 4 plans hung from one shared price scale, a monthly/yearly switch whose prices roll digit by digit while each plan's dot slides along the scale and the hatched saving trails it, the arithmetic printed under every price, a recommended plan designed as its own object (filled, wider, raised into the scale, with a reason), a feature comparison that opens out of the cards and marks what is new at each plan, an optional usage calculator whose slider re-lights the cheapest plan and names the crossover, and a strip of questions. Two finished looks (light editorial, dark technical), phone layouts with folded plans and a sticky switch, reduced motion, a paste-in embed, a check at four widths and a frame-by-frame recorder. Use for SaaS, APIs, studios and services that want their real plans to look considered and trustworthy.
license: MIT
---

# Pricing Kit

A pricing section built around one idea: **every plan hangs from one price scale**, so the billing switch, the plans and the calculator all move the same measured line, and every animation is money moving along it. The person's agent writes `pricing.json`; the build checks it, works out every number the section shows (yearly bills, what you keep, what is new at each plan, where one plan becomes cheaper than another) and writes a self-contained page plus a paste-in embed.

What the section holds, top to bottom:

1. **Head**: an eyebrow, a headline with one phrase in `_italic_` (the accent), up to three plain promises ("Prices in USD, before tax").
2. **The bar**: the billing switch (a real radio group) with the saving in the person's words ("2 months free"), and the **price scale**: a ruled axis from 0 to the top price, each plan a dot at its price joined to its card by a leader line. A plan with a custom price sits past a break, labelled Custom.
3. **Plans** (2 to 4): name, who it is for, price in rolling digit columns, the arithmetic ("$25 × 12 / = $300 billed yearly / You keep $60 a year"), a button, and only what the plan **adds** to the one before it ("Everything in Solo, plus"). One plan is **recommended**: filled with the accent, wider, raised into the scale, with a label and a reason at its top; its tint carries on down the comparison table. A column beside the plans lists what every plan includes.
4. **Comparison** (optional): opens out of the cards from "Compare all features ↓", on the same columns, scrolls to itself and rings the plan you came from. A dot marks every value that is new at that plan; "Only what changes" hides rows that are the same everywhere.
5. **Calculator** (optional): a slider over the person's usage unit (people, calls, projects), linear or logarithmic. The track is cut into the stretches where each plan is cheapest; the cheapest plan's cell lights and a sentence says the price and the next crossover ("From 9 people, Practice costs less.").
6. **Questions** (optional): 2 to 8, in two columns.

## What you need

- Node.js 18 or newer. Chrome, Chromium or Edge for the check and the recorder (set `CHROME_PATH` if it is somewhere unusual), and ffmpeg for the video.
- From the person: their plans (names, who each is for, monthly prices and the monthly figure when billed yearly, or a custom line), what each adds, their sign-up links, which plan they recommend and why, and if they want them, a feature table, the usage formula behind their prices and their questions.

Every price, limit and claim must come from the person. If they don't have a feature table or a usage formula, leave the comparison or the calculator out rather than inventing one.

## Steps

### 1. Collect the plans

Ask for, or read from their current page: plan names, prices, what each plan adds, links, the recommended plan with a reason a buyer would believe (who it suits, not "most popular" unless they have the number). **Do the arithmetic and make it exact**: the build checks that the saving the switch claims is true of every plan. "2 months free" on $30 means $25 a month billed yearly ($300 = 10 × $30); "20% off" on $40 is $32. Pick round prices that divide cleanly.

### 2. Write pricing.json

Copy the example closest in spirit and replace every value:

- `examples/larchmere/pricing.json`: Larchmere, invoicing for small studios. Light, editorial, 3 plans, 2 months free, a seat calculator.
- `examples/northvane/pricing.json`: Northvane, a weather API. Dark, technical, 4 plans with a free one and a custom one, 20% off yearly, a logarithmic calls calculator with overage.

### 3. Build

```
node <skill>/scripts/build.mjs pricing.json out
```

It lists every problem at once (a missing field, a line too long for its place, a saving claim one plan doesn't meet, a yearly price above the monthly one, a table row with the wrong number of values, a palette pair under AA contrast) and writes nothing until they are fixed. Shorten the words rather than asking for smaller type.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, and works it: switches billing by click and by arrow keys and reads every digit column, opens the comparison from a card and checks it scrolled there and marked the plan, toggles "Only what changes", drags the calculator through its stops (each `aria-valuetext` must name the cheapest plan and nothing may move the layout), opens a folded plan and a question, then tabs through the page. It fails on script errors, sideways scrolling, copy under 16 px on a phone or 14 px elsewhere (labels: 12 px), text under WCAG AA contrast, text cut off or inside the 16 px phone margin, invisible focus and reduced motion that still moves. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Switch billing, open the comparison from the recommended card, slide the calculator across a crossover, and try it on a phone width.

### 6. Record the video (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920×1080, 30 fps, 16.6 seconds: rests on the plans, switches to yearly, opens the comparison from the recommended card, shows only what changes, slides the calculator across the next crossover, opens a question) and `out/poster.png`. `--still 4 --png moment.png` saves one moment; add `--size 390x844 --scale 2` for a phone.

Never pick still timestamps by eye: a digit caught mid-roll shows a sliced number. Ask the page for its quiet stretches:

```
node <skill>/scripts/record.mjs out/index.html --moments
```

It prints `{"length":16.6,"moments":[["plans",1.3,1.95],["yearly",3.4,4.55],["compare",6.3,7.5],["only",8.1,8.95],["calculator",13.4,13.95],["faq",15.5,16.55]]}`; take each still a little past the middle of its stretch.

### 7. Hand it over

Either upload `out/index.html` as the page, or paste `out/embed.html` where the pricing goes on an existing page: it carries its font links, a style sheet scoped under `.pk`, the markup and the script, and it adapts to the width of the column it is pasted into (container queries), not the window. Tell the person the switch, comparison, slider and questions all work by keyboard and screen reader, and that with reduced motion every change is instant.

## Fields

Text limits are characters; `_italic_` marks don't count.

| Field | Range | Default | What it is |
|---|---|---|---|
| `theme` | `light` or `dark` | required | the palette |
| `type` | `editorial` or `technical` | required | Newsreader + Public Sans, or IBM Plex Sans Condensed + Plex Sans; both use Plex Mono for figures |
| `palette` | any of `bg card ink soft muted rule rule2 accent onAccent save` as `#rrggbb` | the theme's | overrides; the build checks ink, soft, muted and save on bg and card at 4.5:1, onAccent on accent at 4.5:1, accent on bg at 3:1 |
| `lang` | up to 12 | `en` | page language |
| `id` | up to 24 | `pk` | the section's anchor and id prefix |
| `title`, `description` | 70, 170 | required | the page's title and meta description |
| `eyebrow` | 40 | required | small mono line above the headline |
| `headline` | 8 to 70 | required | `_words_` in the accent |
| `promises` | 1 to 3 × 52 | none | plain facts beside the headline (on phones, under the plans) |
| `currency`, `unit` | 3, 14 | required | `"$"`, `"/ month"` |
| `billing` | `{ monthly 12, yearly 12, saving 24, start "monthly"\|"yearly" }` | no switch | `saving` like "2 months free" or "20% off yearly" is checked against every plan; `start` default `monthly` |
| `scale` | `{ max ≥ top monthly price, step }`, at most 20 ticks | rounded top price | the price axis |
| `included` | `{ title 24, items 2 to 6 × 40, note 90 }` | none | what every plan has, beside the plans |
| `plans` | 2 to 4 | required | see below |
| `compare` | `{ title 30, groups 1 to 6 × { label 22, rows 1 to 10 × { label 34, values } } }` | none | one value per plan: `true`, `false` or text up to 14 |
| `calculator` | see below | none | |
| `faq` | `{ title 30, items 2 to 8 × { q 80, a 240 } }` | none | |

A **plan**: `name` (16), `for` (60), `monthly` and `yearly` (0 to 99999, 2 decimals at most; yearly is the monthly figure when billed yearly, at most the monthly price) or `custom` (12, e.g. "Let's talk") with optional `custom_note` (28), `cta` `{ label 24, href }` (https://, /path, #id, mailto: or tel:), `adds_title` (30), `adds` (1 to 5 × 34), and on exactly one plan `recommended` `{ label 32, reason 40 }`.

The **calculator**: `title` (30), `intro` (90), `one` and `many` (the unit: "person"/"people", "call"/"calls"), `suffix` (20, "on your team"), `min`, `max`, `value` (where it starts), `step` (linear, default 1, at most 400 stops) or `scale: "log"` (min above 0), and `plans`, one per plan in order:

- `{ "limit": 1 }`: the plan stops at this much ("Outgrown" above it);
- `{ "includes": 3, "each": 6, "each_yearly": 5, "per": 1 }`: the plan price covers `includes`; each further `per` costs `each` (or `each_yearly` when billed yearly);
- `{ "quote": true }`: for a custom plan.

The cost at a value is the plan's price for the billing period plus the overage; the cheapest priced plan lights, ties go to the smaller plan.

## How it behaves

- **Motion language**: one easing family, cubic-bezier(.2,.7,.2,1) for travel and (.3,.9,.2,1) for digits. Switch: thumb 240 ms; per plan, 60 ms apart, each digit column rolls 520 ms (right to left, 40 ms apart, only digits that change move), the plan's dot slides 600 ms along the scale with its leader re-routing, and the hatched saving grows out of the monthly price behind the dot; its "−$5" label arrives when the dot lands; the arithmetic retypes left to right (360 ms). Comparison: opens 520 ms, rows arrive 24 ms apart, "new" dots pop column by column, the ring holds on the plan you came from for 1.6 s. "Only what changes": 360 ms. Calculator: the knob follows the pointer, the highlight slides to the cheapest cell in 320 ms. On arrival the axis draws itself in 700 ms, the leaders drop in, the plans rise 14 px. Nothing loops.
- **Reduced motion**: every change is instant; nothing arrives.
- **Widths** (of the column the section sits in): 1180 px and up, a label column on the left and plan columns; 1000 to 1179, plan columns only, table labels above their values; under 1000, plans stack, every plan but the recommended one folds to a row (name, price, +), the switch and a compact scale (plan names under their dots) stick to the top, the comparison shows one plan at a time with plan tabs, the calculator cells go two by two.
- **Screen readers**: the switch is a radio group with arrow keys; each price is read as "$25 a month, billed $300 once a year" and changes with the switch, and a polite status says which prices are showing; the scale is decorative (`aria-hidden`); the comparison is a table with row and column headers and "new at this plan" spoken; the slider's `aria-valuetext` names the value, the cheapest plan and its price; the sentence under it is a polite live region; questions and folded plans are buttons with `aria-expanded`.

## Files

- `scripts/build.mjs`: checks pricing.json and writes `out/index.html` and `out/embed.html`.
- `scripts/check.mjs`: works the page at four widths and reduced motion and lists every problem.
- `scripts/record.mjs`: the preview video, single stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `scripts/kit/style.css`: the section's style, scoped under `.pk`, with container queries.
- `scripts/kit/runtime.js`: the motion and the interactions, inlined into the page.
- `scripts/kit/build.mjs`: the fields, their limits and the cross-field rules (saving claims, contrast).
- `examples/larchmere/pricing.json` and `examples/northvane/pricing.json`: the two examples.

## Troubleshooting

- **"billing.saving says 2 months free but Studio is …"**: a yearly price doesn't match the claim. Fix the price or change the words; never ship a claim one plan doesn't meet.
- **"palette: save … on card is 3.9:1"**: an overriding colour is too light or dark; darken it on light themes, lighten it on dark ones.
- **A price runs into the edge of its card**: four plans with five-digit prices are too wide at 1024 px; use three plans, or a unit like "/ seat" with smaller numbers.
- **The calculator never names a crossover**: one plan is cheapest across the whole range; widen `min`/`max` or check `includes` and `each`.
- **The layout moves while the slider moves**: a cell note or the sentence wrapped to an extra line; shorten `one`/`many`/`suffix` or plan names.
- **The prices don't roll**: monthly and yearly are the same; digits only roll where they differ.
- **A still shows a sliced digit**: it was taken mid-roll; use `--moments`.
- **Fonts look like Georgia or Arial**: the page couldn't reach Google Fonts; the fallbacks keep the layout, but check the network.
