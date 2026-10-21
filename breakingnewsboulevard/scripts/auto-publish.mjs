import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const QUEUE_DIR = path.join(ROOT, 'review', 'queue');
const AUTO_PUBLISH = String(process.env.AUTO_PUBLISH ?? 'true').toLowerCase() !== 'false';
const CHECKS = [
  'names',
  'roles',
  'numbers',
  'facts',
  'timeliness',
  'source',
  'quote',
  'grounding',
  'structure',
];
const REVIEWER = process.env.AUTO_REVIEWER || 'Auto-Redaktion';

function fail(message) {
  console.error(`[auto] ${message}`);
  process.exit(1);
}

if (!AUTO_PUBLISH) {
  console.log('[auto] AUTO_PUBLISH=false: Keine automatische Veröffentlichung; Entwürfe bleiben liegen.');
  process.exit(0);
}

if (!fs.existsSync(QUEUE_DIR)) fail('Kein Review-Ordner gefunden.');

const drafts = fs
  .readdirSync(QUEUE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    id: entry.name,
    mtime: fs.statSync(path.join(QUEUE_DIR, entry.name)).mtimeMs,
  }))
  .sort((a, b) => a.mtime - b.mtime);

if (!drafts.length) fail('Kein Entwurf zum Veröffentlichen gefunden.');

console.log(`[auto] AUTO_PUBLISH=true: Prüfe ${drafts.length} Entwurf/Entwürfe.`);

const approved = [];
const failed = [];

for (const { id } of drafts) {
  console.log(`[auto] Prüfe: ${id}`);
  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'scripts', 'review.mjs'),
        'approve',
        id,
        '--reviewer',
        REVIEWER,
        '--checks',
        CHECKS.join(','),
      ],
      { cwd: ROOT, stdio: 'inherit' },
    );
    approved.push(id);
  } catch {
    failed.push(id);
  }
}

if (!approved.length) {
  fail(`Kein Entwurf konnte automatisch freigegeben werden. Blockiert: ${failed.join(', ')}`);
}

console.log(`[auto] Veröffentlicht: ${approved.length}; fehlgeschlagen: ${failed.length}.`);
if (failed.length) {
  console.warn(`[auto] Nicht veröffentlicht: ${failed.join(', ')}`);
}
