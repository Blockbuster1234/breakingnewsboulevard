import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { fetchText } from './http.mjs';

const EXCLUDE =
  /\/(live|liveblog|live-blog|video|videos|audio|podcast|podcasts|gallery|pictures|in-pictures|crossword|newsletter|opinion|commentisfree|comment|sport|football|soccer|betting)\//i;

const SOFT_NEWS =
  /\b(harry|meghan|sussex|royals?|kardashian|celebrity|celebrities|actor|actress|singer|rapper|movie|film|tv show|reality tv|netflix|oscars?|grammys?|eurovision|fashion|beauty pageant|wedding|divorce|dating|football|soccer|premier league|champions league|olympic|tennis|golf|cricket|formula 1|boxing|ufc)\b/i;

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'at_medium',
  'at_campaign',
  'maca',
  'traffic_source',
];

async function collectWikinews(source) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: 'Category:Published',
    cmtype: 'page',
    cmsort: 'timestamp',
    cmdir: 'desc',
    cmlimit: '20',
    format: 'json',
  });
  const data = JSON.parse(
    await fetchText(`https://en.wikinews.org/w/api.php?${params}`, {
      headers: { accept: 'application/json' },
    }),
  );
  return (data?.query?.categorymembers || [])
    .map((entry) => {
      const title = cleanTitle(clean(entry.title));
      const url = `https://en.wikinews.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      return {
        url,
        title,
        source: source.name,
        sourceId: source.id,
        categoryHint: source.category,
        language: source.language,
        publishedAt: '',
      };
    })
    .filter((item) => {
      if (item.title.length < 25 || item.title.length > 180) return false;
      if (SOFT_NEWS.test(item.title) || SOFT_NEWS.test(item.url)) return false;
      return true;
    });
}

export const SOURCES = [
  {
    id: 'bbc',
    name: 'BBC',
    category: 'Welt',
    homepage: 'https://www.bbc.co.uk/news/world',
    feed: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    include: /^https:\/\/www\.bbc\.(?:co\.uk|com)\/news\//i,
    language: 'en',
    daily: true,
    rss: true,
    termsUrl: 'https://www.bbc.co.uk/usingthebbc/terms/',
    license: 'BBC-Nutzungsbedingungen; nur RSS-Titel und -Kurzbeschreibung, eigene Zusammenfassung',
    licenseUrl: 'https://www.bbc.co.uk/usingthebbc/terms/',
    reuseNote:
      'Nur Überschrift und Kurzbeschreibung aus dem öffentlichen RSS-Feed als Recherchegrundlage verwenden. Keine Originaltexte oder Fotos übernehmen; Quelle und Artikel-Link sind im Beitrag sichtbar auszuweisen.',
  },
  {
    id: 'tagesschau',
    name: 'Tagesschau',
    category: 'Welt',
    homepage: 'https://www.tagesschau.de/',
    feed: 'https://www.tagesschau.de/xml/rss2/',
    include: /^https:\/\/www\.tagesschau\.de\//i,
    language: 'de',
    daily: true,
    rss: true,
    termsUrl: 'https://www.tagesschau.de/impressum/',
    license: 'ARD/tagesschau.de-Nutzungsbedingungen; nur RSS-Titel und -Kurzbeschreibung, eigene Zusammenfassung',
    licenseUrl: 'https://www.tagesschau.de/impressum/',
    reuseNote:
      'Nur Überschrift und Kurzbeschreibung aus dem öffentlichen RSS-Feed als Recherchegrundlage verwenden. Keine Originaltexte oder Fotos übernehmen; Quelle und Artikel-Link sind im Beitrag sichtbar auszuweisen.',
  },
  {
    id: 'dw',
    name: 'DW',
    category: 'Welt',
    homepage: 'https://www.dw.com/de/',
    feed: 'https://rss.dw.com/rdf/rss-de-all',
    include: /^https:\/\/www\.dw\.com\/de\//i,
    language: 'de',
    daily: true,
    rss: true,
    termsUrl: 'https://corporate.dw.com/de/freie-nutzung-von-dw-inhalten/a-76961025',
    license: 'DW-Nutzungsbestimmungen; nur RSS-Titel und -Kurzbeschreibung, eigene Zusammenfassung',
    licenseUrl: 'https://corporate.dw.com/de/freie-nutzung-von-dw-inhalten/a-76961025',
    reuseNote:
      'Nur Überschrift und Kurzbeschreibung aus dem öffentlichen RSS-Feed als Recherchegrundlage verwenden. Keine Originaltexte oder Fotos übernehmen; Quelle und Artikel-Link sind im Beitrag sichtbar auszuweisen.',
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    category: 'Welt',
    homepage: 'https://www.theguardian.com/world',
    feed: 'https://www.theguardian.com/world/rss',
    include: /^https:\/\/www\.theguardian\.com\/(?:world|us-news|australia-news|global-development|environment|society|science|technology)\//i,
    language: 'en',
    daily: true,
    rss: true,
    termsUrl: 'https://www.theguardian.com/help/terms-of-service',
    license: 'Guardian-Nutzungsbedingungen; nur RSS-Titel und -Kurzbeschreibung, eigene Zusammenfassung',
    licenseUrl: 'https://www.theguardian.com/help/terms-of-service',
    reuseNote:
      'Nur Überschrift und Kurzbeschreibung aus dem öffentlichen RSS-Feed als Recherchegrundlage verwenden. Keine Originaltexte oder Fotos übernehmen; Quelle und Artikel-Link sind im Beitrag sichtbar auszuweisen.',
  },
  {
    id: 'nasa',
    name: 'NASA',
    category: 'Wissenschaft',
    homepage: 'https://www.nasa.gov/news-release/',
    feed: 'https://www.nasa.gov/news-release/feed/',
    include:
      /^https:\/\/www\.nasa\.gov\/(?:news-release|general|centers-and-facilities|missions|organizations)\//i,
    language: 'en',
    termsUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    license: 'NASA Media Usage Guidelines – keine Standardlizenz; Quellenangabe NASA',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    reuseNote:
      'NASA-Inhalte sind in den USA grundsätzlich nicht urheberrechtlich geschützt und dürfen für informative bzw. redaktionelle Zwecke verwendet werden. NASA als Quelle nennen; keine NASA-Logos oder Endorsement-Andeutung. Fotos und Inhalte Dritter sind ausgenommen; NASA-Marken sind geschützt.',
  },
  {
    id: 'us-cisa',
    name: 'US-Regierung – CISA',
    category: 'Technologie',
    homepage: 'https://www.cisa.gov/news-events/news',
    feed: 'https://www.cisa.gov/news.xml',
    include: /\/news-events\/news\//i,
    language: 'en',
    termsUrl: 'https://www.usa.gov/government-copyright',
    license: 'Public Domain (US Government work, 17 U.S.C. § 105)',
    licenseUrl: 'https://www.usa.gov/government-copyright',
    reuseNote:
      'Nur Werke von US-Regierungsbediensteten. Keine Inhalte Dritter, Logos oder geschützten Fotos übernehmen; Quellenangabe erforderlich.',
  },
  {
    id: 'uk-gov',
    name: 'UK Government',
    category: 'Politik',
    homepage: 'https://www.gov.uk/government/latest',
    feed: 'https://www.gov.uk/search/news-and-communications.atom',
    include: /\/government\/(?:news|speeches)\//i,
    language: 'en',
    termsUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    license: 'Open Government Licence v3.0',
    licenseUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    reuseNote:
      'Enthält Informationen des öffentlichen Sektors unter der Open Government Licence v3.0. Quellenangabe und Lizenzlink erforderlich.',
  },
  {
    id: 'wikinews',
    name: 'Wikinews',
    category: 'Welt',
    homepage: 'https://en.wikinews.org/wiki/Main_Page',
    collect: collectWikinews,
    language: 'en',
    termsUrl: 'https://en.wikinews.org/wiki/Wikinews:Copyright',
    license: 'CC BY 4.0 (ab 16.12.2024; ältere Artikel CC BY 2.5)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reuseNote:
      'Autoren von Wikinews nennen; Link zur Quelle und zur Lizenz erforderlich. Für ältere Artikel gilt CC BY 2.5.',
  },
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
      'UN News erlaubt die Nutzung von News-Material nur mit Quellenangabe und vorheriger Benachrichtigung der UN; keine Standardlizenz für automatische Übernahme. Deshalb nicht aktiviert.',
    requiresNotification: true,
  },
  {
    name: 'Weltgesundheitsorganisation (WHO)',
    termsUrl: 'https://www.who.int/about/policies/publishing/copyright',
    reason:
      'WHO-Inhalte stehen unter CC BY-NC-SA 3.0 IGO und dürfen nur nicht-kommerziell genutzt werden. Wegen dieser Einschränkung wurde die Quelle deaktiviert.',
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
    termsUrl: 'https://www.bundesregierung.de/breg-de/impressum',
    reason:
      'Keine klare Lizenz für die Übernahme von Pressemitteilungstexten gefunden; die Inhalte sind urheberrechtlich geschützt. Bild-AGB gelten nur für Pressefotos. Deshalb nicht aktiviert.',
  },
  {
    name: 'Europäische Weltraumorganisation (ESA)',
    termsUrl: 'https://www.esa.int/Services/Terms_and_conditions',
    reason:
      'Die ESA-Terms erlauben keine Redistribution und keine Derivate ohne vorherige schriftliche Zustimmung. Damit ist eine eigenständige Zusammenfassung nicht freigegeben.',
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

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    return url.toString();
  } catch {
    return value;
  }
}

function stripFeedMarkup(value) {
  const raw = String(value || '');
  if (!raw) return '';
  const dom = new JSDOM(`<body>${raw}</body>`);
  return clean(dom.window.document.body.textContent).slice(0, 1200);
}

function isRecent(value) {
  if (!value) return true;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return true;
  const age = Date.now() - time;
  return age <= 72 * 60 * 60 * 1000 && age >= -6 * 60 * 60 * 1000;
}

function cleanArticleTitle(title, fallback) {
  const cleaned = clean(title)
    .replace(
      /^Presse\s*:\s*Pressemitteilungen aus dem Jahr \d{4}\s*[-–]\s*/i,
      '',
    )
    .replace(/\s+[-|–]\s+(NASA|CISA|WHO|UK Government|Wikinews)\s*$/i, '')
    .trim();
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

    let url = normalizeUrl(rawLink.split('#')[0]);
    if (source.articleUrl) url = normalizeUrl(source.articleUrl(url));
    if (source.include && !source.include.test(url)) continue;
    if (EXCLUDE.test(url)) continue;
    if (seen.has(url)) continue;

    if (title.length < 25 || title.length > 180) continue;
    if (SOFT_NEWS.test(title)) continue;
    if (SOFT_NEWS.test(url)) continue;

    const description = stripFeedMarkup(
      node.querySelector('description')?.textContent ||
        node.querySelector('summary')?.textContent ||
        node.querySelector('encoded')?.textContent,
    );
    if (source.rss && description.length < 60) continue;

    const publishedAt = clean(
      node.querySelector('pubDate')?.textContent ||
        node.querySelector('published')?.textContent ||
        node.querySelector('updated')?.textContent ||
        node.querySelector('date')?.textContent,
    );
    if (source.rss && !isRecent(publishedAt)) continue;

    seen.add(url);
    items.push({
      url,
      title,
      description,
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
  if (source.collect) return source.collect(source);
  if (source.feed) {
    return collectFeed(await fetchText(source.feed), source);
  }
  return collectLinks(await fetchText(source.homepage), source);
}

export async function collectCandidates(limit = 12, { dailyOnly = false } = {}) {
  const active = SOURCES.filter((source) => isSourceEnabled(source) && (!dailyOnly || source.daily));
  if (!active.length) throw new Error('Keine aktiven Quellen konfiguriert');

  const dayOffset = Math.floor(Date.now() / 86400000) % active.length;
  const ordered = [...active.slice(dayOffset), ...active.slice(0, dayOffset)];
  const results = await Promise.allSettled(ordered.map((source) => collectFromSource(source)));

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`[news] ${ordered[index].name} failed: ${result.reason.message}`);
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

  if (source.rss) {
    const text = clean(candidate.description || '');
    if (text.length < 60) throw new Error('RSS-Kurzbeschreibung zu kurz');
    return {
      title: cleanArticleTitle(candidate.title, candidate.title),
      text: text.slice(0, 2000),
      language: source.language || 'de',
      publishedAt: candidate.publishedAt || '',
      sourceId: source.id,
      url: candidate.url,
    };
  }

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
