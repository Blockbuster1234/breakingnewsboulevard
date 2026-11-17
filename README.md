# Breaking News Boulevard

Live: https://www.breakingnewsboulevard.com

German-language news site that publishes itself: a scheduled GitHub Action
generates the day's articles from public wire sources, runs a quality/legal
review, publishes them as static HTML and pushes the change. Vercel deploys
every push, so the site is updated daily without manual work.

## What the buyer gets

- Domain breakingnewsboulevard.com (registered, auto-renew, privacy on)
- The complete site: source code, design, articles and the automation
- Zero running cost: free GitHub Actions minutes, free Vercel hosting,
  free-tier LLM APIs (Groq / Gemini) for text and images
- Legally prepared: Impressum, Datenschutz, source attribution and an
  AI/summary disclaimer on every article
- SEO baseline: sitemap.xml, robots.txt, canonical URLs, Open Graph tags,
  NewsArticle JSON-LD, English/German UI, mobile-first layout
- Google Search Console verified (domain property)

## Stack

- Static HTML/CSS, no framework, no database
- Node 22 scripts in `scripts/`, templates in `templates/`
- Articles: `data/posts.json` -> generated `posts/*.html` + `js/posts.js`
- Automation: `.github/workflows/daily-news.yml` (daily 06:47 UTC)

## Commands

```
npm ci
npm run generate:daily -- --count 3   # draft articles
npm run auto:publish                  # review + publish
npm test                              # validate the built site
```

## Structure

```
breakingnewsboulevard/
  index.html            generated home page
  posts/                generated article pages
  templates/            HTML templates (index.html, post.html)
  data/posts.json       all article data, the source of truth
  scripts/              generator, reviewer, publisher, legal checks
  legal/                Impressum, Datenschutz
  sitemap.xml robots.txt
```

## Handover

1. Transfer the domain (auth code from the registrar).
2. Transfer the GitHub repository and the Vercel project.
3. Add the API keys as repository secrets (GROQ_API_KEY, GEMINI_API_KEY).
4. Nothing else: the daily workflow keeps publishing.

Content is written by an AI pipeline and checked automatically before
publication; every article links the original source it summarises.
