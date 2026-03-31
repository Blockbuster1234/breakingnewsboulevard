import re
import subprocess
import sys

def extract_posts_array(content):
    """Return the inner content of the posts array (between '[' and ']')"""
    start = content.find('const posts = [')
    if start == -1:
        raise ValueError('Could not find const posts = [')
    start += len('const posts = [')
    end = content.rfind('];')
    if end == -1:
        raise ValueError('Could not find ];')
    inner = content[start:end].strip()
    return inner

def split_posts(inner):
    """Split the inner string into a list of post objects (as strings including braces)."""
    posts = []
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
                    posts.append(''.join(current))
                    current = []
                    continue
        else:
            current.append(c)
            i += 1
            continue
    # If there is leftover (should not happen)
    if current:
        posts.append(''.join(current))
    return posts

def fix_excerpt_in_post(post_obj):
    """Given a post object string, ensure its excerpt field is a proper double-quoted string with escaped newlines."""
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
    slug_target = "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade"
    # Get current posts.js
    with open('js/posts.js', 'r') as f:
        current_content = f.read()
    # Get old posts.js from commit 8dc6518
    try:
        old_content = subprocess.check_output(['git', 'show', '8dc6518:js/posts.js'], text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        print(f"Error retrieving old posts.js: {e}")
        sys.exit(1)
    # Extract arrays
    try:
        current_inner = extract_posts_array(current_content)
        old_inner = extract_posts_array(old_content)
    except ValueError as e:
        print(f"Error extracting posts array: {e}")
        sys.exit(1)
    # Split into posts
    current_posts = split_posts(current_inner)
    old_posts = split_posts(old_inner)
    # Find the target post in old_posts
    target_post_obj = None
    for post in old_posts:
        if f'slug: "{slug_target}"' in post or f"slug: '{slug_target}'" in post:
            target_post_obj = post
            break
    if target_post_obj is None:
        print(f"Error: Could not find post with slug {slug_target} in old posts")
        sys.exit(1)
    # Fix the excerpt in the target post
    target_post_fixed = fix_excerpt_in_post(target_post_obj)
    # Ensure it ends with a comma (since we will insert it between two posts)
    target_post_fixed = target_post_fixed.rstrip()
    if not target_post_fixed.endswith(','):
        target_post_fixed = target_post_fixed + ','
    # Now we want to construct new posts list:
    # We keep the first post from current_posts (the newly generated post)
    # Then we insert the target_post_fixed
    # Then we append the rest of the old_posts, but we need to skip the target post we already used, and also skip any posts that are already in current_posts? 
    # However, we want to preserve the order as it was in the old array, but with the new post added at the front.
    # The current_posts currently contains: [new_post, ...] where the ... is the old array but with the russian post missing? Actually we need to check.
    # Let's instead construct the new array as:
    #   new_post (from current_posts[0])
    #   target_post_fixed
    #   then all posts from old_posts except the target_post, in their original order.
    # But we also need to ensure we don't duplicate any other posts that might have been added after the old commit (there shouldn't be any).
    # So we will take old_posts, remove the target_post, and then append them.
    # However, we also need to consider that the current_posts[0] might be a duplicate of a post already in old_posts? It shouldn't be because it's newly generated.
    # Let's get the slug of the first post in current_posts to confirm.
    first_post = current_posts[0] if current_posts else None
    if first_post:
        # extract slug
        slug_match = re.search(r'slug\\s*:\\s*["\\']([^"\\']+)["\\']', first_post)
        if slug_match:
            first_slug = slug_match.group(1)
            print(f"First post slug: {first_slug}")
    # Build list of old posts without the target
    old_posts_without_target = [p for p in old_posts if p != target_post_obj]
    # Now construct new posts list: [first_post, target_post_fixed] + old_posts_without_target
    new_posts_list = []
    if first_post:
        new_posts_list.append(first_post)
    new_posts_list.append(target_post_fixed)
    new_posts_list.extend(old_posts_without_target)
    # Now we need to fix the excerpt in all posts (just in case) but we already fixed the target; we should also fix the first_post and others.
    # We'll apply fix_excerpt_in_post to each post.
    new_posts_list = [fix_excerpt_in_post(p) for p in new_posts_list]
    # Ensure each post except the last ends with a comma
    for i in range(len(new_posts_list)):
        post = new_posts_list[i].rstrip()
        if i != len(new_posts_list) - 1:
            if not post.endswith(','):
                post = post + ','
        new_posts_list[i] = post
    # Join with newlines
    inner_new = '\\n'.join(new_posts_list)
    new_content = 'const posts = [' + inner_new + '];'
    # Replace the const posts = ... line in the current content
    # We'll replace from the start of 'const posts = [' to the closing '];'
    updated_content = re.sub(r'const posts = \\[\\s*[\\s\\S]*?\\];', new_content, current_content, count=1)
    # Write back
    with open('js/posts.js', 'w') as f:
        f.write(updated_content)
    print("Successfully restored russian post and fixed posts.js")

if __name__ == '__main__':
    main()
