import { Jimp, JimpMime } from 'jimp';
import { fetchBuffer, sleep } from './http.mjs';

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
];

const SYSTEM_PROMPT = `Du bist erfahrener Redakteur bei Breaking News Boulevard, einem deutschsprachigen Nachrichtenportal.
Du schreibst echte Berichte seriöser Nachrichtenorganisationen in eigenständige, neutrale deutsche Artikel um.

Harte Regeln:
- Nutze ausschließlich Fakten, Namen, Zahlen und Zitate aus dem bereitgestellten Quelltext.
- Erfinde keine Fakten, Zitate, Zahlen, Orte, Ursachen oder Reaktionen.
- Übernimm Zahlen, Einheiten und Zeitangaben exakt aus dem Quelltext. Schreibe nicht "Millionen", wenn die Quelle "Milliarden" sagt, und rechne nichts um.
- Übernimm Amtsbezeichnungen exakt aus dem Quelltext (zum Beispiel "Bundesinnenminister", nicht "Ministerpräsident").
- Schreibe durchgehend auf Deutsch, auch die Überschrift. Englische Wörter nur in Eigennamen oder direkten Zitaten; übersetze Begriffe wie "reconciliation" mit "Versöhnung".
- Formuliere alles in eigenen Worten. Übernimm nie mehr als 6 aufeinanderfolgende Wörter aus der Quelle.
- Die Überschrift muss die zentrale Aussage des Artikels korrekt zusammenfassen. Achte besonders auf Verneinungen und Gegenteile (zum Beispiel "verweigert" versus "verlängert").
- Vermeide mehrdeutige Pronomen. Nenne bei wichtigen Aussagen die konkreten Akteure (zum Beispiel "Die Houthi vertrieben 2014 die Regierung aus Sanaa") statt "sie".
- Sachlicher, ruhiger Nachrichtenstil. Keine Meinung, keine Sensationslust, kein Clickbait.
- Wenn der Quelltext zu dünn ist, schreibe einen kürzeren, korrekten Artikel statt Lücken zu füllen.
- Nenne die Quelle, wo es natürlich passt (zum Beispiel "laut der tagesschau" oder "wie die BBC berichtet").
- Gib NUR gültiges JSON zurück, ohne Markdown-Zäune und ohne Text außerhalb des JSON-Objekts.

JSON-Format:
{
  "title": "max 90 Zeichen, sachliche Überschrift",
  "excerpt": "max 180 Zeichen, eine Zusammenfassung in einem Satz",
  "category": "eine von: Welt, Politik, Wirtschaft, Technologie, Wissenschaft, Gesundheit, Klima, Kultur, Sport",
  "body": "350-450 Wörter. Absätze durch Leerzeilen getrennt. 1-2 Zwischenüberschriften als Zeilen mit '## '.",
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
  return JSON.parse(cleaned.slice(start, end + 1));
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
  if (body.length < 700) throw new Error(`body too short (${body.length})`);
  if (/als (ki|sprachmodell)|ich kann (das|dies) nicht|i cannot|language model/i.test(body)) {
    throw new Error('model refused');
  }

  return {
    title,
    excerpt: excerpt.slice(0, 200),
    category,
    body,
    imagePrompt: imagePrompt || title,
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
    .replace(/["“”„«»][^"“”„«»]{0,500}["“”„«»]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const bodyMatches = unquotedBody.match(BODY_ENGLISH) || [];
  if (bodyMatches.length >= 3) {
    issues.push(`englische Wörter im Text (${[...new Set(bodyMatches.map((w) => w.toLowerCase()))].slice(0, 4).join(', ')})`);
  }
  return issues;
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
    if (res.status === 402) {
      if (rateWait === 3) throw new Error('text API HTTP 402 (rate limit)');
      const wait = 60000 * (rateWait + 1);
      console.warn(`[text] Rate-Limit erreicht, warte ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`text API HTTP ${res.status}`);
    return await res.json();
  }
  throw new Error('keine Textantwort erhalten');
}

