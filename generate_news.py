import os
import json
import random
import subprocess
import re
from datetime import datetime
import openai

# Config
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSTS_JS = os.path.join(BASE_DIR, "js", "posts.js")

# Securely load API key from file
def get_api_key():
    api_key_path = os.path.join(BASE_DIR, ".api_key")
    if not os.path.exists(api_key_path):
        # Fallback for development if .api_key is missing
        return os.environ.get("OPENROUTER_API_KEY", "")
    with open(api_key_path, "r") as f:
        return f.read().strip()

client = openai.OpenAI(
    api_key=get_api_key(),
    base_url="https://openrouter.ai/api/v1"
)

def generate_article():
    prompt = "Write a short, engaging news article (breaking news style). Return only valid JSON: {'title': '...', 'excerpt': '...', 'body': '...', 'category': '...'}"
    response = client.chat.completions.create(
        model="google/gemini-2.0-flash-001",
        messages=[{"role": "user", "content": prompt}],
    )
    content = response.choices[0].message.content.strip()

    # Robustly extract JSON from the response
    try:
        # Search for something that looks like a JSON object
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            return json.loads(json_str)
        else:
            return json.loads(content)
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Error parsing AI response as JSON: {e}")
        print(f"Original content: {content}")
        # Fallback empty structure
        return {
            'title': 'News Update',
            'excerpt': 'Latest updates from Breaking News Boulevard.',
            'body': 'Stay tuned for more details on this developing story.',
            'category': 'World'
        }

def update_posts_js(new_post):
    try:
        with open(POSTS_JS, 'r') as f:
            content = f.read()

        # Extract the array content. We search for the first '[' and the last ']'
        # to handle potentially nested objects if the structure becomes more complex.
        start_idx = content.find('[')
        end_idx = content.rfind(']')

        if start_idx == -1 or end_idx == -1:
            print("Error: Could not find posts array in posts.js")
            return

        array_content = content[start_idx+1:end_idx].strip()

        # We'll use a more robust approach: parse the existing entries by splitting on '},'
        # but only if they are not inside strings. For simplicity here, we'll keep it
        # string-based but fix the double-brace issue.

        entries = []
        if array_content:
            # Clean up the array content to remove extra braces or trailing commas
            # and split into individual objects.
            raw_entries = re.split(r'},\s*{', array_content)
            for entry in raw_entries:
                entry = entry.strip()
                if not entry.startswith('{'): entry = '{' + entry
                if not entry.endswith('}'): entry = entry + '}'
                # Remove any accidentally doubled closing braces
                entry = entry.replace('}}', '}')
                entries.append(entry)

        new_entry = (
            "  {\n"
            "    slug: '" + new_post['slug'] + "',\n"
            "    title: '" + new_post['title'].replace("'", "\\'") + "',\n"
            "    excerpt: '" + new_post['excerpt'].replace("'", "\\'") + "',\n"
            "    date: '" + new_post['date'] + "',\n"
            "    body: '" + new_post['body'].replace("'", "\\'").replace("\n", " ") + "',\n"
            "    url: '/posts/" + new_post['slug'] + ".html'\n"
            "  }"
        )
        entries.append(new_entry)

        output = "const posts = [\n" + ",\n".join(entries) + "\n];"
        with open(POSTS_JS, 'w') as f:
            f.write(output)
    except Exception as e:
        print(f"Error updating posts.js: {e}")

