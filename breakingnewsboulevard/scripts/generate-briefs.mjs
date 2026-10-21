import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_BRIEFS_PER_DAY,
  briefId,
  briefSourceByName,
  collectBriefCandidates,
  isAllowedBriefUrl,
  loadBriefsData,
  pickBriefCandidates,
  saveBriefsData,
} from './lib/briefs.mjs';
import { rewriteBrief } from './lib/ai.mjs';
import { rebuildSite } from './lib/render.mjs';
import { countWords, extractQuotes, findLongOverlap } from './lib/text.mjs';
import { sleep } from './lib/http.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

function loadPosts() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function validateBrief(item, candidate) {
  if (!item.headline || !item.text) throw new Error('leere Kurzmeldung');
  const words = countWords(`${item.headline} ${item.text}`);
  if (words > 50) throw new Error(`${words} Wörter; maximal 50 erlaubt`);
  if (extractQuotes(`${item.headline} ${item.text}`).length) {
    throw new Error('Kurzmeldung enthält ein Zitat');
  }
  if (/\b(Reuters|BBC|Tagesschau|Guardian|Al Jazeera|DW)\b/i.test(item.text)) {
    throw new Error('Quellenname steht im Text');
  }
  const overlaps = findLongOverlap(
    `${item.headline}\n${item.text}`,
    `${candidate.title}\n${candidate.description}`,
    5,
  );
  if (overlaps.length) throw new Error(`zu nah an der Quelle: ${overlaps.join(' | ')}`);
  return words;
}

async function main() {
  const requested = Number(argValue('--count', String(MAX_BRIEFS_PER_DAY)));
  const count = Math.max(0, Math.min(MAX_BRIEFS_PER_DAY, Number.isFinite(requested) ? requested : 0));
  const date = String(argValue('--date', new Date().toISOString().slice(0, 10)));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Ungültiges Datum: ${date}`);
  }

  const data = loadBriefsData();
  const today = data.days.find((day) => day.date === date);
  const existing = today?.items || [];
  const remaining = Math.max(0, MAX_BRIEFS_PER_DAY - existing.length);

  if (count === 0 || remaining === 0) {
    console.log(
      `[briefs] nichts zu tun: ${existing.length}/${MAX_BRIEFS_PER_DAY} Meldungen für ${date}`,
    );
    return;
  }

  const limit = Math.min(count, remaining);
  console.log(
    `[briefs] ${date}: bestehend ${existing.length}, Ziel ${limit} neue, maximal ${MAX_BRIEFS_PER_DAY}`,
  );

  const candidates = await collectBriefCandidates();
  if (!candidates.length) {
    console.error('[briefs] keine geeigneten RSS-Kandidaten gefunden');
    process.exitCode = existing.length ? 0 : 1;
    return;
  }

  const picks = pickBriefCandidates(candidates, existing, limit);
  console.log(`[briefs] ${picks.length} Kandidaten ausgewählt`);

  const created = [];

  for (const candidate of picks) {
    if (created.length >= limit) break;

    const source = briefSourceByName(candidate.sourceName);
    if (!source || !isAllowedBriefUrl(source, candidate.sourceUrl)) {
      console.warn(`[briefs] Quelle/Link nicht erlaubt: ${candidate.sourceName}`);
      continue;
    }

    try {
      console.log(`[briefs] schreibe: ${candidate.sourceName} — ${candidate.title}`);
      const rewritten = await rewriteBrief({
        sourceName: candidate.sourceName,
        sourceTitle: candidate.title,
        sourceDescription: candidate.description,
        sourceLanguage: candidate.sourceLanguage,
      });
      const words = validateBrief(rewritten, candidate);
      const item = {
        id: briefId(candidate.sourceId, candidate.sourceUrl, date),
        headline: rewritten.headline,
        text: rewritten.text,
        wordCount: words,
        sourceId: candidate.sourceId,
        sourceName: candidate.sourceName,
        sourceVia: candidate.sourceVia || '',
        sourceUrl: candidate.sourceUrl,
        publishedAt: candidate.publishedAt || '',
        createdAt: new Date().toISOString(),
      };
      created.push(item);
      console.log(`[briefs] ok (${words} Wörter): ${item.headline}`);
    } catch (error) {
      console.error(`[briefs] übersprungen: ${error.message}`);
    }

    await sleep(2000);
  }

  if (!created.length) {
    console.error('[briefs] keine neue Kurzmeldung erstellt');
    process.exitCode = existing.length ? 0 : 1;
    return;
  }

  if (today) {
    today.items.push(...created);
  } else {
    data.days.unshift({ date, items: created });
  }

  saveBriefsData(data);
  rebuildSite(loadPosts(), data);
  console.log(
    `[briefs] ${created.length} neue Meldungen gespeichert; ${(today?.items || created).length}/${MAX_BRIEFS_PER_DAY} für ${date}`,
  );
}

main().catch((error) => {
  console.error(`[briefs] Fehler: ${error.message}`);
  process.exitCode = 1;
});
