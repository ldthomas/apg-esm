/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module rule-dependencies
 * Determines rule dependencies and types for grammar analysis.
 * For each rule, identifies which rules it refers to, which rules refer back to it,
 * and classifies rules as non-recursive (N), recursive (R), or mutually-recursive (MR).
 */
import id from '../apg-lib/identifiers.js';
import type { GrammarOpcode, GrammarRule, GrammarUdt } from '../apg-lib/types.js';

interface RuleDependencyInfo {
  rule: GrammarRule;
  recursiveType: number;
  groupNumber: number;
  refersTo: boolean[];
  refersToUdt: boolean[];
  referencedBy: boolean[];
}

interface RuleDependencyState {
  rules: GrammarRule[];
  udts: GrammarUdt[];
  ruleCount: number;
  udtCount: number;
  dependenciesComplete: boolean;
  isMutuallyRecursive: boolean;
  ruleIndexes: number[];
  ruleAlphaIndexes: number[];
  ruleTypeIndexes: number[];
  udtIndexes: number[];
  udtAlphaIndexes: number[];
  ruleDeps: RuleDependencyInfo[];
  falseArray(length: number): boolean[];
  falsifyArray(a: boolean[]): void;
  compRulesAlpha(left: number, right: number): number;
  compUdtsAlpha(left: number, right: number): number;
  compRulesType(left: number, right: number): number;
  compRulesGroup(left: number, right: number): number;
  typeToString(recursiveType: number): string;
}

let state: RuleDependencyState | null = null;

function scan(ruleCount: number, ruleDeps: RuleDependencyInfo[], index: number, isScanned: boolean[]): void {
  const rdi = ruleDeps[index];
  if (!rdi) {
    throw new Error(`rule-dependencies: scan: invalid rule index ${index}`);
  }
  isScanned[index] = true;
  const op: GrammarOpcode[] = rdi.rule.opcodes ?? [];
  for (let i = 0; i < op.length; i += 1) {
    const opi = op[i];
    const opIndex = opi.index ?? -1;
    if (opi.type === id.RNM) {
      rdi.refersTo[opIndex] = true;
      if (!isScanned[opIndex]) {
        scan(ruleCount, ruleDeps, opIndex, isScanned);
      }
      for (let j = 0; j < ruleCount; j += 1) {
        if (ruleDeps[opIndex]?.refersTo[j]) {
          rdi.refersTo[j] = true;
        }
      }
    } else if (opi.type === id.UDT) {
      rdi.refersToUdt[opIndex] = true;
    }
  }
}

function ruleDependencies(stateArg: RuleDependencyState): void {
  state = stateArg;
  state.dependenciesComplete = false;

  const isScanned = state.falseArray(state.ruleCount);

  for (let i = 0; i < state.ruleCount; i += 1) {
    state.falsifyArray(isScanned);
    scan(state.ruleCount, state.ruleDeps, i, isScanned);
  }

  for (let i = 0; i < state.ruleCount; i += 1) {
    for (let j = 0; j < state.ruleCount; j += 1) {
      if (i !== j && state.ruleDeps[j]?.refersTo[i]) {
        state.ruleDeps[i].referencedBy[j] = true;
      }
    }
  }

  for (let i = 0; i < state.ruleCount; i += 1) {
    state.ruleDeps[i].recursiveType = id.ATTR_N;
    if (state.ruleDeps[i].refersTo[i]) {
      state.ruleDeps[i].recursiveType = id.ATTR_R;
    }
  }

  let groupCount = -1;
  for (let i = 0; i < state.ruleCount; i += 1) {
    const rdi = state.ruleDeps[i];
    if (rdi.recursiveType === id.ATTR_R) {
      let newGroup = true;
      for (let j = 0; j < state.ruleCount; j += 1) {
        if (i !== j) {
          const rdj = state.ruleDeps[j];
          if (rdj.recursiveType === id.ATTR_R && rdi.refersTo[j] && rdj.refersTo[i]) {
            if (newGroup) {
              groupCount += 1;
              rdi.recursiveType = id.ATTR_MR;
              rdi.groupNumber = groupCount;
              newGroup = false;
            }
            rdj.recursiveType = id.ATTR_MR;
            rdj.groupNumber = groupCount;
          }
        }
      }
    }
  }
  state.isMutuallyRecursive = groupCount > -1;

  state.ruleAlphaIndexes.sort(state.compRulesAlpha);
  state.ruleTypeIndexes.sort(state.compRulesAlpha);
  state.ruleTypeIndexes.sort(state.compRulesType);
  if (state.isMutuallyRecursive) {
    state.ruleTypeIndexes.sort(state.compRulesGroup);
  }
  if (state.udtCount) {
    state.udtAlphaIndexes.sort(state.compUdtsAlpha);
  }

  state.dependenciesComplete = true;
}

