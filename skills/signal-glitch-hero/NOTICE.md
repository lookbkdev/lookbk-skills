# Notices

Signal Glitch Hero is a Lookbk skill. The hero design, the Motion Heroes kit
v2 (build, checks, runtime, recorder), the signal model (the cable's
vertical hold, horizontal sync and colour burst locks; the stream's motion
vectors, residuals, intra refresh, burst error and fade), its shader, the
title-safe grade, the photo resize and encode step, the still picture, the
examples and this documentation were written for Lookbk.

No library is used: the page draws with raw WebGL1 and one fragment
shader; the programme frame is drawn on a 2D canvas and uploaded as a
texture.

The example photographs were made for Lookbk and are original scenes with
no people, brands or marks taken from elsewhere:

- `examples/late-reel/late-reel.jpg`: a woman in a red coat at a tram stop
  under a sodium streetlamp at night. Generated with Google's Gemini 3 Pro
  Image model (`gemini-3-pro-image-preview`) from a text prompt written for
  Lookbk; she is not a real person.
- `examples/halde/halde.jpg`: ivory headphones on a travertine block with a
  red cable, in hard window light. Generated the same way; the headphones
  are not a real product.

They are there to show the hero. Use your own photograph for your site.

Fetched when a built page is opened, not shipped here (pinned versions,
checked with subresource-integrity hashes): the fonts from
cdn.jsdelivr.net (Fontsource packages), each under the SIL Open Font
License 1.1 and copyright its authors. The examples use Big Shoulders
Display, Instrument Sans, Instrument Serif, Inter and IBM Plex Mono.

Already on your machine, used by the scripts: Chrome, Chromium or Edge
(headless) and ffmpeg (a separate program, under its own licence; it
resizes the photo at build time and encodes the video).

The brands (Late Reel, Halde Audio), their products, numbers and copy in
`examples/` are made up.
