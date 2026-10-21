import { sleep } from './http.mjs';
import {
  countBodyWords,
  countWords,
  extractQuotes,
  findLongOverlap,
  findStructureIssues,
  findUnsupportedClaims,
  normalizeForMatch,
} from './text.mjs';

export class FatalGenerationError extends Error {}

const POLLINATIONS_TEXT_ENDPOINT = 'https://gen.pollinations.ai/v1/chat/completions';
const POLLINATIONS_TEXT_MODEL =
  process.env.POLLINATIONS_TEXT_MODEL || 'deepseek/deepseek-v4.1-flash';
const OMNI_TEXT_ENDPOINT =
  (process.env.OMNI_BASE_URL || 'http://127.0.0.1:20128').replace(/\/$/, '') +
  '/v1/chat/completions';
const OMNI_TEXT_MODEL = process.env.OMNI_TEXT_MODEL || 'auto/gpt';
const OMNI_API_KEY = process.env.OMNI_API_KEY || '';
const IMAGE_ENDPOINT = 'https://gen.pollinations.ai/image';
const IMAGE_MODEL = process.env.POLLINATIONS_IMAGE_MODEL || 'black-forest-labs/flux.1-schnell';

export function pollinationsKey() {
  return String(process.env.POLLINATIONS_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
}

const CATEGORIES = [
  'Welt',
  'Politik',
  'Wirtschaft',
  'Technologie',
  'Wissenschaft',
  'Gesundheit',
  'Klima',
  'Kultur',
  'Sport',
  'Justiz',
];

const SYSTEM_PROMPT = `Du bist erfahrener Redakteur bei Breaking News Boulevard, einem deutschsprachigen Nachrichtenportal.
Du erhältst ausschließlich die Überschrift und die Kurzbeschreibung einer Meldung aus einem öffentlichen RSS-Feed.

Harte Regeln:
- Schreibe einen eigenständigen deutschen Kurzartikel mit den wichtigsten Fakten: Was, Wo und Wer.
- Übernimm keine Sätze, Satzteile oder Wendungen aus der Überschrift oder Beschreibung. Keine wörtliche Übersetzung und keine enge Umformulierung.
- Verwende nur Fakten, Namen, Orte und Zahlen, die ausdrücklich in der Überschrift oder Beschreibung stehen. Ergänze nichts, auch nichts Naheliegendes: keine Gebäude, Behörden, Krankenhäuser, Motive, Folgen, Reaktionen oder Zeitangaben, wenn sie nicht dastehen.
- Wenn die Quelle keine Bedeutung oder Folgen nennt, erkläre die Bedeutung ausschließlich mit konkreten, belegten Fakten. Erfinde keine Bewertung, Prognose oder einen Ausblick.
- Behaupte nicht, dass etwas nicht geschehen ist. Sätze wie "keine weiteren Fälle", "niemand wurde verletzt" oder "es gab keine Reaktion" sind nur erlaubt, wenn sie ausdrücklich in der Quelle stehen.
- Schreibe 55-75 Wörter; niemals mehr als 80 und nicht weniger als 45. Zähle die Wörter vor der Ausgabe.
- Erster Absatz: genau ein Satz mit Was, Wo und Wer (12-40 Wörter). Zweiter Absatz: ein bis zwei kurze Sätze dazu, warum die Meldung wichtig ist, nur mit Fakten aus der Quelle. Absätze durch eine Leerzeile trennen. Keine Zwischenüberschrift.
- Nenne die Quelle nicht im Text; sie wird separat als Link angezeigt.
- Keine Zitate, keine Meinung, keine Prognose, keinen Ausblick, kein Fazit und keine Empfehlung.
- Schreibe durchgehend Deutsch. Englische Wörter nur bei Eigennamen.
- Die Überschrift muss die zentrale Aussage korrekt zusammenfassen, maximal 90 Zeichen und eine eigene Formulierung sein.
- Prüfe vor der Ausgabe jede Angabe gegen die Quelle und streiche alles, was nicht ausdrücklich belegt ist.
- imagePrompt: kurze englische Beschreibung einer symbolischen redaktionellen Illustration zum Ort, Thema und zur Stimmung der Meldung. Bevorzuge Landschaften, Gegenstände, Lichtstimmungen oder abstrakte Formen; keine Gebäudefassaden mit Beschriftung. Keine Menschen, keine Gesichter, keine Politiker, keine Logos, keine Flaggen, keine Zeitungen, keine Bildschirme und kein Text. Kein fotorealistischer Stil.
- Gib ausschließlich gültiges JSON ohne Markdown-Zäune und ohne Text außerhalb des JSON-Objekts zurück.

JSON-Format:
{
  "title": "max 90 Zeichen, sachliche eigene Überschrift",
  "excerpt": "max 180 Zeichen, eine Zusammenfassung in einem Satz",
  "category": "eine von: Welt, Politik, Wirtschaft, Technologie, Wissenschaft, Gesundheit, Klima, Kultur, Sport, Justiz",
  "body": "45-80 Wörter, zwei Absätze durch Leerzeile getrennt. Erster Absatz: genau ein Satz (Was, Wo, Wer). Zweiter Absatz: warum wichtig, nur mit Fakten aus der Quelle.",
  "imagePrompt": "kurze englische Beschreibung einer symbolischen redaktionellen Illustration zu Ort, Thema und Stimmung; Landschaften, Gegenstände oder abstrakte Formen statt Gebäudefassaden; keine Menschen, Gesichter, Politiker, Logos, Flaggen, Zeitungen, Bildschirme oder Schrift; nicht fotorealistisch."
}`;

function parseJson(content) {
  const cleaned = String(content || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('no JSON in model output');
  const json = cleaned.slice(start, end + 1).replace(/[\u0000-\u001F]/g, ' ');
  return JSON.parse(json);
}

const VERIFY_PROMPT = `Du bist ein strenger Faktenprüfer für einen deutschsprachigen Nachrichtenartikel.
Du erhältst die Überschrift und die Kurzbeschreibung einer RSS-Meldung sowie einen daraus erstellten deutschen Artikel.

Prüfe den Artikel Satz für Satz gegen die Quelle:
- Erlaubt sind Übersetzungen, Zusammenfassungen und Formulierungen in eigenen Worten.
- Nicht erlaubt sind Fakten, Namen, Orte, Zahlen, Ursachen, Folgen, Reaktionen, Bewertungen oder Aussagen über Dinge, die nicht geschehen sind, wenn sie nicht ausdrücklich in der Quelle stehen.
- Eine Aussage ist auch dann nicht gedeckt, wenn sie plausibel klingt oder allgemein bekannt ist.
- Nenne nur Sätze, die nicht gedeckt sind. Erfinde keine zusätzlichen Fakten und verlange keine Ergänzungen.

Antworte ausschließlich mit gültigem JSON:
{
  "unsupported": ["nicht gedeckter Satz aus dem Artikel"]
}
Wenn alle Sätze gedeckt sind, antworte mit {"unsupported": []}.`;

async function verifyShortArticle({ sourceTitle, sourceText, body }) {
  const messages = [
    { role: 'system', content: VERIFY_PROMPT },
    {
      role: 'user',
      content: `QUELLE:
${sourceTitle}

${sourceText.slice(0, 3000)}

ARTIKEL:
${body}

Prüfe jetzt den Artikel und antworte nur mit dem JSON-Objekt.`,
    },
  ];
  const data = await requestCompletion(messages, 0, 500);
  const finish = data?.choices?.[0]?.finish_reason;
  if (finish === 'length') throw new Error('fact-check output truncated');
  const result = parseJson(data?.choices?.[0]?.message?.content);
  const unsupported = Array.isArray(result.unsupported)
    ? result.unsupported.map((item) => String(item).trim()).filter(Boolean)
    : [];
  return unsupported.slice(0, 6);
}

function splitSentences(text) {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter('de', { granularity: 'sentence' }).segment(text)]
      .map((entry) => entry.segment.trim())
      .filter(Boolean);
  }
  return (text.match(/[^.!?]+[.!?]+/g) || [text]).map((sentence) => sentence.trim()).filter(Boolean);
}

