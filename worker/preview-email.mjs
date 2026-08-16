/* Render the quote email to an HTML file so the design can be reviewed in a
   browser without sending anything.

   Usage:  node preview-email.mjs [outfile]
*/

import { renderHtml, renderText } from './src/email.js';
import { writeFileSync } from 'node:fs';

const sample = {
  name: 'Bryan Carter',
  phone: '0412 884 301',
  email: 'bryan.carter@example.com',
  suburb: 'North Coogee',
  job: 'Decking',
  details:
    'Rear yard is about 6m x 4m, currently paving that has lifted.\n\n' +
    'After composite decking level with the back door, ideally before Christmas. ' +
    'Happy to go with whatever board you rate — photos attached from both corners.',
  photoCount: 3,
};

const out = process.argv[2] || 'email-preview.html';

writeFileSync(out, renderHtml(sample, {
  logoUrl: 'https://travanixlabs.github.io/Truecraft/uploads/IMG_9924.jpeg',
}));

console.log(`HTML  -> ${out}`);
console.log('\n--- plain text alternative ---\n');
console.log(renderText(sample));