function show(type: number | null = null): string {
  if (!state) {
    throw new Error('rule-dependencies: show: state not initialized');
  }
  const maxRule = state.ruleCount - 1;
  const maxUdt = state.udtCount - 1;
  const lineLength = 100;
  const toArrow = '=> ';
  const byArrow = '<= ';
  let str = '';

  let ruleIndexes = state.ruleIndexes;
  let udtIndexes = state.udtIndexes;
  if (type === 97) {
    ruleIndexes = state.ruleAlphaIndexes;
    udtIndexes = state.udtAlphaIndexes;
  } else if (type === 116) {
    ruleIndexes = state.ruleTypeIndexes;
    udtIndexes = state.udtAlphaIndexes;
  }

  for (let i = 0; i < state.ruleCount; i += 1) {
    const rdi = state.ruleDeps[ruleIndexes[i]];
    let pre = `${ruleIndexes[i]}:${state.typeToString(rdi.recursiveType)}:`;
    if (state.isMutuallyRecursive) {
      pre += rdi.groupNumber > -1 ? rdi.groupNumber : '-';
      pre += ':';
    }
    pre += ' ';
    str += `${pre + state.rules[ruleIndexes[i]].name}\n`;

    // refers-to section
    let first = true;
    let count = 0;
    let startSeg = str.length;
    str += pre;
    for (let j = 0; j < state.ruleCount; j += 1) {
      if (rdi.refersTo[ruleIndexes[j]]) {
        if (first) {
          str += toArrow;
          first = false;
        } else {
          str += ', ';
        }
        str += state.ruleDeps[ruleIndexes[j]].rule.name;
        count += 1;
      }
      if (str.length - startSeg > lineLength && j !== maxRule) {
        str += `\n${pre}${toArrow}`;
        startSeg = str.length;
      }
    }
    if (state.udtCount) {
      for (let j = 0; j < state.udtCount; j += 1) {
        if (rdi.refersToUdt[udtIndexes[j]]) {
          if (first) {
            str += toArrow;
            first = false;
          } else {
            str += ', ';
          }
          str += state.udts[udtIndexes[j]].name;
          count += 1;
        }
        if (str.length - startSeg > lineLength && j !== maxUdt) {
          str += `\n${pre}${toArrow}`;
          startSeg = str.length;
        }
      }
    }
    if (count === 0) {
      str += '=> <none>\n';
    } else {
      str += '\n';
    }

    // referenced-by section
    first = true;
    count = 0;
    startSeg = str.length;
    str += pre;
    for (let j = 0; j < state.ruleCount; j += 1) {
      if (rdi.referencedBy[ruleIndexes[j]]) {
        if (first) {
          str += byArrow;
          first = false;
        } else {
          str += ', ';
        }
        str += state.ruleDeps[ruleIndexes[j]].rule.name;
        count += 1;
      }
      if (str.length - startSeg > lineLength && j !== maxRule) {
        str += `\n${pre}${byArrow}`;
        startSeg = str.length;
      }
    }
    if (count === 0) {
      str += '<= <none>\n';
    } else {
      str += '\n';
    }
    str += '\n';
  }
  return str;
}

function showRuleDependencies(order = 'index'): string {
  let str = 'RULE DEPENDENCIES(index:type:[group number:])\n';
  str += '=> refers to rule names\n';
  str += '<= referenced by rule names\n';
  if (!state?.dependenciesComplete) {
    return str;
  }
  if (order.charCodeAt(0) === 97) {
    str += 'alphabetical by rule name\n';
    str += show(97);
  } else if (order.charCodeAt(0) === 116) {
    str += 'ordered by rule type\n';
    str += show(116);
  } else {
    str += 'ordered by rule index\n';
    str += show(null);
  }
  return str;
}

export { ruleDependencies, showRuleDependencies };
