---
name: faq-kit
description: Build the questions section of a landing or pricing page from one faq.json - a FAQ you can read closed. Every question carries its short answer (28 characters at most) in a ruled column beside it, so a sceptical visitor gets the verdict on every objection by scanning down and opens only what needs detail. Answers have real structure (paragraphs, numbered steps, small tables whose computed cells are checked against their arithmetic, links to docs). Search narrows the list as you type and finds text inside answers, shown as a snippet. Every answer has a #link that opens and scrolls to it. Topic groups get a sticky contents rail; a flat list gets ruled column heads. It closes on named people, a stated response time and a live status in their time zone. The FAQPage JSON-LD is written at build time from the same text, and checked against the page. Native details/summary, so everything reads with JavaScript off. Builds a page and a paste-in embed, with checks at four widths, reduced motion and no-JS, and a frame-by-frame recorder.
license: MIT
---

# FAQ Kit

A questions section that answers objections instead of hiding them. The governing idea: **a FAQ you can read closed.** Each entry is a numbered reference entry with three parts: an address (§ 2.1, or No. 03), the question, and a **short answer** of at most 28 characters ("30 days, no card", "Frankfurt, EU", "Yes · 100 nights"), set in its own ruled column under a "Short answer" head. Scanning down that column gives the verdict on every objection. Opening an entry gives the long answer.

- **Answers with structure.** An answer is 1 to 5 blocks: paragraphs (with **bold**, `code` and links), numbered steps, a small table, a row of links to your docs, a note. A table can mark a column as **computed** and give the arithmetic for each cell (`"14 * 16 / 31"`): the build refuses a cell the arithmetic doesn't give, and the check recomputes it in the page.
- **Search that narrows as you type.** It matches questions, short answers and the text inside answers. Rows that don't match disappear at once, the match is highlighted, a match inside an answer shows its sentence (or table row) as a snippet under the question, each topic's count becomes "1 / 3", and a search with no answer points to the contact with its stated response time. `/` focuses it; Escape clears it.
- **Every answer has a #link.** `#export` opens that answer, scrolls it to the top of the screen (below the phone search bar), moves focus to its question and flashes the margin marker once. Opening an answer by click writes its #link into the address bar, and each answer has a "Link to 2.1" copy button.
- **Motion that explains state.** An answer opens to its measured height (220 ms plus 0.28 ms per pixel, at most 480 ms, `cubic-bezier(.2,.7,.2,1)`) while its text fades and drops 6 px into place. It closes in at most 360 ms, and only then is `open` removed. The plus becomes a minus, and a 2 px accent rule grows in the margin beside the open entry. A click during a motion reverses it from where it is. Nothing animates in on scroll.
- **Two layouts.** `index` (for 2 to 6 topic groups): the intro, search and a numbered contents list with leader dots and counts sit in a sticky rail beside the list, which marks the topic you are in. `ledger` (a flat list of 3 to 14): the intro and search across the top, then one ruled list under "No. / Question / Short answer" heads.
- **The close.** "Still stuck?" names the people who answer, what each one handles, the promised response time and last month's median if you have it, and a status line worked out live in their time zone: "Online now · 11:40 in Lisbon" or "Back tomorrow at 10:00 · 20:10 in Utrecht now".
- **Structured data from the same text.** The FAQPage JSON-LD is written into the HTML at build time: each question's name is the visible question, and each answer is the visible short answer followed by the visible long answer. The check compares them character by character, so they cannot drift.

**Without JavaScript** every question and answer is in the HTML as native `<details>`/`<summary>`, so they open and close, the contents links scroll, and the JSON-LD is there. Search, the status line and the copy button are hidden, because they can't work. **Reduced motion** opens and closes at once and scrolls without smoothing; the column rule, the marker and the layout stay.

**Find-in-page.** Chrome and Edge (since version 97) search inside closed `<details>` and open the one holding the match, and do the same for `#:~:text=` links; the runtime notices and stays in step. Safari and Firefox don't search inside a closed `<details>` in the versions we know of, so there the search field is the way in. We tested find-in-page behaviour in Chrome only; the check confirms the `#:~:text=` path where the browser supports it and says so where it doesn't.

**What you can change, honestly.** Every word and link, the layout, the colours (contrast enforced at build time and measured again in the check), the type set (`book`: Newsreader, Public Sans and JetBrains Mono, italic turn; `readout`: Schibsted Grotesk with IBM Plex Mono short answers, colour turn), ink or accent buttons, square or pill corners, and every word of the interface (`text`). The spacing, the type scale and the motion are the design and stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/faq.css`: the whole design, scoped to `.fq`. Both layouts, both type sets, tablet and phone rules, the phone search bar, reduced motion.
- `kit/runtime.js`: the browser runtime, inlined into every build. Measured open and close, search, #links, copy-link, the current topic, the phone bar, the live status, and the recording clock.
- `scripts/build.mjs`: faq.json to `out/index.html` (a page holding the section) and `out/faq-embed.html` (the section to paste in), both with the JSON-LD.
- `scripts/kit/schema.mjs`: every field, its limits, the contrast rules and the arithmetic for computed cells; lists every problem at once.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, and with JavaScript off at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/fernwork/faq.json`: Fernwork, time tracking and invoicing for studios. Light, `book`, three topic groups, a computed proration table.
- `examples/orrery/faq.json`: Orrery, active loudspeakers with a home trial. Dark, `readout`, one flat ledger, accent pill buttons.

