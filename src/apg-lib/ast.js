/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module ast
 * @description Provides the Abstract Syntax Tree (AST) builder and translator for the APG parser.
 * The AST is a user-controlled subset of the full parse tree. Each node stores the matched phrase
 * for a named rule (`RNM`) or user-defined terminal (`UDT`).
 * Attach to a parser instance via {@link Parser#setAst}.
 */
import id from './identifiers.js';
import { charsToDec, charsToAscii, charsToHex, charsToUnicode } from './utilities.js';

const THIS_FILE = 'ast.js: ';

/* helper for XML display */
function indent(n) {
  let ret = '';
  for (let i = 0; i < n; i += 1) {
    ret += ' ';
  }
  return ret;
}

/**
 * @class Ast
 * @description Builds and translates an Abstract Syntax Tree (AST) as a subset of the parse tree.
 * The user registers rule/UDT names to retain and optionally associates semantic callback
 * functions with them. After parsing, call {@link Ast#translate} to apply the callbacks.
 */
export default class Ast {
  constructor(grammar) {
    if (grammar?.grammarObject !== 'grammarObject') {
      throw new Error(`${THIS_FILE}invalid grammar object`);
    }
    this._rules = grammar.rules;
    this._udts = grammar.udts;
    this._chars = null;
    this.callbacks = Array(this._rules.length + this._udts.length).fill(null);
    this._stack = [];
    this._records = [];
    this.astObject = 'astObject';
  }

  /* called by the parser to initialize the AST with the input characters */
  init(chars) {
    this._chars = chars;
  }

  /**
   * @method setCallback
   * @description Registers a semantic callback function for a named rule or UDT.
   * Pass `true` instead of a function to capture the node without a callback.
   * @param {string} name - The rule or UDT name (case-insensitive).
   * @param {Function|true} fn - Callback function, or `true` to enable capture without a callback.
   */
  setCallback(name, fn) {
    if (typeof name !== 'string' || typeof fn !== 'function') {
      throw new Error(`${THIS_FILE}setCallback: name must be a string and fn must be a function`);
    }
    const lower = name.toLowerCase();
    const udt = this._udts.find((u) => u.lower === lower);
    if (udt) {
      this.callbacks[this._rules.length + udt.index] = fn;
      return;
    }
    const rule = this._rules.find((r) => r.lower === lower);
    if (rule) {
      this.callbacks[rule.index] = fn;
      return;
    }
    throw new Error(`${THIS_FILE}setCallback: '${name}' is not a recognized rule or UDT name`);
  }
  /* AST node definitions - called by the parser's `RNM` operator */
  ruleDefined(index) {
    return Boolean(this.callbacks[index]);
  }

  /* AST node definitions - called by the parser's `UDT` operator */
  udtDefined(index) {
    return Boolean(this.callbacks[this._rules.length + index]);
  }

  /* called by the parser's `RNM` & `UDT` operators */
  /* builds a record for the downward traversal of the node */
  down(callbackIndex, name) {
    const thisIndex = this._records.length;
    this._stack.push(thisIndex);
    this._records.push({
      name,
      thisIndex,
      thatIndex: null,
      state: id.SEM_PRE,
      callbackIndex,
      phraseIndex: null,
      phraseLength: null,
      stack: this._stack.length,
    });
    return thisIndex;
  }

  /* called by the parser's `RNM` & `UDT` operators */
  /* builds a record for the upward traversal of the node */
  up(callbackIndex, name, phraseIndex, phraseLength) {
    const thisIndex = this._records.length;
    const thatIndex = this._stack.pop();
    this._records.push({
      name,
      thisIndex,
      thatIndex,
      state: id.SEM_POST,
      callbackIndex,
      phraseIndex,
      phraseLength,
      stack: this._stack.length,
    });
    this._records[thatIndex].thatIndex = thisIndex;
    this._records[thatIndex].phraseIndex = phraseIndex;
    this._records[thatIndex].phraseLength = phraseLength;
    return thisIndex;
  }

  /**
   * @method translate
   * @description Traverses all recorded AST nodes and invokes the registered callback
   * functions to apply semantic actions to the matched phrases.
   * @param {*} [data] - Optional user-defined data passed through to every callback function.
   */
  translate(data) {
    let ret;
    let callback;
    let record;
    for (let i = 0; i < this._records.length; i += 1) {
      record = this._records[i];
      callback = this.callbacks[record.callbackIndex];
      if (record.state === id.SEM_PRE) {
        ret = callback(id.SEM_PRE, this._chars, record.phraseIndex, record.phraseLength, data);
        if (ret === id.SEM_SKIP) {
          i = record.thatIndex;
        }
      } else {
        callback(id.SEM_POST, this._chars, record.phraseIndex, record.phraseLength, data);
      }
    }
  }

  /* called by the parser to reset the length of the records array */
  /* necessary on backtracking */
  setLength(length) {
    this._records.length = length;
    if (length > 0) {
      this._stack.length = this._records[length - 1].stack;
    } else {
      this._stack.length = 0;
    }
  }

  /* called by the parser to get the length of the records array */
  getLength() {
    return this._records.length;
  }

  /**
   * @method toXml
   * @description Generates an XML representation of the AST.
   * @param {string} [mode] - Display mode for captured phrases:
   *   `'ascii'` (default), `'decimal'`, `'hexadecimal'`, or `'unicode'`.
   * @returns {string} Well-formed XML string representing the AST.
   */
  toXml(modeArg) {
    let display = charsToDec;
    let caption = 'decimal integer character codes';
    if (typeof modeArg === 'string' && modeArg.length >= 3) {
      const mode = modeArg.slice(0, 3).toLowerCase();
      if (mode === 'asc') {
        display = charsToAscii;
        caption = 'ASCII for printing characters, hex for non-printing';
      } else if (mode === 'hex') {
        display = charsToHex;
        caption = 'hexadecimal integer character codes';
      } else if (mode === 'uni') {
        display = charsToUnicode;
        caption = 'Unicode UTF-32 integer character codes';
      }
    }
    let xml = '';
    let depth = 0;
    xml += '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += `<root nodes="${this._records.length / 2}" characters="${this._chars.length}">\n`;
    xml += `<!-- input string, ${caption} -->\n`;
    xml += indent(depth + 2);
    xml += display(this._chars);
    xml += '\n';
    this._records.forEach((rec) => {
      if (rec.state === id.SEM_PRE) {
        depth += 1;
        xml += indent(depth);
        xml += `<node name="${rec.name}" index="${rec.phraseIndex}" length="${rec.phraseLength}">\n`;
        xml += indent(depth + 2);
        xml += display(this._chars, rec.phraseIndex, rec.phraseLength);
        xml += '\n';
      } else {
        xml += indent(depth);
        xml += `</node><!-- name="${rec.name}" -->\n`;
        depth -= 1;
      }
    });
    xml += '</root>\n';
    return xml;
  }
}
