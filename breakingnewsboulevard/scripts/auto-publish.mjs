import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const QUEUE_DIR = path.join(ROOT, 'review', 'queue');
const CHECKS = ['names', 'roles', 'numbers', 'facts', 'timeliness', 'source', 'quote'];
const REVIEWER = process.env.AUTO_REVIEWER || 'Auto-Redaktion';

function fail(message) {
  console.error(`[auto] ${message}`);
  process.exit(1);
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

const { id } = drafts[drafts.length - 1];
console.log(`[auto] Prüfe und veröffentliche Entwurf: ${id}`);

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
} catch {
  fail(`Automatische Freigabe fehlgeschlagen für ${id}.`);
}

console.log(`[auto] Veröffentlicht durch ${REVIEWER}.`);
