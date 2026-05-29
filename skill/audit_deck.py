#!/usr/bin/env python
"""
audit_deck.py
Programmatic acid-test against animator.md. Reads a storyboard.html, runs
static checks on the choreography, prints a report (and optionally writes
audit.md) with findings + auto-fix suggestions.

Checks:
  [diversity]       At least 6 distinct preset names used.
  [signature]       Most-used emphasis preset (spring/bounce/anticipate/
                    overshoot) is used >= 3 times across the deck.
  [transitions]     Non-cut transitions <= 3 (animator.md rule of thumb).
  [atmosphere]      Beats > 8s have an atmospheric layer
                    (parallax / kenburns / particles / glow).
  [overshoot]       No animation finishes AFTER the next slide's cue
                    (data-t-rel + data-dur <= next_cue - this_cue - 0.5s).
  [counter-dur]     No counter has data-dur > 2.5s (reads as a load bar).
  [stacking]        No element has glow + pulse + shake on it (over-emphasis).
  [breath]          At least one beat has minimal entrance animation
                    (the "let it breathe" beat).

Usage:
  python audit_deck.py storyboard.html
  python audit_deck.py storyboard.html --write          # writes audit.md too
  python audit_deck.py storyboard.html --json           # machine-readable

Exit code 0 if no warnings; 1 if any warnings.
"""
import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field, asdict
from pathlib import Path


EMPHASIS_PRESETS = {'spring', 'bounce', 'anticipate', 'overshoot', 'scaleIn'}
ATMOSPHERE_PRESETS = {'parallax', 'kenburns', 'particles', 'glow', 'flicker'}
NON_CUT_TRANSITIONS = {'dissolve', 'whipPan', 'wipe', 'flash', 'blocks'}


@dataclass
class Finding:
    severity: str            # 'pass' | 'warn' | 'info'
    check: str
    summary: str
    detail: str = ''
    fix_hint: str = ''


@dataclass
class AuditReport:
    findings: list = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    def add(self, f: Finding):
        self.findings.append(f)

    def warnings(self):
        return [f for f in self.findings if f.severity == 'warn']

    def passes(self):
        return [f for f in self.findings if f.severity == 'pass']


def extract_timings(text):
    """Return list of (slide_n, time_s) parsed from the TIMINGS array."""
    m = re.search(r'const TIMINGS\s*=\s*\[(.*?)\];', text, re.DOTALL)
    if not m:
        return []
    body = m.group(1)
    entries = re.findall(r'\{\s*time\s*:\s*([\d.]+)\s*,\s*slide\s*:\s*(\d+)\s*\}', body)
    return sorted([(int(s), float(t)) for t, s in entries], key=lambda x: x[0])


def extract_animations(text):
    """
    Return list of dicts:
      { 'preset', 't_rel', 'dur', 'slide', 'classes', 'all_attrs_raw' }
    Slide number is inferred by finding the nearest preceding
    `data-slide="N"` attribute.
    """
    # Build a map of slide cuts (positions in text) so we can attribute each
    # .anim element to its enclosing slide.
    slide_positions = []
    for m in re.finditer(r'data-slide="(\d+)"', text):
        slide_positions.append((m.start(), int(m.group(1))))

    def slide_for(pos):
        # Find the most recent data-slide preceding this pos
        n = 0
        for p, num in slide_positions:
            if p < pos:
                n = num
            else:
                break
        return n

    anims = []
    # Match elements containing data-anim. Use a tolerant regex over the
    # opening tag to capture all attributes.
    tag_pattern = re.compile(r'<[^>]+?data-anim="([a-zA-Z]+)"[^>]*?>', re.DOTALL)
    for m in tag_pattern.finditer(text):
        tag = m.group(0)
        preset = m.group(1)
        t_rel = None
        t_abs = None
        dur = None
        cls = ''
        m2 = re.search(r'data-t-rel="([\d.]+)"', tag)
        if m2: t_rel = float(m2.group(1))
        m2 = re.search(r'data-t="([\d.]+)"', tag)
        if m2: t_abs = float(m2.group(1))
        m2 = re.search(r'data-dur="([\d.]+)"', tag)
        if m2: dur = float(m2.group(1))
        m2 = re.search(r'class="([^"]*)"', tag)
        if m2: cls = m2.group(1)
        anims.append({
            'preset': preset,
            't_rel': t_rel,
            't_abs': t_abs,
            'dur': dur,
            'slide': slide_for(m.start()),
            'classes': cls,
            'tag_pos': m.start(),
        })
    return anims


