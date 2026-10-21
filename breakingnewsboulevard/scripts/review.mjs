import fs from 'node:fs';
import path from 'node:path';
import { rebuildSite, writePostPage } from './lib/render.mjs';
import { SOURCES } from './lib/news.mjs';
import {
  countBodyWords,
  countWords,
  extractQuotes,
  findLongOverlap,
  findStructureIssues,
  findUnsupportedClaims,
  normalizeForMatch,
} from './lib/text.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');
const POSTS_DIR = path.join(ROOT, 'posts');
const REVIEW_DIR = path.join(ROOT, 'review', 'queue');
const APPROVED_DIR = path.join(ROOT, 'review', 'approved');
const REJECTED_DIR = path.join(ROOT, 'review', 'rejected');
const CHECKS = [
  'names',
  'roles',
  'numbers',
  'facts',
  'timeliness',
  'source',
  'quote',
  'grounding',
  'structure',
];

function fail(message) {
  console.error(`[review] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
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

function savePosts(posts) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(posts.slice(0, 180), null, 2)}\n`);
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

function loadDraft(id) {
  if (!id || !/^[a-z0-9-]+$/.test(id)) fail('Entwurfs-ID fehlt oder ist ungültig');
  const dir = path.join(REVIEW_DIR, id);
  if (!dir.startsWith(`${REVIEW_DIR}${path.sep}`) || !fs.existsSync(dir)) {
    fail(`Entwurf nicht gefunden: ${id}`);
  }
  const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
  const sourceText = fs.existsSync(path.join(dir, 'source.txt'))
    ? fs.readFileSync(path.join(dir, 'source.txt'), 'utf8')
    : '';
  return { dir, post, sourceText };
}

function printDraft(post) {
  const words = countBodyWords(post.body);
  const quotes = [
    ...extractQuotes(post.title),
    ...extractQuotes(post.excerpt),
    ...extractQuotes(post.body),
  ];
  console.log(`${post.slug}`);
  console.log(`  Titel: ${post.title}`);
  console.log(`  Quelle: ${post.source?.name || '?'} — ${post.source?.url || '?'}`);
  console.log(`  Originaltitel: ${post.source?.title || '?'}`);
  console.log(`  Wörter: ${words} | Zitate: ${quotes.length} | Status: ${post.review?.status || '?'}`);
  if (post.source?.publishedAt || post.sourcePublishedAt) {
    console.log(`  Quelle veröffentlicht: ${post.source?.publishedAt || post.sourcePublishedAt}`);
  }
}

function moveDraft(dir, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  let target = path.join(targetRoot, path.basename(dir));
  if (fs.existsSync(target)) target = `${target}-${Date.now()}`;
  fs.renameSync(dir, target);
  return target;
}

function approve(id, flags) {
  const reviewer = String(flags.reviewer || '').trim();
  if (reviewer.length < 2) {
    fail('Bestätigung verweigert: --reviewer "Name" ist erforderlich');
  }

  const checks = String(flags.checks || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const missing = CHECKS.filter((check) => !checks.includes(check));
  if (missing.length) {
    fail(`Checkliste unvollständig: ${missing.join(', ')}`);
  }

  const { dir, post, sourceText } = loadDraft(id);
  if (post.slug !== id) fail('Slug stimmt nicht mit dem Entwurfsordner überein');
  if (post.url !== `/posts/${post.slug}.html`) fail('Artikel-URL passt nicht zum Slug');
  const isShort = post.format === 'short';
  const maxTitle = isShort ? 90 : 120;
  if (!post.title || post.title.length < 15 || post.title.length > maxTitle) fail('Titel fehlt oder hat eine ungültige Länge');
  if (!post.excerpt) fail('Teaser fehlt');
  if (isShort && post.excerpt.length > 180) fail('Teaser ist länger als 180 Zeichen');
  if (isShort && !['rss', 'full'].includes(post.source?.mode)) fail('Kurzartikel braucht Quellenmodus rss oder full');
  if (post.review?.status !== 'draft') fail('Entwurf ist nicht im Status draft');
  if (!post.source?.url?.startsWith('https://') || !post.source?.termsUrl?.startsWith('https://')) {
    fail('Quellen- oder Nutzungsrechte-URL fehlt oder ist ungültig');
  }
  const source = SOURCES.find((entry) => entry.name === post.source.name);
  if (!source) fail('Quelle steht nicht in der aktiven Registry');
  if (!post.source.title) fail('Originaltitel fehlt');
  if (!post.source.credit) fail('Quellenangabe fehlt');
  if (!post.source.license) fail('Lizenzangabe fehlt');
  if (!post.source.licenseUrl?.startsWith('https://')) fail('Lizenz-URL der Quelle fehlt');
  if (!post.imageCredit) fail('Bildurheber fehlt');
  if (!post.imageLicense) fail('Bildlizenz fehlt');
  if (!['photo', 'illustration'].includes(post.imageType)) fail('Bildtyp fehlt oder ist ungültig');
  if (post.imageType === 'photo' && !post.imageLicenseUrl?.startsWith('https://')) {
    fail('Lizenz-URL des Fotos fehlt');
  }
  if (post.imageType === 'photo' && !post.imageSourceUrl?.startsWith('https://')) {
    fail('Bildquelle fehlt');
  }
  let host;
  try {
    host = new URL(post.source.url).hostname.replace(/^www\./, '');
  } catch {
    fail('Quellen-URL ist ungültig');
  }
  const allowedHost = new URL(source.homepage).hostname.replace(/^www\./, '');
  if (host !== allowedHost && !host.endsWith(`.${allowedHost}`)) {
    fail(`Quellen-URL passt nicht zur Quelle: ${host}`);
  }
  const minSourceLength = isShort ? 60 : 500;
  if (!sourceText || sourceText.length < minSourceLength) fail('Quelltext für die Prüfung fehlt');

  const words = countBodyWords(post.body);
  if (isShort && (words < 45 || words > 80)) fail(`Wortzahl ${words} liegt außerhalb von 45-80`);
  if (!isShort && (words < 120 || words > 180)) fail(`Wortzahl ${words} liegt außerhalb von 120-180`);
  const quotes = [
    ...extractQuotes(post.title),
    ...extractQuotes(post.excerpt),
    ...extractQuotes(post.body),
  ];
  if (isShort && quotes.length) fail('Kurzartikel dürfen keine Zitate enthalten');
  if (quotes.length > 1) fail('Mehr als ein Zitat im Artikel');
  if (quotes.some((quote) => countWords(quote) > 25)) fail('Zitat ist länger als 25 Wörter');
  const bodyWithoutQuotes = post.body.replace(/[„“”"«»‚‘‹›][^„“”"«»‚‘‹›]{3,500}[„“”"«»‚‘‹›]/g, ' ');
  const overlaps = findLongOverlap(bodyWithoutQuotes, sourceText, isShort ? 6 : 10);
  if (overlaps.length) {
    fail(`Zu enge Übernahme aus der Quelle: ${overlaps.join(' | ')}`);
  }
  const sourceNorm = normalizeForMatch(sourceText);
  if (quotes.some((quote) => {
    const normalized = normalizeForMatch(quote);
    return !normalized || !sourceNorm.includes(normalized);
  })) {
    fail('Zitat steht nicht exakt im Quelltext');
  }
  const claimIssues = findUnsupportedClaims(post.body, sourceText, {
    language: post.source?.language || 'de',
  });
  if (claimIssues.length) {
    fail(
      `Nicht durch die Quelle gedeckte Sätze: ${claimIssues
        .map((item) => `"${item.sentence}" (${item.reasons.join(', ')})`)
        .join(' | ')}`,
    );
  }
  const structureIssues = findStructureIssues(post.body);
  if (isShort && post.imageType !== 'illustration') fail('Kurzartikel benötigen eine KI-Illustration');
  if (structureIssues.length) {
    fail(`Struktur: ${structureIssues.join('; ')}`);
  }

  const posts = loadPosts();
  if (posts.some((entry) => entry.slug === post.slug)) fail('Slug existiert bereits live');
  if (posts.some((entry) => entry.source?.url === post.source.url)) {
    fail('Diese Originalquelle ist bereits als Artikel veröffentlicht');
  }

  const heroFile = post.heroFile || 'hero.webp';
  const heroPath = path.join(dir, heroFile);
  if (!fs.existsSync(heroPath)) fail(`Hero-Bild fehlt: ${heroFile}`);

  const ext = path.extname(heroFile).slice(1) || 'webp';
  const imageFile = `${post.slug}-hero.${ext}`;
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.copyFileSync(heroPath, path.join(POSTS_DIR, imageFile));

  post.image = `/posts/${imageFile}`;
  post.images = [post.image];
  post.wordCount = words;
  post.review = {
    status: 'approved',
    reviewer,
    reviewedAt: new Date().toISOString(),
    checks,
  };
  delete post.heroFile;

  writePostPage(post);
  posts.unshift(post);
  posts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  savePosts(posts);
  rebuildSite(posts);

  const archived = moveDraft(dir, APPROVED_DIR);
  console.log(`[approved] ${post.title}`);
  console.log(`  Live: ${post.url}`);
  console.log(`  Freigabe: ${reviewer} am ${post.review.reviewedAt}`);
  console.log(`  Entwurf archiviert: ${path.relative(ROOT, archived)}`);
}

function reject(id, flags) {
  const { dir, post } = loadDraft(id);
  const reason = String(flags.reason || 'ohne Begründung').trim();
  fs.writeFileSync(
    path.join(dir, 'rejection.json'),
    `${JSON.stringify({ rejectedAt: new Date().toISOString(), reason }, null, 2)}\n`,
  );
  const archived = moveDraft(dir, REJECTED_DIR);
  console.log(`[rejected] ${post.title}`);
  console.log(`  Grund: ${reason}`);
  console.log(`  Archiviert: ${path.relative(ROOT, archived)}`);
}

const command = process.argv[2] || 'list';
const id = process.argv[3];
const flags = parseArgs(process.argv.slice(4));

if (command === 'list') {
  const drafts = loadDrafts();
  if (!drafts.length) {
    console.log('Keine Entwürfe in review/queue.');
  } else {
    for (const post of drafts) printDraft(post);
  }
} else if (command === 'show') {
  const { post, sourceText } = loadDraft(id);
  printDraft(post);
  console.log('\n--- Artikeltext ---\n');
  console.log(post.body);
  console.log('\n--- Quelltext (Auszug) ---\n');
  console.log(sourceText.slice(0, 3000));
} else if (command === 'approve' || command === 'publish') {
  approve(id, flags);
} else if (command === 'reject') {
  reject(id, flags);
} else {
  console.log(
    'Nutzung: node scripts/review.mjs list | show <id> | approve <id> --reviewer "Name" --checks names,roles,numbers,facts,timeliness,source,quote,grounding,structure | reject <id> --reason "..."',
  );
}
