with open('js/posts.js', 'r') as f:
    lines = f.readlines()

# Find the line that contains the closing ] and ;
end_line = None
for i, line in enumerate(lines):
    if line.strip().endswith('];'):
        end_line = i
        break

if end_line is None:
    print("Could not find end of posts array")
    exit(1)

# Ensure the line before end_line ends with a comma (if it's a post object)
if end_line > 0:
    prev = lines[end_line-1]
    if not prev.rstrip().endswith(','):
        # Add a comma at the end of the line
        lines[end_line-1] = prev.rstrip() + ',\n'

# Starmer post object as a string (with proper escaping for newlines in excerpt)
starmer_post = """  {\n    slug: \"starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage\",\n    title: \"Starmer gives doctors 48 hours to cancel strike or lose new jobs package\",\n    excerpt: \"Starmer gives doctors 48 hours to cancel strike or lose new jobs package\\\\n\\\\nLabour leader Sir Keir Starmer has issued an ultimatum to NHS doctors,\",\n    date: \"2026-03-31\",\n    author: \"Breaking News Boulevard\",\n    url: \"/posts/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage.html\",\n    image: \"https://picsum.photos/seed/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage/800/400\"\n  }"""

# Insert the Starmer post lines before end_line
starmer_lines = [starmer_post + '\n']
lines[end_line:end_line] = starmer_lines

with open('js/posts.js', 'w') as f:
    f.writelines(lines)
print('Added Starmer post')
