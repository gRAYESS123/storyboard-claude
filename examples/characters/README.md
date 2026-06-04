# Bring your own character

The cast isn't limited to the built-in styles. There are **two** ways to add your own — both inherit the full acting (blink, gaze, expressions, gestures, lip-sync, speech bubbles).

> The quickest path: **describe your character (or paste a reference image) to `/storyboard`** and let it generate the JSON definition below. That's how the built-in `cutout` (South-Park) style was made.

> **Prefer to do it visually?** Open **[`rigger.html`](rigger.html)** in a browser — drop in your SVG art, **drag the eyes & mouth** onto it, watch it blink / talk / emote live, then copy the generated code (inline HTML *or* a JSON definition). No coordinates by hand. (Also ships with the installed skill as `rigger.html`.)

---

## ① JSON Character Definition (recommended)

A pure-data definition. Safe to share, generate, and load. The engine renders your `parts` and overlays its animated `face`.

```jsonc
{
  "name": "robo",
  "viewBox": [240, 300],            // character coordinate space
  "origin": [120, 250],             // breathe/gesture pivot
  "arms": { "L": [33,150], "R": [207,150] },   // shoulder pivots (for wave/point)
  "params": { "clothing": "$color" },          // tokens + defaults
  "face": {                          // the engine animates these:
    "eyes":   { "L":[92,130], "R":[148,130], "rx":24, "ry":26, "pupil":10, "outline":"#1c1c22" },
    "mouth":  { "x":120, "y":174, "w":17 },
    "brows":  { "y":100, "default":1, "w":6 },  // default:1 = always visible
    "cheeks": { "L":[74,168], "R":[166,168] }
  },
  "parts": [                         // your body art (z-order top→bottom):
    { "shape":"rect", "x":18,"y":150,"w":30,"h":86,"r":15, "fill":"$clothing", "stroke":"#1c1c22","sw":3, "rig":"armL" },
    { "shape":"rect", "x":48,"y":56,"w":144,"h":190,"r":30, "fill":"$clothing","stroke":"#1c1c22","sw":3 }
  ]
}
```

**Shapes:** `rect` (x,y,w,h,r) · `circle` (cx,cy,r) · `ellipse` (cx,cy,rx,ry) · `line` (x1,y1,x2,y2) · `path` (d) · `polygon` (points) · `g` (parts:[…]). Style attrs: `fill`, `stroke`, `sw` (stroke-width), `opacity`, `lc` (round/square), `lj` (round).
**Tokens:** any value starting with `$` resolves from the element's data — `$skin`, `$clothing` (= `data-color`), `$hair`, `$pants`, `$accent`/`$accent2`/`$accent3`/`$gold`, or your own `params` keys (read from `data-<key>`).
**`rig`:** tag a part `armL`/`armR` to make it a rotatable arm. (For a fully custom face, set `"face":{"render":false}` and rig `eyeL`/`eyeR`/`pupilL`/`pupilR`/`mouth`/`open`.)

**Use it:**
```html
<!-- bundle (works offline / file://) -->
<script>window.SB_CHARACTERS = { "robo": { …def… } };</script>
<div data-anim="character" data-char="robo" data-color="#6c7a92" data-talk="1"></div>

<!-- or fetch a file (served decks) -->
<div data-anim="character" data-char="robo" data-char-src="robo.json"></div>

<!-- or at runtime -->
<script>Storyboard.defineCharacter(def)</script>
```

Validate before shipping: `python skill/validate_character.py examples/characters/robo.json`

---

## ② Rig your own SVG

Have an existing SVG mascot? Drop it inside the character element (as a real `<svg>`), tag the moving parts with `data-sbc`, and give a tiny face descriptor in `data-face`:

```html
<div data-anim="character" data-char="custom" data-talk="1"
     data-face='{"eyes":{"L":[96,118],"R":[144,118],"rx":21,"ry":25,"pupil":9},
                 "mouth":{"x":120,"y":164,"w":15},"arms":{"L":[41,168],"R":[199,168]}}'>
  <svg viewBox="0 0 240 270">
    <ellipse cx="120" cy="118" rx="88" ry="82" fill="#19E3B1"/>
    <rect data-sbc="armL" x="28" y="168" width="26" height="72" rx="13" fill="#19E3B1"/>
    <rect data-sbc="armR" x="186" y="168" width="26" height="72" rx="13" fill="#19E3B1"/>
    <g data-sbc="eyeL"><ellipse cx="96" cy="118" rx="21" ry="25" fill="#fff"/><circle data-sbc="pupilL" cx="96" cy="120" r="9"/></g>
    <g data-sbc="eyeR"><ellipse cx="144" cy="118" rx="21" ry="25" fill="#fff"/><circle data-sbc="pupilR" cx="144" cy="120" r="9"/></g>
    <path data-sbc="mouth" d="M105,164 Q120,174 135,164" fill="none" stroke="#10131f" stroke-width="5"/>
    <ellipse data-sbc="open" cx="120" cy="168" rx="13" ry="4" fill="#10131f" opacity="0"/>
  </svg>
</div>
```

**`data-sbc` tags:** `eyeL` `eyeR` (groups) · `pupilL` `pupilR` (inside each eye group, for gaze) · `mouth` (a `<path>` the engine reshapes for expressions) · `open` (an ellipse shown while talking) · `armL` `armR` (rotated for wave/point) · `brL` `brR` `cheekL` `cheekR` (optional). Anything untagged just rides along.

**Notes:** must be a real inner `<svg>` with a `viewBox` (raw shapes in a `<div>` won't parse). `<script>`, event handlers and external refs are stripped — but this path runs your markup, so only use art you trust. The **JSON definition** is the safe, shareable, AI-generatable path.

---

See it live: [`examples/showcase/byo-characters.html`](../showcase/byo-characters.html) / `byo-characters.mp4`. Full attribute reference in [`skill/animations.md`](../../skill/animations.md).
