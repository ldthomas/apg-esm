/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';
import Ast from '../src/apg-lib/ast.js';
import ids from '../src/apg-lib/identifiers.js';

const description = `
Demonstration of using the Abstract Syntax Tree (AST) for safe translation of the parser's
path through the parse tree. When a rule is successfully matched on a branch of the parse tree
that ultimately fails, a callback function on that rule name node will incorrectly record the
success. Since the AST only keeps the finally successful rule name nodes, translation
from AST callback functions is a safer option.

This grammar is artifically designed to have rule name success on a failing branch,
but this situation is quite common in real life grammars. 
(For example, ./src/apg-api/sabnf-grammar.txt, the grammar for the parser generator.)
`;

const THIS_FILENAME = 'examples/ast.js';
function single() {
  /* the SABNF grammar */
  let float = '';
  float += 'S = (A B) / (A C)\n';
  float += 'A = %s"a"\n';
  float += 'B = %s"b"\n';
  float += 'C = %s"c"\n';

  /* the rule name callback functions */
  const rulea = (sys, chars, phraseIndex, data) => {
    if (sys.state === ids.MATCH) {
      console.log('parse tree rule A matched');
    }
  };
  const ruleb = (sys, chars, phraseIndex, data) => {
    if (sys.state === ids.MATCH) {
      console.log('parse tree rule B matched');
    }
  };
  const rulec = (sys, chars, phraseIndex, data) => {
    if (sys.state === ids.MATCH) {
      console.log('parse tree rule C matched');
    }
  };

  /* the AST callback functions */
  // function semFile(state, chars, phraseIndex, phraseCount, data) {
  const asta = (state, chars, phraseIndex, phraseCount, data) => {
    if (state === ids.SEM_PRE) {
      console.log('AST rule A matched');
    }
  };
  const astb = (state, chars, phraseIndex, phraseCount, data) => {
    if (state === ids.SEM_PRE) {
      console.log('AST rule B matched');
    }
  };
  const astc = (state, chars, phraseIndex, phraseCount, data) => {
    if (state === ids.SEM_PRE) {
      console.log('AST rule c matched');
    }
  };

  /* test complete generation in one step */
  const api = new Api(float);
  api.generate();
  if (api.errors.length) {
    console.log(api.errorsToAscii());
    throw new Error(`${THIS_FILENAME}grammar has errors`);
  }

  console.log(description);

  /* make a parser from the grammar object */
  const grammar = api.toObject();
  const parser = new Parser(grammar);
  const ast = new Ast(grammar);
  parser.setAst(ast);

  /* attach the callback functions to the paraser */
  parser.setCallback('a', rulea);
  parser.setCallback('b', rulec);
  parser.setCallback('c', rulec);

  /* attach the callback functions to the AST */
  ast.setCallback('a', asta);
  ast.setCallback('b', astb);
  ast.setCallback('c', astc);

  console.log('PARSE WITH RULE NAME CALLBACKS');
  console.log('Note that rule A is matched twice,');
  console.log('once on the first branch that ultimatly fails');
  console.log('and once again on the second successful branch.\n');
  const result = parser.parse(0, 'ac');

  console.log('\nTRANSLATE WITH THE AST');
  console.log('Note that rule A is matched only once, as required.\n');
  ast.translate();

  // console.log('PARSER RESULT');
  // console.dir(result);
}
single();
