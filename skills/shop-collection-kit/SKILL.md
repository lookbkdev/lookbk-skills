---
name: shop-collection-kit
description: "Build a small brand's collection or category page from one page.json - a collection header with the brand's point of view, a sticky filter bar whose chips re-lay the grid with a FLIP glide (no jump), numbered product plates that turn over on hover, focus or tap to show the reverse of the piece (the raw foot and maker's stamp, the hallmark inside a band), swatches that change the photograph, honest prices with their currency and one plain stock line (low, back soon with a date, sold out with Notify me), an editorial band in the grid, a quick-view sheet with options, sizes and per-option stock, and an Add to bag that turns into a bag slip. Phone layout with a 2-up grid, a sticky chip bar, a filter sheet and bottom sheets. Includes a three.js still-life renderer that makes true-scale product photographs (ceramics, jewellery) from the same config when the shop has no photos yet, a check at four widths and a frame-by-frame recorder. Use for independent shops: ceramics, jewellery, homewares, small-batch goods."
license: MIT
---

# Shop Collection Kit

A collection page built around one idea: **every piece is shown the way a good shop assistant hands it to you**. Front first; turned over on hover (or focus, or a tap on the turn button) to show what a buyer of handmade things asks to see, the unglazed foot and the maker's stamp, the 375 inside a band; laid out again, never reshuffled, when you filter; lifted into your hand in the quick view; and the stock told plainly.

The person's agent writes `page.json`; the build checks it, lists every problem at once, and writes a self-contained page plus a paste-in embed.

What the page holds, top to bottom:

1. **Header**: wordmark, up to 6 links, Search, the currency code, Bag with a count that rolls up when something is added.
2. **Collection header**: a mono label ("Collection 04 · Autumn firing"), a large title with one `_italic_` turn, the brand's point of view in a sentence or two, and up to 5 facts (pieces, material, care, a link).
3. **Filter bar** (sticky): category chips with counts, option chips drawn as real swatches (glaze, metal, colour), an In stock switch, a sort and a live count. Under 1440 px the options move into a filter sheet behind a Filter button; on a phone the chips scroll sideways under a fade.
4. **Plates**: each product is a numbered plate (No. 01 to No. n, fixed: filtering and sorting never renumber), a 4:5 photograph with a scale rule ("5 cm") when the photos are true scale, then name, price with currency, option and size, swatches and one stock line. Turned over, the photograph crossfades to the reverse, a corner label names it ("Turned over", "Inside", "From behind") and the caption line rolls to say what you are looking at.
5. **Editorial band**: after the first full row, a wide photograph and a quote from the maker with one `_italic_` phrase, a byline and a link. It always sits after a full row, and an end note fills any gap the last row leaves, so the grid never ends in a hole.
6. **Quick view**: a sheet from the right (bottom sheet on a phone) with the front and the reverse side by side, the description, the options with their own prices and stock, a second choice (quantity, set, ring size) with notes ("1 left") and sold-out items struck through but readable, and Add to bag with the price. Adding turns the button into the **bag slip**: the line with its thumbnail and choices, the bag total, the delivery line, Keep looking and Check out. On short screens the slip is scrolled into view.

There is no field for a sale price, a percentage badge or a countdown: the build refuses `compareAt`, `discount`, `badge` and the like. Low stock must say how many; back soon must give a date.

## What you need

- Node.js 18 or newer. Chrome, Chromium or Edge for the check, the recorder and the still renderer (set `CHROME_PATH` if it is somewhere unusual), and ffmpeg for the video.
- From the person: their products (name, category, price, size, options, stock as it really is), a point of view for the collection, and **photographs**: for every product and option a front photo and a photo of its reverse, ideally all shot on one seamless background with one light, at 4:5 (1600×2000 or 960×1200), as WebP.
- If they have no photographs yet and the products are thrown ceramics or simple jewellery, the still renderer can make true-scale stills from the config (see step 3). Say plainly that these are computer graphics, not photographs.

Every price, stock note and date must come from the person. If they don't know when something is back, use `out` (sold out, Notify me), not `soon`.

## Steps

### 1. Collect the collection

Ask for, or read from their current shop: the products and their categories, prices in one currency, sizes in the words they use, the options (glazes, metals, colours) and which options are in stock, and one or two sentences in the brand's own voice about this collection. Ask what the reverse of each piece shows (a stamp, a hallmark, a lining, a label) and what to call it.

