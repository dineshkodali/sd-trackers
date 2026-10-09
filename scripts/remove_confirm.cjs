const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // We want to replace patterns like:
      // if (window.confirm(...)) {
      //   deleteFn(...)
      // }
      // This is a bit tricky with regex, but we can do a simpler replacement for single-line blocks:
      // if (window.confirm(...)) { deleteX(id); }
      // Or block matching.
      
      // Let's do a simple regex for: if (window.confirm(`...`)) { something }
      let newContent = content.replace(/if\s*\(\s*(?:window\.)?confirm\([^)]+\)\s*\)\s*\{\s*([\s\S]*?)\s*\}/g, (match, body) => {
        // If body contains multiple lines or just one, return it.
        // But what if it's nested?
        if (body.includes('if (')) return match; // skip complex ones
        return body;
      });

      // And for one liners:
      // if (!window.confirm(...)) return;
      newContent = newContent.replace(/if\s*\(\s*!(?:window\.)?confirm\([^)]+\)\s*\)\s*return;/g, '');

      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src', 'components'));
