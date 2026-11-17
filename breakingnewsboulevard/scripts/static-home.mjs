#!/usr/bin/env node
/**
 * Baut aus js/posts.js eine statische Artikel-Liste in index.html ein.
 * Vorteil: Suchmaschinen und Besucher ohne JavaScript sehen alle Artikel
 * als echte Links. Die Startseite ersetzt die Liste beim Laden per
 * JavaScript - es wird also nichts doppelt angezeigt.
 */
import { readFile, writeFile } from 'node:fs/promises';

const LIMIT = 40;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const humanDate = (iso) => {
  const date = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(date.getTime())) return iso || '';
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

const readPosts = async () => {
  const source = await readFile('js/posts.js', 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error('js/posts.js enthaelt keine Artikel-Liste');
  }
  return JSON.parse(source.slice(start, end + 1));
};

const cardMarkup = (post) => {
  const image = post.image || (Array.isArray(post.images) ? post.images[0] : '') || '';
  const lines = [
    '        <article class="card">',
    '          <a class="card-link" href="' + esc(post.url) + '">'
  ];
  if (image) {
    lines.push(
      '            <img src="' + esc(image) + '" alt="' + esc(post.title) + '" loading="lazy" width="640" height="360">'
    );
  }
  lines.push(
    '            <span class="kicker">' + esc(post.category || 'Nachrichten') + '</span>',
    '            <h3>' + esc(post.title) + '</h3>',
    '            <p>' + esc(post.excerpt) + '</p>',
    '            <span class="meta">' + esc(humanDate(post.date)) + '</span>',
    '          </a>',
    '        </article>'
  );
  return lines.join('\n');
};

const main = async () => {
  const posts = (await readPosts()).slice(0, LIMIT);
  const html = await readFile('index.html', 'utf8');
  const grid = /<div class="grid" id="grid">[\s\S]*?<\/div>/;
  if (!grid.test(html)) {
    throw new Error('index.html: <div class="grid" id="grid"> nicht gefunden');
  }
  const block = '<div class="grid" id="grid">\n' + posts.map(cardMarkup).join('\n') + '\n      </div>';
  let next = html.replace(grid, block);
  if (!next.includes('application/rss+xml')) {
    next = next.replace(
      '</head>',
      '  <link rel="alternate" type="application/rss+xml" title="Breaking News Boulevard RSS" href="/feed.xml">\n</head>'
    );
  }
  await writeFile('index.html', next);
  console.log('[static] ' + posts.length + ' Artikel fest in index.html eingebaut');
};

main().catch((error) => {
  console.error('[static] Fehler: ' + error.message);
  process.exit(1);
});
