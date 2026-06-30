/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module apg-api/parser
 * @description Converts an SABNF grammar source into a grammar object usable by `apg-lib`.
 * Runs the syntax phase (validates grammar syntax) and the semantic phase (generates opcodes).
 */
import ids from '../apg-lib/identifiers.js';
import Parser from '../apg-lib/parser.js';
import Ast from '../apg-lib/ast.js';
import { callbacks as synCallbacks } from './syntax-callbacks.js';
import { callbacks as semCallbacks } from './semantic-callbacks.js';
import SabnfGrammar from './sabnf-grammar.js';
import type { GrammarObject, GrammarOpcode, GrammarRule, GrammarUdt } from '../apg-lib/types.js';

const THIS_FILE = 'parser: ';

interface LineInfo {
  beginChar: number;
  length: number;
  lineNo: number;
}

interface SyntaxError {
  line: number;
  char: number;
  msg: string;
}

interface SyntaxData {
  errors: SyntaxError[];
  strict: boolean;
  lines: LineInfo[];
  findLine(lines: LineInfo[], charIndex: number, charLength: number): number;
  charsLength: number;
  ruleCount: number;
}

interface GrammarRuleWithOpcodes extends GrammarRule {
  opcodes: GrammarOpcode[];
}

interface SemanticData {
  errors: SyntaxError[];
  lines: LineInfo[];
  findLine(lines: LineInfo[], charIndex: number, charLength: number): number;
  charsLength: number;
  rules: GrammarRuleWithOpcodes[];
  udts: GrammarUdt[];
  rulesLineMap: Array<{ line: number; char: number }>;
}

interface SemanticResult {
  rules: GrammarRuleWithOpcodes[];
  udts: GrammarUdt[];
  lineMap: number[];
}

interface GrammarObjectWithCallbacks extends GrammarObject {
  callbacks: Record<string, boolean>;
}

