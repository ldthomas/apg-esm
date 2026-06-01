/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';
import TraceSabnf from '../src/apg-lib/traceSabnf.js';
/* To use this example in your own project:
 *   npm install apg-esm
 * Then replace the imports above with:
 *   import { Api, Parser, TraceSabnf } from "apg-esm";
 */

const description = `
Demonstrate how to generate a trace of the parser through the SABNF grammar.
`;

const THIS_FILENAME = 'examples/traceSabnf.js';
/* the SABNF grammar */
let anbncn = '';
anbncn += 'S  = &(AB !b) *a BC !c\n';
anbncn += 'AB = a [AB] b\n';
anbncn += 'BC = b [BC] c\n';
anbncn += 'a  = "a"\n';
anbncn += "b  = 'b'\n";
anbncn += 'c  = %s"c"\n';

/* test complete generation in one step */
const api = new Api(anbncn);
api.generate();
if (api.errors.length) {
  console.log(api.errorsToAscii());
  throw new Error(`${THIS_FILENAME}grammar has errors`);
}

/* make a parser from the grammar object */
const grammar = api.toObject();
const parser = new Parser(grammar);
const trace = new TraceSabnf();
parser.setTraceSabnf(trace);
const result = parser.parse(0, 'aaaaabbbbbccccc');
console.log(description);
console.log('LOOK AHEAD PARSER RESULT');
console.dir(result);
console.log('LOOK AHEAD PARSER SABNF TRACE');
console.log();
console.log(trace.display());
