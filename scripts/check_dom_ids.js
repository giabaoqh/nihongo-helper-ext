const fs = require('fs');

function checkIds(htmlPath, jsPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
  let match;
  const missing = new Set();
  const found = new Set();

  while ((match = regex.exec(js)) !== null) {
    const id = match[1];
    // Ignore dynamic IDs with template literals or variables
    if (id.includes('${') || id.includes('+')) continue;
    if (html.includes(`id="${id}"`) || html.includes(`id='${id}'`)) {
      found.add(id);
    } else {
      missing.add(id);
    }
  }

  console.log(`=== CHECKING: ${jsPath} vs ${htmlPath} ===`);
  console.log('Found IDs:', found.size);
  console.log('Missing IDs:', Array.from(missing));
  return Array.from(missing);
}

const missingWs = checkIds('JPEX/workspace.html', 'JPEX/scripts/workspace.js');
const missingPopup = checkIds('JPEX/popup.html', 'JPEX/scripts/popup.js');
const missingAnalyzer = checkIds('JPEX/analyzer.html', 'JPEX/scripts/analyzer_ui.js');
