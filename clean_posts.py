#!/usr/bin/env python3
"""Clean up posts.js and add 3 diverse articles."""

with open('js/posts.js', 'r') as f:
    lines = f.readlines()

# Keep up to and including the line with artemis body: "" (clean ending)
# Find the artemis article closing
keep_lines = []
found_artemis = False
for i, line in enumerate(lines):
    keep_lines.append(line)
    if 'artemis-ii-leaves-earth-orbit' in line:
        found_artemis = True
    if found_artemis and line.strip() == '},':
        # This is the comma after artemis - perfect cut point
        break

with open('new_posts.js', 'w') as f:
    f.writelines(keep_lines)
    f.write('\n  {\n')
    f.write('    slug: "germany-eu-ai-law-april-2026",\n')
    f.write('    title: "EU Passes World\'s First Comprehensive AI Law \u2014 Tech Giants Face Strict New Rules",\n')
    f.write('    excerpt: "The European Parliament has approved groundbreaking AI legislation that forces tech companies to label AI-generated content and face fines up to 7%% of global revenue.",\n')
    f.write('    image: "/images/eu-ai-law-2026.jpg",\n')
    f.write('    category: "Tech",\n')
    f.write('    date: "April 4, 2026",\n')
    f.write('    author: "Breaking News Boulevard",\n')
    f.write('    url: "/posts/germany-eu-ai-law-april-2026.html",\n')
    f.write('    body: ``\n')
    f.write('  },\n')
    f.write('\n  {\n')
    f.write('    slug: "bundesliga-bayern-loses-title-race-april-2026",\n')
    f.write('    title: "Bundesliga Shock: Bayern Munich Stumbles as Underdogs Close In on Title",\n')
    f.write('    excerpt: "Bayern Munich\'s 13-year winning streak is in danger after consecutive losses put Bayer Leverkusen in position to claim their second straight Bundesliga title.",\n')
    f.write('    image: "/images/bundesliga-title-race-2026.jpg",\n')
    f.write('    category: "Sports",\n')
    f.write('    date: "April 4, 2026",\n')
    f.write('    author: "Breaking News Boulevard",\n')
    f.write('    url: "/posts/bundesliga-bayern-loses-title-race-april-2026.html",\n')
    f.write('    body: ``\n')
    f.write('  },\n')
    f.write('\n  {\n')
    f.write('    slug: "who-declares-end-of-covid-pandemic-april-2026",\n')
    f.write('    title: "WHO Declares Official End of Global COVID-19 Pandemic Era After Four Years",\n')
    f.write('    excerpt: "The World Health Organization has declared the end of the COVID-19 pandemic era after four years of disruption. Global cases have dropped by 95%% from their peak.",\n')
    f.write('    image: "/images/who-end-pandemic-2026.jpg",\n')
    f.write('    category: "Health",\n')
    f.write('    date: "April 4, 2026",\n')
    f.write('    author: "Breaking News Boulevard",\n')
    f.write('    url: "/posts/who-declares-end-of-covid-pandemic-april-2026.html",\n')
    f.write('    body: ``\n')
    f.write('  }\n')
    f.write('];\n')

import os
os.rename('new_posts.js', 'js/posts.js')
print("Done - posts.js cleaned and 3 new articles added")
