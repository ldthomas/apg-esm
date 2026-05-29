/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module show-rules
 * @description Formats and returns a list of all rule and UDT names defined in a grammar.
 */
const THIS_FILE = 'show-rules.js';
/**
 * @function showRules
 * @description Returns a formatted list of all rule and UDT names defined in the grammar.
 * @param {Object[]} [rulesIn=[]] - Array of rule objects produced by the API translator.
 * @param {Object[]} [udtsIn=[]] - Array of UDT objects produced by the API translator.
 * @param {string} [order='index'] - Sort order: `'index'`/`'i'` for definition order,
 *   `'alpha'`/`'a'` for alphabetical order.
 * @returns {string} Formatted multi-line string listing all rule and UDT names.
 */
function showRules(rulesIn = [], udtsIn = [], order = 'index') {
  const thisFuncName = 'showRules';
  let alphaArray = [];
  let udtAlphaArray = [];
  const indexArray = [];
  const udtIndexArray = [];
  const rules = rulesIn;
  const udts = udtsIn;
  const ruleCount = rulesIn.length;
  const udtCount = udtsIn.length;
  let str = 'RULE/UDT NAMES';
  let i;
  function compRulesAlpha(left, right) {
    if (rules[left].lower < rules[right].lower) {
      return -1;
    }
    if (rules[left].lower > rules[right].lower) {
      return 1;
    }
    return 0;
  }
  function compUdtsAlpha(left, right) {
    if (udts[left].lower < udts[right].lower) {
      return -1;
    }
    if (udts[left].lower > udts[right].lower) {
      return 1;
    }
    return 0;
  }
  if (!(Array.isArray(rulesIn) && rulesIn.length)) {
    throw new Error(`${THIS_FILE}:${thisFuncName}: rules arg must be array with length > 0`);
  }
  if (!Array.isArray(udtsIn)) {
    throw new Error(`${THIS_FILE}:${thisFuncName}: udts arg must be array`);
  }

  for (i = 0; i < ruleCount; i += 1) {
    indexArray.push(i);
  }
  alphaArray = indexArray.slice(0);
  alphaArray.sort(compRulesAlpha);
  if (udtCount) {
    for (i = 0; i < udtCount; i += 1) {
      udtIndexArray.push(i);
    }
    udtAlphaArray = udtIndexArray.slice(0);
    udtAlphaArray.sort(compUdtsAlpha);
  }
  if (order.charCodeAt(0) === 97) {
    str += ' - alphabetical by rule/UDT name\n';
    for (i = 0; i < ruleCount; i += 1) {
      str += `${i}: ${alphaArray[i]}: ${rules[alphaArray[i]].name}\n`;
    }
    if (udtCount) {
      for (i = 0; i < udtCount; i += 1) {
        str += `${i}: ${udtAlphaArray[i]}: ${udts[udtAlphaArray[i]].name}\n`;
      }
    }
  } else {
    str += ' - ordered by rule/UDT index\n';
    for (i = 0; i < ruleCount; i += 1) {
      str += `${i}: ${rules[i].name}\n`;
    }
    if (udtCount) {
      for (i = 0; i < udtCount; i += 1) {
        str += `${i}: ${udts[i].name}\n`;
      }
    }
  }
  return str;
}
export default showRules;
