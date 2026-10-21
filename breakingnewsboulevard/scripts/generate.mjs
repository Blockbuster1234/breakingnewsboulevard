import fs from 'node:fs';
import path from 'node:path';
import {
  BLOCKED_SOURCES,
  SOURCES,
  collectCandidates,
  extractArticle,
  isSimilarTitle,
  isSourceEnabled,
} from './lib/news.mjs';
import { rewriteArticle, generateImage, pollinationsKey } from './lib/ai.mjs';
import { rebuildSite, slugify } from './lib/render.mjs';
import { sleep } from './lib/http.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');
const POSTS_DIR = path.join(ROOT, 'posts');
const REVIEW_DIR = path.join(ROOT, 'review', 'queue');
const MAX_DAILY = 6;

const NAME_STOPWORDS = new Set(
  `aber alle allem allen aller alles als also am an auch auf aus bei beim bin bis da damit dann das dass dem den denn der des die dies diese diesem diesen dieser dieses doch dort du durch ein eine einem einen einer eines er es fuer gegen gewesen gibt hat hatte haben hier hin hinter ich im in ist ja jede jeder jedes kann kein keine koennen man mehr mit muss nach nicht nichts noch nun nur ob oder ohne sehr sein seine sich sie sind so ueber um und uns unser unter viel vom von vor war waren was weg weil weiter welche wenn werden wie wieder wir wird wo zu zum zur zwar zwischen fuer gegenueber koennen ueber die der das ein eine the and with from that this those these after before about into their there where while according over under more than have has been were was will news update updates live latest report reports first last also just only very much many some such other another`.split(
    /\s+/,
  ),
);

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

