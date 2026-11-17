#!/usr/bin/env node
/**
 * 1) KI-Bild passend zum Artikel, mit Ausweich-Quellen.
 * 2) Statische Startseite in index.html.
 */
import { readFile, writeFile } from 'node:fs/promises';

const LIMIT = 40;
const CARD_CAP = 40;
const IMAGE_API = 'https://image.pollinations.ai/prompt';
const IMAGE_STYLE = 'story-v2';
const IMAGE_LIMIT = Number(process.env.FIX_IMAGES_MAX || 2);
const MARKER_FILE = 'posts/image-style.json';
const START = Date.now();
const BUDGET_MS = 8 * 60 * 1000;
const IMAGE_WIDTH = 1536;
const IMAGE_HEIGHT = 864;

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

const scenePrompt = (post) =>
  [
    'One single realistic editorial news photograph, one scene, one frame, documentary press photography, sharp focus, high detail, natural daylight, 16:9:',
    clean(post.title) + '.',
    clean(post.excerpt).slice(0, 200),
    'Show the real world place and objects of the story. At most one person, only from behind or far away, never a face facing the camera. No collage, no split screen, no picture in picture, no repeated person, no twins, no duplicated figures, no mirrored people, no montage.',
    'No text, no words, no letters, no logos, no watermark, no recognizable politicians, no flags with emblems.'
  ].join(' ');

const seedOf = (value) => {
  let hash = 7;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  return hash;
};

const ROUTES = [
  (url) => url,
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url)
];

const grab = async (url) => {
  for (let i = 0; i < ROUTES.length; i++) {
    if (Date.now() - START > BUDGET_MS) {
      console.warn('[image] Zeitbudget aufgebraucht');
      return null;
    }
    try {
      const res = await fetch(ROUTES[i](url), {
        headers: { accept: 'image/jpeg,image/png,*/*' },
        signal: AbortSignal.timeout(90000)
      });
      if (!res.ok) {
        console.warn('[image] Quelle ' + (i + 1) + ': HTTP ' + res.status);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 20000) {
        console.warn('[image] Quelle ' + (i + 1) + ': Bild zu klein (' + buffer.length + ' B)');
        continue;
      }
      console.log('[image] Quelle ' + (i + 1) + ' geliefert (' + buffer.length + ' B)');
      return buffer;
    } catch (error) {
      console.warn('[image] Quelle ' + (i + 1) + ': ' + error.message);
    }
  }
  return null;
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
    const prompt = encodeURIComponent(scenePrompt(post));
    let buffer = null;
    for (const model of ['flux', 'turbo']) {
      const url =
        IMAGE_API +
        '/' +
        prompt +
        '?width=' +
        IMAGE_WIDTH +
        '&height=' +
        IMAGE_HEIGHT +
        '&model=' +
        model +
        '&nologo=true&safe=true&referrer=breakingnewsboulevard.com&seed=' +
        seedOf(post.slug);
      buffer = await grab(url);
      if (buffer) break;
    }
    if (!buffer) {
      console.warn('[image] ' + post.slug + ': keine Quelle lieferte ein Bild');
      continue;
    }
    await writeFile(target, buffer);
    marker[post.slug] = IMAGE_STYLE;
    changed += 1;
    console.log('[image] neues Bild passend zum Artikel: ' + post.slug);
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
  const block =
    '<div class="grid" id="grid">\n' + posts.map(cardMarkup).join('\n') + '\n      </div>';
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
