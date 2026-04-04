#!/usr/bin/env python3
"""Generate static HTML for the 2 empty posts from posts.js body content."""
import re
import os
import json as json_mod

filepath = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard/js/posts.js"
BLOG = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard"

with open(filepath, "r") as f:
    content = f.read()

def extract_post(slug_from_js):
    block_pattern = r'slug:\s*"' + re.escape(slug_from_js) + r'"[\s\S]*?body:\s*`([\s\S]*?)`\s*\n\s*\}'
    m = re.search(block_pattern, content)
    if not m:
        return None
    block_pre = re.search(r'slug:\s*"' + re.escape(slug_from_js) + r'"[\s\S]*', content)
    block = block_pre.group(0)[:block_pre.group(0).find('body:') + len('body:') + m.start(1) + len(m.group(1)) + 15]

    def get_field(name):
        fm = re.search(r'\b' + name + r':\s*"([^"]*)"', block)
        return fm.group(1) if fm else ""

    return {
        'slug': get_field('slug'),
        'title': get_field('title'),
        'excerpt': get_field('excerpt'),
        'image': get_field('image'),
        'category': get_field('category'),
        'date': get_field('date'),
        'author': get_field('author'),
        'url': get_field('url'),
        'body': m.group(1).strip(),
    }

def render_post(p):
    import html
    schema = json_mod.dumps({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": p['title'],
        "url": "https://www.breakingnewsboulevard.com" + p['url'],
        "author": {"@type": "Person", "name": p["author"]},
        "publisher": {"@type": "Organization", "name": "Breaking News Boulevard"},
        "image": "https://www.breakingnewsboulevard.com" + p["image"],
        "datePublished": p["date"]
    }, indent=2)

    excerpt_clean = p["excerpt"][:155].replace('"', "'")
    title_esc = html.escape(p["title"])

    # Use str.format() to avoid f-string brace issues in CSS
    css = r"""
    :root{--bg:#fff;--text:#1a1a2e;--text-light:#666;--accent:#2563eb;--accent-hover:#1d4ed8;--border:#e5e7eb;--card:#f8f9fa;--radius:12px;--shadow:0 2px 8px rgba(0,0,0,.08)}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.8}
    a{color:var(--accent);text-decoration:none;transition:color .2s}
    a:hover{color:var(--accent-hover)}
    img{max-width:100%;height:auto;display:block}
    .container{max-width:800px;margin:0 auto;padding:0 20px}
    .header{background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;background:rgba(255,255,255,.97);backdrop-filter:blur(12px)}
    .header-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 20px}
    .logo{font-size:1.4rem;font-weight:800}
    .logo a{color:var(--text)}
    .logo a:hover{color:var(--accent)}
    .nav{display:flex;gap:24px}
    .nav a{color:var(--text-light);font-weight:500;font-size:.9rem}
    .nav a:hover{color:var(--accent)}
    .article{padding:48px 0}
    .article-hero{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);margin-bottom:32px;background:#e5e7eb}
    .article h1{font-size:2rem;font-weight:800;line-height:1.2;margin-bottom:16px;font-family:'Merriweather',serif}
    .article-meta{color:var(--text-light);font-size:.9rem;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid var(--border)}
    .article-body{font-size:1.05rem}
    .article-body p{margin-bottom:1.3em}
    .article-body h2{font-size:1.4rem;margin:2em 0 .6em;font-weight:700}
    .article-body h3{font-size:1.2rem;margin:1.5em 0 .5em;font-weight:600}
    .article-body img{border-radius:var(--radius);margin:1.5em 0}
    .article-body ul,.article-body ol{margin:1em 0 1.5em 1.5em}
    .article-body li{margin-bottom:.5em}
    .article-body blockquote{border-left:4px solid var(--accent);padding:12px 20px;background:var(--card);border-radius:0 var(--radius) var(--radius) 0;margin:1.5em 0}
    .category-tag{display:inline-block;background:var(--accent);color:#fff;padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600;text-transform:uppercase;margin-bottom:16px}
    .ad-placeholder{background:#f0f0f0;border:2px dashed #ccc;border-radius:var(--radius);padding:40px;text-align:center;color:#999;margin:32px 0}
    .footer{background:#1a1a2e;color:rgba(255,255,255,.7);padding:40px 0;margin-top:48px;text-align:center}
    .footer p{font-size:.85rem;margin-bottom:8px}
    @media(max-width:768px){.article h1{font-size:1.5rem}.nav{display:none}}
    """

    page = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Breaking News Boulevard</title>
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YB2E0D5B4K"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-YB2E0D5B4K');</script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4316838278696534" crossorigin="anonymous"></script>
  <meta name="description" content="{excerpt}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{excerpt}">
  <meta property="og:image" content="https://www.breakingnewsboulevard.com{image}">
  <link rel="canonical" href="https://www.breakingnewsboulevard.com{url}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">
  {schema}
  </script>
  <style>{css}</style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <div class="logo"><a href="/">Breaking News Boulevard</a></div>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/category/world.html">World</a>
      <a href="/category/tech.html">Tech</a>
      <a href="/category/health.html">Health</a>
      <a href="/category/science.html">Science</a>
    </nav>
  </div>
</header>

<article class="article">
  <div class="container">
    <img class="article-hero" src="{image}" alt="{title}" loading="lazy">
    <span class="category-tag">{category}</span>
    <h1>{title}</h1>
    <div class="article-meta">{date} &bull; By {author}</div>
    <div class="article-body">
{body}
    </div>
    <div class="ad-placeholder">
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-4316838278696534" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>
  </div>
</article>

<footer class="footer">
  <div class="container">
    <p>&copy; 2026 Breaking News Boulevard. All Rights Reserved.</p>
  </div>
</footer>
</body>
</html>"""

    return page.format(
        css=css,
        schema=schema,
        title=title_esc,
        excerpt=excerpt_clean,
        image=p["image"],
        url=p["url"],
        body=p["body"],
        category=p["category"],
        date=p["date"],
        author=p["author"],
    )

# Fix the 2 empty posts
for slug in ['ai-image-generation-chatgpt-claude-grok-2026', 'iea-global-economy-major-threat-iran-war-march-2026']:
    p = extract_post(slug)
    if not p:
        print("❌ Could not extract " + slug + " from posts.js")
        continue

    html_content = render_post(p)
    outfile = BLOG + "/posts/" + slug + ".html"
    with open(outfile, "w") as f:
        f.write(html_content)

    size = len(html_content)
    h2_count = html_content.count("<h2>")
    print("✅ " + slug + ".html (" + str(size) + " bytes, " + str(h2_count) + " sections)")

print("\nDone!")
