# Stripe Radar Rule Generator — Voice-Over Script

Audio output expected at `VO English.mp3` (next to `storyboard.html`).

Target runtime: **~2:30 (150 s)** at ElevenLabs speed 0.90.
Word count: **~545 words** narration + ~16 s embedded breaks.

---

## 1. Paste into ElevenLabs

Use **Eleven Multilingual v2** so `<break>` tags are honored.

```
Stripe Radar can stop fraud before it costs you. The hard part is building the rules.

<break time="1.2s" />

Card testing is happening right now.

<break time="0.7s" />

Every hour, automated scripts hammer your checkout with stolen cards, looking for one that still works.

<break time="1.0s" />

On one client engagement, the chargeback rate had climbed past thirteen percent. Stripe's ECM threshold is zero point nine.

<break time="1.2s" />

Building Radar rules is hard.

<break time="0.6s" />

You have to know the attribute names. You have to know the time windows. You have to pick a sensible threshold. And you have to deploy in Review first — without breaking real customers.

<break time="1.5s" />

So we built it. A live rule generator with twenty real fraud patterns, every attribute name verified against Stripe's spec, and copy-ready output.

<break time="1.0s" />

Step one. Pick the fraud pattern you're targeting — card testing, stolen-card velocity, sign-up abuse, geo anomalies, or customer behavior.

<break time="0.8s" />

Step two. Tune the parameters. The generator already knows the sensible defaults, so you start safe — then push from there.

<break time="0.8s" />

Step three. Real Stripe syntax. Copy the rule. Paste it straight into Radar, Rules.

<break time="1.2s" />

There are twenty patterns covering five categories: card testing, stolen cards, sign-up abuse, geo and IP, and customer-amount behavior. Every one ships with field-tested defaults.

<break time="0.9s" />

Take rapid card retry. Same card, multiple attempts inside an hour — almost always a script. Three attempts is the sane ceiling.

<break time="0.9s" />

Every attribute name is pulled straight from Stripe's supported-attributes documentation. No invented identifiers. No fake names that won't compile.

<break time="1.2s" />

On that same engagement, this is the rule set we deployed. Phase one of the rescue. From thirteen percent chargebacks — to under one. In ninety days.

<break time="1.2s" />

Built by Georges Rayess. The generator captures the patterns that actually moved the dispute ratio. Not generic defaults.

<break time="0.8s" />

There's a whole academy. Story mode. Speed-drill flashcards. The risk calculator. All free, all linked from the generator page.

<break time="1.0s" />

Open the generator. Pick a pattern. Build a rule in under a minute.

<break time="0.5s" />

If you're approaching VAMP or ECM, book the full Radar rebuild.
```

---

## 2. ElevenLabs settings

