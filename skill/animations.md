# Animation reference

The engine in `template.html` (and the `overlay.html` injection used by adopt mode) drives any element with `class="anim"` from the audio clock. Per-preset signatures below.

> For **judgment** — what to use when, choreography recipes, anti-patterns — read `animator.md`. This file is just the technical reference.

## How an animation is declared

```html
<h2 class="anim"
    data-anim="presetName"
    data-t-rel="2.3"
    data-dur="1.4">
  Some text
</h2>
```

| Attribute | Required | Meaning |
|---|---|---|
| `class="anim"` | yes | Opts the element into the engine. Default state is `opacity: 0`. |
| `data-anim` | yes | Preset name. |
| `data-t-rel` | one of | Start time **relative to this slide's cue time**, in seconds. |
| `data-t` | one of | Absolute audio time. |
| `data-dur` | no | Duration in seconds. Defaults to preset's natural duration. |
| Preset-specific | varies | See per-preset docs. |

Engine guarantees:

| Phase | Element state |
|---|---|
| `time < t` | `opacity: 0` |
| `t <= time <= t + dur` | preset `apply(el, p)` runs each frame; `p` is eased internally |
| `time > t + dur` | preset called once with `p = 1`; element gets class `anim-played` |

Animations work while audio is **paused** — listeners on `timeupdate`/`seeked` redraw. Scrubbing the audio (or `STORYBOARD.seek(t)`) renders correctly. This is what makes the preview-MCP verification possible.

---

# Preset catalog (36)

Organized by category. For each, the signature is `data-anim="name"` + listed attributes.

## Basics

### `fadeIn` `(dur 0.8)`
Opacity 0 → 1. The quietest entrance.

### `fadeOut` `(dur 0.8)`
Opacity 1 → 0. Use for elements that should leave the frame mid-beat.

### `fadeUp` `(dur 1.0)`
Translate up 40px + fade. The workhorse default.

### `fadeDown` `(dur 1.0)`
Translate down 40px + fade. Use for elements arriving from above (callouts, banners).

### `slideInLeft` / `slideInRight` `(dur 1.0)`
Translate from -120 / +120 + fade. Cascading list items, side cards.

### `scaleIn` `(dur 1.0)`
0.85 → 1.0 scale + fade. Hero titles, big CTAs.

### `crossfade` `(dur 1.2)`
Plain opacity 0 → 1, or 1 → 0 with `data-out="1"`. Use to fade one image out as another fades in (overlapping `t-rel`).

## Physics & 12 principles

### `anticipate` `(dur 1.2)`
Element pulls back 8px, then launches forward 100px with overshoot. Anticipation principle made explicit. Use on big subjects entering decisively.

### `overshoot` `(dur 1.0)`
Translate up + ease-back (passes target, returns). Lighter than `anticipate`. Use for any entrance that needs a little snap.

### `spring` `(dur 1.2)`
Scale 0.7 → 1.0 with elastic-out curve. Bouncy, organic. The big "this is the moment" preset.

### `bounce` `(dur 1.2)`
Drops from -120px above with `easeOutBounce`. Playful, weighted. Use on data spikes, stat numbers, surprises.

### `wobble` `(dur 0.9)`
Brief rotational oscillation (4° max), damps to 0. Use for character-like accents or "is it alive?" cues.

### `shake` `(dur 0.5)`
Quick horizontal shake (12px max), damps to 0. Use as a word-hit on impact narration ("shock," "broken," "wrong").

### `squash` `(dur 0.6)`
X-stretch + Y-compress, then return. The 12-principle squash. Use sparingly — on logos, mascots, or whenever something "lands."

### `pulse` `(dur 0.9)`
Gentle 8% scale beat back to 1.0. Mid-narration attention pull (CTAs, focus elements).

## Text

### `typewriter` `(dur 1.5)`
Character-by-character reveal. Best for ≤60 chars. Beyond that, use `wordReveal`.

### `wordReveal` `(dur 1.8)`
Word-by-word reveal — replaces text with `<span class="wr-w">` per word, fades each in sequence. The right choice for syncing text to spoken narration.

### `tracking` `(dur 1.2)`
Letter-spacing animates from 0.2em → 0em + fade. Designer-y, calm. Good for subtitle text.

### `gradientSweep` `(dur 2.0)`
Background-position animates across a gradient text fill. Element must have `class="gradient-fill"` (which sets the gradient + clip). Use on hero titles for an animated chrome look.

