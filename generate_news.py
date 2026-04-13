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
    prompt = "Write a short, engaging news article (breaking news style). Return only valid JSON: {'title': '...', 'excerpt': '...', 'body': '...'}"
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
            'body': 'Stay tuned for more details on this developing story.'
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
