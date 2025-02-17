import { SitesInfo, SearchResultsInfo, SearchResult } from "./types";
import { Page } from "playwright";
import { wait } from "./lib";

export const SITES: SitesInfo = {
  intrafish: {
    searchURL: "https://www.intrafish.com/archive?mode=phrase&q=",
    setupURL: "https://www.intrafish.com/",
    loginURL: "https://www.intrafish.com/auth/user/login",
    contextFilePath: "intrafish_context.json",
    extractionFn: async (
      companyId: string,
      page: Page,
    ): Promise<SearchResultsInfo> => {
      const allResults = [];
      const fetchPages = async function* (
        page: Page,
      ): AsyncGenerator<Array<SearchResult>> {
        await wait(4000)
        const paginationElement = await page.$(".pagination");
        if (!paginationElement) {
          yield [];
          return;
        }

        const results: Array<SearchResult> = await page.evaluate(
          (companyId: string): Array<SearchResult> => {
            const results = Array.from(
              document.querySelectorAll(".teaser-title"),
              (el: any) => {
                const link = el.querySelector(".card-link");
                if (!link) {
                  return null;
                }
                const linkText = link.textContent.trim();
                const linkHref = link.href;
                return {
                  linkText,
                  url: linkHref,
                  companyId,
                };
              },
            ).filter((r) => r !== null);

            return results;
          },
          companyId,
        );
        const nextButton = await page.$(".pagination .next");
        const nextClasses: Array<string> = nextButton
          ? await nextButton.evaluate((el) => [...el.classList])
          : [];
        if (nextButton && !nextClasses.includes("d-none")) {
          yield results;

          await Promise.all([page.waitForNavigation(), nextButton.click()]);
        } else {
          yield results;
        }
      };

      for await (const results of fetchPages(page)) {
        allResults.push(...results);
      }

      return {
        totalResults: allResults.length,
        results: allResults,
      };
    },
    loginFn: async (page: Page, loginURL: string): Promise<boolean> => {
      await page.goto(loginURL, { waitUntil: "networkidle" });
      await wait(2000);

      let logoutForm = await page.$(".logout-form");
      const hpLoggedIn = await page.$(".button-login-status");
      if (!!hpLoggedIn || !!logoutForm) {
        return true;
      }

      await page.fill('input[name="username"]', "");
      await page.fill('input[name="password"]', "");

      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]'),
      ]);
      await wait(2000);

      logoutForm = await page.$(".logout-form");

      return !!logoutForm;
    },
    setupFn: async (page: Page, setupURL: string): Promise<boolean> => {
      await page.goto(setupURL, { waitUntil: "domcontentloaded" });

      const cookieDialog = await page.$("#onetrust-banner-sdk");
      if (!cookieDialog) {
        return true;
      }

      try {
        await page.click("#onetrust-pc-btn-handler");
        await wait(2000);
        await page.click(".save-preference-btn-handler");
        await wait(2000);
        return true;
      } catch (error) {
        console.log(error);
        return true;
      }
    },
  },
  undercurrent_news: {
    searchURL: (searchTerm: string): string =>
      `https://www.undercurrentnews.com/?s=${encodeURIComponent(`"${searchTerm}"`)}`,
    // loginURL: "https://www.undercurrentnews.com/login/?redirect_to=/",
    contextFilePath: "undercurrentnews_context.json",
    extractionFn: async (
      companyId: string,
      page: Page,
    ): Promise<SearchResultsInfo> => {
      const allResults = [];
      const fetchPages = async function* (
        page: Page,
      ): AsyncGenerator<Array<SearchResult>> {
        const searchMsg = await page.$(".search-msg");
        if (
          searchMsg &&
          (await searchMsg.innerText())
            .toLowerCase()
            .includes("nothing found for")
        ) {
          yield [];
          return;
        }

        const results: Array<SearchResult> = await page.evaluate(
          (companyId: string): Array<SearchResult> => {
            const results = Array.from(
              document.querySelectorAll(".ucn-search-entry"),
              (el: any) => {
                const link = el.querySelector('a[rel="bookmark"]');
                if (!link) {
                  return null;
                }
                const linkText = link.getAttribute("title").trim();
                const linkHref = link.href;
                return {
                  linkText,
                  url: linkHref,
                  companyId,
                };
              },
            ).filter((r) => r !== null);

            return results;
          },
          companyId,
        );
        const nextButton = await page.$(".page-numbers.next");

        if (nextButton) {
          yield results;

          await Promise.all([page.waitForNavigation(), nextButton.click()]);
        } else {
          yield results;
        }
      };

      for await (const results of fetchPages(page)) {
        allResults.push(...results);
      }

      return {
        totalResults: allResults.length,
        results: allResults,
      };
    },
  },
  seafood_source: {
    searchURL: "https://www.seafoodsource.com/search?query=",
    loginURL: "https://www.seafoodsource.com/",
    contextFilePath: "seafoodsource_context.json",
    extractionFn: async (
      companyId: string,
      page: Page,
    ): Promise<SearchResultsInfo> => {
      const allResults = [];
      let pageCounter = 0;
    
      const fetchPages = async function* (
        page: Page,
      ): AsyncGenerator<Array<SearchResult>> {
        while (true) {
          // Wait for content to load
          try {
            await Promise.all([
              wait(2000),
              page.waitForSelector('.ais-Hits', { timeout: 10000 }), // Wait for new content
            ]);
          } catch (error) {
            console.error("Error waiting for content:", error);
            yield [];
            break; // Exit the loop on error
          }
    
          // Extract results from the current page
          const results: Array<SearchResult> = await page.evaluate(
            (companyId: string): Array<SearchResult> => {
              const results = Array.from(
                document.querySelectorAll(".ais-Hits-item"),
                (el: any) => {
                  const link = el.querySelector('a');
                  if (!link) {
                    return null;
                  }
                  const linkText = el.querySelector('h3')?.innerText.trim();
                  const linkHref = link.href;
                  return {
                    linkText,
                    url: linkHref,
                    companyId,
                  };
                },
              ).filter((r) => r !== null);
    
              return results;
            },
            companyId,
          );
    
          yield results;
    
          // Locate the next page button
          const nextButton = await page.$(".ais-Pagination-item--nextPage");
          const nextClasses: Array<string> = nextButton
            ? await nextButton.evaluate((el) => [...el.classList])
            : [];
    
          // Check if the next button is disabled
          // NOTE: Seafood Source does a fuzzy search even if company name is within quotes
          // This results in a thousands of results for company name with common words.
          // To limit noise, only the first 10 pages are scraped
          if (!nextButton || nextClasses.includes("ais-Pagination-item--disabled") || pageCounter > 10) {
            break; // Exit the loop if there's no next page or there are more than 10 pages
          }
    
          // Click the next page button and wait for the next page to load
          try {
            pageCounter++;
            await Promise.all([
              nextButton.click(),
              page.waitForSelector('.ais-Hits', { timeout: 10000 }), // Wait for new page content
            ]);
          } catch (error) {
            console.error("Error navigating to the next page:", error);
            break; // Exit the loop on error
          }
        }
      };
    
      // Iterate through pages and collect all results
      for await (const results of fetchPages(page)) {
        allResults.push(...results);
      }
    
      return {
        totalResults: allResults.length,
        results: allResults,
      };
    },         
    loginFn: async (page: Page, loginURL: string): Promise<boolean> => {
      return true;
    },
  },
  nexis_uni: {
    searchURL: "https://advance.lexis.com/search/?pdtypeofsearch=searchboxclick&pdsearchtype=SearchBox&pdoriginatingpage=search&pdsearchterms=",
    setupURL: "https://www.lexisnexis.com/en-us/professional/academic/nexis-uni.page",
    loginURL: "http://nexisuni.com/",
    contextFilePath: "nexisuni_context.json",
    extractionFn: async (
        companyId: string,
        page: Page,
      ): Promise<SearchResultsInfo> => {
        const allResults = [];
      
        // A helper function to scrape results from the current page and handle pagination
        const fetchPages = async function* (
            page: Page,
          ): AsyncGenerator<Array<SearchResult>> {
            while (true) {
              // Scrape results from the current page
              const results: Array<SearchResult> = await page.evaluate(
                (companyId: string): Array<SearchResult> => {
                  const results = Array.from(
                    document.querySelectorAll(".doc-title"),
                    (el: any) => {
                      const link = el.querySelector('a[data-action="title"]');
                      if (!link) {
                        return null;
                      }
                      const linkText = link.textContent.trim();
                      const linkHref = link.href;
                      return {
                        linkText,
                        url: linkHref,
                        companyId,
                      };
                    },
                  ).filter((r) => r !== null);
          
                  return results;
                },
                companyId,
              );
          
              // Yield results to the caller
              yield results;
          
              // Locate the next page button dynamically
              const nextButtonSelector = '.pagination a[data-action="nextpage"]';
              const nextButton = await page.$(nextButtonSelector);
          
              if (!nextButton) {
                console.log("No more pages to scrape.");
                break; // Exit the loop if no next button is found
              }
          
              console.log("Next page button found, navigating...");
          
              // Click the next page button and wait for content or indicator to update
              try {
                await Promise.all([
                  nextButton.click(),
                  wait(3000),
                  page.waitForSelector('.doc-title', { timeout: 10000 }), // Wait for new content
                ]);
              } catch (error) {
                console.error("Error navigating to the next page:", error);
                break; // Exit the loop if navigation fails
              }
            }
        };          
      
        // Function to scrape results for a specific tab
        const scrapeTab = async (tabSelector: string | null) => {
          if (tabSelector) {
            await page.click(tabSelector);
            await wait(4000);
          }
      
          for await (const results of fetchPages(page)) {
            allResults.push(...results);
          }
        };
      
        // Step 1: Scrape the first tab - News (already loaded)
        for await (const results of fetchPages(page)) {
          allResults.push(...results);
        }
      
        // Step 2: Scrape the second tab by clicking it - Companies & Financial
        const secondTabSelector = 'button[data-id="urn:hlct:6"]';
        await scrapeTab(secondTabSelector);
      
        // Step 3: Scrape the third tab by clicking it - Cases
        const thirdTabSelector = 'button[data-id="urn:hlct:5"]';
        await scrapeTab(thirdTabSelector);
      
        return {
          totalResults: allResults.length,
          results: allResults,
        };
      },          
    loginFn: async (page: Page, loginURL: string): Promise<boolean> => {
      await page.goto(loginURL, { waitUntil: "networkidle" });

      try {
        await page.waitForSelector('input[name="userid"]', { timeout: 5000 });
        await page.fill('input[name="userid"]', "");
        await Promise.all([
          page.click('input[type="submit"]'),
          page.waitForNavigation(),
        ]);
        await page.fill('input[name="password"]', "");
  
        await Promise.all([
          page.waitForNavigation(),
          page.click('input[type="submit"]'),
        ]);
      } catch (error) {
        return false;
      }
      return true;
    },
    setupFn: async (page: Page, setupURL: string): Promise<boolean> => {
      await page.goto(setupURL, { waitUntil: "domcontentloaded" });

      const cookieDialog = await page.$("#onetrust-banner-sdk");
      if (!cookieDialog) {
        return true;
      }

      try {
        await page.click("#onetrust-pc-btn-handler");
        await wait(1000);
        await page.click("#ot-group-id-2")
        await wait(1000);
        await page.click("#ot-group-id-3")
        await wait(1000);
        await page.click("#ot-group-id-4")
        await wait(1000);
        await page.click(".save-preference-btn-handler");
        await wait(1000);
        return true;
      } catch (error) {
        console.log(error);
        return true;
      }
    },
  },
};
