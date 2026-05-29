/**
 * @module traceSabnf
 * @description Provides SABNF grammar-annotated trace output for the APG parser.
 * Records operator entries and exits annotated with their position in the grammar source text.
 * Attach to a parser instance via {@link Parser#setTraceSabnf}.
 */
import { charsToString } from './utilities.js';
import id from './identifiers.js';

const THIS_FILE = 'traceSabnf.js: ';
const MAX_PHRASE = 100;
const DOWN = '>>>';
const UPMATCH = '<M<';
const UPNOMATCH = '<N<';
const UPEMPTY = '<E<';

function lead(lineno, offset, s) {
  let state = '-';
  switch (s) {
    case id.MATCH:
      state = 'M';
      break;
    case id.NOMATCH:
      state = 'N';
      break;
    case id.EMPTY:
      state = 'E';
      break;
  }
  const l = String(lineno).padStart(lineno > 999 ? String(lineno).length : 3);
  const o = String(offset).padStart(offset > 999 ? String(offset).length : 3);
  return `${l}: ${o}: ${state}: `;
}

function opToString(op) {
  switch (op.type) {
    case id.ALT:
      return 'ALT';
    case id.CAT:
      return 'CAT';
    case id.REP:
      return 'REP';
    case id.RNM:
      return 'RNM';
    case id.UDT:
      return 'UDT';
    case id.TLS:
      return 'TLS';
    case id.TBS:
      return 'TBS';
    case id.TRG:
      return 'TRG';
    case id.AND:
      return 'AND';
    case id.NOT:
      return 'NOT';
  }
}
/**
 * @class TraceSabnf
 * @description Records and displays a trace of every operator visited during a parse,
 * annotated with the corresponding position in the SABNF grammar source text.
 */
export default class Trace {
  constructor() {
    this.traceSabnfObject = 'traceSabnfObject';
  }

  // sabnf is SABNF grammar text split into array of lines (Parser, _initializeTraceSabnf)
  init(sabnf, c) {
    this._sabnf = sabnf;
    this._chars = c;
    this._out = [];
  }

  down(op) {
    let gline = this._sabnf[op.gl];
    gline = gline.slice(0, op.go) + '>' + opToString(op) + '>' + gline.slice(op.go);
    this._out.push(lead(op.gl, op.go) + gline);
  }

  up(op, state, offset, length) {
    let phrase = null;
    if (state === id.MATCH || state === id.EMPTY) {
      const len = Math.min(length, MAX_PHRASE);
      phrase = charsToString(this._chars, offset, len);
      if (length > MAX_PHRASE) phrase = phrase + '...';
    }
    let gline = this._sabnf[op.gl];
    gline = gline.slice(0, op.go) + '<' + opToString(op) + '<' + gline.slice(op.go);
    if (phrase) {
      gline += ' : ' + phrase;
    }
    this._out.push(lead(op.gl, op.go, state) + gline);
  }

  /**
   * @method display
   * @description Returns the annotated grammar trace as a formatted string.
   * @returns {string} Grammar trace followed by the full grammar text.
   */
  display() {
    let out = 'GRAMMAR TRACE\n';
    out += this._out.join('\n');
    out += '\n\nGRAMMAR TEXT\n';
    out += this._sabnf.join('\n');
    return out;
  }
}
