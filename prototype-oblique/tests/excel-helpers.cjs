const fs = require('node:fs');
const ExcelJS = require('../vendor/exceljs/exceljs.min.js');
async function readWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fs.readFileSync(file));
  return workbook;
}
module.exports = { readWorkbook };
