#!/usr/bin/env bash
# Storyboard for Claude Code — installer (macOS / Linux)
# Run:  curl -fsSL https://raw.githubusercontent.com/georgesrayess/storyboard-claude/main/install.sh | bash

set -euo pipefail

REPO="${STORYBOARD_REPO:-https://github.com/georgesrayess/storyboard-claude.git}"
BRANCH="${STORYBOARD_BRANCH:-main}"
DEST="${HOME}/.claude/skills/storyboard"
TMPDIR="$(mktemp -d -t storyboard-XXXXXX)"

echo ""
echo "  📽  Storyboard for Claude Code — installer"
echo ""

# --- Pre-flight ---
command -v git >/dev/null 2>&1 || {
  echo "❌  git is required. Install it and re-run."
  exit 1
}

# --- Download ---
echo "📥  Cloning ${REPO} (${BRANCH})..."
git clone --depth 1 --branch "${BRANCH}" "${REPO}" "${TMPDIR}/repo" >/dev/null

# --- Install ---
mkdir -p "${DEST}"
cp -R "${TMPDIR}/repo/skill/." "${DEST}/"
echo "✅  Skill files copied to ${DEST}"

# --- Python deps (optional but recommended) ---
if command -v pip >/dev/null 2>&1 || command -v pip3 >/dev/null 2>&1; then
  PIP="$(command -v pip3 || command -v pip)"
  echo "🐍  Installing optional Python helpers..."
  echo "    (pyaaf2, mutagen, elevenlabs, playwright, imageio-ffmpeg)"
  "${PIP}" install --quiet --user pyaaf2 mutagen elevenlabs playwright imageio-ffmpeg 2>/dev/null \
    && {
      echo "✅  Python helpers installed"
      echo "🌐  Installing Chromium for headless MP4 rendering..."
      python -m playwright install chromium 2>/dev/null \
        && echo "✅  Chromium installed" \
        || echo "⚠️   Chromium install skipped — run: python -m playwright install chromium"
    } \
    || echo "⚠️   Could not install Python helpers — features that need them (AAF, auto-VO, MP4 render) will be unavailable until you run: ${PIP} install pyaaf2 mutagen elevenlabs playwright imageio-ffmpeg && python -m playwright install chromium"
else
  echo "⚠️   No pip found — optional Python helpers (AAF, auto-VO, MP4 render) skipped."
fi

# --- Cleanup ---
rm -rf "${TMPDIR}"

cat <<'EOF'

────────────────────────────────────────────────────────
  Storyboard skill installed.
  Open any Claude Code session and try:

      /storyboard "make a 60-second explainer for [topic]"

  Or with a URL:

      /storyboard https://example.com/your-page

  Bundled worked example: examples/stripe-radar/

  Docs:    ~/.claude/skills/storyboard/SKILL.md
  Brain:   ~/.claude/skills/storyboard/animator.md
  Presets: ~/.claude/skills/storyboard/animations.md
────────────────────────────────────────────────────────

EOF