```html
<h1 class="s-title gradient-fill anim" data-anim="gradientSweep" data-t-rel="0" data-dur="2.0">Title</h1>
```

### `splitReveal` `(dur 1.2)`
Two halves part vertically via clip-path. Good reveal for hero panels.

## Numbers

### `counter` `(dur 1.8)`
0 → `data-to`, eased. Honors `data-decimals` and `data-suffix`.

```html
<span class="anim" data-anim="counter" data-to="3142" data-suffix="+">0</span>
<span class="anim" data-anim="counter" data-to="98.6" data-decimals="1" data-suffix="%">0</span>
```

## Camera & framing

### `kenburns` `(dur 10)`
Background photo slowly zooms and drifts. Use on `.scene-bg` for cinematic slides. Defaults: `zoom=0.1`, `dx=2`, `dy=-2`. Make `dur` longer than the slide is on screen so it never abruptly stops.

| Attr | Default | Meaning |
|---|---|---|
| `data-zoom` | 0.1 | Extra scale factor |
| `data-dx` | 2 | Horizontal drift % |
| `data-dy` | -2 | Vertical drift % |

### `cameraZoom` `(dur 2.5)`
Wraps a `.camera` div. Zooms toward a focal point. Use for "push in" moments — narration drilling into a detail.

| Attr | Default | Meaning |
|---|---|---|
| `data-scale` | 1.5 | Target scale |
| `data-ox` | 50 | Origin X % |
| `data-oy` | 50 | Origin Y % |

```html
<div class="camera anim" data-anim="cameraZoom" data-t-rel="2.0" data-dur="3.0"
     data-scale="1.8" data-ox="30" data-oy="40">
  <!-- slide content here -->
</div>
```

### `cameraPan` `(dur 3.0)`
Translates content laterally. Like a camera dolly.

| Attr | Default | Meaning |
|---|---|---|
| `data-dx` | 0 | Total horizontal px |
| `data-dy` | 0 | Total vertical px |

### `focusBlur` `(dur 1.4)`
Element starts blurred (14px), un-blurs while fading in. Classic focus-pull. Pairs beautifully with a still background and a sharp foreground subject.

### `parallax` `(dur 8)`
Slow vertical drift over a long window. For background decorative layers. `data-range` (default 40) = total px.

## Decoration & atmosphere

### `glow` `(dur 1.6)`
Pulsing accent-colored halo via `box-shadow`. Loops naturally — set `dur` long for "alive" elements.

### `flicker` `(dur 1.0)`
Neon-style on/off flicker (6 cycles). Use on a single word/element for tension or rough-tech feel.

### `highlight` `(dur 0.8)`
Yellow marker sweeps under inline text via background-image. Element should be `display: inline` or `inline-block`.

```html
<p>Not all <span class="anim" data-anim="highlight" data-t-rel="2.0">stigma</span> looks the same.</p>
```

### `particles` `(dur 8)`
Drifts child elements with `class="p"` (expects pre-laid-out SVG circles). Use on `.particle-layer` SVGs for ambient depth.

```html
<svg class="particle-layer">
  <circle class="anim p" data-anim="particles" data-t-rel="0" data-dur="14" cx="200" cy="900" r="4"/>
  <circle class="anim p" data-anim="particles" data-t-rel="0" data-dur="14" cx="400" cy="950" r="3"/>
  <!-- 10-20 more -->
</svg>
```

Each particle gets a deterministic seed based on its index, so the pattern is reproducible.

### `confetti` `(dur 1.5)`
Burst layer — child elements with `class="c"` explode outward from center. Use for "celebration" moments. Don't reuse — one per video max.

```html
<svg class="confetti-layer">
  <rect class="anim c" data-anim="confetti" data-t-rel="0" data-dur="1.5" x="-6" y="-6" width="12" height="12" fill="#E8762C"/>
  <rect class="anim c" data-anim="confetti" data-t-rel="0" data-dur="1.5" x="-6" y="-6" width="12" height="12" fill="#3CA8E8"/>
  <!-- 16-24 more, alternating fills -->
</svg>
```

### `rays` `(dur 1.4)`
Radiating lines scale outward + rotate, peaks then fades. Good behind a stat number.

## Reveal & mask

### `reveal` `(dur 1.2)`
Clip-path sweep left → right.

### `revealUp` `(dur 1.2)`
Clip-path sweep bottom → top.

