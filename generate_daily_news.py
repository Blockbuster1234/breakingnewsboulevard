#!/usr/bin/env python3
"""
Generate a daily news post for breakingnewsboulevard.com
"""
import os
import re
import datetime
import subprocess
import sys
from pathlib import Path
import feedparser
import requests

# ----- CONFIG -----
BASE = Path.home() / '.openclaw' / 'workspace' / 'breakingnewsboulevard'
POSTS_JS = BASE / 'js' / 'posts.js'
IMAGES_DIR = BASE / 'images'
POSTS_DIR = BASE / 'posts'
TEMPLATE_FILE = POSTS_DIR / 'article-template.html'
ENV_FILE = Path.home() / '.env'

# Load OpenRouter API key
def load_api_key():
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith('OPENROUTER_API_KEY='):
                return line.split('=',1)[1].strip()
    return os.environ.get('OPENROUTER_API_KEY')

API_KEY = load_api_key()
if not API_KEY:
    print("Error: OPENROUTER_API_KEY not found")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

MODEL = "nvidia/nemotron-3-super-120b-a12b:free"  # verified working

def call_openrouter(prompt, max_tokens=800, temperature=0.7):
    data = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature
    }
    try:
        resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=HEADERS, json=data, timeout=30)
        if resp.status_code != 200:
            print(f"OpenRouter error: {resp.status_code} {resp.text[:200]}")
            return None
        return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Exception calling OpenRouter: {e}")
        return None

def fetch_news():
    """Fetch latest news from BBC World RSS"""
    feed_url = "http://feeds.bbci.co.uk/news/world/rss.xml"
    feed = feedparser.parse(feed_url)
    if not feed.entries:
        print("No entries found in feed")
        return None
    entry = feed.entries[0]
    return {
        "title": entry.title,
        "summary": entry.summary,
        "link": entry.link,
        "published": entry.get("published", "")
    }

def generate_article(news_item):
    prompt = f"""You are a professional journalist. Write a news article (400-500 words) based on the following information:

Title: {news_item['title']}
Summary: {news_item['summary']}
Source: {news_item['link']}

Write in a neutral, informative style. Include background context if possible. Do not mention that you are an AI. The article should be suitable for a news website."""
    return call_openrouter(prompt, max_tokens=800)

def generate_headline(news_item):
    prompt = f"Create a short, punchy headline (max 10 words) for the following news: {news_item['title']}"
    return call_openrouter(prompt, max_tokens=20)

def generate_excerpt(article):
    prompt = f"Write a 2-sentence excerpt summarizing the following article: {article}"
    return call_openrouter(prompt, max_tokens=100)

def determine_category(title):
    title_lower = title.lower()
    if any(word in title_lower for word in ["tech", "ai", "computer", "software", "internet", "gadget", "smartphone"]):
        return "Tech"
    elif any(word in title_lower for word in ["health", "medical", "disease", "virus", "hospital", "covid", "vaccine"]):
        return "Health"
    elif any(word in title_lower for word in ["sport", "football", "basketball", "baseball", "soccer", "tennis", "olympic"]):
        return "Sports"
    elif any(word in title_lower for word in ["business", "economy", "market", "stock", "finance", "trade", "company"]):
        return "Economy"
    elif any(word in title_lower for word in ["science", "research", "study", "discovery", "space", "nasa", "climate"]):
        return "Science"
    else:
        return "World"

def generate_slug(title):
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    # Limit length
    if len(slug) > 80:
        slug = slug[:80].rstrip('-')
    return slug

def fetch_image(query, save_path):
    """Fetch a free image from Unsplash source"""
    url = f"https://source.unsplash.com/featured/800x450?{query}"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(r.content)
            return True
        else:
            print(f"Failed to fetch image: {r.status_code} {r.text[:100]}")
    except Exception as e:
        print(f"Error fetching image: {e}")
    return False

def create_html_file(slug, title, article, image_url):
    """Create HTML file from template"""
    if not TEMPLATE_FILE.exists():
        print("Template file not found")
        return False
    template = TEMPLATE_FILE.read_text()
    # Replace placeholders
    # We assume the template has a placeholder {{content}} for the main article.
    # If not, we'll replace the first <article> tag or insert before </body>.
    if "{{content}}" in template:
        html = template.replace("{{content}}", f"<article>{article}</article>")
    elif "<div id=\"content\">" in template:
        html = template.replace("<div id=\"content\">", f"<div id=\"content\"><article>{article}</article>")
    else:
        # Fallback: insert before </body>
        html = template.replace("</body>", f"<article>{article}</article></body>")
    # Also add a hero image at the top of the article
    hero = f'<div style="width:100%;height:350px;background:url({image_url}) center/cover;border-radius:12px;margin-bottom:20px;"></div>'
    if "<article>" in html:
        html = html.replace("<article>", f"<article>{hero}", 1)
    else:
        # If no article tag, we'll just prepend hero to the body? Not ideal, but we'll do it.
        html = html.replace("<body>", f"<body>{hero}")
    # Write file
    out_path = POSTS_DIR / f"{slug}.html"
    out_path.write_text(html, encoding='utf-8')
    print(f"Created HTML file: {out_path}")
    return True

