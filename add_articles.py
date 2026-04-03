#!/usr/bin/env python3
"""Add new articles ONLY if not already present."""
import re

NEW = '''
  {
    slug: "germany-eu-ai-law-april-2026",
    title: "EU Passes World's First Comprehensive AI Law — Tech Giants Face Strict New Rules",
    excerpt: "The European Parliament has approved groundbreaking AI legislation that forces tech companies to label AI-generated content and face fines up to 7% of global revenue.",
    image: "/images/eu-ai-law-2026.jpg",
    category: "Tech",
    date: "April 4, 2026",
    author: "Breaking News Boulevard",
    url: "/posts/germany-eu-ai-law-april-2026.html",
    body: ``
  },

  {
    slug: "bundesliga-bayern-loses-title-race-april-2026",
    title: "Bundesliga Shock: Bayern Munich Stumbles as Underdogs Close In on Title",
    excerpt: "Bayern Munich's 13-year winning streak is in danger after consecutive losses put Bayer Leverkusen in position to claim their second straight Bundesliga title.",
    image: "/images/bundesliga-title-race-2026.jpg",
    category: "Sports",
    date: "April 4, 2026",
    author: "Breaking News Boulevard",
    url: "/posts/bundesliga-bayern-loses-title-race-april-2026.html",
    body: ``
  },

  {
    slug: "who-declares-end-of-covid-pandemic-april-2026",
    title: "WHO Declares Official End of Global COVID-19 Pandemic Era After Four Years",
    excerpt: "The World Health Organization has declared the end of the COVID-19 pandemic era after four years of disruption. Global cases have dropped by 95%% from their peak.",
    image: "/images/who-end-pandemic-2026.jpg",
    category: "Health",
    date: "April 4, 2026",
    author: "Breaking News Boulevard",
    url: "/posts/who-declares-end-of-covid-pandemic-april-2026.html",
    body: ``
  },

'''

with open('js/posts.js', 'r') as f:
    content = f.read()

# Check if already added
if 'germany-eu-ai-law' in content:
    print("New articles already present, skipping insert")
    count = len(re.findall(r"slug:\s*['\"]", content))
    print(f"Total articles: {count}")
    exit(0)

content = content.rstrip()
if content.endswith('];'):
    content = content[:-2] + NEW + '];'

with open('js/posts.js', 'w') as f:
    f.write(content)

count = len(re.findall(r"slug:\s*['\"]", content))  
print(f"Added 3 new articles. Total: {count}")
