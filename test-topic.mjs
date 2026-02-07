import googleNewsScraper from './dist/esm/index.mjs';

const articles = await googleNewsScraper({
  baseUrl: "https://news.google.com/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNR1F3TlhjekVnSmxiaWdBUAE",
  queryVars: {
    hl: "en-US",
    gl: "US",
    ceid: "US:en"
  },
  prettyURLs: true,
  limit: 10,
  logLevel: "info"
});

console.log(`\nFound ${articles.length} articles:\n`);
articles.forEach((article, i) => {
  console.log('article',article)
  console.log(`[${i + 1}] ${article.title}`);
  console.log(`    Source: ${article.source}`);
  console.log(`    Link:   ${article.link}`);
  console.log(`    Time:   ${article.time}`);
  console.log(`    Type:   ${article.articleType}`);
  console.log();
});
