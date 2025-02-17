import fs from "fs";
import { exportDataCSV } from "./csv";
import {
    getSearchData
} from "./sqlite";



(async () => {
    const data = getSearchData();
    // Get today's date
    const today = new Date();
    // Format as YYYY-MM-DD
    const formattedDate = today.toISOString().split('T')[0];
    const outfileName = `search_results-${formattedDate}.csv`;
    exportDataCSV(outfileName, data);
})();
