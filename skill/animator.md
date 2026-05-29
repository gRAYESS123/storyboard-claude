# The animator brain

This is the doc Claude reads during the `build` phase to *decide* what animation goes where. It's not a CSS reference — `animations.md` is that. This is the **judgment layer**: what makes a beat feel cinematic instead of slidey.

> Read this once before authoring any storyboard. Then re-read the relevant sections per beat as you build.

---

## The job, plainly

You are the animator. You have:
- A `concept.md` with a beat list, slide types, narration seeds, and visual direction.
- A `script.md` with finalized narration and `TIMINGS`.
- A template (`template.html`) with 36 presets and 6 scene transitions.

Your job is to **choreograph** every beat — pick which elements animate, in which order, with which preset, at what time relative to the cue, in service of the narration. Not just "make things appear." Make the picture tell the story.

If a beat feels flat after you've finished it, you haven't done your job. Add a secondary motion, change a transition, hit a word, pull focus. Push until each beat has either a clear focal entrance, an atmospheric layer, OR a sync hit with the narration — ideally all three.

---

## The 12 principles, applied to this engine

| Principle | What it means here | Presets that express it |
|---|---|---|
| **Squash & stretch** | Things deform under force — they're not rigid. | `squash`, `anticipate` (the pull-back is squash) |
| **Anticipation** | A small backward motion before the main action — telegraphs intent. | `anticipate`, `wobble` (as warm-up) |
| **Staging** | Compose the frame so the eye knows where to look. | Use one big `scaleIn` / `spring` per beat; let everything else be smaller. Atmosphere (`particles`, `parallax`) lives in the back. |
| **Straight-ahead vs pose-to-pose** | The engine is pose-to-pose: keyframes (start/end) + easing curves. Use the right ease for the feel. | `easeOutCubic` = clean settle, `easeOutBack` = overshoot, `easeOutElastic` = bouncy, `easeOutBounce` = playful. |
| **Follow-through & overlap** | Different parts settle at different times. | Stagger element `data-t-rel` 0.15–0.30s apart. Use `overshoot` on the main subject, `fadeUp` on secondary. |
| **Slow in / slow out** | Acceleration matters more than position. Linear motion looks mechanical. | All presets default to eased curves. Override with `data-ease` only if you need linear (rare — e.g. a `counter` for a stopwatch). |
| **Arcs** | Natural motion follows curves, not straight lines. | `motionPath` along an SVG arc; `kenburns` with non-zero `dx` and `dy`; avoid pure vertical/horizontal where an arc fits. |
| **Secondary action** | A small motion that supports the main one without competing. | `parallax` background; `particles`; `glow` on a CTA; a `wobble` on a character while the camera pans. |
| **Timing** | Length of motion = weight of moment. | Big = 1.4–2.0s. Medium = 0.8–1.2s. Accent = 0.3–0.5s. **Match duration to the narration phrase length.** |
| **Exaggeration** | Push a little past natural for clarity. | `bounce` and `spring` already exaggerate. `overshoot` lets you exaggerate any entrance. Don't be timid. |
| **Solid drawing** | Things should feel weighted, not floaty. | Pair every reveal with motion (`fadeUp` not `fadeIn`). Things drop or arrive; they rarely just appear. |
| **Appeal** | Make individual moments delightful. | One signature motion per project — pick a preset (e.g. `spring`) and a color (e.g. accent-hot) and reuse it for emphasis throughout. Coherence reads as quality. |

---

## Decision matrix — what to use when

Read your concept's beat list. For each beat, find the closest row.

| Beat purpose | First-choice presets | Notes |
|---|---|---|
| **Open / hook** | `gradientSweep` on title + `typewriter` eyebrow + `fadeUp` subtitle | The reader is colder than you think. Give them ~0.5s of stillness before motion starts. |
| **State a problem** | `kenburns` photo + `vignette` overlay + `wordReveal` on the punchline + `flicker` accent if dark/urgent | Photography sells weight. Vignette focuses the eye. |
| **Reveal a single fact** | `scaleIn` headline + `counter` for any number + `pulse` on the unit | Hold the number on screen for ≥1.5s after it settles. |
| **Walk through a list** | `slideInLeft` on each item, staggered 0.7–0.9s | Don't cascade all at once — the rhythm of arrival is the point. |
| **Show a process / sequence** | `pathdraw` to lay the path + `motionPath` for a marker traveling it + `scaleIn` on each waypoint | Build the diagram in narration order. |
| **Comparison / contrast** | Two `revealUp` from opposite sides + `crossfade` between background images | Symmetry signals "two things, equal weight." |
| **Pivot point (problem → solution)** | Scene transition `whipPan` or `dissolve` + big `spring` entrance on the new headline | This is the moment that earns its own transition. Don't waste it. |
| **Build atmosphere / emotion** | `particles` + `parallax` background + `glow` on a focal element + slow `kenburns` (dur 14+) | Quiet, layered. Foreground stays still; depth moves. |
| **Aha / surprise / data spike** | `bounce` or `confetti` or `rays` on the focal element + `flash` transition | Cheap, but earned. Use once per video, max. |
| **CTA / close** | `spring` title + `wordReveal` body + `glow` (looping) CTA pill + `pulse` on hit | The glow loop reads as "alive" while the user reads the body. |
| **Quote / pull-quote** | `splitReveal` or `irisIn` on the quote + `fadeIn` attribution after a beat of silence | Silence is itself an animation choice. |

