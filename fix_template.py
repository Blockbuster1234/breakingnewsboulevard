import re

def escape_dollars_in_template_literals(text):
    # We'll find all template literals: from backtick to next backtick (non-greedy)
    # But we need to handle escaped backticks? Assume there are none.
    # We'll use a simple regex with re.DOTALL to match across lines.
    # Pattern: `(.*?)` but we need to capture the content between backticks.
    # However, we must avoid matching inside strings? Not needed.
    # We'll use re.sub with a callback.
    def replace(match):
        # match.group(0) is the entire match including backticks
        # match.group(1) is the content between backticks
        inner = match.group(1)
        # Escape $ that are not already escaped
        # We'll replace $(?!\\) with \\$ but careful: we want to escape $ unless preceded by a backslash.
        # Actually, we want to replace $ with \$, but if it's already \$, we should leave it (or double?).
        # The goal is to have literal $ in the template literal, so we need to ensure that $ is represented as \$
        # in the source so that when the template literal is evaluated, it becomes a literal $.
        # So we need to ensure that every $ is preceded by a backslash, and that backslash is not itself escaped.
        # Simpler: replace every $ with \$, and then fix any double escapes? But if there was already \$, it becomes \\$.
        # That would be wrong because \\$ in a template literal is a backslash followed by $, which would evaluate to a literal backslash and then $? Actually, template literals: \${ is escaped? Let's test mentally: In a template literal, \$$ is a literal backslash followed by a dollar sign? Because the backslash escapes the dollar sign? Actually, in template literals, the backslash is not special except for the sequence \${ and \}` and \\. So to include a literal $, you can just write $, unless you want to avoid it being interpreted as a template expression. So if you want a literal $, you can write $ as long as it's not followed by {. However, if it is followed by {, then it starts a template expression and must be escaped as \${.
        # Therefore, we need to escape $ only when it is followed by {.
        # But also, we need to consider that the template literal might contain ${...} for actual template expressions? In our case, the template literals are meant to be raw HTML, so there should be no template expressions. So any ${ should be escaped as \${.
        # Additionally, any $ not followed by { is fine as is.
        # So we need to replace ${ with \${.
        # Let's do that.
        inner = inner.replace('${', r'\${')
        return '`' + inner + '`'
    # Now we need to find template literals. We'll use a regex that matches from a backtick to the next backtick, but we must avoid matching inside other constructs? We'll assume that backticks are only used for template literals in this file (they are also used in the body field and maybe elsewhere? The excerpt field uses double quotes, not backticks. The body uses backticks. Also, there might be backticks in the HTML content? Unlikely.
    # We'll use re.sub with pattern r'`(.*?)`' and DOTALL.
    return re.sub(r'`(.*?)`', replace, text, flags=re.DOTALL)

with open('js/posts.js', 'r') as f:
    content = f.read()

new_content = escape_dollars_in_template_literals(content)

with open('js/posts.js', 'w') as f:
    f.write(new_content)

print('Fixed template literals.')
