# Demos — the engine, four ways

This folder ships four silent demo decks (capability reels, not narrated explainers):

| File | What it is |
|---|---|
| **`showcase.html`** / `showcase.mp4` | The **flagship reel** — a tight, 14-beat neon-tech story that sells the whole stack in ~90s. |
| **`capabilities.html`** / `capabilities.mp4` | The **capability gallery** — a ~29-slide kitchen-sink catalog that demos *every* family the engine has, one section at a time, each arriving on a different transition. |
| **`cast-and-sets.html`** / `cast-and-sets.mp4` | The **cast & sets** demo — the actor layer in action: procedural characters that wave, point, talk (lip-sync) and react, staged on device mockups + props, across living environments (night/day/dusk skies, snow, embers). |
| **`cutout-cast.html`** / `cutout-cast.mp4` | The **cutout cast** — a construction-paper / South-Park-style character set (big outlined eyes, stubby bodies, mitten hands) that talks, reacts and waves; one `cutout` style, many looks via skin/hair/clothing. |

Open either in a browser (the synthetic clock plays the timeline with no audio — a PREVIEW badge shows on screen, hidden in renders), or watch the rendered MP4.

---

## `showcase.html` — flagship reel (14 beats)

One neon-tech deck that exercises the entire engine end-to-end.

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

---

## `capabilities.html` — capability gallery (28 sections)

The exhaustive tour. Where the reel *sells*, the gallery *catalogs* — every section announces a family and demos it live:

1. **Title** — `letterSpring` + `aurora` + `filmGrain`, with a `counter` ticking to 101
2. **Entrances** — fadeIn / fadeUp / scaleIn / slideIn / reveal / irisIn
3. **Physics & the 12 principles** — anticipate / overshoot / spring / bounce / wobble / shake / squash / pulse
4. **Perspective & 3D** — flipInX / flipInY / cardFlip / tiltIn / zoomThrough
5. **Text reveals** — typewriter / scramble / wordReveal / tracking / splitReveal / gradientSweep
6. **Kinetic type** — letterSpring / lineReveal / wordSwap / assemble / neonOn / rgbGlitch / textMask
7. **Easing & spring** — a bar race across linear → outBounce, plus a physical `data-spring`
8. **Stagger & chain** — `data-stagger` cascade + a `data-then` sequence
9. **Continuous loops** — float / breathe / sway / orbit / rotate / pulse
10. **Counters** — thousands, prefix, decimals, suffix
11. **Bar chart** — `barGrow` + `counter`
12. **Gauge · donut · arc** — `gauge` / `pieSlice` / `chartArea` / `donutSweep`
13. **Flow diagrams** — `connectorDraw` with auto-arrowheads
14. **Path draw & motion path** — `pathdraw` / `motionPath` / `comparisonBar`
15. **Hand-drawn annotations** — circleScribble / strikethrough / boxDraw / underlineDraw
16. **Syntax-highlighted code typing** — `codeType`
17. **UI demo** — `cursorTour` + `typeInto` + `clickRipple` (no screen recording)
18. **Camera rig + multiplane** — `data-camera` push-in with parallax `data-plane` layers
19. **Cinematic grade** — rackFocus / defocus / vignette / cinematicGrade / filmGrain
20. **Living backgrounds** — aurora / constellation / glow / flicker / rays / particles
21. **Fun pack — celebrations** — confettiBurst / fireworks / partyPopper / burstLines / sparkle / rocketLaunch
22. **Fun pack — rewards & status** — badgeUnlock / trophyShine / ratingStars / starPop / checkDraw / crossDraw / thumbsUp / coinFlip
23. **Fun pack — reactions & loaders** — heartBeat / emojiPop / lightbulb / pulseRings / waveform / spinner / dotsLoader / shimmerSweep
24. **Exit animations** — fadeOut / slideOut× / scaleOut / blurOut (watch them leave)
25. **21 scene transitions** — the full catalog, as chips
26. **Sync & calibration** — the audio-clock model + the in-deck calibration keys
27. **Signature styles & the pipeline** — the 7 looks + concept → script → build → generate → render
28. **Finale** — `letterSpring` + `confettiBurst` + the `/storyboard` CTA

## Play it / render it

```bash
# Just open either deck — the synthetic clock plays the whole timeline
open showcase.html        # or: capabilities.html

# Re-render the silent MP4 (no VO needed) — the --no-audio path drives the synthetic clock
python ../../skill/render_video.py showcase.html      --no-audio --out showcase.mp4
python ../../skill/render_video.py capabilities.html  --no-audio --out capabilities.mp4
```

## Note on `storyboard-engine.js` here

This folder keeps its own copy of `storyboard-engine.js` (a synced copy of `skill/storyboard-engine.js`) so the deck is self-contained and renders over the headless HTTP server. That mirrors how a real built deck ships — the engine sits beside the HTML. If you change the engine, re-copy it here.
