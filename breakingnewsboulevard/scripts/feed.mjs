import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE = 'https://www.breakingnewsboulevard.com';
const POSTS = path.join(ROOT, 'data', 'posts.json');
const OUT = path.join(ROOT, 'feed.xml');

const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

if (!fs.existsSync(POSTS)) {
  console.error('[feed] data/posts.json fehlt - kein Feed erzeugt.');
  process.exit(0);
}

const all = JSON.parse(fs.readFileSync(POSTS, 'utf8'));
const posts = all
  .filter((post) => !post.review || post.review.status === 'approved')
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .slice(0, 30);

const newest = posts[0];
const lastBuild = newest
  ? new Date(newest.date + 'T06:00:00Z').toUTCString()
  : new Date().toUTCString();

const items = posts
  .map((post) => {
    const link = SITE + post.url;
    const pubDate = new Date(post.date + 'T06:00:00Z').toUTCString();
    const image = post.image ? SITE + post.image : '';
    const lines = [
      '    <item>',
      '      <title>' + esc(post.title) + '</title>',
      '      <link>' + esc(link) + '</link>',
      '      <guid isPermaLink="true">' + esc(link) + '</guid>',
      '      <pubDate>' + pubDate + '</pubDate>',
    ];
    if (post.category) lines.push('      <category>' + esc(post.category) + '</category>');
    lines.push('      <description>' + esc(post.excerpt) + '</description>');
    if (image) {
      lines.push('      <enclosure url="' + esc(image) + '" type="image/jpeg" length="0" />');
    }
    lines.push('    </item>');
    return lines.join('\n');
  })
  .join('\n');

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
  '  <channel>\n' +
  '    <title>Breaking News Boulevard</title>\n' +
  '    <link>' + SITE + '/</link>\n' +
  '    <atom:link href="' + SITE + '/feed.xml" rel="self" type="application/rss+xml" />\n' +
  '    <description>Weltnachrichten, taeglich in eigenen Worten zusammengefasst.</description>\n' +
  '    <language>de</language>\n' +
  '    <lastBuildDate>' + lastBuild + '</lastBuildDate>\n' +
  items + '\n' +
  '  </channel>\n' +
  '</rss>\n';

fs.writeFileSync(OUT, xml, 'utf8');
console.log('[feed] ' + posts.length + ' Beitraege geschrieben: ' + path.relative(ROOT, OUT));
