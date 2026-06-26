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
import type { AstCallback, GrammarUdt } from '../apg-lib/types.js';

interface NameRecord {
  name: string;
  lower: string;
  index: number;
}

interface SemanticOpcode {
  type: number;
  gl: number;
  go: number;
  children: number[];
  char?: number;
  syntax?: unknown;
  semantic?: unknown;
  index?: number | { phraseIndex: number; name: string };
  min?: number;
  max?: number;
  string?: number[];
  empty?: boolean;
}

interface SemanticRule {
  name: string;
  lower: string;
  index: number;
  opcodes: SemanticOpcode[];
}

interface SemanticStackEntry {
  alt: SemanticOpcode;
  cat: SemanticOpcode | null;
}

interface SemanticData {
  ruleNames: NameList;
  udtNames: NameList;
  rules: SemanticRule[];
  udts: GrammarUdt[];
  rulesLineMap: Array<{ line: number; char: number }>;
  opcodes: SemanticOpcode[];
  altStack: SemanticStackEntry[];
  topStack: SemanticStackEntry | null;
  topRule: SemanticRule | null;
  topRep: SemanticOpcode | null;
  ruleName: string;
  definedas: string | null;
  errors: Array<{ line: number; char: number; msg: string }>;
  findLine(
    lines: Array<{ beginChar: number; length: number; lineNo: number }>,
    charIndex: number,
    charLength: number,
  ): number;
  charsLength: number;
  lines: Array<{ beginChar: number; length: number; lineNo: number }>;
  tlscase: boolean;
  tbsstr: number[];
  min: number;
  max: number;
}

class NameList {
  names: NameRecord[];

  constructor() {
    this.names = [];
  }

  add(name: string): NameRecord | -1 {
    const find = this.get(name);
    if (find !== -1) {
      return -1;
    }

    const record: NameRecord = {
      name,
      lower: name.toLowerCase(),
      index: this.names.length,
    };
    this.names.push(record);
    return record;
  }

  get(name: string): NameRecord | -1 {
    const lower = name.toLowerCase();
    for (let i = 0; i < this.names.length; i += 1) {
      if (this.names[i].lower === lower) {
        return this.names[i];
      }
    }
    return -1;
  }
}

function decnum(chars: number[], beg: number, len: number): number {
  let num = 0;
  for (let i = beg; i < beg + len; i += 1) {
    num = 10 * num + chars[i] - 48;
  }
  return num;
}

function binnum(chars: number[], beg: number, len: number): number {
  let num = 0;
  for (let i = beg; i < beg + len; i += 1) {
    num = 2 * num + chars[i] - 48;
  }
  return num;
}

function hexnum(chars: number[], beg: number, len: number): number {
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

const semFile: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.ruleNames = new NameList();
    d.udtNames = new NameList();
    d.rules = [];
    d.udts = [];
    d.rulesLineMap = [];
    d.opcodes = [];
    d.altStack = [];
    d.topStack = null;
    d.topRule = null;
    d.topRep = null;
  } else if (state === ids.SEM_POST) {
    d.rules.forEach((rule) => {
      rule.opcodes.forEach((op) => {
        if (op.type === ids.RNM) {
          const ruleRef = op.index;
          if (typeof ruleRef === 'object' && ruleRef !== null) {
            const nameObj = d.ruleNames.get(ruleRef.name);
            if (nameObj === -1) {
              d.errors.push({
                line: d.findLine(d.lines, ruleRef.phraseIndex, d.charsLength),
                char: ruleRef.phraseIndex,
                msg: `Rule name '${ruleRef.name}' used but not defined.`,
              });
              op.index = -1;
            } else {
              op.index = nameObj.index;
            }
          }
        }
      });
    });
  }
  return ret;
};

const semRule: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.altStack.length = 0;
    d.topStack = null;
    d.rulesLineMap.push({
      line: d.findLine(d.lines, phraseIndex, d.charsLength),
      char: phraseIndex,
    });
  }
  return ret;
};

