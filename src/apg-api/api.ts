/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module api
 * @description The Application Programming Interface (API) for APG — the ABNF Parser Generator.
 * Accepts an SABNF grammar source (string, Buffer, or character-code array) and exposes
 * a sequential workflow: `scan` → `parse` → `translate` → `attributes` → `toSource`/`toObject`.
 */
import scanner from './scanner.js';
import Parser from './parser.js';
import { attributes, showAttributes, showAttributeErrors, showRuleDependencies } from './attributes.js';
import showRules from './show-rules.js';
import type { GrammarObject, GrammarOpcode, GrammarRule, GrammarUdt } from '../apg-lib/types.js';

const THIS_FILE = 'api.js: ';
const CHUNK = 0x8000;

interface LineInfo {
  beginChar: number;
  length: number;
  lineNo: number;
}

interface GrammarError {
  line: number;
  char: number;
  msg: string;
}

interface SemanticResult {
  rules: RuleWithOpcodes[];
  udts: GrammarUdt[];
  lineMap: number[];
}

interface RuleWithOpcodes extends GrammarRule {
  opcodes: GrammarOpcode[];
}

interface GrammarObjectWithCallbacks extends GrammarObject {
  callbacks: Record<string, boolean>;
}

interface ApiState {
  _parser: Parser;
  _isScanned: boolean;
  _isParsed: boolean;
  _isTranslated: boolean;
  _haveAttributes: boolean;
  _attributeErrors: number;
  _lineMap?: number[];
  errors: GrammarError[];
  chars: number[];
  sabnf: string;
  lines?: LineInfo[];
  rules?: RuleWithOpcodes[];
  udts?: GrammarUdt[];
}

/* Convert a phrase (array of character codes) to ASCII text. */
function abnfToAscii(chars: number[], beg: number, len: number): string {
  let str = '';
  for (let i = beg; i < beg + len; i += 1) {
    const ch = chars[i];
    if (ch >= 32 && ch <= 126) {
      str += String.fromCharCode(ch);
    } else {
      switch (ch) {
        case 9:
          str += '\\t';
          break;
        case 10:
          str += '\\n';
          break;
        case 13:
          str += '\\r';
          break;
        default:
          str += '\\unknown';
          break;
      }
    }
  }
  return str;
}

/* Translate lines (SABNF grammar) to ASCII text. */
function linesToAscii(lines: LineInfo[], chars: number[]): string {
  let str = 'Annotated Input Grammar';
  lines.forEach((val) => {
    str += '\n';
    str += `line no: ${val.lineNo}`;
    str += ` : char index: ${val.beginChar}`;
    str += ` : length: ${val.length}`;
    str += ` : abnf: ${abnfToAscii(chars, val.beginChar, val.length)}`;
  });
  str += '\n';
  return str;
}

/* Display an array of errors in ASCII text. */
function errorsToAscii(errors: GrammarError[], lines: LineInfo[], chars: number[]): string {
  let str = '';
  errors.forEach((error) => {
    const line = lines[error.line];
    str += `${line.lineNo}: `;
    str += `${line.beginChar}: `;
    str += `${error.char - line.beginChar}: `;
    str += abnfToAscii(chars, line.beginChar, error.char - line.beginChar);
    str += ' >> ';
    str += abnfToAscii(chars, error.char, line.beginChar + line.length - error.char);
    str += '\n';
    str += `${line.lineNo}: `;
    str += `${line.beginChar}: `;
    str += `${error.char - line.beginChar}: `;
    str += 'error: ';
    str += error.msg;
    str += '\n';
  });
  return str;
}

/* Convert array of Unicode code points to JavaScript string (safe for large arrays). */
function charsToString(chars: number[]): string {
  if (!Array.isArray(chars) || chars.length === 0) {
    return '';
  }
  let out = '';
  for (let i = 0; i < chars.length; i += CHUNK) {
    out += String.fromCodePoint(...chars.slice(i, i + CHUNK));
  }
  return out;
}

/**
 * @class Api
 * @description The main APG API class. Accepts an SABNF grammar source and provides methods
 * to scan, parse, translate, validate attributes, and generate a grammar object or its source code.
 */
