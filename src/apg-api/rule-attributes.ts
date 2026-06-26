/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module rule-attributes
 * @description Performs the heavy lifting for grammar rule attribute generation.
 * Determines left recursion, cyclic, infinite, nested, right recursion, and
 * empty-string attributes for each grammar rule.
 */
import id from '../apg-lib/identifiers.js';
import type { GrammarOpcode, GrammarRule, GrammarUdt } from '../apg-lib/types.js';

const THIS_FILE = 'rule-attributes.js';

interface AttributeInfo {
  left: boolean;
  nested: boolean;
  right: boolean;
  empty: boolean;
  finite: boolean;
  cyclic: boolean;
  leaf: boolean;
  isOpen: boolean;
  isComplete: boolean;
  rule: GrammarRule | null;
}

interface RuleDependencyInfo {
  rule: GrammarRule;
  recursiveType: number;
  groupNumber: number;
  refersTo: boolean[];
  refersToUdt: boolean[];
  referencedBy: boolean[];
}

interface RuleAttributeState {
  rules: GrammarRule[];
  udts: GrammarUdt[];
  ruleCount: number;
  udtCount: number;
  startRule: number;
  dependenciesComplete: boolean;
  attributesComplete: boolean;
  isMutuallyRecursive: boolean;
  ruleIndexes: number[];
  ruleAlphaIndexes: number[];
  ruleTypeIndexes: number[];
  udtIndexes: number[];
  udtAlphaIndexes: number[];
  attrsErrorCount: number;
  attrs: AttributeInfo[];
  attrsErrors: AttributeInfo[];
  attrsWorking: AttributeInfo[];
  ruleDeps: RuleDependencyInfo[];
  attrGen(rule?: GrammarRule): AttributeInfo;
  attrInit(attr: AttributeInfo): void;
  attrCopy(dst: AttributeInfo, src: AttributeInfo): void;
  falseArray(length: number): boolean[];
  falsifyArray(a: boolean[]): void;
  indexArray(length: number): number[];
  compRulesAlpha(left: number, right: number): number;
  compUdtsAlpha(left: number, right: number): number;
  compRulesType(left: number, right: number): number;
  compRulesGroup(left: number, right: number): number;
  typeToString(recursiveType: number): string;
}

let state: RuleAttributeState | null = null;

function isEmptyOnly(attr: AttributeInfo): boolean {
  if (attr.left || attr.nested || attr.right || attr.cyclic) {
    return false;
  }
  return attr.empty;
}

function isRecursive(attr: AttributeInfo): boolean {
  if (attr.left || attr.nested || attr.right || attr.cyclic) {
    return true;
  }
  return false;
}

