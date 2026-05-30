/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';
import Stats from '../src/apg-lib/stats.js';

const description = `
Demonstrate how to generate statistics of the parser's path through the parse tree.
That is, an accounting of each node hit on the parse tree.
`;

const THIS_FILENAME = 'examples/stats.js';
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
const grammar = api.toObject();
const parser = new Parser(grammar);
const stats = new Stats();
parser.setStats(stats);
const result = parser.parse(0, 'aaaaabbbbbccccc');
console.log(description);
console.log('LOOK AHEAD PARSER RESULT');
console.dir(result);
console.log(stats.displayStats());
console.log(stats.displayHits('alpha'));
