# Flagship reel — the full engine in ~90 seconds

`showcase.html` is the hero demo: one neon-tech deck that exercises the entire engine end-to-end. `showcase.mp4` is the rendered output (silent — it's a capability reel, not a narrated explainer).

## What it shows (14 beats)

1. **Hero** — `letterSpring` gradient title with an ambient `float` loop + `scramble` eyebrow
2. **Concept → Script → Reel** — `wordSwap` sequential phrase hits
3. **Capabilities** — `tiltIn` chips cascading via one `data-stagger`
4. **3D cards** — `flipInY` staggered, after a `flip3D` slide transition
5. **Bar chart** — `barGrow` + `counter`, growing in sequence
6. **Gauge + donut** — `gauge` needle + two-segment `pieSlice`
7. **Flow diagram** — nodes + `connectorDraw` with auto-arrowheads
8. **Code typing** — `codeType` with live syntax highlighting
9. **Annotations** — `circleScribble` / `strikethrough` / `underlineDraw` on emphasized words
10. **Kinetic statement** — `lineReveal` lines rising behind a mask
11. **Confetti + badge** — `confettiBurst` + `badgeUnlock` (the payoff)
12. **Rating + reactions** — `ratingStars` + `floatEmojis` ambient
13. **UI demo** — `cursorTour` types into a field and clicks a button (no screen recording)
14. **CTA** — `letterSpring` + glowing `/storyboard` pill + a final confetti burst

Each slide arrives with a different transition (cut, crossDissolve, pushLeft, flip3D, zoomIn, irisOpen, wipe, flash, whipPan, pushUp) — slides animate against each other, never scroll.

## Play it / render it

```bash
# Just open it — synthetic clock plays the whole timeline (a PREVIEW badge shows on screen, hidden in renders)
open showcase.html

# Re-render the silent MP4 (no VO needed) — the new --no-audio path drives the synthetic clock
python ../../skill/render_video.py showcase.html --no-audio --out showcase.mp4
```

## Note on `storyboard-engine.js` here

This folder keeps its own copy of `storyboard-engine.js` (a synced copy of `skill/storyboard-engine.js`) so the deck is self-contained and renders over the headless HTTP server. That mirrors how a real built deck ships — the engine sits beside the HTML. If you change the engine, re-copy it here.
