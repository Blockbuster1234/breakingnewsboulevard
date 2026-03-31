import re
import sys

def fix_excerpt(s):
    # s is the content inside the quotes (excluding the quotes)
    # Replace newline and carriage return with \n and \r? Actually we want to represent newline as \n in the string literal.
    # We'll convert actual newline to the two-character sequence backslash-n.
    # Also escape backslashes and double quotes.
    s = s.replace('\\', '\\\\')  # escape backslashes first
    s = s.replace('"', '\\"')    # escape double quotes
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '\\r')
    return s

def process(content):
    # We'll use a regex to find excerpt fields and replace their content.
    # We assume that the excerpt field does not contain escaped quotes of the same type as the delimiter.
    # We'll match excerpt: followed by optional whitespace, then a quote (either " or `), then capture until the next matching quote (not escaped).
    # Since we don't have escaped quotes in the content, we can use a simple pattern that matches until the next quote of the same type.
    # We'll use re.DOTALL so that . matches newline.
    pattern = re.compile(r'(excerpt:\\s*)([\"`])([^\"`]*?)(\\2)', re.DOTALL)
    def replace_excerpt_regex(m):
        prefix = m.group(1)  # 'excerpt: ' or 'excerpt:\t'
        quote = m.group(2)   # '"' or '`'
        inner = m.group(3)
        # Fix inner
        fixed = fix_excerpt(inner)
        # We'll always output double-quoted string
        return f'{prefix}"{fixed}"'
    new_content = pattern.sub(replace_excerpt_regex, content)
    # Now fix the array structure: ensure objects are separated by '},' and no trailing comma before ]
    # Replace '}\n{' with '},\\n{' but we must consider any whitespace.
    new_content = re.sub(r'}\\s*{', '},\\n{', new_content)
    # Remove any comma that appears before the closing bracket (after the last object).
    new_content = re.sub(r',\\s*]', ']', new_content)
    return new_content

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 fix_posts.py <input_file> [output_file]")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    with open(input_file, 'r') as f:
        content = f.read()
    fixed = process(content)
    with open(output_file, 'w') as f:
        f.write(fixed)
    print(f"Fixed {input_file} -> {output_file}")
