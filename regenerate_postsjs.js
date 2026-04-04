#!/usr/bin/env python3
"""
Regenerate posts.js from the actual static HTML files.
This completely replaces the broken posts.js with a clean version
that has proper excerpt fields (single-line, properly escaped)
and empty body fields (since all content is now in static HTML).
"""
import os
import re
import json

POSTS_DIR = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard/posts"
OUTPUT = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard/js/posts.js"

def extract_from_html(filename):
    """Extract post data from static HTML file."""
    filepath = os.path.join(POSTS_DIR, filename)
    if not os.path.exists(filepath):
        return None
    
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Extract title
    title_match = re.search(r'<h1>(.*?)</h1>', html)
    title = title_match.group(1).strip() if title_match else ""
    
    # Extract slug from filename
    slug = filename.replace('.html', '')
    
    # Extract image src from the hero image
    img_match = re.search(r'<img[^>]+class="article-hero"[^>]+src="([^"]+)"', html)
    image = img_match.group(1) if img_match else "/images/placeholder.jpg"
    
    # Extract category
    cat_match = re.search(r'<span[^>]*class="category-tag"[^>]*>(.*?)</span>', html)
    category = cat_match.group(1).strip() if cat_match else "World"
    
    # Extract date
    date_match = re.search(r'<div class="article-meta">([^<]+?)\s*&bull;', html)
    date = date_match.group(1).strip() if date_match else "N/A"
    
    # Extract author
    date_author = html.split('<div class="article-meta">')[1].split('</div>')[0] if '<div class="article-meta">' in html else ""
    if ' &bull; By ' in date_author:
        author = date_author.split(' &bull; By ')[1].strip()
    else:
        author = "Breaking News Boulevard"
    
    # Extract body content (just first 150 chars for excerpt)
    body_match = re.search(r'<div class="article-body">(.*?)</div>', html, re.DOTALL)
    if body_match:
        body_raw = body_match.group(1)
        # Strip HTML tags for excerpt
        excerpt_text = re.sub(r'<[^>]+>', ' ', body_raw)
        excerpt_text = re.sub(r'\s+', ' ', excerpt_text).strip()
        excerpt = excerpt_text[:155] + '...'
    else:
        excerpt = title
    
    url = f"/posts/{filename}"
    
    return {
        'slug': slug,
        'title': title,
        'excerpt': excerpt,
        'image': image,
        'category': category,
        'date': date,
        'author': author,
        'url': url,
    }

def escape_js_string(s):
    """Escape a string for use in JS double-quoted strings."""
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '\\r')
    s = s.replace('\t', '\\t')
    return s

# Get all post HTML files (exclude template)
html_files = sorted([f for f in os.listdir(POSTS_DIR) if f.endswith('.html') and f != 'article-template.html'])

posts = []
for filename in html_files:
    print(f"Processing {filename}...")
    post = extract_from_html(filename)
    if post:
        posts.append(post)
        print(f"  ✓ {post['title'][:60]}...")
    else:
        print(f"  ✗ Failed to extract from {filename}")

# Generate clean posts.js with empty body fields (content is in static HTML)
# Body is not needed since all posts are now static HTML
output = "// posts.js - Article database\n// Each post: { slug, title, excerpt, image, category, date, author, url }\n// NOTE: All post content is now in static HTML files - this is just for navigation\n\nconst posts = [\n"

for i, post in enumerate(posts):
    output += "  {\n"
    output += f'    slug: "{post["slug"]}",\n'
    output += f'    title: "{escape_js_string(post["title"])}",\n'
    output += f'    excerpt: "{escape_js_string(post["excerpt"])}",\n'
    output += f'    image: "{post["image"]}",\n'
    output += f'    category: "{post["category"]}",\n'
    output += f'    date: "{post["date"]}",\n'
    output += f'    author: "{post["author"]}",\n'
    output += f'    url: "{post["url"]}",\n'
    
    if i < len(posts) - 1:
        output += "  },\n"
    else:
        output += "  },\n"

output += "];\n"

with open(OUTPUT, 'w') as f:
    f.write(output)

print(f"\n✅ Generated posts.js with {len(posts)} posts ({len(output)} bytes)")
print(f"File: {OUTPUT}")
