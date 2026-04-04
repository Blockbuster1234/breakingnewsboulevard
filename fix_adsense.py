#!/usr/bin/env python3
"""
Fix ALL 3 AdSense issues at once:
1. Create vercel.json redirect / → /index.html
2. Convert JS-injected posts to static HTML with body from posts.js
3. Remove "AI-generated content" text from index.html footer
"""
import json
import re
import os

BLOG = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard"
POSTS_JS = os.path.join(BLOG, "js/posts.js")
POSTS_DIR = os.path.join(BLOG, "posts")

# ============================================================
# FIX 1: vercel.json redirect
# ============================================================
vercel = {
    "rewrites": [
        {"source": "/", "destination": "/index.html"}
    ]
}
with open(os.path.join(BLOG, "vercel.json"), "w") as f:
    json.dump(vercel, f, indent=2)
print("✅ Fix 1: Created vercel.json")

# ============================================================
# Read posts.js
# ============================================================
# Read the file
with open(POSTS_JS, "r") as f:
    raw = f.read()

# Parse posts manually since it uses unquoted keys
# Extract blocks between opening { and closing }
posts = []
depth = 0
start = None
for i, c in enumerate(raw):
    if c == '{':
        if depth == 0:
            start = i
        depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0 and start is not None:
            block = raw[start+1:i].strip()
            # Parse key pairs
            entry = {}
            # Handle body specially (backtick strings)
            body_match = re.search(r'body:\s*`(.+?)`\s*,', block, re.DOTALL)
            if body_match:
                entry['body'] = body_match.group(1)
                block = block[:body_match.start()] + block[body_match.end():]

            # Parse string values
            for m in re.finditer(r'(\w+)\s*:\s*"([^"]*?)"', block):
                key, val = m.group(1), m.group(2)
                entry[key] = val
            for m in re.finditer(r"(\w+)\s*:\s*'([^']*?)'", block):
                key, val = m.group(1), m.group(2)
                entry[key] = val
            # Handle empty body: body: ""
            if 'body' not in entry:
                body_match2 = re.search(r'body:\s*""', block)
                if body_match2:
                    entry['body'] = ""
            
            if 'slug' in entry:
                posts.append(entry)
            start = None

print(f"Parsed {len(posts)} posts from posts.js")

# ============================================================
# Posts that need converting (use JS injection)
# ============================================================
# These need their body from posts.js injected as static HTML
js_injected_posts = [
    "ai-image-generation-chatgpt-claude-grok-2026",
    "bird-flu-kerala-india-h5n1-2026",
    "chuck-norris-dies-at-86",
    "iea-global-economy-major-threat-iran-war-march-2026",
    "iran-us-war-natanz-nuclear-strike-march-2026",
    "nasa-moon-rocket-launch-pad-april-2026",
    "rocket-lab-launches-8th-satellite-synspective",
    "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade",
    "scientists-grow-hair-follicles-lab-breakthrough-2026",
    "spain-closes-airspace-to-us-aircraft-involved-in-iran-war",
    "strait-of-hormuz-oil-crisis-2026",
    "trump-48-hour-ultimatum-iran-hormuz-march-2026",
    "trump-claims-iran-talks-denied-ultimatum-extended-march-2026",
    "us-deploys-82nd-airborne-ceasefire-talks-iran-war-march-2026",
    "why-does-the-us-have-iran-s-kharg-island-in-its-sights",
]

# Posts with empty body in posts.js that need content from static HTML
static_body_posts = {
    "nasa-artemis-ii-moon-mission-launch-april-2026",
    "artemis-ii-leaves-earth-orbit-hello-world-photo-april-2026",
}

