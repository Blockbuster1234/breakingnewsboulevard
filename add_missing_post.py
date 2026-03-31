import re
import subprocess
import sys

def fix_excerpt(s):
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '\\r')
    return s

def get_old_post(slug):
    # Get the old js/posts.js from commit 17c41bc
    old_content = subprocess.check_output(['git', 'show', '17c41bc:js/posts.js'], text=True)
    # Find the post object for the given slug
    # We'll look for the slug and then extract the object
    # Pattern: slug: "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade"
    # We'll find the position of the slug and then expand to find the object boundaries.
    pos = old_content.find('slug: "' + slug + '"')
    if pos == -1:
        # Try with single quotes?
        pos = old_content.find(\"slug: '\" + slug + \"'\")
    if pos == -1:
        raise ValueError(f"Slug {slug} not found in old commit")
    # Now find the opening brace of the object
    brace_count = 0
    in_string = False
    escape = False
    i = pos
    while i >= 0:
        c = old_content[i]
        if escape:
            escape = False
            i -= 1
            continue
        if c == '\\':
            escape = True
            i -= 1
            continue
        if c == '"' and not in_string:
            in_string = not in_string
        if not in_string:
            if c == '}':
                brace_count += 1
            elif c == '{':
                brace_count -= 1
                if brace_count == 0:
                    open_brace = i
                    break
        i -= 1
    else:
        raise ValueError("Could not find opening brace")
    # Find the closing brace
    brace_count = 0
    in_string = False
    escape = False
    i = open_brace
    while i < len(old_content):
        c = old_content[i]
        if escape:
            escape = False
            i += 1
            continue
        if c == '\\':
            escape = True
            i += 1
            continue
        if c == '"' and not in_string:
            in_string = not in_string
        if not in_string:
            if c == '{':
                brace_count += 1
            elif c == '}':
                brace_count -= 1
                if brace_count == 0:
                    close_brace = i
                    break
        i += 1
    else:
        raise ValueError("Could not find closing brace")
    # Extract the object
    obj = old_content[open_brace:close_brace+1]
    return obj

def fix_post_excerpt(obj):
    # Find the excerpt field in the object
    excerpt_pos = obj.find('excerpt:')
    if excerpt_pos == -1:
        return obj
    # Find the start of the string literal after excerpt:
    j = excerpt_pos + len('excerpt:')
    while j < len(obj) and obj[j] in ' \t\n\r':
        j += 1
    if j >= len(obj):
        return obj
    opening = obj[j]
    if opening not in ('"', '`'):
        return obj
    # Find the matching closing quote
    k = j + 1
    escaped = False
    while k < len(obj):
        c = obj[k]
        if escaped:
            escaped = False
            k += 1
            continue
        if c == '\\':
            escaped = True
            k += 1
            continue
        if c == opening and not escaped:
            k += 1  # include the closing quote
            break
        k += 1
    else:
        return obj
    # Extract the string literal
    string_literal = obj[j:k]  # includes opening and closing quotes
    # Extract the inner content
    if opening == '`':
        inner = obj[j+1:k-1]
    else:  # opening == '"'
        inner = obj[j+1:k-1]
    # Fix the inner content
    fixed_inner = fix_excerpt(inner)
    # Build new literal: double-quoted string
    new_literal = f'"{fixed_inner}"'
    # Replace the old string literal with the new one
    new_obj = obj[:j] + new_literal + obj[k:]
    return new_obj

def main():
    slug = "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade"
    try:
        old_obj = get_old_post(slug)
    except Exception as e:
        print(f"Error extracting old post: {e}")
        sys.exit(1)
    fixed_obj = fix_post_excerpt(old_obj)
    # Ensure the object ends with a comma (since we will prepend it)
    fixed_obj = fixed_obj.rstrip()
    if not fixed_obj.endswith(','):
        fixed_obj = fixed_obj + ','
    # Read the current posts.js
    with open('js/posts.js', 'r') as f:
        current_content = f.read()
    # Extract the inner array content from current_content
    # Find the line that starts with 'const posts = ['
    # We'll assume the format is exactly as we have.
    start = current_content.find('const posts = [')
    if start == -1:
        print("Could not find 'const posts = [' in current posts.js")
        sys.exit(1)
    start += len('const posts = [')
    # Find the closing '];'
    end = current_content.rfind('];')
    if end == -1:
        print("Could not find '];' in current posts.js")
        sys.exit(1)
    inner_current = current_content[start:end].strip()
    # Build new inner array: fixed_obj + '\n' + inner_current
    # If inner_current is empty, we don't need a newline? but we'll add anyway.
    new_inner = fixed_obj + '\n' + inner_current
    # Wrap it
    new_content = 'const posts = [' + new_inner + '];'
    # Now fix the entire content to ensure consistent formatting (excerpt fields, etc.)
    # We'll use our fix_posts.py logic on the new_content.
    # First, write to a temporary file and then run fix_posts.py on it? Or we can incorporate the fixing.
    # Let's just run the fix_posts.py function we have.
    # We'll import the fix_posts module? Instead, we'll copy the fixing logic.
    # We'll reuse the process function from fix_posts.py, but we don't have it as a module.
    # Let's just run the fix_posts.py script on a temporary file.
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(new_content)
        temp_path = f.name
    try:
        # Run fix_posts.py on the temporary file
        subprocess.run([sys.executable, 'fix_posts.py', temp_path], check=True)
        # Read the fixed content
        with open(temp_path, 'r') as f:
            fixed_content = f.read()
    except Exception as e:
        print(f"Error fixing content: {e}")
        fixed_content = new_content  # fallback
    finally:
        import os
        os.unlink(temp_path)
    # Write back to js/posts.js
    with open('js/posts.js', 'w') as f:
        f.write(fixed_content)
    print("Successfully added missing post and fixed posts.js")

if __name__ == '__main__':
    main()
