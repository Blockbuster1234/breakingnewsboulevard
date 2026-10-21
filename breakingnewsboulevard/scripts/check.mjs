import fs from 'node:fs';
import path from 'node:path';
import { SOURCES } from './lib/news.mjs';
import { countBodyWords, extractQuotes } from './lib/text.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');
const POSTS_DIR = path.join(ROOT, 'posts');

const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

let posts = [];
try {
  posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (error) {
  errors.push(`data/posts.json nicht lesbar: ${error.message}`);
}

check(Array.isArray(posts), 'data/posts.json muss ein Array sein');

let shortCount = 0;
const shortPerDay = new Map();

if (Array.isArray(posts)) {
  const seenSlugs = new Set();
  const seenSources = new Set();

  for (const post of posts) {
    const label = post.slug || '(ohne Slug)';
    const isShort = post.format === 'short';
    check(!post.format || isShort, `${label}: unbekanntes Artikelformat`);
    if (isShort) {
      shortCount += 1;
      shortPerDay.set(post.date, (shortPerDay.get(post.date) || 0) + 1);
    }

    check(/^[a-z0-9-]+$/.test(post.slug || ''), `${label}: ungültiger Slug`);
    check(!seenSlugs.has(post.slug), `${label}: doppelter Slug`);
    seenSlugs.add(post.slug);

    check(post.review?.status === 'approved', `${label}: nicht redaktionell freigegeben`);
    check(typeof post.review?.reviewer === 'string' && post.review.reviewer.length >= 2, `${label}: Reviewer fehlt`);
    check(Array.isArray(post.review?.checks) && post.review.checks.length >= 7, `${label}: Checkliste unvollständig`);

    check(Boolean(post.source?.name), `${label}: Quellenname fehlt`);
    check(Boolean(post.source?.url?.startsWith('https://')), `${label}: Quellen-URL fehlt`);
    check(Boolean(post.source?.termsUrl?.startsWith('https://')), `${label}: Nutzungsrechte-URL fehlt`);
    check(Boolean(post.source?.title), `${label}: Originaltitel fehlt`);
    check(Boolean(post.source?.license), `${label}: Lizenzangabe fehlt`);
    check(Boolean(post.source?.licenseUrl?.startsWith('https://')), `${label}: Lizenz-URL der Quelle fehlt`);
    check(Boolean(post.source?.credit), `${label}: Quellenangabe fehlt`);
    if (isShort) {
      check(['rss', 'full'].includes(post.source?.mode), `${label}: Kurzartikel ohne Quellenmodus`);
      check(!post.source?.publishedAt || !Number.isNaN(new Date(post.source.publishedAt).getTime()), `${label}: ungültiges Quellen-Datum`);
    }

    check(Boolean(post.imageCredit), `${label}: Bildurheber fehlt`);
    check(Boolean(post.imageLicense), `${label}: Bildlizenz fehlt`);
    check(Boolean(post.imageProvider), `${label}: Bildanbieter fehlt`);
    check(Boolean(post.imageAlt), `${label}: Bild-Alttext fehlt`);
    check(['photo', 'illustration'].includes(post.imageType), `${label}: Bildtyp fehlt oder ist ungültig`);
    if (isShort) check(post.imageType === 'illustration', `${label}: Kurzartikel benötigt eine KI-Illustration`);
    if (post.imageType === 'photo') {
      check(Boolean(post.imageLicenseUrl?.startsWith('https://')), `${label}: Lizenz-URL des Fotos fehlt`);
      check(Boolean(post.imageSourceUrl?.startsWith('https://')), `${label}: Bildquelle fehlt`);
    }

    check(!seenSources.has(post.source?.url), `${label}: Quelle mehrfach verwendet`);
    seenSources.add(post.source?.url);

    const activeSource = SOURCES.find((source) => source.name === post.source?.name);
    check(Boolean(activeSource), `${label}: Quelle steht nicht in der aktiven Registry`);
    if (activeSource) {
      let host = '';
      try {
        host = new URL(post.source.url).hostname.replace(/^www\./, '');
      } catch {
        host = '';
      }
      const allowedHost = new URL(activeSource.homepage).hostname.replace(/^www\./, '');
      check(
        Boolean(host) && (host === allowedHost || host.endsWith(`.${allowedHost}`)),
        `${label}: Quellen-URL passt nicht zur aktiven Quelle`,
      );
    }

    const words = countBodyWords(post.body);
    if (isShort) {
      check(words >= 45 && words <= 80, `${label}: ${words} Wörter statt 45-80`);
    } else {
      check(words >= 120 && words <= 180, `${label}: ${words} Wörter statt 120-180`);
    }

    const quotes = [
      ...extractQuotes(post.title),
      ...extractQuotes(post.excerpt),
      ...extractQuotes(post.body),
    ];
    if (isShort) {
      check(!quotes.length, `${label}: Kurzartikel enthält ein Zitat`);
      check(Boolean(post.excerpt) && post.excerpt.length <= 180, `${label}: Teaser fehlt oder ist zu lang`);
    } else {
      check(quotes.length <= 1, `${label}: mehr als ein Zitat`);
    }

    check(Boolean(post.url?.startsWith('/posts/')), `${label}: Artikel-URL ungültig`);
    const articlePath = path.join(ROOT, String(post.url || '').replace(/^\//, ''));
    check(fs.existsSync(articlePath), `${label}: Artikeldatei fehlt`);
    if (isShort && fs.existsSync(articlePath)) {
      const html = fs.readFileSync(articlePath, 'utf8');
      check(html.includes('Quelle:'), `${label}: sichtbarer Quellenhinweis fehlt`);
      check(html.includes('KI-generierte Illustration'), `${label}: Bildhinweis fehlt`);
      check(html.includes('KI-Hinweis:'), `${label}: KI-Hinweis fehlt`);
    }

    check(Boolean(post.image?.startsWith('/posts/')), `${label}: Bild-URL ungültig`);
    const imagePath = path.join(ROOT, String(post.image || '').replace(/^\//, ''));
    check(fs.existsSync(imagePath), `${label}: Bilddatei fehlt`);
  }

  for (const [date, count] of shortPerDay) {
    check(count <= 6, `${date}: ${count} Kurzartikel statt maximal 6`);
  }
}

if (fs.existsSync(POSTS_DIR)) {
  const referenced = new Set(posts.flatMap((post) => [post.url, post.image]).filter(Boolean));
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!/\.(html|webp|jpg|png)$/i.test(file)) continue;
    const publicPath = `/posts/${file}`;
    check(referenced.has(publicPath), `posts/${file}: nicht in data/posts.json referenziert`);
  }
}

const jsPath = path.join(ROOT, 'js', 'posts.js');
check(fs.existsSync(jsPath), 'js/posts.js fehlt');
if (fs.existsSync(jsPath)) {
  const js = fs.readFileSync(jsPath, 'utf8');
  for (const post of posts) check(js.includes(post.slug), `js/posts.js: ${post.slug} fehlt`);
}

const sitemapPath = path.join(ROOT, 'sitemap.xml');
check(fs.existsSync(sitemapPath), 'sitemap.xml fehlt');
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  for (const post of posts) check(sitemap.includes(post.url), `sitemap.xml: ${post.url} fehlt`);
}

if (errors.length) {
  console.error(`[check] ${errors.length} Fehler:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `[check] OK: ${posts.length} freigegebene Artikel, davon ${shortCount} Kurzartikel; alle Quellen aktiv, alle Dateien referenziert`,
  );
}