const semRuleLookup: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.ruleName = '';
    d.definedas = '';
  } else if (state === ids.SEM_POST) {
    if (d.definedas === '=') {
      const ruleName = d.ruleNames.add(d.ruleName);
      if (ruleName === -1) {
        d.definedas = null;
        d.errors.push({
          line: d.findLine(d.lines, phraseIndex, d.charsLength),
          char: phraseIndex,
          msg: `Rule name '${d.ruleName}' previously defined.`,
        });
      } else {
        d.topRule = {
          name: ruleName.name,
          lower: ruleName.lower,
          opcodes: [],
          index: ruleName.index,
        };
        d.rules.push(d.topRule);
        d.opcodes = d.topRule.opcodes;
      }
    } else {
      const ruleName = d.ruleNames.get(d.ruleName);
      if (ruleName === -1) {
        d.definedas = null;
        d.errors.push({
          line: d.findLine(d.lines, phraseIndex, d.charsLength),
          char: phraseIndex,
          msg: `Rule name '${d.ruleName}' for incremental alternate not previously defined.`,
        });
      } else {
        const existingRule = d.rules[ruleName.index];
        if (existingRule) {
          d.topRule = existingRule;
          d.opcodes = d.topRule.opcodes;
        }
      }
    }
  }
  return ret;
};

const semAlternation: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    if (d.definedas === null) {
      ret = ids.SEM_SKIP;
    } else if (d.topStack === null && d.definedas === '=/') {
      const firstOpcode = d.opcodes[0];
      if (firstOpcode) {
        d.topStack = { alt: firstOpcode, cat: null };
      } else {
        d.topStack = { alt: { type: ids.ALT, children: [], gl, go }, cat: null };
        d.opcodes.push(d.topStack.alt);
      }
      d.altStack.push(d.topStack);
    } else {
      d.topStack = { alt: { type: ids.ALT, children: [], gl, go }, cat: null };
      d.altStack.push(d.topStack);
      d.opcodes.push(d.topStack.alt);
    }
  } else if (state === ids.SEM_POST) {
    d.altStack.pop();
    d.topStack = d.altStack.length > 0 ? d.altStack[d.altStack.length - 1] : null;
  }
  return ret;
};

const semConcatenation: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE && d.topStack) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.topStack.alt.children.push(d.opcodes.length);
    d.topStack.cat = {
      type: ids.CAT,
      children: [],
      gl,
      go,
    };
    d.opcodes.push(d.topStack.cat);
  } else if (state === ids.SEM_POST && d.topStack) {
    d.topStack.cat = null;
  }
  return ret;
};

const semRepetition: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE && d.topStack?.cat) {
    d.topStack.cat.children.push(d.opcodes.length);
  }
  return ret;
};

const semOptionOpen: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.REP,
      min: 0,
      max: 1,
      char: phraseIndex,
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semRuleName: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.ruleName = charsToString(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semDefined: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.definedas = '=';
  }
  return ret;
};

const semIncAlt: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.definedas = '=/';
  }
  return ret;
};

const semRepOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.min = 0;
    d.max = Infinity;
    d.topRep = {
      type: ids.REP,
      min: 0,
      max: Infinity,
      children: [],
      gl,
      go,
    };
    d.opcodes.push(d.topRep);
  } else if (state === ids.SEM_POST) {
    if (d.min > d.max) {
      d.errors.push({
        line: d.findLine(d.lines, phraseIndex, d.charsLength),
        char: phraseIndex,
        msg: `repetition min cannot be greater than max: min: ${d.min}: max: ${d.max}`,
      });
    }
    if (d.max === 0) {
      d.errors.push({
        line: d.findLine(d.lines, phraseIndex, d.charsLength),
        char: phraseIndex,
        msg: `repetition max cannot be zero (use "" to represent an empty string): min: ${d.min}: max: ${d.max}`,
      });
    }
    if (d.topRep) {
      d.topRep.min = d.min;
      d.topRep.max = d.max;
    }
  }
  return ret;
};

const semRepMin: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.min = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semRepMax: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.max = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semRepMinMax: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.max = decnum(chars, phraseIndex, phraseLength);
    d.min = d.max;
  }
  return ret;
};

const semAndOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.AND,
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semNotOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.NOT,
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semRnmOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.RNM,
      index: {
        phraseIndex,
        name: charsToString(chars, phraseIndex, phraseLength),
      },
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semUdtEmpty: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const name = charsToString(chars, phraseIndex, phraseLength);
    let udtName = d.udtNames.add(name);
    if (udtName === -1) {
      d.errors.push({
        line: d.findLine(d.lines, phraseIndex, d.charsLength),
        char: phraseIndex,
        msg: `Empty UDT name name '${name}' previously defined.`,
      });
      udtName = d.udtNames.get(name);
      if (udtName === -1) {
        throw new Error('semUdtEmpty: name look up error');
      }
    } else {
      d.udts.push({
        name: udtName.name,
        lower: udtName.lower,
        index: udtName.index,
        empty: true,
      });
    }
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.UDT,
      empty: true,
      index: udtName.index,
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semUdtNonEmpty: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const name = charsToString(chars, phraseIndex, phraseLength);
    let udtName = d.udtNames.add(name);
    if (udtName === -1) {
      d.errors.push({
        line: d.findLine(d.lines, phraseIndex, d.charsLength),
        char: phraseIndex,
        msg: `Non-empty UDT name name '${name}' previously defined.`,
      });
      udtName = d.udtNames.get(name);
      if (udtName === -1) {
        throw new Error('semUdtNonEmpty: name look up error');
      }
    } else {
      d.udts.push({
        name: udtName.name,
        lower: udtName.lower,
        index: udtName.index,
        empty: false,
      });
    }
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.UDT,
      empty: false,
      index: udtName.index,
      children: [],
      gl,
      go,
      syntax: null,
      semantic: null,
    });
  }
  return ret;
};

const semTlsOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.tlscase = true;
  }
  return ret;
};

const semTlsCase: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    if (phraseLength > 0 && (chars[phraseIndex + 1] === 83 || chars[phraseIndex + 1] === 115)) {
      d.tlscase = false;
    }
  }
  return ret;
};

const semTlsString: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar - 1;
    if (d.tlscase) {
      const str = chars.slice(phraseIndex, phraseIndex + phraseLength);
      for (let i = 0; i < str.length; i += 1) {
        if (str[i] >= 65 && str[i] <= 90) {
          str[i] += 32;
        }
      }
      d.opcodes.push({
        type: ids.TLS,
        string: str,
        children: [],
        gl,
        go,
      });
    } else {
      d.opcodes.push({
        type: ids.TBS,
        string: chars.slice(phraseIndex, phraseIndex + phraseLength),
        children: [],
        gl,
        go,
      });
    }
  }
  return ret;
};

const semClsOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    if (phraseLength <= 2) {
      d.errors.push({
        line: d.findLine(d.lines, phraseIndex, d.charsLength),
        char: phraseIndex,
        msg: `case-sensitive string ('') cannot be empty - use "" to represent empty strings`,
      });
    } else {
      d.opcodes.push({
        type: ids.TBS,
        string: chars.slice(phraseIndex + 1, phraseIndex + phraseLength - 1),
        children: [],
        gl,
        go,
      });
    }
  }
  return ret;
};

const semTbsOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.tbsstr = [];
  } else if (state === ids.SEM_POST) {
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.TBS,
      string: d.tbsstr,
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semTrgOp: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_PRE) {
    d.min = 0;
    d.max = 0;
  } else if (state === ids.SEM_POST) {
    if (d.min > d.max) {
      d.errors.push({
        line: d.findLine(d.lines, phraseIndex, d.charsLength),
        char: phraseIndex,
        msg: `TRG, (%dmin-max), min cannot be greater than max: min: ${d.min}: max: ${d.max}`,
      });
    }
    const no = d.findLine(d.lines, phraseIndex, d.charsLength);
    const line = d.lines[no];
    const gl = line.lineNo;
    const go = phraseIndex - line.beginChar;
    d.opcodes.push({
      type: ids.TRG,
      min: d.min,
      max: d.max,
      children: [],
      gl,
      go,
    });
  }
  return ret;
};

const semDmin: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.min = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semDmax: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.max = decnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semBmin: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.min = binnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semBmax: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.max = binnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semXmin: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.min = hexnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semXmax: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.max = hexnum(chars, phraseIndex, phraseLength);
  }
  return ret;
};

const semDstring: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.tbsstr.push(decnum(chars, phraseIndex, phraseLength));
  }
  return ret;
};

const semBstring: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.tbsstr.push(binnum(chars, phraseIndex, phraseLength));
  }
  return ret;
};

const semXstring: AstCallback = (state, chars, phraseIndex, phraseLength, data): number | undefined => {
  const d = data as SemanticData;
  let ret: number | undefined = ids.SEM_OK;
  if (state === ids.SEM_POST) {
    d.tbsstr.push(hexnum(chars, phraseIndex, phraseLength));
  }
  return ret;
};

const callbacks: Record<string, AstCallback> = {};
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
