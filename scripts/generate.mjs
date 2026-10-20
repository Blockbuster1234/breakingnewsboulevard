import fs from 'node:fs';
import path from 'node:path';
import { collectCandidates, extractArticle, isSimilarTitle } from './lib/news.mjs';
import { rewriteArticle, generateImage } from './lib/ai.mjs';
import { rebuildSite, slugify, writePostPage } from './lib/render.mjs';
import { sleep } from './lib/http.mjs';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');
const POSTS_DIR = path.join(ROOT, 'posts');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

function loadPosts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function savePosts(posts) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(posts, null, 2)}\n`);
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function uniqueSlug(title, date, posts) {
  const base = slugify(title, date);
  let slug = base;
  let counter = 2;
  const taken = new Set(posts.map((post) => post.slug));
  while (taken.has(slug) || fs.existsSync(path.join(POSTS_DIR, `${slug}.html`))) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

async function main() {
  const count = Math.max(0, Number(argValue('--count', '3')) || 0);
  if (count === 0) {
    const posts = loadPosts();
    rebuildSite(posts);
    console.log(`[site] rebuilt with ${posts.length} posts (no new articles requested)`);
    return;
  }

  fs.mkdirSync(POSTS_DIR, { recursive: true });
  const posts = loadPosts();
  const usedUrls = new Set(posts.map((post) => normalizeUrl(post.source?.url || '')).filter(Boolean));
  const titles = posts.map((post) => post.title);
  const date = new Date().toISOString().slice(0, 10);

  console.log(`[start] ${date} — existing posts: ${posts.length}, target: ${count}`);

  const candidates = await collectCandidates(16);
  console.log(`[news] ${candidates.length} candidates from ${new Set(candidates.map((c) => c.source)).size} sources`);

  let created = 0;

  for (const candidate of candidates) {
    if (created >= count) break;
    if (usedUrls.has(normalizeUrl(candidate.url))) continue;
    if (titles.some((title) => isSimilarTitle(title, candidate.title))) continue;

    try {
      console.log(`[fetch] ${candidate.source}: ${candidate.title}`);
      const article = await extractArticle(candidate);

      if (titles.some((title) => isSimilarTitle(title, article.title))) {
        console.log(`[skip] duplicate story: ${article.title}`);
        continue;
      }

      console.log(`[write] AI rewrite (${article.text.length} chars source)`);
      const rewritten = await rewriteArticle({
        sourceName: candidate.source,
        sourceTitle: article.title,
        sourceText: article.text,
      });

      if (titles.some((title) => isSimilarTitle(title, rewritten.title))) {
        console.log(`[skip] rewritten title duplicates an existing story: ${rewritten.title}`);
        continue;
      }

      console.log(`[image] ${rewritten.imagePrompt}`);
      const { buffer, ext } = await generateImage(rewritten.imagePrompt);

      const slug = uniqueSlug(rewritten.title, date, posts);
      const imageFile = `${slug}-hero.${ext}`;
      fs.writeFileSync(path.join(POSTS_DIR, imageFile), buffer);

      const post = {
        slug,
        title: rewritten.title,
        excerpt: rewritten.excerpt,
        date,
        category: rewritten.category,
        url: `/posts/${slug}.html`,
        image: `/posts/${imageFile}`,
        images: [`/posts/${imageFile}`],
        source: { name: candidate.source, url: candidate.url },
        body: rewritten.body,
        imagePrompt: rewritten.imagePrompt,
        createdAt: new Date().toISOString(),
      };

      writePostPage(post);
      posts.unshift(post);
      titles.push(post.title);
      usedUrls.add(normalizeUrl(candidate.url));
      created += 1;

      posts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      savePosts(posts.slice(0, 180));
      console.log(`[ok] ${post.title} -> ${post.url}`);

      if (created < count) await sleep(30000);
    } catch (error) {
      console.warn(`[skip] ${candidate.url} — ${error.message}`);
    }
  }

  rebuildSite(posts);
  console.log(`[done] created ${created}/${count} new posts; site rebuilt with ${posts.length} posts`);

  if (created === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[fatal] ${error.stack || error.message}`);
  process.exit(1);
});
