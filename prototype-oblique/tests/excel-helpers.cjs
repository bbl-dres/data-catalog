const fs = require('node:fs');
const ExcelJS = require('../vendor/exceljs/exceljs.min.js');
async function readWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fs.readFileSync(file));
  return workbook;
}
function columnValues(sheet, key) {
  const column = sheet.getRow(1).values.indexOf(key);
  if (column < 1) throw new Error(`Missing Excel key ${key} in ${sheet.name}`);
  return Array.from({ length: Math.max(0, sheet.rowCount - 2) }, (_, i) => sheet.getCell(i + 3, column).value);
}
module.exports = { readWorkbook, columnValues };
