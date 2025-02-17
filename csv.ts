import { parseFile, writeToPath } from "fast-csv";
import { v5 } from "uuid";
import path from "path";
import { CompanyInfo } from "./types";

function removeLocation(name: string): string {
  // in Qapqal Xibo Autonomous County

  return name.includes(" in ") ? name.slice(0, name.indexOf(" in ")) : name;
}

function removeAllAfterFirstComma(name: string): string {
  return name.includes(",") ? name.slice(0, name.indexOf(",")) : name;
}

function removeAllAfterFirstParenthesis(name: string): string {
  return name.includes("(") ? name.slice(0, name.indexOf("(")) : name;
}

function cleanName(name: string): string {
  name = removeLocation(name);
  name = name.replace(" (China)", "");
  name = removeAllAfterFirstComma(name);
  name = removeAllAfterFirstParenthesis(name);
  return name
    .replace("(individual industrial and commercial households)", "")
    .replace(" Co., Ltd.", "")
    .replace(" Co.", "")
    .replace(" Ltd.", "")
    .trim();
}

function truncateName(name: string): string {
  // search query can be 48 characters long + 2 for quotes
  if (name.length <= 48) {
    return name;
  }

  // remove last word if multiple words.
  name = name.includes(" ")
    ? name.slice(0, name.lastIndexOf(" "))
    : name.slice(0, 48);

  return name.length <= 48 ? name : truncateName(name);
}

export function loadCSV(path: string): Promise<Array<CompanyInfo>> {
  return new Promise((resolve, reject) => {
    const rows: Array<CompanyInfo> = [];
    parseFile(path, { headers: true })
      .on("data", (row) => {
        // if (row['Company name'].indexOf(',') > -1) {
        //   console.log(
        //     row['Company name'],
        //     ' -- ',
        //     cleanName(row['Company name']),
        //   );
        // }
        // row['Cleaned Name'] = cleanName(row['Company name']);
        // row['Truncated Name'] = truncateName(row['Cleaned Name']);
        row.id = v5(row["Company name"], v5.URL);
        rows.push(row);
      })
      .on("error", (error) => {
        return reject(error);
      })
      .on("end", () => {
        return resolve(rows);
      });
  });
}

function writeCSV(path: string, data: Array<Object>): Promise<boolean> {
  return new Promise((resolve, reject) => {
    writeToPath(path, data, { headers: true })
      .on("error", (err) => reject(err))
      .on("finish", () => resolve(true));
  });
}

function outputPath(type: string, inputPath: string): string {
  const filename = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.dirname(inputPath);
  switch (type) {
    case "company":
      return path.join(outputDir, `${filename}-company.csv`);
    case "search":
      return path.join(outputDir, `${filename}-search.csv`);
    default:
      return "";
  }
}

function transformData(data: any) {
  const lngInfo = data.reduce(
    (acc: any, d: any, i: number) => {
      const keys = Object.keys(d);
      if (keys.length > acc.keyCount) {
        return { idx: i, keyCount: keys.length };
      }
      return acc;
    },
    { idx: 0, keyCount: 0 },
  );
  const longest = data.splice(lngInfo.idx, 1);
  data.unshift(longest[0]);
  return data;
}

export function writeSearchDataCSV(inputPath: string, data: Array<any>) {
  const td = transformData(
    data.map((d) => {
      // console.log(d.searchResults);
      const ds: any = {
        totalPages: d.searchResults?.total,
        id: d.id,
        ["Company name"]: d["Company name"],
        ["Search Name"]: d["Truncated Name"],
        ["Search URL"]: d.searchResults?.url,
      };

      d.searchResults.searchResults.forEach((result: any, i: number) => {
        ds[`search result ${i + 1} company name`] = result.name;
        ds[`search result ${i + 1} url`] = result.url;
        ds[`search result ${i + 1} address`] = result.address;
      });

      return ds;
    }),
  );

  return writeCSV(outputPath("search", inputPath), td);
}

export function writeCompanyDataCSV(inputPath: string, data: Array<any>) {
  return writeCSV(
    outputPath("company", inputPath),
    data.map((d) => {
      return Object.keys(d).reduce((acc: any, key: string) => {
        if (
          key !== "searchResults" &&
          key !== "Cleaned Name"
          // && key !== 'Truncated Name'
        ) {
          acc[key === "Truncated Name" ? "Search Term" : key] = d[key];
        }
        return acc;
      }, {});
    }),
  );
}

export function exportDataCSV(inputPath: string, data: Array<any>) {
  const outputFile = path.join('output', inputPath);
  return writeCSV(outputFile, data);
}
