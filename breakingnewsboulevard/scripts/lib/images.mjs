import { Jimp, JimpMime } from 'jimp';
import { JSDOM } from 'jsdom';
import { fetchBuffer, fetchText } from './http.mjs';
import { normalizeForMatch } from './text.mjs';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const NASA_API = 'https://images-api.nasa.gov/search';
const NASA_GUIDELINES = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
const USER_AGENT = 'BreakingNewsBoulevard/1.0 (image licence check)';

function stripHtml(value) {
  const text = new JSDOM(`<body>${String(value || '')}</body>`).window.document.body.textContent;
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isFreeLicense(name) {
  const value = String(name || '').toLowerCase();
  if (!value) return false;
  if (/non[- ]?free|fair use|all rights reserved|gfdl/.test(value)) return false;
  if (/(^|\s|-)nc(\s|-|$)|noncommercial|(^|\s|-)nd(\s|-|$)|noderiv/.test(value)) return false;
  return /cc0|public domain|pd-|cc by/.test(value);
}

function fallbackLicenseUrl(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('cc0')) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (value.includes('public domain') || value.startsWith('pd')) {
    return 'https://creativecommons.org/publicdomain/mark/1.0/';
  }
  if (value.includes('by-sa')) return 'https://creativecommons.org/licenses/by-sa/4.0/';
  if (value.includes('by')) return 'https://creativecommons.org/licenses/by/4.0/';
  return '';
}

function commonsQuery(title) {
  const words = normalizeForMatch(title)
    .split(' ')
    .filter((word) => word.length >= 4)
    .slice(0, 14);
  return `${words.join(' ')} filetype:bitmap`;
}

async function searchCommons(title) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: commonsQuery(title),
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1600',
    format: 'json',
  });
  const data = JSON.parse(await fetchText(`${COMMONS_API}?${params}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
  }));
  const pages = Object.values(data?.query?.pages || {});
  const titleTokens = normalizeForMatch(title)
    .split(' ')
    .filter((word) => word.length >= 4);

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    const mime = String(info.mime || '');
    if (!/^image\/(jpeg|png|webp)$/i.test(mime)) continue;
    if ((info.width || 0) < 900 || (info.height || 0) < 450) continue;
    if (/\.svg$|logo|icon|seal|coat of arms|flag of/i.test(page.title || '')) continue;

    const meta = info.extmetadata || {};
    const license = stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || '');
    if (!isFreeLicense(license)) continue;

    const description = stripHtml(
      `${page.title || ''} ${meta.ImageDescription?.value || ''} ${meta.Credit?.value || ''}`,
    );
    const score = titleTokens.filter((token) => normalizeForMatch(description).includes(token)).length;
    if (score === 0) continue;

    const url = info.thumburl || info.url;
    if (!url) continue;
    const author = stripHtml(meta.Artist?.value || meta.Credit?.value || '') || 'Wikimedia Commons';
    return {
      url,
      ext: 'jpg',
      type: 'photo',
      credit: author.slice(0, 160),
      license,
      licenseUrl: stripHtml(meta.LicenseUrl?.value || '') || fallbackLicenseUrl(license),
      sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || '')}`,
      provider: 'Wikimedia Commons',
      alt: stripHtml(page.title || title)
        .replace(/^File:/i, '')
        .replace(/\.[a-z0-9]+$/i, '')
        .slice(0, 180),
    };
  }
  return null;
}

async function searchNasa(title) {
  const params = new URLSearchParams({
    q: title,
    media_type: 'image',
    page_size: '8',
  });
  const data = JSON.parse(await fetchText(`${NASA_API}?${params}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
  }));
  for (const item of data?.collection?.items || []) {
    const info = item?.data?.[0];
    const link = item?.links?.[0]?.href;
    if (!info || !link) continue;
    if (/logo|icon|seal|patch|poster|artwork|illustration/i.test(info.title || '')) continue;
    const creator = stripHtml(info.secondary_creator || '');
    if (creator && !/nasa|jpl|goddard|gsfc|ames|mars|noaa|usgs/i.test(creator)) continue;
    const license = 'NASA Media Usage Guidelines – i. d. R. gemeinfrei; Quellenangabe NASA';
    return {
      url: link,
      ext: 'jpg',
      type: 'photo',
      credit: creator ? `NASA / ${creator}` : 'NASA',
      license,
      licenseUrl: NASA_GUIDELINES,
      sourceUrl: `https://images.nasa.gov/details-${encodeURIComponent(info.nasa_id || '')}`,
      provider: 'NASA',
      alt: stripHtml(info.title || title).slice(0, 180),
    };
  }
  return null;
}

async function downloadPhoto(photo) {
  const { buffer } = await fetchBuffer(photo.url, { timeout: 60000, retries: 2 });
  if (buffer.length < 5000) throw new Error(`image too small (${buffer.length} bytes)`);
  const image = await Jimp.read(buffer);
  if (image.bitmap.width > 1800) image.resize({ w: 1800 });
  const jpeg = await image.getBuffer(JimpMime.jpeg, { quality: 86 });
  return { ...photo, buffer: Buffer.from(jpeg), ext: 'jpg' };
}

export async function findArticleImage({ title, sourceName = '' }) {
  const candidates = [() => searchCommons(title)];
  if (/nasa/i.test(sourceName)) candidates.push(() => searchNasa(title));

  for (const search of candidates) {
    try {
      const photo = await search();
      if (!photo) continue;
      return await downloadPhoto(photo);
    } catch (error) {
      console.warn(`[image] freies Foto nicht nutzbar: ${error.message}`);
    }
  }
  return null;
}
