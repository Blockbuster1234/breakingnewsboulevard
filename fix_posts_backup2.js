const fs = require('fs');

const content = fs.readFileSync('js/posts.js.backup2', 'utf8');

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

fs.writeFileSync('js/posts.js', result);
console.log('Fixed posts.js from backup2');
