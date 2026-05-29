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

const THIS_FILE = 'parser: ';

/* find the line containing the given character index */
function findLine(lines, charIndex, charLength) {
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

function translateIndex(map, index) {
  let ret = -1;
  if (index < map.length) {
    for (let i = index; i < map.length; i += 1) {
      if (map[i] !== null) {
        ret = map[i];
        break;
      }
    }
  }
  return ret;
}

/* helper function when removing redundant opcodes */
function reduceOpcodes(rules) {
  rules.forEach((rule) => {
    const opcodes = [];
    const map = [];
    let reducedIndex = 0;
    rule.opcodes.forEach((op) => {
      if (op.type === ids.ALT && op.children.length === 1) {
        map.push(null);
      } else if (op.type === ids.CAT && op.children.length === 1) {
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
        for (let i = 0; i < op.children.length; i += 1) {
          op.children[i] = translateIndex(map, op.children[i]);
        }
      }
    });
    rule.opcodes = opcodes;
  });
}

/**
 * @class SabnfParser
 * @description Internal parser used by the APG API to process SABNF grammar source.
 * Performs the syntax phase (parse tree construction) and the semantic phase (opcode generation),
 * then generates JavaScript grammar object source or an in-memory grammar object.
 */
export default class SabnfParser {
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
   * @method syntax
   * @description Runs the syntax phase: parses the grammar character array and reports syntax errors.
   * @param {number[]} chars - Array of integer character codes for the grammar source.
   * @param {Object[]} lines - Line descriptor array from the scanner.
   * @param {Object[]} errors - Array to which error objects are appended.
   * @param {boolean} [strict] - If `true`, restrict to RFC 5234/7405 ABNF only.
   * @param {Trace} [trace] - Optional parser `Trace` object.
   */
  syntax(chars, lines, errors, strict, trace) {
    if (trace) {
      this._parser.setTrace(trace);
    }
    const data = {};
    data.errors = errors;
    data.strict = !!strict;
    data.lines = lines;
    data.findLine = findLine;
    data.charsLength = chars.length;
    data.ruleCount = 0;
    const result = this._parser.parse('file', chars, data);
    if (!result.success) {
      errors.push({
        line: 0,
        char: 0,
        msg: 'syntax analysis of input grammar failed',
      });
    }
  }

  /* Parse the grammar - the semantic phase, translates the AST. */
  /* SABNF grammar syntax errors are caught and reported here. */
  /**
   * @method semantic
   * @description Runs the semantic phase: translates the AST into rule and UDT opcode arrays.
   * @param {number[]} chars - Array of integer character codes for the grammar source.
   * @param {Object[]} lines - Line descriptor array from the scanner.
   * @param {Object[]} errors - Array to which error objects are appended.
   * @returns {{ rules: Object[], udts: Object[], lineMap: number[] }|null} Opcode data, or `null` on error.
   */
  semantic(chars, lines, errors) {
    const data = {};
    data.errors = errors;
    data.lines = lines;
    data.findLine = findLine;
    data.charsLength = chars.length;
    this._ast.translate(data);
    if (errors.length) {
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
      lineMap: data.rulesLineMap,
    };
  }
  /**
   * @method generateSource
   * @description Generates the JavaScript source code string for a grammar object constructor.
   * The resulting string can be written to a `.js` file and imported as a grammar.
   * @param {number[]} chars - Array of integer character codes for the grammar source.
   * @param {Object[]} lines - Line descriptor array from the scanner.
   * @param {Object[]} rules - Array of rule objects with opcode arrays.
   * @param {Object[]} udts - Array of UDT objects.
   * @returns {string} JavaScript source code for the grammar object constructor.
   */
  generateSource(chars, lines, rules, udts) {
    let source = '';
    let i;
    let opcodeCount = 0;
    let charCodeMin = Infinity;
    let charCodeMax = 0;
    const ruleNames = [];
    const udtNames = [];
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
            for (i = 0; i < op.string.length; i += 1) {
              if (op.string[i] < charCodeMin) {
                charCodeMin = op.string[i];
              }
              if (op.string[i] > charCodeMax) {
                charCodeMax = op.string[i];
              }
            }
            break;
          case ids.TBS:
            tbs += 1;
            for (i = 0; i < op.string.length; i += 1) {
              if (op.string[i] < charCodeMin) {
                charCodeMin = op.string[i];
              }
              if (op.string[i] > charCodeMax) {
                charCodeMax = op.string[i];
              }
            }
            break;
          case ids.TRG:
            trg += 1;
            if (op.min < charCodeMin) {
              charCodeMin = op.min;
            }
            if (op.max > charCodeMax) {
              charCodeMax = op.max;
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
    source += '// copyright: Copyright (c) 2026 Lowell D. Thomas<br>\n';
    source += '//   license: MIT (https://opensource.org/license/MIT)<br>\n';
    source += '//\n';
    source += '// Generated by apg-esm, Version 1.0.0\n';
    source += 'export default function grammar(){\n';
    source += '  // ```\n';
    source += '  // SUMMARY\n';
    source += `  //      rules = ${rules.length}\n`;
    source += `  //       udts = ${udts.length}\n`;
    source += `  //    opcodes = ${opcodeCount}\n`;
    source += '  //        ---   ABNF original opcodes\n';
    source += `  //        ALT = ${alt}\n`;
    source += `  //        CAT = ${cat}\n`;
    source += `  //        REP = ${rep}\n`;
    source += `  //        RNM = ${rnm}\n`;
    source += `  //        TLS = ${tls}\n`;
    source += `  //        TBS = ${tbs}\n`;
    source += `  //        TRG = ${trg}\n`;
    source += '  //        ---   SABNF superset opcodes\n';
    source += `  //        UDT = ${udt}\n`;
    source += `  //        AND = ${and}\n`;
    source += `  //        NOT = ${not}\n`;
    source += '  // characters = [';
    if (tls + tbs + trg === 0) {
      source += ' none defined ]';
    } else {
      source += `${charCodeMin} - ${charCodeMax}]`;
    }
    if (udt > 0) {
      source += ' + user defined';
    }
    source += '\n';
    source += '  // ```\n';
    source += '  /* OBJECT IDENTIFIER (magic number for internal parser use) */\n';
    source += "  this.grammarObject = 'grammarObject';\n";
    source += '\n';
    source += '  /* RULES */\n';
    source += '  this.rules = [];\n';
    rules.forEach((rule, ii) => {
      let thisRule = '  this.rules[';
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
    source += '  /* UDTS */\n';
    source += '  this.udts = [];\n';
    if (udts.length > 0) {
      udts.forEach((udtFunc, ii) => {
        let thisUdt = '  this.udts[';
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
    source += '  /* OPCODES */\n';
    rules.forEach((rule, ruleIndex) => {
      if (ruleIndex > 0) {
        source += '\n';
      }
      source += `  /* ${rule.name} */\n`;
      source += `  this.rules[${ruleIndex}].opcodes = [];\n`;
      rule.opcodes.forEach((op, opIndex) => {
        let prefix;
        switch (op.type) {
          case ids.ALT:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, children: [${op.children.toString()}], gl: ${op.gl}, go: ${op.go} };// ALT\n`;
            break;
          case ids.CAT:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, children: [${op.children.toString()}], gl: ${op.gl}, go: ${op.go} };// CAT\n`;
            break;
          case ids.RNM:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, index: ${op.index}, gl: ${
              op.gl
            }, go: ${op.go} };// RNM(${rules[op.index].name})\n`;
            break;
          case ids.UDT:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, empty: ${
              op.empty
            }, index: ${op.index}, gl: ${op.gl}, go: ${op.go} };// UDT(${udts[op.index].name})\n`;
            break;
          case ids.REP:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, min: ${op.min}, max: ${op.max}, gl: ${op.gl}, go: ${op.go} };// REP\n`;
            break;
          case ids.AND:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, gl: ${op.gl}, go: ${op.go} };// AND\n`;
            break;
          case ids.NOT:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, gl: ${op.gl}, go: ${op.go} };// NOT\n`;
            break;
          case ids.TLS:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, string: [${op.string.toString()}], gl: ${op.gl}, go: ${op.go} };// TLS\n`;
            break;
          case ids.TBS:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${
              op.type
            }, string: [${op.string.toString()}], gl: ${op.gl}, go: ${op.go} };// TBS\n`;
            break;
          case ids.TRG:
            source += `  this.rules[${ruleIndex}].opcodes[${opIndex}] = { type: ${op.type}, min: ${op.min}, max: ${op.max}, gl: ${op.gl}, go: ${op.go} };// TRG\n`;
            break;
          default:
            throw new Error('parser.js: ~143: unrecognized opcode');
        }
      });
    });
    source += '\n';
    source += '  // The `toString()` function will display the original grammar file(s) that produced these opcodes.\n';
    source += '  this.toString = function toString(){\n';
    source += '    let str = "";\n';
    let str;
    lines.forEach((line) => {
      const end = line.beginChar + line.length;
      str = '';
      source += '    str += "';
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
   * @method generateObject
   * @description Generates an in-memory grammar object equivalent to instantiating
   * the constructor function returned by `generateSource()`.
   * Initializes all rule and UDT callbacks to `false`.
   * @param {string} stringArg - The original grammar source string. Stored and returned by `toString()`.
   * @param {Object[]} rules - Array of rule objects with opcode arrays, as produced by `semantic()`.
   * @param {Object[]} udts - Array of UDT objects, as produced by `semantic()`.
   * @returns {Object} Grammar object with `grammarObject`, `callbacks`, `rules`, `udts`, and `toString()`.
   */
  generateObject(stringArg, rules, udts) {
    const obj = {};
    const ruleNames = [];
    const udtNames = [];
    const string = stringArg.slice(0);
    obj.grammarObject = 'grammarObject';
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
    obj.callbacks = [];
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
