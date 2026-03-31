import re
import subprocess
import sys

def fix_excerpt(s):
    # Convert newline to \n, escape backslashes and double quotes
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '\\r')
    return s

def get_old_post_from_git(commit, slug):
    # Get the js/posts.js from the given commit
    try:
        content = subprocess.check_output(['git', 'show', f'{commit}:js/posts.js'], text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None
    # Find the slug
    pos = content.find('slug: "' + slug + '"')
    if pos == -1:
        pos = content.find(\"slug: '\" + slug + \"'\")
    if pos == -1:
        return None
    # Find opening brace
    brace_count = 0
    in_string = False
    escape = False
    i = pos
    while i >= 0:
        c = content[i]
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
        return None
    # Find closing brace
    brace_count = 0
    in_string = False
    escape = False
    i = open_brace
    while i < len(content):
        c = content[i]
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
        return None
    # Extract object
    obj = content[open_brace:close_brace+1]
    return obj

def fix_post_excerpt(obj):
    # Find excerpt field
    excerpt_pos = obj.find('excerpt:')
    if excerpt_pos == -1:
        return obj
    # Find start of string literal after excerpt:
    j = excerpt_pos + len('excerpt:')
    while j < len(obj) and obj[j] in ' \t\n\r':
        j += 1
    if j >= len(obj):
        return obj
    opening = obj[j]
    if opening not in ('"', '`'):
        return obj
    # Find matching closing quote
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
            k += 1  # include closing quote
            break
        k += 1
    else:
        return obj
    # Extract inner content
    if opening == '`':
        inner = obj[j+1:k-1]
    else:  # opening == '"'
        inner = obj[j+1:k-1]
    # Fix inner
    fixed_inner = fix_excerpt(inner)
    # Build new literal: double-quoted string
    new_literal = f'"{fixed_inner}"'
    # Replace
    new_obj = obj[:j] + new_literal + obj[k:]
    return new_obj

def main():
    slug = "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade"
    # Get the old post from commit 8dc6518 (the parent of the latest commit)
    old_obj = get_old_post_from_git('8dc6518', slug)
    if old_obj is None:
        print("Error: Could not retrieve old post from git")
        sys.exit(1)
    # Fix its excerpt
    fixed_obj = fix_post_excerpt(old_obj)
    # Ensure it ends with a comma (since we will insert it between two posts)
    fixed_obj = fixed_obj.rstrip()
    if not fixed_obj.endswith(','):
        fixed_obj = fixed_obj + ','
    # Read current posts.js
    with open('js/posts.js', 'r') as f:
        current_content = f.read()
    # Extract the first post (the new one) and the rest
    # We assume the format: const posts = [  { ... }, { ... }, ... ];
    # Find the start of the array
    start = current_content.find('const posts = [')
    if start == -1:
        print("Error: Could not find 'const posts = ['")
        sys.exit(1)
    start += len('const posts = [')
    # Find the end of the array (the closing '];')
    end = current_content.rfind('];')
    if end == -1:
        print("Error: Could not find '];'")
        sys.exit(1)
    inner = current_content[start:end].strip()
    # Now we need to split the inner into objects.
    # We'll do a simple split by '},' but careful about the last object.
    # Instead, we'll just prepend the fixed_obj to the inner, but we need to ensure the first object (the new post) stays first.
    # Actually, we want: new_post, russian_post, then the rest of the current inner (which starts with the us-deploys post).
    # So we need to split the inner into first object and the rest.
    # Let's find the first object in inner.
    # We'll scan for matching braces.
    brace_count = 0
    in_string = False
    escape = False
    i = 0
    while i < len(inner):
        c = inner[i]
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
                    # Found the end of the first object
                    first_obj_end = i+1  # include the closing brace
                    break
        i += 1
    else:
        # If we didn't break, assume the whole inner is one object (should not happen)
        first_obj_end = len(inner)
    first_obj = inner[:first_obj_end].rstrip()
    rest = inner[first_obj_end:].lstrip()
    # If rest starts with a comma, remove it (we'll add our own)
    if rest.startswith(','):
        rest = rest[1:].lstrip()
    # Now construct new inner: first_obj + ',\n' + fixed_obj + '\n' + rest
    new_inner = first_obj + ',\n' + fixed_obj + '\n' + rest
    # Wrap it
    new_content = 'const posts = [' + new_inner + '];'
    # Write back
    with open('js/posts.js', 'w') as f:
        f.write(new_content)
    print("Successfully restored russian post and updated posts.js")

if __name__ == '__main__':
    main()