export async function rewriteArticle({ sourceName, sourceTitle, sourceText }) {
  const sourceLocale = /tagesschau|heise|spiegel|zeit|zdf|deutschlandfunk/i.test(sourceName)
    ? 'de'
    : 'en';
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

      if (!issues.length) return result;

      feedback = issues.join('\n');
      lastError = new Error(`Prüfung fehlgeschlagen: ${issues.join(' | ')}`);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(6000 * (attempt + 1));
    }
  }
  throw lastError;
}

const FLUX_SPACES = [
  {
    name: 'flux-schnell',
    base: 'https://black-forest-labs-flux-1-schnell.hf.space',
    path: '/infer',
    data: (prompt, seed) => [prompt, seed, false, 1024, 576, 4],
  },
  {
    name: 'flux-merged',
    base: 'https://multimodalart-flux-1-merged.hf.space',
    path: '/infer',
    data: (prompt, seed) => [prompt, seed, false, 1024, 576, 3.5, 4],
  },
  {
    name: 'realtime-flux',
    base: 'https://kingnish-realtime-flux.hf.space',
    path: '/generate_image',
    data: (prompt, seed) => [prompt, seed, 1024, 576],
  },
];

async function callFluxSpace(space, prompt, seed) {
  const callUrl = `${space.base}/gradio_api/call${space.path}`;
  const res = await fetch(callUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: space.data(prompt, seed) }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`queue HTTP ${res.status}`);
  const { event_id: eventId } = await res.json();
  if (!eventId) throw new Error('queue returned no event id');

  const stream = await fetch(`${callUrl}/${eventId}`, { signal: AbortSignal.timeout(240000) });
  if (!stream.ok) throw new Error(`stream HTTP ${stream.status}`);
  const text = await stream.text();
  if (text.includes('event: error')) throw new Error('space returned an error');

  const block = text.split('\n\n').find((part) => part.includes('event: complete'));
  if (!block) throw new Error('generation did not complete');
  const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
  const data = JSON.parse(dataLine.slice(6));
  const file = Array.isArray(data) ? data[0] : data;
  if (!file?.url) throw new Error('no image url');

  const image = await fetchBuffer(file.url, { retries: 2, timeout: 90000 });
  if (image.buffer.length < 5000) throw new Error(`image too small (${image.buffer.length} bytes)`);
  const ext = image.type.includes('png') ? 'png' : image.type.includes('webp') ? 'webp' : 'jpg';
  return { buffer: image.buffer, ext, fallback: false };
}

export async function generateImage(prompt, seed = Math.floor(Math.random() * 1_000_000_000)) {
  const finalPrompt = `${prompt}. Symbolic editorial illustration for a news article, cinematic photorealistic style, muted navy and warm cream palette, wide 16:9 composition, no recognizable real people, no graphic violence. Absolutely no lettering, words, numbers, signage, logos or typography anywhere in the image.`;

  let lastError;
  for (let round = 0; round < 2; round += 1) {
    for (const space of FLUX_SPACES) {
      try {
        return await callFluxSpace(space, finalPrompt, seed + round);
      } catch (error) {
        lastError = error;
        console.warn(`[image] ${space.name} failed: ${error.message}`);
      }
      await sleep(2000);
    }
  }

  console.warn(`[image] all FLUX spaces failed (${lastError.message}); using Pollinations fallback`);
  await sleep(46000);
  const url = `${IMAGE_ENDPOINT}/${encodeURIComponent(finalPrompt)}?width=1024&height=576&nologo=true&seed=${seed}`;
  const { buffer, type } = await fetchBuffer(url, { retries: 2, timeout: 150000 });
  if (buffer.length < 5000) throw new Error(`image too small (${buffer.length} bytes)`);

  const image = await Jimp.read(buffer);
  image.crop({ x: 0, y: 0, w: image.bitmap.width, h: image.bitmap.height - 44 });
  const cropped = await image.getBuffer(JimpMime.jpeg, { quality: 88 });
  return { buffer: Buffer.from(cropped), ext: 'jpg', fallback: true };
}
