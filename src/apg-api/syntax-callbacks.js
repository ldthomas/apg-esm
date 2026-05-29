/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module syntax-callbacks
 * @description Callback functions for the syntax analysis phase of the SABNF grammar
 * parser generator. Based on the grammar defined in `sabnf-grammar.bnf`.
 */
import ids from '../apg-lib/identifiers.js';
import { charsToString } from '../apg-lib/utilities.js';

const THIS_FILE = 'syntax-callbacks.js: ';
let topAlt;

/* syntax, RNM, callback functions */
function synFile(result, chars, phraseIndex, data) {
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
}
function synRule(result, chars, phraseIndex, data) {
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
}
function synRuleError(result, chars, phraseIndex, data) {
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
}
function synRuleNameError(result, chars, phraseIndex, data) {
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
}
function synDefinedAsError(result, chars, phraseIndex, data) {
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
}
function synAndOp(result, chars, phraseIndex, data) {
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
}
function synNotOp(result, chars, phraseIndex, data) {
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
}
function synUdtOp(result, chars, phraseIndex, data) {
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
}
function synTlsOpen(result, chars, phraseIndex) {
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
}
function synTlsString(result, chars, phraseIndex, data) {
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
          line: data.findLine(data.lines, data.stringTabChar),
          char: data.stringTabChar,
          msg: "Tab character (\\t, x09) not allowed in literal string (see 'quoted-string' definition, RFC 7405.)",
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synStringTab(result, chars, phraseIndex, data) {
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
}
function synTlsClose(result, chars, phraseIndex, data) {
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.tlsOpen),
        char: topAlt.tlsOpen,
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
}
function synClsOpen(result, chars, phraseIndex) {
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
}
function synClsString(result, chars, phraseIndex, data) {
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
          line: data.findLine(data.lines, data.stringTabChar),
          char: data.stringTabChar,
          msg: 'Tab character (\\t, x09) not allowed in literal string.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synClsClose(result, chars, phraseIndex, data) {
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.clsOpen),
        char: topAlt.clsOpen,
        msg: "Case-sensitive literal string('...') opened but not closed.",
      });
      topAlt.clsOpen = null;
      topAlt.basicError = true;
      break;
    case ids.MATCH:
      if (data.strict) {
        data.errors.push({
          line: data.findLine(data.lines, topAlt.clsOpen),
          char: topAlt.clsOpen,
          msg: "Case-sensitive string operator('...') found - strict ABNF specified.",
        });
      }
      topAlt.clsOpen = null;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synProsValOpen(result, chars, phraseIndex) {
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
}
function synProsValString(result, chars, phraseIndex, data) {
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
          line: data.findLine(data.lines, data.stringTabChar),
          char: data.stringTabChar,
          msg: 'Tab character (\\t, x09) not allowed in prose value string.',
        });
      }
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synProsValClose(result, chars, phraseIndex, data) {
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.prosValOpen),
        char: topAlt.prosValOpen,
        msg: 'Prose value operator(<...>) opened but not closed.',
      });
      topAlt.basicError = true;
      topAlt.prosValOpen = null;
      break;
    case ids.MATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.prosValOpen),
        char: topAlt.prosValOpen,
        msg: 'Prose value operator(<...>) found. The ABNF syntax is valid, but a parser cannot be generated from this grammar.',
      });
      topAlt.prosValOpen = null;
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synGroupOpen(result, chars, phraseIndex, data) {
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
}
function synGroupClose(result, chars, phraseIndex, data) {
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.groupOpen),
        char: topAlt.groupOpen,
        msg: 'Group "(...)" opened but not closed.',
      });
      topAlt = data.altStack.pop();
      topAlt.groupError = true;
      break;
    case ids.MATCH:
      topAlt = data.altStack.pop();
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synOptionOpen(result, chars, phraseIndex, data) {
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
}
function synOptionClose(result, chars, phraseIndex, data) {
  switch (result.state) {
    case ids.ACTIVE:
      break;
    case ids.EMPTY:
      break;
    case ids.NOMATCH:
      data.errors.push({
        line: data.findLine(data.lines, topAlt.optionOpen),
        char: topAlt.optionOpen,
        msg: 'Option "[...]" opened but not closed.',
      });
      topAlt = data.altStack.pop();
      topAlt.optionError = true;
      break;
    case ids.MATCH:
      topAlt = data.altStack.pop();
      break;
    default:
      throw new Error(`${THIS_FILE}synFile: unrecognized case.`);
  }
}
function synBasicElementError(result, chars, phraseIndex, data) {
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
}
function synLineEnd(result, chars, phraseIndex, data) {
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
}
function synLineEndError(result, chars, phraseIndex, data) {
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
}
function synRepetition(result, chars, phraseIndex, data) {
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
}
// Define the list of callback functions.
const callbacks = [];
callbacks.andop = synAndOp;
callbacks.basicelementerr = synBasicElementError;
callbacks.clsclose = synClsClose;
callbacks.clsopen = synClsOpen;
callbacks.clsstring = synClsString;
callbacks.definedaserror = synDefinedAsError;
callbacks.file = synFile;
callbacks.groupclose = synGroupClose;
callbacks.groupopen = synGroupOpen;
callbacks.lineenderror = synLineEndError;
callbacks.lineend = synLineEnd;
callbacks.notop = synNotOp;
callbacks.optionclose = synOptionClose;
callbacks.optionopen = synOptionOpen;
callbacks.prosvalclose = synProsValClose;
callbacks.prosvalopen = synProsValOpen;
callbacks.prosvalstring = synProsValString;
callbacks.repetition = synRepetition;
callbacks.rule = synRule;
callbacks.ruleerror = synRuleError;
callbacks.rulenameerror = synRuleNameError;
callbacks.stringtab = synStringTab;
callbacks.tlsclose = synTlsClose;
callbacks.tlsopen = synTlsOpen;
callbacks.tlsstring = synTlsString;
callbacks.udtop = synUdtOp;
export { callbacks };
