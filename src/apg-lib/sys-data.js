/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module sys-data
 * @description Shared helper for creating the parser callback result object.
 */
import id from './identifiers.js';

/**
 * Create the shared parser result object passed through callback handlers.
 * @param {number} [lookAhead=0] The current look-ahead depth.
 * @returns {{
 *   state: number,
 *   phraseLength: number,
 *   ruleIndex: number,
 *   udtIndex: number,
 *   lookAhead: number
 * }}
 */
function createSysData(lookAhead = 0) {
  return {
    state: id.ACTIVE,
    phraseLength: 0,
    ruleIndex: 0,
    udtIndex: 0,
    lookAhead,
  };
}

export { createSysData };