---

## Choreography recipes — proven multi-element sequences

Each recipe is "one beat" — a coherent pattern for ~5–12 seconds of screen time. Copy the structure, swap content.

### Recipe: **Spotlight focus**
A single subject arrives center-stage while everything else stays out of focus.

```
t-rel  preset          element
0.0    focusBlur       background image (full bleed)
0.3    fadeIn          subtle vignette overlay
0.8    scaleIn         subject headline (large)
1.6    wordReveal      supporting line (small)
```

Use when: the beat is about *one specific thing* and the rest is context.

### Recipe: **Cascading reveal**
Items arrive in narration order, each landing on a beat.

```
t-rel  preset          element
0.2    fadeUp          section title
1.3    slideInLeft     item 1
2.2    slideInLeft     item 2
3.1    slideInLeft     item 3
4.0    slideInLeft     item 4
```

The 0.9s stagger matches a deliberate narration pace. Tighten to 0.6s for an upbeat read.

### Recipe: **Parallax pull**
Depth that suggests a camera moving through space.

```
t-rel  preset          element
0.0    parallax        back layer (dur 10, range 80)
0.2    fadeUp          mid layer (image card)
0.6    parallax        foreground particles (dur 10, range -40)
1.4    scaleIn         text on top
```

Front and back drift opposite directions — that's the depth cue.

### Recipe: **Wipe-and-stamp**
A scene transition cuts to a hard-edged result.

```
transition-in="wipe"
t-rel  preset          element
0.0    fadeIn          background (already there post-transition)
0.4    bounce          big number or headline
1.0    fadeUp          caption
1.8    pulse           sub-element accent
```

The wipe + bounce combo is decisive. Good for stats that punch.

### Recipe: **Beat-sync emphasis**
Sync visual hits to specific words in the narration (see *Word-sync* below).

```
0.0    wordReveal      whole sentence
@word1 shake           the noun
@word2 highlight       the adjective
@word3 pulse           the verb
```

Use when narration has a rhythmic structure or list of single-word emphases.

### Recipe: **The breath**
Hold. The most under-used animation in explainer videos is *nothing happening*.

```
t-rel  preset          element
0.0    kenburns        background (dur whole beat)
1.0    fadeIn          a single line of text
(no other motion until next beat)
```

Use after a heavy beat (problem statement, big reveal) to let the viewer absorb.

### Recipe: **Diagram unfolds**
Build a chart or diagram piece by piece as the narrator names each part.

```
t-rel  preset          element
0.2    fadeUp          axis lines (revealUp)
0.8    pathdraw        primary curve / arrow
2.4    motionPath      marker traveling the curve
3.2    scaleIn         labels (one at a time, staggered)
```

Always reveal containers before contents.

### Recipe: **Celebration**
For the very last slide, or a single mid-deck "yes!" moment.

```
t-rel  preset          element
0.0    confetti        burst layer (SVG with .c children)
0.0    flash           transition-in (already played)
0.3    spring          headline
1.0    glow            CTA (loop on)
```

Don't use this more than once per video.

---

## Scene transitions — when to use which

The default is `cut` (no transition). Override per slide with `data-transition-in="..."`.

| Transition | Feel | Use when |
|---|---|---|
| `cut` | Instant | Most slides. The default. Same energy as previous beat. |
| `dissolve` | Soft, smooth | Mood / tonal shift. Moving from one quiet scene to another. |
| `whipPan` | Fast, kinetic | Energy spike. The narration just turned a corner. |
| `wipe` | Decisive | A list item / chapter break. "Now: thing two." |
| `flash` | Punchy | Surprise. Revelation. The data finally landing. |
| `blocks` | Editorial | Chapter title / section card. Reads as "new section." |

Rule of thumb: **at most 3 non-cut transitions per video.** Otherwise they stop meaning anything. Save them for the pivots that earn them.

---

## Word-sync workflow (the secret weapon)

The user already has per-word timestamps from ElevenLabs in their srotyboard project (`Script with time stamps.json`). If a similar file exists for the current project, use it.

The format from ElevenLabs:

```json
{
  "alignment": {
    "characters": ["D", "i", "s", ...],
    "character_start_times_seconds": [0.0, 0.05, ...],
    "character_end_times_seconds": [...]
  }
}
```

Or word-level:

```json
{
  "words": [
    { "text": "Discrimination", "start": 0.0, "end": 0.72 },
    { "text": "happens",        "start": 0.78, "end": 1.10 },
    ...
  ]
}
```

### How to use it

1. **For `wordReveal` text** — set `data-t-rel` to the first word's start time minus the slide cue. The preset's stagger naturally lands later words near their spoken times.

2. **For specific word hits** — pick narration words that *deserve* a visual punch (verbs, surprising nouns, the number in a stat). Add them to the `WORD_HITS` array:

   ```js
   const WORD_HITS = [
     { time: 12.34, sel: '#bigNoun',       hit: 'shake' },
     { time: 18.71, sel: '.stat-number',   hit: 'pulse' },
     { time: 24.50, sel: '.cta-pill',      hit: 'highlight' }
   ];
   ```

   The engine flashes the matching preset for 0.6s at that exact audio time. Don't overdo it — 3–5 hits per minute, max.

3. **For lip-sync-style emphasis** — wrap every word in a span at build time and toggle a class per word. This is heavier; only worth it for a character-anchored beat or a comedic accent.

---

## Signature motion — the coherence trick

Pick *one* of each at the start of the project. Reuse them. Don't introduce new ones unless a beat genuinely needs it.

- **One signature ease**: pick a single curve and use it for 80% of your animations. The other 20% can be `bounce` / `spring` / `elastic` for emphasis.
- **One signature transition**: e.g., `wipe` for every section break.
- **One accent color** for highlights, glows, and confetti.
- **One signature preset for "emphasis"**: e.g., always `spring` on the big-deal headline, never `bounce`. The viewer will start to anticipate it — that's the signal.
- **One signature timing rhythm**: e.g., always 0.8s between cascading list items. The brain locks in.

Coherence reads as taste. Variety reads as chaos.

---

## Anti-patterns — things that look bad

- **All elements `fadeUp` with stagger** — feels like a default-Powerpoint deck. Vary the preset.
- **Every slide has a transition** — transitions stop meaning anything. Most slides should `cut`.
- **No atmospheric layer on a long beat** — 10+ seconds with no background motion looks frozen. Always add `kenburns` or `parallax` or `particles` to beats > 8 seconds.
- **Counter animation longer than 2.5s** — past that it feels like a load bar. Cap at 2s.
- **Three exclamation animations in a row** (`bounce`, then `shake`, then `confetti`) — diminishing returns. Pick one per beat.
- **The last anim finishes after the slide changes** — the viewer never sees the payoff. Audit: `cue_next - cue_current - max(t_rel + dur)` should be ≥ 0.5s.
- **Typewriter on long text** — character-by-character past ~60 chars is slow and annoying. Use `wordReveal` for sentences.
- **Glow + pulse + shake on the same element** — pick one.

---

## How Claude should reason about a single beat

Pseudo-process for authoring each beat (do this in your head, fast):

1. **What is this beat doing in the arc?** (Hook / problem / fact / list / pivot / atmosphere / close — pick one from the decision matrix.)
2. **What's the focal element?** (Headline, number, image, list?)
3. **What's the secondary layer?** (Atmosphere — bg motion, particles, vignette.)
4. **What gets the entrance preset?** (Match the matrix recommendation. Pick from the 1–2 candidates, prefer signature motion.)
5. **What stays still?** (Most things. The eye needs a rest point.)
6. **Is there a word in the narration that should be hit?** (If yes, add to `WORD_HITS`. If no, move on.)
7. **What transition into this beat?** (Default `cut`. Upgrade only if the beat is a pivot, chapter, or surprise.)
8. **Do the math.** Last anim's `t_rel + dur` must finish ≥ 0.5s before the next cue. Adjust.

If the beat takes more than 60 seconds to choreograph, you're overdoing it. Most beats are 3–5 anims total.

---

## When you have an existing HTML (adopt mode)

If the user passed an existing HTML deck to wrap, your job is different — you don't author from scratch, you *enhance*. The detection layer finds the slides; the overlay adds the audio + controls + animation engine. You then:

1. **Walk every slide once.** For each, decide which existing element gets `class="anim"` plus a preset. Add `data-anim="..."` and `data-t-rel="..."` inline.
2. **Don't add new elements** unless the slide is genuinely thin (a single headline). Then add atmospheric SVG layers as siblings.
3. **Pick `data-transition-in` per slide** based on the slide's role in the arc.
4. **Respect the existing visual language.** If the deck uses one accent color, your `glow`/`highlight`/`rays` should match it (not the template's default `#3CA8E8`).

---

## The acid test

Before declaring a build done, ask yourself:

- If I muted the audio and watched, would I know what each beat is about?
- If I deleted the visuals and only listened, would the narration still hit?
- Are there at least three beats where the visual is doing *more* than what the narration says?
- Did I use my signature motion at least three times?
- Did I leave at least one beat with no entrance animations at all (the breath)?

If "no" to any: keep going.
