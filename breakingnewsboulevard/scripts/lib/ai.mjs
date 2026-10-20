import { Jimp, JimpMime } from 'jimp';
import { sleep } from './http.mjs';
import {
  countBodyWords,
  countWords,
  extractQuotes,
  findLongOverlap,
  normalizeForMatch,
} from './text.mjs';

const TEXT_ENDPOINT = 'https://text.pollinations.ai/openai';
const OMNI_TEXT_ENDPOINT =
  (process.env.OMNI_BASE_URL || 'http://127.0.0.1:20128').replace(/\/$/, '') +
  '/v1/chat/completions';
const OMNI_TEXT_MODEL = process.env.OMNI_TEXT_MODEL || 'auto/gpt';
const OMNI_API_KEY = process.env.OMNI_API_KEY || '';
const IMAGE_ENDPOINT = 'https://image.pollinations.ai/prompt';

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
Du arbeitest ausschließlich mit offiziellen Primärquellen und schreibst daraus eigenständige, neutrale deutsche Nachrichtenberichte.

Harte Regeln:
- Nutze ausschließlich Fakten, Namen, Funktionen, Zahlen und Zitate aus dem bereitgestellten Quelltext.
- Erfinde keine Fakten, Zitate, Zahlen, Orte, Ursachen, Reaktionen oder Zusammenhänge.
- Übernimm Zahlen, Einheiten und Zeitangaben exakt aus dem Quelltext. Schreibe nicht "Millionen", wenn die Quelle "Milliarden" sagt, und rechne nichts um.
- Übernimm Amts- und Funktionsbezeichnungen exakt aus dem Quelltext (zum Beispiel "Bundesinnenminister", nicht "Ministerpräsident").
- Schreibe durchgehend auf Deutsch, auch die Überschrift. Englische Wörter nur in Eigennamen oder direkten Zitaten.
- Formuliere alles in eigenen Worten. Übernimm nie mehr als 9 aufeinanderfolgende Wörter aus der Quelle. Keine wörtliche Übersetzung und keine enge Umformulierung der Quellstruktur.
- Schreibe eine kurze eigene Zusammenfassung mit 120-180 Wörtern im Fließtext. Ziel sind 140-160 Wörter; niemals unter 120, nie über 180. Zähle die Wörter vor der Ausgabe. Gliedere den Text in kurze Absätze und 0-2 Zwischenüberschriften. Keine Füllsätze und keine erfundenen Details.
- Fasse nur 2-4 Kernaussagen zusammen. Gehe nicht Absatz für Absatz durch die Quelle und übersetze nicht Satz für Satz. Lass Details weg, die für die Kernaussage nicht nötig sind.
- Höchstens ein kurzes wörtliches Zitat mit maximal 25 Wörtern. Das Zitat muss exakt so im Quelltext stehen. Wenn du unsicher bist oder die Quelle fremdsprachig ist: kein Zitat.
- Die Überschrift muss die zentrale Aussage des Artikels korrekt zusammenfassen. Achte besonders auf Verneinungen und Gegenteile.
- Vermeide mehrdeutige Pronomen. Nenne bei wichtigen Aussagen die konkreten Akteure.
- Sachlicher, ruhiger Nachrichtenstil. Keine Meinung, keine Sensationslust, kein Clickbait.
- Wenn der Quelltext zu dünn ist, schreibe einen kürzeren, korrekten Artikel statt Lücken zu füllen.
- Nenne die Quelle als Organisation, wo es natürlich passt (zum Beispiel "die Europäische Kommission", "das Statistische Bundesamt" oder "der Bundesgerichtshof").
- Gib NUR gültiges JSON zurück, ohne Markdown-Zäune und ohne Text außerhalb des JSON-Objekts.

