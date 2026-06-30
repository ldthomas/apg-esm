/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import apg from './apg/apg.js';
import Api from './apg-api/api.js';
import Parser from './apg-lib/parser.js';
import Ast from './apg-lib/ast.js';
import Stats from './apg-lib/stats.js';
import Trace from './apg-lib/trace.js';
import TraceSabnf from './apg-lib/traceSabnf.js';
import ids from './apg-lib/identifiers.js';
import * as utils from './apg-lib/utilities.js';
import type {
  AstCallback,
  AstLike,
  GrammarObject,
  GrammarOpcode,
  GrammarRule,
  GrammarUdt,
  ParseResult,
  ParserCallback,
  StatsLike,
  SysData,
  TraceLike,
  TraceSabnfLike,
} from './apg-lib/types.js';
import type { GrammarError, GrammarObjectWithCallbacks, LineInfo, RuleWithOpcodes } from './apg-api/api.js';

export type {
  AstCallback,
  AstLike,
  GrammarError,
  GrammarObject,
  GrammarObjectWithCallbacks,
  GrammarOpcode,
  GrammarRule,
  GrammarUdt,
  LineInfo,
  ParseResult,
  ParserCallback,
  RuleWithOpcodes,
  StatsLike,
  SysData,
  TraceLike,
  TraceSabnfLike,
};
export { apg, Api, Parser, Ast, Stats, Trace, TraceSabnf, ids, utils };
export default { apg, Api, Parser, Ast, Stats, Trace, TraceSabnf, ids, utils };
