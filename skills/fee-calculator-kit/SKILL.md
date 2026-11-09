---
name: fee-calculator-kit
description: Build the calculator section of a fintech or service landing page (money transfer, payroll, card processing, invoice financing) from one calculator.json. The visitor types or pastes an amount in either number format and sees the whole sum worked out - every fee as its own line, the exchange margin shown as money against a timestamped mid-market rate, a double-ruled result, the total cost in money and as a percentage, what happens to every 100 sent, and an optional comparison column ("a typical bank") that the build refuses without a source and a collection date. A time strip shows now, the real cut-off and the arrival across one or two time zones, with nights shaded and weekends and bank holidays skipped. Exact integer money with stated rounding (half-up, half to even, or down), digits that roll only where they change, an entrance that runs once, a phone result bar that steps aside when the real result is on screen, and disclosures set as numbered notes at reading size. It fetches nothing; a one-function rate adapter is documented. Two layouts (statement and receipt), a self-contained page and a paste-in embed, a check at four widths with a property test against an independent reference, and a frame-by-frame recorder.
license: MIT
---

# Fee Calculator Kit

The calculator section that answers "what arrives, what does it cost, and when". The governing idea: **show the working.** The amount the visitor types is the top line of a printed sum, every cost is a line they can read as money, the answer is double-ruled, and time gets the same treatment: a strip from now to arrival with the real cut-off drawn on it.

What the section holds:

1. **Head**: an eyebrow, a headline with one `_turn_`, a lede.
2. **The amount**: a text field set large, with `inputmode="decimal"`, that reads what is typed or pasted in either convention (`1.250,00`, `1,250.00`, `1 250,00 €`, `EUR 1250`). Problems get a plain message, `aria-invalid` and the last good figures kept (dimmed), never a silent clamp: empty, below the minimum or above the maximum (these wait for a 0.7 s pause, so "4" on the way to "4800" is not an error), not a number, negative, or more decimal places than the currency has. A non-numeric paste is refused and leaves the field as it was. On leaving the field the amount is rewritten in the page's own format.
3. **Toggles** (optional, up to 2): segmented buttons such as card type or where the card was issued; each fee line can depend on them.
4. **The ledger**: one line per fee with its formula under it ("0,35 % + 2,10 €"), the exchange margin as money ("0,45 % under the mid-market rate, as money"), the rate applied, a double rule, the result, then "Total cost, all in" as money and per cent. With `compare`, a second column shows the same lines for the comparison, in a grey measured to 4.5:1.
5. **Rate**: mid-market, ours and the comparison's, "Rate as of 12:05, 10 Nov, Berlin time" and a Refresh button.
6. **Of every 100**: a bar of what arrives, fees and margin, with the last few per cent enlarged and labelled as enlarged.
7. **Difference** (with `compare`): "They get 1.290.843 ₫ more than with a typical bank, about 42,64 €." It says "less" if the comparison is cheaper at that amount.
8. **Time strip**: "Wednesday 11 November, by 09:00", where and in whose time, and one true sentence about the cut-off (before it: "Send in the next 2 h 40 min..."; after it: "...passed 1 h 30 min ago, so it leaves on Friday"; on a weekend or holiday: "Today is not a business day..."). Beside it, a track with one row per time zone, hour or day ticks, nights shaded, weekends hatched, and markers for now, the cut-off and arrival. It is rewritten every 30 seconds on a live page.
9. **Notes**: numbered, at 15 px in the body colour, inside the sheet: (1) the comparison's source and the date it was collected, your own notes, and a rounding and timing note written from the config. Up to 2 legal lines under it.
10. **Phone result bar**: on a phone, a bar sticks to the bottom with the result and the arrival day while the real result is off screen, and steps aside as soon as the real result, or the end of the sheet, is on screen.

**Two layouts** (`"layout"`): `statement`, a single paper sheet with the sum on the left and a rail (rate, of every 100, difference) on the right, the time strip across the bottom; and `receipt`, the controls on the page ground on the left and the ledger printed on a receipt with a torn edge on the right, the time strip in its own panel below.

**Two type pairings** (`"type"`): `ledger` (Newsreader for figures and headings, Public Sans, IBM Plex Mono) and `terminal` (Geist, Geist Mono for the ledger figures).

**Money.** Amounts are integers in minor units (cents, or whole dong for a currency without them), rates and percentages are decimal strings, and nothing is a float. Each fee is `fixed + amount × percent`, rounded by `rounding`. The rate applied is `mid × (1 − margin)`, cut down to `rate.decimals` places. The amount received is `(amount − fees) × rate`, rounded by `receiveRounding`. The margin as money is `(amount − fees) × (mid − rate) / mid`, rounded by `rounding`. The total cost is fees plus margin; its percentage, the per-100 figures and the difference's "about" figure round half-up, and the per-100 "arrives" figure is 100 minus the other two, so the three always add up.

