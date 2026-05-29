# {{TITLE}} — Concept

This document is the **plan** before any narration is written. It defines what the video is, who it's for, and what shape it takes. A later `script` phase reads this file. A `build` phase reads both.

The JSON block at the top is the machine-readable spec — keep it in sync with the prose below. When `/storyboard script` or `/storyboard build` runs, it parses this block.

```json
{
  "title": "{{TITLE}}",
  "audience": "{{AUDIENCE}}",
  "goal": "{{GOAL}}",
  "duration_seconds": {{DURATION_SECONDS}},
  "shape": "{{SHAPE}}",
  "tone": "{{TONE}}",
  "voice": {
    "gender": "{{VOICE_GENDER}}",
    "register": "{{VOICE_REGISTER}}",
    "speed": 0.90
  },
  "visual_direction": {
    "palette": "{{PALETTE}}",
    "type_treatment": "{{TYPE_TREATMENT}}",
    "imagery": "{{IMAGERY}}"
  },
  "beats": [
    {
      "n": 1,
      "label": "{{BEAT_1_LABEL}}",
      "slide_type": "hero",
      "headline": "{{BEAT_1_HEADLINE}}",
      "narration_seed": "{{BEAT_1_NARRATION}}",
      "key_visual": "{{BEAT_1_VISUAL}}",
      "animations": ["typewriter eyebrow", "scaleIn title"],
      "target_seconds": 6
    },
    {
      "n": 2,
      "label": "{{BEAT_2_LABEL}}",
      "slide_type": "cinematic",
      "headline": "{{BEAT_2_HEADLINE}}",
      "narration_seed": "{{BEAT_2_NARRATION}}",
      "key_visual": "{{BEAT_2_VISUAL}}",
      "animations": ["kenburns bg", "slideInLeft headline"],
      "target_seconds": 12
    }
  ],
  "assets_needed": [
    "{{ASSET_1}}",
    "{{ASSET_2}}"
  ],
  "source": {
    "type": "{{SOURCE_TYPE}}",
    "ref": "{{SOURCE_REF}}"
  }
}
```

---

## Audience & goal

**Who's watching:** {{AUDIENCE}}

**What they should walk away with:** {{GOAL}}

## Shape

The video uses the **{{SHAPE}}** shape:

> {{SHAPE_DESCRIPTION}}

Shapes the skill knows about:

| Shape | When to use |
|---|---|
| `problem-frame-solution` | Explainer videos. State a problem, name it, present a structured response. (Reference: srotyboard.) |
| `hook-examples-synthesis` | Persuasion. Open with a hook, give 3 concrete examples, land on the point. |
| `question-answer-evidence` | Thought-leadership. Pose a surprising question, give a contrarian answer, back it up. |
| `walkthrough-steps` | Demos. Each beat is a step; the last is the result. |
| `before-after` | Case studies. Pre-state, intervention, post-state. |
| `narrative-arc` | Brand stories. Setup, conflict, resolution. |

## Beats

The video is **{{BEAT_COUNT}} beats** over **{{DURATION}}**. Each beat is one slide, one idea.

| # | Label | Slide type | Headline | Narration seed | Visual | Time |
|---|---|---|---|---|---|---|
{{BEATS_TABLE}}

## Visual direction

- **Palette:** {{PALETTE_DESCRIPTION}}
- **Type:** {{TYPE_DESCRIPTION}}
- **Imagery:** {{IMAGERY_DESCRIPTION}}

## Assets that need to exist before `build`

{{ASSETS_LIST}}

## Source material

{{SOURCE_DESCRIPTION}}

---

## What happens next

1. **`/storyboard script`** reads this file, expands each `narration_seed` into spoken narration, inserts SSML breaks, and writes `script.md`. Estimated word budget per beat is `target_seconds * 4`.
2. **`/storyboard build`** reads `concept.md` + `script.md` and produces `storyboard.html` from the template, with beats mapped to slide types and animations applied.
3. **You** generate the voice-over in ElevenLabs (export as MP3) and drop it next to the HTML.
4. **`/storyboard verify`** (optional) opens the HTML in the preview MCP, scrubs to each cue, screenshots, and reports any mismatches.