def generate_post_html(post):
    """Generate a full static HTML page for the post."""
    from html import escape

    title = post['title']
    body = post['body']
    excerpt = post['excerpt']
    category = post.get('category', 'World')
    date_str = post['date']
    url = post['url']

    # Build Schema.org
    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "url": f"https://www.breakingnewsboulevard.com{url}",
        "author": {"@type": "Person", "name": "Breaking News Boulevard"},
        "publisher": {"@type": "Organization", "name": "Breaking News Boulevard"},
        "datePublished": date_str
    }, indent=2)

    # Body with paragraph conversion and escaping
    body_html = "".join([f"<p>{escape(p.strip())}</p>" for p in body.split("\n") if p.strip()])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)} — Breaking News Boulevard</title>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YB2E0D5B4K"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-YB2E0D5B4K');</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4316838278696534" crossorigin="anonymous"></script>
  <meta name="description" content="{escape(excerpt[:155])}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(excerpt[:155])}">
  <link rel="canonical" href="https://www.breakingnewsboulevard.com{url}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">
  {schema}
  </script>
  <style>
    :root{{--bg:#fff;--text:#1a1a2e;--text-light:#666;--accent:#2563eb;--accent-hover:#1d4ed8;--border:#e5e7eb;--card:#f8f9fa;--radius:12px;--shadow:0 2px 8px rgba(0,0,0,.08)}}
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.8}}
    a{{color:var(--accent);text-decoration:none;transition:color .2s}}
    a:hover{{color:var(--accent-hover)}}
    img{{max-width:100%;height:auto;display:block}}
    .container{{max-width:800px;margin:0 auto;padding:0 20px}}
    .header{{background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;background:rgba(255,255,255,.97);backdrop-filter:blur(12px)}}
    .header-inner{{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 20px}}
    .logo{{font-size:1.4rem;font-weight:800}}
    .logo a{{color:var(--text)}}
    .logo a:hover{{color:var(--accent)}}
    .nav{{display:flex;gap:24px}}
    .nav a{{color:var(--text-light);font-weight:500;font-size:.9rem}}
    .nav a:hover{{color:var(--accent)}}
    .article{{padding:48px 0}}
    .article h1{{font-size:2rem;font-weight:800;line-height:1.2;margin-bottom:16px;font-family:'Merriweather',serif}}
    .article-meta{{color:var(--text-light);font-size:.9rem;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid var(--border)}}
    .article-body{{font-size:1.05rem}}
    .article-body p{{margin-bottom:1.3em}}
    .article-body h2{{font-size:1.4rem;margin:2em 0 .6em;font-weight:700}}
    .category-tag{{display:inline-block;background:var(--accent);color:#fff;padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600;text-transform:uppercase;margin-bottom:16px}}
    .ad-placeholder{{background:#f0f0f0;border:2px dashed #ccc;border-radius:var(--radius);padding:40px;text-align:center;color:#999;margin:32px 0}}
    .footer{{background:#1a1a2e;color:rgba(255,255,255,.7);padding:40px 0;margin-top:48px;text-align:center}}
    .footer p{{font-size:.85rem;margin-bottom:8px}}
    @media(max-width:768px){{.article h1{{font-size:1.5rem}}.nav{{display:none}}}}
  </style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <div class="logo"><a href="/">Breaking News Boulevard</a></div>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about.html">About</a>
      <a href="/impressum.html">Impressum</a>
    </nav>
  </div>
</header>

<article class="article">
  <div class="container">
    <span class="category-tag">{escape(category)}</span>
    <h1>{escape(title)}</h1>
    <div class="article-meta">{escape(date_str)} &bull; By Breaking News Boulevard</div>
    <div class="article-body">
      {body_html}
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
    return html

def main():
    post = generate_article()

    # Robust slug generation
    slug = post['title'].lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')

    post['slug'] = slug
    post['date'] = datetime.now().strftime('%Y-%m-%d')
    post['url'] = f'/posts/{slug}.html'
    
    html_content = generate_post_html(post)

    posts_dir = os.path.join(BASE_DIR, 'posts')
    if not os.path.exists(posts_dir):
        os.makedirs(posts_dir)

    with open(os.path.join(posts_dir, f'{slug}.html'), 'w') as f:
        f.write(html_content)
        
    update_posts_js(post)

    # Commit changes if any
    os.system(f"cd {BASE_DIR} && git add . && git commit -m 'Auto: {slug}' && git push")

if __name__ == "__main__":
    main()
