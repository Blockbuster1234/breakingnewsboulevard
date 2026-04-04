const fs = require('htmlparser2'); // Not available, we'll do without
// We'll do a simpler approach: just fix the backup2 file and then add the missing posts from original_posts.js? 
// Let's instead: take original_posts.js (clean) and then for each missing slug, we'll get the post from backup2 and fix it.
// We know backup2 has the posts we need (except Starmer and maybe others) but with syntax errors.

// Function to fix a string: remove ** and replace actual newlines in single/double quoted strings with \n
function fixStringInObject(str) {
  let result = '';
  let i = 0;
  let len = str.length;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escape = false;

  while (i < len) {
    let c = str[i];
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
      if (c === '*' && i + 1 < len && str[i + 1] === '*') {
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

// Get slugs from original posts
const originalSlugs = originalPosts.map(p => extractSlug(p)).filter(Boolean);
console.log('Original slugs:', originalSlugs.join(','));

// List of all expected slugs from HTML files (we'll compute from the posts directory)
// Exclude article-template.html as it's likely a template, not a post.
const htmlSlugs = [
  'ai-image-generation-chatgpt-claude-grok-2026',
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

// Determine missing slugs
const missingSlugs = htmlSlugs.filter(s => !originalSlugs.includes(s));
console.log('Missing slugs:', missingSlugs.join(','));
console.log('Missing count:', missingSlugs.length);

// Backup files to search (in order of preference)
const backupFiles = [
  'js/posts.js.backup2',
  'js/posts.js.backup3',
  'js/posts.js.backup_broken',
  'old_posts.js'
];

// For each missing slug, find the post in the backups
const missingPosts = []; // will hold fixed post strings
for (const slug of missingSlugs) {
  let found = false;
  for (const file of backupFiles) {
    try {
      const arrayContent = extractPostsArrayContent(file);
      const posts = splitPosts(arrayContent);
      for (const postStr of posts) {
        if (extractSlug(postStr) === slug) {
          // Fix the post object string
          const fixed = fixStringInObject(postStr);
          missingPosts.push(fixed);
          console.log(`  Found ${slug} in ${file}`);
          found = true;
          break;
        }
      }
      if (found) break;
    } catch (e) {
      // If the file doesn't have a posts array or other error, skip
      console.error(`Error processing ${file}: ${e.message}`);
    }
  }
  if (!found) {
    console.error(`Could not find post for slug: ${slug}`);
    process.exit(1);
  }
}

// Now construct the new array content: originalPosts (unchanged) + missingPosts
let newArrayContent = '';
// Add original posts (as they are, unchanged)
originalPosts.forEach((postStr, index) => {
  newArrayContent += postStr;
  if (index !== originalPosts.length - 1 || missingPosts.length > 0) {
    newArrayContent += ',\n';
  }
});
// Add fixed missing posts
missingPosts.forEach((postStr, index) => {
  newArrayContent += postStr;
  if (index !== missingPosts.length - 1) {
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