### 2. Write page.json

Copy the example closest in spirit and replace every value:

- `examples/wrenfold/page.json`: Wrenfold, a two-person pottery. Light, Source Serif 4 and Instrument Sans, GBP, glazes, sets of 2 and 4, an editorial band about the kiln.
- `examples/sorne/page.json`: SORNE, a small goldsmith. Dark, Bodoni Moda and Albert Sans, EUR, metals with their own prices, EU ring sizes with a sold-out size, a band about the 375 hallmark.

### 3. Photographs

**With real photographs** (the usual case): put them in the folder `photos.dir` names (default `photos/` next to page.json) as `<id>-<option>.webp` (front) and `<id>-<option>-turn.webp` or `<id>-turn.webp` (reverse), plus the editorial photo. Delete the `stills` block. If the shots share one camera distance, set `photoMmAcross` on each product (how many millimetres the frame is wide) to get the scale rule.

**Without photographs**: keep the `stills` block and run

```
node <skill>/scripts/stills.mjs page.json
```

It builds every piece in 3D (thrown pots with glaze over raw clay, drips, speckle, throwing lines and a stamp pressed into the foot; comfort-fit bands with an engraved hallmark, bezel-set stones, hinged hoops with hinge and post, pearl studs with post and butterfly, a disc pendant on a cable chain) and writes the fronts, the reverses and the editorial still into `photos/`, with `scale.json` saying how wide each frame is in millimetres. Every product in a collection is shot from the same distance, so a 14 mm hoop really is half the size of a 26 mm one; a piece that would fill less than `minFill` of the frame is brought closer and its plate says so ("Shown 1.1× larger"). The same config always gives the same pictures. `--only band,stack` re-renders some; `--draft` renders at half size.

### 4. Build

```
node <skill>/scripts/build.mjs page.json out
```

