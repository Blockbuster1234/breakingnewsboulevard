import re

def fix_post_content(text):
    # We want to fix only the excerpt and title fields? Actually the issue is that the entire post object string may have newlines inside string literals.
    # We'll do a simple approach: replace all actual newlines with \n, but only outside of template literals? Too complex.
    # Instead, we'll just remove the ** and then replace actual newlines in the excerpt and title lines.
    # We'll process line by line.
    lines = text.split('\n')
    fixed_lines = []
    for line in lines:
        # Remove markdown bold markers
        line = line.replace('**', '')
        # If the line contains excerpt or title, we need to ensure there are no actual newlines inside the string.
        # But the line already is one line, so if there was a newline inside the string, it would have split the line.
        # So we assume that the excerpt and title are on a single line in the backup files.
        fixed_lines.append(line)
    return '\n'.join(fixed_lines)

# Read original_posts.js to get the template
with open('original_posts.js', 'r') as f:
    original = f.read()

# Extract the array content between const posts = [ and ];
match = re.search(r'const posts = \[([\s\S]*?)\];', original)
if not match:
    print("Could not find posts array in original_posts.js")
    exit(1)
array_content = match.group(1)
# The original posts are separated by },{ but we'll keep the original array content as is and then append missing posts.
# We'll just keep the original array content and then add the missing posts.

# List of missing slugs
missing_slugs = [
    'russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade',
    'spain-closes-airspace-to-us-aircraft-involved-in-iran-war',
    'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage',
    'why-does-the-us-have-iran-s-kharg-island-in-its-sights'
]

missing_posts = []
for slug in missing_slugs:
    found = False
    for backup_file in ['js/posts.js.backup2', 'js/posts.js.backup3', 'js/posts.js.backup_broken', 'old_posts.js']:
        try:
            with open(backup_file, 'r') as f:
                content = f.read()
            # Find the post object for this slug
            # We'll look for the pattern: slug: '...' or slug: "..."
            pattern = re.compile(r"slug:\s*['\"]" + re.escape(slug) + r"['\"]")
            if pattern.search(content):
                # Extract the post object: from the previous { to the next } that matches braces.
                # We'll find the start of the object by looking for the last { before the slug that is not inside a string.
                # Simple: find the index of the slug, then go backwards to find the {.
                idx = pattern.search(content).start()
                # Go backwards to find the matching {
                brace_count = 0
                start = idx
                for i in range(idx, -1, -1):
                    ch = content[i]
                    if ch == '}':
                        brace_count += 1
                    elif ch == '{':
                        if brace_count == 0:
                            start = i
                            break
                        else:
                            brace_count -= 1
                # Now go forwards to find the matching }
                brace_count = 0
                end = start
                for i in range(start, len(content)):
                    ch = content[i]
                    if ch == '{':
                        brace_count += 1
                    elif ch == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end = i
                            break
                post_obj = content[start:end+1]
                # Fix the post object
                fixed_post = fix_post_content(post_obj)
                missing_posts.append(fixed_post)
                found = True
                break
        except Exception as e:
            print(f"Error processing {backup_file}: {e}")
            continue
    if not found:
        print(f"Could not find post for slug: {slug}")
        exit(1)

# Now construct the new array content: original array content + missing posts
# We need to ensure proper separation with commas.
# The original array content ends with the last post object (no trailing comma).
# We'll add a comma and newline after the original content if there are missing posts.
new_array = array_content
if missing_posts:
    if new_array and not new_array.endswith('\n'):
        new_array += '\n'
    # Add a comma if the original array content is not empty and does not already end with a comma?
    # The original array content is the content inside the brackets, which is a list of objects separated by commas.
    # The last character should be the last character of the last post object (which is '}').
    # So we need to add a comma and newline before the first missing post.
    new_array += ','
    for i, post in enumerate(missing_posts):
        new_array += '\n' + post
        if i != len(missing_posts) - 1:
            new_array += ','
    new_array += '\n'

# Build the new file
new_content = f"""// posts.js — Article database
// Each post: {{ slug, title, excerpt, image, category, date, author, url, body }}

const posts = [
{new_array}
];"""

with open('js/posts.js', 'w') as f:
    f.write(new_content)

print("Written js/posts.js")
# Verify by counting slugs
with open('js/posts.js', 'r') as f:
    content = f.read()
slug_matches = re.findall(r"slug:\s*['\"]([^'\"]+)['\"]", content)
print(f"Found {len(slug_matches)} posts: {', '.join(slug_matches)}")
