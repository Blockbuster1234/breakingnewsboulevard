with open('js/posts.js', 'r') as f:
    lines = f.readlines()

# Find the line that contains the closing ] and ;
# We'll look for a line that contains '];' (maybe with whitespace)
end_line = None
for i, line in enumerate(lines):
    if line.strip().endswith('];'):
        end_line = i
        break

if end_line is None:
    print("Could not find end of posts array")
    exit(1)

# We'll insert the Starmer post before the end line.
# The Starmer post object as a string (with proper escaping for newlines in excerpt)
starmer_post = """  {\n    slug: \"starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage\",\n    title: \"Starmer gives doctors 48 hours to cancel strike or lose new jobs package\",\n    excerpt: \"Starmer gives doctors 48 hours to cancel strike or lose new jobs package\\\\n\\\\nLabour leader Sir Keir Starmer has issued an ultimatum to NHS doctors,\",\n    date: \"2026-03-31\",\n    author: \"Breaking News Boulevard\",\n    url: \"/posts/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage.html\",\n    image: \"https://picsum.photos/seed/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage/800/400\"\n  }"""

# Insert a comma after the previous line (if not already there) and then the starmer post.
# We'll modify the line before end_line to ensure it ends with a comma (if it's a post object).
# Actually, the line before end_line should be the closing brace of the last post, followed by a comma? Let's check.
# We'll just insert the starmer post lines before the end_line, and ensure the line before the inserted block ends with a comma.
# We'll look at lines[end_line-1] to see if it ends with a comma.
# If it's a line that contains '});' or '}' we need to add a comma after it.
# Let's do a simple approach: we'll replace the end_line with: a comma, then the starmer post, then a newline, then the original end_line.
# But we need to ensure the previous line ends with a comma. We'll check lines[end_line-1].
prev_line = lines[end_line-1]
if not prev_line.rstrip().endswith(','):
    # Add a comma at the end of the line
    lines[end_line-1] = prev_line.rstrip() + ',\n'

# Now insert the starmer post lines before end_line
starmer_lines = [starmer_post + '\n']
lines[end_line:end_line] = starmer_lines

with open('js/posts.js', 'w') as f:
    f.writelines(lines)
print('Added Starmer post')
