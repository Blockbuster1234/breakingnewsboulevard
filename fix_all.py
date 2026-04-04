import sys

# Read the backup2 file
try:
    with open('js/posts.js.backup2', 'r') as f:
        content = f.read()
except FileNotFoundError:
    print("Error: backup file not found")
    sys.exit(1)

# We'll fix the content by:
# 1. Replacing actual newlines inside single and double quoted strings with \n
# 2. Removing markdown bold markers (**)
# 3. Adding the Starmer post if it's missing

# Step 1 and 2: Process the content to fix newlines in string literals and remove **
# We'll do a state machine for string literals.

def fix_newlines_and_remove_bold(s):
    result = []
    i = 0
    n = len(s)
    in_single = False
    in_double = False
    in_backtick = False
    escape = False

    while i < n:
        c = s[i]
        if escape:
            escape = False
            result.append(c)
            i += 1
            continue
        if c == '\\\\':
            escape = True
            result.append(c)
            i += 1
            continue
        # Handle quotes
        if not in_backtick:
            if c == "'" and not in_double:
                in_single = not in_single
                result.append(c)
                i += 1
                continue
            if c == '"' and not in_single:
                in_double = not in_double
                result.append(c)
                i += 1
                continue
        if c == '`' and not (in_single or in_double):
            in_backtick = not in_backtick
            result.append(c)
            i += 1
            continue
        # Replace newlines inside string literals (single or double) with \n
        if c in ('\n', '\r'):
            if in_single or in_double:
                result.append('\\\\n')
            else:
                result.append(c)
        else:
            # Remove markdown bold markers by not adding them
            if c == '*' and i+1 < n and s[i+1] == '*':
                # Skip both asterisks
                i += 2
                continue
            else:
                result.append(c)
        i += 1
    return ''.join(result)

fixed = fix_newlines_and_remove_bold(content)

# Step 3: Add the Starmer post if it's missing
starmer_slug = "slug: 'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage'"
if starmer_slug not in fixed:
    # We need to add the Starmer post before the closing ];
    lines = fixed.splitlines(keepends=True)
    # Find the line that ends with ];
    end_line = None
    for i, line in enumerate(lines):
        if line.strip().endswith('];'):
            end_line = i
            break
    if end_line is None:
        print("Error: Could not find end of posts array")
        sys.exit(1)
    # Ensure the line before end_line ends with a comma
    if end_line > 0:
        prev = lines[end_line-1]
        if not prev.rstrip().endswith(','):
            lines[end_line-1] = prev.rstrip() + ',\n'
    # Starmer post
    starmer_post = """  {
    slug: 'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage',
    title: 'Starmer gives doctors 48 hours to cancel strike or lose new jobs package',
    excerpt: 'Starmer gives doctors 48 hours to cancel strike or lose new jobs package\\\\n\\\\nLabour leader Sir Keir Starmer has issued an ultimatum to NHS doctors,',
    date: '2026-03-31',
    author: 'Breaking News Boulevard',
    url: '/posts/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage.html',
    image: 'https://picsum.photos/seed/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage/800/400'
  }"""
    lines[end_line:end_line] = [starmer_post + '\n']
    fixed = ''.join(lines)

# Write back to posts.js
with open('js/posts.js', 'w') as f:
    f.write(fixed)

print('Successfully fixed posts.js')
