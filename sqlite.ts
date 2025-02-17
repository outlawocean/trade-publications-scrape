import Database from "better-sqlite3";
import { SqlCompany } from "./types";
const db = new Database("database.db");

export function initDB() {
  db.exec(`
      CREATE TABLE IF NOT EXISTS company (
        id UUID NOT NULL,
        name TEXT NOT NULL,
        site TEXT NOT NULL,
        search_text TEXT NOT NULL,
        last_searched_date DATE,
        UNIQUE(id, site)
      );

      CREATE TABLE IF NOT EXISTS search_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL,
        company_id UUID NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        searched_date DATE
      );
    `);
}

export function getCompanyByIdSite(
  id: string,
  site: string,
): SqlCompany | null {
  const statement = db.prepare(`
  SELECT * FROM company
  WHERE id = ? AND site = ?
  `);

  return statement.get(id, site) as SqlCompany | null;
}

export async function insertCompany(name: string, id: string, site: string, search_text: string) {
  const statement = db.prepare(
    `
     INSERT INTO company (id, name, site, search_text)
     VALUES (?, ?, ?, ?)
   `,
  );

  const { lastInsertRowid } = statement.run(id, name, site, search_text);
  return lastInsertRowid;
}

export async function updateCompany(
  id: string,
  site: string,
  lastSearchDate: string,
) {
  const statement = db.prepare(
    `
     UPDATE company
     SET last_searched_date = ?
     WHERE id = ? AND site = ?
   `,
  );

  const { lastInsertRowid } = statement.run(lastSearchDate, id, site);
  return lastInsertRowid;
}

export async function insertSearchResult(
  companyId: string,
  url: string,
  title: string,
  site: string,
  searchedDate: string,
) {
  const statement = db.prepare(
    `
      INSERT INTO search_results (company_id, url, title, site, searched_date)
      VALUES (?, ?, ?, ?, ?)
    `,
  );

  const { lastInsertRowid } = statement.run(
    companyId,
    url,
    title,
    site,
    searchedDate,
  );
  return lastInsertRowid;
}

export function getSearchData(
): SqlCompany[] {
  const statement = db.prepare(`
    SELECT 
      sr.id AS id,
      sr.site,
      c.name AS company_name,
      c.search_text as search_phrase,
      sr.title,
      sr.url,
      sr.searched_date
    FROM search_results sr
    INNER JOIN company c
    ON sr.company_id = c.id AND sr.site = c.site;
  `);

  return statement.all() as SqlCompany[];
}
