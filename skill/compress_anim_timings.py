#!/usr/bin/env python
"""
compress_anim_timings.py
Scale all data-t-rel values in a storyboard.html by a factor.

Use this when slide *content* feels late even though the slide *cues* are
right. The animations within each slide have `data-t-rel="X"` start delays
that can stack up — a scale of 0.4 makes most animations arrive within ~1s
of the slide cue, matching narration pacing closely.

Usage:
    python compress_anim_timings.py <storyboard.html> <scale>
    python compress_anim_timings.py storyboard.html 0.4
    python compress_anim_timings.py storyboard.html 0.5 --backup
    python compress_anim_timings.py storyboard.html --report   # just report current values
"""
import argparse
import re
import shutil
import sys
from pathlib import Path


PATTERN = re.compile(r'data-t-rel="([\d.]+)"')


def scale_html(text, scale):
    def repl(m):
        val = float(m.group(1))
        return f'data-t-rel="{round(val * scale, 2)}"'
    return PATTERN.sub(repl, text)


def report_values(text):
    values = [float(m.group(1)) for m in PATTERN.finditer(text)]
    if not values:
        print('No data-t-rel attributes found.')
        return
    print(f'{len(values)} data-t-rel attributes found.')
    print(f'  min  : {min(values):.2f}s')
    print(f'  max  : {max(values):.2f}s')
    print(f'  mean : {sum(values) / len(values):.2f}s')
    # Histogram
    buckets = [0] * 10
    for v in values:
        b = min(int(v / 0.5), 9)
        buckets[b] += 1
    print('  histogram (0.5s bins):')
    for i, count in enumerate(buckets):
        if count:
            print(f'    {i*0.5:.1f}-{(i+1)*0.5:.1f}s : {"#" * count} ({count})')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('html', help='Path to storyboard.html')
    ap.add_argument('scale', nargs='?', type=float, default=None,
                    help='Multiplier to apply to every data-t-rel (e.g. 0.4)')
    ap.add_argument('--report', action='store_true',
                    help='Print stats on current data-t-rel values and exit')
    ap.add_argument('--backup', action='store_true',
                    help='Write a .bak copy of the file before modifying')
    args = ap.parse_args()

    path = Path(args.html)
    if not path.exists():
        sys.exit(f'File not found: {path}')
    text = path.read_text(encoding='utf-8')

    if args.report or args.scale is None:
        report_values(text)
        return

    if args.backup:
        bak = path.with_suffix(path.suffix + '.bak')
        shutil.copy(path, bak)
        print(f'Backup written to {bak.name}')

    new_text = scale_html(text, args.scale)
    path.write_text(new_text, encoding='utf-8')
    count = len(PATTERN.findall(text))
    print(f'Scaled {count} data-t-rel values by {args.scale} in {path.name}')


if __name__ == '__main__':
    main()
