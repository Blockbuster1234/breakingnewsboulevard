import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { fetchText } from './http.mjs';

const EXCLUDE =
  /\/(live|liveblog|live-blog|video|videos|audio|podcast|podcasts|gallery|pictures|in-pictures|crossword|newsletter|opinion|commentisfree|comment|sport|football|soccer|betting)\//i;

const SOFT_NEWS =
  /\b(harry|meghan|sussex|royals?|kardashian|celebrity|celebrities|actor|actress|singer|rapper|movie|film|tv show|reality tv|netflix|oscars?|grammys?|eurovision|fashion|beauty pageant|wedding|divorce|dating|football|soccer|premier league|champions league|olympic|tennis|golf|cricket|formula 1|boxing|ufc)\b/i;

export const SOURCES = [
  {
    id: 'ec-press',
    name: 'Europäische Kommission',
    category: 'Politik',
    homepage: 'https://ec.europa.eu/commission/presscorner/home/de',
    feed: 'https://ec.europa.eu/commission/presscorner/api/rss?language=en',
    include: /\/detail\/(?:en|de)\/ip_\d+_\d+\/?$/i,
    articleUrl: (url) => url.replace('/detail/en/', '/detail/de/'),
    extractor: 'ec',
    language: 'de',
    termsUrl: 'https://commission.europa.eu/legal-notice_en',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reuseNote: 'Quellenangabe erforderlich; Änderungen sind zu kennzeichnen.',
  },
  {
    id: 'destatis',
    name: 'Statistisches Bundesamt (Destatis)',
    category: 'Wirtschaft',
    homepage: 'https://www.destatis.de/DE/Presse/_inhalt.html',
    feed: 'https://www.destatis.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/Aktuell.xml',
    include: /\/DE\/Presse\/Pressemitteilungen\/\d{4}\/\d{2}\/PD\d+(?:_\d+)+\.html$/i,
    language: 'de',
    termsUrl: 'https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html',
    license: 'Weiterverwendung mit Quellenangabe',
    licenseUrl: 'https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html',
    reuseNote: 'Änderungen, Kürzungen oder Neugestaltungen sind kenntlich zu machen.',
  },
  {
    id: 'bgh',
    name: 'Bundesgerichtshof',
    category: 'Justiz',
    homepage: 'https://www.bundesgerichtshof.de/DE/Presse/Pressemitteilungen/pressemitteilungen_node.html',
    feed: 'https://www.bundesgerichtshof.de/DE/Service/RSSFeed/Function/RSS_PM.xml',
    include: /\/SharedDocs\/Pressemitteilungen\/DE\/\d{4}\/\d+\.html$/i,
    language: 'de',
    termsUrl: 'https://www.bundesgerichtshof.de/DE/Presse/Pressemitteilungen/quellenangabe.html',
    license: 'Pressemitteilung – Wiedergabe mit Quellenangabe',
    licenseUrl: 'https://www.bundesgerichtshof.de/DE/Presse/Pressemitteilungen/quellenangabe.html',
    reuseNote: 'Quellenangabe mit Datum der Pressemitteilung erforderlich.',
  },
];

export const BLOCKED_SOURCES = [
  {
    name: 'Rat der Europäischen Union',
    termsUrl: 'https://www.consilium.europa.eu/en/about-site/copyright/',
    reason:
      'Der RSS-Feed ist erreichbar, die Artikelseiten liefern jedoch einen 403-Browser-Check. Ohne Volltext keine belastbare redaktionelle Prüfung.',
  },
  {
    name: 'UN News',
    termsUrl: 'https://www.un.org/en/about-us/copyright',
    reason:
      'News-Material darf laut UN nur mit Quellenangabe und nach Benachrichtigung der UN genutzt werden; die allgemeinen Terms erlauben standardmäßig keine Derivate.',
    requiresNotification: true,
  },
  {
    name: 'Deutsche Bundesbank',
    termsUrl:
      'https://www.bundesbank.de/de/startseite/benutzerhinweise/nutzungsbedingungen-fuer-den-allgemeinen-gebrauch-der-website-763554',
    reason:
      'Die Nutzungsbedingungen verlangen unveränderte Wiedergabe. Für eigenständige Bearbeitungen daher nicht freigegeben.',
  },
  {
    name: 'Bundesregierung',
    termsUrl: 'https://www.bundesregierung.de/breg-de/service/nutzungsbedingungen',
    reason:
      'Keine belastbare Erlaubnis für Text-Reuse gefunden; die Nutzungsbedingungen- und Impressum-Seiten lieferten 404. Bild-AGB gelten nur für Pressefotos.',
  },
  {
    name: 'Bundesverfassungsgericht',
    termsUrl: 'https://www.bundesverfassungsgericht.de/DE/Impressum/impressum_node.html',
    reason:
      'Inhalte sind urheberrechtlich geschützt; kommerzielle Nutzung ist genehmigungspflichtig. Keine belastbare Reuse-Erlaubnis für Pressemitteilungen gefunden.',
  },
  {
    name: 'Bundesverwaltungsgericht',
    termsUrl: 'https://www.bverwg.de/footernavigation/impressum',
    reason:
      'Amtliche Werke sind urheberrechtlich nicht geschützt, dürfen aber nicht verändert werden. Für eigenständige Bearbeitungen nicht freigegeben.',
  },
  {
    name: 'Bundesagentur für Arbeit',
    termsUrl: 'https://www.arbeitsagentur.de/impressum',
    reason: 'Nutzung in eigenen Werken ist ohne vorherige Zustimmung nicht erlaubt.',
  },
  {
    name: 'Auswärtiges Amt',
    termsUrl: 'https://www.auswaertiges-amt.de/de/nutzungsbedingungen-neu2011-374748',
    reason: 'Alle Inhalte sind urheberrechtlich geschützt; alle Rechte vorbehalten.',
  },
];