/* find the line containing the given character index */
function findLine(lines: LineInfo[], charIndex: number, charLength: number): number {
  if (charIndex < 0 || charIndex >= charLength) {
    return -1;
  }
  let lo = 0;
  let hi = lines.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const line = lines[mid];
    if (charIndex < line.beginChar) {
      hi = mid - 1;
    } else if (charIndex >= line.beginChar + line.length) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

function translateIndex(map: Array<number | null>, index: number): number {
  let ret = -1;
  if (index < map.length) {
    for (let i = index; i < map.length; i += 1) {
      if (map[i] !== null) {
        ret = map[i] as number;
        break;
      }
    }
  }
  return ret;
}

/* helper function when removing redundant opcodes */
function reduceOpcodes(rules: GrammarRuleWithOpcodes[]): void {
  rules.forEach((rule) => {
    const opcodes: GrammarOpcode[] = [];
    const map: Array<number | null> = [];
    let reducedIndex = 0;
    rule.opcodes.forEach((op) => {
      if (op.type === ids.ALT && op.children && op.children.length === 1) {
        map.push(null);
      } else if (op.type === ids.CAT && op.children && op.children.length === 1) {
        map.push(null);
      } else if (op.type === ids.REP && op.min === 1 && op.max === 1) {
        map.push(null);
      } else {
        map.push(reducedIndex);
        opcodes.push(op);
        reducedIndex += 1;
      }
    });
    map.push(reducedIndex);
    /* translate original opcode indexes to the reduced set. */
    opcodes.forEach((op) => {
      if (op.type === ids.ALT || op.type === ids.CAT) {
        const children = op.children;
        if (children) {
          for (let i = 0; i < children.length; i += 1) {
            children[i] = translateIndex(map, children[i]);
          }
        }
      }
    });
    rule.opcodes = opcodes;
  });
}

/**
 * Internal parser used by the APG API to process SABNF grammar source.
 * Performs the syntax phase (parse tree construction) and the semantic phase (opcode generation),
 * then generates JavaScript grammar object source or an in-memory grammar object.
 */
export default class SabnfParser {
  private _sabnfGrammar: GrammarObject;
  private _parser: Parser;
  private _ast: Ast;

  constructor() {
    this._sabnfGrammar = new SabnfGrammar();
    this._parser = new Parser(this._sabnfGrammar);
    this._ast = new Ast(this._sabnfGrammar);
    this._parser.setAst(this._ast);
    if (synCallbacks && typeof synCallbacks === 'object') {
      Object.keys(synCallbacks).forEach((name) => {
        this._parser.setCallback(name, synCallbacks[name]);
      });
    }
    if (semCallbacks && typeof semCallbacks === 'object') {
      Object.keys(semCallbacks).forEach((name) => {
        this._ast.setCallback(name, semCallbacks[name]);
      });
    }
  }
  /* Parse the grammar - the syntax phase. */
  /* SABNF grammar syntax errors are caught and reported here. */
  /**
   * Runs the syntax phase: parses the grammar character array and reports syntax errors.
   * @param chars - Array of integer character codes for the grammar source.
   * @param lines - Line descriptor array from the scanner.
   * @param errors - Array to which error objects are appended.
   * @param strict - If `true`, restrict to RFC 5234/7405 ABNF only.
   */
  syntax(chars: number[], lines: LineInfo[], errors: SyntaxError[], strict?: boolean): void {
    const data: SyntaxData = {
      errors,
      strict: !!strict,
      lines,
      findLine,
      charsLength: chars.length,
      ruleCount: 0,
    };
    data.errors = errors;
    data.strict = !!strict;
    data.lines = lines;
    data.findLine = findLine;
    data.charsLength = chars.length;
    data.ruleCount = 0;
    try {
      const result = this._parser.parse('file', chars, data);
      if (!result.success) {
        errors.push({
          line: 0,
          char: 0,
          msg: 'syntax analysis of input grammar failed',
        });
      }
    } catch (e) {
      if (e instanceof Error) {
        errors.push({ line: 0, char: 0, msg: `syntax analysis exception: ${e.message}` });
      } else {
        errors.push({ line: 0, char: 0, msg: `syntax analysis exception: ${String(e)}` });
      }
    }
  }

  /* Parse the grammar - the semantic phase, translates the AST. */
  /* SABNF grammar syntax errors are caught and reported here. */
  /**
   * Runs the semantic phase: translates the AST into rule and UDT opcode arrays.
   * @param chars - Array of integer character codes for the grammar source.
   * @param lines - Line descriptor array from the scanner.
   * @param errors - Array to which error objects are appended.
   * @returns Opcode data, or `null` on error.
   */
  semantic(chars: number[], lines: LineInfo[], errors: SyntaxError[]): SemanticResult | null {
    const data: SemanticData = {
      errors,
      lines,
      findLine,
      charsLength: chars.length,
      rules: [],
      udts: [],
      rulesLineMap: [],
    };
    try {
      this._ast.translate(data);
      if (errors.length) {
        return null;
      }
    } catch (e) {
      if (e instanceof Error) {
        errors.push({ line: 0, char: 0, msg: `semantic analysis exception: ${e.message}` });
      } else {
        errors.push({ line: 0, char: 0, msg: `semantic analysis exception: ${String(e)}` });
      }
      return null;
    }
    /* Remove unneeded operators. */
    /* ALT operators with a single alternate */
    /* CAT operators with a single phrase to concatenate */
    /* REP(1,1) operators (`1*1RuleName` or `1RuleName` is the same as just `RuleName`.) */
    reduceOpcodes(data.rules);
    return {
      rules: data.rules,
      udts: data.udts,
      lineMap: [],
    };
  }
  /**
   * Generates the JavaScript source code string for a grammar object constructor.
   * The resulting string can be written to a `.js` file and imported as a grammar.
   * @param chars - Array of integer character codes for the grammar source.
   * @param lines - Line descriptor array from the scanner.
   * @param rules - Array of rule objects with opcode arrays.
   * @param udts - Array of UDT objects.
   * @returns JavaScript source code for the grammar object constructor.
   */
  generateSource(
    chars: number[],
    lines: LineInfo[],
    rules: GrammarRuleWithOpcodes[],
    udts: GrammarUdt[],
    typescript?: boolean,
  ): string {
    let source = '';
    let i: number;
    let opcodeCount = 0;
    let charCodeMin = Infinity;
    let charCodeMax = 0;
    const ruleNames: string[] = [];
    const udtNames: string[] = [];
    let alt = 0;
    let cat = 0;
    let rnm = 0;
    let udt = 0;
    let rep = 0;
    let and = 0;
    let not = 0;
    let tls = 0;
    let tbs = 0;
    let trg = 0;
    rules.forEach((rule) => {
      ruleNames.push(rule.lower);
      opcodeCount += rule.opcodes.length;
      rule.opcodes.forEach((op) => {
        switch (op.type) {
          case ids.ALT:
            alt += 1;
            break;
          case ids.CAT:
            cat += 1;
            break;
          case ids.RNM:
            rnm += 1;
            break;
          case ids.UDT:
            udt += 1;
            break;
          case ids.REP:
            rep += 1;
            break;
          case ids.AND:
            and += 1;
            break;
          case ids.NOT:
            not += 1;
            break;
          case ids.TLS:
            tls += 1;
            for (i = 0; i < (op.string ?? []).length; i += 1) {
              const code = op.string?.[i] ?? 0;
              if (code < charCodeMin) {
                charCodeMin = code;
              }
              if (code > charCodeMax) {
                charCodeMax = code;
              }
            }
            break;
          case ids.TBS:
            tbs += 1;
            for (i = 0; i < (op.string ?? []).length; i += 1) {
              const code = op.string?.[i] ?? 0;
              if (code < charCodeMin) {
                charCodeMin = code;
              }
              if (code > charCodeMax) {
                charCodeMax = code;
              }
            }
            break;
          case ids.TRG:
            trg += 1;
            const min = op.min ?? 0;
            const max = op.max ?? 0;
            if (min < charCodeMin) {
              charCodeMin = min;
            }
            if (max > charCodeMax) {
              charCodeMax = max;
            }
            break;
          default:
            throw new Error('generateSource: unrecognized opcode');
        }
      });
    });
    ruleNames.sort();
    if (udts.length > 0) {
      udts.forEach((udtFunc) => {
        udtNames.push(udtFunc.lower);
      });
      udtNames.sort();
    }
    source += '// copyright: Copyright (c) 2026 Lowell D. Thomas\n';
    source += '//   license: MIT (https://opensource.org/license/MIT)\n';
    source += '//\n';
    source += '// Generated by apg-esm, Version 1.1.0\n';
    if (typescript) {
      source += 'interface GrammarOpcode {\n';
      source += '  type: number;\n';
      source += '  gl: number;\n';
      source += '  go: number;\n';
      source += '  index?: number;\n';
      source += '  children?: number[];\n';
      source += '  min?: number;\n';
      source += '  max?: number;\n';
      source += '  string?: number[];\n';
      source += '  empty?: boolean;\n';
      source += '}\n';
      source += '\n';
      source += 'interface GrammarRule {\n';
      source += '  name: string;\n';
      source += '  lower: string;\n';
      source += '  index: number;\n';
      source += '  opcodes?: GrammarOpcode[];\n';
      source += '}\n';
      source += '\n';
      source += 'interface GrammarUdt {\n';
      source += '  name: string;\n';
      source += '  lower: string;\n';
      source += '  index: number;\n';
      source += '  empty: boolean;\n';
      source += '}\n';
      source += '\n';
      source += 'interface GrammarObject {\n';
      source += '  grammarObject: string;\n';
      source += '  rules: GrammarRule[]\n';
      source += '  udts: GrammarUdt[];\n';
      source += '  toString(): string;\n';
      source += '}\n';
      source += '\n';
      source += 'export default class grammar implements GrammarObject{\n';
      source += '  grammarObject: string;\n';
      source += '  rules: GrammarRule[];\n';
      source += '  udts: GrammarUdt[];\n';
      source += '\n';
      source += '  constructor() {\n';
    } else {
      source += 'export default class grammar {\n';
      source += '  constructor() {\n';
    }
    source += '    // ```\n';
    source += '    // SUMMARY\n';
    source += `    //      rules = ${rules.length}\n`;
    source += `    //       udts = ${udts.length}\n`;
    source += `    //    opcodes = ${opcodeCount}\n`;
    source += '    //        ---   ABNF original opcodes\n';
    source += `    //        ALT = ${alt}\n`;
    source += `    //        CAT = ${cat}\n`;
    source += `    //        REP = ${rep}\n`;
    source += `    //        RNM = ${rnm}\n`;
    source += `    //        TLS = ${tls}\n`;
    source += `    //        TBS = ${tbs}\n`;
    source += `    //        TRG = ${trg}\n`;
    source += '    //        ---   SABNF superset opcodes\n';
    source += `    //        UDT = ${udt}\n`;
    source += `    //        AND = ${and}\n`;
    source += `    //        NOT = ${not}\n`;
    source += '    // characters = [';
    if (tls + tbs + trg === 0) {
      source += ' none defined ]';
    } else {
      source += `${charCodeMin} - ${charCodeMax}]`;
    }
    if (udt > 0) {
      source += ' + user defined';
    }
    source += '\n';
    source += '    // ```\n';
    source += '    /* OBJECT IDENTIFIER (magic number for internal parser use) */\n';
    source += "    this.grammarObject = 'grammarObject';\n";
    source += '\n';
    source += '    /* RULES */\n';
    source += '    this.rules = [];\n';
    rules.forEach((rule, ii) => {
      let thisRule = '    this.rules[';
      thisRule += ii;
      thisRule += "] = { name: '";
      thisRule += rule.name;
      thisRule += "', lower: '";
      thisRule += rule.lower;
      thisRule += "', index: ";
      thisRule += rule.index;
      thisRule += ' };\n';
      source += thisRule;
    });
    source += '\n';
    source += '    /* UDTS */\n';
    source += '    this.udts = [];\n';
    if (udts.length > 0) {
      udts.forEach((udtFunc, ii) => {
        let thisUdt = '    this.udts[';
        thisUdt += ii;
        thisUdt += "] = { name: '";
        thisUdt += udtFunc.name;
        thisUdt += "', lower: '";
        thisUdt += udtFunc.lower;
        thisUdt += "', index: ";
        thisUdt += udtFunc.index;
        thisUdt += ', empty: ';
        thisUdt += udtFunc.empty;
        thisUdt += ' };\n';
        source += thisUdt;
      });
    }
    source += '\n';
    source += '    /* OPCODES */\n';
    rules.forEach((rule, ruleIndex) => {
      if (ruleIndex > 0) {
        source += '\n';
      }
      source += `    /* ${rule.name} */\n`;
      source += `    this.rules[${ruleIndex}].opcodes = [];\n`;
      rule.opcodes.forEach((op, opIndex) => {
        let prefix;
        switch (op.type) {
          case ids.ALT:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, children: [${(op.children ?? []).toString()}], gl: ${op.gl}, go: ${op.go} };// ALT\n`;
            break;
          case ids.CAT:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, children: [${(op.children ?? []).toString()}], gl: ${op.gl}, go: ${op.go} };// CAT\n`;
            break;
          case ids.RNM:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, index: ${op.index ?? -1}, gl: ${
              op.gl
            }, go: ${op.go} };// RNM(${rules[op.index ?? -1]?.name ?? 'unknown'})\n`;
            break;
          case ids.UDT:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, empty: ${
              op.empty
            }, index: ${op.index ?? -1}, gl: ${op.gl}, go: ${op.go} };// UDT(${udts[op.index ?? -1]?.name ?? 'unknown'})\n`;
            break;
          case ids.REP:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, min: ${op.min ?? 0}, max: ${op.max ?? 0}, gl: ${op.gl}, go: ${op.go} };// REP\n`;
            break;
          case ids.AND:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, gl: ${op.gl}, go: ${op.go} };// AND\n`;
            break;
          case ids.NOT:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, gl: ${op.gl}, go: ${op.go} };// NOT\n`;
            break;
          case ids.TLS:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, string: [${(op.string ?? []).toString()}], gl: ${op.gl}, go: ${op.go} };// TLS\n`;
            break;
          case ids.TBS:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, string: [${(op.string ?? []).toString()}], gl: ${op.gl}, go: ${op.go} };// TBS\n`;
            break;
          case ids.TRG:
            source += `    this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, min: ${op.min ?? 0}, max: ${op.max ?? 0}, gl: ${op.gl}, go: ${op.go} };// TRG\n`;
            break;
          default:
            throw new Error('generateSource: unrecognized opcode');
        }
      });
    });
    source += '  }\n';
    source += '  // The `toString()` member will display the original grammar file(s) that produced these opcodes.\n';
    if (typescript) {
      source += '  toString(): string {\n';
    } else {
      source += '  toString() {\n';
    }
    source += '    let str = "";\n';
    let str = '';
    lines.forEach((line) => {
      const end = line.beginChar + line.length;
      str = '';
      source += '      str += "';
      for (let ii = line.beginChar; ii < end; ii += 1) {
        switch (chars[ii]) {
          case 9:
            str = ' ';
            break;
          case 10:
            str = '\\n';
            break;
          case 13:
            str = '\\r';
            break;
          case 34:
            str = '\\"';
            break;
          case 92:
            str = '\\\\';
            break;
          default:
            str = String.fromCharCode(chars[ii]);
            break;
        }
        source += str;
      }
      source += '";\n';
    });
    source += '    return str;\n';
    source += '  }\n';
    source += '}\n';
    return source;
  }

  /**
   * Generates an in-memory grammar object equivalent to instantiating
   * the constructor function returned by `generateSource()`.
   * Initializes all rule and UDT callbacks to `false`.
   * @param stringArg - The original grammar source string. Stored and returned by `toString()`.
   * @param rules - Array of rule objects with opcode arrays, as produced by `semantic()`.
   * @param udts - Array of UDT objects, as produced by `semantic()`.
   * @returns Grammar object with `grammarObject`, `callbacks`, `rules`, `udts`, and `toString()`.
   */
  generateObject(stringArg: string, rules: GrammarRuleWithOpcodes[], udts: GrammarUdt[]): GrammarObjectWithCallbacks {
    const obj: GrammarObjectWithCallbacks = {
      grammarObject: 'grammarObject',
      callbacks: {},
      rules,
      udts,
      toString() {
        return stringArg;
      },
    };
    const ruleNames: string[] = [];
    const udtNames: string[] = [];
    const string = stringArg.slice(0);
    rules.forEach((rule) => {
      ruleNames.push(rule.lower);
    });
    ruleNames.sort();
    if (udts.length > 0) {
      udts.forEach((udtFunc) => {
        udtNames.push(udtFunc.lower);
      });
      udtNames.sort();
    }
    obj.callbacks = {};
    ruleNames.forEach((name) => {
      obj.callbacks[name] = false;
    });
    if (udts.length > 0) {
      udtNames.forEach((name) => {
        obj.callbacks[name] = false;
      });
    }
    obj.rules = rules;
    obj.udts = udts;
    obj.toString = function toStringFunc() {
      return string;
    };
    return obj;
  }
}
