/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module syntax-callbacks
 * Callback functions for the syntax analysis phase of the SABNF grammar
 * parser generator. Based on the grammar defined in `sabnf-grammar.bnf`.
 */
import ids from '../apg-lib/identifiers.js';
import { charsToString } from '../apg-lib/utilities.js';
import type { ParserCallback } from '../apg-lib/types.js';

const THIS_FILE = 'syntax-callbacks.js: ';

interface SyntaxErrorEntry {
  line: number;
  char: number;
  msg: string;
}

interface SyntaxData {
  altStack: AltState[];
  repCount: number;
  ruleCount: number;
  errors: SyntaxErrorEntry[];
  strict: boolean;
  findLine(lines: Array<{ beginChar: number; length: number }>, charIndex: number, charLength: number): number;
  charsLength: number;
  lines: Array<{ beginChar: number; length: number }>;
  stringTabChar: number | false;
}

interface AltState {
  groupOpen: number | null;
  groupError: boolean;
  optionOpen: number | null;
  optionError: boolean;
  tlsOpen: number | null;
  clsOpen: number | null;
  prosValOpen: number | null;
  basicError: boolean;
}

let topAlt: AltState = {
  groupOpen: null,
  groupError: false,
  optionOpen: null,
  optionError: false,
  tlsOpen: null,
  clsOpen: null,
  prosValOpen: null,
  basicError: false,
};

function toCharIndex(value: number | null): number {
  return value ?? -1;
}