**Motion.** Per keystroke, only the digits that changed roll (420 ms, `cubic-bezier(.3,.9,.2,1)`, right to left, 30 ms apart); tabular figures and a result size fixed from the widest possible result keep the layout still. Once, when the sheet is 35 % in view: the ledger lines rise 10 px and fade in 60 ms apart (420 ms), the double rule draws (360 ms), the result rolls up from zero (700 ms), the time strip's bar grows from the cut-off to arrival (800 ms) and the arrival pin drops in (220 ms); settled after 1.7 s, marked `data-settled`. Refresh turns its icon once (480 ms). **Reduced motion**: every change is instant, nothing rolls, the entrance is settled from the start. **No JavaScript**: the HTML already carries the sum for the starting amount.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the recorder (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the preview video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`, or set `FFMPEG_PATH`).
- From the person: their real fees and how they depend on choices, the mid-market rate they quote and the time it was taken, their margin, their minimum and maximum, the cut-off time and zone, how many business days it takes and when it lands, and, for a comparison column, figures they have collected, where from and on what date.

Every fee, rate and comparison figure must come from the person. If they have no sourced comparison, leave `compare` out: the build will not draw that column without a source and a date.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/engine.js`: the exact money, the amount parser, cut-offs across time zones and the section's markup. The build runs it in Node for the starting HTML and the page runs the same file.
- `kit/runtime.js`: the browser runtime: typing and pasting, the digit rolls, the entrance, the toggles, the rate adapter, the minute-by-minute cut-off, the phone result bar and the recording clock.
- `kit/fees.css`: the whole design, scoped to `.fk`, following the width of its own column (container queries).
- `scripts/build.mjs`: calculator.json to `out/index.html` and `out/fee-calculator-embed.html`.
- `scripts/kit/schema.mjs`: every field, its limits, the money and clock rules and the contrast rules; lists every problem at once.
- `scripts/check.mjs`: the checks at 390, 768, 1024 and 1440 px and with reduced motion, the property test, the edge cases and the build's refusals.
- `scripts/kit/reference.mjs`: an independent second implementation of the sum with exact fractions, used only by the check.
- `scripts/record.mjs`: the preview video, stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/kittiwake/calculator.json` (statement, ledger) and `examples/brightquay/calculator.json` (receipt, terminal).

## Steps

### 1. Collect the numbers

Ask for, or read from their current pricing page: each fee (fixed, percent or both) and what it depends on, the mid-market rate and the time it was taken, the margin, the rate's decimal places, the minimum and maximum amount, the cut-off and its time zone, business days to arrival, the time it lands by and in which zone, the bank holidays that apply, and the rounding rules they actually use. For a comparison, ask where the figures come from and when they were collected. Don't invent any of it.

### 2. Write calculator.json

Copy the example closest in spirit and replace every value:

- `examples/kittiwake/calculator.json`: Kittiwake, transfers from euros (de-DE) to Vietnamese dong. `statement`, `ledger`, light. One fee, fees round half-up and the amount received rounds down to the whole dong; 1 business day, a 15:00 Berlin cut-off, arrival by 09:00 Ho Chi Minh City time.
- `examples/brightquay/calculator.json`: Brightquay, card processing on a euro sale paid out in dollars (en-US). `receipt`, `terminal`, dark. Two toggles (card type, where it was issued), half to even rounding, 2 business days, a 17:00 New York cut-off that the preview has just missed, with the weekend and a holiday list.

Money and percentages are strings (`"2.10"`, `"0.35"`); a number literal is refused. Set `preview.now` to the moment the stills and checks show; the live page always uses the visitor's real clock.

### 3. Build

```
node <skill>/scripts/build.mjs calculator.json out
```

It lists every problem at once (a missing field, money given as a number, more decimal places than the currency has, a minimum above the maximum, a fee case that names a toggle that doesn't exist, a time zone or locale that doesn't exist, a rate time later than `preview.now`, a comparison without `source` or `collected`, a colour pair under its contrast minimum, a line too long for its place, an exclamation mark or an em dash) and writes nothing until they are fixed.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px, and with reduced motion at 390 and 1440, with "now" pinned to `preview.now`. It fails on:

- script errors, links without an address, sideways scrolling, `NaN` or `undefined` anywhere in the section
- copy under 16 px on a phone or 14 px elsewhere (labels: 12 px), buttons under 44 px on a phone
- text, figures included, under WCAG AA contrast against what is behind them; the comparison column is reported on its own (4.5:1)
- text cut off or off the screen, a figure outside its cell, time-strip labels overlapping
- the entrance not settling; under reduced motion, not settled from the start or a digit still rolling; without it, an amount change that rolls nothing
- the layout moving as the amount changes (20 amounts from the minimum to the maximum)
- a rate time later than now, or a time on the page that disagrees with the clock
- on a phone, the result bar hidden while the result is off screen, or shown while it is on screen
- a keyboard focus that can't be seen

and once, at 1440:

- **the property test**: 300 amounts (the minimum, the maximum, the start, amounts where a percentage fee lands exactly on half a cent, and random amounts spread both evenly and by order of magnitude), through every toggle combination, typed in the page's own format, the other format and bare digits. For each, `scripts/kit/reference.mjs` recomputes every line with exact fractions and the page's Intl formatting, and every figure, the digits its rolling columns actually show, the per-100 bar widths, the enlarged strip and the difference sentence must match exactly.
- **the edge cases**: empty, below the minimum, above the maximum (a message after the pause, the field left as typed), a non-numeric paste and non-numeric typing, a negative typed and pasted, too many decimals, and a good paste in the other format.
- **the live region**: silent while typing, then it says the received amount and the total cost about 0.6 s after typing stops.
- **the build's refusals**: a rate time one minute after `preview.now`, a comparison without `source` or without `collected`, and money given as a number.

Each line prints how many text pairs it measured, the lowest contrast as a multiple of its minimum, and the comparison column's lowest contrast. Fix and build again until it prints `all checks passed`. `--cases 1000` runs a longer property test.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Type an amount, paste one in the other format, try the toggles, and look at it on a phone width. Add `?fk-now=2026-11-14T10:00` to the address to see the cut-off sentence on another day (the time is read in the cut-off's zone).

### 6. Put it on the site

Paste `out/fee-calculator-embed.html` where the calculator goes. It brings its own fonts, styles and script, every class starts with `fk-`, and it adapts to the width of the column it sits in. It fetches nothing. To show live rates, define an adapter before the embed:

```html
<script>
  window.FeeKitRates = async ({ from, to }) => {
    const r = await fetch(`/api/rate?from=${from}&to=${to}`).then((x) => x.json())
    return { mid: r.mid, asOf: r.asOf } // mid as a decimal string, asOf as an ISO time or epoch ms
  }
</script>
```

