import puppeteer from 'puppeteer';

const url = "https://news.google.com/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNR1F3TlhjekVnSmxiaWdBUAE?hl=en-US&gl=US&ceid=US:en&when=7d";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.setViewport({ width: 1366, height: 768 });
page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');

await page.setCookie({
  name: "CONSENT",
  value: `YES+cb.${new Date().toISOString().split('T')[0].replace(/-/g, '')}-04-p0.en-GB+FX+667`,
  domain: ".google.com"
});

await page.goto(url, { waitUntil: 'networkidle2' });

const content = await page.content();
const finalUrl = page.url();

console.log("Final URL:", finalUrl);
console.log("Page title:", await page.title());
console.log("Content length:", content.length);

// Check for articles
const articleCount = (content.match(/<article/g) || []).length;
console.log("Number of <article> elements:", articleCount);

// Check for common link patterns
const articleLinks = (content.match(/href="\.\/article/g) || []).length;
const readLinks = (content.match(/href="\.\/read/g) || []).length;
console.log("Links with ./article:", articleLinks);
console.log("Links with ./read:", readLinks);

// Save a snippet of the HTML for inspection
const fs = await import('fs');
fs.writeFileSync('debug-output.html', content);
console.log("\nFull HTML saved to debug-output.html");

// Look for any 'a' tags to understand link structure
const cheerio = await import('cheerio');
const $ = cheerio.load(content);
console.log("\nAll unique href prefixes (first 20):");
const hrefs = new Set();
$('a[href]').each(function() {
  const href = $(this).attr('href');
  if (href) {
    const prefix = href.substring(0, 40);
    hrefs.add(prefix);
  }
});
[...hrefs].slice(0, 20).forEach(h => console.log(" ", h));

await browser.close();
