# Storyboard for Claude Code

**Turn any input — a URL, a brief, a PDF, or an existing HTML page — into a screen-recordable narrated explainer video. With Claude as your animator.**

A skill for [Claude Code](https://claude.com/claude-code) that produces playable, animation-rich HTML decks where an `<audio>` element drives the timeline. Open in a browser, press Space, screen-record, ship.

```
input → /storyboard → concept.md → script.md → storyboard.html → record → video
```

**▶ See the flagship reel:** [`examples/showcase/showcase.mp4`](examples/showcase/showcase.mp4) — a ~90s deck that demos the entire engine (cinematic transitions, charts, code typing, annotations, kinetic type, confetti/badges, a UI demo, and a CTA). Or open [`examples/showcase/showcase.html`](examples/showcase/showcase.html) and press Space.

---

## Why this exists

Most "AI video" tools either compose stock footage or render boring slides. This one treats Claude as the *animator*: it reads your input, drafts a concept, writes ElevenLabs-ready narration, then **choreographs every beat** using a ~95-preset audio-driven animation engine, 17 cinematic scene transitions, and per-word visual hits — all inside a self-contained 1920×1080 HTML file you can screen-record.

The "playable document" pattern is the unlock. Animations sync to your voice-over by **audio clock**, not by counting frames. Scrub the audio and everything redraws. Calibrate by ear, or extract sample-accurate cues from an AAF.

## What you get

- **`/storyboard <input>`** — phase chain (concept → script → build → verify)
- **`/storyboard adopt <html-or-url>`** — wrap your existing HTML for narration without touching its styles
- **`/storyboard generate`** — opt-in ElevenLabs call that renders the MP3 + word timestamps and writes exact `TIMINGS` (no AAF needed)
- **`/storyboard render`** — opt-in headless-Chromium + ffmpeg render to a finished 1920×1080 MP4. No manual screen capture needed.
- **~95 animation presets** driven by the audio clock: spring, anticipate, overshoot, bounce, ken-burns, typewriter, wordReveal/wordSwap, letterSpring, scramble, counter, charts (barGrow/gauge/pieSlice/chartArea), connectorDraw diagrams, syntax-highlighted codeType, hand-drawn annotations (circleScribble/underlineDraw/strikethrough), a synthetic-cursor UI demo (cursorTour/typeInto/clickRipple), a fun pack of **owned vector** dazzle (confettiBurst, fireworks, badgeUnlock, ratingStars, a beating heart, trophy, rocket, thumbs-up — crisp SVG, not OS emoji), cinematic grade (rackFocus/vignette/filmGrain/multiplane), and **real baked-in Lottie** (clock-synced lottie-web with a bundled owned animation set), and more
- **17 cinematic scene transitions** (no scroll): cut, crossDissolve, pushLeft/Right/Up/Down, coverLeft, revealRight, zoomIn/Out, flip3D, spinZoom, whipPan, blurThrough, irisOpen, barWipe, glitch, flash, blocks
- **Composable motion**: `data-stagger` cascades, `data-then` chains, named `data-ease`, physical `data-spring`, ambient `data-loop`, and `data-exit` — choreograph rich sequences from a handful of attributes
- **Calibration tool baked into every deck** — press `T` to enter calibration, tap `M` at each slide change, `A` to apply, `E` to export. Hash-aware auto-save means your tuning persists across reloads but invalidates when you re-extract from a new audio source.
- **Sample-accurate sync** from any DAW via the `aaf_to_timings.py` extractor (Pro Tools, Logic, Reaper, Premiere — anything that exports AAF)
- **Preview before VO exists** — synthetic clock activates when no audio is loaded so you can review the deck during authoring

## See it in action

- **`examples/showcase/`** — two silent demo decks:
  - **The flagship reel** ([`showcase.mp4`](examples/showcase/showcase.mp4)) — fourteen beats in ~90 seconds, each demoing a different power: a per-letter spring title, `wordSwap` phrase hits, one-instruction staggers, 3D card flips, data-viz charts + a gauge that draw on the clock, a flow diagram with auto-arrowheads, syntax-highlighted code typing, hand-drawn annotations, kinetic masked type, a confetti-and-badge payoff, rating stars + floating reactions, and a synthetic-cursor UI demo — each slide on a different cinematic transition.
  - **The capability gallery** ([`capabilities.mp4`](examples/showcase/capabilities.mp4)) — a ~28-section kitchen-sink catalog that demos *every* family the engine has: entrances, physics, 3D, text & kinetic type, easing/spring, staggers & chains, loops, charts, diagrams, motion paths, annotations, code, the camera rig + multiplane, the cinematic grade, living backgrounds, the full fun pack, exits, and all 21 transitions.

  Open either `.html` (the synthetic clock plays it with no audio) or watch the rendered MP4.
- **`examples/stripe-radar/`** — a complete 150-second product pitch: AAF-driven sync, full concept → script → build → render pipeline.

## Install

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/gRAYESS123/storyboard-claude/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/gRAYESS123/storyboard-claude/main/install.ps1 | iex
```

### Manual

```bash
git clone https://github.com/gRAYESS123/storyboard-claude
mkdir -p ~/.claude/skills/storyboard
cp -r storyboard-claude/skill/* ~/.claude/skills/storyboard/
pip install pyaaf2 mutagen elevenlabs   # optional: for AAF parsing + auto-VO
```

The skill registers as `/storyboard` in any project Claude Code session.

## Quick start

In any Claude Code session:

```
/storyboard "Write a 90-second explainer for [your product / topic]"
```

Or with a URL:

```
/storyboard https://yourpage.com/feature
```

Or with a local file:

```
/storyboard ./brief.pdf
```

The skill will:

1. **Concept** — propose a beat list, visual direction, and signature motion
2. **Script** — write ElevenLabs-ready SSML narration + per-beat timing table
3. **Build** — choreograph each beat using the animator decision matrix and write `storyboard.html`
4. *(Optional)* **Generate** — call ElevenLabs to render the MP3 + word timestamps in one step
5. *(Optional)* **Verify** — open in headless Chrome via the preview MCP, scrub each cue, screenshot to `playthrough/`

Then you generate the voice-over (or let the `generate` phase do it), drop the MP3 next to the HTML, and either:

- **Press Space** in Chrome and screen-record manually with OBS / QuickTime / ShareX, **or**
- **Run the render phase**: `python ~/.claude/skills/storyboard/render_video.py path/to/storyboard.html` — headless Chromium plays the deck at 1920×1080, ffmpeg muxes with the source MP3, and a broadcast-quality MP4 appears next to the HTML in under 3 minutes.

## Render to MP4 directly

The `render_video.py` CLI closes the loop end-to-end — no screen-recorder, no manual capture:

```bash
python ~/.claude/skills/storyboard/render_video.py path/to/storyboard.html
# → path/to/storyboard.mp4 (1920×1080 H.264 + AAC, ~3 min for a 2:30 deck)
```

| Flag | Meaning |
|---|---|
| `--out final.mp4` | Custom output path (default: alongside the HTML) |
| `--audio "VO English.mp3"` | Explicit MP3 path (default: first `*.mp3` next to HTML) |
| `--quality high` | crf 18, medium preset (default — archival) |
| `--quality fast` | crf 23, veryfast preset (smaller, web-fine) |

How it works in one line: Playwright launches Chromium headless at 1920×1080, presses Play on the deck, records the viewport for `audio.duration` seconds, then ffmpeg trims the lead-in and muxes with the source MP3 into H.264 yuv420p + AAC 192k MP4 with `+faststart` for streaming.

## Pipeline visualized

```
                       ┌───────────────────┐
   URL / PDF / text    │                   │
   or existing HTML ─► │  Claude Code      │
                       │  /storyboard      │
                       └─────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              concept.md    script.md   storyboard.html
                                 │            │
                                 ▼            │
                    ┌────────────────────┐    │
                    │  ElevenLabs        │◄───┤
                    │  (MCP or CLI)      │    │
                    └─────────┬──────────┘    │
                              │               │
                              ▼               │
                    VO.mp3 + timestamps  ◄────┘
                              │
                              ▼
                         storyboard.html
                              │
                              ▼
                       Chrome → screen rec → video
```

## Architecture

| File | Role |
|---|---|
| `skill/SKILL.md` | Workflow, phase chain, slide recipes, calibration docs |
| `skill/storyboard-engine.js` | **The composable motion engine** — easing registry, spring physics, stagger, chaining, loops, 3D, data-viz, shared-element transitions, camera rig. Single source of truth. |
| `skill/styles.md` | Six signature style systems (kurzgesagt / apple-keynote / documentary / bold-editorial / data-journalism / neon-tech) — each a palette + motion vocabulary + signature + pacing bundle |
| `skill/animator.md` | The judgment layer — decision matrix, 12 principles, composable + data-viz + cinematic recipes, emotional-arc usage, anti-patterns |
| `skill/animations.md` | Technical reference for all presets + the composable attributes (stagger/chain/ease/spring/loop/3D/dataviz/cinematic) |
| `skill/template.html` | 1920×1080 horizontal playable deck (audio-clock engine + calibration + scene transitions + Lottie) |
| `skill/vertical_template.html` | 1080×1920 vertical playable deck for Reels/TikTok/Shorts — same engine, portrait-native slide types |
| `skill/overlay.html` | Adopt-mode injection snippet — adds the same engine to any existing HTML page before `</body>` |
| `skill/concept.template.md` | Scaffolds the concept plan (structured JSON + prose) |
| `skill/script.template.md` | Scaffolds the ElevenLabs-ready script (SSML breaks + timing table) |
| `skill/aaf_to_timings.py` | Pro Tools / Logic / Reaper AAF → sample-accurate TIMINGS |
| `skill/compress_anim_timings.py` | Scale all `data-t-rel` values when in-slide content feels late |
| `skill/elevenlabs_generate.py` | Standalone CLI that calls ElevenLabs and writes MP3 + word timestamps + TIMINGS |
| `skill/render_video.py` | Headless Chromium + ffmpeg → finished MP4 (auto-detects horizontal vs vertical aspect) |
| `skill/audit_deck.py` | Animator self-critique against `animator.md` — pass/warn report with fix hints |
| `skill/render_video.py` | Standalone CLI that headless-plays the deck and writes a finished 1920×1080 H.264 MP4 |

## The animation engine in one minute

Any element with `class="anim"` gets driven by the audio clock:

```html
<h1 class="anim" data-anim="spring" data-t-rel="0.6" data-dur="1.4">
  Hello world
</h1>
```

| Attribute | Meaning |
|---|---|
| `data-anim` | Which preset to run (see `animations.md`) |
| `data-t-rel` | Start time relative to this slide's cue |
| `data-t` | Absolute audio time (alternative to t-rel) |
| `data-dur` | How long the animation runs |

Add `data-transition-in` on a `<section class="slide">` for scene transitions:

```html
<section class="slide" data-slide="5" data-transition-in="whipPan">
```

Calibrate sync at runtime: press **T**, tap **M** at each slide change while listening, press **A** to apply. Saved to localStorage with a content hash so it persists across reloads but auto-invalidates if you re-extract from a new audio source.

## Contributing

PRs welcome for:
- New animation presets
- New scene transitions
- New slide-type CSS recipes
- AAF parser improvements
- Bug fixes (especially cross-browser quirks)

The animator's brain (`animator.md`) is the heart of the project — improvements to the decision matrix and choreography recipes are especially valuable.

## Credits

Built by [Georges Rayess](https://georgesrayess.com). Inspired by the documentary explainer-video lineage of Kurzgesagt, Vox, and old-school *Mythbusters* talking-to-camera. Animator-mode design borrows from the 12 principles of animation (Disney, 1981).

Powered by [Claude Code](https://claude.com/claude-code) and [ElevenLabs](https://elevenlabs.io). Real Lottie playback via [airbnb/lottie-web](https://github.com/airbnb/lottie-web) (MIT), with a bundled set of owned, generated animations.

## License

MIT — see [`LICENSE`](./LICENSE).
