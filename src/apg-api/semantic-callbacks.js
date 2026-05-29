/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module semantic-callbacks
 * @description AST translation callback functions for the semantic analysis phase
 * of the SABNF grammar parser generator. Based on the grammar defined in `sabnf-grammar.bnf`.
 */
import ids from '../apg-lib/identifiers.js';
import { charsToString } from '../apg-lib/utilities.js';

/* Some helper functions. */
function NameList() {
  this.names = [];
  /* Adds a new rule name object to the list. Returns -1 if the name already exists. */
  /* Returns the added name object if the name does not already exist. */
  this.add = function add(name) {
    let ret = -1;
    const find = this.get(name);
    if (find === -1) {
      ret = {
        name,
        lower: name.toLowerCase(),
        index: this.names.length,
      };
      this.names.push(ret);
    }
    return ret;
  };
  /* Brute-force look up. */
  this.get = function get(name) {
    let ret = -1;
    const lower = name.toLowerCase();
    for (let i = 0; i < this.names.length; i += 1) {
      if (this.names[i].lower === lower) {
        ret = this.names[i];
        break;
      }
    }
    return ret;
  };
}
/* converts text decimal numbers from, e.g. %d99, to an integer */
function decnum(chars, beg, len) {
  let num = 0;
  for (let i = beg; i < beg + len; i += 1) {
    num = 10 * num + chars[i] - 48;
  }
  return num;
}
/* converts text binary numbers from, e.g. %b10, to an integer */
function binnum(chars, beg, len) {
  let num = 0;
  for (let i = beg; i < beg + len; i += 1) {
    num = 2 * num + chars[i] - 48;
  }
  return num;
}
/* converts text hexadecimal numbers from, e.g. %xff, to an integer */
function hexnum(chars, beg, len) {
  let num = 0;
  for (let i = beg; i < beg + len; i += 1) {
    let digit = chars[i];
    if (digit >= 48 && digit <= 57) {
      digit -= 48;
    } else if (digit >= 65 && digit <= 70) {
      digit -= 55;
    } else if (digit >= 97 && digit <= 102) {
      digit -= 87;
    } else {
      throw new Error('hexnum out of range');
    }
    num = 16 * num + digit;
  }
  return num;
}

