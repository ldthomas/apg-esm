/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
import apg from './src/apg/apg.js';
import ast from './src/apg-lib/ast.js';
import ids from './src/apg-lib/identifiers.js';
import parser from './src/apg-lib/parser.js';
import stats from './src/apg-lib/stats.js';
import trace from './src/apg-lib/trace.js';
import * as utils from './src/apg-lib/utilities.js';
import apgApi from './src/apg-api/api.js';

const apgLib = { ast, ids, parser, stats, trace, utils };

export { apg, apgLib, apgApi };
export default { apg, apgLib, apgApi };
