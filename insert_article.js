const fs = require('fs');

// Read current posts.js
let content = fs.readFileSync('js/posts.js', 'utf8');

// Read the new article
const newArticle = fs.readFileSync('js/today_article.txt', 'utf8');

// Find 'const posts = [' and insert right after
const marker = 'const posts = [';
const idx = content.indexOf(marker);
if (idx === -1) {
  console.error('ERROR: Cannot find const posts = [');
  process.exit(1);
}

// Insert new article at front
content = content.substring(0, idx + marker.length) + '\n' + newArticle + content.substring(idx + marker.length);

// Write back
fs.writeFileSync('js/posts.js', content);

// Validate
try {
  new Function(content);
  const slugs = content.match(/slug:\s*"/g);
  console.log('✅ Valid JS with', slugs ? slugs.length : 0, 'articles');
  
  // List all articles
  const slugNames = content.match(/slug:\s*"([^"]+)"/g);
  if (slugNames) {
    slugNames.forEach((s, i) => {
      const name = s.replace(/slug:\s*"/, '').replace(/"$/, '');
      console.log(i+1, name);
    });
  }
} catch(e) {
  console.error('❌ Invalid JS:', e.message.substring(0, 200));
  process.exit(1);
}

// Cleanup
fs.unlinkSync('js/today_article.txt');
console.log('Done!');
