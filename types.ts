import { Page } from "playwright";

export interface CompanyInfo {
  "Company name": string;
  "Search text": string;
  Country: string | undefined;
  "Site address": string | undefined;
  id: string;
}

export interface SiteInfo {
  loginURL?: string;
  searchURL: string | ((searchTerm: string) => string);
  setupURL?: string;
  contextFilePath: string;
  extractionFn: (companyId: string, page: Page) => Promise<SearchResultsInfo>;
  loginFn?: (page: Page, loginURL: string) => Promise<boolean>;
  setupFn?: (page: Page, setupURL: string) => Promise<boolean>;
}

export interface SitesInfo {
  [key: string]: SiteInfo;
}

export interface SearchResultsInfo {
  totalResults: number;
  results: Array<SearchResult>;
}

export interface SearchResult {
  url: string;
  linkText: string;
  companyId: string;
}

export interface SqlCompany {
  id: string;
  site: string;
  company_id: string;
  url: string;
  link: string;
  last_searched_date: string;
}
