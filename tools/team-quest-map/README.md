# Team Quest painted world

The Team Quest map's land is a painting, not drawn shapes. It was generated once
(October 2026) with an image model through OpenRouter, and then baked into the
WebP files in `assets/team-quest-map/painted/` by `bake_painted.py`. The app
only loads those files. No key or model is needed at run time.

## Sources (not committed)

Six 2752 × 1536 PNGs, all painted on a flat magenta (`#FF00FF`) sky so it can be
keyed out, and all exactly aligned with each other:

| File | How it was made |
| --- | --- |
| `day-autumn.png` | Base painting (model: `google/gemini-3-pro-image`, 2K, 16:9), from a road layout guide and a style reference, then two edit passes for the road (see below) |
| `night-autumn.png` | The autumn painting relit at night (only the lights are used) |
| `day-winter.png`, `day-spring.png`, `day-summer.png` | The autumn painting with only the season changed |
| `props.png` | Clouds, the wax seal and the ribbon on a green screen (`google/gemini-3.1-flash-image`) |

To rebake: `python3 tools/team-quest-map/bake_painted.py <folder with the six PNGs>`
(needs numpy, pillow and opencv-python-headless). It prints the islet boxes and
water glints that `features/questWorld/worldArt.mjs` uses. Bump `ART_VERSION`
there when the pictures change.

If the land is repainted, the road must be traced again: `ROUTE_POINTS`,
`REALM_BREAKS`, `REALM_PLACES`, `REALM_LANDMARKS` and `PORTAL` in
`features/questWorld/worldGeometry.mjs`, and `STAIR_STEPS`, `CHIMNEYS` and the
glints in `worldArt.mjs`. The tests in `tests/quest-world-*.test.mjs` check
that the road climbs the painted stair and passes in front of the citadel.

## Prompts

**Base (autumn day).** Input 1: the old map blurred, with the road drawn on it as a cream line. Input 2: an earlier render, used as a style reference.

> Image 1 is a LAYOUT GUIDE, image 2 is a STYLE REFERENCE. Paint a full-bleed fantasy world map for a kids' classroom adventure game in exactly the rendering style of image 2 (highly detailed hand-crafted 3D miniature world, physically based materials, global illumination, warm volumetric sunlight, ambient occlusion, rich tactile textures, tilt-shift depth, high three-quarter bird's-eye view), but with the exact LAYOUT of image 1. THE ROAD: the cream line in image 1 is the only road. Paint it as ONE single continuous light sandy cobblestone road that follows exactly that line … [then the places in order: the meadow village, the wooden bridge, the mountain flank, the white fortress gate on the col, the stone bridge by the waterfall, the golden citadel and its fountain square, the glowing floating stair, and the amethyst island with the portal ring] … Autumn: green grass, trees in orange, red, gold and green. Colourful, joyful, magical, cinematic. Full bleed … No text, no letters, no people, no UI, no frame. The sky must be a perfectly flat solid magenta (#FF00FF), no clouds, no sun, no gradient, no glow.

**Road edits.** The road was marked with cyan strokes for "build here" and red strokes for "remove". The first pass edited the whole picture; the second edited a 1:1 crop that was then pasted back with a feathered edge.

> Edit this picture, keeping its exact framing, composition, style and lighting. 1) The RED stroke covers a stretch of road that must disappear … 2) Each CYAN stroke marks a new road to build: paint a sandy cobblestone road with stone kerbs, soft shadows and a few small lamp posts, exactly along each cyan stroke … 3) Change nothing else … keep the sky a perfectly flat solid magenta (#FF00FF). No text.

**Night.**

> Turn this exact picture into the same scene at night. Keep every element exactly in the same place … only the lighting changes. Moonlit night … Every window … glows warm orange-yellow, the small lamp posts along the road are lit … the glowing stair and the portal shine brighter with cyan and violet magical light, the crystals glow from inside … Keep the sky a perfectly flat solid magenta (#FF00FF) …

**Seasons** (one call each):

> Turn this exact picture into the same scene in WINTER / SPRING / high SUMMER. Keep every element exactly in the same place, same shapes, same composition, same daylight and the same 3D style, and keep the sky a perfectly flat solid magenta (#FF00FF) with no clouds or gradient. No text. Only the season changes: [snow and frozen edges / blossom and fresh green / deep green, golden wheat, small snowcap] … the cobblestone road still clearly visible.

**Props.**

> A sprite sheet of separate game art props on a perfectly flat, solid, pure green (#00FF00) chroma-key background, in the style of a high-end 3D-rendered fantasy RPG … TOP ROW: four different big fluffy white cumulus clouds … BOTTOM ROW, left: a round red sealing-wax seal seen from straight above … stamped with a raised golden five-pointed star … middle: a long horizontal crimson silk ribbon band with golden embroidered edges …

## What the bake makes

- `land-<season>-1600.webp` and `-2560.webp`: the land with the sky cut out. The map loads the 2560 picture only on big or sharp screens, and never in lite mode.
- `islet-<season>-0/1.webp`: the two small floating islets, lifted out of the land so they can bob.
- `lights-1600.webp`: the night glow (windows, lamps, the stair, the Portal), added over any season after dusk.
- `sketch-1280.webp`: the ink sketch shown while the scroll unrolls.
- `cloud-0..3.webp`, `seal.webp`, `ribbon.webp`: the sky clouds and realm mists, plus the scroll's seal and ribbon.
