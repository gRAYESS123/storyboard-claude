#!/usr/bin/env python
"""
elevenlabs_generate.py
Render a storyboard's voice-over with ElevenLabs and emit sample-accurate
TIMINGS computed from the returned word timestamps.

Pipeline:
  script.md (SSML block in section 1)
       |
       v
  ElevenLabs API   (text-to-speech-with-timestamps)
       |
       v
  -->  VO English.mp3          (saved next to storyboard.html)
  -->  word_timestamps.json    (raw response, for inspection)
  -->  TIMINGS rewritten in    (if --apply storyboard.html)
       storyboard.html

Requires:
  pip install elevenlabs
  Env var: ELEVENLABS_API_KEY

Usage:
  python elevenlabs_generate.py script.md ./output-dir
  python elevenlabs_generate.py script.md . --voice "Adam" --speed 0.90
  python elevenlabs_generate.py script.md . --apply storyboard.html
  python elevenlabs_generate.py script.md . --slides 15  (warn if cue count mismatches)

Defaults:
  Voice  : 'Adam' (calm documentary mid-range)
  Model  : 'eleven_multilingual_v2' (honors <break> tags)
  Speed  : 0.90  (240 wpm)
  Output : 'VO English.mp3'

How TIMINGS are computed:
  ElevenLabs returns character-level timestamps. The script extracts each
  beat by finding break points (>= 0.8s of silence between voiced chars,
  configurable via --gap-threshold) and uses the start time of the first
  char after each break as a slide cue. The first cue is t=0.
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path


def extract_ssml_block(script_md_path):
    """Pull the first fenced code block out of script.md. That's the SSML."""
    text = Path(script_md_path).read_text(encoding='utf-8')
    # Find ``` ... ``` (greedy but only the first block — that's the canonical SSML)
    match = re.search(r'```\n([\s\S]*?)\n```', text)
    if not match:
        sys.exit("Could not find a fenced code block in script.md. "
                 "Section 1 should contain the SSML inside ``` ... ``` markers.")
    return match.group(1).strip()


def voice_id_for(name):
    """Map common voice names to ElevenLabs IDs. Pass through any ID directly."""
    # If it looks like an ElevenLabs voice ID (20-char alphanum), use as-is
    if re.fullmatch(r'[A-Za-z0-9]{20}', name):
        return name
    # Otherwise: well-known mid-range documentary voices
    known = {
        'adam':    'pNInz6obpgDQGcFmaJgB',
        'daniel':  'onwK4e9ZLuTAKqWW03F9',
        'brian':   'nPczCjzI2devNBz1zQrb',
        'rachel':  '21m00Tcm4TlvDq8ikWAM',
        'antoni':  'ErXwobaYiN019PkySvjV',
        'arnold':  'VR6AewLTigWG4xSOukaG',
    }
    return known.get(name.lower(), name)


def compute_timings_from_alignment(alignment, gap_threshold=0.8):
    """
    Given ElevenLabs's character_start_times, return slide cue times.
    A 'slide cue' = the start of any non-whitespace char that follows a gap
    of >= gap_threshold seconds since the previous voiced char.
    First cue is always 0.0.
    """
    chars = alignment.get('characters', [])
    starts = alignment.get('character_start_times_seconds', [])
    ends   = alignment.get('character_end_times_seconds', [])
    if not chars or not starts:
        return []
    cues = [0.0]
    last_voiced_end = None
    for i, ch in enumerate(chars):
        if not ch.strip():
            continue
        if last_voiced_end is not None:
            gap = starts[i] - last_voiced_end
            if gap >= gap_threshold:
                cues.append(round(starts[i], 2))
        last_voiced_end = ends[i] if i < len(ends) else starts[i]
    return cues


def format_timings_block(cues):
    lines = ['const TIMINGS = [']
    for i, t in enumerate(cues):
        slide = i + 1
        comma = ',' if i < len(cues) - 1 else ''
        lines.append(f'  {{ time: {t:7.2f}, slide: {slide:2d} }}{comma}')
    lines.append('];')
    return '\n'.join(lines)


