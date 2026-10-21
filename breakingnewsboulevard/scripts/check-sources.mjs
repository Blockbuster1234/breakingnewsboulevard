import {
  BLOCKED_SOURCES,
  SOURCES,
  collectCandidates,
  extractArticle,
  isSourceEnabled,
} from './lib/news.mjs';

const active = SOURCES.filter(isSourceEnabled);
console.log(`[sources] aktiv: ${active.map((source) => source.name).join(', ')}`);
console.log(`[sources] gesperrt: ${BLOCKED_SOURCES.map((source) => source.name).join(', ')}`);

const candidates = await collectCandidates(12);
const bySource = new Map();
for (const candidate of candidates) {
  if (!bySource.has(candidate.sourceId)) bySource.set(candidate.sourceId, []);
  bySource.get(candidate.sourceId).push(candidate);
}

let failures = 0;

for (const source of active) {
  const list = bySource.get(source.id) || [];
  if (!list.length) {
    console.error(`[fail] ${source.name}: keine Kandidaten im Feed`);
    failures += 1;
    continue;
  }

  const candidate = list[0];
  try {
    const article = await extractArticle(candidate);
    console.log(
      `[ok] ${source.name}: ${article.title.slice(0, 90)} (${article.text.length} Zeichen, ${article.language})\n     ${article.url}`,
    );
  } catch (error) {
    console.error(`[fail] ${source.name}: ${error.message}`);
    failures += 1;
  }
}

if (failures) {
  console.error(`[sources] ${failures} aktive Quelle(n) fehlgeschlagen`);
  process.exitCode = 1;
} else {
  console.log('[sources] alle aktiven Quellen liefern Inhalte');
}
