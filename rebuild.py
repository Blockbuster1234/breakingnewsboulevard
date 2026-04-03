#!/usr/bin/env python3
"""Rebuild static index.html from posts.js."""
import re, os

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
                    def gf(n):
                        m = re.search(n + r':\s*"(.*?)"', block, re.DOTALL)
                        if m: return m.group(1)
                        m = re.search(n + r":\s*'(.+?)'", block, re.DOTALL)
                        if m: return m.group(1).strip()
                        return ''
                    slug=gf('slug'); title=gf('title'); exc=gf('excerpt')
                    img=gf('image'); cat=gf('category'); dt=gf('date')
                    ath=gf('author'); url=gf('url')
                    if slug and title:
                        articles.append({'slug':slug,'title':title,'excerpt':' '.join(exc.split()),'image':img,'category':cat,'date':dt,'author':ath,'url':url})
                    break
        i+=1
    pos=i+1

print(f"Parsed {len(articles)} articles")
feat = articles[0]
grid = articles[1:10]
ticker = ' — '.join([a['title'] for a in articles[:5]])

# Read CSS
with open('index.html','r') as f: old=f.read()
css_m = re.search(r'<style[^>]*>(.*?)</style>', old, re.DOTALL)
css = css_m.group(1) if css_m else ''

# Build featured
feat_h = f'  <section id="featured" class="featured">\n'
feat_h += f'    <div class="container">\n'
feat_h += f'      <div class="featured-card">\n'
feat_h += f'        <img src="{feat["image"]}" alt="{feat["title"]}" loading="lazy">\n'
feat_h += f'        <div class="featured-body">\n'
feat_h += f'          <span class="card-category">{feat["category"]}</span>\n'
feat_h += f'          <h2><a href="{feat["url"]}">{feat["title"]}</a></h2>\n'
feat_h += f'          <p>{feat["excerpt"]}</p>\n'
feat_h += f'          <div class="card-meta">{feat["date"]} &bull; By {feat["author"]}</div>\n'
feat_h += f'        </div>\n      </div>\n    </div>\n  </section>'

# Build grid
cards = []
for p in grid:
    c = f'        <article class="card">\n'
    c += f'          <img class="card-img" src="{p["image"]}" alt="{p["title"]}" loading="lazy">\n'
    c += f'          <div class="card-body">\n'
    c += f'            <span class="card-category">{p["category"]}</span>\n'
    c += f'            <h2><a href="{p["url"]}">{p["title"]}</a></h2>\n'
    c += f'            <p>{p["excerpt"]}</p>\n'
    c += f'            <div class="card-meta">{p["date"]}</div>\n'
    c += f'          </div>\n'
    c += f'        </article>'
    cards.append(c)
grid_h = '\n'.join(cards)

