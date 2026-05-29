# Example — Engine Showcase (v0.3 capabilities reel)

A 10-beat demo that exercises **every** new capability of the composable engine in one deck. This is the best single reference for what the v0.3 engine can do.

## What each slide demonstrates

| # | Slide | Capability shown |
|---|---|---|
| 1 | Hero | `letterSpring` (per-letter, gradient-aware, `<br>`-aware) + `scramble` eyebrow + `float` ambient loop |
| 2 | Stagger | `data-stagger` cascading a whole chip row with `tiltIn` (3D) from one container instruction |
| 3 | 3D flips | `flipInY` staggered across a card grid |
| 4 | Bar chart | `barGrow` data-viz bars growing on the clock + `counter` value labels |
| 5 | Donut | `donutSweep` radial progress + gradient `counter` |
| 6 | Shared element | a card marked `data-shared-id` |
| 7 | Shared lands | the same card morphs (FLIP) into a new position across the cut |
| 8 | Camera rig | `.camera data-camera` push-in + pan + pull-back over a map |
| 9 | Chain + loop | `scaleIn` → `data-then="pulse"` → `data-loop="breathe"` (+ `beat`-sync when audio present) |
| 10 | CTA | `letterSpring` gradient hero + `spring` pill with a `breathe` loop |

## Play it

No VO ships with the repo (audio is git-ignored). Three ways to see it:

1. **Preview (no audio):** open `showcase.html` in Chrome. The synthetic clock plays the full ~82s timeline — press **Space**. A `PREVIEW (no audio)` badge appears.
2. **Add a VO:** drop `VO Showcase.mp3` next to `showcase.html` (write your own narration to the beats, or use the `generate` phase) and press Space.
3. **Render to MP4:** `python ../../skill/render_video.py showcase.html` (needs the MP3, or use the no-audio render path).

## How it's wired

```html
<script src="../../skill/storyboard-engine.js"></script>
<script>
  const TIMINGS = [ {time:0,slide:1}, ... ];   // const so the timing tools can rewrite it
  const SLIDE_LABELS = [ ... ];
  Storyboard.init({ timings: TIMINGS, labels: SLIDE_LABELS, fallbackDuration: 82 });
</script>
```

That's the whole integration. Everything else is `class="anim"` + `data-*` attributes on the markup. Study the source — it's the fastest way to learn the composable API.

## Frames

The `frame_*.png` files are static captures from a headless render at representative cue times — a quick visual index of the capabilities without playing the deck.
