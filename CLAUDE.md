# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

- **Full build:** `npm run build` (cleans dist/, compiles TypeScript, bundles with Rollup)
- **TypeScript only:** `npm run build:ts` (outputs to dist/tsc/)
- **Rollup only:** `npm run build:rollup` (bundles from dist/tsc/ into dist/esm/ and dist/cjs/)
- **CI build:** `npm run build:ci` (uses bundleConfigAsCjs flag)
- **Run all tests:** `npm test` (Jest, tests make real network requests with 60s timeout)
- **Run single test:** `npx jest test/withPrettyURLs.test.js`

Tests are integration tests that launch real Puppeteer browsers and scrape Google News. They require network access and are slow by nature.

## Architecture

This is a Node.js library (`google-news-scraper` on npm) that scrapes Google News search results using Puppeteer and Cheerio.

### Core Data Flow

`googleNewsScraper(config)` in `src/index.ts` is the single entry point:

1. Merges user config with defaults (`GNSUserConfig` → `GNSConfig`)
2. Builds the Google News URL via `buildQueryString.ts`
3. Launches Puppeteer, navigates to the URL, extracts page HTML
4. Parses HTML with Cheerio using **two code paths**:
   - **New DOM path**: looks for `a[href^="./read/"]` links (current Google News structure)
   - **Legacy DOM path**: falls back to `article` tags, uses `getArticleType.ts` and `getTitle.ts` to classify and extract
5. Optionally decodes Google News redirect URLs to actual article URLs via `getPrettyUrl.ts` (base64 decoding of URL slugs)
6. Optionally fetches full article content via `getArticleContent.ts` (uses `@mozilla/readability` + jsdom)
7. Returns `Article[]`

### Key Source Files

- **src/index.ts** — Main scraper logic with dual DOM parsing paths
- **src/types.ts** — All TypeScript types (`GNSUserConfig`, `GNSConfig`, `Article`, `QueryVars`, etc.)
- **src/getPrettyUrl.ts** — Decodes Google News obfuscated URLs via base64
- **src/getArticleContent.ts** — Extracts article text using Mozilla Readability, filters ad content
- **src/getArticleType.ts** — Classifies articles as "regular", "topicFeatured", or "topicSmall" based on DOM
- **src/getTitle.ts** — Extracts titles with fallback selectors per article type
- **src/buildQueryString.ts** — Converts `QueryVars` object to URL query string
- **src/getLogger.ts** — Winston logger factory with custom log levels

### Build Output

TypeScript compiles to `dist/tsc/`, then Rollup bundles into:
- `dist/esm/index.mjs` (ESM)
- `dist/cjs/index.js` (CJS)
- Minified variants in `dist/esm/min/` and `dist/cjs/min/`

Package exports: `main` → CJS, `module` → ESM, `types` → dist/tsc/index.d.ts

### External Dependencies

- **puppeteer** — Browser automation for loading Google News pages
- **cheerio** — Server-side HTML parsing (jQuery-like API)
- **jsdom + @mozilla/readability** — Full article content extraction
- **winston** — Configurable logging

### CI/CD

Pushes to `master` trigger `.github/workflows/release.yml`: install → build:ci → semantic-release (auto-versioning and npm publish).
