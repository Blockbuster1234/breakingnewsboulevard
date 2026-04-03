#!/usr/bin/env python3
"""Reorder posts.js to put fresh diverse articles first."""
import re, json

with open('js/posts.js', 'r') as f:
    raw = f.read()

articles = []
pos = 0
while True:
    start = raw.find('slug:', pos)
    if start == -1: break
    bs = raw.rfind('{', pos, min(start+1, len(raw)))
    if bs == -1: pos = start+5; continue
    depth=0; ins=False; sc=None; ibt=False; i=bs
    while i < len(raw):
        c = raw[i]
        if c=='`' and not ins: ibt = not ibt
        elif c in ('"',"'") and not ibt:
            if i>0 and raw[i-1]=='\\': pass
            elif not ins: ins=True; sc=c
            elif c==sc: ins=False; sc=None
        elif not ins and not ibt:
            if c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0:
                    block = raw[bs:i+1]
                    articles.append(block)
                    break
        i+=1
    pos=i+1

print(f"Found {len(articles)} article blocks")

# Find diverse articles and move them to front
new_order = []
diverse = []
for a in articles:
    if any(x in a for x in ['germany-eu-ai', 'bundesliga-bayern', 'who-declares']):
        diverse.insert(0, a)  # diverse first
    else:
        new_order.append(a)

# Featured stays first (new_order[0]), then diverse, then rest
final = [new_order[0]] + diverse + new_order[1:]
print(f"Featured: {final[0][:80]}...")
print(f"Followed by {len(diverse)} diverse articles, then {len(new_order)-1} rest")

with open('js/posts.js', 'w') as f:
    f.write('const posts = [\n')
    f.write(',\n'.join(final))
    f.write('\n];\n')

# Verify
import subprocess
r = subprocess.run(['node', '--check', 'js/posts.js'], capture_output=True, text=True)
if r.returncode == 0:
    print("✅ VALID JS - reordered")
else:
    print(f"❌ {r.stderr}")
