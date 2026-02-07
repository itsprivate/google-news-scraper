const testUrl = 'https://news.google.com/read/CBMiWkFVX3lxTE8tTndVMDVrYXgteVZuc2JYanMwYjktbnJHNndNMW91ZlVMcHBfZDgzTTVJdmt5dXUzbmw3aDFidUhXQVVOOXNXYVZCcVNTSVh0bU1WSElkQ0xvdw?hl=en-US&gl=US&ceid=US%3Aen';

const res = await fetch(testUrl);
const html = await res.text();

// Look for data-n-au (article URL)
const dnau = html.match(/data-n-au="([^"]+)"/g);
if (dnau) {
  console.log('data-n-au attributes:');
  dnau.slice(0, 5).forEach(m => console.log(' ', m));
}

// Search for external URLs in the page (excluding Google's own domains)
const excludePattern = /news\.google\.com|www\.google\.|gstatic|accounts\.google|play\.google|lh3\.google|encrypted-tbn|schemas\.google|fonts\.google|apis\.google|maps\.google|www\.gstatic/;
const urlPattern = /https?:\/\/[^\s"'<>\\]{20,}/g;
const allUrls = [...html.matchAll(urlPattern)].map(m => m[0]);
const externalUrls = allUrls.filter(u => !excludePattern.test(u));
const uniqueExternal = [...new Set(externalUrls)];

console.log(`\nTotal URLs: ${allUrls.length}, External URLs: ${uniqueExternal.length}`);
console.log('\nExternal URLs (first 10):');
uniqueExternal.slice(0, 10).forEach(u => console.log(' ', u.substring(0, 120)));

// Look for AF_initDataCallback
const afCallbacks = html.match(/AF_initDataCallback\(\{[^}]{0,500}\}/g);
if (afCallbacks) {
  console.log('\nAF_initDataCallback entries:', afCallbacks.length);
  afCallbacks.slice(0, 2).forEach(m => console.log(' ', m.substring(0, 200)));
}

// Look for script-embedded JSON data with URLs
const scriptBlocks = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
console.log(`\nScript blocks: ${scriptBlocks.length}`);
for (const block of scriptBlocks) {
  const bbcMatch = block.match(/bbc\.com[^\s"'<>\\]*/);
  if (bbcMatch) {
    console.log('Found BBC URL in script:', bbcMatch[0]);
    // Show surrounding context
    const idx = block.indexOf(bbcMatch[0]);
    console.log('Context:', block.substring(Math.max(0, idx - 50), idx + 100));
  }
}
