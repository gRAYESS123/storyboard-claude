# Stripe Radar Rule Generator — Concept

```json
{
  "title": "Stripe Radar Rule Generator",
  "audience": "Subscription-app founders and payment-ops leads who are losing money to card-testing fraud and don't have time to learn Radar's attribute system from scratch.",
  "goal": "Convince the viewer that the generator is the fastest way to get production-ready Radar rules — and lead them to try it (or book the full Radar rebuild).",
  "duration_seconds": 150,
  "shape": "problem-frame-solution",
  "tone": "Confident, technical, calm. Stripe-doc energy — not screamy ad energy. The proof speaks; the music doesn't.",
  "voice": {
    "gender": "any",
    "register": "documentary-product-launch — Adam, Daniel, or Brian on ElevenLabs",
    "speed": 0.90
  },
  "visual_direction": {
    "palette": "Inherits the source page: paper #FFFFFF, ink #0F172A, accent orange #C94F2E (deep #A03E20), teal #0A8478, danger #B91C1C, warning #B45309. Code blocks #0F172A bg / #F8F9FB text.",
    "type_treatment": "Inter sans for everything. JetBrains Mono for code blocks, attribute names, and category pills. Big titles 132px, hero subtitles 32px, code 36px.",
    "imagery": "Almost no photography. The deck is a typographic + UI-fragment storyboard — pattern cards, code blocks, fp-pills (low/med/high), an attribute-name reference grid. Mirrors the live tool's visual language so the viewer feels they're already inside it."
  },
  "signature_motion": {
    "ease": "easeOutCubic",
    "emphasis_preset": "spring",
    "transition": "whipPan",
    "accent_color": "#C94F2E",
    "atmospheric_default": "parallax"
  },
  "beats": [
    {
      "n": 1,
      "label": "Hero — Rule Generator",
      "slide_type": "hero",
      "headline": "Stripe Radar / Rule Generator",
      "narration_seed": "Stripe Radar can stop fraud before it costs you. The hard part is building the rules.",
      "key_visual": "Gradient-fill title, JetBrains-Mono eyebrow 'STRIPE RADAR ACADEMY', sub: 'Production-ready rules, real syntax.'",
      "animations": ["typewriter eyebrow", "gradientSweep title", "fadeUp subtitle"],
      "target_seconds": 8
    },
    {
      "n": 2,
      "label": "Card testing right now",
      "slide_type": "cinematic-dark",
      "headline": "Card testing is happening right now.",
      "narration_seed": "Every hour, automated scripts hammer your checkout with stolen cards, looking for ones that still work.",
      "key_visual": "Full-bleed dark slide; faint matrix-style numbers parallaxing behind (SVG particles); big white headline; small sub line.",
      "animations": ["particles bg", "parallax bg", "anticipate headline", "wordReveal body"],
      "transition_in": "dissolve",
      "target_seconds": 11
    },
    {
      "n": 3,
      "label": "13% chargebacks (stat)",
      "slide_type": "stat",
      "headline": "Chargeback rate the day we started: 13%.",
      "narration_seed": "On one client engagement, the chargeback rate had climbed past thirteen percent. Stripe's ECM threshold is zero point nine.",
      "key_visual": "Counter rolls from 0 to 13.0%, in danger red. Below, a small line: 'ECM threshold: 0.9%'.",
      "animations": ["counter (decimals=1)", "fadeUp caption"],
      "transition_in": "flash",
      "target_seconds": 10
    },
    {
      "n": 4,
      "label": "Why building Radar rules is hard",
      "slide_type": "list",
      "headline": "Building Radar rules is hard.",
      "narration_seed": "You have to know the attribute names. You have to know the time windows. You have to pick a sensible threshold. And you have to deploy in Review first — without breaking real customers.",
      "key_visual": "List with JetBrains Mono attribute fragments as decoration: ':card_count_for_ip_address_hourly:', ':total_transactions_per_payment_instrument_fingerprint_hourly:'",
      "animations": ["fadeUp title", "slideInLeft item ×4"],
      "transition_in": "wipe",
      "target_seconds": 12
    },
    {
      "n": 5,
      "label": "The tool reveal",
      "slide_type": "hero",
      "headline": "So we built the generator.",
      "narration_seed": "So we built it. A live rule generator with twenty real fraud patterns, every attribute name verified against Stripe's spec, and copy-ready output.",
      "key_visual": "Centered title in accent orange, sub: '20 patterns. Real attributes. Copy-ready output.'",
      "animations": ["spring title (signature emphasis)", "fadeUp sub"],
      "transition_in": "whipPan",
      "target_seconds": 9
    },
    {
      "n": 6,
      "label": "Demo · Pick the pattern",
      "slide_type": "demo-grid",
      "headline": "Pick a fraud pattern.",
      "narration_seed": "Step one. Pick the fraud pattern you're targeting — card testing, stolen-card velocity, sign-up abuse, geo anomalies, customer behavior.",
      "key_visual": "3x2 grid of mock pattern cards, each with title + FP pill (low/med/high), animated in cascade. Last card highlights with orange accent.",
      "animations": ["fadeUp step-label", "slideInLeft cards staggered ×6", "pulse highlighted card"],
      "target_seconds": 12
    },
    {
      "n": 7,
      "label": "Demo · Tune the parameters",
      "slide_type": "demo-params",
      "headline": "Tune the parameters.",
      "narration_seed": "Step two. Tune the parameters. The generator already knows the sensible defaults, so you start safe — then push from there.",
      "key_visual": "Form fields slide in: 'Max attempts per hour [3]', 'Action [Block]', 'Limit to debit/prepaid [✓]'. Stripe-orange focus rings sweep in.",
      "animations": ["fadeUp title", "slideInLeft each field", "highlight on default values"],
      "target_seconds": 11
    },
    {
      "n": 8,
      "label": "Demo · Copy the rule",
      "slide_type": "demo-code",
      "headline": "Copy the rule. Paste into Radar.",
      "narration_seed": "Step three. Real Stripe syntax. Paste it straight into Radar, Rules.",
      "key_visual": "Big dark code block, mono. The rule types itself across: 'Block if :card_count_for_ip_address_hourly: > 5 and :card_funding: in (\"debit\", \"prepaid\")'.",
      "animations": ["scaleIn code block", "typewriter the rule text", "pulse copy button at end"],
      "transition_in": "flash",
      "target_seconds": 12
    },
    {
      "n": 9,
      "label": "20 patterns, 5 categories",
      "slide_type": "stat-cluster",
      "headline": "Twenty patterns. Five categories.",
      "narration_seed": "There are twenty patterns covering five categories: card testing, stolen cards, sign-up abuse, geo and IP, and customer-amount behavior. Every one shipped with field-tested defaults.",
      "key_visual": "Big '20' counter center, five orange category pills cascade around it.",
      "animations": ["counter on 20", "slideInLeft/Right pills staggered"],
      "target_seconds": 12
    },
    {
      "n": 10,
      "label": "Pattern showcase — rapid retry",
      "slide_type": "pattern-card",
      "headline": "Rapid card retry — per hour.",
      "narration_seed": "Take rapid card retry. Same card, multiple attempts inside an hour — almost always a script. Three attempts is the sane ceiling.",
      "key_visual": "A single pattern card scaled up with the rule visible: 'Block if :total_transactions_per_payment_instrument_fingerprint_hourly: > 3'. FP pill: low.",
      "animations": ["scaleIn card", "pathdraw underline on the rule key terms", "highlight ':total_transactions...:' attribute"],
      "target_seconds": 11
    },
    {
      "n": 11,
      "label": "Real Stripe attributes",
      "slide_type": "attribute-ref",
      "headline": "Real attribute names. Real syntax.",
      "narration_seed": "Every attribute name is pulled straight from Stripe's supported-attributes documentation. No invented identifiers. No fake names that won't compile.",
      "key_visual": "Wall of monospace attribute names cascading top-to-bottom: card_funding, ip_country, customer_lifetime_value, amount_in_usd, etc.",
      "animations": ["wordReveal attribute names cascade", "highlight one in middle"],
      "target_seconds": 11
    },
    {
      "n": 12,
      "label": "13% to under 1% (proof)",
      "slide_type": "proof",
      "headline": "Thirteen percent to under one. Ninety days.",
      "narration_seed": "On that same engagement, this is the rule set we deployed. Phase one of the rescue. From thirteen percent chargebacks to under one — in ninety days.",
      "key_visual": "Big '13% → 0.9%' with arrow morph, slate bg, accent-orange arrow. Bouncing arrival on the target number.",
      "animations": ["counter on 13", "morph/pathdraw arrow", "bounce on 0.9%", "fadeUp caption '90 days'"],
      "transition_in": "flash",
      "target_seconds": 12
    },
    {
      "n": 13,
      "label": "Built by — credibility",
      "slide_type": "twocol",
      "headline": "Built by Georges Rayess.",
      "narration_seed": "Built by Georges Rayess. The generator captures the patterns that actually moved the dispute ratio — not generic defaults.",
      "key_visual": "Left: name + 'Beirut, Lebanon · Subscription growth & payments.' Right: small Stripe-orange badge.",
      "animations": ["fadeUp name", "wordReveal sub", "irisIn badge"],
      "target_seconds": 9
    },
    {
      "n": 14,
      "label": "Beyond the generator",
      "slide_type": "list-cards",
      "headline": "And there's a whole academy around it.",
      "narration_seed": "There's a whole academy. Story mode. Speed-drill flashcards. The risk calculator. All free, all linked from the generator page.",
      "key_visual": "Three small card thumbs: Detect (story), Drill (flashcards), Calculator. Slide in from right.",
      "animations": ["slideInRight each card", "wordReveal sub"],
      "target_seconds": 11
    },
    {
      "n": 15,
      "label": "CTA — try it",
      "slide_type": "cta",
      "headline": "Try the generator.",
      "narration_seed": "Open the generator. Pick a pattern. Build a rule in under a minute. If you're approaching VAMP or ECM, book the full Radar rebuild.",
      "key_visual": "Big 'Try the generator' title in accent orange, sub line with URL, glowing CTA pill 'georgesrayess.com/stripe-radar-rule-library'.",
      "animations": ["spring title", "fadeUp body", "glow CTA pill (looping)"],
      "transition_in": "whipPan",
      "target_seconds": 9
    }
  ],
  "assets_needed": [
    "No external images — fully typographic + UI-fragment deck",
    "Lottie not required",
    "Stripe-page design tokens (already documented above)"
  ],
  "source": {
    "type": "html",
    "ref": "stripe-radar-rule-library.html (georgesrayess.com/stripe-radar-rule-library)"
  }
}
```