### `irisIn` `(dur 1.4)`
Circular clip-path opens from center. Iconic film transition; use sparingly.

## SVG / vector

### `pathdraw` `(dur 2.0)`
Animates `stroke-dashoffset` on any SVG geometry with `getTotalLength()` (path, line, polyline, circle). The path appears to draw itself.

```html
<path class="anim" data-anim="pathdraw" data-t-rel="1.0" data-dur="2.4"
      d="M 100 380 Q 600 60, 1100 380" fill="none" stroke="#3CA8E8" stroke-width="4"/>
```

### `morph` `(dur 1.4)`
Interpolates between two `d` values. **Both `d`s must have identical SVG command structure** (same letters in same order) — this is a coordinate lerp, not topology-aware morphing. For arbitrary morph, use Flubber externally and feed frames.

```html
<path class="anim" data-anim="morph" data-t-rel="0" data-dur="1.4"
      data-from="M 10 10 L 90 10 L 50 90 Z"
      data-to=  "M 10 50 L 90 10 L 90 90 Z"
      d="M 10 10 L 90 10 L 50 90 Z"
      fill="#3CA8E8"/>
```

### `motionPath` `(dur 2.0)`
Element follows another element's path coordinates. Set `data-path="#someSvgPath"`. Works with `<circle>`/`<ellipse>` (sets cx/cy) or any other element (uses transform).

```html
<svg viewBox="0 0 1200 500">
  <path id="route" d="M 100 380 Q 600 60, 1100 380" fill="none"/>
  <circle class="anim" data-anim="motionPath" data-t-rel="0" data-dur="2.5"
          data-path="#route" r="14" fill="#3CA8E8"/>
</svg>
```

## External (Lottie)

### `lottie` `(dur — required)`
Loads a Lottie JSON via lottie-web (lazy-loaded from CDN — needs internet at render time). Scrubs the animation in sync with the audio clock instead of autoplaying.

```html
<div class="lottie-stage anim" data-anim="lottie"
     data-src="animation.json"
     data-t-rel="0" data-dur="4.0"></div>
```

| Attr | Required | Meaning |
|---|---|---|
| `data-src` | yes | Path to the Lottie JSON (relative or absolute URL) |
| `data-dur` | yes | How long the Lottie should take to play through (real seconds) |

Use for character animation, complex motion graphics, or anything that's easier to author in After Effects + Bodymovin than to hand-code.

---

# Scene transitions

Set `data-transition-in="..."` on a `<section class="slide">` to play a transition when the audio cue reaches that slide.

| Value | Effect | When to use |
|---|---|---|
| `cut` (default) | None | Most slides. Same energy as previous beat. |
| `dissolve` | Black fade in/out 0.55s | Mood / tonal shift. |
| `flash` | White fade in/out 0.55s | Revelation, data landing, "aha." |
| `whipPan` | Horizontal motion-blur sweep 0.55s | Energy spike, kinetic pivot. |
| `wipe` | Accent-colored bar sweep across | Chapter / list-item break. |
| `blocks` | Editorial accent-block flash | Section title cards. |

Rule of thumb: ≤3 non-cut transitions per video. Save them for the moments that earn them.

---

# Combining presets

A single element gets one preset. To stack effects, nest:

```html
<!-- Outer ken-burns photo, inner spring headline, particles in front -->
<div class="scene-bg anim" data-anim="kenburns" data-t-rel="0" data-dur="14"
     style="background-image:url('bg.jpg');"></div>

<svg class="particle-layer" style="position:absolute;inset:0">
  <circle class="anim p" data-anim="particles" data-t-rel="0" data-dur="14" cx="400" cy="900" r="3"/>
  <!-- ... -->
</svg>

<h1 class="anim" data-anim="spring" data-t-rel="1.0" data-dur="1.4">Headline</h1>
```

---

# Word hits (per-word emphasis)

`WORD_HITS` is a global array. The engine flashes a preset on a CSS selector for 0.6s at the specified audio time. Use it to land emphasis on specific narration words.

```js
const WORD_HITS = [
  { time: 12.34, sel: '#bigNoun',     hit: 'shake' },
  { time: 18.71, sel: '.stat-number', hit: 'pulse' },
  { time: 24.50, sel: '.cta-pill',    hit: 'highlight' }
];
```

Pull the times from ElevenLabs word-timestamp JSON. See `animator.md § Word-sync workflow`.

---

# Custom presets

