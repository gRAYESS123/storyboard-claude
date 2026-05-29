# Example — Stripe Radar Rule Generator pitch (150s)

A complete, animator-mode build for an explainer video pitching a real Stripe Radar rule-generator tool. Use this as a reference for how a fully-choreographed deck assembles end to end.

## What's in here

| File | Role |
|---|---|
| `concept.md` | The plan — 15 beats, problem-frame-solution shape, signature motion (spring emphasis, whipPan transition, Stripe-orange accent), full visual direction |
| `script.md` | ElevenLabs-ready narration (~545 words) with SSML break tags, per-slide timing breakdown, fallback ellipses block, pacing notes |
| `storyboard.html` | The playable 1920×1080 deck — 16 distinct animation presets used, 5 scene transitions, code-block typewriter, counter on the 13% stat, ken-burns photography, particle layer for atmosphere |

## To play it

This example doesn't ship with a VO MP3 (audio files are excluded from git). You have three options:

### 1. Preview mode (no audio)

Just open `storyboard.html` in Chrome. A small `PREVIEW (no audio)` badge appears top-left. Press **Space** — the synthetic clock plays the entire 153-second timeline so you can see every animation, transition, and slide layout.

### 2. Generate the VO yourself

Copy the SSML block from `script.md` section 1, paste into ElevenLabs (Eleven Multilingual v2, speed 0.90), export as MP3, save as `VO English.mp3` in this directory. Press Space — real audio drives the deck.

### 3. Auto-generate with the bundled CLI

```bash
export ELEVENLABS_API_KEY="..."
python ../../skill/elevenlabs_generate.py script.md . --voice "Adam" --apply storyboard.html
```

Renders the MP3 + word timestamps and rewrites TIMINGS with sample-accurate values in one step.

## What to study

- **The choreography pattern in slide 6 (Pattern Grid)** — five `slideInLeft` cards with 0.5s staggers + one `spring` highlight on the active card. The signature emphasis preset reused.
- **The code typewriter in slide 8 (Demo · Copy)** — a Stripe-syntax rule types itself into a dark code block, then the Copy button flips to "Copied ✓" on a timed condition. Shows how non-preset behavior can be wired into the tick loop.
- **The transition palette** — `cut` (default, 10 slides), `flash` (stat reveals, slides 3/4/8/12), `whipPan` (tool reveal slide 5 + CTA slide 15). 5 non-cut transitions on the most-earned beats.
- **The particle layer in slide 2** — 8 mono code tokens (`:card_funding:`, `> 3`, `Block if`...) parallax-drifting behind a dark cinematic backdrop. Atmospheric layer for the problem statement.

## What it looked like in production

Built end-to-end in a Claude Code session — concept → script → animator-mode build → AAF-driven sync → compress in-slide timings to match narration pacing. The full session transcript is the canonical "how to use this skill" reference.