It lists every problem at once (a missing photo of a reverse, a turn without a label or caption, a caption too long for one line, low stock without a number, back soon without a date, a sale field, an option or category that doesn't exist, a colour pair under AA contrast) and writes nothing until they are fixed. Shorten the words rather than asking for smaller type.

### 5. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, and works it: turns a plate over by hover or the turn button, changes a swatch (front and reverse must both change), filters by a category (the right plates, gliding, not jumping, numbers unchanged, the count right), by an option and by In stock, sorts by price, opens the filter sheet on narrow screens, opens the quick view, picks a choice, adds to bag (the slip must be fully in view and the bag count go up), closes it with Escape, then tabs through the page (focus must show and turn the plate it is in). It fails on script errors, sideways scrolling, copy under 16 px on a phone or 14 px elsewhere (labels: 12 px), text under AA contrast, text cut off or inside the 16 px phone margin, a swatch ring poking out of its plate, a grid that ends in a hole, and reduced motion that still moves. Fix and build again until it prints `all checks passed`.

### 6. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Hover the plates, filter, open a quick view and add something; then try it at a phone width.

### 7. Record the video (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920×1080, 30 fps, 15.6 seconds: rests on the header, scrolls to the plates, turns one over, changes a swatch, filters to one category and back, opens the quick view, chooses and adds to bag) and `out/poster.png`. `--still 4.4 --png moment.png` saves one moment; add `--size 390x844 --scale 2` for a phone. Take stills inside the quiet stretches the page reports:

```
node <skill>/scripts/record.mjs out/index.html --moments
```

It prints `{"length":15.6,"moments":[["header",0.6,1.6],["turned",3.9,4.9],["swatch",5.9,6.7],["filtered",8.2,9.1],["all",10.4,11.1],["quickview",12,12.8],["added",14.2,15.5]]}`.

### 8. Hand it over

Upload `out/index.html` with `out/photos/`, or paste `out/embed.html` where the collection goes on an existing page and put `photos/` beside that page. Wire `brand.bagHref` and `brand.checkoutHref` to the real cart; the slip shows what was added and the total, and the shop's own cart takes it from there.

## Fields

Text limits are characters; `_italic_` marks don't count.

| Field | Range | Default | What it is |
|---|---|---|---|
| `brand.name` | 24 | required | the wordmark |
| `brand.url`, `bagHref`, `checkoutHref`, `searchHref`, `notifyHref` | https://, /path or #id | url + `/search`; notify = url | where things go |
| `brand.nav` | 0 to 6 × `{ label 16, href, current }` | none | the header links |
| `money` | `{ currency "GBP", symbol "£", decimals 0 or 2 }` | required | prices print as `£34.00` or `€240` |
| `look` | `light` or `dark` | required | the palette |
| `type` | `editorial` or `didone` | required | Source Serif 4 + Instrument Sans + Spline Sans Mono, or Bodoni Moda + Albert Sans + IBM Plex Mono |
| `colors` | any of `bg ink muted rule plate plateInk low soon focus edBg edInk` as `#rrggbb` | the look's | overrides; ink, muted, low and soon on bg, plateInk on plate and edInk on edBg are checked at 4.5:1 |
| `collection.crumb` | 2 × 28 | required | `["Shop", "Tableware"]` |
| `collection.label` | 40 | required | the mono line above the title |
| `collection.title` | 30, one `_italic_` | required | the big title |
| `collection.pov` | 40 to 240 | required | the brand's point of view |
| `collection.facts` | 0 to 5 × `{ label 12, value 44, href }` | none | the ruled list (desktop) |
| `collection.short` | 60 | required | one line that replaces the facts on a phone |
| `filters.categories` | 1 to 6 × `{ id, label 14 }` | required | the chips; ids are lowercase, digits and dashes |
| `filters.optionLabel` | 12 | required | "Glaze", "Metal", "Colour" |
| `filters.options` | 1 to 8 × `id: { label 18, swatch, filter }` | required | `swatch` is `#rrggbb` or a CSS gradient; `filter: false` keeps an option (a mixed pair) out of the chips |
| `filters.sort` | 0 to 3 × `{ id "list"\|"kiln"\|"price-low"\|"price-high", label 22 }` | none | the first is the starting order |
| `photos` | `{ dir, rule { mm 1 to 1000, label 8 } }` | `photos`, no rule | where the photographs are, and the scale rule drawn on each plate |
| `turnWord` | 14 | `Turned over` | the quick view's reverse caption |
| `tour.turn` | a product id | the second product | which plate the recorded tour turns over |
| `products` | 2 to 36 | required | see below |
| `editorial` | see below | none | the band in the grid |
| `end` | `{ text 70, link { label 28, href } }` | "That is every piece in …" | the note that fills the last row |
| `bag` | `{ items 0 to 99, total, delivery 40 }` | 0, 0 | what is already in the bag, for the slip's total |
| `promises` | 0 to 3 × 32 | none | plain facts under the quick view |
| `words` | any of the interface words | English | translate "In stock", "Add to bag", "Shown {x}× larger"... |
| `stills` | see below | none | the renderer's set-up; delete it when using real photographs |

A **product**: `id` (names its photos), `name` (34), `category`, `price` (0 to 10 000 000), `size` (40; "Oat · " plus the size must fit 38), `options` (1 to 6 option ids), `optionPrices` `{ option: price }`, `stock` `{ state "in"|"low"|"soon"|"out", note 34, action 14 }` (low needs a number, soon a date), `optionStock` `{ option: stock }`, `turn` `{ label 14, caption 40, captionByOption { option: caption } }` (required), `description` (220), `choices` `{ label 14, note 24, noteHref, items 1 to 12 × { label 12, price, note 12, soldOut }, default }`, and `still` (for the renderer).

The **editorial band**: `after` (1 to 36, rounded down to a full row), `label` (24), `quote` (150, one `_italic_`), `by` (48), `link` `{ label 28, href, note 14 }`, `photo` (a file in photos), `photoAlt` (120), `caption` (30).

The **stills block**: `backdrop` (#rrggbb), `light` (`soft`, `crisp`, `dramatic`, `sunlit`) with optional `look` overrides, `frameMm` (how wide every frame is at the products, e.g. 320 for tableware, 66 for jewellery), `minFill` (0 to 0.9, default 0), `aim` (0.05 to 0.4, where the camera aims as a share of the frame's height, default 0.22), `focal` (mm, default 85), `width`/`height` (960×1200), `materials` (`id: { ... }`: glazes `{ glaze, rim, pool, clay, satin, speck, speckColor, mottle, seed }`, metals `{ metal "gold"|"gold-satin"|"silver", hallmark }`, stones and pearls as physical material settings), `extra` (wide stills by `name`). Each product's `still` has `items` (shapes `bowl`, `plate`, `cup`, `vase`, `carafe`, `ring`, `hoop`, `stud`, `pendant`, each with its sizes in cm or mm as in the examples, `offset [x, y, z]` in cm, `use` a material, `"@name"` to put a material in a field, `"$key"` to take a value from the option's material), `elevation` (degrees), `turnDeg`, and `turn` `{ pose "flip"|"lay"|"lie", elevation, turnDeg, items }`.

## How it behaves

- **Motion language**: one easing family, cubic-bezier(.2,.7,.2,1) for travel and (.16,1,.3,1) for arrival. Turn over: the reverse crossfades in 380 ms while the photograph creeps 1.5% larger over 700 ms, the corner label drops in 4 px over 300 ms and the caption rolls one line in 360 ms. Swatch: 380 ms crossfade, price and caption swap. Filter and sort: leaving plates fade and settle to 97% in 180 ms where they stood, the rest glide from their old place to their new one in 560 ms (60 ms in), arriving plates rise 12 px from 380 ms, 40 ms apart; the band and the end note move with them. Sheets: scrim 320 ms, sheet 520 ms. Add to bag: the slip unrolls in 500 ms and the bag count rolls up in 420 ms. Nothing loops and nothing moves on its own.
- **Reduced motion**: every change is a swap; filtering re-lays the grid at once.
- **Widths**: 1440 px and up, 4 plates across and every filter in the bar; 1280 to 1439, 4 across, options and sort behind Filter; 901 to 1279, 3 across; 760 to 900, 2 across; under 760 (phone), 2 across with 12 px gutters, chips scrolling sideways under a fade with Filter fixed at the right, captions as mono labels, a round turn button on each photograph (a tap on the photo never guesses), the quick view and the filters as bottom sheets with safe-area padding.
- **Keyboard and screen readers**: plate names are buttons that open the quick view, and focus inside a plate turns it over; swatches and chips are toggle buttons with `aria-pressed`; In stock is a switch; option and choice groups are radio groups; sheets are modal dialogs that trap Tab, close on Escape and give focus back; the slip is a status region; the count is a polite live region.

## Files

- `scripts/build.mjs`: checks page.json and writes `out/index.html`, `out/embed.html` and `out/photos/`.
- `scripts/check.mjs`: works the page at four widths and reduced motion and lists every problem.
- `scripts/record.mjs`: the preview video, single stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `scripts/stills.mjs`: renders true-scale product stills from the `stills` block (skip it with real photographs).
- `scripts/kit/style.css`: the page's style, scoped under `.sck`.
- `scripts/kit/runtime.js`: turning over, swatches, filters with FLIP, the sheets and the recorded tour, inlined into the page.
- `scripts/kit/build.mjs`: the fields, their limits and the cross-field rules (photos, stock words, contrast, no sale fields).
- `scripts/stills/objects.js`: the ceramics and jewellery models, glazes, engraved stamps and hallmarks.
- `scripts/stills/studio.js`: the studio (sweep, softboxes, shadows) and the true-scale camera.
- `vendor/three.min.js`: three.js, bundled; its licence is next to it.
- `examples/wrenfold/page.json` and `examples/sorne/page.json`: the two examples, with their rendered photos.

## Troubleshooting

- **"turn: no photo of the reverse for celadon"**: every option needs its reverse; add `<id>-celadon-turn.webp`, or one `<id>-turn.webp` for all options if the reverse looks the same.
- **"stock.note: low stock says how many"**: write "2 left" or "Sizes 52 and 54 only", not "Selling fast".
- **"this kit has no sale prices, badges or countdowns"**: remove the field. If the price really changed, change `price`.
- **"the plate caption holds 38 on one line"**: shorten `size` (the option name is printed before it).
- **The renderer prints "brought 1.4x closer"**: that piece is small next to the rest; its plate will say "Shown 1.4× larger". Lower `minFill` to keep it at true scale, or lower `frameMm` for the whole collection.
- **Stills render black or very slowly**: Chrome has no GPU here and falls back to software; it still works, 10 to 30 times slower.
- **A still shows a plate mid-glide**: take it inside a `--moments` stretch.
- **Fonts look like Georgia or Arial**: the page couldn't reach Google Fonts; the fallbacks keep the layout.