def apply_to_html(html_path, timings_block):
    text = Path(html_path).read_text(encoding='utf-8')
    pattern = re.compile(r'const TIMINGS\s*=\s*\[[^\]]*\];', re.DOTALL)
    if not pattern.search(text):
        print(f"  ! Could not find a TIMINGS = [...] block in {html_path}", file=sys.stderr)
        return False
    Path(html_path).write_text(pattern.sub(timings_block, text, count=1), encoding='utf-8')
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('script', help='Path to script.md')
    ap.add_argument('out_dir', help='Output directory (where MP3 + JSON go)')
    ap.add_argument('--voice', default='Adam', help='Voice name or ElevenLabs voice ID (default: Adam)')
    ap.add_argument('--model', default='eleven_multilingual_v2', help='Model (default: eleven_multilingual_v2 — required for <break> tags)')
    ap.add_argument('--speed', type=float, default=0.90, help='Playback speed 0.7–1.2 (default 0.90 = 240 wpm)')
    ap.add_argument('--stability', type=float, default=0.55, help='Voice settings stability (default 0.55)')
    ap.add_argument('--similarity', type=float, default=0.75, help='Voice settings similarity (default 0.75)')
    ap.add_argument('--style', type=float, default=0.10, help='Voice settings style (default 0.10)')
    ap.add_argument('--mp3-name', default='VO English.mp3', help='Output MP3 filename')
    ap.add_argument('--gap-threshold', type=float, default=0.8, help='Silence (s) that counts as a slide boundary (default 0.8)')
    ap.add_argument('--slides', type=int, default=None, help='Expected slide count — warns if mismatch')
    ap.add_argument('--apply', metavar='HTML', help='Rewrite the TIMINGS array in this storyboard.html')
    args = ap.parse_args()

    api_key = os.environ.get('ELEVENLABS_API_KEY')
    if not api_key:
        sys.exit("ELEVENLABS_API_KEY environment variable not set.")

    try:
        from elevenlabs.client import ElevenLabs
    except ImportError:
        sys.exit("elevenlabs SDK not installed. Run:\n  pip install elevenlabs")

    script_path = Path(args.script)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ssml = extract_ssml_block(script_path)
    print(f"[ok] Extracted {len(ssml)} chars of SSML from {script_path.name}")

    client = ElevenLabs(api_key=api_key)
    voice_id = voice_id_for(args.voice)

    print(f"[..] Calling ElevenLabs (voice={args.voice} -> {voice_id}, model={args.model}, speed={args.speed})...")
    voice_settings = {
        'stability':       args.stability,
        'similarity_boost': args.similarity,
        'style':            args.style,
        'use_speaker_boost': True,
        'speed':            args.speed,
    }
    response = client.text_to_speech.convert_with_timestamps(
        voice_id=voice_id,
        text=ssml,
        model_id=args.model,
        voice_settings=voice_settings,
        output_format='mp3_44100_128',
    )

    # The SDK returns an object with `.audio_base64` (str) and `.alignment` (dict)
    import base64
    audio_bytes = base64.b64decode(response.audio_base64)
    mp3_path = out_dir / args.mp3_name
    mp3_path.write_bytes(audio_bytes)
    print(f"[ok] Wrote {mp3_path} ({len(audio_bytes):,} bytes)")

    alignment = response.alignment if hasattr(response, 'alignment') else response.normalized_alignment
    ts_path = out_dir / 'word_timestamps.json'
    ts_path.write_text(json.dumps(alignment if isinstance(alignment, dict) else alignment.__dict__,
                                   indent=2, default=str), encoding='utf-8')
    print(f"[ok] Wrote {ts_path}")

    alignment_dict = alignment if isinstance(alignment, dict) else alignment.__dict__
    cues = compute_timings_from_alignment(alignment_dict, gap_threshold=args.gap_threshold)
    print(f"[ok] Derived {len(cues)} slide cues from character timestamps "
          f"(gap >= {args.gap_threshold}s)")

    if args.slides is not None and len(cues) != args.slides:
        print(f"[WARN] Expected {args.slides} slides but got {len(cues)} cues. "
              f"Try --gap-threshold <larger or smaller> to retune.", file=sys.stderr)

    block = format_timings_block(cues)
    print()
    print(block)

    if args.apply:
        if apply_to_html(args.apply, block):
            print(f"\n[OK] Rewrote TIMINGS in {args.apply}", file=sys.stderr)


if __name__ == '__main__':
    main()
