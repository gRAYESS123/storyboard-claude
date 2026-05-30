#!/usr/bin/env python
"""
lottie_fetch.py
Search the curated 100-entry animation index and fetch a Lottie ON DEMAND
into a project's assets/ (only what you use — no repo bloat, no dead-link
risk in renders, license recorded).

The index (lottie-library.json) maps ~100 fun animation concepts to either:
  - an OWNED procedural engine preset (use it first: zero deps, render-safe,
    brand-colored) — most common concepts have one, OR
  - a Lottie to fetch from a free source.

Usage:
  # browse the index
  python lottie_fetch.py --list
  python lottie_fetch.py --list celebration
  python lottie_fetch.py --search "success"          # fuzzy match on tags/id

  # fetch a specific Lottie URL into a project (validates + records credit)
  python lottie_fetch.py fetch <lottie-url> --out ./my-video --id confetti-burst

  # show what an index entry recommends (procedural preset or a search term)
  python lottie_fetch.py show success-check

Notes:
  - "free" Lottie licenses vary wildly. ALWAYS verify the source license before
    shipping. This tool writes the URL + date to assets/lottie/CREDITS.md so you
    have a record; it does NOT assert the asset is license-clean.
  - Prefer the procedural preset when the index lists one — it's the safe default.
  - To play a fetched Lottie in a deck:
      <div class="anim" data-anim="lottie" data-src="assets/lottie/<id>.json"
           data-t-rel="0.5" data-dur="3"></div>
    (the engine lazy-loads lottie-web; the local file keeps renders offline-safe)
"""
import argparse, json, sys, urllib.request, datetime
from pathlib import Path

HERE = Path(__file__).parent
INDEX = HERE / "lottie-library.json"


def load_index():
    if not INDEX.exists():
        sys.exit(f"Index not found: {INDEX}")
    return json.loads(INDEX.read_text(encoding="utf-8"))["animations"]


def cmd_list(category=None):
    rows = load_index()
    if category:
        rows = [r for r in rows if r["category"] == category]
    cats = {}
    for r in rows:
        cats.setdefault(r["category"], []).append(r)
    for cat, items in sorted(cats.items()):
        print(f"\n== {cat} ==")
        for r in items:
            tag = "[preset:%s]" % r["procedural"] if r.get("procedural") else "[fetch: %s]" % r.get("lottie_search", "?")
            print(f"  {r['id']:<22} {tag}")
    print(f"\n{len(load_index())} concepts total. Prefer [preset:*] — owned + render-safe.")


def cmd_search(q):
    q = q.lower()
    hits = []
    for r in load_index():
        hay = (r["id"] + " " + r["category"] + " " + " ".join(r.get("tags", []))).lower()
        score = sum(1 for w in q.split() if w in hay)
        if score:
            hits.append((score, r))
    hits.sort(key=lambda x: -x[0])
    if not hits:
        print("No matches.")
        return
    for _, r in hits[:12]:
        if r.get("procedural"):
            print(f"  {r['id']:<22} -> USE PRESET  data-anim=\"{r['procedural']}\"")
        else:
            print(f"  {r['id']:<22} -> FETCH       lottie_search: \"{r.get('lottie_search')}\"  (license_note: {r.get('license_note','verify source')})")


def cmd_show(entry_id):
    for r in load_index():
        if r["id"] == entry_id:
            print(json.dumps(r, indent=2))
            if r.get("procedural"):
                print(f"\nRecommended: use the owned preset — <div class=\"anim\" data-anim=\"{r['procedural']}\">. No fetch needed.")
            else:
                print(f"\nNo owned preset. Fetch a free Lottie (search: \"{r.get('lottie_search')}\"), verify its license, then:")
                print(f"  python lottie_fetch.py fetch <url> --out <project-dir> --id {entry_id}")
            return
    sys.exit(f"No index entry '{entry_id}'. Try --list or --search.")


def cmd_fetch(url, out_dir, entry_id):
    out = Path(out_dir)
    dest_dir = out / "assets" / "lottie"
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = (entry_id or url.rstrip("/").split("/")[-1].split(".")[0]) + ".json"
    dest = dest_dir / name
    print(f"[..] Fetching {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "storyboard-lottie-fetch"})
        data = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        sys.exit(f"Download failed: {e}")
    # validate it's a Lottie JSON
    try:
        obj = json.loads(data)
    except Exception:
        sys.exit("Downloaded file is not JSON. If it's a .lottie (dotLottie zip), unzip and point at the inner animations/*.json.")
    if not (isinstance(obj, dict) and "layers" in obj and ("v" in obj or "fr" in obj)):
        sys.exit("JSON doesn't look like a Lottie animation (missing 'layers'/'v'/'fr'). Double-check the URL.")
    dest.write_text(json.dumps(obj), encoding="utf-8")
    # record attribution
    credits = dest_dir / "CREDITS.md"
    line = f"- `{name}` — source: {url} — fetched {datetime.date.today().isoformat()} — LICENSE: VERIFY at source before shipping\n"
    with credits.open("a", encoding="utf-8") as f:
        if credits.stat().st_size == 0:
            f.write("# Lottie credits & licenses\n\nVerify each source's license before publishing this video.\n\n")
        f.write(line)
    kb = dest.stat().st_size / 1024
    print(f"[ok] Saved {dest}  ({kb:.0f} KB)")
    print(f"[ok] Recorded attribution in {credits}")
    print(f"\nUse it in the deck:")
    print(f'  <div class="anim" data-anim="lottie" data-src="assets/lottie/{name}" data-t-rel="0.5" data-dur="3"></div>')
    print("\nReminder: confirm the source's license permits your use (commercial? attribution?).")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    ap.add_argument("--list", nargs="?", const="__all__", help="List index (optionally by category)")
    ap.add_argument("--search", help="Fuzzy-search the index by keyword")
    ap.add_argument("--show", help="Show one entry's recommendation")
    f = sub.add_parser("fetch", help="Download a Lottie URL into a project")
    f.add_argument("url")
    f.add_argument("--out", required=True, help="Project directory (assets/lottie/ created inside)")
    f.add_argument("--id", help="Entry id / filename stem")
    args = ap.parse_args()

    if args.cmd == "fetch":
        cmd_fetch(args.url, args.out, args.id)
    elif args.show:
        cmd_show(args.show)
    elif args.search:
        cmd_search(args.search)
    elif args.list:
        cmd_list(None if args.list == "__all__" else args.list)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
