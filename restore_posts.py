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

def extract_inner_array(content):
    """Extract the inner array content from const posts = [ ... ];"""
    # Find the start of the array
    start = content.find('const posts = [')
    if start == -1:
        raise ValueError("Could not find 'const posts = ['")
    start += len('const posts = [')
    # Find the end of the array (the closing '];')
    end = content.rfind('];')
    if end == -1:
        raise ValueError("Could not find '];'")
    inner = content[start:end].strip()
    return inner

def get_post_objects(inner):
    """Split inner string into list of post objects (each including braces)."""
    objects = []
    brace_count = 0
    in_string = False
    escape = False
    current = []
    i = 0
    while i < len(inner):
        c = inner[i]
        if escape:
            escape = False
            current.append(c)
            i += 1
            continue
        if c == '\\\\':
            escape = True
            current.append(c)
            i += 1
            continue
        if c == '"' and not in_string:
            in_string = not in_string
            current.append(c)
            i += 1
            continue
        if not in_string:
            if c == '{':
                brace_count += 1
                current.append(c)
                i += 1
                continue
            if c == '}':
                brace_count -= 1
                current.append(c)
                i += 1
                if brace_count == 0:
                    objects.append(''.join(current))
                    current = []
                    continue
        else:
            current.append(c)
            i += 1
            continue
    # If there is leftover (should not happen)
    if current:
        objects.append(''.join(current))
    return objects

def fix_excerpt_in_post(post_obj):
    """Ensure excerpt field is a proper double-quoted string with escaped newlines."""
    # Find excerpt:
    excerpt_pos = post_obj.find('excerpt:')
    if excerpt_pos == -1:
        return post_obj
    # Find start of string literal after excerpt:
    j = excerpt_pos + len('excerpt:')
    while j < len(post_obj) and post_obj[j] in ' \\t\\n\\r':
        j += 1
    if j >= len(post_obj):
        return post_obj
    opening = post_obj[j]
    if opening not in ('"', '`'):
        return post_obj
    # Find matching closing quote
    k = j + 1
    escaped = False
    while k < len(post_obj):
        c = post_obj[k]
        if escaped:
            escaped = False
            k += 1
            continue
        if c == '\\\\':
            escaped = True
            k += 1
            continue
        if c == opening and not escaped:
            k += 1  # include closing quote
            break
        k += 1
    else:
        return post_obj  # no closing quote found
    # Extract inner content
    if opening == '`':
        inner = post_obj[j+1:k-1]
    else:  # opening == '"'
        inner = post_obj[j+1:k-1]
    # Fix inner: replace newline with \\n, escape backslashes and double quotes
    fixed = inner.replace('\\\\', '\\\\\\\\').replace('"', '\\\\"').replace('\\n', '\\\\n').replace('\\r', '\\\\r')
    # Build new literal
    new_literal = '"' + fixed + '"'
    # Replace
    new_post = post_obj[:j] + new_literal + post_obj[k:]
    return new_post

def main():
    # Get old posts.js from commit 8dc6518
    try:
        old_content = subprocess.check_output(['git', 'show', '8dc6518:js/posts.js'], text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        print(f"Error retrieving old posts.js: {e}")
        sys.exit(1)
    # Get current posts.js
    with open('js/posts.js', 'r') as f:
        current_content = f.read()
    # Extract inner arrays
    try:
        old_inner = extract_inner_array(old_content)
        current_inner = extract_inner_array(current_content)
    except ValueError as e:
        print(f"Error extracting inner array: {e}")
        sys.exit(1)
    # Split into post objects
    old_objects = get_post_objects(old_inner)
    current_objects = get_post_objects(current_inner)
    # The current_objects should have exactly one post (the newly generated one)
    # But let's be safe: we'll take the first object from current_objects as the new post.
    if not current_objects:
        print("Error: No posts found in current posts.js")
        sys.exit(1)
    new_post_obj = current_objects[0]
    # Fix the excerpt in the new post object (just in case)
    new_post_fixed = fix_excerpt_in_post(new_post_obj)
    # Ensure it ends with a comma (since we will concatenate)
    new_post_fixed = new_post_fixed.rstrip()
    if not new_post_fixed.endswith(','):
        new_post_fixed = new_post_fixed + ','
    # Fix excerpt in all old objects
    old_objects_fixed = [fix_excerpt_in_post(obj) for obj in old_objects]
    # Ensure each old object except the last ends with a comma
    for i in range(len(old_objects_fixed)):
        obj = old_objects_fixed[i].rstrip()
        if i != len(old_objects_fixed) - 1:
            if not obj.endswith(','):
                obj = obj + ','
        old_objects_fixed[i] = obj
    # Combine: new_post_fixed + old_objects_fixed
    combined = [new_post_fixed] + old_objects_fixed
    # Join with newlines
    inner_new = '\n'.join(combined)
    new_content = 'const posts = [' + inner_new + '];'
    # Replace the const posts = ... line in the current content
    updated_content = re.sub(r'const posts = \\[\\s*[\\s\\S]*?\\];', new_content, current_content, count=1)
    # Write back
    with open('js/posts.js', 'w') as f:
        f.write(updated_content)
    print("Successfully restored all posts and fixed posts.js")
    # Print summary
    print(f"Number of posts: {len(combined)}")
    # List slugs
    slugs = re.findall(r'slug\\s*:\\s*["\\']([^"\\']+)["\\']', new_content)
    print("Slugs:")
    for slug in slugs:
        print(f"  {slug}")

if __name__ == '__main__':
    main()
