/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';
import ids from '../src/apg-lib/identifiers.js';
/* To use this example in your own project:
 *   npm install apg-esm
 * Then replace the imports above with:
 *   import { Api, Parser, ids } from "apg-esm";
 */

const description = `
Demonstration of using User-Defined Terminals (UDTs) for handwritten
phrase-matching code snippets. Demonstrates writing an empty-string UDT
and a non-empty-string UDT.
`;

const THIS_FILENAME = 'examples/udt.js';
/* the SABNF grammar */
let float = '';
float += 'float    = e_sign decimal [exponent]\n';
float += 'sign     = "+" / "-"\n';
float += 'decimal  = integer [dot [fraction]]\n';
float += '           / dot fraction\n';
float += 'integer  = 1*%d48-57\n';
float += 'dot      = "."\n';
float += 'fraction = 1*%d48-57\n';
float += 'exponent = "e" [esign] exp\n';
float += 'esign    = "+" / "-"\n';
float += 'exp      = u_exp\n';

/* non-empty-string UDT */
const u_callback = (sys, chars, phraseIndex, data) => {
  let len = 0;
  /* NOTE: be careful to never over run the end of the character string */
  for (let i = phraseIndex; i < chars.length; i++) {
    if (chars[i] >= 48 && chars[i] <= 57) {
      len++;
    }
  }
  if (len === 0) {
    sys.state = ids.NOMATCH;
    sys.phraseLength = 0;
  } else {
    sys.state = ids.MATCH;
    sys.phraseLength = len;
  }
};

/* empty-string UDT */
const e_callback = (sys, chars, phraseIndex, data) => {
  let c = chars[phraseIndex];
  if (c === 43 || c === 45) {
    /* if "+" or "-" it matches a string */
    sys.state = ids.MATCH;
    sys.phraseLength = 1;
  } else {
    /* if not "+" or "-" it matches an empty string */
    sys.state = ids.EMPTY;
    sys.phraseLength = 0;
  }
};

/* test complete generation in one step */
const api = new Api(float);
api.generate();
if (api.errors.length) {
  console.log(api.errorsToAscii());
  throw new Error(`${THIS_FILENAME}grammar has errors`);
}

/* make a parser from the grammar object */
const grammar = api.toObject();
const parser = new Parser(grammar);

/* attach the callback functions to the paraser */
parser.setCallback('e_sign', e_callback);
parser.setCallback('u_exp', u_callback);
const result = parser.parse(0, '-123.0e-10');
console.log(description);
console.log('UDT PARSER RESULT');
console.dir(result);
