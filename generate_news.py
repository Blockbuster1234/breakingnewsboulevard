import os
import json
import random
import subprocess
import re
from datetime import datetime
import openai

# Config
BASE_DIR = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard"
POSTS_JS = os.path.join(BASE_DIR, "js", "posts.js")

# Securely load API key from file
def get_api_key():
    with open(os.path.join(BASE_DIR, ".api_key"), "r") as f:
        return f.read().strip()

client = openai.OpenAI(
    api_key=get_api_key(),
    base_url="https://openrouter.ai/api/v1"
)

def generate_article():
    prompt = "Write a short, engaging news article (breaking news style). Return only valid JSON: {'title': '...', 'excerpt': '...', 'body': '...'}"
    response = client.chat.completions.create(
        model="google/gemini-2.5-flash-lite",
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(response.choices[0].message.content.replace("```json", "").replace("```", "").strip())

def update_posts_js(new_post):
    with open(POSTS_JS, 'r') as f:
        content = f.read()

    match = re.search(r'const posts = \[(.*?)\];', content, re.DOTALL)
    entries = []
    if match:
        raw_entries = match.group(1).strip()
        if raw_entries:
            entries = [b.strip() + "}" for b in raw_entries.split("},") if b.strip()]

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

def main():
    post = generate_article()
    slug = post['title'].lower().replace(' ', '-').replace("'", "")
    post['slug'] = slug
    post['date'] = datetime.now().strftime('%Y-%m-%d')
    post['url'] = f'/posts/{slug}.html'
    
    with open(os.path.join(BASE_DIR, 'posts', f'{slug}.html'), 'w') as f:
        f.write(f"<h1>{post['title']}</h1><p>{post['body']}</p>")
        
    update_posts_js(post)
    os.system(f"cd {BASE_DIR} && git add . && git commit -m 'Auto: {slug}' && git push")

if __name__ == "__main__":
    main()
