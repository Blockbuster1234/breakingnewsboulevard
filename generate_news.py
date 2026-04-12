import os
import json
import random
import subprocess
from datetime import datetime
import openai

# Config
BASE_DIR = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard"
POSTS_JS = os.path.join(BASE_DIR, "js", "posts.js")

# Get API key from .bashrc

api_key = os.environ.get("OPENROUTER_API_KEY")

client = openai.OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1"
)

def generate_article():
    prompt = "Write a short, engaging news article (breaking news style) about a fictional or current geopolitical event. Return only the JSON: {'title': '...', 'excerpt': '...', 'body': '...'}"
    response = client.chat.completions.create(
        model="google/gemini-2.5-flash-lite",
        messages=[{"role": "user", "content": prompt}],
    )
    print(response.choices[0].message.content); return json.loads(response.choices[0].message.content.replace("```json", "").replace("```", "").strip())

def update_posts_js(new_post):
    with open(POSTS_JS, 'r') as f:
        content = f.read()
    
    # Simple injection - assumes content starts with "const posts = ["
    # We strip the closing "];" and append the new post
    header = "const posts = ["
    if header in content:
        parts = content.split(header)
        post_data = json.dumps(new_post)
        # Fix escaping for JS compatibility (use single quotes)
        # This is a naive fix, in production use a better parser
        updated = f"{header}\n{post_data},\n" + parts[1]
        with open(POSTS_JS, 'w') as f:
            f.write(updated)

def main():
    post = generate_article()
    slug = post['title'].lower().replace(' ', '-').replace("'", "")
    post['slug'] = slug
    post['date'] = datetime.now().strftime('%Y-%m-%d')
    post['url'] = f'/posts/{slug}.html'
    
    # Save HTML
    with open(os.path.join(BASE_DIR, 'posts', f'{slug}.html'), 'w') as f:
        f.write(f"<h1>{post['title']}</h1><p>{post['body']}</p>")
        
    update_posts_js(post)
    
    # Git
    os.system(f"cd {BASE_DIR} && git add . && git commit -m 'Auto: {slug}' && git push")

if __name__ == "__main__":
    main()
