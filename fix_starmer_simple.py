with open('js/posts.js', 'r') as f:
    lines = f.readlines()

# Find the line index of the starmer post's slug
starmer_slug_line = None
for i, line in enumerate(lines):
    if "slug:'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage'" in line:
        starmer_slug_line = i
        break

if starmer_slug_line is None:
    print("Starmer slug not found")
    exit(1)

# Now find the excerpt line within the same post (after the slug line)
excerpt_line = None
for i in range(starmer_slug_line, len(lines)):
    if lines[i].strip().startswith("excerpt:"):
        excerpt_line = i
        break

if excerpt_line is None:
    print("Excerpt line not found")
    exit(1)

# Now we need to find the end of the excerpt field.
# We'll look for the line that contains the date field for this post.
date_line = None
for i in range(excerpt_line, len(lines)):
    if "'date':" in lines[i] and '2026-03-31' in lines[i]:
        date_line = i
        break

if date_line is None:
    print("Date line not found")
    exit(1)

# Extract the excerpt block
excerpt_block = ''.join(lines[excerpt_line:date_line])

# Now fix the excerpt block by replacing newlines with \n and ensuring proper quoting
import re
# Pattern: excerpt:'...' where ... may contain newlines, up to the comma before date
pattern = re.compile(r"(excerpt:')(.*)(?='\\s*,\\s*'date':)", re.DOTALL)
m = pattern.search(excerpt_block)
if m:
    prefix = m.group(1)  # "excerpt:'"
    inner = m.group(2)   # the content inside the quotes
    # Escape backslashes and single quotes in inner
    inner = inner.replace('\\', '\\\\').replace("'", "\\'")
    # Replace newlines with \n (but note: we already have actual newlines in inner)
    # We'll replace actual newline characters with the two characters \ and n
    inner = inner.replace('\n', '\\n')
    new_excerpt = prefix + inner + "'"
    # Replace the matched part
    new_block = excerpt_block[:m.start()] + new_excerpt + excerpt_block[m.end():]
    lines[excerpt_line:date_line] = [new_block + '\n']
else:
    # Fallback: just replace newlines with \n in the block and hope for the best
    # This is less precise but should work
    fixed_block = excerpt_block.replace('\n', '\\n')
    lines[excerpt_line:date_line] = [fixed_block + '\n']

# Write back
with open('js/posts.js', 'w') as f:
    f.writelines(lines)
print('Fixed Starmer post excerpt')
