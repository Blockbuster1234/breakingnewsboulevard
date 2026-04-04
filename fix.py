import sys

def fix_newlines_in_strings(s):
    res = []
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
            res.append(c)
            i += 1
            continue
        if c == '\\\\':
            escape = True
            res.append(c)
            i += 1
            continue
        if not in_backtick:
            if c == "'" and not in_double:
                in_single = not in_single
                res.append(c)
                i += 1
                continue
            if c == '"' and not in_single:
                in_double = not in_double
                res.append(c)
                i += 1
                continue
        if c == '`' and not (in_single or in_double):
            in_backtick = not in_backtick
            res.append(c)
            i += 1
            continue
        if c in ('\n', '\r'):
            if in_single or in_double:
                # Inside a string literal, replace newline with \n (two chars)
                res.append('\\\\n')
            else:
                res.append(c)
        else:
            res.append(c)
        i += 1
    return ''.join(res)

with open('js/posts.js', 'r') as f:
    content = f.read()

# Remove markdown bold markers
content = content.replace('**', '')

fixed = fix_newlines_in_strings(content)

with open('js/posts.js', 'w') as f:
    f.write(fixed)

print('Fixed newlines in string literals and removed **')
