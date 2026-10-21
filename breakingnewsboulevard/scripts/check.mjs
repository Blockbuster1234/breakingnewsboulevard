import fs from 'node:fs';
import path from 'node:path';
import { SOURCES } from './lib/news.mjs';
import { BRIEFS_PAGE, BRIEF_SOURCES, isAllowedBriefUrl } from './lib/briefs.mjs';
import { countBodyWords, countWords, extractQuotes } from './lib/text.mjs';

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

if (Array.isArray(posts)) {
  const seenSlugs = new Set();
  const seenSources = new Set();

  for (const post of posts) {
    const label = post.slug || '(ohne Slug)';
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
    check(Boolean(post.imageCredit), `${label}: Bildurheber fehlt`);
    check(Boolean(post.imageLicense), `${label}: Bildlizenz fehlt`);
    check(['photo', 'illustration'].includes(post.imageType), `${label}: Bildtyp fehlt oder ist ungültig`);
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
    check(words >= 120 && words <= 180, `${label}: ${words} Wörter statt 120-180`);
    const quotes = [
      ...extractQuotes(post.title),
      ...extractQuotes(post.excerpt),
      ...extractQuotes(post.body),
    ];
    check(quotes.length <= 1, `${label}: mehr als ein Zitat`);

    check(Boolean(post.url?.startsWith('/posts/')), `${label}: Artikel-URL ungültig`);
    const articlePath = path.join(ROOT, String(post.url || '').replace(/^\//, ''));
    check(fs.existsSync(articlePath), `${label}: Artikeldatei fehlt`);
    check(Boolean(post.image?.startsWith('/posts/')), `${label}: Bild-URL ungültig`);
    const imagePath = path.join(ROOT, String(post.image || '').replace(/^\//, ''));
    check(fs.existsSync(imagePath), `${label}: Bilddatei fehlt`);
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

const briefsPath = path.join(ROOT, 'data', 'briefs.json');
let briefItems = [];
check(fs.existsSync(briefsPath), 'data/briefs.json fehlt');
if (fs.existsSync(briefsPath)) {
  let briefsData = null;
  try {
    briefsData = JSON.parse(fs.readFileSync(briefsPath, 'utf8'));
  } catch (error) {
    errors.push(`data/briefs.json nicht lesbar: ${error.message}`);
  }

  if (briefsData) {
    check(typeof briefsData.updatedAt === 'string', 'data/briefs.json: updatedAt fehlt');
    check(Array.isArray(briefsData.days), 'data/briefs.json: days muss ein Array sein');
    const days = Array.isArray(briefsData.days) ? briefsData.days : [];
    const seenDates = new Set();
    const seenIds = new Set();
    const seenUrls = new Set();

    for (const day of days) {
      const date = day?.date || '(ohne Datum)';
      check(/^\d{4}-\d{2}-\d{2}$/.test(date), `${date}: ungültiges Brief-Datum`);
      check(!seenDates.has(date), `${date}: doppelter Brief-Tag`);
      seenDates.add(date);
      check(Array.isArray(day?.items), `${date}: Brief-Items fehlen`);
      const items = Array.isArray(day?.items) ? day.items : [];
      check(items.length <= 10, `${date}: mehr als 10 Kurzmeldungen`);

      for (const item of items) {
        const label = item.id || `${date}/ohne-id`;
        check(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(item.id || ''), `${label}: ungültige ID`);
        check(!seenIds.has(item.id), `${label}: doppelte Brief-ID`);
        seenIds.add(item.id);
        check(Boolean(item.headline), `${label}: Überschrift fehlt`);
        check(Boolean(item.text), `${label}: Text fehlt`);
        check(!('description' in item) && !('title' in item), `${label}: Originaltextfeld gespeichert`);
        check(!('image' in item), `${label}: Bildfeld ist nicht erlaubt`);
        const words = countWords(`${item.headline || ''} ${item.text || ''}`);
        check(words >= 10 && words <= 50, `${label}: ${words} Wörter statt 10-50`);
        check(!extractQuotes(`${item.headline || ''} ${item.text || ''}`).length, `${label}: Zitat enthalten`);
        check(
          !/\b(Reuters|BBC|Tagesschau|Guardian|Al Jazeera|DW)\b/i.test(item.text || ''),
          `${label}: Quellenname im Text`,
        );

        const source = BRIEF_SOURCES.find((entry) => entry.name === item.sourceName);
        check(Boolean(source), `${label}: Quelle nicht in der Brief-Registry`);
        if (source) {
          check(item.sourceId === source.id, `${label}: sourceId passt nicht zur Quelle`);
          check(item.sourceVia === (source.via || ''), `${label}: sourceVia passt nicht zur Quelle`);
          check(Boolean(item.sourceUrl?.startsWith('https://')), `${label}: Quellen-URL fehlt`);
          check(isAllowedBriefUrl(source, item.sourceUrl), `${label}: Quellen-Host nicht erlaubt`);
          check(!seenUrls.has(item.sourceUrl), `${label}: doppelte Quellen-URL`);
          seenUrls.add(item.sourceUrl);
        }
        check(
          !item.publishedAt || !Number.isNaN(new Date(item.publishedAt).getTime()),
          `${label}: ungültiges publishedAt`,
        );
        briefItems.push(item);
      }
    }
  }
}

const briefsPagePath = path.join(ROOT, BRIEFS_PAGE);
check(fs.existsSync(briefsPagePath), `${BRIEFS_PAGE} fehlt`);
if (fs.existsSync(briefsPagePath)) {
  const page = fs.readFileSync(briefsPagePath, 'utf8');
  check(!/<img\b/i.test(page), `${BRIEFS_PAGE}: Bilder sind in Kurzmeldungen nicht erlaubt`);
  check(page.includes('Quelle:'), `${BRIEFS_PAGE}: Quellenangabe fehlt`);
  for (const item of briefItems) {
    check(page.includes(item.headline), `${BRIEFS_PAGE}: ${item.id} fehlt`);
  }
}

const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  const index = fs.readFileSync(indexPath, 'utf8');
  check(index.includes('Weltnachrichten kurz'), 'index.html: Brief-Bereich fehlt');
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
  check(sitemap.includes(`/${BRIEFS_PAGE}`), `sitemap.xml: /${BRIEFS_PAGE} fehlt`);
}

if (errors.length) {
  console.error(`[check] ${errors.length} Fehler:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `[check] OK: ${posts.length} freigegebene Artikel, ${briefItems.length} Kurzmeldungen, alle Quellen aktiv, alle Dateien referenziert`,
  );
}
