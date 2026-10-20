import fs from 'node:fs';
import path from 'node:path';

export const SITE_URL = 'https://www.breakingnewsboulevard.com';
const ROOT = process.cwd();

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function humanDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function displayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

export function slugify(title, date) {
  const base = title
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 12)
    .join('-');
  return `${date}-${base || 'news'}`;
}

export function bodyToHtml(body) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('## ')) {
        const [heading, ...rest] = block.split('\n');
        const restText = rest.join('\n').trim();
        const headingHtml = `<h2>${escapeHtml(heading.slice(3).trim())}</h2>`;
        return restText ? `${headingHtml}\n        <p>${escapeHtml(restText)}</p>` : headingHtml;
      }
      return `<p>${escapeHtml(block)}</p>`;
    })
    .join('\n        ');
}

function fill(template, values) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split(`{{${key}}}`).join(value);
  }
  return output;
}

export function writePostPage(post) {
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'post.html'), 'utf8');
  const canonical = `${SITE_URL}${post.url}`;
  const source = post.source || {};
  const reviewedAt = post.review?.reviewedAt || `${post.date}T06:00:00Z`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt,
    datePublished: `${post.date}T06:00:00Z`,
    dateModified: reviewedAt,
    image: [`${SITE_URL}${post.image}`],
    mainEntityOfPage: canonical,
    inLanguage: 'de-DE',
    citation: source.url || undefined,
    isBasedOn: source.url || undefined,
    author: {
      '@type': 'Organization',
      name: 'Breaking News Boulevard',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Breaking News Boulevard',
      url: SITE_URL,
    },
    isAccessibleForFree: true,
  }).replace(/</g, '\\u003c');

  const licenseHtml = source.license
    ? source.licenseUrl
      ? `<a href="${escapeHtml(source.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.license)}</a>`
      : escapeHtml(source.license)
    : '';

  const html = fill(template, {
    TITLE: escapeHtml(post.title),
    EXCERPT: escapeHtml(post.excerpt),
    CATEGORY: escapeHtml(post.category),
    DATE_HUMAN: escapeHtml(humanDate(post.date)),
    DATE_ISO: post.date,
    IMAGE: post.image,
    IMAGE_ALT: escapeHtml(post.title),
    BODY: bodyToHtml(post.body),
    SOURCE_NAME: escapeHtml(source.name || 'Originalquelle'),
    SOURCE_URL: escapeHtml(source.url || '#'),
    SOURCE_TITLE: escapeHtml(source.title || ''),
    SOURCE_PUBLISHED: escapeHtml(displayDate(source.publishedAt)),
    SOURCE_CREDIT: escapeHtml(source.credit || ''),
    SOURCE_LICENSE: licenseHtml,
    SOURCE_REUSE_NOTE: escapeHtml(source.reuseNote || ''),
    REVIEW_NOTE:
      post.review?.status === 'approved'
        ? 'Dieser Artikel wurde vor Veröffentlichung automatisch geprüft.'
        : 'Dieser Artikel wurde noch nicht redaktionell freigegeben.',
    CANONICAL: canonical,
    JSONLD: jsonLd,
  });

  fs.writeFileSync(path.join(ROOT, 'posts', `${post.slug}.html`), html);
}

export function writeIndex(posts) {
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'index.html'), 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const html = fill(template, {
    DATE_HUMAN: escapeHtml(humanDate(today)),
    YEAR: String(new Date().getUTCFullYear()),
  });
  fs.writeFileSync(path.join(ROOT, 'index.html'), html);
}

export function writePostsJs(posts) {
  const slim = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    category: post.category,
    url: post.url,
    image: post.image,
    images: post.images,
    source: post.source.name,
    sourceUrl: post.source.url,
  }));
  const js = `const posts = ${JSON.stringify(slim, null, 2)};\n`;
  fs.mkdirSync(path.join(ROOT, 'js'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'js', 'posts.js'), js);
}

export function writeSitemap(posts) {
  const urls = [
    `<url><loc>${SITE_URL}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...posts.map(
      (post) =>
        `<url><loc>${SITE_URL}${post.url}</loc><lastmod>${post.date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  fs.writeFileSync(
    path.join(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  );
}

export function rebuildSite(posts) {
  writeIndex(posts);
  writePostsJs(posts);
  writeSitemap(posts);
}
