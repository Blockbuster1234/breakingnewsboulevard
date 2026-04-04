const fs = require('fs');

// Read original_posts.js (known good syntax)
let originalContent = fs.readFileSync('original_posts.js', 'utf8');
// Extract the posts array
const originalArrayMatch = originalContent.match(/const posts = \[([\s\S]*?)\];/);
if (!originalArrayMatch) {
  console.error('Could not find posts array in original_posts.js');
  process.exit(1);
}
let originalArrayContent = originalArrayMatch[1];
// Split original array content into post objects (strings)
let originalPosts = [];
let braceCount = 0;
let current = '';
for (let i = 0; i < originalArrayContent.length; i++) {
  const c = originalArrayContent[i];
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
      originalPosts.push(current);
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
console.log(`Original posts count: ${originalPosts.length}`);

// Read backup2.js
let backupContent = fs.readFileSync('js/posts.js.backup2', 'utf8');
// Extract the posts array
const backupArrayMatch = backupContent.match(/const posts = \[([\s\S]*?)\];/);
if (!backupArrayMatch) {
  console.error('Could not find posts array in js/posts.js.backup2');
  process.exit(1);
}
let backupArrayContent = backupArrayMatch[1];
// Split backup array content into post objects (strings)
let backupPosts = [];
braceCount = 0;
current = '';
for (let i = 0; i < backupArrayContent.length; i++) {
  const c = backupArrayContent[i];
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
      backupPosts.push(current);
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
console.log(`Backup2 posts count: ${backupPosts.length}`);

// Extract slugs from original posts
const originalSlugs = originalPosts.map(postStr => {
  const match = postStr.match(/slug:\s*['\"]([^'\"]+)['\"]/);
  return match ? match[1] : null;
});
console.log('Original slugs:', originalSlugs.join(','));

// Find posts in backup2 that are not in original
const missingPosts = backupPosts.filter(postStr => {
  const match = postStr.match(/slug:\s*['\"]([^'\"]+)['\"]/);
  const slug = match ? match[1] : null;
  return !originalSlugs.includes(slug);
});
console.log(`Missing posts count: ${missingPosts.length}`);
missingPosts.forEach(postStr => {
  const match = postStr.match(/slug:\s*['\"]([^'\"]+)['\"]/);
  console.log('  -', match ? match[1] : 'NO SLUG');
});

// Build new array content: missingPosts (in the order they appear in backup2) + originalPosts + Starmer post
let newArrayContent = '';
// Add missing posts
missingPosts.forEach((postStr, index) => {
  newArrayContent += postStr;
  if (index !== missingPosts.length - 1 || originalPosts.length > 0) {
    newArrayContent += ',\n';
  }
});
// Add original posts
originalPosts.forEach((postStr, index) => {
  newArrayContent += postStr;
  if (index !== originalPosts.length - 1) {
    newArrayContent += ',\n';
  }
});
// Add Starmer post if not already present (should not be)
const starmerSlug = 'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage';
if (!originalSlugs.includes(starmerSlug) && !missingPosts.some(p => p.includes(starmerSlug))) {
  if (newArrayContent.length > 0) {
    newArrayContent += ',\n';
  }
  newArrayContent += `  {
    slug: '${starmerSlug}',
    title: 'Starmer gives doctors 48 hours to cancel strike or lose new jobs package',
    excerpt: 'Starmer gives doctors 48 hours to cancel strike or lose new jobs package\\n\\nLabour leader Sir Keir Starmer has issued an ultimatum to NHS doctors,',
    date: '2026-03-31',
    author: 'Breaking News Boulevard',
    url: '/posts/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage.html',
    image: 'https://picsum.photos/seed/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage/800/400'
  }`;
}

// Now construct the new file content
const newContent = `// posts.js — Article database
// Each post: { slug, title, excerpt, image, category, date, author, url, body }

const posts = [
${newArrayContent}
];`;

fs.writeFileSync('js/posts.js', newContent);
console.log('Written js/posts.js');

// Verify by trying to parse it
try {
  const test = fs.readFileSync('js/posts.js', 'utf8');
  // We'll just check if it's syntactically valid by using Function constructor? 
  // Instead, we can try to extract the array length with a regex.
  const postsMatch = test.match(/const posts = \[([\s\S]*?)\];/);
  if (postsMatch) {
    // Count the number of objects by counting slugs
    const slugMatches = postsMatch[1].match(/slug:/g);
    const count = slugMatches ? slugMatches.length : 0;
    console.log(`New posts.js has ${count} posts`);
  } else {
    console.error('Could not find posts array in new file');
  }
} catch (e) {
  console.error('Error reading new file:', e);
}