// This is the prototype for all semantic analysis callback functions.
// ````
// state - the translator state
//   ids.SEM_PRE for downward (pre-branch) traversal of the AST
//   ids.SEM_POST for upward (post branch) traversal of the AST
// chars - the array of character codes for the input string
// phraseIndex - index into the chars array to the first
//               character of the phrase
// phraseLength - the number of characters in the phrase
// data - user-defined data passed to the translator
//        for use by the callback functions.
// @return ids.SEM_OK, normal return.
//         ids.SEM_SKIP in state ids.SEM_PRE will
//         skip the branch below.
//         Any thing else is an error which will
//         stop the translation.
// ````
/*
function semCallbackPrototype(state, chars, phraseIndex, phraseLength, data) {
  let ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
  } else if (state === ids.SEM_POST) {
  }
  return ret;
}
*/
// The AST callback functions.
function semFile(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.ruleNames = new NameList();
    data.udtNames = new NameList();
    data.rules = [];
    data.udts = [];
    data.rulesLineMap = [];
    data.opcodes = [];
    data.altStack = [];
    data.topStack = null;
    data.topRule = null;
  } else if (state === ids.SEM_POST) {
    /* validate RNM rule names and set opcode rule index */
    let nameObj;
    data.rules.forEach((rule) => {
      rule.opcodes.forEach((op) => {
        if (op.type === ids.RNM) {
          nameObj = data.ruleNames.get(op.index.name);
          if (nameObj === -1) {
            data.errors.push({
              line: data.findLine(data.lines, op.index.phraseIndex, data.charsLength),
              char: op.index.phraseIndex,
              msg: `Rule name '${op.index.name}' used but not defined.`,
            });
            op.index = -1;
          } else {
            op.index = nameObj.index;
          }
        }
      });
    });
  }
  return ret;
}
function semRule(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.altStack.length = 0;
    data.topStack = null;
    data.rulesLineMap.push({
      line: data.findLine(data.lines, phraseIndex, data.charsLength),
      char: phraseIndex,
    });
  }
  return ret;
}
function semRuleLookup(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.ruleName = '';
    data.definedas = '';
  } else if (state === ids.SEM_POST) {
    let ruleName;
    if (data.definedas === '=') {
      ruleName = data.ruleNames.add(data.ruleName);
      if (ruleName === -1) {
        data.definedas = null;
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: `Rule name '${data.ruleName}' previously defined.`,
        });
      } else {
        /* start a new rule */
        data.topRule = {
          name: ruleName.name,
          lower: ruleName.lower,
          opcodes: [],
          index: ruleName.index,
        };
        data.rules.push(data.topRule);
        data.opcodes = data.topRule.opcodes;
      }
    } else {
      ruleName = data.ruleNames.get(data.ruleName);
      if (ruleName === -1) {
        data.definedas = null;
        data.errors.push({
          line: data.findLine(data.lines, phraseIndex, data.charsLength),
          char: phraseIndex,
          msg: `Rule name '${data.ruleName}' for incremental alternate not previously defined.`,
        });
      } else {
        data.topRule = data.rules[ruleName.index];
        data.opcodes = data.topRule.opcodes;
      }
    }
  }
  return ret;
}
function semAlternation(state, chars, phraseIndex, phraseLength, data) {
  let ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    if (data.definedas === null) {
      /* rule error - skip opcode generation */
      ret = ids.SEM_SKIP;
    } else if (data.topStack === null && data.definedas === '=/') {
      /* top-level "=/" incremental alternate - reuse existing first opcode */
      data.topStack = { alt: data.opcodes[0], cat: null };
      data.altStack.push(data.topStack);
    } else {
      /* top-level "=" new rule, or lower-level ALT */
      data.topStack = { alt: { type: ids.ALT, children: [], gl: gl, go: go }, cat: null };
      data.altStack.push(data.topStack);
      data.opcodes.push(data.topStack.alt);
    }
  } else if (state === ids.SEM_POST) {
    data.altStack.pop();
    data.topStack = data.altStack.length > 0 ? data.altStack[data.altStack.length - 1] : null;
  }
  return ret;
}
function semConcatenation(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.topStack.alt.children.push(data.opcodes.length);
    data.topStack.cat = {
      type: ids.CAT,
      children: [],
      gl: gl,
      go: go,
    };
    data.opcodes.push(data.topStack.cat);
  } else if (state === ids.SEM_POST) {
    data.topStack.cat = null;
  }
  return ret;
}
function semRepetition(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.topStack.cat.children.push(data.opcodes.length);
  }
  return ret;
}
function semOptionOpen(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.REP,
      min: 0,
      max: 1,
      char: phraseIndex,
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semRuleName(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.ruleName = charsToString(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semDefined(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.definedas = '=';
  }
  return ret;
}
function semIncAlt(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.definedas = '=/';
  }
  return ret;
}
function semRepOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.min = 0;
    data.max = Infinity;
    data.topRep = {
      type: ids.REP,
      min: 0,
      max: Infinity,
      gl: gl,
      go: go,
    };
    data.opcodes.push(data.topRep);
  } else if (state === ids.SEM_POST) {
    if (data.min > data.max) {
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: `repetition min cannot be greater than max: min: ${data.min}: max: ${data.max}`,
      });
    }
    if (data.max === 0) {
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: `repetition max cannot be zero (use "" to represent an empty string): min: ${data.min}: max: ${data.max}`,
      });
    }
    data.topRep.min = data.min;
    data.topRep.max = data.max;
  }
  return ret;
}
function semRepMin(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.min = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semRepMax(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.max = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semRepMinMax(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.max = decnum(chars, phraseIndex, phraseLength);
    data.min = data.max;
  }
  return ret;
}
function semAndOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.AND,
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semNotOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.NOT,
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semRnmOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.RNM,
      /* NOTE: this is temporary info, index will be replaced with integer later. */
      /* Probably not the best coding practice but here you go. */
      index: {
        phraseIndex,
        name: charsToString(chars, phraseIndex, phraseLength),
      },
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semUdtEmpty(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const name = charsToString(chars, phraseIndex, phraseLength);
    let udtName = data.udtNames.add(name);
    if (udtName === -1) {
      udtName = data.udtNames.get(name);
      if (udtName === -1) {
        throw new Error('semUdtEmpty: name look up error');
      }
    } else {
      data.udts.push({
        name: udtName.name,
        lower: udtName.lower,
        index: udtName.index,
        empty: true,
      });
    }
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.UDT,
      empty: true,
      index: udtName.index,
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semUdtNonEmpty(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const name = charsToString(chars, phraseIndex, phraseLength);
    let udtName = data.udtNames.add(name);
    if (udtName === -1) {
      udtName = data.udtNames.get(name);
      if (udtName === -1) {
        throw new Error('semUdtNonEmpty: name look up error');
      }
    } else {
      data.udts.push({
        name: udtName.name,
        lower: udtName.lower,
        index: udtName.index,
        empty: false,
      });
    }
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.UDT,
      empty: false,
      index: udtName.index,
      gl: gl,
      go: go,
      syntax: null,
      semantic: null,
    });
  }
  return ret;
}
function semTlsOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.tlscase = true; /* default to case insensitive */
  }
  return ret;
}
function semTlsCase(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    if (phraseLength > 0 && (chars[phraseIndex + 1] === 83 || chars[phraseIndex + 1] === 115)) {
      data.tlscase = false; /* set to case sensitive */
    }
  }
  return ret;
}
function semTlsString(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar - 1;
    if (data.tlscase) {
      const str = chars.slice(phraseIndex, phraseIndex + phraseLength);
      for (let i = 0; i < str.length; i += 1) {
        if (str[i] >= 65 && str[i] <= 90) {
          str[i] += 32;
        }
      }
      data.opcodes.push({
        type: ids.TLS,
        string: str,
        gl: gl,
        go: go,
      });
    } else {
      data.opcodes.push({
        type: ids.TBS,
        string: chars.slice(phraseIndex, phraseIndex + phraseLength),
        gl: gl,
        go: go,
      });
    }
  }
  return ret;
}
function semClsOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    if (phraseLength <= 2) {
      /* only TLS is allowed to be empty */
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: `case-sensitive string ('') cannot be empty - use "" to represent empty strings`,
      });
    } else {
      data.opcodes.push({
        type: ids.TBS,
        string: chars.slice(phraseIndex + 1, phraseIndex + phraseLength - 1),
        gl: gl,
        go: go,
      });
    }
  }
  return ret;
}
function semTbsOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.tbsstr = [];
  } else if (state === ids.SEM_POST) {
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.TBS,
      string: data.tbsstr,
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semTrgOp(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    data.min = 0;
    data.max = 0;
  } else if (state === ids.SEM_POST) {
    if (data.min > data.max) {
      data.errors.push({
        line: data.findLine(data.lines, phraseIndex, data.charsLength),
        char: phraseIndex,
        msg: `TRG, (%dmin-max), min cannot be greater than max: min: ${data.min}: max: ${data.max}`,
      });
    }
    const no = data.findLine(data.lines, phraseIndex, data.charsLength);
    const line = data.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    data.opcodes.push({
      type: ids.TRG,
      min: data.min,
      max: data.max,
      gl: gl,
      go: go,
    });
  }
  return ret;
}
function semDmin(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.min = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semDmax(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.max = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semBmin(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.min = binnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semBmax(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.max = binnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semXmin(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.min = hexnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semXmax(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.max = hexnum(chars, phraseIndex, phraseLength);
  }
  return ret;
}
function semDstring(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.tbsstr.push(decnum(chars, phraseIndex, phraseLength));
  }
  return ret;
}
function semBstring(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.tbsstr.push(binnum(chars, phraseIndex, phraseLength));
  }
  return ret;
}
function semXstring(state, chars, phraseIndex, phraseLength, data) {
  const ret = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    data.tbsstr.push(hexnum(chars, phraseIndex, phraseLength));
  }
  return ret;
}
// Define the callback functions to the AST object.
const callbacks = [];
callbacks.alternation = semAlternation;
callbacks.andop = semAndOp;
callbacks.bmax = semBmax;
callbacks.bmin = semBmin;
callbacks.bstring = semBstring;
callbacks.clsop = semClsOp;
callbacks.concatenation = semConcatenation;
callbacks.defined = semDefined;
callbacks.dmax = semDmax;
callbacks.dmin = semDmin;
callbacks.dstring = semDstring;
callbacks.file = semFile;
callbacks.incalt = semIncAlt;
callbacks.notop = semNotOp;
callbacks.optionopen = semOptionOpen;
callbacks['rep-max'] = semRepMax;
callbacks['rep-min'] = semRepMin;
callbacks['rep-min-max'] = semRepMinMax;
callbacks.repetition = semRepetition;
callbacks.repop = semRepOp;
callbacks.rnmop = semRnmOp;
callbacks.rule = semRule;
callbacks.rulelookup = semRuleLookup;
callbacks.rulename = semRuleName;
callbacks.tbsop = semTbsOp;
callbacks.tlscase = semTlsCase;
callbacks.tlsstring = semTlsString;
callbacks.tlsop = semTlsOp;
callbacks.trgop = semTrgOp;
callbacks['udt-empty'] = semUdtEmpty;
callbacks['udt-non-empty'] = semUdtNonEmpty;
callbacks.xmax = semXmax;
callbacks.xmin = semXmin;
callbacks.xstring = semXstring;
export { callbacks };