Refresh then calls it, refuses a rate whose time is in the future, rolls the new rate and re-rolls the sum from the rate line down. Without an adapter, Refresh says the rates are fixed for this page (`rate.fixedNote`).

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 13.5 --poster 2.6
node <skill>/scripts/record.mjs out/index.html --still 2.6 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --still 2.6 --full --png whole-page.png
```

The video follows a fixed script: the entrance, `preview.type` typed key by key, then `preview.toggle` and/or `preview.paste`, a scroll to the time strip and back. `--moments` prints the stretches where nothing moves; take stills inside them (the recorder warns if a still catches something moving).

## calculator.json, every field

Top level:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `statement`, `receipt` | required | |
| `type` | `ledger`, `terminal` | required | the type pairing |
| `brand` | 1 to 40 characters | required | the column heading and the rate line |
| `lang` | language tag | `en` | the page's `lang` |
| `locale` | a locale such as `de-DE`, `en-US` | required | number format, and how ambiguous input is read |
| `eyebrow` | up to 32 | required | |
| `headline` | up to 48, one `_turn_` | required | |
| `lede` | up to 170 | required | |
| `receiptTitle` | up to 24 | `preview` | receipt only |
| `from`, `to` | `{ code, decimals, symbol? (up to 3), unit? (up to 16) }` | required | `decimals` must be what the currency uses (VND 0, EUR 2) |
| `amount` | `{ start, min, max, hint? (up to 70) }`, strings | required | min above 0, start between min and max |
| `rate` | `{ mid, margin (0 to 10), decimals (0 to 6), asOf, fixedNote? (up to 90) }` | required | `mid` and `margin` are strings; `asOf` is `"YYYY-MM-DDTHH:MM"` in `arrival.cutoffZone` and may not be later than `preview.now`; `mid` is ignored when both currencies are the same |
| `rounding` | `half-up`, `half-even` | required | fees and the margin as money |
| `receiveRounding` | `down`, `half-up`, `half-even` | required | the amount received |
| `toggles` | 0 to 2 `{ id, label (up to 20), options: 2 or 3 { value, label (up to 14) }, default }` | none | |
| `fees` | 1 to 4 rows `{ label (up to 24), none? (up to 40), cases: 1 to 4 }` | required | the first case whose `when` matches the toggles applies; with none, the fee is 0 and `none` is shown |
| fee case | `{ when?: { toggleId: value }, fixed?, percent? (0 to 20), detail? (up to 40) }` | | at least one of `fixed` and `percent`; `detail` replaces the formula line |
| `compare` | see below | none | the comparison column |
| `arrival` | see below | required | |
| `notes` | 0 to 2 `{ title (up to 24), text (up to 240), link? }` | none | the comparison note and the rounding note are added for you |
| `legal` | 0 to 2 lines, up to 110 each | none | keep "Figures in this example are illustrative." until the figures are real |
| `words` | each up to 48 | see below | the section's own words |
| `messages` | each up to 90 | built in | `empty`, `nonnumeric`, `negative`, `decimals`, `min`, `max` |
| `preview` | `{ now, type?, paste? (up to 24), toggle? { id, value } }` | `now` required | `now` is `"YYYY-MM-DDTHH:MM"` in `arrival.cutoffZone`; `type` is digits typed in the video (default `"2400"`) |
| `theme` | see below | required | |

`compare`: `label` (up to 20), `inText` (up to 30, how the sentence names it, such as "a typical bank"), `fees` (one row per row of `fees`, each `{ cases }`), `margin` (string, 0 to 15), `source` (20 to 220 characters, required), `collected` (`"YYYY-MM-DD"`, required, not after `preview.now`), `link?` `{ label, href }`.

`arrival`: `cutoff` (`"HH:MM"`), `cutoffZone` (an IANA zone), `cutoffCity` (up to 20), `businessDays` (1 to 10), `by` (`"HH:MM"`), `zone`, `city` (up to 24), `where` (up to 60, "in their bank account in Vietnam"), `holidays?` (`"YYYY-MM-DD"` dates skipped in both zones), `note?` (up to 160, added to the rounding note).

`words` (defaults in brackets): `send` (You send), `receive` (They receive), `onThis` (On this transfer), `ours` (the brand), `margin` (Exchange margin), `marginNote` ({pct} under the mid-market rate, as money), `rate` (Rate applied), `total` (Total cost, all in), `arrives` (Arrives), `arrivesShort` (Arrives), `per100` (you send), `reach` (Arrives), `fees` (Fees), `who` (They get), `more` (more), `less` (less), `unit` (transfer), `difference` (Difference), `sameCurrency` (Same currency, nothing to convert).

`theme`, colours `#rrggbb`:

| Field | Rule | Used for |
| --- | --- | --- |
| `page` | | the section's ground |
| `sheet` | | the sheet, notes and time strip |
| `paper` | optional, receipt | the receipt; default `sheet` |
| `ink` | 7:1 on `page`, `sheet` and `paper` | text; muted text is derived at 5.2:1 and the comparison grey at 4.8:1 |
| `cost` | 4.5:1 on `sheet` and `paper` | costs, the fee bars, error messages |
| `accent` | 4.5:1 on every ground | the turn, note numbers, the arrival marker |
| `onAccent` | 4.5:1 on `accent` | text on the arrival pin |
| `result` | optional; 4.5:1 on `sheet` and `paper` | the result, the double rule, the arriving bar, the phone bar; default `ink` |
| `mark` | optional | the highlighter under the difference |

## Troubleshooting

- **The build lists problems and writes nothing.** Fix them all and build again; it reports everything at once.
- **"rate.mid must be a string".** Write `"30412.80"`, not `30412.80`. Money is never a float here, so `0.1 + 0.2` can't happen.
- **"rate.asOf is later than preview.now".** A quote can't come from the future. Set `asOf` to when the rate was actually taken, in the cut-off's zone, or move `preview.now` later.
- **The comparison column is missing or refused.** It needs `source` and `collected`. Without a dated source, leave `compare` out.
- **A pasted amount came out a thousand times too small or too large.** A lone separator followed by exactly three digits is read as grouping unless it is the page's own decimal mark: in `en-US`, `1.250` is 1.25; in `de-DE` it is 1250. The field shows the reading in the page's format as soon as you leave it.
- **The arrival day looks a day off.** Business days are counted in `arrival.zone` and the cut-off day in `arrival.cutoffZone`; check both zones and the holidays list. Open the page with `?fk-now=` to try other times.
- **The result looks small.** Its size is fixed from the widest result the field can produce (the maximum amount), so typing never resizes the layout. Lower `amount.max` if the largest amounts are rare.
- **The check says the layout moves.** A line wrapped to an extra line at some amount; shorten a label, a `detail` or `words.who`.
- **No video.** Install ffmpeg or set `FFMPEG_PATH`. The checks and stills don't need it.