Add to `PRESETS` in `template.html` (and `overlay.html` if adopt mode):

```js
PRESETS.myThing = {
  dur: 1.0,
  apply(el, p) {
    // p is 0..1, ease internally
    el.style.opacity = p;
    el.style.transform = `rotate(${p * 360}deg)`;
  }
};
```

Then use `<div class="anim" data-anim="myThing">...</div>`.

---

# Debugging

- **Element never appears** → check `class="anim"`, valid `data-anim`, and that `data-t-rel` doesn't resolve past the audio's end.
- **Wrong slide is on screen** → check the slide's `data-slide="N"` matches the `TIMINGS` entry.
- **Lottie doesn't render** → check internet access (CDN). Console: `lottie is not defined` means the script didn't load.
- **`pathdraw` doesn't draw** → element must support `getTotalLength()`. Usually means it's not an SVG geometry node.
- **`morph` jumps instead of morphs** → the two `d` values have different command structures. Restructure them so they match command-for-command.
- **`counter` ends at the wrong number** → `data-to` parsed as float. Use `data-decimals` for floats.
- **An anim is cut off mid-motion at the slide change** → `t_rel + dur` extends past the next slide's cue. Tighten `dur` or shift `t_rel` earlier.

---

# Composable motion (v0.3 engine)

The v0.3 engine (`storyboard-engine.js`) makes animations *composable* instead of one-preset-per-element. These attributes layer on top of any `data-anim`:

## `data-ease` — override the curve

Any element can override its preset's internal easing with a named curve:

```html
<h1 class="anim" data-anim="fadeUp" data-ease="outBack">Pops past, settles</h1>
```

Named eases: `linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, outQuart, outQuint, outExpo, inOutExpo, outBack, inBack, outElastic, outBounce` plus aliases `smooth` (inOutCubic), `snap` (outQuint), `pop` (outBack).

## `data-spring` — real spring physics

Replace the ease with a tuned damped-spring solver: `data-spring="stiffness,damping"`.

```html
<div class="anim" data-anim="scaleIn" data-spring="200,12">Springy</div>
<div class="anim" data-anim="scaleIn" data-spring="120,18">Gentle, premium</div>
```

Stiffness ~80–400 (higher = snappier), damping ~8–30 (lower = more bounce). Underdamped springs overshoot before settling — that's the point.

## `data-stagger` — cascade a container's children with one instruction

Put `class="anim-group"` + `data-stagger` on a container. Every child becomes an `.anim` with start times offset by the stagger interval. No more hand-numbering each item.

```html
<ul class="anim-group" data-anim="slideInLeft" data-stagger="0.12" data-t-rel="1.0" data-dur="0.7">
  <li>First</li><li>Second</li><li>Third</li><li>Fourth</li>
</ul>
```

Optional `data-ease` on the group applies to every child.

## `data-then` — chain sequences on one element

Run animations *after* the entrance. `@` sets an absolute delay (relative to the entrance start); otherwise steps run back-to-back after the previous finishes.

```html
<!-- enter with scaleIn, then pulse 1.6s after entrance start, then keep floating -->
<h2 class="anim" data-anim="scaleIn" data-then="pulse@1.6">Enter, then react</h2>
```

## `data-loop` — continuous ambient motion

Keeps an element alive *forever* after its entrance settles. The loop runs off the audio clock so it's deterministic for rendering.

```html
<h1 class="anim" data-anim="letterSpring" data-loop="float" data-loop-amp="10" data-loop-period="4">Alive</h1>
```

| Loop | Effect | amp means | typical period |
|---|---|---|---|
| `float` | vertical bob | px | 3–5s |
| `sway` | gentle rotate | deg | 3–6s |
| `breathe` | scale pulse | % | 3–4s |
| `rotate` | continuous spin | (ignored) | 6–20s |
| `orbit` | circular drift | px radius | 4–8s |
| `pulse` | scale beat | % | 1.5–3s |
| `shimmer` | background-position sweep | (ignored) | 2–4s |
| `beat` | scale reacts to music amplitude | % at full volume | (auto) |

`data-loop="beat"` requires audio (uses a WebAudio AnalyserNode on the VO/music track). Falls back to inert under the synthetic preview clock.

## 3D presets

| Preset | Effect |
|---|---|
| `flipInX` | rotateX -90°→0 (flips up from flat) |
| `flipInY` | rotateY 90°→0 (swings in from the side) |
| `cardFlip` | rotateY 180°→0 (full card flip) |
| `tiltIn` | rotateX + rotateZ + rise (3D card lands) |
| `zoomThrough` | translateZ -600px→0 (flies toward camera) |

