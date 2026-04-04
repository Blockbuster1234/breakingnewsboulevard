const fs = require('fs');

// Function to fix a string: remove ** and replace actual newlines in single/double quoted strings with \n
function fixString(content) {
  let result = '';
  let i = 0;
  let len = content.length;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escape = false;

  while (i < len) {
    let c = content[i];
    if (escape) {
      escape = false;
      result += c;
      i++;
      continue;
    }
    if (c === '\\\\') {
      escape = true;
      result += c;
      i++;
      continue;
    }
    // Handle quotes
    if (!inBacktick) {
      if (c === "'" && !inDouble) {
        inSingle = !inSingle;
        result += c;
        i++;
        continue;
      }
      if (c === '"' && !inSingle) {
        inDouble = !inDouble;
        result += c;
        i++;
        continue;
      }
    }
    if (c === '`' && !(inSingle || inDouble)) {
      inBacktick = !inBacktick;
      result += c;
      i++;
      continue;
    }
    // Replace newlines inside string literals (single or double) with \n
    if (c === '\n' || c === '\r') {
      if (inSingle || inDouble) {
        result += '\\\\n';
      } else {
        result += c;
      }
    } else {
      // Remove markdown bold markers by not adding them
      if (c === '*' && i + 1 < len && content[i + 1] === '*') {
        // Skip both asterisks
        i += 2;
        continue;
      } else {
        result += c;
      }
    }
    i++;
  }
  return result;
}

// Extract posts array content from a file given the file path
function extractPostsArrayContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/const posts = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error(`Could not find posts array in ${filePath}`);
  }
  return match[1]; // the content inside the brackets
}

// Split array content into post objects (strings) by top-level braces
function splitPosts(arrayContent) {
  const posts = [];
  let braceCount = 0;
  let current = '';
  for (let i = 0; i < arrayContent.length; i++) {
    const c = arrayContent[i];
    if (c === '{') {
      if (braceCount === 0) {
        current = '{';
      } else {
        current += c;
      }
      braceCount++;
    } else if (c === '}') {
      braceCount--;
      current += c;
      if (braceCount === 0) {
        posts.push(current);
        current = '';
      } else {
        current += c;
      }
    } else {
      if (braceCount > 0) {
        current += c;
      }
    }
  }
  return posts;
}