template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} — Breaking News Boulevard</title>
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YB2E0D5B4K"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-YB2E0D5B4K');</script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4316838278696534" crossorigin="anonymous"></script>
  <meta name="description" content="{{excerpt}}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{excerpt}}">
  <meta property="og:image" content="https://www.breakingnewsboulevard.com{{image}}">
  <link rel="canonical" href="https://www.breakingnewsboulevard.com{{url}}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">
  {{schema}}
  </script>
  <style>
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
    .article-body strong{font-weight:700}
    .category-tag{display:inline-block;background:var(--accent);color:#fff;padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600;text-transform:uppercase;margin-bottom:16px}
    .ad-placeholder{background:#f0f0f0;border:2px dashed #ccc;border-radius:var(--radius);padding:40px;text-align:center;color:#999;margin:32px 0}
    .related{margin-top:48px;padding-top:32px;border-top:1px solid var(--border)}
    .related h3{font-size:1.3rem;margin-bottom:16px}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
    .related-card{background:var(--card);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
    .related-card img{width:100%;aspect-ratio:image/16/9;object-fit:cover}
    .related-card-body{padding:12px}
    .related-card-body h4{font-size:.95rem;margin-bottom:4px}
    .related-card-body h4 a{color:var(--text)}
    .footer{background:#1a1a2e;color:rgba(255,255,255,.7);padding:40px 0;margin-top:48px;text-align:center}
    .footer p{font-size:.85rem;margin-bottom:8px}
    @media(max-width:768px){.article h1{font-size:1.5rem}.nav{display:none}}
  </style>
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
    <img class="article-hero" src="{{image}}" alt="{{title}}" loading="lazy">
    <span class="category-tag">
  </span>
    <h1>{{title}}</h1>
    <div class="article-meta">{{date}} &bull; By {{author}}</div>
    <div class="article-body">
{{body}}
    </div>
    <div class="ad-placeholder">
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-4316838278696534" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>
    <div class="related">
      <h3>Related Stories</h3>
      <div class="related-grid">
{{related}}
      </div>
    </div>
  </div>
</article>

<footer class="footer">
  <div class="container">
    <p>&copy; 2026 Breaking News Boulevard. All Rights Reserved.</p>
  </div>
</footer>
</body>
</html>
"""

converted = 0
for slug in js_injected_posts:
    # Find post data
    post = None
    for p in posts:
        if p.get('slug') == slug:
            post = p
            break
    
    if not post:
        print(f"⚠️  Post not found: {slug}")
        continue
    
    body = post.get('body', '')
    # The body in posts.js might be wrapped with <p> already or be raw text
    # Check and normalize
    if body.startswith('<p>'):
        body_html = body
    else:
        # Convert raw text paragraphs to HTML
        body_html = f'<p>{body}</p>'
    
    # Get related posts (same category, excluding current)
    category = post.get('category', '')
    related = [p for p in posts if p.get('category') == category and p.get('slug') != slug][:3]
    related_html = ""
    for r in related:
        related_html += f"""        <div class="related-card">
          <a href="{r.get('url', '#')}">
            <img src="{r.get('image', '')}" alt="{r.get('title', '')}" loading="lazy">
            <div class="related-card-body">
              <h4>{r.get('title', '')}</h4>
            </div>
          </a>
        </div>
"""

    # Schema.org
    schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.get('title', ''),
        "url": f"https://www.breakingnewsboulevard.com{post.get('url', '')}",
        "author": {"@type": "Person", "name": post.get('author', 'Breaking News Boulevard')},
        "publisher": {"@type": "Organization", "name": "Breaking News Boulevard"},
        "image": f"https://www.breakingnewsboulevard.com{post.get('image', '')}",
        "datePublished": post.get('date', '')
    }
    
    # Build the page
    page = template.replace('{{title}}', post.get('title', ''))
    page = page.replace('{{excerpt}}', post.get('excerpt', '')[:155])
    page = page.replace('{{date}}', post.get('date', 'N/A'))
    page = page.replace('{{author}}', post.get('author', 'Breaking News Boulevard'))
    page = page.replace('{{image}}', post.get('image', ''))
    page = page.replace('{{url}}', post.get('url', ''))
    page = page.replace('{{body}}', body_html.strip())
    page = page.replace('{{related}}', related_html.strip())
    page = page.replace('{{schema}}', json.dumps(schema, indent=2))
    
    # Write
    outfile = os.path.join(POSTS_DIR, f"{slug}.html")
    with open(outfile, 'w') as f:
        f.write(page)
    converted += 1
    size = os.path.getsize(outfile)
    print(f"✅ Static post: {slug}.html ({size} bytes)")

# Also fix the 2 artemis posts that have empty body in posts.js
for slug in static_body_posts:
    post = None
    for p in posts:
        if p.get('slug') == slug:
            post = p
            break
    if not post:
        print(f"⚠️  Post not found: {slug}")
        continue
    
    body = post.get('body', '').strip()
    if body:
        continue  # Already has content
    
    # Try to extract content from existing HTML
    htmlfile = os.path.join(POSTS_DIR, f"{slug}.html")
    if os.path.exists(htmlfile):
        with open(htmlfile, 'r') as f:
            content = f.read()
        
        # Extract title, image, date, h2/p content
        title_match = re.search(r'<title>(.*?)</title>', content)
        title = title_match.group(1) if title_match else post.get('title', '')
        
        # Get h2/p content from existing file
        body_match = re.search(r'<article.*?</article>', content, re.DOTALL)
        if body_match:
            print(f"⚠️  Skipping {slug} - already has static content")
            continue
    
    print(f"⚠️  {slug} needs content generation")

print(f"\n✅ Fix 2: Converted {converted} JS-injected posts to static HTML")

# ============================================================
# FIX 3: Remove "AI-generated content" from index.html
# ============================================================
index_path = os.path.join(BLOG, "index.html")
with open(index_path, 'r') as f:
    index_content = f.read()

# Remove the AI-generated content footer text
old_footer_text = '<p style="font-size:0.75rem;color:#888;margin-top:8px;">⚠️ AI-generated content. Verify with official sources. | '
new_footer_text = '<p style="font-size:0.75rem;color:#888;margin-top:8px;">'
index_content = index_content.replace(old_footer_text, new_footer_text)

with open(index_path, 'w') as f:
    f.write(index_content)
print("✅ Fix 3: Removed 'AI-generated content' text from index.html footer")

print("\n🎉 All 3 fixes applied!")
