#!/usr/bin/env python
"""
aaf_to_timings.py
Extract slide cue times from an AAF and emit a TIMINGS JS block
that you can paste into a storyboard.html.

Usage:
    python aaf_to_timings.py <path-to-aaf>
    python aaf_to_timings.py <path-to-aaf> --min-length 2.0
    python aaf_to_timings.py <path-to-aaf> --slides 15
    python aaf_to_timings.py <path-to-aaf> --all
    python aaf_to_timings.py <path-to-aaf> --json
    python aaf_to_timings.py <path-to-aaf> --apply <path-to-storyboard.html>

Heuristics:
  Most narration AAFs alternate (short break) + (long narration clip).
  Default behavior keeps clips whose length is >= --min-length (2.0s),
  treating each as one slide cue. --all keeps every clip. --slides N
  warns if the kept count doesn't match the expected slide count.

Requires: pip install pyaaf2
"""
import argparse
import json
import sys
from pathlib import Path

try:
    import aaf2
except ImportError:
    sys.exit("pyaaf2 not installed. Run:\n  pip install pyaaf2")


def list_clips(aaf_path):
    """Return list of clips: [{'index', 'start_sec', 'length_sec', 'name', 'is_filler'}]."""
    clips = []
    with aaf2.open(str(aaf_path), 'r') as f:
        comps = list(f.content.compositionmobs())
        if not comps:
            return clips
        cm = comps[0]
        for slot in cm.slots:
            seg = slot.segment
            edit_rate = float(slot.edit_rate)
            if edit_rate == 0:
                continue
            if not hasattr(seg, 'components'):
                continue
            pos = 0
            for i, c in enumerate(seg.components):
                length = c.length
                name = ''
                if hasattr(c, 'mob') and c.mob is not None:
                    name = c.mob.name or ''
                clips.append({
                    'index': i,
                    'start_sec': round(pos / edit_rate, 3),
                    'length_sec': round(length / edit_rate, 3),
                    'name': name,
                    'type': type(c).__name__,
                    'is_filler': type(c).__name__ == 'Filler',
                })
                pos += length
            break  # only the first slot/track
    return clips


def select_cues(clips, min_length=2.0, keep_all=False, gap_threshold=0.8):
    """Filter clips down to the ones that should each become a slide cue.

    Two-pass:
      1. Keep only clips above min-length (or everything if --all).
      2. Merge consecutive kept clips whose preceding gap (silence) is
         shorter than gap_threshold — those are mid-slide breaks (e.g.
         SSML <break time="0.7s" /> between sentences of the same beat),
         not slide changes.
    """
    if keep_all:
        narration = [c for c in clips if not c['is_filler']]
    else:
        narration = [c for c in clips if c['length_sec'] >= min_length and not c['is_filler']]

    if not narration:
        return narration

    # Build a quick lookup of clip end times to compute gap between clips
    end_by_idx = {c['index']: c['start_sec'] + c['length_sec'] for c in clips}
    cues = [narration[0]]
    for nxt in narration[1:]:
        prev = cues[-1]
        prev_end = end_by_idx[prev['index']]
        gap = nxt['start_sec'] - prev_end
        if gap < gap_threshold:
            # Same slide — extend the previous cue, don't start a new one
            continue
        cues.append(nxt)
    return cues


def format_timings_block(cues):
    """Format as a JS TIMINGS array."""
    lines = ['const TIMINGS = [']
    for i, c in enumerate(cues):
        t = c['start_sec']
        slide = i + 1
        comma = ',' if i < len(cues) - 1 else ''
        lines.append(f'  {{ time: {t:7.2f}, slide: {slide:2d} }}{comma}')
    lines.append('];')
    return '\n'.join(lines)


def apply_to_html(html_path, timings_block):
    """Replace the existing TIMINGS array in a storyboard.html with the new one."""
    import re
    text = Path(html_path).read_text(encoding='utf-8')
    pattern = re.compile(r'const TIMINGS\s*=\s*\[[^\]]*\];', re.DOTALL)
    if not pattern.search(text):
        print('  ! Could not find a TIMINGS = [...] block in', html_path, file=sys.stderr)
        return False
    new_text = pattern.sub(timings_block, text, count=1)
    Path(html_path).write_text(new_text, encoding='utf-8')
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('aaf', help='Path to .aaf file')
    ap.add_argument('--min-length', type=float, default=2.0,
                    help='Minimum clip length in seconds to count as a slide cue (default 2.0)')
    ap.add_argument('--all', action='store_true',
                    help='Keep every non-filler clip (no length filter)')
    ap.add_argument('--gap-threshold', type=float, default=0.8,
                    help='Silence (s) shorter than this between two clips means '
                         'same slide (mid-slide SSML break, not a slide change). '
                         'Default 0.8.')
    ap.add_argument('--offset', type=float, default=0.0,
                    help='Add this many seconds to every cue. Use negative '
                         'values to make visuals lead audio (standard animator '
                         'practice: -0.15 to -0.30). Slide 1 is clamped to >= 0.')
    ap.add_argument('--slides', type=int, default=None,
                    help='Expected slide count — warns if kept count differs')
    ap.add_argument('--json', action='store_true',
                    help='Emit machine-readable JSON of TIMINGS')
    ap.add_argument('--list', action='store_true',
                    help='Just list all clips for inspection (no filtering)')
    ap.add_argument('--apply', metavar='HTML',
                    help='Rewrite the TIMINGS array in this storyboard.html')
    args = ap.parse_args()

    aaf_path = Path(args.aaf)
    if not aaf_path.exists():
        sys.exit(f'AAF not found: {aaf_path}')

    clips = list_clips(aaf_path)
    if not clips:
        sys.exit('No clips found in AAF.')

    if args.list:
        print(f'# {len(clips)} clips in {aaf_path.name}')
        for c in clips:
            mark = '  ' if c['length_sec'] >= args.min_length and not c['is_filler'] else ' .'
            print(f'  [{c["index"]:3d}]{mark} @{c["start_sec"]:7.2f}s  len={c["length_sec"]:6.2f}s  {c["type"]:12s}  name={c["name"]!r}')
        return

    cues = select_cues(clips, min_length=args.min_length, keep_all=args.all,
                       gap_threshold=args.gap_threshold)
    if args.offset:
        for i, c in enumerate(cues):
            c['start_sec'] = max(0.0, round(c['start_sec'] + args.offset, 3))
        # Re-sort just in case offset caused a re-order (shouldn't, but safe)
        cues.sort(key=lambda c: c['start_sec'])

    if args.slides is not None and len(cues) != args.slides:
        print(f'# WARNING: kept {len(cues)} cues, expected {args.slides} slides',
              file=sys.stderr)
        print(f'# Try --min-length <smaller> or --all', file=sys.stderr)

    if args.json:
        out = [{'time': c['start_sec'], 'slide': i + 1} for i, c in enumerate(cues)]
        print(json.dumps(out, indent=2))
        return

    block = format_timings_block(cues)
    print(f'# Source: {aaf_path.name}')
    print(f'# {len(cues)} cues extracted (min length {args.min_length}s)')
    print()
    print(block)

    if args.apply:
        if apply_to_html(args.apply, block):
            print(f'\n# Wrote new TIMINGS into {args.apply}', file=sys.stderr)


if __name__ == '__main__':
    main()