## Steps

### 1. Collect the real questions

From the person, their support inbox, their sales calls or their current FAQ:

- **The objections people actually raise** before buying: price and billing, trials and refunds, data and security, switching, delivery, compatibility. Ten real ones beat twenty invented ones.
- **A short answer for each**, 28 characters at most, that is the answer itself: "Yes, from 10 seats", not "Read more about invoices". If the honest short answer is "It depends", the question is two questions.
- **The detail**: the steps someone follows, the numbers in a table, the doc page that goes deeper. Use their real figures; if a table's numbers are worked out (a prorated charge, a price per seat), write down the arithmetic for each cell.
- **Who answers** when this isn't enough: names and what each handles, the response time they actually keep (it must contain a number), their hours and time zone, and the contact links.

Use their real numbers, times and names. If they have none, leave that part out rather than inventing it.

### 2. Write faq.json

Copy the example closest in spirit and replace every value:

- `examples/fernwork/faq.json`: `groups` (topics), the `index` layout, the `book` type set on warm paper.
- `examples/orrery/faq.json`: one flat `items` list, the `ledger` layout, the `readout` type set on near-black.

Give each answer an `id`: it is the #link (`#export`), so keep it short and stable. Pick `preview` entries for the video if you'll record one.

### 3. Build

```
node <skill>/scripts/build.mjs faq.json out
```

It lists every problem at once and writes nothing until they're fixed: a short answer over 28 characters, an id used twice (every #link must be unique), a computed cell the arithmetic doesn't give, a response time without a number, a colour pair under its contrast minimum, a table row with the wrong number of cells, a link that isn't `https://`, `mailto:`, `tel:`, `/path` or `#id`. Shorten words rather than asking for smaller type.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px wide, with reduced motion at 390 and 1440, and with JavaScript off at 390 and 1440. With every answer open, it fails on:

- script errors, links without an address, an id used twice
- sideways scrolling
- text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
- text under WCAG AA contrast against the colour actually behind it
- text cut off or off the screen
- the JSON-LD not matching the page: the same questions in the same order, each name the visible question, each answer the visible short answer and long answer, character for character
- a computed table cell that its arithmetic doesn't give
- a click or Enter that doesn't open to the full height and close again; with reduced motion, anything that isn't instant
- search: the example query not narrowing the list, a row left in that doesn't match (or a matching row hidden), the count wrong, no highlight, no way to the contact when nothing matches, clearing not bringing every row back
- a #link that doesn't open its answer, bring it to the top of the screen below the phone bar, and focus its question
- an answer the browser opens by itself (find-in-page) not picked up by the runtime; a `#:~:text=` link to a closed answer not opening it, where the browser supports it
- the contents rail not staying beside the list or not marking the current topic; the phone search bar not appearing once the search has scrolled away (or showing while it is on screen)
- no contact status line
- a keyboard focus that can't be seen (it presses Tab through the page)
- with JavaScript off: an answer missing from the HTML, a question that won't open on a click, no JSON-LD, or a search box that shows

Each line prints how many text and background pairs it measured, the lowest contrast as a multiple of the minimum, and how many questions and computed cells matched. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints on a laptop and a phone. Read the short-answer column alone, top to bottom: it should read as a list of answers. Try a search, and open `#your-id` directly.

### 6. Put it on the site

