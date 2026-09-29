# Companion redesign proposals

Generated with the built-in imagegen tool from the nine user-supplied references. These are design/animation-frame proposals, not production-ready registered sprite sheets. Existing website sprites and code are not replaced.

## Prompt specification

Create an original redesigned pixel-art website companion inspired by each reference. Four equal cells in a 2×2 sheet, transparent background, consistent identity/scale/camera/baseline, generous gutters, limited palette, clean chunky pixels, no labels/grid/blur/scenery/shadows.

Frame order is top-left, top-right, bottom-left, bottom-right:

- kitsune: white/crimson fox; one upper tail idle, blink, happy fanned tails, recovery.
- duck: butter-yellow duck holding a small silver knife; idle, blink, happy without knife, happy wing wave without knife.
- catbox: cream/cocoa cat in peach box; idle, empty box, pop, closed-eye happy. Keep box identical.
- book: violet/gold spellbook; open, closing, closed, opening around fixed spine.
- codercat: cream kitten at desktop; idle, left paw typing, right paw typing, eyes-closed resting. Keep desk and monitor identical.
- spider: lavender/plum eight-legged spider; idle, alternate leg group A, group B, tucked front legs happy.
- raven: midnight-blue/violet raven; idle, blink, fluffed/head tilt, closed-eye bowed head.
- dragon: ice-blue baby dragon with two visible eyes and two wings; idle, both eyes blinking, happy wings spread, recovery.
- ghost: white ghost kitten; idle, semi-transparent body with opaque eyes, closed-eye happy, reappearance.

## Review before integration

Generation does not ensure exact pixel registration or consistent anatomy. Kitsune tail count and body scale drift between frames; book perspective shifts; coder-cat has unwanted glow; ghost phase alpha needs validation. Align/rebuild frames and review silhouettes before connecting them to the existing state controller. These images are not rigged meshes: control comes from registered frames or separately prepared layers plus JS states.

## Files

- `kitsune-sheet.png`: 1254×1254, RGBA, alpha (0, 255)
- `duck-sheet.png`: 1243×1266, RGBA, alpha (0, 255)
- `catbox-sheet.png`: 1264×1244, RGBA, alpha (0, 255)
- `book-sheet.png`: 1222×1287, RGBA, alpha (0, 255)
- `codercat-sheet.png`: 1536×1024, RGBA, alpha (0, 254)
- `spider-sheet.png`: 1246×1262, RGBA, alpha (0, 255)
- `raven-sheet.png`: 1254×1254, RGBA, alpha (0, 255)
- `dragon-sheet.png`: 1254×1254, RGBA, alpha (0, 255)
- `ghost-sheet.png`: 1342×1172, RGBA, alpha (0, 255)
