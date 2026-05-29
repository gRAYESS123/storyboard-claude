# Storyboard for Claude Code — installer (Windows PowerShell)
# Run:  irm https://raw.githubusercontent.com/georgesrayess/storyboard-claude/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$repo   = if ($env:STORYBOARD_REPO)   { $env:STORYBOARD_REPO }   else { 'https://github.com/georgesrayess/storyboard-claude.git' }
$branch = if ($env:STORYBOARD_BRANCH) { $env:STORYBOARD_BRANCH } else { 'main' }
$dest   = Join-Path $HOME '.claude\skills\storyboard'
$tmp    = Join-Path $env:TEMP ("storyboard-" + [Guid]::NewGuid().ToString('N').Substring(0,8))

Write-Host ""
Write-Host "  📽  Storyboard for Claude Code — installer"
Write-Host ""

# --- Pre-flight ---
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "❌  git is required. Install Git for Windows and re-run."
  exit 1
}

# --- Download ---
Write-Host "📥  Cloning $repo ($branch)..."
& git clone --depth 1 --branch $branch $repo (Join-Path $tmp 'repo') 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌  Could not clone $repo"
  exit 1
}

# --- Install ---
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $tmp 'repo\skill\*') -Destination $dest -Recurse -Force
Write-Host "✅  Skill files copied to $dest"

# --- Python deps ---
$pip = Get-Command pip -ErrorAction SilentlyContinue
if (-not $pip) { $pip = Get-Command pip3 -ErrorAction SilentlyContinue }
if ($pip) {
  Write-Host "🐍  Installing optional Python helpers..."
  Write-Host "    (pyaaf2, mutagen, elevenlabs, playwright, imageio-ffmpeg)"
  try {
    python -m pip install --quiet --user pyaaf2 mutagen elevenlabs playwright imageio-ffmpeg 2>$null | Out-Null
    Write-Host "✅  Python helpers installed"
    Write-Host "🌐  Installing Chromium for headless MP4 rendering..."
    try {
      python -m playwright install chromium 2>$null | Out-Null
      Write-Host "✅  Chromium installed"
    } catch {
      Write-Host "⚠️   Chromium install skipped — run: python -m playwright install chromium"
    }
  } catch {
    Write-Host "⚠️   Could not install Python helpers — features that need them (AAF, auto-VO, MP4 render) will be unavailable until you run: pip install pyaaf2 mutagen elevenlabs playwright imageio-ffmpeg ; python -m playwright install chromium"
  }
} else {
  Write-Host "⚠️   No pip found — optional Python helpers (AAF, auto-VO, MP4 render) skipped."
}

# --- Cleanup ---
Remove-Item -Recurse -Force $tmp

Write-Host ""
Write-Host "────────────────────────────────────────────────────────"
Write-Host "  Storyboard skill installed."
Write-Host "  Open any Claude Code session and try:"
Write-Host ""
Write-Host "      /storyboard `"make a 60-second explainer for [topic]`""
Write-Host ""
Write-Host "  Or with a URL:"
Write-Host ""
Write-Host "      /storyboard https://example.com/your-page"
Write-Host ""
Write-Host "  Bundled worked example: examples/stripe-radar/"
Write-Host ""
Write-Host "  Docs:    $dest\SKILL.md"
Write-Host "  Brain:   $dest\animator.md"
Write-Host "  Presets: $dest\animations.md"
Write-Host "────────────────────────────────────────────────────────"
Write-Host ""