Paste `out/faq-embed.html` where the questions go. It brings its fonts, styles, script and the JSON-LD; every class starts with `fq-`, and the section's own id is `faq`. Keep the JSON-LD on the same page as the questions. If your page already has a FAQPage block, remove the old one, or set `"schema": false` to leave the kit's out. Use one FAQ Kit section per page.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --seconds 18 --poster 2.6
node <skill>/scripts/record.mjs out/index.html --still 6.4 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --moments
```

The video follows a fixed 18-second script: rest on the questions, open `preview.open[0]` (1.4 s), scroll to the next topic and open `preview.open[1]` (5 s), close both and type `preview.query` letter by letter (8.2 s), clear it and follow the #link to `preview.deepLink` (11.2 s), end on the contact (15 s). `--moments` prints the stretches where nothing moves (`top`, `open`, `middle`, `search`, `deeplink`, `contact`); take stills from inside them.

## faq.json, every field

Top level:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `auto`, `index`, `ledger` | `auto` | auto: `groups` give index, `items` give ledger |
| `lang` | language tag | `en` | the built page's `lang` |
| `groups` | 2 to 6 × `{ id, title (28), short? (12), items }` | | topics; `short` is the phone chip; 2 to 8 entries each |
| `items` | 3 to 14 entries | | a flat list; give `groups` or `items`, not both |
| `open` | 0 to 2 entry ids | `[]` | open when the page loads |
| `schema` | true / false | true | write the FAQPage JSON-LD |

An entry:

| Field | Range | Notes |
| --- | --- | --- |
| `id` | a slug, a to z, 0 to 9 and -, up to 41 characters | the #link; unique across the section |
| `q` | up to 110 characters | the question |
| `short` | 1 to 28 characters | the short answer; must not repeat the question |
| `a` | 1 to 5 blocks | the long answer |

Blocks: `{ "p": "…" }` (up to 600 characters; `**bold**`, `` `code` ``, `[label](https://…)`), `{ "note": "…" }` (the same, set smaller), `{ "steps": [2 to 7 × up to 160 characters] }`, `{ "more": [1 to 3 × { label (34), href }] }`, and `{ "table": { head, rows, caption?, computed? } }`: `head` 2 to 4 cells (24 characters each), `rows` 1 to 6 rows of the same number of cells (28 each), `caption` up to 120, and `computed` `{ column (0-based), exprs: [one per row], decimals (0 to 4, default 2) }`, where each expression uses only numbers, `+ - * /` and brackets.

`theme`, colours `#rrggbb`:

| Field | Rule | Default | Notes |
| --- | --- | --- | --- |
| `bg` | | required | the section's paper |
| `ink` | 7:1 on `bg` | required | text; the mute is derived at 5:1 and the rules from it |
| `accent` | 4.5:1 on `bg` | required | short answers, step numbers, the margin marker, focus rings |
| `turn` | 3:1 on `bg` | `accent` | the headlines' `_turn_` |
| `mark` / `markInk` | 4.5:1 between them | a tint of `accent` / `ink` | the search highlight |
| `live` | | `accent` | the online dot |
| `type` | `book`, `readout` | `book` | the type set |
| `button` | `ink`, `accent` | `ink` | the first contact button's fill; accent needs a text colour at 4.5:1 |
| `corners` | `square`, `pill` | `square` | buttons |

`intro`: `eyebrow` (up to 40 characters), `headline` (up to 60, one `_turn_`), `lede` (optional, up to 220).

`search`: `label` (32, default "Search the answers"), `placeholder` (44, default "Search"), `hotkey` (true: `/` focuses it).

`contact`:

| Field | Range | Notes |
| --- | --- | --- |
| `headline` | up to 60, one `_turn_` | |
| `text` | up to 260 | `**bold**` allowed |
| `promise` | up to 28, with a number | the response time you keep: "4 working hours" |
| `people` | 1 to 4 × `{ name (28), remit (24) }` | who answers, and what each handles |
| `city`, `timezone` | an IANA zone, e.g. `Europe/Lisbon` | the status is worked out there |
| `hours` | `{ days: ["mon" …], open: "08:00", close: "18:00" }` | 24-hour |
| `now` | a date and time | previews only: freezes the status (the examples use 5 November) |
| `actions` | 1 to 2 × `{ label (30), href }` | the first is filled |

`text`: every word the section shows besides your content, in English by default: `shortAnswer`, `question`, `number`, `answers`, `linkTo`, `copied`, `count` (`{n} of {total} answers mention “{q}”`), `none`, `ask`, `replies`, `railNote`, `railAsk`, `railReplies`, `searchBar`, `online`, `offline`, `today`, `tomorrow`, `days` (Sunday first), `topics`.

`preview` (the video only): `open` (2 entry ids), `query` (up to 16 characters), `deepLink` (an entry id). Defaults are picked from your answers. `demo.title` (up to 70): the built page's title.

## Troubleshooting

- **Build says a short answer is too long.** It is a verdict, not a summary: 28 characters. Move the detail into the long answer and keep the answer itself ("Yes, from 10 seats").
- **Build says a computed cell is wrong.** Either the table or the arithmetic has a mistake; it prints both. Fix whichever is wrong. Rounding is to `decimals` places.
- **Check says the JSON-LD differs from the page.** Something changed the page's text after the build (a script, a translation plugin, a hand edit). Edit faq.json and build again rather than editing the HTML.
- **Find-in-page doesn't open an answer.** Your browser doesn't search inside closed `<details>` (Safari and Firefox, at the time of writing). Use the search field; it searches the answers too.
- **A #link scrolls but doesn't open.** JavaScript is off, or the id is wrong (it is the entry's `id`, without `g-`). Without JavaScript the reader opens the question themselves.
- **The status is wrong.** Check `contact.timezone` and `hours`, and remove `contact.now`, which freezes the clock for previews.
- **The rail doesn't stick.** The section sits inside an element with `overflow` other than `visible`, which stops `position: sticky`. On screens under 900 px the rail is not sticky by design: the topics become chips and the phone search bar takes over.
- **Check fails on contrast after changing colours.** It prints the measured pair. Darken the ink or the accent rather than lightening the paper.