/* syntax, RNM, callback functions */
const synFile: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      data.altStack = [];
      data.repCount = 0;
      break;
    case ids.EMPTY:
      /* should never get here */
      data.errors.push({
        line: 0,
        char: 0,
        msg: 'grammar file is empty',
      });
      break;
    case ids.MATCH:
      if (data.ruleCount === 0) {
        data.errors.push({
          line: 0,
          char: 0,
          msg: 'no rules defined',
        });
      }
      break;
    case ids.NOMATCH:
      throw new Error(`${THIS_FILE}synFile: grammar file NOMATCH: design error: should never happen.`);
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synRule: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      data.altStack.length = 0;
      topAlt = {
        groupOpen: null,
        groupError: false,
        optionOpen: null,
        optionError: false,
        tlsOpen: null,
        clsOpen: null,
        prosValOpen: null,
        basicError: false,
      };
      data.altStack.push(topAlt);
      break;
    case ids.EMPTY:
      throw new Error(`${THIS_FILE}synRule: EMPTY: rule cannot be empty`);
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      data.ruleCount += 1;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synRuleError: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: 'Unrecognized SABNF line. Invalid rule, comment or blank line.',
      });
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synRuleNameError: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: 'Rule names must be alphanum and begin with alphabetic character.',
      });
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synDefinedAsError: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: "Expected '=' or '=/'. Not found.",
      });
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synAndOp: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (data.strict) {
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: 'AND operator(&) found - strict ABNF specified.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synNotOp: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (data.strict) {
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: 'NOT operator(!) found - strict ABNF specified.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synUdtOp: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (data.strict) {
        const name = charsToString(chars, phraseIndex, result.phraseLength);
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: `UDT operator found(${name}) - strict ABNF specified.`,
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synTlsOpen: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      topAlt.tlsOpen = phraseIndex;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synTlsString: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      data.stringTabChar = false;
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (data.stringTabChar !== false) {
        data.errors.push({
          line: data.findLine(data.lines, data.stringTabChar, data.charsLength),
          char: data.stringTabChar,
          msg: "Tab character (\\t, x09) not allowed in literal string (see 'quoted-string' definition, RFC 7405.)",
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synStringTab: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      data.stringTabChar = phraseIndex;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synTlsClose: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, toCharIndex(topAlt.tlsOpen), data.charsLength),
        char: toCharIndex(topAlt.tlsOpen),
        msg: 'Case-insensitive literal string("...") opened but not closed.',
      });
      topAlt.basicError = true;
      topAlt.tlsOpen = null;
      break;
    case ids.MATCH:
      topAlt.tlsOpen = null;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synClsOpen: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      topAlt.clsOpen = phraseIndex;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synClsString: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      data.stringTabChar = false;
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (data.stringTabChar !== false) {
        data.errors.push({
          line: data.findLine(data.lines, data.stringTabChar, data.charsLength),
          char: data.stringTabChar,
          msg: 'Tab character (\\t, x09) not allowed in literal string.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synClsClose: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, toCharIndex(topAlt.clsOpen), data.charsLength),
        char: toCharIndex(topAlt.clsOpen),
        msg: "Case-sensitive literal string('...') opened but not closed.",
      });
      topAlt.clsOpen = null;
      topAlt.basicError = true;
      break;
    case ids.MATCH:
      if (data.strict) {
        data.errors.push({
          line: data.findLine(data.lines, toCharIndex(topAlt.clsOpen), data.charsLength),
          char: toCharIndex(topAlt.clsOpen),
          msg: "Case-sensitive string operator('...') found - strict ABNF specified.",
        });
      }
      topAlt.clsOpen = null;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synProsValOpen: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      topAlt.prosValOpen = phraseIndex;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synProsValString: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      data.stringTabChar = false;
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (data.stringTabChar !== false) {
        data.errors.push({
          line: data.findLine(data.lines, data.stringTabChar, data.charsLength),
          char: data.stringTabChar,
          msg: 'Tab character (\\t, x09) not allowed in prose value string.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synProsValClose: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, toCharIndex(topAlt.prosValOpen), data.charsLength),
        char: toCharIndex(topAlt.prosValOpen),
        msg: 'Prose value operator(<...>) opened but not closed.',
      });
      topAlt.basicError = true;
      topAlt.prosValOpen = null;
      break;
    case ids.MATCH:
      data.errors.push({
        line: data.findLine(data.lines, toCharIndex(topAlt.prosValOpen), data.charsLength),
        char: toCharIndex(topAlt.prosValOpen),
        msg: 'Prose value operator(<...>) found. The ABNF syntax is valid, but a parser cannot be generated from this grammar.',
      });
      topAlt.prosValOpen = null;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synGroupOpen: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      topAlt = {
        groupOpen: phraseIndex,
        groupError: false,
        optionOpen: null,
        optionError: false,
        tlsOpen: null,
        clsOpen: null,
        prosValOpen: null,
        basicError: false,
      };
      data.altStack.push(topAlt);
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synGroupClose: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.groupOpen ?? -1, data.charsLength),
        char: topAlt.groupOpen ?? -1,
        msg: 'Group "(...)" opened but not closed.',
      });
      topAlt = data.altStack.pop() ?? topAlt;
      topAlt.groupError = true;
      break;
    case ids.MATCH:
      topAlt = data.altStack.pop() ?? topAlt;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synOptionOpen: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      topAlt = {
        groupOpen: null,
        groupError: false,
        optionOpen: phraseIndex,
        optionError: false,
        tlsOpen: null,
        clsOpen: null,
        prosValOpen: null,
        basicError: false,
      };
      data.altStack.push(topAlt);
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synOptionClose: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, toCharIndex(topAlt.optionOpen), data.charsLength),
        char: toCharIndex(topAlt.optionOpen),
        msg: 'Option "[...]" opened but not closed.',
      });
      const previousOption = data.altStack.pop();
      if (!previousOption) {
        throw new Error(`${THIS_FILE}synOptionClose: missing option state`);
      }
      topAlt = previousOption;
      topAlt.optionError = true;
      break;
    case ids.MATCH:
      const previousOptionMatch = data.altStack.pop();
      if (!previousOptionMatch) {
        throw new Error(`${THIS_FILE}synOptionClose: missing option state`);
      }
      topAlt = previousOptionMatch;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synBasicElementError: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      if (topAlt.basicError === false) {
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: 'Unrecognized SABNF element.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synLineEnd: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      /* should never be here - this gets caught it scanner */
      if (result.phraseLength === 1 && data.strict) {
        const end = chars[phraseIndex] === 13 ? 'CR' : 'LF';
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: `Line end '${end}' found - strict ABNF specified, only CRLF allowed.`,
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synLineEndError: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      break;
    case ids.MATCH:
      /* should not be here - scanner picks up these errors*/
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: 'Unrecognized grammar element or characters.',
      });
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
const synRepetition: ParserCallback = (result, chars, phraseIndex, userData): void => {
  const data = userData as SyntaxData;
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.repCount += 1;
      break;
    case ids.MATCH:
      data.repCount += 1;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
};
// Define the list of callback functions.
const callbacks: Record<string, ParserCallback> = {
  andop: synAndOp,
  basicelementerr: synBasicElementError,
  clsclose: synClsClose,
  clsopen: synClsOpen,
  clsstring: synClsString,
  definedaserror: synDefinedAsError,
  file: synFile,
  groupclose: synGroupClose,
  groupopen: synGroupOpen,
  lineenderror: synLineEndError,
  lineend: synLineEnd,
  notop: synNotOp,
  optionclose: synOptionClose,
  optionopen: synOptionOpen,
  prosvalclose: synProsValClose,
  prosvalopen: synProsValOpen,
  prosvalstring: synProsValString,
  repetition: synRepetition,
  rule: synRule,
  ruleerror: synRuleError,
  rulenameerror: synRuleNameError,
  stringtab: synStringTab,
  tlsclose: synTlsClose,
  tlsopen: synTlsOpen,
  tlsstring: synTlsString,
  udtop: synUdtOp,
};
export { callbacks };
