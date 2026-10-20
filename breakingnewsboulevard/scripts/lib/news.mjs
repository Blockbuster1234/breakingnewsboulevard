import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { fetchText } from './http.mjs';

const EXCLUDE =
  /\/(live|liveblog|live-blog|video|videos|audio|podcast|podcasts|gallery|pictures|in-pictures|crossword|newsletter|opinion|commentisfree|comment|sport|football|soccer|betting)\//i;

export const SOURCES = [
  {
    name: 'tagesschau',
    category: 'Deutschland',
    url: 'https://www.tagesschau.de/',
    pattern:
      /^https:\/\/www\.tagesschau\.de\/(inland|ausland|wirtschaft|investigativ|wissen|faktenfinder)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+-\d+\.html$/i,
    categoryFor: (url) => (url.includes('/inland/') ? 'Deutschland' : 'Welt'),
  },
  {
    name: 'The Guardian',
    category: 'Welt',
    url: 'https://www.theguardian.com/world',
    pattern:
      /^https:\/\/www\.theguardian\.com\/(world|us-news|uk-news|australia-news|global-development|environment|science|technology|business|politics)\/\d{4}\/[a-z]{3}\/\d{2}\/[a-z0-9-]+$/i,
  },
  {
    name: 'BBC News',
    category: 'Welt',
    url: 'https://www.bbc.com/news',
    pattern: /^https:\/\/www\.bbc\.com\/news\/articles\/[a-z0-9]+$/i,
  },
  {
    name: 'Al Jazeera',
    category: 'Welt',
    url: 'https://www.aljazeera.com/news/',
    pattern: /^https:\/\/www\.aljazeera\.com\/news\/\d{4}\/\d{1,2}\/\d{1,2}\/[a-z0-9-]+$/i,
  },
  {
    name: 'heise online',
    category: 'Technologie',
    url: 'https://www.heise.de/',
    pattern: /^https:\/\/www\.heise\.de\/news\/[a-z0-9-]+-\d+\.html$/i,
  },
];

const SOFT_NEWS =
  /\b(harry|meghan|sussex|royals?|kardashian|celebrity|celebrities|actor|actress|singer|rapper|movie|film|tv show|reality tv|netflix|oscars?|grammys?|eurovision|fashion|beauty pageant|wedding|divorce|dating|football|soccer|premier league|champions league|olympic|tennis|golf|cricket|formula 1|boxing|ufc)\b/i;

function cleanTitle(title) {
  return title.replace(/^\s*(play|video|livestream|live-stream|audiothek)\s+/i, '').trim();
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function collectLinks(html, source) {
  const dom = new JSDOM(html, { url: source.url });
  const doc = dom.window.document;
  const seen = new Set();
  const items = [];

  for (const anchor of doc.querySelectorAll('a[href]')) {
    const url = anchor.href.split('#')[0];
    if (!source.pattern.test(url)) continue;
    if (EXCLUDE.test(url)) continue;
    if (seen.has(url)) continue;

    const title = cleanTitle(
      clean(anchor.textContent) || clean(anchor.getAttribute('aria-label')) || clean(anchor.title),
    );
    if (title.length < 25 || title.length > 180) continue;
    if (SOFT_NEWS.test(title)) continue;
    if (SOFT_NEWS.test(url)) continue;

    seen.add(url);
    items.push({
      url,
      title,
      source: source.name,
      categoryHint: source.categoryFor ? source.categoryFor(url) : source.category,
    });
  }

  return items;
}

function titleKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

export function isSimilarTitle(a, b) {
  const left = new Set(titleKey(a));
  const right = new Set(titleKey(b));
  if (!left.size || !right.size) return false;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / Math.min(left.size, right.size) >= 0.6;
}

export async function collectCandidates(limit = 12) {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => collectLinks(await fetchText(source.url), source)),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`[news] ${SOURCES[index].name} failed: ${result.reason.message}`);
    }
  });

  const lists = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  const merged = [];
  const seenUrls = new Set();
  let added = true;
  let index = 0;

  while (added && merged.length < limit) {
    added = false;
    for (const list of lists) {
      const item = list[index];
      if (!item || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      merged.push(item);
      added = true;
      if (merged.length >= limit) break;
    }
    index += 1;
  }

  return merged;
}

export async function extractArticle(candidate) {
  const html = await fetchText(candidate.url);
  const dom = new JSDOM(html, { url: candidate.url });
  const parsed = new Readability(dom.window.document, { charThreshold: 400 }).parse();
  if (!parsed) throw new Error('no readable content');

  const contentDom = new JSDOM(`<body>${parsed.content || ''}</body>`);
  const paragraphs = [...contentDom.window.document.querySelectorAll('p')]
    .map((p) => clean(p.textContent))
    .filter((text) => text.length >= 60 && !/^(sign up|subscribe|follow us|read more)/i.test(text));

  let text = paragraphs.join('\n\n');
  if (text.length < 900) {
    text = clean(parsed.textContent);
  }
  if (text.length < 900) throw new Error('article text too short');

  return {
    title: clean(parsed.title) || candidate.title,
    text: text.slice(0, 9000),
  };
}