def extract_transitions(text):
    """Return list of (slide_n, transition_name)."""
    out = []
    for m in re.finditer(r'data-slide="(\d+)"[^>]*?data-transition-in="([a-zA-Z]+)"', text):
        out.append((int(m.group(1)), m.group(2)))
    return out


def check_diversity(report, anims):
    presets = [a['preset'] for a in anims]
    distinct = set(presets)
    report.stats['preset_counts'] = dict(Counter(presets).most_common())
    report.stats['preset_distinct'] = len(distinct)
    if len(distinct) >= 6:
        report.add(Finding('pass', 'diversity',
                           f'Preset diversity: {len(distinct)} distinct.'))
    else:
        report.add(Finding('warn', 'diversity',
                           f'Only {len(distinct)} distinct presets used (target: &gt;= 6).',
                           detail=f"Used: {sorted(distinct)}",
                           fix_hint='Vary the presets per slide. The current set leans on a small subset -- consider sprinkling in spring, anticipate, gradientSweep, focusBlur, wordReveal, or pathdraw on the right beats.'))


def check_signature(report, anims):
    presets = [a['preset'] for a in anims]
    emphasis_in_use = [p for p in presets if p in EMPHASIS_PRESETS]
    if not emphasis_in_use:
        report.add(Finding('warn', 'signature',
                           'No emphasis preset (spring/bounce/anticipate/overshoot/scaleIn) used.',
                           fix_hint='Pick one emphasis preset and use it on your most important moments -- the tool reveal, the proof, the CTA. Reusing one builds a signature; viewers learn to anticipate it.'))
        return
    top_emphasis, count = Counter(emphasis_in_use).most_common(1)[0]
    report.stats['signature_preset'] = top_emphasis
    report.stats['signature_uses'] = count
    if count >= 3:
        report.add(Finding('pass', 'signature',
                           f'Signature motion `{top_emphasis}` locks in (used {count} times).'))
    else:
        report.add(Finding('warn', 'signature',
                           f'Signature motion `{top_emphasis}` used only {count} time(s); target: &gt;= 3.',
                           fix_hint=f'Reuse `{top_emphasis}` on at least 3 beats so the viewer\'s brain recognises it as the project\'s emphasis cue.'))


def check_transitions(report, transitions):
    non_cut = [(s, t) for s, t in transitions if t in NON_CUT_TRANSITIONS]
    report.stats['transitions'] = {
        'total': len(transitions),
        'non_cut': len(non_cut),
        'breakdown': dict(Counter(t for _, t in transitions)),
    }
    if len(non_cut) <= 3:
        report.add(Finding('pass', 'transitions',
                           f'{len(non_cut)} non-cut transitions -- within the rule of thumb.'))
    else:
        cues = ', '.join(f'slide {s} ({t})' for s, t in non_cut)
        report.add(Finding('warn', 'transitions',
                           f'{len(non_cut)} non-cut transitions (target: &lt;= 3). Excess can desensitise the viewer.',
                           detail=f'Transitions in use: {cues}',
                           fix_hint='Keep transitions on the 3 most-earned beats: typically the problem->solution pivot, a proof stat, and the CTA. Demote the others to `cut`.'))


def check_atmosphere(report, anims, timings):
    if len(timings) < 2:
        return
    # For each slide, compute its duration on screen
    durations = {}
    for i, (slide, t) in enumerate(timings):
        next_t = timings[i+1][1] if i + 1 < len(timings) else t + 60
        durations[slide] = next_t - t

    # For each slide, which atmospheric presets are present?
    atmosphere_by_slide = {}
    for a in anims:
        if a['preset'] in ATMOSPHERE_PRESETS:
            atmosphere_by_slide.setdefault(a['slide'], set()).add(a['preset'])

    missing = []
    for slide, dur in durations.items():
        if dur > 8 and not atmosphere_by_slide.get(slide):
            missing.append((slide, dur))
    report.stats['long_beats_total'] = sum(1 for d in durations.values() if d > 8)
    report.stats['long_beats_atmospheric'] = report.stats['long_beats_total'] - len(missing)

    if not missing:
        report.add(Finding('pass', 'atmosphere',
                           'Every beat > 8s has an atmospheric layer.'))
    else:
        rows = ', '.join(f'slide {s} ({d:.1f}s)' for s, d in missing)
        report.add(Finding('warn', 'atmosphere',
                           f'{len(missing)} long beat(s) (> 8s) without atmospheric motion.',
                           detail=f'Beats: {rows}',
                           fix_hint='Add a parallax, kenburns, particles, or glow layer to back-fill the frame during long static beats. Without it the deck reads as "frozen" between actions.'))