# Build full HTML - use string concat to avoid f-string issues with JS
html_parts = [
'<!DOCTYPE html>\n<html lang="en">\n<head>\n',
'  <meta charset="UTF-8">\n',
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n',
'  <title>Breaking News Boulevard — Latest News & Analysis</title>\n',
'  <meta name="description" content="Your source for breaking news, analysis, and trending stories from around the world. Stay informed with daily updates.">\n',
'  <meta property="og:type" content="website">\n',
'  <meta property="og:title" content="Breaking News Boulevard">\n',
'  <link rel="canonical" href="https://www.breakingnewsboulevard.com/">\n',
'  <script type="application/ld+json">\n',
'  {"@context":"https://schema.org","@type":"WebSite","name":"Breaking News Boulevard","url":"https://www.breakingnewsboulevard.com/","description":"Your source for breaking news, analysis, and trending stories."}\n',
'  </script>\n',
'  <link rel="preconnect" href="https://fonts.googleapis.com">\n',
'  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">\n',
'  <style>\n',
css,
'  </style>\n',
'</head>\n<body>\n',
'  <header class="header">\n',
'    <div class="container">\n',
        '      <div class="header-inner">\n',
'        <div class="logo"><a href="/">🔴 Breaking News Boulevard</a></div>\n',
'        <nav class="nav"><a href="/">Home</a><a href="/about.html">About</a><a href="/impressum.html">Impressum</a></nav>\n',
'      </div>\n',
'    </div>\n',
'  </header>\n',
'\n',
'  <div class="ticker">\n',
'    <div class="ticker-inner">\n',
'      <span class="ticker-label">🔴 BREAKING</span>\n',
f'      <span id="ticker-text">{ticker}</span>\n',
'    </div>\n',
'  </div>\n',
'\n',
'  <section class="hero">\n',
'    <div class="container">\n',
'      <h1>Breaking News Boulevard</h1>\n',
'      <p>Your source for breaking news, in-depth analysis, and stories that matter.</p>\n',
'    </div>\n',
'  </section>\n',
'\n',
feat_h,
'\n',
'  <div class="container" style="padding:32px 20px 0;">\n',
'    <ins class="adsbygoogle" style="display:block;min-height:100px;" data-ad-client="ca-pub-4316838278696534" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>\n',
'  </div>\n',
'\n',
'  <section id="articles" class="articles">\n',
'    <div class="container">\n',
'      <h2 class="section-title">Latest Articles</h2>\n',
'      <div class="grid" id="articles-grid">\n',
grid_h,
'      </div>\n',
'    </div>\n',
'  </section>\n',
'\n',
'  <div class="container" style="padding:0 20px 32px;">\n',
'    <ins class="adsbygoogle" style="display:block;min-height:100px;" data-ad-client="ca-pub-4316838278696534" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>\n',
'  </div>\n',
'\n',
'  <footer class="footer">\n',
'    <div class="container">\n',
'      <p>&copy; 2026 Breaking News Boulevard. All Rights Reserved. | <a href="/impressum.html" style="color:#e94560;">Impressum</a> | <a href="/datenschutz.html" style="color:#e94560;">Datenschutz</a> | <a href="/about.html" style="color:#e94560;">About</a></p>\n',
'      <p style="margin-top:12px;font-size:0.8rem;color:#888;">⚠️ Some content on this site is AI-generated. Always verify with official sources.</p>\n',
'    </div>\n',
'  </footer>\n',
'\n',
'  <div id="cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;color:#fff;padding:16px 20px;z-index:9999;box-shadow:0 -4px 16px rgba(0,0,0,0.3);">\n',
'    <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">\n',
'      <div style="flex:1;min-width:280px;font-size:0.9rem;line-height:1.5;">\n',
'        Wir verwenden Cookies, um Ihnen die beste Erfahrung auf unserer Website zu bieten. Einige Cookies sind technisch notwendig, andere helfen uns, die Nutzung zu analysieren. Ihre Einwilligung ist freiwillig und kann jederzeit widerrufen werden. <a href="/datenschutz.html" style="color:#5dade2;text-decoration:underline;">Datenschutzerkl\u00e4rung</a>.\n',
'      </div>\n',
"      <div style=\"display:flex;gap:8px;flex-shrink:0;\">\n",
"        <button onclick=\"document.getElementById('cookie-banner').style.display='none';localStorage.setItem('cookieConsent','declined');\" style=\"background:transparent;border:1px solid rgba(255,255,255,0.3);color:#fff;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:0.85rem;\">Ablehnen</button>\n",
"        <button onclick=\"document.getElementById('cookie-banner').style.display='none';localStorage.setItem('cookieConsent','accepted');\" style=\"background:#2563eb;border:none;color:#fff;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:600;\">Akzeptieren</button>\n",
'      </div>\n',
'    </div>\n',
'  </div>\n',
'\n',
'  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YB2E0D5B4K"></script>\n',
'  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4316838278696534" crossorigin="anonymous"></script>\n',
'  <script>\n',
'  (adsbygoogle = window.adsbygoogle || []).push({});\n',
"  var cc = localStorage.getItem('cookieConsent');\n",
"  if(cc !== 'declined' && cc !== 'accepted') {\n",
"    document.addEventListener('DOMContentLoaded',function(){document.getElementById('cookie-banner').style.display='block';});\n",
'  }\n',
'  </script>\n',
'</body>\n',
'</html>\n',
]

html = ''.join(html_parts)

with open('index.html','w') as f: f.write(html)

print(f"\u2705 index.html rebuilt: 1 featured + {len(grid)} grid cards")
print(f"\u2705 Cookie banner included")  
print(f"\u2705 AI disclaimer in footer")
print(f"\u2705 2 AdSense slots placed")
print(f"\u2705 {len(articles)} total articles available")
