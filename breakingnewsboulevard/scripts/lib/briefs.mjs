import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { fetchText } from './http.mjs';
import { normalizeForMatch } from './text.mjs';

const ROOT = process.cwd();
export const BRIEFS_FILE = path.join(ROOT, 'data', 'briefs.json');
export const BRIEFS_PAGE = 'weltnachrichten-kurz.html';
export const BRIEFS_URL = `/${BRIEFS_PAGE}`;
export const MAX_BRIEFS_PER_DAY = 10;
export const BRIEF_RETENTION_DAYS = 14;

export const BRIEF_SOURCES = [
  {
    id: 'bbc',
    name: 'BBC',
    feed: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    language: 'en',
    hosts: ['bbc.co.uk', 'bbc.com'],
  },
  {
    id: 'reuters',
    name: 'Reuters',
    feed: 'https://news.google.com/rss/search?q=when:24h+site:reuters.com/world&ceid=US:en&hl=en-US&gl=US',
    language: 'en',
    hosts: ['news.google.com'],
    via: 'Google News',
  },
  {
    id: 'tagesschau',
    name: 'Tagesschau',
    feed: 'https://www.tagesschau.de/xml/rss2/',
    language: 'de',
    hosts: ['tagesschau.de'],
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    feed: 'https://www.aljazeera.com/xml/rss/all.xml',
    language: 'en',
    hosts: ['aljazeera.com'],
  },
  {
    id: 'dw',
    name: 'DW',
    feed: 'https://rss.dw.com/rdf/rss-de-all',
    language: 'de',
    hosts: ['dw.com'],
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    feed: 'https://www.theguardian.com/world/rss',
    language: 'en',
    hosts: ['theguardian.com'],
  },
];

const BRIEF_EXCLUDE =
  /\b(sport|sports|football|soccer|champions league|premier league|bundesliga|olympics?|tennis|golf|cricket|formula 1|boxing|ufc|celebrity|celebrities|royals?|kardashian|entertainment|movie|movies|film|box office|music|album|concert|festival|fashion|beauty pageant|dating|wedding)\b/i;

const BRIEF_URL_EXCLUDE =
  /\/(video|videos|opinions?|live|liveblog|podcast|podcasts|gallery|sport|sports|football|soccer|tennis|golf|cricket|boxing|ufc)(\/|$)/i;

const BRIEF_STOPWORDS = new Set(
  `the and with from that this those these would says said after before about into their there where while according over under more than have has been were was will meeting talks news update updates live latest report reports first last also just only very much many some such other another what when who whom whose how why not but for its his her our your they them we you i a an of to in on at as by is are or be been being can could may might must should than then now today tomorrow yesterday amid ahead against between during without within across around near off out up down`.split(
    /\s+/,
  ),
);

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'at_medium',
  'at_campaign',
  'traffic_source',
  'maca',
];

function clean(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkup(value) {
  return clean(
    String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;|&#34;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>'),
  );
}

function childText(node, names) {
  for (const child of node.children) {
    if (!names.includes(child.localName)) continue;
    const text = clean(child.textContent);
    if (text) return text;
    const href = child.getAttribute('href');
    if (href) return clean(href);
  }
  return '';
}

function childTexts(node, name) {
  return [...node.children]
    .filter((child) => child.localName === name)
    .map((child) => clean(child.textContent))
    .filter(Boolean);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    return url.toString();
  } catch {
    return '';
  }
}

