/**
 * @module trace
 * @description Provides parse tree node tracing for the APG parser.
 * Records operator entries and exits as the parser traverses the parse tree.
 * Attach to a parser instance via {@link Parser#setTrace}.
 */
import { charsToString } from './utilities.js';
import id from './identifiers.js';

const THIS_FILE = 'trace.js ';
const MAX_PHRASE = 100;

function indent(n) {
  if (n <= 0) return '';
  return '....|'.repeat(Math.floor(n / 5)) + '.'.repeat(n % 5);
}

function lookAheadIndent(n) {
  if (n <= 0) return '';
  return '****~'.repeat(Math.floor(n / 5)) + '*'.repeat(n % 5);
}

function opName(op, rules, udts) {
  let name;
  switch (op.type) {
    case id.ALT:
      name = 'ALT';
      break;
    case id.CAT:
      name = 'CAT';
      break;
    case id.REP:
      if (op.max === Infinity) {
        name = `REP(${op.min},inf)`;
      } else {
        name = `REP(${op.min},${op.max})`;
      }
      break;
    case id.RNM:
      name = `RNM(${rules[op.index].name})`;
      break;
    case id.TRG:
      name = `TRG(${op.min},${op.max})`;
      break;
    case id.TBS:
      if (op.string.length > 6) {
        name = `TBS(${charsToString(op.string, 0, 3).replace(/\r/g, '\\r').replace(/\n/g, '\\n')}...)`;
      } else {
        name = `TBS(${charsToString(op.string, 0, 6).replace(/\r/g, '\\r').replace(/\n/g, '\\n')})`;
      }
      break;
    case id.TLS:
      if (op.string.length > 6) {
        name = `TLS(${charsToString(op.string, 0, 3).replace(/\r/g, '\\r').replace(/\n/g, '\\n')}...)`;
      } else {
        name = `TLS(${charsToString(op.string, 0, 6).replace(/\r/g, '\\r').replace(/\n/g, '\\n')})`;
      }
      break;
    case id.UDT:
      name = `UDT(${udts[op.index].name})`;
      break;
    case id.AND:
      name = 'AND';
      break;
    case id.NOT:
      name = 'NOT';
      break;
    default:
      throw new Error(`${THIS_FILE}Trace: opName: unrecognized opcode`);
  }
  return name;
}

/**
 * @class Trace
 * @description Records and displays a textual trace of every operator node
 * visited during a parse. Useful for debugging grammars and parsers.
 */
export default class Trace {
  constructor() {
    this.traceObject = 'traceObject';
    this._rules = undefined;
    this._udts = undefined;
    this._rules = undefined;
    this._chars = undefined;
    this._udts = undefined;
    this._out = '';
    this._treeDepth = 0;
  }

  init(r, u, c) {
    this._rules = r;
    this._udts = u;
    this._chars = c;
  }

  down(op, offset, lookAhead) {
    const lead =
      lookAhead > 0 || op.type === id.AND || op.type === id.NOT
        ? lookAheadIndent(this._treeDepth)
        : indent(this._treeDepth);
    const len = Math.min(MAX_PHRASE, this._chars.length - offset);
    let phrase = charsToString(this._chars, offset, len).replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    if (len < this._chars.length - offset) {
      phrase += '...';
    }
    phrase = `${lead}|-|[${opName(op, this._rules, this._udts)}]->${phrase}\n`;
    this._out += phrase;
    this._treeDepth += 1;
  }

  up(op, state, offset, phraseLength, lookAhead) {
    const thisFunc = `${THIS_FILE}trace.up: `;
    this._treeDepth -= 1;
    const lead = lookAhead > 0 ? lookAheadIndent(this._treeDepth) : indent(this._treeDepth);
    let len;
    let phrase;
    let st;
    const ol = `(${offset},${phraseLength})|`;
    switch (state) {
      case id.EMPTY:
        st = '|E|';
        phrase = `${ol}''`;
        break;
      case id.MATCH:
        st = '|M|';
        len = Math.min(MAX_PHRASE, phraseLength);
        if (len < phraseLength) {
          phrase = `${ol}'${charsToString(this._chars, offset, len).replace(/\r/g, '\\r').replace(/\n/g, '\\n')}...'`;
        } else {
          phrase = `${ol}'${charsToString(this._chars, offset, len).replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;
        }
        break;
      case id.NOMATCH:
        st = '|N|';
        phrase = '';
        break;
      default:
        throw new Error(`${thisFunc} unrecognized state`);
    }
    phrase = `${lead}${st}[${opName(op, this._rules, this._udts)}]<-${phrase}\n`;
    this._out += phrase;
  }

  /**
   * @method display
   * @description Returns the full trace as a formatted string.
   * @returns {string} The input string followed by the parse tree node trace.
   */
  display() {
    let out = 'INPUT STRING\n';
    out += charsToString(this._chars, 0, this._chars.length).replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    out += '\n\nPARSE TREE NODE TRACE\n';
    out += this._out;
    return out;
  }
}