JSON-Format:
{
  "title": "max 90 Zeichen, sachliche Überschrift",
  "excerpt": "max 180 Zeichen, eine Zusammenfassung in einem Satz",
  "category": "eine von: Welt, Politik, Wirtschaft, Technologie, Wissenschaft, Gesundheit, Klima, Kultur, Sport, Justiz",
  "body": "120-180 Wörter Fließtext als kurze eigene Zusammenfassung. Absätze durch Leerzeilen getrennt. 0-2 Zwischenüberschriften als Zeilen mit '## '.",
  "imagePrompt": "kurze englische Beschreibung einer symbolischen redaktionellen Illustration. Bevorzuge Architektur, Landschaften, Gegenstände, Lichtstimmungen oder abstrakte Formen. Vermeide Bildschirme, Diagramme, Karten, Zeitungen, Dokumente, Schilder, Flaggen, Menschenmengen und alles mit Schrift. Keine realen Personen, keine Gewalt, kein Text."
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

function sanitize(result) {
  const title = String(result.title || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const excerpt = String(result.excerpt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const body = String(result.body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const category = CATEGORIES.includes(result.category) ? result.category : 'Welt';
  const imagePrompt = String(result.imagePrompt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length < 15 || title.length > 120) throw new Error(`bad title (${title.length})`);
  const wordCount = countBodyWords(body);
  if (wordCount < 120 || wordCount > 180) {
    throw new Error(`body word count ${wordCount}; erlaubt sind 120-180 Wörter`);
  }
  if (extractQuotes(body).length > 1) throw new Error('mehr als ein Zitat im Text');
  if (/als (ki|sprachmodell)|ich kann (das|dies) nicht|i cannot|language model/i.test(body)) {
    throw new Error('model refused');
  }

  return {
    title,
    excerpt: excerpt.slice(0, 200),
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

  for (let rateWait = 0; rateWait <= 3; rateWait += 1) {
    const res = await fetch(TEXT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages,
        temperature,
        max_tokens: maxTokens,
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (res.status === 402 || res.status === 429) {
      if (rateWait === 3) throw new Error(`text API HTTP ${res.status} (rate limit)`);
      const wait = 60000 * (rateWait + 1);
      console.warn(`[text] Rate-Limit erreicht, warte ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (res.status >= 500) {
      if (rateWait === 3) throw new Error(`text API HTTP ${res.status}`);
      const wait = 15000 * (rateWait + 1);
      console.warn(`[text] Serverfehler ${res.status}, warte ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`text API HTTP ${res.status}`);
    return await res.json();
  }
  throw new Error('keine Textantwort erhalten');
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
      const data = await requestCompletion(messages, temperature);
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
      const bodyWithoutQuotes = result.body.replace(/[„“”"«»‚‘‹›][^„“”"«»‚‘‹›]{3,500}[„“”"«»‚‘‹›]/g, ' ');
      const overlaps = findLongOverlap(bodyWithoutQuotes, sourceText);

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
      if (overlaps.length) {
        issues.push(
          `Zu lange wörtliche Übereinstimmung mit der Quelle: "${overlaps.join('" | "')}". Formuliere eigenständig.`,
        );
      }

      if (!issues.length) return result;

      feedback = issues.join('\n');
      lastError = new Error(`Prüfung fehlgeschlagen: ${issues.join(' | ')}`);
    } catch (error) {
      lastError = error;
      feedback = error.message;
      if (attempt < 2) await sleep(6000 * (attempt + 1));
    }
  }
  throw lastError;
}

const PALETTES = [
  { a: [12, 27, 51], b: [49, 94, 126], c: [224, 185, 122] },
  { a: [26, 44, 39], b: [78, 112, 88], c: [214, 166, 108] },
  { a: [52, 29, 42], b: [112, 65, 73], c: [225, 197, 151] },
  { a: [24, 32, 48], b: [83, 91, 118], c: [208, 205, 188] },
];

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

async function pollinationsImage(prompt, seed) {
  const url = `${IMAGE_ENDPOINT}/${encodeURIComponent(prompt)}?width=1024&height=576&nologo=true&seed=${seed}`;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res;
    try {
      res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 BreakingNewsBoulevard/1.0' },
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

    if (res.status === 402 || res.status === 429) {
      lastError = new Error(`image API HTTP ${res.status}`);
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

    const image = await Jimp.read(buffer);
    image.crop({ x: 0, y: 0, w: image.bitmap.width, h: Math.max(1, image.bitmap.height - 44) });
    const jpeg = await image.getBuffer(JimpMime.jpeg, { quality: 88 });
    return { buffer: Buffer.from(jpeg), ext: 'jpg', fallback: false };
  }
  throw lastError;
}

async function localFallbackImage(prompt, seed) {
  const width = 1024;
  const height = 576;
  const hash = hashString(`${prompt}:${seed}`);
  const palette = PALETTES[hash % PALETTES.length];
  const image = new Jimp({ width, height, color: 0x101827ff });
  const glowX = 0.18 + ((hash >>> 8) % 64) / 100;
  const glowY = 0.2 + ((hash >>> 14) % 60) / 100;
  const band = 0.25 + ((hash >>> 20) % 50) / 100;

  image.scan(0, 0, width, height, function (x, y, idx) {
    const nx = x / width;
    const ny = y / height;
    const t = clamp((nx * 0.62 + ny * 0.38) * 255) / 255;
    let r = mix(palette.a[0], palette.b[0], t) + mix(palette.b[0], palette.c[0], t * 0.55);
    let g = mix(palette.a[1], palette.b[1], t) + mix(palette.b[1], palette.c[1], t * 0.55);
    let b = mix(palette.a[2], palette.b[2], t) + mix(palette.b[2], palette.c[2], t * 0.55);
    r /= 2; g /= 2; b /= 2;

    const distance = Math.hypot(nx - glowX, ny - glowY);
    const glow = Math.max(0, 1 - distance * 2.6) ** 2;
    r += palette.c[0] * glow * 0.55;
    g += palette.c[1] * glow * 0.55;
    b += palette.c[2] * glow * 0.55;

    const wave = Math.sin((nx * 3.2 + ny * 1.4) * Math.PI) * 0.5 + 0.5;
    const stripe = smoothstep(band, band + 0.06, Math.abs(ny - 0.5) + wave * 0.05);
    r += palette.c[0] * stripe * 0.12;
    g += palette.c[1] * stripe * 0.12;
    b += palette.c[2] * stripe * 0.12;

    const ring = Math.abs(Math.hypot(nx - 0.72, ny - 0.3) - (0.16 + (hash % 9) / 100));
    const ringGlow = Math.max(0, 1 - ring / 0.012) ** 2;
    r += palette.c[0] * ringGlow * 0.5;
    g += palette.c[1] * ringGlow * 0.5;
    b += palette.c[2] * ringGlow * 0.5;

    const horizon = Math.max(0, 1 - Math.abs(ny - 0.72) / 0.005);
    r += palette.c[0] * horizon * 0.25;
    g += palette.c[1] * horizon * 0.25;
    b += palette.c[2] * horizon * 0.25;

    const hill1 = 0.68 + Math.sin(nx * 7.5 + (hash % 17)) * 0.025 + Math.sin(nx * 17) * 0.012;
    if (ny > hill1) {
      const depth = smoothstep(hill1, 1, ny);
      r = mix(r, palette.a[0] * 0.55, depth * 0.72);
      g = mix(g, palette.a[1] * 0.55, depth * 0.72);
      b = mix(b, palette.a[2] * 0.55, depth * 0.72);
    }
    const hill2 = 0.79 + Math.sin(nx * 4.5 + (hash % 31)) * 0.035;
    if (ny > hill2) {
      const depth = smoothstep(hill2, 1, ny);
      r = mix(r, 8, depth * 0.82);
      g = mix(g, 14, depth * 0.82);
      b = mix(b, 22, depth * 0.82);
    }

    const grain = (((x * 928371 + y * 364479 + hash) >>> 0) % 9) - 4;
    image.bitmap.data[idx] = clamp(r + grain);
    image.bitmap.data[idx + 1] = clamp(g + grain);
    image.bitmap.data[idx + 2] = clamp(b + grain);
    image.bitmap.data[idx + 3] = 255;
  });

  const jpeg = await image.getBuffer(JimpMime.jpeg, { quality: 88 });
  return { buffer: Buffer.from(jpeg), ext: 'jpg', fallback: true };
}

export async function generateImage(prompt, seed = Math.floor(Math.random() * 1_000_000_000)) {
  const finalPrompt = `${prompt}. Symbolic editorial illustration for a news article, cinematic photorealistic style, muted navy and warm cream palette, wide 16:9 composition, no recognizable real people, no graphic violence. Absolutely no lettering, words, numbers, signage, logos or typography anywhere in the image.`;
  if (process.env.AI_IMAGES === '1') {
    try {
      return await pollinationsImage(finalPrompt, seed);
    } catch (error) {
      console.warn(`[image] Pollinations failed (${error.message}); using local editorial illustration`);
    }
  }
  return localFallbackImage(finalPrompt, seed);
}