function isAllowedUrl(source, value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return source.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function parseDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function isStale(value) {
  if (!value) return false;
  const age = Date.now() - new Date(value).getTime();
  return age > 72 * 60 * 60 * 1000 || age < -60 * 60 * 1000;
}

function storyText(title, description = '') {
  return `${title} ${description.slice(0, 500)}`;
}

function isSimilarBrief(left, right) {
  const leftTokens = new Set(
    normalizeForMatch(storyText(left.title || left.headline, left.description || left.text))
      .split(' ')
      .filter((word) => word.length >= 4 && !BRIEF_STOPWORDS.has(word)),
  );
  const rightTokens = new Set(
    normalizeForMatch(storyText(right.title || right.headline, right.description || right.text))
      .split(' ')
      .filter((word) => word.length >= 4 && !BRIEF_STOPWORDS.has(word)),
  );
  if (!leftTokens.size || !rightTokens.size) return false;
  let common = 0;
  for (const word of leftTokens) if (rightTokens.has(word)) common += 1;
  return common >= 2 && common / Math.min(leftTokens.size, rightTokens.size) >= 0.3;
}

function isExcluded(title, description, categories) {
  if (BRIEF_EXCLUDE.test(title) || BRIEF_EXCLUDE.test(description.slice(0, 300))) return true;
  return categories.some((category) => /sport|entertainment|celebrity/i.test(category));
}

function sourceTitle(title, source) {
  return clean(title.replace(new RegExp(`\\s+-\\s+${source.name}$`, 'i'), ''));
}

async function collectSource(source) {
  const xml = await fetchText(source.feed, {
    headers: {
      accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  });
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  const items = [];

  for (const node of dom.window.document.querySelectorAll('item')) {
    const rawTitle = childText(node, ['title']);
    const description = stripMarkup(childText(node, ['description', 'summary']));
    const rawLink = childText(node, ['link', 'guid']);
    const publishedAt = parseDate(
      childText(node, ['pubDate', 'date', 'published', 'updated']),
    );
    const categories = childTexts(node, 'category');
    const title = sourceTitle(rawTitle, source);
    const url = normalizeUrl(rawLink);

    if (!title || !description || !url) continue;
    if (title.length < 15 || title.length > 180) continue;
    if (description.length < 60) continue;
    if (!isAllowedUrl(source, url)) continue;
    if (BRIEF_URL_EXCLUDE.test(new URL(url).pathname)) continue;
    if (isStale(publishedAt)) continue;
    if (isExcluded(title, description, categories)) continue;

    items.push({
      sourceId: source.id,
      sourceName: source.name,
      sourceVia: source.via || '',
      sourceLanguage: source.language,
      title,
      description: description.slice(0, 1000),
      sourceUrl: url,
      publishedAt,
    });
  }

  return items.slice(0, 25);
}

export async function collectBriefCandidates() {
  const results = await Promise.allSettled(BRIEF_SOURCES.map((source) => collectSource(source)));
  const candidates = [];

  results.forEach((result, index) => {
    const source = BRIEF_SOURCES[index];
    if (result.status === 'rejected') {
      console.warn(`[briefs] ${source.name} Feed fehlgeschlagen: ${result.reason.message}`);
      return;
    }
    console.log(`[briefs] ${source.name}: ${result.value.length} Kandidaten`);
    candidates.push(...result.value);
  });

  return candidates;
}

function orderedSources() {
  const offset = Math.floor(Date.now() / 86400000) % BRIEF_SOURCES.length;
  return [...BRIEF_SOURCES.slice(offset), ...BRIEF_SOURCES.slice(0, offset)];
}

export function pickBriefCandidates(candidates, existingItems, limit) {
  const max = Math.min(MAX_BRIEFS_PER_DAY, Math.max(0, limit));
  const existingUrls = new Set(existingItems.map((item) => normalizeUrl(item.sourceUrl)));
  const existingHeadlines = existingItems.map((item) => ({
    headline: item.headline,
    text: item.text || '',
  }));
  const lists = new Map(BRIEF_SOURCES.map((source) => [source.id, []]));

  for (const candidate of candidates) {
    if (lists.has(candidate.sourceId)) lists.get(candidate.sourceId).push(candidate);
  }

  const picked = [];
  const positions = new Map([...lists.keys()].map((id) => [id, 0]));
  let added = true;

  while (picked.length < max && added) {
    added = false;
    for (const source of orderedSources()) {
      const list = lists.get(source.id) || [];
      let position = positions.get(source.id) || 0;
      while (position < list.length) {
        const candidate = list[position];
        position += 1;
        const url = normalizeUrl(candidate.sourceUrl);
        if (existingUrls.has(url)) continue;
        if (existingHeadlines.some((item) => isSimilarBrief(item, candidate))) continue;
        if (picked.some((item) => isSimilarBrief(item, candidate))) continue;
        positions.set(source.id, position);
        picked.push(candidate);
        existingUrls.add(url);
        added = true;
        break;
      }
      positions.set(source.id, position);
      if (picked.length >= max) break;
    }
  }

  return picked;
}

export function briefId(sourceId, sourceUrl, date) {
  return `${date}-${sourceId}-${createHash('sha1').update(sourceUrl).digest('hex').slice(0, 10)}`;
}

export function emptyBriefsData() {
  return { updatedAt: '', days: [] };
}

export function loadBriefsData(file = BRIEFS_FILE) {
  if (!fs.existsSync(file)) return emptyBriefsData();
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || !Array.isArray(data.days)) return emptyBriefsData();
    return {
      updatedAt: data.updatedAt || '',
      days: data.days
        .filter((day) => day && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Array.isArray(day.items))
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    };
  } catch {
    return emptyBriefsData();
  }
}

export function saveBriefsData(data, file = BRIEFS_FILE) {
  data.updatedAt = new Date().toISOString();
  data.days = data.days
    .filter((day) => day.items.length)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, BRIEF_RETENTION_DAYS);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function briefSourceByName(name) {
  return BRIEF_SOURCES.find((source) => source.name === name);
}

export function isAllowedBriefUrl(source, url) {
  return isAllowedUrl(source, url);
}

export function briefSourceLabel(item) {
  return item.sourceVia ? `${item.sourceName} (via ${item.sourceVia})` : item.sourceName;
}
