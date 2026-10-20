import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEGAL_DIR = path.join(ROOT, 'legal');
const REQUIRED = ['impressum.html', 'datenschutz.html', 'korrekturen.html'];
const PLACEHOLDER = /\[(Name|Anschrift|E-Mail-Adresse|Datum|Hosting-Anbieter[^\]]*|Speicherdauer)\]/g;

let failures = 0;

for (const file of REQUIRED) {
  const filePath = path.join(LEGAL_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[legal] fehlt: legal/${file}`);
    failures += 1;
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const placeholders = [...new Set(html.match(PLACEHOLDER) || [])];
  if (placeholders.length) {
    console.error(`[legal] legal/${file}: Platzhalter offen: ${placeholders.join(', ')}`);
    failures += 1;
  } else {
    console.log(`[legal] legal/${file}: vollständig`);
  }

  if (/noindex/i.test(html)) {
    console.error(`[legal] legal/${file}: noindex ist noch gesetzt`);
    failures += 1;
  }
}

if (failures) {
  console.error('[legal] Rechtstexte sind noch nicht veröffentlichungsreif.');
  process.exitCode = 1;
} else {
  console.log('[legal] Rechtstexte vollständig und indexierbar.');
}