export function isSourceEnabled(source) {
  return source.enabled !== false && !source.requiresNotification;
}

function cleanTitle(title) {
  return title.replace(/^\s*(play|video|livestream|live-stream|audiothek)\s+/i, '').trim();
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function cleanArticleTitle(title, fallback) {
  const cleaned = clean(title).replace(
    /^Presse\s*:\s*Pressemitteilungen aus dem Jahr \d{4}\s*[-–]\s*/i,
    '',
  );
  return cleaned || fallback;
}

function htmlToText(html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const paragraphs = [...dom.window.document.querySelectorAll('p')]
    .map((p) => clean(p.textContent))
    .filter((text) => text.length >= 40 && !/^(sign up|subscribe|follow us|read more)/i.test(text));
  const text = paragraphs.join('\n\n');
  return text || clean(dom.window.document.body.textContent);
}

function collectLinks(html, source) {
  const dom = new JSDOM(html, { url: source.homepage });
  const doc = dom.window.document;
  const seen = new Set();
  const items = [];

  for (const anchor of doc.querySelectorAll('a[href]')) {
    const url = anchor.href.split('#')[0];
    if (source.include && !source.include.test(url)) continue;
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
      sourceId: source.id,
      categoryHint: source.category,
      language: source.language,
      publishedAt: '',
    });
  }

  return items;
}

function collectFeed(xml, source) {
  const dom = new JSDOM(xml, { contentType: 'text/xml', url: source.feed });
  const doc = dom.window.document;
  const seen = new Set();
  const items = [];

  for (const node of doc.querySelectorAll('item, entry')) {
    const title = cleanTitle(clean(node.querySelector('title')?.textContent));
    const linkNode = node.querySelector('link');
    const rawLink = clean(linkNode?.textContent) || clean(linkNode?.getAttribute('href'));
    if (!rawLink) continue;

    let url = rawLink.split('#')[0];
    if (source.articleUrl) url = source.articleUrl(url);
    if (source.include && !source.include.test(url)) continue;
    if (EXCLUDE.test(url)) continue;
    if (seen.has(url)) continue;

    if (title.length < 25 || title.length > 180) continue;
    if (SOFT_NEWS.test(title)) continue;
    if (SOFT_NEWS.test(url)) continue;

    const publishedAt = clean(
      node.querySelector('pubDate')?.textContent ||
        node.querySelector('published')?.textContent ||
        node.querySelector('updated')?.textContent,
    );

    seen.add(url);
    items.push({
      url,
      title,
      source: source.name,
      sourceId: source.id,
      categoryHint: source.category,
      language: source.language,
      publishedAt,
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

async function collectFromSource(source) {
  if (source.feed) {
    return collectFeed(await fetchText(source.feed), source);
  }
  return collectLinks(await fetchText(source.homepage), source);
}

export async function collectCandidates(limit = 12) {
  const active = SOURCES.filter(isSourceEnabled);
  if (!active.length) throw new Error('Keine aktiven offiziellen Quellen konfiguriert');

  const results = await Promise.allSettled(active.map((source) => collectFromSource(source)));

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`[news] ${active[index].name} failed: ${result.reason.message}`);
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

function ecReference(url) {
  const match = url.match(/\/detail\/(?:en|de)\/([a-z]+)_(\d+)_(\d+)\/?$/i);
  if (!match) throw new Error('EC-Referenz nicht erkannt');
  return `${match[1].toUpperCase()}/${match[2]}/${match[3]}`;
}

async function extractEc(candidate, source) {
  const reference = ecReference(candidate.url);
  const apiUrl = `https://ec.europa.eu/commission/presscorner/api/documents?reference=${encodeURIComponent(reference)}&language=de`;
  const data = JSON.parse(
    await fetchText(apiUrl, { headers: { accept: 'application/json' } }),
  );
  const resource = data.docuLanguageResource;
  if (!resource?.htmlContent) throw new Error('EC-Dokument ohne Inhalt');

  const text = htmlToText(resource.htmlContent);
  if (text.length < 500) throw new Error('EC-Dokument zu kurz');

  return {
    title: clean(resource.title) || candidate.title,
    text: text.slice(0, 9000),
    language: 'de',
    publishedAt: data.publishDate || candidate.publishedAt,
    sourceId: source.id,
    url: candidate.url.replace('/detail/en/', '/detail/de/'),
  };
}

export async function extractArticle(candidate) {
  const source = SOURCES.find((item) => item.id === candidate.sourceId);
  if (!source) throw new Error(`Unbekannte Quelle: ${candidate.sourceId}`);

  if (source.extractor === 'ec') return extractEc(candidate, source);

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
    title: cleanArticleTitle(parsed.title, candidate.title),
    text: text.slice(0, 9000),
    language: source.language || 'de',
    publishedAt: candidate.publishedAt,
    sourceId: source.id,
    url: candidate.url,
  };
}
