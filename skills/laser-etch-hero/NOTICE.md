# Notices

Laser Etch Hero is a Lookbk skill. The hero design, the Motion Heroes kit
v2 (build, checks, runtime, recorder), the engraving model (the height
field, the contour pass, the gantry raster and the galvo hatch paths), the
maple, anodised aluminium and slate materials, the lamp, smoke and sparks,
the baked material stills in `assets/`, the examples and this
documentation were written for Lookbk.

No library is used: the page draws with raw WebGL2 and two fragment
shaders (the material, drawn once per size, and the scene); the masks are
drawn on 2D canvases and uploaded as textures.

Fetched when a built page is opened, not shipped here (pinned versions,
checked with subresource-integrity hashes): the fonts from
cdn.jsdelivr.net (Fontsource packages), each under the SIL Open Font
License 1.1 and copyright its authors. The examples use Fraunces, Space
Grotesk and Inter.

Already on your machine, used by the scripts: Chrome, Chromium or Edge
(headless) and ffmpeg (a separate program, under its own licence).

The brands (Wrenfold, Varde), their products, numbers and copy in
`examples/` are made up.