export default class Api {
  private _parser: Parser;
  private _isScanned: boolean;
  private _isParsed: boolean;
  private _isTranslated: boolean;
  private _haveAttributes: boolean;
  private _attributeErrors: number;
  private _lineMap?: number[];
  public errors: GrammarError[];
  public chars: number[];
  public sabnf: string;
  public lines?: LineInfo[];
  public rules?: RuleWithOpcodes[];
  public udts?: GrammarUdt[];

  constructor(src: string | Uint8Array | Uint16Array | Uint32Array | number[]) {
    this._parser = new Parser();
    this._isScanned = false;
    this._isParsed = false;
    this._isTranslated = false;
    this._haveAttributes = false;
    this._attributeErrors = 0;
    this._lineMap = undefined;
    this.errors = [];
    if (typeof src === 'string') {
      this.chars = Array.from(src).map((ch) => ch.codePointAt(0) ?? 0);
    } else if (src instanceof Uint8Array || src instanceof Uint16Array || src instanceof Uint32Array) {
      this.chars = Array.from(src);
    } else if (Array.isArray(src)) {
      this.chars = src.slice();
    } else {
      throw new Error(`${THIS_FILE}input source is not a Buffer, Uint8Array, Uint16Array, Uint32Array or string`);
    }
    this.sabnf = charsToString(this.chars);
  }
  /**
   * @method scan
   * @description Scans the input grammar for invalid characters and catalogs line positions.
   * Must be called before `parse()`.
   * @param {boolean} [strict] - If `true`, all lines must end with CRLF (`\r\n`).
   */
  scan(strict?: boolean): void {
    this.lines = scanner(this.chars, this.errors, strict);
    this._isScanned = true;
  }

  /**
   * @method parse
   * @description Parses the grammar for correct SABNF syntax. Must be called after `scan()`.
   * @param {boolean} [strict] - If `true`, restricts to RFC 5234/7405 ABNF only.
   */
  parse(strict?: boolean): void {
    if (!this._isScanned) {
      throw new Error(`${THIS_FILE}grammar not scanned`);
    }
    this._parser.syntax(this.chars, this.lines ?? [], this.errors, strict);
    this._isParsed = true;
  }

  /**
   * @method translate
   * @description Translates the grammar syntax tree into rule and UDT opcode arrays.
   * Must be called after `parse()`. On success, populates `this.rules` and `this.udts`.
   */
  translate(): void {
    if (!this._isParsed) {
      throw new Error(`${THIS_FILE}grammar not scanned and parsed`);
    }
    const ret = this._parser.semantic(this.chars, this.lines ?? [], this.errors) as SemanticResult | null;
    if (this.errors.length === 0 && ret) {
      this.rules = ret.rules;
      this.udts = ret.udts;
      this._lineMap = ret.lineMap;
      this._isTranslated = true;
    }
  }

  /**
   * @method attributes
   * @description Computes rule attributes (left recursion, cyclic, infinite, etc.).
   * Must be called after `translate()`.
   * @returns {number} Number of fatal attribute errors found.
   */
  attributes(): number {
    if (!this._isTranslated) {
      throw new Error(`${THIS_FILE}grammar not scanned, parsed and translated`);
    }
    this._attributeErrors = attributes(this.rules ?? [], this.udts ?? [], this._lineMap ?? [], this.errors);
    this._haveAttributes = true;
    return this._attributeErrors;
  }

  /**
   * @method generate
   * @description Convenience method that runs the full pipeline (scan → parse → translate → attributes)
   * in a single call. Halts early and leaves errors in `this.errors` if any step fails.
   * @param {boolean} [strict] - If `true`, restricts to RFC 5234/7405 ABNF only.
   */
  generate(strict?: boolean): void {
    this.lines = scanner(this.chars, this.errors, strict);
    if (this.errors.length) {
      return;
    }
    this._parser.syntax(this.chars, this.lines, this.errors, strict);
    if (this.errors.length) {
      return;
    }
    const ret = this._parser.semantic(this.chars, this.lines, this.errors) as SemanticResult | null;
    if (this.errors.length || !ret) {
      return;
    }
    this.rules = ret.rules;
    this.udts = ret.udts;
    this._lineMap = ret.lineMap;
    this._attributeErrors = attributes(this.rules, this.udts, this._lineMap ?? [], this.errors);
    this._haveAttributes = true;
  }

