export function countWords(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

export function countBodyWords(text) {
  const body = String(text || '')
    .split('\n')
    .filter((line) => !/^\s*##\s+/.test(line))
    .join(' ');
  return countWords(body);
}

export function extractQuotes(text) {
  const quotes = [];
  const pattern = /[„“”"»«‚‘‹›]([^„“”"»«‚‘‹›]{3,500})[„“”"»«‚‘‹›]/gu;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    const quote = match[1].trim();
    if (quote) quotes.push(quote);
  }
  return quotes;
}

export function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/[„“”"«»‚‘’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findLongOverlap(output, source, minWords = 10) {
  const sourceTokens = normalizeForMatch(source).split(' ').filter(Boolean);
  const outputTokens = normalizeForMatch(output).split(' ').filter(Boolean);
  if (sourceTokens.length < minWords || outputTokens.length < minWords) return [];

  const sourceGrams = new Set();
  for (let index = 0; index <= sourceTokens.length - minWords; index += 1) {
    sourceGrams.add(sourceTokens.slice(index, index + minWords).join(' '));
  }

  const hits = new Set();
  for (let index = 0; index <= outputTokens.length - minWords; index += 1) {
    const gram = outputTokens.slice(index, index + minWords).join(' ');
    if (sourceGrams.has(gram)) hits.add(gram);
  }

  return [...hits].slice(0, 3);
}

const CLAIM_STOPWORDS = new Set(
  `aber alle allem allen aller alles als also am an auch auf aus bei beim bin bis da damit dann das dass dem den denn der des die dies diese diesem diesen dieser dieses doch dort du durch ein eine einem einen einer eines er es etwas fuer gegen gegenueber gewesen gibt hat hatte haben hier hin hinter ich im in ist ja jede jeder jedes kann kein keine koennen man mehr mit muss nach nicht nichts noch nun nur ob oder ohne sehr sein seine sich sie sind so ueber um und uns unser unter viel vom von vor war waren was weg weil weiter welche wenn werden wie wieder wir wird wo zu zum zur zwar zwischen für gegenüber können über`.split(
    /\s+/,
  ),
);

const EDITORIAL_PATTERNS = [
  [/\bFrühindikator\b/iu, 'Einordnung "Frühindikator"'],
  [/\bDashboard\b/iu, 'Hinweis auf ein Dashboard'],
  [/\bAusblick\b/iu, 'eigener Ausblick'],
  [/\bPrognose\b/iu, 'Prognose'],
  [/\bFazit\b/iu, 'Fazit'],
  [/\bEinordnung\b/iu, 'eigene Einordnung'],
  [/\bBedeutung\b/iu, 'eigene Bedeutungseinordnung'],
  [/\bEmpfehlung\b/iu, 'Empfehlung'],
  [/\b(Rat geben|Ratschläge|ratsam)\b/iu, 'Empfehlung/Rat'],
  [/\bExperten\b/iu, 'nicht belegte Experten'],
  [/\bBeobachter\b/iu, 'nicht belegte Beobachter'],
];

function numberTokens(text) {
  return [...String(text || '').matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    match[0].replace(',', '.'),
  );
}

export function findUnsupportedClaims(output, source, { language = 'de' } = {}) {
  const sourceWords = new Set(normalizeForMatch(source).split(' ').filter(Boolean));
  const sourceNumbers = new Set(numberTokens(source));
  const body = String(output || '')
    .split('\n')
    .filter((line) => !/^\s*##\s+/.test(line))
    .join(' ');
  const sentences = body.match(/[^.!?]+[.!?]+/g) || (body.trim() ? [body.trim()] : []);
  const problems = [];

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const reasons = [];
    for (const [pattern, label] of EDITORIAL_PATTERNS) {
      if (pattern.test(sentence)) reasons.push(label);
    }

    for (const number of numberTokens(sentence)) {
      if (!sourceNumbers.has(number)) reasons.push(`Zahl ${number} nicht in der Quelle`);
    }

    if (language === 'de') {
      const words = normalizeForMatch(sentence)
        .split(' ')
        .filter((word) => word.length >= 4 && !CLAIM_STOPWORDS.has(word) && !/^\d+$/.test(word));
      if (words.length) {
        const hits = words.filter((word) => sourceWords.has(word)).length;
        const ratio = hits / words.length;
        if ((words.length <= 2 && hits === 0) || (words.length >= 3 && (hits < 2 || ratio < 0.5))) {
          reasons.push('zu wenig Quellenbezug');
        }
      }
    }

    if (reasons.length) {
      problems.push({ sentence, reasons: [...new Set(reasons)] });
    }
  }

  return problems;
}

export function findStructureIssues(body) {
  const paragraphs = String(body || '')
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => !/^\s*##\s+/.test(line))
        .join(' ')
        .trim(),
    )
    .filter(Boolean);
  const issues = [];

  if (paragraphs.length < 2) {
    issues.push('Lead und ein zweiter Absatz zur Bedeutung fehlen oder sind nicht getrennt');
    return issues;
  }

  const lead = paragraphs[0];
  const leadSentences = lead.match(/[^.!?]+[.!?]+/g) || [];
  if (!leadSentences.length) {
    issues.push('Der erste Satz fehlt oder ist nicht abgeschlossen (Was, Wo, Wer)');
  } else {
    const leadWords = countWords(leadSentences[0]);
    if (leadWords < 12 || leadWords > 60) {
      issues.push(`Der erste Satz hat ${leadWords} Wörter; erlaubt sind 12-60`);
    }
  }
  if (countWords(paragraphs[1]) < 15) {
    issues.push('Der Absatz zur Bedeutung ist zu kurz');
  }

  return issues;
}
