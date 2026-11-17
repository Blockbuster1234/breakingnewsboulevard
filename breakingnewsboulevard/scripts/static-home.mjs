#!/usr/bin/env node
/**
 * 1) Ersetzt die Symbolbilder durch KI-Bilder, die den Artikel zeigen.
 * 2) Baut aus js/posts.js eine statische Artikel-Liste in index.html ein.
 *
 * Beides laeuft nach dem Veroeffentlichen und vor dem Commit.
 */
import { readFile, writeFile } from 'node:fs/promises';

const LIMIT = 40;
const CARD_CAP = 40;
const IMAGE_API = 'https://image.pollinations.ai/prompt';
const IMAGE_STYLE = 'story-v1';
const IMAGE_LIMIT = Number(process.env.FIX_IMAGES_MAX || 2);
const MARKER_FILE = 'posts/image-style.json';

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

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const scenePrompt = (post) => {
  const title = clean(post.title);
  const excerpt = clean(post.excerpt).slice(0, 220);
  const category = clean(post.category) || 'Nachrichten';
  return [
    'Realistic editorial news photograph that shows this exact story:',
    title + '.',
    excerpt,
    'Show the concrete real-world scene and objects of the story, people only seen from behind or at a distance, natural daylight, documentary press photography, shallow depth of field, 16:9.',
    'No text, no words, no lettering, no logos, no watermark, no recognizable politicians, no flags with emblems.'
  ].join(' ');
};

const seedOf = (value) => {
  let hash = 7;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  return hash;
};

const refreshImages = async (posts) => {
  let marker = {};
  try {
    marker = JSON.parse(await readFile(MARKER_FILE, 'utf8'));
  } catch {
    marker = {};
  }
  const open = posts
    .filter((post) => post.image && marker[post.slug] !== IMAGE_STYLE)
    .slice(0, IMAGE_LIMIT);
  let changed = 0;
  for (const post of open) {
    const target = String(post.image).replace(/^\//, '');
    const url =
      IMAGE_API +
      '/' +
      encodeURIComponent(scenePrompt(post)) +
      '?width=1280&height=720&model=flux&nologo=true&seed=' +
      seedOf(post.slug);
    try {
      const response = await fetch(url, {
        headers: { accept: 'image/jpeg' },
        signal: AbortSignal.timeout(150000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 20000) throw new Error('Bild zu klein (' + buffer.length + ' B)');
      await writeFile(target, buffer);
      marker[post.slug] = IMAGE_STYLE;
      changed += 1;
      console.log('[image] neues Bild passend zum Artikel: ' + post.slug);
    } catch (error) {
      console.warn('[image] ' + post.slug + ': ' + error.message);
    }
  }
  if (changed) await writeFile(MARKER_FILE, JSON.stringify(marker, null, 2) + '\n');
  return changed;
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
  const all = await readPosts();
  const changedImages = await refreshImages(all);
  console.log('[image] Bilder erneuert: ' + changedImages);

  const posts = all.slice(0, LIMIT);
  const html = await readFile('index.html', 'utf8');
  const grid = /<div class="grid" id="grid">[\s\S]*?<\/div>/;
  if (!grid.test(html)) {
    throw new Error('index.html: <div class="grid" id="grid"> nicht gefunden');
  }
  const block = '<div class="grid" id="grid">\n' + posts.map(cardMarkup).join('\n') + '\n      </div>';
  let next = html.replace(grid, block);
  next = next.replace(/rest\.slice\(\s*3\s*,\s*\d+\s*\)/g, 'rest.slice(3, ' + CARD_CAP + ')');

  if (!next.includes('application/rss+xml')) {
    next = next.replace(
      '</head>',
      '  <link rel="alternate" type="application/rss+xml" title="Breaking News Boulevard RSS" href="/feed.xml">\n</head>'
    );
  }
  await writeFile('index.html', next);
  console.log('[static] ' + posts.length + ' Artikel fest in index.html eingebaut, Karten-Limit ' + CARD_CAP);
};

main().catch((error) => {
  console.error('[static] Fehler: ' + error.message);
  process.exit(1);
});