def update_posts_js(new_post_js):
    """Prepend new post to the posts array in posts.js"""
    if not POSTS_JS.exists():
        print("posts.js not found")
        return False
    content = POSTS_JS.read_text()
    # Find the array
    match = re.search(r'const posts = (\[[\s\S]*\]);', content)
    if not match:
        print("Could not find posts array")
        return False
    array_str = match.group(1)
    # We'll replace the array with new post + existing array
    # Extract the inner content between [ and ]
    inner_match = re.search(r'\[\s*([\s\S]*?)\s*\];', content)
    if not inner_match:
        print("Could not find inner array")
        return False
    inner = inner_match.group(1)  # everything between [ and ]
    # Construct new inner: new_post,\n + inner
    # Ensure new_post ends with a comma? In the file, each post ends with a comma.
    # Our new_post_js already includes the comma? We'll generate with a comma at the end.
    new_inner = new_post_js + ",\n" + inner
    new_array = f"const posts = [{new_inner}];"
    new_content = re.sub(r'const posts = \[[\s\S]*\];', new_array, content)
    POSTS_JS.write_text(new_content, encoding='utf-8')
    print("Updated posts.js")
    return True

def git_commit_push(slug, headline):
    os.chdir(BASE)
    # Add changed files
    subprocess.run(["git", "add", "js/posts.js"], check=False)
    subprocess.run(["git", "add", f"posts/{slug}.html"], check=False)
    # Also add the image if we fetched one
    image_file = IMAGES_DIR / f"{slug}.jpg"
    if image_file.exists():
        subprocess.run(["git", "add", f"images/{slug}.jpg"], check=False)
    # Commit
    commit_msg = f"Add news post: {headline}"
    result = subprocess.run(["git", "commit", "-m", commit_msg], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Commit failed: {result.stderr}")
        # Maybe nothing to commit?
        if "nothing to commit" in result.stdout:
            print("Nothing to commit")
            return False
        else:
            return False
    # Push
    result = subprocess.run(["git", "push"], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Push failed: {result.stderr}")
        return False
    print("Push successful")
    return True

def main():
    print("=== Starting news generation ===")
    # 1. Fetch news
    news = fetch_news()
    if not news:
        print("Failed to fetch news")
        return 1
    print(f"Fetched news: {news['title'][:60]}...")
    
    # 2. Generate article
    print("Generating article...")
    article = generate_article(news)
    if not article:
        print("Failed to generate article")
        return 1
    print(f"Article generated ({len(article)} chars)")
    
    # 3. Generate headline
    print("Generating headline...")
    headline = generate_headline(news)
    if not headline:
        print("Failed to generate headline, using fallback")
        headline = news['title'][:60]
    print(f"Headline: {headline}")
    
    # 4. Generate excerpt
    print("Generating excerpt...")
    excerpt = generate_excerpt(article)
    if not excerpt:
        print("Failed to generate excerpt, using first sentences")
        # Take first two sentences
        sentences = re.split(r'[.!?]+', article)
        excerpt = '. '.join(sentences[:2]) + '.' if len(sentences) >= 2 else article[:200]
    print(f"Excerpt: {excerpt[:100]}...")
    
    # 5. Determine category
    category = determine_category(news['title'])
    print(f"Category: {category}")
    
    # 6. Generate slug
    slug = generate_slug(news['title'])
    print(f"Slug: {slug}")
    
    # 7. Fetch image
    print("Fetching image...")
    image_query = slug.replace('-', ' ')  # use slug as query
    image_path = IMAGES_DIR / f"{slug}.jpg"
    success = fetch_image(image_query, image_path)
    if success:
        image_url = f"/images/{slug}.jpg"
        print(f"Image saved: {image_url}")
    else:
        # fallback to a default image if exists
        default_img = IMAGES_DIR / "default.jpg"
        if default_img.exists():
            image_url = "/images/default.jpg"
            print("Using default image")
        else:
            # use a placeholder from unsplash without saving? we need a local file.
            # Let's try to fetch and save anyway with a generic query
            success = fetch_image("news", image_path)
            if success:
                image_url = f"/images/{slug}.jpg"
            else:
                # last resort: use a placeholder from the existing images? use first image
                # get first image in images directory
                images = list(IMAGES_DIR.glob("*.jpg"))
                if images:
                    image_url = f"/images/{images[0].name}"
                    print(f"Using existing image: {image_url}")
                else:
                    print("No images available, continuing without image")
                    image_url = ""  # empty, but will break? we'll set to a placeholder
                    image_url = "/images/chuck-norris-legacy.jpg"  # hardcode fallback
    
    # 8. Create HTML file
    print("Creating HTML file...")
    if not create_html_file(slug, headline, article, image_url):
        print("Failed to create HTML file")
        return 1
    
    # 9. Build post JS object
    date = datetime.datetime.now().strftime("%B %d, %Y")
    body_html = "<p>" + article.replace("\n\n", "</p><p>") + "</p>"
    post_js = f'''  {{
    slug: "{slug}",
    title: "{headline}",
    excerpt: "{excerpt}",
    image: "{image_url}",
    category: "{category}",
    date: "{date}",
    author: "Breaking News Boulevard",
    url: "/posts/{slug}.html",
    body: `
{body_html}
  }}'''  # note: closing brace and comma will be added in update_posts_js
    
    # 10. Update posts.js
    print("Updating posts.js...")
    if not update_posts_js(post_js):
        print("Failed to update posts.js")
        return 1
    
    # 11. Git commit and push
    print("Committing and pushing...")
    if not git_commit_push(slug, headline):
        print("Failed to commit/push")
        return 1
    
    print("=== Success! ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())