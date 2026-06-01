/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Grammar from './float.js';
import Parser from '../../src/apg-lib/parser.js';
/* To use this example in your own project:
 *   npm install apg-esm
 * Then generate the grammar object, float.js
 * from the SABNF grammar text, float.txt
 *   node node_modules/apg-esm/src/apg/generator.js -i basic/float.txt -o basic/float
 * Then replace the Parser import above with:
 *   import { Parser } from 'apg-esm';
 */

const description = `
Simple demonstration of how to parse a string with a previously generated grammar object.
The grammar constructor, Grammar, was generated from the ABNF grammar, float.txt with:

npm run apg -- -i ./examples/basic/float.txt -o ./examples/basic/float
`;

/* make a parser from the grammar object */
const grammar = new Grammar();
const parser = new Parser(grammar);
const result = parser.parse(0, '-123.0e-10');
console.log(description);
console.log('FIXED PARSER RESULT');
console.dir(result);
