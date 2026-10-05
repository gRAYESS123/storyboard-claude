"""Build the Easy Storyboard SEO pages from index.html's shared header/footer.

python tools/build_pages.py      (run from the site root)

Writes: tour.html, blog-post-to-video.html, pdf-to-video.html,
claude-code-video-skill.html, animated-character-videos.html, sitemap.xml, llms.txt,
and refreshes the VideoObject JSON-LD + analytics tag in index.html.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://www.easystoryboard.com'
TODAY = '2026-10-05'
ANALYTICS = '<script defer src="/_vercel/insights/script.js"></script>'

TOUR = {
    'name': 'Easy Storyboard: the 90-second tour',
    'description': 'A 90-second tour of Easy Storyboard, the free Claude Code skill that turns links, PDFs and docs into narrated, animated videos. The tour itself was made with the skill: script, voice, animation and render.',
    'thumbnailUrl': f'{SITE}/media/tour-poster.jpg',
    'contentUrl': f'{SITE}/media/easy-storyboard-tour.mp4',
    'embedUrl': f'{SITE}/tour',
    'uploadDate': '2026-10-05',
    'duration': 'PT1M31S',
}
RIG = {
    'name': 'Character rigging in Easy Storyboard',
    'description': 'Five rigged characters acting on a timeline: waving, looking at and pointing to a chart, changing mood, jumping and talking in speech bubbles.',
    'thumbnailUrl': f'{SITE}/media/character-rigging-poster.jpg',
    'contentUrl': f'{SITE}/media/character-rigging.mp4',
    'embedUrl': f'{SITE}/animated-character-videos',
    'uploadDate': '2026-10-05',
    'duration': 'PT10S',
}

# Tour chapters: (start seconds, title, narration)
CHAPTERS = [
    (0.0, 'Cold open', 'Links. PDFs. Docs. Now, they\'re videos.'),
    (4.4, 'Meet Easy Storyboard', 'Meet Easy Storyboard. A free skill for Claude Code.'),
    (8.3, 'Bring anything', 'Hand it a web page, a PDF, a Word or Markdown doc, pasted text, or even an existing HTML page.'),
    (16.3, 'Concept', 'Claude sketches three creative directions, picks the strongest, and maps an emotional arc across every beat.'),
    (24.6, 'Script and voice', 'It writes narration timed to your length, then voices it. Free, with no API key, or with ElevenLabs.'),
    (32.9, 'Claude as animator', 'Then Claude becomes your animator. Over a hundred motion presets, real spring physics, and the twelve principles of animation.'),
    (40.9, 'Kinetic typography', 'Kinetic type that rises, scrambles, and gets drawn on, right as it\'s spoken.'),
    (45.9, 'Charts', 'Charts that build themselves on the beat.'),
    (48.3, 'Cinematic motion', 'Camera moves. Parallax depth. Real 3D. And twenty three cinematic transitions.'),
    (56.0, 'Characters', 'Rig your own characters. They wave, react, and talk along with the voice over.'),
    (61.5, 'Product demos', 'Demo a product without a screen recording. A cursor that clicks and types, and code that writes itself.'),
    (68.2, 'Celebrations', 'And when it\'s time to celebrate? Confetti, fireworks, badges, and more.'),
    (73.5, 'Styles and formats', 'Seven signature styles. Widescreen, or vertical.'),
    (77.6, 'Audit and render', 'A built in audit catches weak beats. Then it renders a frame perfect MP4, with sound design.'),
    (84.9, 'Get it free', 'Easy Storyboard. Free for Claude Code. And yes, this entire video was made with it.'),
]


def mmss(t):
    return f'{int(t // 60)}:{int(t % 60):02d}'


def video_obj(v, extra=None):
    o = {'@type': 'VideoObject', **v}
    if extra:
        o.update(extra)
    return o


def shared_parts():
    idx = (ROOT / 'index.html').read_text(encoding='utf-8')
    header = re.search(r'<header class="site-header".*?</header>', idx, re.S).group(0)
    footer = re.search(r'<footer class="site-footer".*?</footer>', idx, re.S).group(0)
    fonts = re.search(r'<link rel="preload" as="style" href="(https://fonts[^"]+)"', idx).group(1)
    css_ver = re.search(r'/css/styles\.css\?v=(\d+)', idx).group(1)
    js_ver = re.search(r'/js/main\.js\?v=(\d+)', idx).group(1)
    fix = lambda h: h.replace('href="#"', 'href="/"').replace('href="#', 'href="/#')
    return fix(header), fix(footer), fonts, css_ver, js_ver


def page(slug, title, desc, h1, lead, body, schema, crumb):
    header, footer, fonts, css_v, js_v = shared_parts()
    url = f'{SITE}/{slug}'
    crumbs = {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Easy Storyboard', 'item': f'{SITE}/'},
        {'@type': 'ListItem', 'position': 2, 'name': crumb, 'item': url}]}
    graph = {'@context': 'https://schema.org', '@graph': [crumbs, *schema]}
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>document.documentElement.classList.add('js');</script>
    <title>{html.escape(title)}</title>
    <meta name="description" content="{html.escape(desc)}">
    <link rel="canonical" href="{url}">
    <meta name="author" content="Georges Rayess">
    <link rel="author" href="https://georgesrayess.com">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#FAFAFA">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" href="/images/favicon.png" sizes="64x64">
    <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{url}">
    <meta property="og:title" content="{html.escape(title)}">
    <meta property="og:description" content="{html.escape(desc)}">
    <meta property="og:image" content="{SITE}/images/og-image.png">
    <meta property="og:site_name" content="Easy Storyboard">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{html.escape(title)}">
    <meta name="twitter:description" content="{html.escape(desc)}">
    <meta name="twitter:image" content="{SITE}/images/og-image.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="/css/styles.css?v={css_v}">
    <link rel="preload" as="style" href="{fonts}" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="{fonts}"></noscript>
    <script type="application/ld+json">
{json.dumps(graph, indent=2, ensure_ascii=False)}
    </script>
    {ANALYTICS}
</head>
<body>
    <a class="skip-link" href="#main">Skip to main content</a>
    {header}
    <main id="main">
        <section class="page-hero">
            <div class="container container-narrow">
                <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Easy Storyboard</a> <span aria-hidden="true">/</span> <span>{html.escape(crumb)}</span></nav>
                <h1>{h1}</h1>
                <p class="hero-sub">{lead}</p>
                <div class="hero-cta">
                    <a href="/downloads/storyboard-skill.zip" class="btn btn-primary btn-lg" download>Download the skill</a>
                    <a href="/#install" class="btn btn-ghost btn-lg">Install guide</a>
                </div>
            </div>
        </section>
        <article class="prose container container-narrow">
{body}
        </article>
        <section class="final-cta">
            <div class="container">
                <div class="final-card reveal">
                    <h2>Your next video is one command away.</h2>
                    <p>Free for Claude Code. Runs on your machine.</p>
                    <div class="hero-cta hero-cta-center">
                        <a href="/downloads/storyboard-skill.zip" class="btn btn-primary btn-lg" download>Download the skill</a>
                        <a href="/tour" class="btn btn-ghost btn-lg">Watch the tour</a>
                    </div>
                </div>
            </div>
        </section>
    </main>
    {footer}
    <script src="/js/main.js?v={js_v}" defer></script>
</body>
</html>
'''


def related(*links):
    items = ''.join(f'<li><a class="text-link" href="/{s}">{t}</a></li>' for s, t in links)
    return f'<h2>Related</h2>\n<ul>{items}</ul>'


def video_block(src, poster, label, caption, controls=True):
    attrs = 'controls preload="metadata"' if controls else 'autoplay muted loop playsinline preload="metadata"'
    return (f'<div class="video-frame prose-video"><video {attrs} poster="{poster}" aria-label="{html.escape(label)}">'
            f'<source src="{src}" type="video/mp4"></video></div>\n<p class="video-caption">{caption}</p>')


PAGES = []

# ---------------------------------------------------------------- /tour
chap_html = '\n'.join(
    f'<li><span class="t mono">{mmss(t)}</span> <strong>{html.escape(name)}.</strong> {html.escape(text)}</li>'
    for t, name, text in CHAPTERS)
tour_body = f'''
{video_block('/media/easy-storyboard-tour.mp4', '/media/tour-poster.jpg', TOUR['name'], 'Script, voice, animation and render: all done by <code class="inline-code">/storyboard</code>.')}
<h2>Chapters and transcript</h2>
<ol class="chapters">
{chap_html}
</ol>
<h2>How this video was made</h2>
<p>The tour is a normal Easy Storyboard project. Claude wrote <code class="inline-code">concept.md</code> and <code class="inline-code">script.md</code>, the free voice tool generated the narration with exact slide cues and per-word timestamps, and every animation was choreographed in <code class="inline-code">storyboard.html</code> to land on the word that names it. The engine then rendered it frame by frame to MP4, with sound effects placed automatically on transitions and celebrations.</p>
<p>The look is the flat "Generative Art Platform" theme: a light canvas, near-black ink and one pink accent.</p>
{related(('claude-code-video-skill', 'What the Claude Code video skill does'), ('animated-character-videos', 'Animated characters and rigging'), ('blog-post-to-video', 'Turn a blog post into a video'))}
'''
tour_schema = [video_obj(TOUR, {
    'transcript': ' '.join(c[2] for c in CHAPTERS),
    'hasPart': [{'@type': 'Clip', 'name': n, 'startOffset': int(t),
                 'endOffset': int(CHAPTERS[i + 1][0]) if i + 1 < len(CHAPTERS) else 91,
                 'url': f'{SITE}/tour#t={int(t)}'} for i, (t, n, _) in enumerate(CHAPTERS)]})]
PAGES.append(('tour', 'Easy Storyboard Tour: 90-Second Demo Video',
              'Watch the 90-second tour of Easy Storyboard, made with the skill itself, with chapters and a full transcript.',
              'The 90-second tour', 'Every feature, shown working, in a video the skill made about itself.',
              tour_body, tour_schema, 'Tour'))

# ---------------------------------------------------------------- /blog-post-to-video
blog_body = f'''
<h2>Why turn a blog post into a video</h2>
<p>Your post already has the hard part: an argument, examples and a point. A short narrated video lets that same work reach people who scroll past text, on YouTube, LinkedIn, Reels, TikTok and Shorts, without you filming or editing anything.</p>
<h2>How it works</h2>
<ol>
<li><strong>Point it at the post.</strong> In Claude Code, run <code class="inline-code">/storyboard https://yourblog.com/your-post --duration 60s</code>.</li>
<li><strong>Claude plans and writes.</strong> It reads the post, picks a narrative shape (problem, frame, solution; or hook, examples, synthesis), splits it into beats and writes narration timed to your target length.</li>
<li><strong>Voice and animation.</strong> The free voice reads the script with exact slide timing, and Claude choreographs each beat: kinetic headlines, charts for your numbers, transitions at the real turning points.</li>
<li><strong>Render.</strong> You get an MP4, plus every source file in case you want to tweak a line and re-render.</li>
</ol>
<h2>Tips for posts that become great videos</h2>
<ul>
<li><strong>Pick the length for the channel.</strong> 30 to 60 seconds for social, about 2 minutes for YouTube or your own site.</li>
<li><strong>Go vertical for Reels, TikTok and Shorts</strong> with <code class="inline-code">--aspect 9:16</code>.</li>
<li><strong>Numbers make great beats.</strong> Stats from your post become counters and charts that draw themselves on the word that names them.</li>
<li><strong>It won't invent facts.</strong> The skill sticks to what's in your source; if the post is thin, it asks for more instead of padding.</li>
</ul>
<h2>What you get</h2>
<p>A project folder with <code class="inline-code">concept.md</code> (the plan), <code class="inline-code">script.md</code> (the narration), <code class="inline-code">storyboard.html</code> (the animated deck you can preview in a browser), <code class="inline-code">voiceover.mp3</code> and the rendered MP4.</p>
{related(('pdf-to-video', 'Turn a PDF or doc into an explainer video'), ('claude-code-video-skill', 'How the Claude Code video skill works'), ('tour', 'Watch the 90-second tour'))}
'''
PAGES.append(('blog-post-to-video', 'Turn a Blog Post Into a Narrated Video | Easy Storyboard',
              'Turn any blog post into a narrated, animated video with one Claude Code command. Free voice, automatic animation, MP4 output. No editing.',
              'Turn a blog post into a narrated video', 'One command in Claude Code turns your post into a scripted, voiced, animated MP4, ready for YouTube, LinkedIn or Reels.',
              blog_body, [{'@type': 'HowTo', 'name': 'Turn a blog post into a narrated video', 'step': [
                  {'@type': 'HowToStep', 'name': 'Run /storyboard with the post URL', 'text': 'In Claude Code, run /storyboard followed by the post URL and an optional --duration.'},
                  {'@type': 'HowToStep', 'name': 'Review the plan and script', 'text': 'Claude writes concept.md and script.md with narration timed to your length.'},
                  {'@type': 'HowToStep', 'name': 'Voice and animate', 'text': 'Generate the voice-over with the free voice or ElevenLabs; Claude choreographs storyboard.html.'},
                  {'@type': 'HowToStep', 'name': 'Render the MP4', 'text': 'Render the deck to MP4 with headless Chromium and ffmpeg.'}]}],
              'Blog post to video'))

# ---------------------------------------------------------------- /pdf-to-video
pdf_body = f'''
<h2>From a document to an explainer</h2>
<p>Reports, whitepapers, research summaries, onboarding docs and pitch notes are full of things worth explaining, and almost nobody reads them end to end. Easy Storyboard turns a PDF, Word (.docx) or Markdown file into a short narrated explainer that people actually finish.</p>
<h2>How it works</h2>
<ol>
<li><strong>Hand it the file.</strong> Run <code class="inline-code">/storyboard ./report.pdf</code> in Claude Code. Word and Markdown work the same way.</li>
<li><strong>Claude extracts the story.</strong> It pulls out the key points and numbers and finds the natural arc: the problem, what you found, what it means.</li>
<li><strong>Your data comes alive.</strong> Figures become bar charts, donuts, line charts and counters that draw on the exact word the narrator says them.</li>
<li><strong>Render and share.</strong> You get an MP4 in 16:9 for decks and web pages, or 9:16 for social.</li>
</ol>
<h2>Good fits</h2>
<ul>
<li>Quarterly or research reports turned into a 90-second summary</li>
<li>Product docs turned into a feature walkthrough</li>
<li>Internal updates people will actually watch</li>
<li>Course notes turned into an animated lesson</li>
</ul>
<h2>Already have an HTML page or deck?</h2>
<p>Use adopt mode: <code class="inline-code">/storyboard adopt page.html</code> narrates an existing page as it is, adding motion and timing without changing its styles.</p>
{related(('blog-post-to-video', 'Turn a blog post into a video'), ('claude-code-video-skill', 'How the Claude Code video skill works'), ('tour', 'Watch the 90-second tour'))}
'''
PAGES.append(('pdf-to-video', 'Turn a PDF Into an Explainer Video | Easy Storyboard',
              'Turn a PDF, Word or Markdown document into a narrated explainer video with charts that draw themselves. Free Claude Code skill, MP4 output.',
              'Turn a PDF into an explainer video', 'Reports, whitepapers and docs become short narrated videos, with your numbers drawn as charts right on cue.',
              pdf_body, [], 'PDF to video'))

# ---------------------------------------------------------------- /claude-code-video-skill
skill_body = f'''
<h2>What a Claude Code skill is</h2>
<p>A skill is a folder of instructions and tools that teaches Claude Code how to do a specialised job. Easy Storyboard adds one: <code class="inline-code">/storyboard</code>, which turns content into a narrated, animated video, with Claude doing the writing and the animation.</p>
<h2>The phases</h2>
<ol>
<li><strong>Concept.</strong> Picks a narrative shape, explores three creative directions, and maps an emotional-energy arc across the beats.</li>
<li><strong>Script.</strong> Narration timed to your target length, with pauses between beats and a machine-readable beats block.</li>
<li><strong>Voice.</strong> A free neural voice with exact slide cues and per-word timestamps, or ElevenLabs.</li>
<li><strong>Build.</strong> Claude choreographs <code class="inline-code">storyboard.html</code> on a motion engine with 110+ presets, springs, camera moves, 23 transitions, charts and rigged characters.</li>
<li><strong>Audit.</strong> A built-in quality gate catches invisible elements, broken timing, frozen beats and unreadable text.</li>
<li><strong>Render.</strong> Headless Chromium and ffmpeg produce the MP4.</li>
</ol>
<p>Every phase writes a plain file, so you can stop, edit and pick up where you left off.</p>
<h2>Commands</h2>
<div class="code-block"><pre><code>/storyboard https://your-page.com          # build from a URL
/storyboard ./report.pdf                   # from a PDF, .docx or .md
/storyboard adopt page.html                # narrate an existing HTML page
/storyboard concept &lt;input&gt;              # plan only
/storyboard --duration 60s --aspect 9:16   # length and vertical format</code></pre></div>
<h2>Requirements</h2>
<p>Claude Code, Python 3.9 or newer, and a few free packages: Playwright with Chromium, imageio-ffmpeg and edge-tts for the free voice. The bundled <code class="inline-code">doctor.py</code> checks everything and prints the exact fix for anything missing. See the <a class="text-link" href="/#install">install guide</a>.</p>
{related(('tour', 'Watch the 90-second tour'), ('animated-character-videos', 'Animated characters and rigging'), ('pdf-to-video', 'Turn a PDF into a video'))}
'''
PAGES.append(('claude-code-video-skill', 'A Claude Code Skill for Making Videos | Easy Storyboard',
              'Easy Storyboard is a free Claude Code skill: /storyboard plans, scripts, voices, animates, audits and renders narrated videos from your content.',
              'A Claude Code skill for making videos', 'Type <code class="inline-code">/storyboard</code> and Claude plans, writes, voices, animates and renders a finished MP4 from your content.',
              skill_body, [], 'Claude Code video skill'))

# ---------------------------------------------------------------- /animated-character-videos
acts = [('Gestures', 'wave, nod, jump, bounce, shrug, spin'),
        ('Moods', 'idle, happy, sad, surprised, think, wink'),
        ('Gaze and pointing', 'look=#selector, point=#selector, rest'),
        ('Speech', 'say=Text for a speech bubble (talks while it shows), talk, quiet')]
act_rows = ''.join(f'<tr><td>{a}</td><td><code class="inline-code">{html.escape(b)}</code></td></tr>' for a, b in acts)
char_body = f'''
{video_block('/media/character-rigging.mp4', '/media/character-rigging-poster.jpg', RIG['name'], 'Five characters on their own act timelines, rendered by the skill.', controls=False)}
<h2>A cast that acts on cue</h2>
<p>Characters are the fastest way to give an explainer a guide. In Easy Storyboard you place a character on a slide and give it a timeline of acts; it waves when the narrator says hello, looks at the chart being described, points at the number that matters and reacts when the punchline lands.</p>
<h2>The built-in cast</h2>
<ul>
<li><strong>Two people:</strong> <code class="inline-code">person</code> (modern flat) and <code class="inline-code">cutout</code> (construction paper). Choose skin (light, medium, tan, brown, deep), hair (short, long, curly, bun, buzz, cap, bald), hair colour and outfit colour.</li>
<li><strong>Seven mascots:</strong> blob, orb, bot, cat, ghost, star and bean, in any colour.</li>
<li><strong>Accessories:</strong> glasses, hat or bowtie.</li>
</ul>
<h2>Directing with a timeline</h2>
<p>One attribute holds the whole performance. Times are seconds from the slide's start:</p>
<div class="code-block"><pre><code>&lt;div class="anim" data-anim="character" data-char="person"
     data-skin="tan" data-hair="curly" data-color="#EC4899"
     data-acts="0.5:wave; 2:look=#chart; 3:point=#chart;
                4.3:happy; 5.2:say=It doubled!"&gt;&lt;/div&gt;</code></pre></div>
<table class="acts"><thead><tr><th>Act type</th><th>Commands</th></tr></thead><tbody>{act_rows}</tbody></table>
<p>Characters also blink, breathe and sway on their own between acts, and lip-sync rides the voice-over when <code class="inline-code">data-talk="1"</code> is set. Because every pose is computed from the timestamp, renders are frame-perfect and you can scrub backwards and forwards freely.</p>
<h2>Bring your own character</h2>
<ul>
<li><strong>Visual rigger.</strong> Open <code class="inline-code">rigger.html</code>, paste your SVG, drag the eye and mouth handles into place, preview the moods and export the result.</li>
<li><strong>JSON definitions.</strong> Register a character with <code class="inline-code">Storyboard.defineCharacter(def)</code> and check it with <code class="inline-code">validate_character.py</code>.</li>
<li><strong>Tag your own art.</strong> Mark the parts of an existing SVG (eyes, mouth, arms) and the engine animates them.</li>
</ul>
{related(('tour', 'Watch the 90-second tour'), ('claude-code-video-skill', 'How the Claude Code video skill works'), ('blog-post-to-video', 'Turn a blog post into a video'))}
'''
PAGES.append(('animated-character-videos', 'Animated Characters for Explainer Videos | Easy Storyboard',
              'Rigged characters for explainer videos: wave, point, look, react and talk on a timeline. Nine built-in characters or rig your own SVG.',
              'Animated characters for explainer videos', 'Direct a presenter or mascot like an actor: wave, look, point, react and talk along with the voice-over.',
              char_body, [video_obj(RIG)], 'Animated characters'))


def build():
    for slug, title, desc, h1, lead, body, schema, crumb in PAGES:
        assert len(title) <= 60, (slug, len(title))
        assert len(desc) <= 160, (slug, len(desc))
        (ROOT / f'{slug}.html').write_text(page(slug, title, desc, h1, lead, body, schema, crumb), encoding='utf-8')
        print(f'wrote {slug}.html  title={len(title)} desc={len(desc)}')

    # index.html: VideoObjects + analytics
    idx_p = ROOT / 'index.html'
    idx = idx_p.read_text(encoding='utf-8')
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', idx, re.S)
    data = json.loads(m.group(2))
    data['@graph'] = [n for n in data['@graph'] if n.get('@type') != 'VideoObject']
    data['@graph'] += [video_obj(TOUR), video_obj(RIG)]
    idx = idx[:m.start(2)] + '\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n    ' + idx[m.end(2):]
    if ANALYTICS not in idx:
        idx = idx.replace('</head>', f'    {ANALYTICS}\n</head>', 1)
    idx_p.write_text(idx, encoding='utf-8')
    print('index.html: VideoObject x2 + analytics')

    # sitemap with video extension
    def vid(v):
        return (f'<video:video><video:thumbnail_loc>{v["thumbnailUrl"]}</video:thumbnail_loc>'
                f'<video:title>{html.escape(v["name"])}</video:title><video:description>{html.escape(v["description"])}</video:description>'
                f'<video:content_loc>{v["contentUrl"]}</video:content_loc></video:video>')
    urls = [(f'{SITE}/', '1.0', [TOUR, RIG])] + [
        (f'{SITE}/{s}', '0.8', [TOUR] if s == 'tour' else [RIG] if s == 'animated-character-videos' else [])
        for s, *_ in PAGES]
    body = ''.join(f'  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod><priority>{p}</priority>{"".join(vid(v) for v in vs)}</url>\n'
                   for u, p, vs in urls)
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                                      'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' + body + '</urlset>\n', encoding='utf-8')
    print('sitemap.xml:', len(urls), 'urls')

    # llms.txt
    llms = f'''# Easy Storyboard

> Easy Storyboard is a free Claude Code skill. Type /storyboard and a link, PDF, Word/Markdown doc, pasted text or an existing HTML page, and Claude plans the story, writes the narration, voices it (free neural voice or ElevenLabs), choreographs every scene on a motion engine, audits it, and renders an MP4 on your machine. Built by Georges Rayess.

## Pages
- [Home]({SITE}/): overview, features, install guide, FAQ
- [90-second tour]({SITE}/tour): demo video made with the skill, with chapters and transcript
- [Claude Code video skill]({SITE}/claude-code-video-skill): what the skill is, its phases, commands and requirements
- [Blog post to video]({SITE}/blog-post-to-video): turn a blog post into a narrated video
- [PDF to video]({SITE}/pdf-to-video): turn a PDF, Word or Markdown doc into an explainer
- [Animated characters]({SITE}/animated-character-videos): rigged characters that wave, point, look, react and talk on a timeline

## Key facts
- Free download; runs inside Claude Code on Windows, macOS and Linux; needs Python 3.9+, Playwright/Chromium, imageio-ffmpeg; edge-tts for the free voice.
- Output: concept.md, script.md, storyboard.html, voiceover.mp3 and an MP4 in 16:9 or 9:16.
- Motion engine: 110+ presets, spring physics, 23 transitions, camera moves, charts, kinetic type, nine rigged characters, real 3D, sound effects.
- Source: https://github.com/gRAYESS123/storyboard-claude
- Author: Georges Rayess (https://georgesrayess.com)
'''
    (ROOT / 'llms.txt').write_text(llms, encoding='utf-8')
    print('llms.txt written')


if __name__ == '__main__':
    build()