function isCatNested(attrs: AttributeInfo[], count: number): boolean {
  let i = 0;
  let j = 0;
  let k = 0;
  for (i = 0; i < count; i += 1) {
    if (attrs[i].nested) {
      return true;
    }
  }
  for (i = 0; i < count; i += 1) {
    if (attrs[i].right && !attrs[i].leaf) {
      for (j = i + 1; j < count; j += 1) {
        if (!isEmptyOnly(attrs[j])) {
          return true;
        }
      }
    }
  }
  for (i = count - 1; i >= 0; i -= 1) {
    if (attrs[i].left && !attrs[i].leaf) {
      for (j = i - 1; j >= 0; j -= 1) {
        if (!isEmptyOnly(attrs[j])) {
          return true;
        }
      }
    }
  }
  for (i = 0; i < count; i += 1) {
    if (!attrs[i].empty && !isRecursive(attrs[i])) {
      for (j = i + 1; j < count; j += 1) {
        if (isRecursive(attrs[j])) {
          for (k = j + 1; k < count; k += 1) {
            if (!attrs[k].empty && !isRecursive(attrs[k])) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function isCatCyclic(attrs: AttributeInfo[], count: number): boolean {
  for (let i = 0; i < count; i += 1) {
    if (!attrs[i].cyclic) {
      return false;
    }
  }
  return true;
}

function isCatLeft(attrs: AttributeInfo[], count: number): boolean {
  for (let i = 0; i < count; i += 1) {
    if (attrs[i].left) {
      return true;
    }
    if (!attrs[i].empty) {
      return false;
    }
  }
  return false;
}

function isCatRight(attrs: AttributeInfo[], count: number): boolean {
  for (let i = count - 1; i >= 0; i -= 1) {
    if (attrs[i].right) {
      return true;
    }
    if (!attrs[i].empty) {
      return false;
    }
  }
  return false;
}

function isCatEmpty(attrs: AttributeInfo[], count: number): boolean {
  for (let i = 0; i < count; i += 1) {
    if (!attrs[i].empty) {
      return false;
    }
  }
  return true;
}

function isCatFinite(attrs: AttributeInfo[], count: number): boolean {
  for (let i = 0; i < count; i += 1) {
    if (!attrs[i].finite) {
      return false;
    }
  }
  return true;
}

function cat(stateArg: RuleAttributeState, opcodes: GrammarOpcode[], opIndex: number, iAttr: AttributeInfo): void {
  const opCat = opcodes[opIndex];
  if (!opCat || !opCat.children) {
    throw new Error(`${THIS_FILE}:invalid CAT opcode`);
  }
  const count = opCat.children.length;
  const childAttrs: AttributeInfo[] = [];
  for (let i = 0; i < count; i += 1) {
    childAttrs.push(stateArg.attrGen());
  }
  for (let i = 0; i < count; i += 1) {
    opEval(stateArg, opcodes, opCat.children[i], childAttrs[i]);
  }
  iAttr.left = isCatLeft(childAttrs, count);
  iAttr.right = isCatRight(childAttrs, count);
  iAttr.nested = isCatNested(childAttrs, count);
  iAttr.empty = isCatEmpty(childAttrs, count);
  iAttr.finite = isCatFinite(childAttrs, count);
  iAttr.cyclic = isCatCyclic(childAttrs, count);
}

function alt(stateArg: RuleAttributeState, opcodes: GrammarOpcode[], opIndex: number, iAttr: AttributeInfo): void {
  const opAlt = opcodes[opIndex];
  if (!opAlt || !opAlt.children) {
    throw new Error(`${THIS_FILE}:invalid ALT opcode`);
  }
  const count = opAlt.children.length;
  const childAttrs: AttributeInfo[] = [];
  for (let i = 0; i < count; i += 1) {
    childAttrs.push(stateArg.attrGen());
  }
  for (let i = 0; i < count; i += 1) {
    opEval(stateArg, opcodes, opAlt.children[i], childAttrs[i]);
  }

  iAttr.left = false;
  iAttr.right = false;
  iAttr.nested = false;
  iAttr.empty = false;
  iAttr.finite = false;
  iAttr.cyclic = false;
  for (let i = 0; i < count; i += 1) {
    if (childAttrs[i].left) {
      iAttr.left = true;
    }
    if (childAttrs[i].nested) {
      iAttr.nested = true;
    }
    if (childAttrs[i].right) {
      iAttr.right = true;
    }
    if (childAttrs[i].empty) {
      iAttr.empty = true;
    }
    if (childAttrs[i].finite) {
      iAttr.finite = true;
    }
    if (childAttrs[i].cyclic) {
      iAttr.cyclic = true;
    }
  }
}

function opEval(stateArg: RuleAttributeState, opcodes: GrammarOpcode[], opIndex: number, iAttr: AttributeInfo): void {
  stateArg.attrInit(iAttr);
  const opi = opcodes[opIndex];
  if (!opi) {
    throw new Error(`${THIS_FILE}:invalid opcode index ${opIndex}`);
  }
  switch (opi.type) {
    case id.ALT:
      alt(stateArg, opcodes, opIndex, iAttr);
      break;
    case id.CAT:
      cat(stateArg, opcodes, opIndex, iAttr);
      break;
    case id.REP:
      opEval(stateArg, opcodes, opIndex + 1, iAttr);
      if ((opi.min ?? 0) === 0) {
        iAttr.empty = true;
        iAttr.finite = true;
      }
      break;
    case id.RNM:
      ruleAttrsEval(stateArg, opi.index ?? -1, iAttr);
      break;
    case id.AND:
    case id.NOT:
      opEval(stateArg, opcodes, opIndex + 1, iAttr);
      iAttr.empty = true;
      break;
    case id.TLS:
      iAttr.empty = !(opi.string ?? []).length;
      iAttr.finite = true;
      iAttr.cyclic = false;
      break;
    case id.TBS:
    case id.TRG:
      iAttr.empty = false;
      iAttr.finite = true;
      iAttr.cyclic = false;
      break;
    case id.UDT:
      iAttr.empty = opi.empty ?? false;
      iAttr.finite = true;
      iAttr.cyclic = false;
      break;
    default:
      throw new Error(`unknown opcode type: ${opi}`);
  }
}

function ruleAttrsEval(stateArg: RuleAttributeState, ruleIndex: number, iAttr: AttributeInfo): void {
  const attri = stateArg.attrsWorking[ruleIndex];
  if (!attri) {
    throw new Error(`${THIS_FILE}:invalid rule index ${ruleIndex}`);
  }
  if (attri.isComplete) {
    stateArg.attrCopy(iAttr, attri);
  } else if (!attri.isOpen) {
    attri.isOpen = true;
    opEval(stateArg, attri.rule?.opcodes ?? [], 0, iAttr);
    attri.left = iAttr.left;
    attri.right = iAttr.right;
    attri.nested = iAttr.nested;
    attri.empty = iAttr.empty;
    attri.finite = iAttr.finite;
    attri.cyclic = iAttr.cyclic;
    attri.leaf = false;
    attri.isOpen = false;
    attri.isComplete = true;
  } else if (ruleIndex === stateArg.startRule) {
    iAttr.left = true;
    iAttr.right = true;
    iAttr.cyclic = true;
    iAttr.leaf = true;
  } else {
    iAttr.finite = true;
  }
}

const ruleAttributes = (stateArg: RuleAttributeState): void => {
  state = stateArg;
  const iAttr = state.attrGen();
  for (let i = 0; i < state.ruleCount; i += 1) {
    for (let j = 0; j < state.ruleCount; j += 1) {
      state.attrInit(state.attrsWorking[j]);
    }
    state.startRule = i;
    ruleAttrsEval(state, i, iAttr);
    state.attrCopy(state.attrs[i], state.attrsWorking[i]);
  }
  state.attributesComplete = true;
  for (let i = 0; i < state.ruleCount; i += 1) {
    const attri = state.attrs[i];
    if (attri.left || !attri.finite || attri.cyclic) {
      const temp = state.attrGen(attri.rule ?? undefined);
      state.attrCopy(temp, attri);
      state.attrsErrors.push(temp);
      state.attrsErrorCount += 1;
    }
  }
};

const truth = (val: boolean): string => (val ? 't' : 'f');
const tError = (val: boolean): string => (val ? 'e' : 'f');
const fError = (val: boolean): string => (val ? 't' : 'e');

const showAttr = (seq: number, index: number, attr: AttributeInfo, dep: RuleDependencyInfo): string => {
  const fmtNum = (n: number): string => (n <= 999 ? String(n).padStart(3) : String(n));
  const currentState = state;
  if (!currentState) {
    throw new Error(`${THIS_FILE}:showAttr: attributes not available`);
  }
  let str = `${fmtNum(seq)}|${fmtNum(index)}|`;
  str += `${tError(attr.left)} `;
  str += `${truth(attr.nested)} `;
  str += `${truth(attr.right)} `;
  str += `${tError(attr.cyclic)} `;
  str += `${fError(attr.finite)} `;
  str += `${truth(attr.empty)}|`;
  str += `${currentState.typeToString(dep.recursiveType)}|`;
  str += dep.recursiveType === id.ATTR_MR ? dep.groupNumber : '-';
  str += `|${attr.rule?.name ?? ''}\n`;
  return str;
};

const showHeader = (): string =>
  '(*see below for column and column entry legends)\n  S|  I|L N R C F E| T|G|rule name\n';

const showFooter = (): string => {
  let str = 'LEGEND\n';
  str += 'S - sequence number (sequential)\n';
  str += 'I - rule index (order in which rule appears in SABNF grammar)\n';
  str += 'L - left recursion (S = S "y" / "x"), f = false, e = true (error)\n';
  str += 'N - nested recursion(S = "x" S "y" / "xy"), t = true, f = false\n';
  str += 'R - right recursion(S = "y" S / "x"), t = true, f = false\n';
  str += 'C - cyclic(S = S), f = false, e = true (error)\n';
  str += 'F - finite(S = "y" S / "x") , t = true, e = false (error)\n';
  str += 'E - empty(S = "y" S / ""), t = true, f = false\n';
  str += 'T - recursive type, N=non-recursive, R=recursive, MR=mutually recursive group\n';
  str += 'G - mutually-recursive group number or "-" if N/A\n';
  return str;
};

const showAttributeErrors = (): string => {
  const currentState = state;
  if (!currentState) {
    throw new Error(`${THIS_FILE}:showAttributeErrors: attributes not available`);
  }
  let str = '';
  str += 'RULE ATTRIBUTES WITH ERRORS\n';
  str += showHeader();
  if (currentState.attrsErrorCount) {
    for (let i = 0; i < currentState.attrsErrorCount; i += 1) {
      const attri = currentState.attrsErrors[i];
      const ruleIndex = attri.rule?.index ?? -1;
      if (ruleIndex < 0 || ruleIndex >= currentState.ruleDeps.length) {
        throw new Error(`${THIS_FILE}:showAttributeErrors: invalid rule index ${ruleIndex}`);
      }
      const depi = currentState.ruleDeps[ruleIndex];
      str += showAttr(i, ruleIndex, attri, depi);
    }
  } else {
    str += '<none>\n';
  }
  str += showFooter();
  return str;
};

const show = (type?: number): string => {
  const currentState = state;
  if (!currentState) {
    throw new Error(`${THIS_FILE}:show: attributes not available`);
  }
  let str = '';
  let ruleIndexes = currentState.ruleIndexes;
  if (type === 97) {
    ruleIndexes = currentState.ruleAlphaIndexes;
  } else if (type === 116) {
    ruleIndexes = currentState.ruleTypeIndexes;
  }
  for (let i = 0; i < currentState.ruleCount; i += 1) {
    const ii = ruleIndexes[i];
    const attri = currentState.attrs[ii];
    const depi = currentState.ruleDeps[ii];
    str += showAttr(i, ii, attri, depi);
  }
  str += showFooter();
  return str;
};

const showAttributes = (order = 'index'): string => {
  const currentState = state;
  if (!currentState || !currentState.attributesComplete) {
    throw new Error(`${THIS_FILE}:showAttributes: attributes not available`);
  }
  let str = '';
  const leader = 'RULE ATTRIBUTES ';
  if (order.charCodeAt(0) === 97) {
    str += leader;
    str += '(alphabetical by rule name)\n';
    str += showHeader();
    str += show(97);
  } else if (order.charCodeAt(0) === 116) {
    str += leader;
    str += '(ordered by rule type, then alphabetically by rule name)\n';
    str += showHeader();
    str += show(116);
  } else {
    str += leader;
    str += '(ordered by rule index)\n';
    str += showHeader();
    str += show();
  }
  return str;
};

export { ruleAttributes, showAttributes, showAttributeErrors };
