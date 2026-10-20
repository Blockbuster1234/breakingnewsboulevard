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
