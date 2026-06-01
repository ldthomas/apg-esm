/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';
/* To use this example in your own project:
 *   npm install apg-esm
 * Then replace the imports above with:
 *   import { Api, Parser } from "apg-esm";
 */

const description = `
It is well known that the strings a^nb^nc^n, n > 0, cannot be represented with a context-free grammar.
However, with the look ahead operators AND(&) and NOT(!) it is, in fact possible to match such strings.
(See the Wikipedia article on Syntactic Predicates, https://en.wikipedia.org/wiki/Syntactic_predicate).
The grammar used here is an SABNF translation of the a^nb^nc^n grammar given there.
`;

const THIS_FILENAME = 'examples/lookAhead.js';
/* the SABNF grammar */
let anbncn = '';
anbncn += 'S = &(AB !b) *a BC !c\n';
anbncn += 'AB = a [AB] b\n';
anbncn += 'BC = b [BC] c\n';
anbncn += 'a = %s"a"\n';
anbncn += 'b = %s"b"\n';
anbncn += 'c = %s"c"\n';

/* test complete generation in one step */
const api = new Api(anbncn);
api.generate();
if (api.errors.length) {
  console.log(api.errorsToAscii());
  throw new Error(`${THIS_FILENAME}grammar has errors`);
}

/* make a parser from the grammar object */
console.log(description);
const grammar = api.toObject();
const parser = new Parser(grammar);
const result = parser.parse(0, 'aaaaabbbbbccccc');
console.log('LOOK AHEAD PARSER RESULT');
console.dir(result);