function normalizeShortBody(value) {
  const paragraphs = String(value || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!paragraphs.length) return '';

  const first = splitSentences(paragraphs[0]);
  if (!first.length) return paragraphs.join('\n\n');
  return [first[0], [...first.slice(1), ...paragraphs.slice(1)].join(' ').trim()]
    .filter(Boolean)
    .join('\n\n');
}

function sanitize(result) {
  const title = String(result.title || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const excerpt = String(result.excerpt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const body = normalizeShortBody(
    String(result.body || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .trim(),
  );
  const category = CATEGORIES.includes(result.category) ? result.category : 'Welt';
  const imagePrompt = String(result.imagePrompt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length < 15 || title.length > 90) throw new Error(`bad title (${title.length})`);
  const wordCount = countBodyWords(body);
  if (wordCount < 45 || wordCount > 80) {
    throw new Error(`body word count ${wordCount}; erlaubt sind 45-80 Wörter`);
  }
  if (extractQuotes(body).length) throw new Error('Zitate sind im Kurzartikel nicht erlaubt');
  if (/als (ki|sprachmodell)|ich kann (das|dies) nicht|i cannot|language model/i.test(body)) {
    throw new Error('model refused');
  }

  return {
    title,
    excerpt: excerpt.slice(0, 180),
    category,
    body,
    imagePrompt: imagePrompt || title,
    wordCount,
  };
}

function unitInfo(unit) {
  const value = String(unit || '').toLowerCase().replace(/\s+/g, '');
  if (/^(milliarden?|mrd\.?|billion(s)?|billionen?)$/.test(value)) return { scale: 1e9, cls: '1e9' };
  if (/^(millionen?|mio\.?|million(s)?)$/.test(value)) return { scale: 1e6, cls: '1e6' };
  if (/^(prozent|percent|%)$/.test(value)) return { scale: 1, cls: '%' };
  if (/^(euro?|eur|€|dollar(s)?|usd|\$)$/.test(value)) return { scale: 1, cls: 'currency' };
  return { scale: 1, cls: 'none' };
}

function parseNumber(raw, locale) {
  let value = raw.replace(/\s/g, '');
  value = locale === 'de' ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectNumberKeys(text, locale) {
  const keys = new Map();
  const regex =
    /(\d[\d.,]*)\s*(Billionen?|Billion(?:s)?|Milliarden?|Millionen?|Million(?:s)?|Mrd\.?|Mio\.?|Prozent|percent|%|Euro?|EUR|€|Dollar(?:s)?|USD|\$)?/gi;
  const currentYear = new Date().getUTCFullYear();
  let match;
  while ((match = regex.exec(text))) {
    const raw = match[1];
    const unit = match[2] || '';
    const number = parseNumber(raw, locale);
    if (number === null) continue;
    if (!unit && number < 100) continue;
    if (!unit && number === currentYear) continue;
    const { scale, cls } = unitInfo(unit);
    const value = number * scale;
    const key = `${Number(value.toPrecision(6))}|${cls}`;
    if (!keys.has(key)) keys.set(key, match[0].trim());
  }
  return keys;
}

const ROLE_TERMS = [
  'Bundeskanzler',
  'Kanzler',
  'Bundesinnenminister',
  'Innenminister',
  'Ministerpräsident',
  'Ministerpräsidentin',
  'Wirtschaftsminister',
  'Wirtschaftsministerin',
  'Außenminister',
  'Außenministerin',
  'Verteidigungsminister',
  'Verteidigungsministerin',
  'Finanzminister',
  'Finanzministerin',
  'Justizminister',
  'Justizministerin',
  'Gesundheitsminister',
  'Gesundheitsministerin',
  'Arbeitsminister',
  'Arbeitsministerin',
  'Bildungsminister',
  'Bildungsministerin',
  'Minister',
  'Ministerin',
  'Senator',
  'Senatorin',
  'Bürgermeister',
  'Bürgermeisterin',
  'Generalsekretär',
  'Generalsekretärin',
  'Parteichef',
  'Parteichefin',
  'Vorsitzender',
  'Vorsitzende',
];

function findRoleIssues(output, source) {
  return ROLE_TERMS.filter((term) => {
    const pattern = new RegExp(`(^|[^\\p{L}])${term}([^\\p{L}]|$)`, 'iu');
    return pattern.test(output) && !pattern.test(source);
  });
}

const TITLE_ENGLISH =
  /\b(the|and|with|from|says|said|reconciliation|government|family|interview|according)\b/i;
const BODY_ENGLISH =
  /\b(the|and|with|from|that|this|those|these|would|says|said|after|before|about|into|their|there|where|while|according|reconciliation|government|family)\b/gi;

function findLanguageIssues(result) {
  const issues = [];
  const titleMatch = `${result.title} ${result.excerpt}`.match(TITLE_ENGLISH);
  if (titleMatch) issues.push(`englische Formulierung "${titleMatch[0]}" in der Überschrift`);

  const unquotedBody = result.body
    .replace(/["“”„«»‚‘‹›][^"“”„«»‚‘‹›]{0,500}["“”„«»‚‘‹›]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const bodyMatches = unquotedBody.match(BODY_ENGLISH) || [];
  if (bodyMatches.length >= 3) {
    issues.push(`englische Wörter im Text (${[...new Set(bodyMatches.map((w) => w.toLowerCase()))].slice(0, 4).join(', ')})`);
  }
  return issues;
}

function findQuoteIssues(result, sourceText) {
  const quotes = [
    ...extractQuotes(result.title),
    ...extractQuotes(result.excerpt),
    ...extractQuotes(result.body),
  ];
  if (quotes.length > 1) return ['mehr als ein Zitat; erlaubt ist höchstens ein kurzes Zitat'];

  if (!quotes.length) return [];
  const [quote] = quotes;
  if (countWords(quote) > 25) return ['Zitat ist länger als 25 Wörter'];

  const sourceNorm = normalizeForMatch(sourceText);
  const quoteNorm = normalizeForMatch(quote);
  if (!quoteNorm || !sourceNorm.includes(quoteNorm)) {
    return ['Zitat steht nicht exakt im Quelltext; Zitat entfernen oder exakt übernehmen'];
  }
  return [];
}

async function requestCompletion(messages, temperature, maxTokens = 4000) {
  if (OMNI_API_KEY) {
    try {
      const res = await fetch(OMNI_TEXT_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${OMNI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OMNI_TEXT_MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(180000),
      });
      if (res.ok) return await res.json();
      console.warn(`[text] OmniRoute HTTP ${res.status}, nutze Pollinations`);
    } catch (error) {
      console.warn(`[text] OmniRoute fehlgeschlagen (${error.message}), nutze Pollinations`);
    }
  }

  const apiKey = pollinationsKey();
  if (!apiKey) throw new FatalGenerationError('POLLINATIONS_API_KEY fehlt; Text kann nicht erzeugt werden');

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let res;
    try {
      res = await fetch(POLLINATIONS_TEXT_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: POLLINATIONS_TEXT_MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(180000),
      });
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      throw lastError;
    }

    if (res.status === 401 || res.status === 403) {
      const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 180);
      throw new FatalGenerationError(`Pollinations-Key ungültig oder ohne Modellrechte (${res.status})${body ? `: ${body}` : ''}`);
    }
    if (res.status === 402) throw new FatalGenerationError('Pollinations-Guthaben ist aufgebraucht');
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`text API HTTP ${res.status}`);
      if (attempt < 2) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 60000)
          : 10000 * (attempt + 1);
        console.warn(`[text] HTTP ${res.status}, warte ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }
      throw lastError;
    }
    if (!res.ok) throw new Error(`text API HTTP ${res.status}`);
    return await res.json();
  }
  throw lastError || new Error('keine Textantwort erhalten');
}

export async function rewriteArticle({
  sourceName,
  sourceTitle,
  sourceText,
  sourceLanguage = 'de',
}) {
  const sourceLocale = sourceLanguage === 'de' ? 'de' : 'en';
  const sourceKeys = collectNumberKeys(sourceText, sourceLocale);

  const basePrompt = `QUELLORGANISATION: ${sourceName}
ORIGINALÜBERSCHRIFT: ${sourceTitle}

QUELLTEXT:
${sourceText.slice(0, 7000)}

Schreibe jetzt den eigenständigen deutschen Artikel. Gib nur das JSON-Objekt zurück.`;

  let feedback = '';
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: feedback
            ? `${basePrompt}\n\nKORREKTURHINWEIS:\n${feedback}`
            : basePrompt,
        },
      ];
      const temperature = feedback ? 0.25 : 0.5;
      const data = await requestCompletion(messages, temperature, 1200);
      const finish = data?.choices?.[0]?.finish_reason;
      const content = data?.choices?.[0]?.message?.content;
      if (finish === 'length') throw new Error('model output truncated');

      const result = sanitize(parseJson(content));
      const outputKeys = collectNumberKeys(
        `${result.title}\n${result.excerpt}\n${result.body}`,
        'de',
      );
      const missing = [...outputKeys.entries()]
        .filter(([key]) => !sourceKeys.has(key))
        .map(([, display]) => display)
        .slice(0, 6);
      const roleIssues = sourceLocale === 'de' ? findRoleIssues(result.body, sourceText) : [];
      const languageIssues = findLanguageIssues(result);
      const quoteIssues = findQuoteIssues(result, sourceText);
      const claimIssues = findUnsupportedClaims(result.body, sourceText, {
        language: sourceLanguage,
      });
      const structureIssues = findStructureIssues(result.body);
      const bodyWithoutQuotes = result.body.replace(/[„“”"«»‚‘‹›][^„“”"«»‚‘‹›]{3,500}[„“”"«»‚‘‹›]/g, ' ');
      const overlaps = findLongOverlap(bodyWithoutQuotes, sourceText, 6);
      const titleOverlaps = findLongOverlap(result.title, sourceTitle, 5);

      const issues = [];
      if (missing.length) {
        issues.push(
          `Diese Zahlen/Angaben stehen so nicht im Quelltext: ${missing.join(', ')}. Übernimm Zahlen, Einheiten und Zeitangaben exakt; schreibe nicht "Millionen", wenn dort "Milliarden" steht.`,
        );
      }
      if (roleIssues.length) {
        issues.push(
          `Diese Amtsbezeichnungen stehen so nicht im Quelltext: ${roleIssues.join(', ')}. Verwende die exakte Bezeichnung aus der Quelle.`,
        );
      }
      if (languageIssues.length) {
        issues.push(
          `Der Text ist nicht durchgehend Deutsch: ${languageIssues.join('; ')}. Übersetze alle englischen Formulierungen außer Eigennamen und direkten Zitaten.`,
        );
      }
      if (quoteIssues.length) {
        issues.push(`${quoteIssues.join('; ')}.`);
      }
      if (titleOverlaps.length) {
        issues.push(`Die Überschrift übernimmt zu viel aus dem Original: "${titleOverlaps.join('" | "')}". Formuliere sie eigenständig.`);
      }
      if (overlaps.length) {
        issues.push(
          `Zu lange wörtliche Übereinstimmung mit der Quelle: "${overlaps.join('" | "')}". Formuliere eigenständig.`,
        );
      }
      if (claimIssues.length) {
        issues.push(
          `Nicht durch die Quelle gedeckte Sätze: ${claimIssues
            .map((item) => `"${item.sentence}" (${item.reasons.join(', ')})`)
            .join(' | ')}. Entferne eigene Einordnungen; formuliere nur Fakten aus dem Quelltext.`,
        );
      }
      if (structureIssues.length) {
        issues.push(
          `Struktur: ${structureIssues.join('; ')}. Beginne mit einem Lead-Satz (Was, Wo, Wer) und danach einem Absatz zur Bedeutung mit Fakten aus der Quelle.`,
        );
      }

      if (!issues.length) {
        const unsupported = await verifyShortArticle({
          sourceTitle,
          sourceText,
          body: result.body,
        });
        if (!unsupported.length) return result;
        issues.push(
          `Diese Sätze sind nicht ausdrücklich durch die Quelle gedeckt: ${unsupported
            .map((sentence) => `"${sentence}"`)
            .join(' | ')}. Streiche sie oder ersetze sie durch belegte Fakten.`,
        );
      }

      if (!issues.length) return result;

      feedback = issues.join('\n');
      lastError = new Error(`Prüfung fehlgeschlagen: ${issues.join(' | ')}`);
    } catch (error) {
      if (error instanceof FatalGenerationError) throw error;
      lastError = error;
      feedback = error.message;
      if (attempt < 2) await sleep(6000 * (attempt + 1));
    }
  }
  throw lastError;
}

async function pollinationsImage(prompt, seed, apiKey) {
  const params = new URLSearchParams({
    width: '1024',
    height: '576',
    model: IMAGE_MODEL,
    seed: String(seed),
  });
  const url = `${IMAGE_ENDPOINT}/${encodeURIComponent(prompt)}?${params}`;
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res;
    try {
      res = await fetch(url, {
        headers: {
          authorization: `Bearer ${apiKey}`,
          'user-agent': 'BreakingNewsBoulevard/1.0',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(90000),
      });
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(5000);
        continue;
      }
      throw lastError;
    }

    if (res.status === 401 || res.status === 403) {
      const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 180);
      throw new FatalGenerationError(`Pollinations-Key ungültig oder ohne Modellrechte (${res.status})${body ? `: ${body}` : ''}`);
    }
    if (res.status === 402) throw new FatalGenerationError('Pollinations-Guthaben ist aufgebraucht');
    if (res.status === 429) {
      lastError = new Error('Pollinations-Rate-Limit erreicht');
      if (attempt === 0) {
        await sleep(46000);
        continue;
      }
      throw lastError;
    }
    if (res.status >= 500) {
      lastError = new Error(`image API HTTP ${res.status}`);
      if (attempt === 0) {
        await sleep(10000);
        continue;
      }
      throw lastError;
    }
    if (!res.ok) throw new Error(`image API HTTP ${res.status}`);

    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`unexpected image content-type ${type}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) throw new Error(`image too small (${buffer.length} bytes)`);

    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    return { buffer, ext };
  }
  throw lastError;
}

const IMAGE_UNSAFE =
  /\b(trump|putin|zelensky|merz|merkel|macron|starmer|modi|xi|jinping|netanyahu|khamenei|kadyrow|lukaschenko|navalny|erdogan|orbán|orban|person|people|man|woman|child|children|soldier|politician|president|minister|chancellor|portrait|face|faces|logo|flag|newspaper|screen|text|letters|words)\b/i;

function safeImagePrompt(prompt, category = 'Welt') {
  let value = String(prompt || '')
    .replace(/\b(photorealistic|hyperrealistic|realistic|cinematic|photo|photograph)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutNegatives = value.replace(
    /\b(no|without)\s+(people|persons?|faces?|politicians?|presidents?|ministers?|logos?|flags?|text|words?|letters?|numbers?|signage)\b/gi,
    ' ',
  );
  if (!value || IMAGE_UNSAFE.test(withoutNegatives)) {
    value = `A symbolic editorial scene about ${category.toLowerCase()} and international news, with landscape, objects, light and abstract forms`;
  }
  return value;
}

export async function generateImage(prompt, seed = Math.floor(Math.random() * 1_000_000_000), category = 'Welt') {
  const apiKey = pollinationsKey();
  if (!apiKey) {
    throw new FatalGenerationError('POLLINATIONS_API_KEY fehlt; KI-Illustrationen können nicht erzeugt werden');
  }
  const artwork = safeImagePrompt(prompt, category);
  const finalPrompt = `${artwork}. Flat two-dimensional editorial illustration for a news article, silkscreen and gouache poster, solid muted colours, simplified geometric shapes, visible paper grain, wide 16:9 composition. The picture is entirely illustrated, with no photographic or 3D rendering and no depth of field. The artwork contains no people, no faces, no politicians, no flags, no lettering, no words, no numbers, no labels, no signage, no logos and no typography.`;
  return pollinationsImage(finalPrompt, seed, apiKey);
}