// Extract slug from a post object string
function extractSlug(postStr) {
  const match = postStr.match(/slug:\s*['\"]([^'\"]+)['\"]/);
  return match ? match[1] : null;
}

// Read original_posts.js (clean base)
let originalArrayContent;
try {
  originalArrayContent = extractPostsArrayContent('original_posts.js');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const originalPosts = splitPosts(originalArrayContent);
console.log(`Original posts count: ${originalPosts.length}`);

// Read backup2.js
let backup2ArrayContent;
try {
  backup2ArrayContent = extractPostsArrayContent('js/posts.js.backup2');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const backup2Posts = splitPosts(backup2ArrayContent);
console.log(`Backup2 posts count: ${backup2Posts.length}`);

// Read backup3.js
let backup3ArrayContent;
try {
  backup3ArrayContent = extractPostsArrayContent('js/posts.js.backup3');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const backup3Posts = splitPosts(backup3ArrayContent);
console.log(`Backup3 posts count: ${backup3Posts.length}`);

// Read backup_broken.js
let backupBrokenArrayContent;
try {
  backupBrokenArrayContent = extractPostsArrayContent('js/posts.js.backup_broken');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const backupBrokenPosts = splitPosts(backupBrokenArrayContent);
console.log(`Backup broken posts count: ${backupBrokenPosts.length}`);

// Get slugs from original posts
const originalSlugs = originalPosts.map(p => extractSlug(p)).filter(Boolean);
console.log('Original slugs:', originalSlugs.join(','));

// Function to get a post by slug from a list of posts (returning the fixed version)
function getFixedPostBySlug(postsList, slug) {
  for (const postStr of postsList) {
    if (extractSlug(postStr) === slug) {
      return fixString(postStr);
    }
  }
  return null;
}

// Determine missing slugs from the HTML files (we'll compute from the backups and original)
const allSlugsFromHTML = [
  'ai-image-generation-chatgpt-claude-grok-2026',
  'article-template',
  'bird-flu-kerala-india-h5n1-2026',
  'chuck-norris-dies-at-86',
  'iea-global-economy-major-threat-iran-war-march-2026',
  'iran-us-war-natanz-nuclear-strike-march-2026',
  'nasa-moon-rocket-launch-pad-april-2026',
  'rocket-lab-launches-8th-satellite-synspective',
  'russian-oil-tanker-reaches-cuba-after-trump-appears-to-loosen-blockade',
  'scientists-grow-hair-follicles-lab-breakthrough-2026',
  'spain-closes-airspace-to-us-aircraft-involved-in-iran-war',
  'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage',
  'strait-of-hormuz-oil-crisis-2026',
  'trump-48-hour-ultimatum-iran-hormuz-march-2026',
  'trump-claims-iran-talks-denied-ultimatum-extended-march-2026',
  'us-deploys-82nd-airborne-ceasefire-talks-iran-war-march-2026',
  'why-does-the-us-have-iran-s-kharg-island-in-its-sights'
];

const missingSlugs = allSlugsFromHTML.filter(s => !originalSlugs.includes(s));
console.log('Missing slugs:', missingSlugs.join(','));
console.log('Missing count:', missingSlugs.length);

// Collect fixed missing posts from backups
const fixedMissingPosts = [];
for (const slug of missingSlugs) {
  // Try backup2 first
  let post = getFixedPostBySlug(backup2Posts, slug);
  if (!post) {
    // Try backup3
    post = getFixedPostBySlug(backup3Posts, slug);
  }
  if (!post) {
    // Try backup_broken
    post = getFixedPostBySlug(backupBrokenPosts, slug);
  }
  if (!post) {
    console.error(`Could not find post for slug: ${slug}`);
    process.exit(1);
  }
  fixedMissingPosts.push(post);
  console.log(`  Fixed post for ${slug}`);
}

// Now construct the new array content: originalPosts (unchanged) + fixedMissingPosts
// We need to join them with commas and newlines.
let newArrayContent = '';
// Add original posts (as they are, unchanged)
originalPosts.forEach((postStr, index) => {
  newArrayContent += postStr;
  if (index !== originalPosts.length - 1 || fixedMissingPosts.length > 0) {
    newArrayContent += ',\n';
  }
});
// Add fixed missing posts
fixedMissingPosts.forEach((postStr, index) => {
  newArrayContent += postStr;
  if (index !== fixedMissingPosts.length - 1) {
    newArrayContent += ',\n';
  }
});

// Build the new file content
const newContent = `// posts.js — Article database
// Each post: { slug, title, excerpt, image, category, date, author, url, body }

const posts = [
${newArrayContent}
];`;

fs.writeFileSync('js/posts.js', newContent);
console.log('Written js/posts.js');

// Verify by counting slugs
const test = fs.readFileSync('js/posts.js', 'utf8');
const postsMatch = test.match(/const posts = \[([\s\S]*?)\];/);
if (postsMatch) {
  const slugMatches = postsMatch[1].match(/slug:/g);
  const count = slugMatches ? slugMatches.length : 0;
  console.log(`New posts.js has ${count} posts`);
  // Also list slugs to verify
  const slugList = postsMatch[1].match(/slug:\s*['\"]([^'\"]+)['\"]/g);
  if (slugList) {
    const slugs = slugList.map(m => m.match(/['\"]([^'\"]+)['\"]/)[1]);
    console.log('Slugs:', slugs.join(','));
  }
} else {
  console.error('Could not find posts array in new file');
  process.exit(1);
}
