import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

import getLogger from './getLogger';
import getTitle from './getTitle';
import getArticleType from './getArticleType';
import getPrettyUrl from './getPrettyUrl';
import buildQueryString from './buildQueryString';
import getArticleContent from './getArticleContent';
import { 
  QueryVars,
  GNSUserConfig, 
  GNSConfig,
  Article,
  Articles
} from "./types"

const googleNewsScraper = async (userConfig: GNSUserConfig) => {
  const config: GNSConfig = {
    ...{
      prettyURLs: true,
      getArticleContent: false,
      puppeteerArgs: [],
      puppeteerHeadlessMode: true,
      logLevel: 'error',
      timeframe: '7d',
      queryVars: {}, 
      limit: 99
    },
    ...userConfig,
  } as GNSConfig;

  const logger = getLogger(config.logLevel);

  const queryVars: QueryVars = config.queryVars 
    ? { ...config.queryVars, when: config.timeframe }
    : { when: config.timeframe};
  if (userConfig.searchTerm) {
    queryVars.q = userConfig.searchTerm;
  }

  const queryString = buildQueryString(queryVars) ?? '';
  const baseUrl = config.baseUrl ?? `https://news.google.com/search`;
  const url = `${baseUrl}${queryString}`;

  logger.info(`📰 SCRAPING NEWS FROM: ${url}`);
  const requiredArgs = [
    '--disable-extensions-except=/path/to/manifest/folder/',
    '--load-extension=/path/to/manifest/folder/',
  ];
  const puppeteerConfig = {
    headless: userConfig.puppeteerHeadlessMode,
    args: puppeteer.defaultArgs().concat(config.puppeteerArgs).filter(Boolean).concat(requiredArgs)
  }
  const browser = await puppeteer.launch(puppeteerConfig)
  const page = await browser.newPage()
  page.setViewport({ width: 1366, height: 768 })
  page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36')
  page.setRequestInterception(true)
  page.on('request', request => {
    if (!request.isNavigationRequest()) {
      request.continue()
      return
    }
    const headers = request.headers()
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3'
    headers['Accept-Encoding'] = 'gzip'
    headers['Accept-Language'] = 'en-US,en;q=0.9,es;q=0.8'
    headers['Upgrade-Insecure-Requests'] = "1"
    headers['Referer'] = 'https://www.google.com/'
    request.continue({ headers })
  })
  await page.setCookie({
    name: "CONSENT",
    value: `YES+cb.${new Date().toISOString().split('T')[0].replace(/-/g, '')}-04-p0.en-GB+FX+667`,
    domain: ".google.com"
  });
  await page.goto(url, { waitUntil: 'networkidle2' });

  try {
    await page.$(`[aria-label="Reject all"]`);
    await Promise.all([
      page.click(`[aria-label="Reject all"]`),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
  } catch (err) {}

  const content = await page.content();
  const $ = cheerio.load(content);

  let results: Articles = [];

  // -- New structure: anchor on title links --
  const titleLinks = $('a[href^="./read/"]').filter(function () {
    return $(this).text().trim().length > 0;
  });

  if (titleLinks.length > 0) {
    // New Google News DOM (c-wiz components)
    titleLinks.each(function () {
      const titleEl = $(this);
      const title = titleEl.text().trim();
      const rawHref = titleEl.attr('href') || '';
      const link = rawHref.startsWith('./')
        ? rawHref.replace('./', 'https://news.google.com/')
        : rawHref;

      // Walk up to find container (ancestor with <time>)
      let container = titleEl.parent();
      for (let depth = 0; depth < 6; depth++) {
        if (container.find('time[datetime]').length) break;
        container = container.parent();
      }

      const source = container.find('div[data-n-tid]').filter(function () {
        return !$(this).find('div[data-n-tid]').length; // leaf node only
      }).first().text().trim();
      const timeEl = container.find('time[datetime]').first();
      const imgEl = container.find('img[src*="/api/attachments/"]').first();
      const image = imgEl.attr('src')
        || container.find('figure img').attr('src')
        || '';

      results.push({
        title,
        link,
        image: image.startsWith('/') ? `https://news.google.com${image}` : image,
        source,
        datetime: new Date(timeEl.attr('datetime') || '').toISOString(),
        time: timeEl.text().trim(),
        articleType: 'topic',
      });
    });
  } else {
    // Fallback: old structure with <article> tags
    const articles = $('article');
    $(articles).each(function () {
      const link = $(this)?.find('a[href^="./article"]')?.attr('href')?.replace('./', 'https://news.google.com/') || $(this)?.find('a[href^="./read"]')?.attr('href')?.replace('./', 'https://news.google.com/') || ""
      const srcset = $(this).find('figure').find('img').attr('srcset')?.split(' ');
      const image = srcset && srcset.length
        ? srcset[srcset.length - 2]
        : $(this).find('figure').find('img').attr('src');
      const articleType = getArticleType($(this));

      const title = getTitle($(this), articleType);
      const mainArticle: Article = {
        title,
        "link": link,
        "image": image?.startsWith("/") ? `https://news.google.com${image}` : image || "",
        "source": $(this).find('div[data-n-tid]').text() || "",
        "datetime": new Date($(this).find('div:last-child time')?.attr('datetime') || "")?.toISOString() || "",
        "time": $(this).find('div:last-child time').text() || "",
        articleType
      }
      results.push(mainArticle)
    });
  }

  if (config.prettyURLs) {
    results = await Promise.all(results.map(article => {
      const url = getPrettyUrl(article.link, logger);
      if (url) {
        article.link = url;
      }
      return article;
    }));
  }

  if (config.getArticleContent) {
    const filterWords = config.filterWords || [];
    results = await getArticleContent({articles: results, browser, filterWords, logger});
  }

  await page.close();
  await browser.close()

  const filtered = results.filter(result => result.title);
  return config.limit < results.length ? filtered.slice(0, config.limit) : filtered;

}

export * from "./types";
export default googleNewsScraper;