  /**
   * @method displayRules
   * @description Returns a formatted list of all rule and UDT names. Requires `translate()` first.
   * @param {string} [order='index'] - `'index'`/`'i'` for definition order, `'alpha'`/`'a'` for alphabetical.
   * @returns {string} Formatted multi-line string.
   */
  displayRules(order: string = 'index'): string {
    if (!this._isTranslated) {
      throw new Error(`${THIS_FILE}grammar not scanned, parsed and translated`);
    }
    return showRules(this.rules ?? [], this.udts ?? [], order);
  }

  /**
   * @method displayRuleDependencies
   * @description Returns a formatted display of rule dependencies. Requires `attributes()` first.
   * @param {string} [order='index'] - `'index'`/`'i'`, `'alpha'`/`'a'`, or `'type'`/`'t'`.
   * @returns {string} Formatted multi-line string.
   */
  displayRuleDependencies(order: string = 'index'): string {
    if (!this._haveAttributes) {
      throw new Error(`${THIS_FILE}no attributes - must be preceded by call to attributes()`);
    }
    return showRuleDependencies(order);
  }

  /**
   * @method displayAttributes
   * @description Returns a formatted display of rule attributes. Requires `attributes()` first.
   * @param {string} [order='index'] - `'index'`/`'i'`, `'alpha'`/`'a'`, or `'type'`/`'t'`.
   * @returns {string} Formatted multi-line string.
   */
  displayAttributes(order: string = 'index'): string {
    if (!this._haveAttributes) {
      throw new Error(`${THIS_FILE}no attributes - must be preceded by call to attributes()`);
    }
    if (this._attributeErrors) {
      showAttributeErrors();
    }
    return showAttributes(order);
  }

  /**
   * @method displayAttributeErrors
   * @description Returns a formatted display of only the erroneous rule attributes.
   * Requires `attributes()` first.
   * @returns {string} Formatted multi-line string listing only rules with fatal attribute errors.
   */
  displayAttributeErrors(): string {
    if (!this._haveAttributes) {
      throw new Error(`${THIS_FILE}no attributes - must be preceded by call to attributes()`);
    }
    return showAttributeErrors();
  }

  /**
   * @method toSource
   * @description Returns the grammar object as a JavaScript source code string.
   * Requires a successful `attributes()` call with zero errors.
   * @returns {string} JavaScript source code for the grammar constructor function.
   */
  toSource(typescript?: boolean): string {
    const useTypeScript = !!typescript;
    if (!this._haveAttributes) {
      throw new Error(`${THIS_FILE}can't generate parser source - must be preceded by call to attributes()`);
    }
    if (this._attributeErrors) {
      throw new Error(`${THIS_FILE}can't generate parser source - attributes have ${this._attributeErrors} errors`);
    }
    return this._parser.generateSource(this.chars, this.lines ?? [], this.rules ?? [], this.udts ?? [], useTypeScript);
  }

  /**
   * @method toObject
   * @description Returns an in-memory grammar object ready for use with `apg-lib`.
   * Requires a successful `attributes()` call with zero errors.
   * @returns {Object} Grammar object with `rules`, `udts`, and `toString()` method.
   */
  toObject(): GrammarObjectWithCallbacks {
    if (!this._haveAttributes) {
      throw new Error(`${THIS_FILE}can't generate parser source - must be preceded by call to attributes()`);
    }
    if (this._attributeErrors) {
      throw new Error(`${THIS_FILE}can't generate parser source - attributes have ${this._attributeErrors} errors`);
    }
    return this._parser.generateObject(this.sabnf, this.rules ?? [], this.udts ?? []);
  }

  /**
   * @method errorsToAscii
   * @description Returns all collected errors as a human-readable ASCII string.
   * @returns {string} Formatted error listing.
   */
  errorsToAscii(): string {
    return errorsToAscii(this.errors, this.lines ?? [], this.chars);
  }

  /**
   * @method linesToAscii
   * @description Returns an annotated listing of the SABNF grammar source lines.
   * @returns {string} Formatted annotated grammar listing.
   */
  linesToAscii(): string {
    return linesToAscii(this.lines ?? [], this.chars);
  }
}
