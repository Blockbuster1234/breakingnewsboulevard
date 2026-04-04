import sys

def fix_newlines_in_strings(s):
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
        if not in_backtick:
            if c == \"'\" and not in_double:
                in_single = not in_single
                result.append(c)
                i += 1
                continue
            if c == '\"' and not in_single:
                in_double = not in_double
                result.append(c)
                i += 1
                continue
        if c == '`' and not (in_single or in_double):
            in_backtick = not in_backtick
            result.append(c)
            i += 1
            continue
        if c in ('\\n', '\\r'):
            if in_single or in_double:
                result.append('\\\\n')
            else:
                result.append(c)
        else:
            result.append(c)
        i += 1
    return ''.join(result)

with open('js/posts.js', 'r') as f:
    content = f.read()

fixed = fix_newlines_in_strings(content)

with open('js/posts.js', 'w') as f:
    f.write(fixed)

print('Fixed newlines in string literals')
