#!/usr/bin/env python3
"""Fix the 2 malformed posts (russian-oil-tanker, spain-closes) to clean static HTML."""

BLOG = "/data/data/com.termux/files/home/.openclaw/workspace/breakingnewsboulevard"

def fix_post(filename, title, image, category, date, author, url, body_html, excerpt=""):
    """Write a clean static HTML post file."""
    import os
    from html import escape
    
    filepath = os.path.join(BLOG, "posts", filename)
    
    # Build Schema.org
    import json
    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "url": f"https://www.breakingnewsboulevard.com{url}",
        "author": {"@type": "Person", "name": author},
        "publisher": {"@type": "Organization", "name": "Breaking News Boulevard"},
        "image": f"https://www.breakingnewsboulevard.com{image}",
        "datePublished": date
    }, indent=2)
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)} — Breaking News Boulevard</title>
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YB2E0D5B4K"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-YB2E0D5B4K');</script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4316838278696534" crossorigin="anonymous"></script>
  <meta name="description" content="{escape(excerpt[:155])}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(excerpt[:155])}">
  <meta property="og:image" content="https://www.breakingnewsboulevard.com{image}">
  <link rel="canonical" href="https://www.breakingnewsboulevard.com{url}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">
  {schema}
  </script>
  <style>
    :root{{--bg:#fff;--text:#1a1a2e;--text-light:#666;--accent:#2563eb;--accent-hover:#1d4ed8;--border:#e5e7eb;--card:#f8f9fa;--radius:12px;--shadow:0 2px 8px rgba(0,0,0,.08)}}
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.8}}
    a{{color:var(--accent);text-decoration:none;transition:color .2s}}
    a:hover{{color:var(--accent-hover)}}
    img{{max-width:100%;height:auto;display:block}}
    .container{{max-width:800px;margin:0 auto;padding:0 20px}}
    .header{{background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;background:rgba(255,255,255,.97);backdrop-filter:blur(12px)}}
    .header-inner{{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 20px}}
    .logo{{font-size:1.4rem;font-weight:800}}
    .logo a{{color:var(--text)}}
    .logo a:hover{{color:var(--accent)}}
    .nav{{display:flex;gap:24px}}
    .nav a{{color:var(--text-light);font-weight:500;font-size:.9rem}}
    .nav a:hover{{color:var(--accent)}}
    .article{{padding:48px 0}}
    .article-hero{{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);margin-bottom:32px;background:#e5e7eb}}
    .article h1{{font-size:2rem;font-weight:800;line-height:1.2;margin-bottom:16px;font-family:'Merriweather',serif}}
    .article-meta{{color:var(--text-light);font-size:.9rem;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid var(--border)}}
    .article-body{{font-size:1.05rem}}
    .article-body p{{margin-bottom:1.3em}}
    .article-body h2{{font-size:1.4rem;margin:2em 0 .6em;font-weight:700}}
    .category-tag{{display:inline-block;background:var(--accent);color:#fff;padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600;text-transform:uppercase;margin-bottom:16px}}
    .ad-placeholder{{background:#f0f0f0;border:2px dashed #ccc;border-radius:var(--radius);padding:40px;text-align:center;color:#999;margin:32px 0}}
    .footer{{background:#1a1a2e;color:rgba(255,255,255,.7);padding:40px 0;margin-top:48px;text-align:center}}
    .footer p{{font-size:.85rem;margin-bottom:8px}}
    @media(max-width:768px){{.article h1{{font-size:1.5rem}}.nav{{display:none}}}}
  </style>
</head>
<body>
<header class="header">
  <div class="header-inner">
    <div class="logo"><a href="/">Breaking News Boulevard</a></div>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/category/world.html">World</a>
      <a href="/category/tech.html">Tech</a>
      <a href="/category/health.html">Health</a>
      <a href="/category/science.html">Science</a>
    </nav>
  </div>
</header>

<article class="article">
  <div class="container">
    <img class="article-hero" src="{image}" alt="{escape(title)}" loading="lazy">
    <span class="category-tag">{category}</span>
    <h1>{title}</h1>
    <div class="article-meta">{date} &bull; By {author}</div>
    <div class="article-body">
{body_html}
    </div>
    <div class="ad-placeholder">
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-4316838278696534" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>
  </div>
</article>

<footer class="footer">
  <div class="container">
    <p>&copy; 2026 Breaking News Boulevard. All Rights Reserved.</p>
  </div>
</footer>
</body>
</html>"""
    with open(filepath, 'w') as f:
        f.write(html)
    print(f"✅ {filename} ({os.path.getsize(filepath)} bytes)")

# === Russian Oil Tanker ===
fix_post(
    "russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade.html",
    "Russian Oil Tanker Reaches Cuban Waters as Trump Appears to Loosen Blockade",
    "/images/russian-oil-tanker-cuba.jpg",
    "World",
    "March 25, 2026",
    "Breaking News Boulevard",
    "/posts/russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade.html",
    """<p>A Russian-flagged oil tanker entered Cuban territorial waters on Tuesday, arriving just hours after U.S. President Donald Trump told reporters he had "no problem" with the vessel's arrival. The ship, identified as the <em>Vladimir Monaco</em>, discharged its cargo at the port of Mariel, west of Havana, according to port authorities and satellite tracking data.</p>

<h2>The Vladimir Monaco</h2>
<p>The <em>Vladimir Monaco</em>, a Suezmax-class crude carrier registered in Saint Petersburg, left the Russian port of Novorossiysk carrying approximately 800,000 barrels of Urals blend crude. After transiting the Atlantic and passing through the Caribbean, the vessel altered its course toward Cuba, prompting monitoring by U.S. and regional maritime authorities. Cuban officials confirmed the tanker docked at the Mariel Special Development Zone at 03:15 local time, where it began offloading fuel destined for the island's power plants and transportation sector.</p>

<h2>Trump's Response</h2>
<p>Trump's comment came during a press briefing in Florida, where he was asked about reports of a Russian tanker heading to Cuba. "If they want to bring oil in, I have no problem with it," he said, adding that the United States should focus on "securing our own borders" rather than interfering with foreign shipments. The remark contrasted with the longstanding U.S. embargo that restricts most trade with Cuba, including energy exports, and with recent statements urging compliance with sanctions against Russia's energy sector.</p>

<h2>Cuba's Energy Crisis</h2>
<p>The arrival highlights the shifting dynamics of Cuba's energy supply. Since the deterioration of its longtime benefactor Venezuela's oil output, the island has faced recurring fuel shortages, prompting it to seek alternative sources. Russia, seeking to expand its influence in Latin America, has increased shipments of crude and refined products to Cuba over the past year, often routing vessels through third-party flags to evade scrutiny. The <em>Vladimir Monaco</em>'s voyage follows a similar delivery by the <em>Akademik Lomonosov</em> in June, which delivered liquefied natural gas to a Cuban power plant.</p>

<p>Cuban officials welcomed the shipment, stating that the crude would help stabilize electricity generation and reduce reliance on more expensive sources. For Cuban citizens who have endured rolling blackouts and fuel rationing, the arrival provided cautious optimism — even as questions about the broader geopolitical implications linger.</p>""",
    "A Russian-flagged oil tanker entered Cuban waters after Trump said he had 'no problem' with the arrival, highlighting shifting energy supply dynamics."
)

# === Spain Closes Airspace ===
fix_post(
    "spain-closes-airspace-to-us-aircraft-involved-in-iran-war.html",
    "Spain Restricts U.S. Military Flights Over Its Territory Amid Iran Tensions",
    "/images/spain-airspace-us-military.jpg",
    "World",
    "March 26, 2026",
    "Breaking News Boulevard",
    "/posts/spain-closes-airspace-to-us-aircraft-involved-in-iran-war.html",
    """<p>The Spanish government has announced that it will close its airspace to U.S. aircraft engaged in operations related to the ongoing Iran conflict and will deny American forces the use of two jointly operated military installations in the Andalusia region. The decision, communicated by the Ministry of Defence, marks a notable shift in Spain's traditionally cooperative stance with the United States on defence matters.</p>

<h2>Morón and Rota Restricted</h2>
<p>According to the statement, the restriction applies to all U.S. military flights that are "directly supporting or participating in actions against Iran," including reconnaissance, refuelling and combat sorties. The two affected facilities are Morón Air Base, near Seville, and Naval Station Rota, located on the Atlantic coast near Cádiz. Both bases have hosted U.S. personnel and equipment under bilateral agreements dating back to the 1950s, serving as strategic hubs for NATO operations in the Mediterranean and Atlantic.</p>

<h2>Spain's Position</h2>
<p>Spanish officials said the move follows a careful assessment of the country's legal obligations under international law and its own constitutional provisions regarding the use of national territory for foreign military activities. "Spain remains committed to its NATO allies and to the preservation of regional stability," the ministry noted. "However, we cannot allow our territory to be used for actions that may escalate tensions in a volatile region without a clear mandate from the United Nations or broad international consensus."</p>

<h2>International Reaction</h2>
<p>The decision comes amid heightened friction between Washington and Tehran, which has intensified since the U.S. withdrawal from the 2015 Joint Comprehensive Plan of Action (JCPOA) and the subsequent reimposition of sanctions. In recent months, U.S. forces have conducted a series of patrols and show-of-force missions in the Gulf, prompting concerns among European capitals about the risk of inadvertent escalation. Spain, while a NATO member, has repeatedly called for diplomatic solutions and has voiced unease over unilateral military actions that lack multilateral endorsement.</p>

<h2>Domestic and Military Impact</h2>
<p>Domestically, the announcement has drawn mixed reactions. Opposition parties praised the government for asserting national sovereignty, arguing that the basing arrangements should be subject to greater parliamentary oversight. Supporters of the U.S. partnership warned that the restriction could strain bilateral defence cooperation and affect joint training exercises that have been conducted at Morón and Rota for decades. Defence analysts noted that, while the closure of airspace will require U.S. planners to reroute certain missions, the impact on overall operational capacity is likely limited, given the availability of alternative bases in Italy, Greece and Turkey.</p>

<p>The Spanish government emphasized that the measure is reversible and subject to review. "We will continue to engage with our American partners through NATO channels to address security concerns in a manner that respects international law and promotes peaceful resolution of the conflict," the ministry concluded.</p>""",
    "Spain closes airspace to U.S. military flights involved in Iran operations, restricting access to Morón Air Base and Naval Station Rota."
)

print("\n✅ Malformed posts fixed!")
