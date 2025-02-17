import { BrowserContext, Page } from "playwright";
import fs from "fs";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
const { differenceInCalendarDays } = require("date-fns");
import { loadCSV } from "./csv";
import {
  CompanyInfo,
  SearchResult,
  SearchResultsInfo,
  SiteInfo,
} from "./types";
import { SITES } from "./site";
import { wait } from "./lib";
import {
  getCompanyByIdSite,
  insertCompany,
  initDB,
  insertSearchResult,
  updateCompany,
} from "./sqlite";

const DAYS_BETWEEN_SEARCHES = 7;

const databasePath = './database.db';

chromium.use(StealthPlugin());

async function saveContext(contextFilePath: string, context: BrowserContext) {
  const storage = await context.storageState();
  fs.writeFileSync(contextFilePath, JSON.stringify(storage));
}

async function loadContext(contextFilePath: string, browser: any) {
  if (fs.existsSync(contextFilePath)) {
    const storage = JSON.parse(fs.readFileSync(contextFilePath, "utf-8"));
    return await browser.newContext({ storageState: storage });
  } else {
    return await browser.newContext();
  }
}

function url(site: SiteInfo, searchTerm: string) {
  // For NexisUni:
  // - Encode special characters like & into %26; spaces are encoded as %20
  // - Replaces %20 with + to match query parameter formatting
  let encodedStr;
  if (site.loginURL?.includes('nexisuni')) {
    encodedStr = encodeURIComponent(searchTerm).replace(/%20/g, "+");
  } else {
    encodedStr = encodeURIComponent(searchTerm);
  }

  return typeof site.searchURL === "string"
    ? `${site.searchURL}"${encodedStr}"`
    : site.searchURL(searchTerm);
}

function writeResults(
  site: string,
  row: CompanyInfo,
  results: Array<SearchResult>,
) {
  const date = new Date();
  const dateStamp = date.toISOString();
  updateCompany(row.id, site, dateStamp);
  results.forEach((result) => {
    console.log(site, row.id, result.linkText);
    insertSearchResult(row.id, result.url, result.linkText, site, dateStamp);
  });
}

async function getSearchResults(
  page: Page,
  site: SiteInfo,
  row: CompanyInfo,
): Promise<SearchResultsInfo> {
  console.log(`************************************
    ${row["Company name"]} - ${row.id}
    ${url(site, row["Search text"])}`);
  await page.goto(url(site, row["Search text"]), {
    waitUntil: "domcontentloaded",
  });

  const searchResults = await site.extractionFn(row.id, page);
  console.log(searchResults.results.length);
  console.log(`************************************`);
  return searchResults;
}

function shouldSkipSearch(lastSearchedDate: string): boolean {
  //check delta between today and last searched date if < DAYS_BETWEEN_SEARCHES skip
  const days = differenceInCalendarDays(new Date(), new Date(lastSearchedDate));
  return days <= DAYS_BETWEEN_SEARCHES;
}

(async () => {
  initDB();

  let data;

  if (process.argv[2]) {
    data = await loadCSV(process.argv[2]);
  } else {
    console.log("Please provide a path to a csv file.");
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: false });

  for (const siteKey of Object.keys(SITES)) {
    const site = SITES[siteKey];

    let context = await loadContext(site.contextFilePath, browser);
    const page = await context.newPage();

    let isLoggedIn =
      site.loginFn && site.loginURL
        ? await site.loginFn(page, site.loginURL)
        : true;

    await wait(2000);

    let isReady =
      site.setupFn && site.setupURL
        ? await site.setupFn(page, site.setupURL)
        : true;

    if (isLoggedIn && isReady) {
      await saveContext(site.contextFilePath, context);
    } else {
      console.log(isLoggedIn, isReady, siteKey);
    }

    // Search the first 50 rows
    for (const row of data.slice(0, 51)) {
      const companyRecord = getCompanyByIdSite(row.id, siteKey);

      if (!companyRecord) {
        await insertCompany(row["Company name"], row.id, siteKey, row["Search text"]);
      } else if (shouldSkipSearch(companyRecord.last_searched_date)) {
        console.log("skipping", row["Company name"], row.id);
        continue;
      }

      const results = await getSearchResults(page, site, row);
      writeResults(siteKey, row, results.results);
      await wait(10000);
    }
  }

  await browser.close();
})();