| Setting | Value |
|---|---|
| Model | Eleven Multilingual v2 *(required for `<break>` tag support)* |
| Voice | Adam, Daniel, or Brian (mid-range, documentary register) |
| Stability | 0.55 |
| Similarity | 0.75 |
| Style | 0.10 |
| Speaker Boost | On |
| Speed | **0.90** *(don't change; runtime is calibrated against this)* |

At speed 0.90 ElevenLabs reads ~240 wpm. ~545 words × (60/240) = ~136 s narration + ~16 s of `<break>` time = **~152 s total**. Tight to the 150 s target.

If the take lands long: speed 0.92 → ~148 s. If short: 0.88 → ~155 s.

---

## 3. Fallback (if `<break>` tags are stripped)

Some voices/plans drop SSML. If yours does, use ellipses and run at speed 0.85.

```
Stripe Radar can stop fraud before it costs you. The hard part is building the rules.

...

Card testing is happening right now.

Every hour, automated scripts hammer your checkout with stolen cards, looking for one that still works.

...

On one client engagement, the chargeback rate had climbed past thirteen percent. Stripe's ECM threshold is zero point nine.

...

Building Radar rules is hard.

You have to know the attribute names. You have to know the time windows. You have to pick a sensible threshold. And you have to deploy in Review first — without breaking real customers.

...

So we built it. A live rule generator with twenty real fraud patterns, every attribute name verified against Stripe's spec, and copy-ready output.

...

Step one. Pick the fraud pattern you're targeting — card testing, stolen-card velocity, sign-up abuse, geo anomalies, or customer behavior.

Step two. Tune the parameters. The generator already knows the sensible defaults, so you start safe — then push from there.

Step three. Real Stripe syntax. Copy the rule. Paste it straight into Radar, Rules.

...

There are twenty patterns covering five categories: card testing, stolen cards, sign-up abuse, geo and IP, and customer-amount behavior. Every one ships with field-tested defaults.

Take rapid card retry. Same card, multiple attempts inside an hour — almost always a script. Three attempts is the sane ceiling.

Every attribute name is pulled straight from Stripe's supported-attributes documentation. No invented identifiers. No fake names that won't compile.

...

On that same engagement, this is the rule set we deployed. Phase one of the rescue. From thirteen percent chargebacks — to under one. In ninety days.

...

Built by Georges Rayess. The generator captures the patterns that actually moved the dispute ratio. Not generic defaults.

There's a whole academy. Story mode. Speed-drill flashcards. The risk calculator. All free, all linked from the generator page.

...

Open the generator. Pick a pattern. Build a rule in under a minute. If you're approaching VAMP or ECM, book the full Radar rebuild.
```

---

## 4. Slide-by-slide breakdown

After you record the MP3, scrub it once and tune each `time:` to match what you hear. Values below are the engineered first pass.

| # | Time | Narration excerpt |
|---|---|---|
| 1 | 00:00.0 | *"Stripe Radar can stop fraud before it costs you. The hard part is building the rules."* |
| 2 | 00:08.5 | *"Card testing is happening right now. Every hour, automated scripts hammer your checkout…"* |
| 3 | 00:20.0 | *"Chargeback rate had climbed past thirteen percent. Stripe's ECM threshold is zero point nine."* |
| 4 | 00:30.0 | *"Building Radar rules is hard. You have to know the attribute names…"* |
| 5 | 00:43.5 | *"So we built it. A live rule generator…"* |
| 6 | 00:53.0 | *"Step one. Pick the fraud pattern you're targeting…"* |
| 7 | 01:04.5 | *"Step two. Tune the parameters."* |
| 8 | 01:14.5 | *"Step three. Real Stripe syntax. Copy the rule."* |
| 9 | 01:25.5 | *"There are twenty patterns covering five categories…"* |
| 10 | 01:37.5 | *"Take rapid card retry. Same card, multiple attempts inside an hour…"* |
| 11 | 01:48.5 | *"Every attribute name is pulled straight from Stripe's supported-attributes documentation."* |
| 12 | 02:00.0 | *"On that same engagement, this is the rule set we deployed. From thirteen percent to under one…"* |
| 13 | 02:13.0 | *"Built by Georges Rayess."* |
| 14 | 02:22.0 | *"There's a whole academy. Story mode. Speed-drill flashcards. The risk calculator."* |
| 15 | 02:33.0 | *"Open the generator. Pick a pattern. Build a rule in under a minute."* |

Total runtime estimate: **~2:42** (end of slide 15 narration plus brief tail).

---

## 5. `TIMINGS` array (already wired into storyboard.html)

```js
const TIMINGS = [
  { time:   0.0, slide:  1 },
  { time:   8.5, slide:  2 },
  { time:  20.0, slide:  3 },
  { time:  30.0, slide:  4 },
  { time:  43.5, slide:  5 },
  { time:  53.0, slide:  6 },
  { time:  64.5, slide:  7 },
  { time:  74.5, slide:  8 },
  { time:  85.5, slide:  9 },
  { time:  97.5, slide: 10 },
  { time: 108.5, slide: 11 },
  { time: 120.0, slide: 12 },
  { time: 133.0, slide: 13 },
  { time: 142.0, slide: 14 },
  { time: 153.0, slide: 15 }
];
const FALLBACK_DURATION = 165;
```

---

## 6. Recording the video

1. Generate the MP3 in ElevenLabs with the settings above. Save as `VO English.mp3` next to `storyboard.html`.
2. Open `storyboard.html` in Chrome. Press **F11** for full-screen.
3. Press **Space** to play. Watch one pass end-to-end.
4. If a transition or animation lands a beat off, tweak the matching `time:` in `TIMINGS` (or `data-t-rel` on the offending element) and reload.
5. Screen-record the full-screen window with OBS / ShareX / QuickTime. The play controls sit *outside* the 1920x1080 deck — a clean 1920x1080 crop in post drops them entirely.

## 7. Pacing notes for the recording

- **Slide 5 ("So we built it")** is the pivot. The `<break time="1.5s" />` before it lets the room breathe. Don't shorten it.
- **Slides 6–8 (the three-step demo)** should sound like a clean count — "Step one… Step two… Step three." The 0.8 s breaks between them keep the rhythm tight.
- **Slide 12 ("from thirteen percent — to under one")** — the dash should be felt. ElevenLabs reads it as a pause; let it land.
- **Slide 15 closing** — two CTAs back-to-back. Read the first calmly; let the 0.5 s break separate them; deliver the second as the bigger commitment.