def check_overshoot(report, anims, timings):
    if len(timings) < 2:
        return
    cue_for = {s: t for s, t in timings}
    next_cue = {}
    for i, (s, t) in enumerate(timings):
        next_cue[s] = timings[i+1][1] if i + 1 < len(timings) else None

    # Atmospheric / decorative presets are EXPECTED to span multiple beats
    # (e.g. particles dur 14 across a problem-statement section).
    LONG_RUNNING = ATMOSPHERE_PRESETS | {'lottie', 'cameraZoom', 'cameraPan'}

    overshoots = []
    for a in anims:
        if a['preset'] in LONG_RUNNING:
            continue
        if a['slide'] not in cue_for or a['t_rel'] is None or a['dur'] is None:
            continue
        nxt = next_cue.get(a['slide'])
        if nxt is None:
            continue
        slide_t = cue_for[a['slide']]
        finishes_at = slide_t + a['t_rel'] + a['dur']
        if finishes_at > nxt - 0.3:
            overshoots.append((a['slide'], a['preset'], a['t_rel'], a['dur'], finishes_at, nxt))

    report.stats['overshoots'] = len(overshoots)
    if not overshoots:
        report.add(Finding('pass', 'overshoot',
                           'All animations finish before the next slide cue.'))
    else:
        sample = overshoots[:3]
        rows = '; '.join(f'slide {s}/{p} ends @{fin:.2f}s, cue @{nxt:.2f}s' for s, p, _, _, fin, nxt in sample)
        report.add(Finding('warn', 'overshoot',
                           f'{len(overshoots)} animation(s) finish at or after the next slide cue.',
                           detail=f'e.g. {rows}',
                           fix_hint='Tighten data-t-rel earlier or shorten data-dur. Use compress_anim_timings.py to scale all t-rel values at once.'))


def check_counter_durations(report, anims):
    bad = [a for a in anims if a['preset'] == 'counter' and a['dur'] is not None and a['dur'] > 2.5]
    if not bad:
        report.add(Finding('pass', 'counter-dur', 'All counter durations &lt;= 2.5s.'))
    else:
        rows = ', '.join(f'slide {a["slide"]} ({a["dur"]:.1f}s)' for a in bad)
        report.add(Finding('warn', 'counter-dur',
                           f'{len(bad)} counter(s) with dur > 2.5s read as load bars.',
                           detail=f'Counters: {rows}',
                           fix_hint='Cap counter dur at 2.0s. Past that, the viewer perceives it as waiting for a number rather than watching it land.'))


def check_stacking(report, text):
    """Look for elements that stack 2+ emphasis presets via data-anim sequences
    in nearby siblings (heuristic: same element with multiple anim variants)."""
    # This is a coarse check -- flag elements where the same class appears
    # with multiple emphasis presets within ~120 chars of each other.
    stacked = []
    # Look for class signatures with multiple emphasis attrs
    pattern = re.compile(r'class="([^"]+)"[^>]*?data-anim="(glow|pulse|shake)"', re.DOTALL)
    classes_with_emphasis = Counter()
    for m in pattern.finditer(text):
        classes = ' '.join(sorted(set(m.group(1).split())))
        classes_with_emphasis[classes] += 1
    multi = {c: n for c, n in classes_with_emphasis.items() if n >= 3}
    if not multi:
        report.add(Finding('pass', 'stacking', 'No element stacks 3+ emphasis presets.'))
    else:
        report.add(Finding('warn', 'stacking',
                           f'{len(multi)} class signature(s) with 3+ stacked emphasis presets.',
                           detail=f'Signatures: {list(multi.keys())[:3]}',
                           fix_hint='Pick one of glow/pulse/shake per element. Stacking dilutes the effect; the viewer sees noise instead of accent.'))


