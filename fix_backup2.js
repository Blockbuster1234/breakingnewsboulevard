const fs = require('fs');

let content = fs.readFileSync('js/posts.js.backup2', 'utf8');

// We'll process the content to fix:
// 1. Remove markdown bold markers (**) from inside single and double quoted strings.
// 2. Replace actual newlines inside single and double quoted strings with \n.
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

fs.writeFileSync('js/posts.js.fixed', result);
console.log('Fixed file written to js/posts.js.fixed');
