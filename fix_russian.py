import re
import subprocess
import sys

def fix_excerpt(s):
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '\\r')
    return s

def get_old_post_from_git(commit, slug):
    try:
        content = subprocess.check_output(['git', 'show', f'{commit}:js/posts.js'], text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None
    pos = content.find('slug: "' + slug + '"')
    if pos == -1:
        pos = content.find(\"slug: '\" + slug + \"'\")
    if pos == -1:
        return None
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
    obj = content[open_brace:close_brace+1]
    return obj

def fix_post_excerpt(obj):
    excerpt_pos = obj.find('excerpt:')
    if excerpt_pos == -1:
        return obj
    j = excerpt_pos + len('excerpt:')
    while j < len(obj) and obj[j] in ' \t\n\r':
        j += 1
    if j >= len(obj):
        return obj
    opening = obj[j]
    if opening not in ('"', '`'):
        return obj
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
            k += 1
            break
        k += 1
    else:
        return obj
    if opening == '`':
        inner = obj[j+1:k-1]
    else:
        inner = obj[j+1:k-1]
    fixed_inner = fix_excerpt(inner)
    new_literal = f'"{fixed_inner}"'
    new_obj = obj[:j] + new_literal + obj[k:]
    return new_obj

def main():
    slug = "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade"
    old_obj = get_old_post_from_git('8dc6518', slug)
    if old_obj is None:
        print("Error: Could not retrieve old post from git")
        sys.exit(1)
    fixed_obj = fix_post_excerpt(old_obj)
    fixed_obj = fixed_obj.rstrip()
    if not fixed_obj.endswith(','):
        fixed_obj = fixed_obj + ','
    with open('js/posts.js', 'r') as f:
        current_content = f.read()
    start = current_content.find('const posts = [')
    if start == -1:
        print("Error: Could not find 'const posts = ['")
        sys.exit(1)
    start += len('const posts = [')
    end = current_content.rfind('];')
    if end == -1:
        print("Error: Could not find '];'")
        sys.exit(1)
    inner = current_content[start:end].strip()
    # Find first object in inner
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
                    first_obj_end = i+1
                    break
        i += 1
    else:
        first_obj_end = len(inner)
    first_obj = inner[:first_obj_end].rstrip()
    rest = inner[first_obj_end:].lstrip()
    if rest.startswith(','):
        rest = rest[1:].lstrip()
    new_inner = first_obj + ',\n' + fixed_obj + '\n' + rest
    new_content = 'const posts = [' + new_inner + '];'
    with open('js/posts.js', 'w') as f:
        f.write(new_content)
    print("Successfully restored russian post and updated posts.js")

if __name__ == '__main__':
    main()