def check_breath(report, anims, timings):
    """The 'breath' beat -- at least one beat with <= 2 entrance animations
    so the viewer can rest."""
    if not timings:
        return
    anims_per_slide = Counter(a['slide'] for a in anims)
    quiet_slides = [s for s, t in timings if anims_per_slide.get(s, 0) <= 2]
    report.stats['anims_per_slide'] = dict(anims_per_slide)
    if quiet_slides:
        report.add(Finding('pass', 'breath',
                           f'{len(quiet_slides)} beat(s) with &lt;= 2 entrance anims -- the deck breathes.',
                           detail=f'Quiet slides: {quiet_slides}'))
    else:
        report.add(Finding('warn', 'breath',
                           'Every slide has 3+ entrance animations. The deck doesn\'t breathe.',
                           fix_hint='Designate one beat (often a quote, the proof slide, or a moment between sections) with just a fade-in or wordReveal. The contrast makes the active beats land harder.'))


def render_report(report, as_markdown=False, deck_name='storyboard.html'):
    lines = []
    if as_markdown:
        lines.append(f"# Animator self-critique -- `{deck_name}`")
        lines.append("")
        lines.append(f"_Generated by `audit_deck.py` from the storyboard skill._")
        lines.append("")
    else:
        lines.append(f"=== Animator self-critique -- {deck_name} ===")
        lines.append("")

    # Summary
    n_pass = len(report.passes())
    n_warn = len(report.warnings())
    total = n_pass + n_warn
    badge = 'PASS' if n_warn == 0 else f'{n_warn} WARNING(S)'
    if as_markdown:
        lines.append(f"**Score:** {n_pass}/{total} checks pass -- {badge}")
        lines.append("")
    else:
        lines.append(f"Score: {n_pass}/{total} checks pass -- {badge}")
        lines.append("")

    # Findings
    if as_markdown:
        lines.append("## Findings")
        lines.append("")
    for f in report.findings:
        icon = '[ok]' if f.severity == 'pass' else '[WARN]'
        if as_markdown:
            lines.append(f"### {icon} {f.check} -- {f.summary}")
            if f.detail:
                lines.append("")
                lines.append(f"_Details:_ {f.detail}")
            if f.fix_hint:
                lines.append("")
                lines.append(f"**Fix:** {f.fix_hint}")
            lines.append("")
        else:
            lines.append(f"  {icon} [{f.check}] {f.summary}")
            if f.detail:
                lines.append(f"      detail: {f.detail}")
            if f.fix_hint:
                lines.append(f"      fix:    {f.fix_hint}")
            lines.append("")

    # Stats
    if as_markdown:
        lines.append("## Stats")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(report.stats, indent=2, default=str))
        lines.append("```")
    else:
        lines.append("Stats:")
        lines.append(json.dumps(report.stats, indent=2, default=str))

    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('html', help='Path to storyboard.html')
    ap.add_argument('--write', action='store_true', help='Also write audit.md next to the HTML')
    ap.add_argument('--json', action='store_true', help='Emit machine-readable JSON to stdout')
    args = ap.parse_args()

    html_path = Path(args.html)
    if not html_path.exists():
        sys.exit(f'Not found: {html_path}')
    text = html_path.read_text(encoding='utf-8')

    timings = extract_timings(text)
    anims = extract_animations(text)
    transitions = extract_transitions(text)

    report = AuditReport()
    report.stats['timings_count'] = len(timings)
    report.stats['animations_count'] = len(anims)
    report.stats['transitions_count'] = len(transitions)
    check_diversity(report, anims)
    check_signature(report, anims)
    check_transitions(report, transitions)
    check_atmosphere(report, anims, timings)
    check_overshoot(report, anims, timings)
    check_counter_durations(report, anims)
    check_stacking(report, text)
    check_breath(report, anims, timings)

    if args.json:
        print(json.dumps({
            'findings': [asdict(f) for f in report.findings],
            'stats': report.stats,
        }, indent=2, default=str))
    else:
        print(render_report(report, as_markdown=False, deck_name=html_path.name))

    if args.write:
        out = html_path.parent / 'audit.md'
        out.write_text(render_report(report, as_markdown=True, deck_name=html_path.name), encoding='utf-8')
        print(f'\n[ok] Wrote {out}')

    sys.exit(1 if report.warnings() else 0)


if __name__ == '__main__':
    main()
