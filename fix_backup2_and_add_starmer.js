const fs = require('fs');

let content = fs.readFileSync('js/posts.js.backup2', 'utf8');

// We'll fix the content by:
// 1. Replacing actual newlines inside single and double quoted strings with \n
// 2. Removing markdown bold markers (**) from inside single and double quoted strings.
// We must not touch template literals (backticks).

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

// Now we have fixed content. Let's check if the Starmer post is present.
const starmerSlug = "slug: 'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage'";
if (!result.includes(starmerSlug)) {
  // We need to add the Starmer post before the closing ];
  // Find the line that ends with ];
  const lines = result.split('\n');
  let endLine = -1;
  for (let j = 0; j < lines.length; j++) {
    if (lines[j].trim().endsWith('];')) {
      endLine = j;
      break;
    }
  }
  if (endLine === -1) {
    console.error('Could not find end of posts array');
    process.exit(1);
  }
  // Ensure the line before endLine ends with a comma
  if (endLine > 0) {
    const prev = lines[endLine - 1];
    if (!prev.trim().endsWith(',')) {
      lines[endLine - 1] = prev.trim() + ',';
    }
  }
  // Starmer post
  const starmerPost = `  {
    slug: 'starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage',
    title: 'Starmer gives doctors 48 hours to cancel strike or lose new jobs package',
    excerpt: 'Starmer gives doctors 48 hours to cancel strike or lose new jobs package\\n\\nLabour leader Sir Keir Starmer has issued an ultimatum to NHS doctors,',
    date: '2026-03-31',
    author: 'Breaking News Boulevard',
    url: '/posts/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage.html',
    image: 'https://picsum.photos/seed/starmergivesdoctors48hourstocancelstrikeorlosenewjobspackage/800/400'
  }';
  lines.splice(endLine, 0, starmerPost);
  result = lines.join('\n');
}

// Write back to js/posts.js
fs.writeFileSync('js/posts.js', result);
console.log('Fixed posts.js from backup2 and added Starmer post if missing');

// Verify by trying to parse it (just check for slugs)
try {
  const test = fs.readFileSync('js/posts.js', 'utf8');
  const postsMatch = test.match(/const posts = \[([\s\S]*?)\];/);
  if (postsMatch) {
    const slugMatches = postsMatch[1].match(/slug:/g);
    const count = slugMatches ? slugMatches.length : 0;
    console.log(`Fixed file has ${count} posts`);
  } else {
    console.error('Could not find posts array in fixed file');
  }
} catch (e) {
  console.error('Error reading fixed file:', e);
}