Combine with `data-stagger` on a `.cards` grid for a flipping card deck.

## New text presets

| Preset | Effect |
|---|---|
| `letterSpring` | each letter springs up in sequence (gradient-fill aware, `<br>` aware) |
| `scramble` | decode/glitch effect — random glyphs resolve to the real text |

**Gradient titles**: `letterSpring` carries a `.gradient-fill` gradient onto each letter automatically. `typewriter` and `scramble` work with `.gradient-fill` directly (they don't wrap in child spans). For `wordReveal` on a gradient title, keep the gradient OFF (it wraps words in spans) — use `gradientSweep` for an animated gradient headline instead.

---

# Data-viz presets (v0.3)

Charts that draw and grow on the audio clock as the narrator cites them.

## `barGrow` — bar / column

Scales a bar from 0 to full along one axis. Default grows vertical (`scaleY` from the bottom); set `data-dir="h"` for horizontal (`scaleX` from the left).

```html
<div class="bar anim" data-anim="barGrow" data-t-rel="1.0" data-dur="1.2" data-ease="outBack" style="height:61%"></div>
```

Pair each bar with a `counter` for the value label. Stagger a row of bars by giving each a slightly later `data-t-rel` (0.2–0.3s apart) so they grow in sequence.

## `donutSweep` / `ringFill` — radial progress

Animates `stroke-dashoffset` on an SVG `<circle>` to draw an arc to `data-pct` percent. Rotate the SVG `-90deg` so it starts at 12 o'clock.

```html
<svg class="donut" viewBox="0 0 400 400" style="transform:rotate(-90deg)">
  <circle class="track" cx="200" cy="200" r="160" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="38"/>
  <circle class="arc anim" data-anim="donutSweep" data-t-rel="0.6" data-dur="1.8" data-pct="73"
          cx="200" cy="200" r="160" fill="none" stroke="var(--accent)" stroke-width="38" stroke-linecap="round"/>
</svg>
```

## `lineDraw` — line / area chart

Alias of `pathdraw` for chart lines. Build the line as an SVG `<path>`, it draws itself left-to-right.

## `comparisonBar` — animated width bar

Grows an element's CSS `width` to `data-width` percent. Good for "us vs them" horizontal comparisons.

```html
<div class="cmp anim" data-anim="comparisonBar" data-t-rel="0.8" data-width="84"></div>
```

---

# Cinematic layer (v0.3)

## Shared-element transitions

Give an element `data-shared-id="x"` on two consecutive slides. When the deck cuts from the first to the second, the element animates (FLIP) from its old position/size to its new one — a card that becomes the next slide's hero, no duplicate markup.

```html
<!-- slide 6 -->
<div class="hero-card" data-shared-id="hero" style="...big, centered...">...</div>
<!-- slide 7 -->
<div class="hero-card" data-shared-id="hero" style="...small, top-left...">...</div>
```

## Camera rig

Wrap a slide's content in `<div class="camera" data-camera="...">`. Keyframe `time=>scale:N,x:N,y:N` segments (times relative to the slide cue). The engine interpolates with `inOutCubic` between keyframes — dolly, pan, push-in.

```html
<div class="camera" data-camera="0=>scale:1; 2.5=>scale:1.8,x:-260,y:-120; 5.5=>scale:1">
  <div class="map">...pins...</div>
</div>
```

## Beat-sync

`data-loop="beat"` on any element scales it in time with the music's low-frequency amplitude (WebAudio AnalyserNode). Use on a logo, a pulse ring, or a CTA when there's a music bed.

---

# Engine API

```js
Storyboard.init({ timings, labels, wordHits, fallbackDuration });
Storyboard.play(); Storyboard.pause(); Storyboard.reset();
Storyboard.seek(seconds);          // jump + redraw (used by render/verify)
Storyboard.currentSlide();         // 1-based
Storyboard.isSynthetic();          // true when previewing without audio
Storyboard.registerPreset(name, { dur, apply(el,p,ctx){} });  // add your own
Storyboard.registerEase(name, fn);
Storyboard.calib.clearSaved();     // wipe stored calibration
```

Decks declare `const TIMINGS = [...]` then pass it to `init` so the Python tooling (audit/aaf/elevenlabs/compress) can read and rewrite it.
