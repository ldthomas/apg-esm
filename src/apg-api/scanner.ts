/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module scanner
 * Pre-analyzes an input SABNF grammar before parsing.
 * Verifies that all character codes are valid (no non-printing ASCII) and catalogs
 * each line with its position and length for use in error reporting.
 */
import Parser from '../apg-lib/parser.js';
import Ast from '../apg-lib/ast.js';
import ScannerGrammar from './scanner-grammar.js';
import { callbacks } from './scanner-callbacks.js';

export interface ScanError {
  line: number;
  char: number;
  msg: string;
}

export interface LineDescriptor {
  lineNo: number;
  beginChar: number;
  length: number;
  textLength: number;
  endType: string;
  invalidChars: number;
}

interface ScanData {
  lines: LineDescriptor[];
  lineNo: number;
  errors: ScanError[];
  strict: boolean;
}

/**
 * Scans an SABNF grammar character array for invalid characters and catalogs its lines.
 * @param chars - Array of integer character codes representing the SABNF grammar text.
 * @param errors - Array to which error objects `{ line, char, msg }` are appended.
 * @param strict - If `true`, every line (including the last) must end with CRLF (`\r\n`).
 * @returns Array of line descriptor objects with `lineNo`, `beginChar`, `length`,
 *   `textLength`, `endType`, and `invalidChars` properties.
 */
export default function scanner(chars: number[], errors: ScanError[], strict?: boolean): LineDescriptor[] {
  const grammar = new ScannerGrammar();

  /* Scan the grammar for character code errors and catalog the lines. */
  const lines: LineDescriptor[] = [];
  const parser = new Parser(grammar);
  const ast = new Ast(grammar);

  // register callbacks individually on the AST so the AST can validate names
  for (const [name, callback] of Object.entries(callbacks)) {
    ast.setCallback(name, callback);
  }

  /* parse the input SABNF grammar */
  parser.setAst(ast);
  const test = parser.parse('file', chars);
  if (test.success !== true) {
    errors.push({
      line: 0,
      char: 0,
      msg: 'syntax analysis error analyzing input SABNF grammar',
    });
    return lines;
  }
  const data: ScanData = {
    lines,
    lineNo: 0,
    errors,
    strict: Boolean(strict),
  };

  /* translate (analyze) the input SABNF grammar */
  ast.translate(data);
  return lines;
}
