/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Api from '../../src/apg-api/api.js';
import Parser from '../../src/apg-lib/parser.js';

const description = `
Simple demonstration of how to generate a grammar object dynamically in separate steps,
create a parser with it and parse a string with the resulting parser. 
`;

const THIS_FILENAME = 'examples/basic/separate.js';
/* the SABNF grammar */
let float = '';
float += 'float    = [sign] decimal [exponent]\n';
float += 'sign     = "+" / "-"\n';
float += 'decimal  = integer [dot [fraction]]\n';
float += '           / dot fraction\n';
float += 'integer  = 1*%d48-57\n';
float += 'dot      = "."\n';
float += 'fraction = 1*%d48-57\n';
float += 'exponent = "e" [esign] exp\n';
float += 'esign    = "+" / "-"\n';
float += 'exp      = 1*%d48-57\n';

/* test complete generation in one step */
const api = new Api(float);
api.scan();
if (api.errors.length) {
  logErrors(api, 'API SCAN ERRORS');
  console.log(api.displayAttributeErrors());
  throw new Error(`${thisFileName}grammar has errors`);
}
api.parse();
if (api.errors.length) {
  logErrors(api, 'API PARSE ERRORS');
  console.log(api.displayAttributeErrors());
  throw new Error(`${thisFileName}grammar has errors`);
}
api.translate();
if (api.errors.length) {
  logErrors(api, 'API TRANSLATE ERRORS');
  console.log(api.displayAttributeErrors());
  throw new Error(`${thisFileName}grammar has errors`);
}
api.attributes();
if (api.errors.length) {
  console.log(api.errorsToAscii());
  throw new Error(`${THIS_FILENAME}grammar has errors`);
}

/* make a parser from the grammar object */
const grammar = api.toObject();
const parser = new Parser(grammar);
const result = parser.parse(0, '-123.0e-10');
console.log(description);
console.log('SEPARATE STEP PARSER RESULT');
console.dir(result);