---

## Audience & goal

**Who's watching:** Subscription-app founders and payment-ops leads who are losing money to card-testing fraud and don't have time to learn Radar's attribute system from scratch.

**What they should walk away with:** That this generator is the fastest path to a working Radar config — and a clear next step (try the tool, or book the full rebuild).

## Shape

**problem-frame-solution.** Open with the texture of the problem (card testing happening *right now*), name the cost (13% chargebacks), frame the friction (writing Radar rules is hard), reveal the tool, walk the three-step flow, prove with the engagement story, close with two CTAs.

## Visual direction

This deck **inherits the live page's design language**. Same orange (#C94F2E) as the page accent. Same dark slate (#0F172A) for code blocks. Same JetBrains Mono for attribute names. Same fp-pills (low/med/high) in teal/amber/red. By the time the viewer hits the CTA, the page itself will feel like the next slide.

## Signature motion (committed once, reused throughout)

- **Ease**: `easeOutCubic` (engine default).
- **Emphasis preset**: `spring` — used on beat 5 (tool reveal), 15 (CTA), and once more around proof. Three uses = the viewer's brain locks in.
- **Signature transition**: `whipPan` — for the two big pivots (problem → tool, library → CTA).
- **Accent color**: Stripe orange `#C94F2E` for all glows, highlights, rays, focus rings.
- **Atmospheric default**: `parallax` faint code/attribute names behind cinematic beats.

## What happens next

1. **Phase 2 (`script`)** — Expand narration seeds, insert SSML breaks, write TIMINGS.
2. **Phase 3 (`build`)** — Render `storyboard.html` from template + animator-mode choreography.
3. **You** — Generate the VO in ElevenLabs and drop it next to `storyboard.html`.
4. **Optional Phase 4 (`verify`)** — Preview-MCP playthrough.
