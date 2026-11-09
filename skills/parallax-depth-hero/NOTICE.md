# Notices

Parallax Depth Hero is a Lookbk skill. The hero design, the Motion Heroes
kit v2 (build, checks, runtime, recorder), the multiplane shader (the
plates, their outlines and textures, the air, mist, light, defocus and
grain), the per-letter coverage ceiling, the roofs' layout, the still
baking and coverage scripts, the baked still pictures, the examples and
this documentation were written for Lookbk.

No library is used: the page draws with raw WebGL1 and one fragment shader,
run twice a frame; the near plates are copied to a 2D canvas.

Fetched when a built page is opened, not shipped here (pinned versions,
checked with subresource-integrity hashes): the fonts from cdn.jsdelivr.net
(Fontsource packages), each under the SIL Open Font License 1.1 and
copyright its authors. The examples use Instrument Serif, Instrument Sans,
Big Shoulders Display and DM Sans.

Already on your machine, used by the scripts: Chrome, Chromium or Edge
(headless) and ffmpeg (a separate program, under its own licence).

The brands (Harrow & Fell, Kestel Roof), their places, numbers and copy in
`examples/` are made up.
