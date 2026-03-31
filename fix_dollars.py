import re

with open('js/posts.js', 'r') as f:
    content = f.read()

# Replace $ with \$ inside template literals only
# Simple approach: replace all ${ that are NOT already \${ 
# and all standalone $ not followed by {
fixed = re.sub(r'(?<!\\\\)\$(?!{)', r'\\\$', content)

with open('js/posts.js', 'w') as f:
    f.write(fixed)

print('Done')
