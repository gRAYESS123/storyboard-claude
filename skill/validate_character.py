#!/usr/bin/env python
"""
validate_character.py
Validate a Storyboard "Character Definition" JSON (the bring-your-own format)
before shipping it. Checks the schema, whitelists shapes/attributes, and flags
anything unsafe (script/handlers/external refs would be stripped by the engine).

Usage:
  python validate_character.py my-character.json
  python validate_character.py examples/characters/        # all *.json in a dir
"""
import json
import re
import sys
from pathlib import Path

SHAPES = {"rect", "circle", "ellipse", "line", "path", "polygon", "g"}
NUM_ATTRS = {"x", "y", "w", "h", "r", "rx", "ry", "cx", "cy",
             "x1", "y1", "x2", "y2", "sw", "opacity"}
RIG = {"armL", "armR", "eyeL", "eyeR", "pupilL", "pupilR", "pupil", "smile",
       "mouth", "open", "mouthOpen", "brL", "brR", "cheekL", "cheekR", "body"}
PATH_RE = re.compile(r"^[\sMLHVCSQTAZmlhvcsqtaz0-9eE,.\- ]+$")
COLOR_BAD = re.compile(r"""[<>"']""")


class Report:
    def __init__(self):
        self.errs = []
        self.warns = []
    def err(self, m): self.errs.append(m)
    def warn(self, m): self.warns.append(m)


def _color_ok(v):
    return isinstance(v, str) and not COLOR_BAD.search(v) and len(v) <= 64


def check_part(p, where, r):
    if not isinstance(p, dict):
        r.err("%s: part is not an object" % where); return
    sh = p.get("shape")
    if sh not in SHAPES:
        r.err("%s: shape '%s' not allowed (use %s)" % (where, sh, "/".join(sorted(SHAPES)))); return
    if "rig" in p and p["rig"] not in RIG:
        r.warn("%s: rig '%s' is not a known rig point (ignored by engine)" % (where, p["rig"]))
    for k, v in p.items():
        if k in ("shape", "rig", "fill", "stroke", "lc", "lj", "parts", "d", "points"):
            continue
        if k in NUM_ATTRS:
            if not isinstance(v, (int, float)):
                r.err("%s: attr '%s' must be a number, got %r" % (where, k, v))
        else:
            r.warn("%s: attr '%s' is not recognized (engine will ignore it)" % (where, k))
    for ck in ("fill", "stroke"):
        if ck in p and p[ck] is not None:
            v = p[ck]
            if isinstance(v, str) and v.startswith("$"):
                pass  # token, resolved at runtime
            elif not _color_ok(v):
                r.err("%s: %s '%r' is unsafe / invalid" % (where, ck, v))
    if sh == "path":
        if not isinstance(p.get("d"), str) or not PATH_RE.match(p.get("d", "")):
            r.err("%s: path 'd' missing or contains disallowed characters" % where)
    if sh == "polygon":
        if not isinstance(p.get("points"), str) or not PATH_RE.match(p.get("points", "")):
            r.err("%s: polygon 'points' missing or contains disallowed characters" % where)
    if sh == "g":
        kids = p.get("parts", [])
        if not isinstance(kids, list):
            r.err("%s: group 'parts' must be a list" % where)
        else:
            for i, kid in enumerate(kids):
                check_part(kid, "%s>g[%d]" % (where, i), r)
    if p.get("lc") not in (None, "round", "square"):
        r.warn("%s: lc should be 'round' or 'square'" % where)


def check_face(F, r):
    if not isinstance(F, dict):
        r.err("face must be an object"); return
    e = F.get("eyes")
    if not isinstance(e, dict) or "L" not in e or "R" not in e:
        r.warn("face.eyes should have L and R points (defaults used otherwise)")
    if F.get("render") is False:
        r.warn("face.render=false -> you must rig your own eyes/mouth via parts/data-sbc")


def validate(path, r):
    raw = Path(path).read_text(encoding="utf-8")
    # raw safety scan (the engine would also reject these in the SVG-rig path)
    for bad in ("<script", "javascript:", "onload=", "onclick=", "onerror="):
        if bad in raw.lower():
            r.err("file contains '%s' (not allowed in a character definition)" % bad)
    try:
        d = json.loads(raw)
    except Exception as ex:
        r.err("invalid JSON: %s" % ex); return None
    if not isinstance(d, dict):
        r.err("top level must be an object"); return d
    if not d.get("name") or not isinstance(d.get("name"), str):
        r.warn("no 'name' (engine uses the data-char key when bundled)")
    vb = d.get("viewBox")
    if vb is not None and (not isinstance(vb, list) or len(vb) != 2):
        r.err("viewBox must be [width, height]")
    if "face" in d:
        check_face(d["face"], r)
    parts = d.get("parts", [])
    if not isinstance(parts, list):
        r.err("parts must be a list")
    elif not parts and not (d.get("face") and d["face"].get("render") is False):
        r.warn("no parts -> the character will only show the engine face")
    else:
        for i, p in enumerate(parts):
            check_part(p, "parts[%d]" % i, r)
    return d


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not args:
        print("usage: python validate_character.py <file.json | dir>")
        sys.exit(2)
    targets = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            targets += sorted(p.glob("*.json"))
        else:
            targets.append(p)
    if not targets:
        print("[ERROR] no .json files found")
        sys.exit(1)
    bad = 0
    for t in targets:
        r = Report()
        try:
            validate(t, r)
        except Exception as ex:
            r.err("could not read: %s" % ex)
        status = "[ERROR]" if r.errs else ("[WARN]" if r.warns else "[ok]")
        print("%s %s" % (status, t))
        for m in r.errs:
            print("   ERROR: " + m)
        for m in r.warns:
            print("   warn : " + m)
        if r.errs:
            bad += 1
    print()
    print("Checked %d file(s); %d with errors." % (len(targets), bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
