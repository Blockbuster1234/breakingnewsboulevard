import re
with open('js/posts.js', 'r', encoding='utf-8') as f:
    content = f.read()
# Pattern to match the excerpt field for the starmer post
# We'll match from excerpt:' up to the closing quote before the comma that is before 'date'
# We'll use a regex that captures the entire excerpt field (including the quotes) and replace it with a fixed version.
# We'll use re.DOTALL to match newlines.
pattern = re.compile(r"(\\s*excerpt:')(.*?)'(?=\\s*,\\s*'date':)", re.DOTALL)
def repl(match):
    # match.group(1) is the prefix " excerpt:'"
    # match.group(2) is the inner content (including newlines)
    inner = match.group(2)
    # Escape newlines and single quotes
    inner = inner.replace('\\', '\\\\').replace('\n', '\\n').replace("'", "\\'")
    return match.group(1) + inner + "'"
new_content = pattern.sub(repl, content)
with open('js/posts.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
