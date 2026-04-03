with open('js/posts.js', 'r') as f:
    content = f.read()

# Replace triple double-quotes with backticks for body values
content = content.replace('body: """', 'body: `')

# Fix closing: `""\n`  →  `\n` and `"""\n  },`  →  `\n  },`
content = content.replace('"""\n  },', '`\n  },')
content = content.replace('"""\n},', '`\n},')

with open('js/posts.js', 'w') as f:
    f.write(content)

print('Quotes fixed')