function loadPosts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadDrafts() {
  if (!fs.existsSync(REVIEW_DIR)) return [];
  return fs
    .readdirSync(REVIEW_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(REVIEW_DIR, entry.name, 'post.json'), 'utf8'),
        );
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function uniqueSlug(title, date, posts) {
  const base = slugify(title, date);
  let slug = base;
  let counter = 2;
  const taken = new Set(posts.map((post) => post.slug));
  while (
    taken.has(slug) ||
    fs.existsSync(path.join(POSTS_DIR, `${slug}.html`)) ||
    fs.existsSync(path.join(REVIEW_DIR, slug))
  ) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function formatDate(value) {
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

function namedEntities(text) {
  const matches = String(text || '').match(/\b[\p{Lu}][\p{L}'-]{2,}\b/gu) || [];
  return new Set(
    matches
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 4 && !NAME_STOPWORDS.has(word)),
  );
}

function sharesStory(a, b) {
  const left = namedEntities(a);
  const right = namedEntities(b);
  if (!left.size || !right.size) return false;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common >= 2;
}

function buildCredit(source, article) {
  if (source.rss) return `Quelle: ${source.name}; RSS-Kurzbeschreibung; eigene Zusammenfassung.`;
  if (source.id === 'bgh') {
    const date = formatDate(article.publishedAt);
    return date
      ? `Pressemitteilung des Bundesgerichtshofs vom ${date}.`
      : 'Pressemitteilung des Bundesgerichtshofs.';
  }
  if (source.id === 'destatis') {
    const parsed = article.publishedAt ? new Date(article.publishedAt) : new Date();
    const year = Number.isNaN(parsed.getTime()) ? new Date().getUTCFullYear() : parsed.getUTCFullYear();
    return `Quelle: Statistisches Bundesamt (Destatis), ${year}.`;
  }
  if (source.id === 'ec-press') {
    return 'Quelle: Europäische Kommission; Lizenz CC BY 4.0; Änderungen vorgenommen.';
  }
  if (source.id === 'nasa') {
    return 'Quelle: NASA; NASA Media Usage Guidelines; Quellenangabe.';
  }
  if (source.id === 'us-cisa') {
    return 'Quelle: US Cybersecurity and Infrastructure Security Agency (CISA), US-Regierung; Public Domain.';
  }
  if (source.id === 'uk-gov') {
    return 'Quelle: UK Government; Open Government Licence v3.0.';
  }
  if (source.id === 'wikinews') {
    return 'Quelle: Wikinews (englisch), Autoren; Lizenz CC BY 4.0 (ältere Artikel ggf. CC BY 2.5).';
  }
  return `Quelle: ${source.name}.`;
}

function sourceMeta(source, candidate, article) {
  return {
    name: source.name,
    title: article.title,
    url: article.url || candidate.url,
    termsUrl: source.termsUrl,
    license: source.license,
    licenseUrl: source.licenseUrl,
    credit: buildCredit(source, article),
    reuseNote: source.reuseNote,
    language: source.language || 'de',
    mode: source.rss ? 'rss' : 'full',
    publishedAt: article.publishedAt || candidate.publishedAt || '',
  };
}

function saveDraft(post, article, image) {
  const dir = path.join(REVIEW_DIR, post.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'post.json'), `${JSON.stringify(post, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'source.txt'), `${article.title}\n\n${article.text}\n`);
  fs.writeFileSync(path.join(dir, `hero.${image.ext}`), image.buffer);
  return dir;
}

async function main() {
  const requested = Math.max(0, Number(argValue('--count', String(MAX_DAILY))) || 0);
  const posts = loadPosts();
  const drafts = loadDrafts();
  const date = new Date().toISOString().slice(0, 10);
  const alreadyToday = [...posts, ...drafts].filter(
    (post) => post.date === date && post.format === 'short',
  ).length;
  const count = Math.min(requested, Math.max(0, MAX_DAILY - alreadyToday));

  if (count === 0) {
    rebuildSite(posts);
    console.log(`[site] rebuilt with ${posts.length} approved posts (daily target reached or none requested)`);
    return;
  }

  const apiKey = pollinationsKey();
  if (!apiKey) {
    throw new Error('POLLINATIONS_API_KEY fehlt; KI-Illustrationen können nicht erzeugt werden');
  }
  const keyType = apiKey.startsWith('sk_')
    ? 'Secret Key'
    : apiKey.startsWith('pk_')
      ? 'Publishable/App Key'
      : 'unbekannter Typ';
  console.log(`[key] ${keyType} (${apiKey.length} Zeichen)`);

  const activeSources = SOURCES.filter((source) => isSourceEnabled(source) && source.daily);
  console.log(
    `[sources] ${activeSources.map((source) => source.name).join(', ') || 'keine'}; ${BLOCKED_SOURCES.length} Quellen gesperrt`,
  );

  const usedUrls = new Set(
    [...posts, ...drafts].map((post) => normalizeUrl(post.source?.url || '')).filter(Boolean),
  );
  const titles = [...posts, ...drafts].map((post) => post.title);

  console.log(
    `[start] ${date} — approved: ${posts.length}, drafts: ${drafts.length}, target: ${count}`,
  );

  const candidates = await collectCandidates(32, { dailyOnly: true });
  console.log(
    `[news] ${candidates.length} candidates from ${new Set(candidates.map((c) => c.sourceId)).size} sources`,
  );

  let created = 0;
  const acceptedStories = [];

  for (const candidate of candidates) {
    if (created >= count) break;
    if (usedUrls.has(normalizeUrl(candidate.url))) continue;
    if (titles.some((title) => isSimilarTitle(title, candidate.title))) continue;
    if (acceptedStories.some((story) => sharesStory(story, `${candidate.title} ${candidate.description || ''}`))) {
      console.log(`[skip] duplicate story across sources: ${candidate.title}`);
      continue;
    }

    try {
      console.log(`[fetch] ${candidate.source}: ${candidate.title}`);
      const article = await extractArticle(candidate);

      if (titles.some((title) => isSimilarTitle(title, article.title))) {
        console.log(`[skip] duplicate story: ${article.title}`);
        continue;
      }

      const source = SOURCES.find((item) => item.id === candidate.sourceId);
      console.log(`[write] AI short article (${article.text.length} chars source)`);
      const rewritten = await rewriteArticle({
        sourceName: source.name,
        sourceTitle: article.title,
        sourceText: article.text,
        sourceLanguage: article.language,
      });

      if (titles.some((title) => isSimilarTitle(title, rewritten.title))) {
        console.log(`[skip] rewritten title duplicates an existing story: ${rewritten.title}`);
        continue;
      }

      console.log(`[image] KI-Illustration: ${rewritten.imagePrompt}`);
      const image = await generateImage(rewritten.imagePrompt, undefined, rewritten.category);
      const imageMeta = {
        imageCredit: 'Pollinations / FLUX.1 schnell',
        imageLicense: 'KI-generiert mit Pollinations (FLUX.1 schnell)',
        imageLicenseUrl: '',
        imageSourceUrl: '',
        imageType: 'illustration',
        imageProvider: 'Pollinations',
        imageAlt: `KI-generierte Illustration: ${rewritten.title}`,
      };
      console.log(`[image] Pollinations / FLUX.1 schnell (${image.ext})`);

      const slug = uniqueSlug(rewritten.title, date, [...posts, ...drafts]);
      const post = {
        slug,
        title: rewritten.title,
        excerpt: rewritten.excerpt,
        date,
        category: rewritten.category,
        url: `/posts/${slug}.html`,
        image: '',
        images: [],
        heroFile: `hero.${image.ext}`,
        format: 'short',
        source: sourceMeta(source, candidate, article),
        body: rewritten.body,
        imagePrompt: rewritten.imagePrompt,
        ...imageMeta,
        wordCount: rewritten.wordCount,
        sourcePublishedAt: article.publishedAt || candidate.publishedAt || '',
        createdAt: new Date().toISOString(),
        review: { status: 'draft' },
      };

      const dir = saveDraft(post, article, image);
      drafts.push(post);
      titles.push(post.title);
      acceptedStories.push(`${candidate.title} ${candidate.description || ''}`);
      usedUrls.add(normalizeUrl(candidate.url));
      created += 1;

      console.log(`[draft] ${post.title} -> ${path.relative(ROOT, dir)}`);

      if (created < count) await sleep(8000);
    } catch (error) {
      console.warn(`[skip] ${candidate.url} — ${error.message}`);
      if (created < count) await sleep(5000);
    }
  }

  rebuildSite(posts);
  console.log(
    `[done] created ${created}/${count} review drafts; live site still has ${posts.length} approved posts`,
  );

  if (created === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[fatal] ${error.stack || error.message}`);
  process.exit(1);
});
