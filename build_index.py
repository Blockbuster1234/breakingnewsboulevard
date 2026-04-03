#!/usr/bin/env python3
"""Generate static HTML index.html from posts.js for AdSense compatibility."""
import re

with open('js/posts.js', 'r') as f:
    raw = f.read()

# Parse articles - find each block by brace matching
articles = []
pos = 0
while True:
    start = raw.find('slug:', pos)
    if start == -1:
        break
    brace_start = raw.rfind('{', pos, min(start + 1, len(raw)))
    if brace_start == -1:
        pos = start + 5
        continue
    depth = 0; in_str = False; str_char = None; in_bt = False; i = brace_start
    while i < len(raw):
        c = raw[i]
        if c == '`' and not in_str: in_bt = not in_bt
        elif c in ('"', "'") and not in_bt:
            if i > 0 and raw[i-1] == '\\': pass
            elif not in_str: in_str = True; str_char = c
            elif c == str_char: in_str = False; str_char = None
        elif not in_str and not in_bt:
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    block = raw[brace_start:i+1]
                    def gf(name):
                        m = re.search(rf'{name}:\s*"(.*?)"', block, re.DOTALL)
                        if m: return m.group(1)
                        m = re.search(rf"{name}:\s*'(.+?)'", block, re.DOTALL)
                        if m: return m.group(1).strip()
                        return ''
                    slug = gf('slug'); title = gf('title'); exc = gf('excerpt')
                    img = gf('image'); cat = gf('category'); dt = gf('date')
                    auth = gf('author'); url = gf('url')
                    if slug and title:
                        articles.append({'slug': slug, 'title': title, 
                            'excerpt': ' '.join(exc.split()),
                            'image': img, 'category': cat, 'date': dt,
                            'author': auth, 'url': url})
                    break
        i += 1
    pos = i + 1

print(f"Parsed {len(articles)} articles")
for a in articles: 
    print(f"  {a['date']} - {a['title'][:60]}")

feat = articles[0]
grid = articles[1:10]

# Build ticker
ticker = ' — '.join([a['title'] for a in articles[:5]])

# Featured HTML
feat_html = f'''  <section id="featured" class="featured">
    <div class="container">
      <div class="featured-card">
        <img src="{feat['image']}" alt="{feat['title']}" loading="lazy">
        <div class="featured-body">
          <span class="card-category">{feat['category']}</span>
          <h2><a href="{feat['url']}">{feat['title']}</a></h2>
          <p>{feat['excerpt']}</p>
          <div class="card-meta">{feat['date']} &bull; By {feat['author']}</div>
        </div>
      </div>
    </div>
  </section>'''

# Grid cards
grid_lines = []
for p in grid:
    card = f'''        <article class="card">
          <img class="card-img" src="{p['image']}" alt="{p['title']}" loading="lazy">
          <div class="card-body">
            <span class="card-category">{p['category']}</span>
            <h2><a href="{p['url']}">{p['title']}</a></h2>
            <p>{p['excerpt']}</p>
            <div class="card-meta">{p['date']}</div>
          </div>
        </article>'''
    grid_lines.append(card)
grid_html = '\n'.join(grid_lines)

# Read CSS and structure from old index.html  
with open('index.html', 'r') as f:
    raw_html = f.read()

# Extract everything between <style> and </style>
css_match = re.search(r'<style[^>]*>(.*?)</style>', raw_html, re.DOTALL)
css = css_match.group(1) if css_match else ''

# Build complete static HTML
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Breaking News Boulevard — Latest News & Analysis</title>
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YB2E0D5B4K"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-YB2E0D5B4K');</script>
  <meta name="description" content="Your source for breaking news, analysis, and trending stories from around the world. Stay informed with daily updates.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Breaking News Boulevard">
  <meta property="og:description" content="Your source for breaking news, analysis, and trending stories from around the world.">
  <link rel="canonical" href="https://www.breakingnewsboulevard.com/">
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Breaking News Boulevard",
    "url": "https://www.breakingnewsboulevard.com/",
    "description": "Your source for breaking news, analysis, and trending stories.",
    "publisher": {{
      "@type": "Organization",
      "name": "Breaking News Boulevard"
    }}
  }}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
  <style>
{css}
  </style>
</head>
<body>
  <!-- HEADER -->
  <header class="header">
    <div class="container">
      <div class="header-inner">
        <div class="logo"><a href="/">🔴 Breaking News Boulevard</a></div>
        <nav class="nav">
          <a href="/">Home</a>
          <a href="/about.html">About</a>
          <a href="/impressum.html">Impressum</a>
        </nav>
      </div>
    </div>
  </header>

  <!-- BREAKING NEWS TICKER -->
  <div class="ticker">
    <div class="ticker-inner">
      <span class="ticker-label">🔴 BREAKING</span>
      <span id="ticker-text">{ticker}</span>
    </div>
  </div>

  <!-- HERO -->
  <section class="hero">
    <div class="container">
      <h1>Breaking News Boulevard</h1>
      <p>Your source for breaking news, in-depth analysis, and stories that matter.</p>
    </div>
  </section>

{feat_html}

  <!-- Ad Slot 1 -->
  <div style="max-width:1200px;margin:32px auto;padding:0 20px;">
    <ins class="adsbygoogle"
         style="display:block;min-height:100px;"
         data-ad-client="ca-pub-4316838278696534"
         data-ad-slot=""
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
  </div>

  <!-- ARTICLES GRID -->
  <section id="articles" class="articles">
    <div class="container">
      <h2 class="section-title">Latest Articles</h2>
      <div class="grid" id="articles-grid">
{grid_html}
      </div>
    </div>
  </section>

  <!-- Ad Slot 2 (bottom) -->
  <div style="max-width:1200px;margin:32px auto;padding:0 20px;">
    <ins class="adsbygoogle"
         style="display:block;min-height:100px;"
         data-ad-client="ca-pub-4316838278696534"
         data-ad-slot=""
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
  </div>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <p>&copy; 2026 Breaking News Boulevard. All Rights Reserved. | <a href="/impressum.html" style="color: #e94560;">Impressum</a> | <a href="/datenschutz.html" style="color: #e94560;">Datenschutz</a> | <a href="/about.html" style="color: #e94560;">About</a></p>
    </div>
  </footer>

  <!-- AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4316838278696534" crossorigin="anonymous"></script>
  <script>
  // AdSense init
  (function() {{
    var ad = window.adsbygoogle || [];
    ad.push({{}});
  }})();
  </script>
</body>
</html>
'''

with open('index.html', 'w') as f:
    f.write(html)

print(f"\n✅ Static index.html generated!")
print(f"   1 featured article + {len(grid)} grid cards")
print(f"   2 AdSense slots placed")
print(f"   Fully server-side rendered - NO JS needed for content")
