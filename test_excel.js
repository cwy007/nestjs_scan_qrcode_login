const {
  Workbook
} = require('exceljs');

async function main() {
  const workbook = new Workbook();

  const worksheets = await workbook.xlsx.readFile('data.xlsx');

  worksheets.eachSheet((worksheet, sheetId) => {
    console.log(`Sheet ID: ${sheetId}, Sheet Name: ${worksheet.name}`);

    worksheet.eachRow((row, rowNumber) => {
      const rowValues = row.values.slice(1); // Skip the first element which is null
      console.log(`Row ${rowNumber}:`, rowValues);
    });
  });
}

main().catch(console.error);