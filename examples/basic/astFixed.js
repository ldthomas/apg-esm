/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Grammar from './float.js';
import Parser from '../../src/apg-lib/parser.js';
import Ast from '../../src/apg-lib/ast.js';
import id from '../../src/apg-lib/identifiers.js';
import { charsToString } from '../../src/apg-lib/utilities.js';
/* To use this example in your own project:
 *   npm install apg-esm
 * Then generate the grammar object, float.js
 * from the SABNF grammar text, float.txt
 *   node node_modules/apg-esm/src/apg/generator.js -i basic/float.txt -o basic/float
 * Then replace the other imports above with:
 *   import { Parser, Ast, ids, utils } from "apg-esm";
 *   const charsToString = utils.charsToString;
 */

const description = `
Simple demonstration of how to parse a string with a previously generated grammar object.
The grammar constructor, Grammar, was generated from the ABNF grammar, float.txt with:

npm run apg -- -i ./examples/basic/float.txt -o ./examples/basic/float

An Abstract Syntax Tree (AST) is constructed and converted to XML format.
`;

const astFloat = (state, chars, phraseIndex, phraseCount, data) => {
  if (state === id.SEM_PRE) {
    console.log('float: ', charsToString(chars, phraseIndex, phraseCount));
  }
};
const astDecimal = (state, chars, phraseIndex, phraseCount, data) => {
  if (state === id.SEM_PRE) {
    console.log('decimal: ', charsToString(chars, phraseIndex, phraseCount));
  }
};

/* make a parser from the grammar object */
const grammar = new Grammar();
const parser = new Parser(grammar);
const ast = new Ast(grammar);
ast.setCallback('float', astFloat);
ast.setCallback('decimal', astDecimal);
parser.setAst(ast);
console.log(description);
const result = parser.parse(0, '-123.0e-10');
console.log('\nFIXED PARSER RESULT');
console.dir(result);
console.log('\nAST CALLBACK OUTPUT');
ast.translate({});
console.log('\nAST TO XML');
console.log(ast.toXml('ascii'));
