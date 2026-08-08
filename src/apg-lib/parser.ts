/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module parser
 * The core APG parser. Walks the opcode parse tree generated from an SABNF grammar
 * and matches phrases from the input string. Contains the implementation of all SABNF operators.
 * Attach optional helpers (AST, Stats, Trace) before calling {@link Parser#parse}.
 */
import id from './identifiers.js';
import type {
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
} from './types.js';

const THIS_FILE = 'parser.js: ';
// Validate the callback function's returned sysData values.
// It's the user's responsibility to get them right
// but `RNM` fails if not.
function validateRnmCallbackResult(rule: GrammarRule, sysData: SysData, charsLeft: number, down: boolean): void {
  if (sysData.phraseLength > charsLeft) {
    let str = `${THIS_FILE}opRNM(${rule.name}): callback function error: `;
    str += `sysData.phraseLength: ${sysData.phraseLength}`;
    str += ` must be <= remaining chars: ${charsLeft}`;
    throw new Error(str);
  }
  switch (sysData.state) {
    case id.ACTIVE:
      if (down !== true) {
        throw new Error(`${THIS_FILE}opRNM(${rule.name}): callback function return error. ACTIVE state not allowed.`);
      }
      break;
    case id.EMPTY:
      sysData.phraseLength = 0;
      break;
    case id.MATCH:
      if (sysData.phraseLength === 0) {
        sysData.state = id.EMPTY;
      }
      break;
    case id.NOMATCH:
      sysData.phraseLength = 0;
      break;
    default:
      throw new Error(
        `${THIS_FILE}opRNM(${rule.name}): callback function return error. Unrecognized return state: ${sysData.state}`,
      );
  }
}

// Validate the callback function's returned sysData values.
// It's the user's responsibility to get it right but `UDT` fails if not.
function validateUdtCallbackResult(udt: GrammarUdt, sysData: SysData, charsLeft: number): void {
  if (sysData.phraseLength > charsLeft) {
    let str = `${THIS_FILE}opUDT(${udt.name}): callback function error: `;
    str += `sysData.phraseLength: ${sysData.phraseLength}`;
    str += ` must be <= remaining chars: ${charsLeft}`;
    throw new Error(str);
  }
  switch (sysData.state) {
    case id.ACTIVE:
      throw new Error(`${THIS_FILE}opUDT(${udt.name}): callback function return error. ACTIVE state not allowed.`);
    case id.EMPTY:
      if (udt.empty === false) {
        throw new Error(`${THIS_FILE}opUDT(${udt.name}): callback function return error. May not return EMPTY.`);
      } else {
        sysData.phraseLength = 0;
      }
      break;
    case id.MATCH:
      if (sysData.phraseLength === 0) {
        if (udt.empty === false) {
          throw new Error(`${THIS_FILE}opUDT(${udt.name}): callback function return error. May not return EMPTY.`);
        } else {
          sysData.state = id.EMPTY;
        }
      }
      break;
    case id.NOMATCH:
      sysData.phraseLength = 0;
      break;
    default:
      throw new Error(
        `${THIS_FILE}opUDT(${udt.name}): callback function return error. Unrecognized return state: ${sysData.state}`,
      );
  }
}

/**
 * The core APG parser. Instantiate with a grammar object (produced by the APG generator)
 * then call {@link Parser#parse} to match an input string against the grammar.
 */
export default class Parser {
  private _rules: GrammarRule[];
  private _udts: GrammarUdt[];
  private _sabnfLines: string[];
  private _ruleCallbacks: Array<ParserCallback | null>;
  private _udtCallbacks: Array<ParserCallback | null>;
  private _ast: AstLike | null;
  private _stats: StatsLike | null;
  private _trace: TraceLike | null;
  private _traceSabnf: TraceSabnfLike | null;
  private _limitTreeDepth: number;
  private _limitNodeHits: number;
  private _opcodes: GrammarOpcode[] | null;
  private _chars: number[];
  private _lookAhead: number;
  private _treeDepth: number;
  private _maxTreeDepth: number;
  private _nodeHits: number;
  private _userData: unknown;
  private _maxMatched: number;

  constructor(grammar: GrammarObject) {
    if (grammar?.grammarObject !== 'grammarObject') {
      throw new Error(`${THIS_FILE}invalid grammar object`);
    }
    this._rules = grammar.rules;
    this._udts = grammar.udts;
    this._sabnfLines = grammar.toString().split(/\r\n|\r|\n/);
    this._ruleCallbacks = Array(this._rules.length).fill(null);
    this._udtCallbacks = Array(this._udts.length).fill(null);
    this._ast = null;
    this._stats = null;
    this._trace = null;
    this._traceSabnf = null;
    this._limitTreeDepth = Infinity;
    this._limitNodeHits = Infinity;
    /* ---- clear() variables --- */
    this._opcodes = [];
    this._chars = [];
    this._lookAhead = 0;
    this._treeDepth = 0;
    this._maxTreeDepth = 0;
    this._nodeHits = 0;
    this._userData = undefined;
    this._maxMatched = 0;
  }
  private _getOpcode(opIndex: number): GrammarOpcode {
    const opcodes = this._opcodes;
    if (!opcodes) {
      throw new Error(`${THIS_FILE}opcode list not initialized`);
    }
    const op = opcodes[opIndex];
    if (!op) {
      throw new Error(`${THIS_FILE}invalid opcode index: ${opIndex}`);
    }
    return op;
  }

  _clear(): void {
    this._opcodes = [];
    this._chars = [];
    this._lookAhead = 0;
    this._treeDepth = 0;
    this._maxTreeDepth = 0;
    this._nodeHits = 0;
    this._userData = undefined;
    this._maxMatched = 0;
  }

  /* called by parse() to initialize the array of characters codes representing the input string */
  _initializeInputChars(input: string | number[] | Uint8Array | Uint16Array | Uint32Array): void {
    /* verify and normalize input */
    if (typeof input === 'string') {
      this._chars = Array.from(input).map((ch) => ch.codePointAt(0) ?? 0);
    } else if (input instanceof Uint8Array || input instanceof Uint16Array || input instanceof Uint32Array) {
      this._chars = Array.from(input);
    } else if (Array.isArray(input)) {
      this._chars = input.slice();
    } else {
      throw new Error(`${THIS_FILE}input source is not a Buffer, Uint8Array, Uint16Array, Uint32Array or string`);
    }
  }
  /* called by parse() to initialize the start rule */
  _initializeStartRule(startRule: string | number): { index: number; line: number } {
    let rule;
    if (typeof startRule === 'number') {
      if (!Number.isInteger(startRule) || startRule < 0) {
        throw new Error(`${THIS_FILE}start rule index must be a non-negative integer: ${startRule}`);
      }
      if (startRule >= this._rules.length) {
        throw new Error(`${THIS_FILE}start rule index too large: max: ${this._rules.length}: index: ${startRule}`);
      }
      rule = this._rules[startRule];
    } else if (typeof startRule === 'string') {
      const lower = startRule.toLowerCase();
      rule = this._rules.find((r) => r.lower === lower);
      if (!rule) {
        throw new Error(`${THIS_FILE}start rule name '${startRule}' not recognized`);
      }
    } else {
      throw new Error(`${THIS_FILE}type of start rule '${typeof startRule}' not recognized`);
    }
    const line = this._sabnfLines.findIndex((l) => l.toLowerCase().startsWith(rule.lower));
    return { index: rule.index, line: line < 0 ? 0 : line };
  }

  _validateUdts(): void {
    /* make sure all udts have been defined - the parser can't work without them */
    const undef = this._udts.filter((_, i) => this._udtCallbacks[i] === null).map((u) => u.name);
    if (undef.length > 0) {
      throw new Error(`${THIS_FILE}all UDT callback functions must be defined, missing:\n${undef.join('\n')}`);
    }
  }

  /**
   * Resets all rule and UDT callback functions to `null`.
   */
  clearCallbacks(): void {
    this._ruleCallbacks = Array(this._rules.length).fill(null);
    this._udtCallbacks = Array(this._udts.length).fill(null);
  }
  /**
   * Registers a callback function for a named rule or UDT.
   * @param name - The rule or UDT name (case-insensitive).
   * @param fn - The callback function invoked when the parser visits that node.
   */
  setCallback(name: string, fn: ParserCallback): void {
    if (typeof name !== 'string' || typeof fn !== 'function') {
      throw new Error(`${THIS_FILE}setCallback: name must be a string and fn must be a function`);
    }
    const lower = name.toLowerCase();
    const udt = this._udts.find((u) => u.lower === lower);
    if (udt) {
      this._udtCallbacks[udt.index] = fn;
      return;
    }
    const rule = this._rules.find((r) => r.lower === lower);
    if (rule) {
      this._ruleCallbacks[rule.index] = fn;
      return;
    }
    throw new Error(`${THIS_FILE}setCallback: '${name}' is not a recognized rule or UDT name`);
  }

  /**
   * Attaches a {@link Trace} object to record parse tree traversal.
   * Pass `null` to detach.
   * @param trace - A `Trace` instance or `null`.
   */
  setTrace(trace: TraceLike | null): void {
    if (!trace) {
      this._trace = null;
    } else if (trace.traceObject === 'traceObject') {
      this._trace = trace;
    } else {
      throw new Error(`${THIS_FILE}trace object not recognized`);
    }
  }
  /**
   * Attaches a {@link TraceSabnf} object to record grammar-annotated parse trace.
   * Pass `null` to detach.
   * @param trace - A `TraceSabnf` instance or `null`.
   */
  setTraceSabnf(trace: TraceSabnfLike | null): void {
    if (!trace) {
      this._traceSabnf = null;
    } else if (trace.traceSabnfObject === 'traceSabnfObject') {
      this._traceSabnf = trace;
    } else {
      throw new Error(`${THIS_FILE}traceSabnf object not recognized`);
    }
  }
  /**
   * Attaches an {@link Ast} object to build an Abstract Syntax Tree during parsing.
   * Pass `null` to detach.
   * @param ast - An `Ast` instance or `null`.
   */
  setAst(ast: AstLike | null): void {
    if (!ast) {
      this._ast = null;
    } else if (ast.astObject === 'astObject') {
      this._ast = ast;
    } else {
      throw new Error(`${THIS_FILE}ast object not recognized`);
    }
  }

  /**
   * Attaches a {@link Stats} object to collect operator statistics during parsing.
   * Pass `null` to detach.
   * @param stats - A `Stats` instance or `null`.
   */
  setStats(stats: StatsLike | null): void {
    if (!stats) {
      this._stats = null;
    } else if (stats.statsObject === 'statsObject') {
      this._stats = stats;
    } else {
      throw new Error(`${THIS_FILE}stats object not recognized`);
    }
  }

  /**
   * Sets the maximum parse tree depth allowed. Throws if the limit is exceeded during parsing.
   * @param depth - Maximum depth (integer > 0). Default is `Infinity`.
   */
  setMaxTreeDepth(depth: number): void {
    this._limitTreeDepth = Math.floor(depth);
    if (!(this._limitTreeDepth > 0)) {
      throw new Error(`parser: max tree depth must be integer > 0: ${depth}`);
    }
  }

  /**
   * Sets the maximum number of opcode executions (node hits) allowed per parse.
   * Throws if the limit is exceeded during parsing.
   * @param hits - Maximum node hits (integer > 0). Default is `Infinity`.
   */
  setMaxNodeHits(hits: number): void {
    this._limitNodeHits = Math.floor(hits);
    if (!(this._limitNodeHits > 0)) {
      throw new Error(`parser: max node hits must be integer > 0: ${hits}`);
    }
  }

  /**
   * Parses an input string against the grammar starting at the specified rule.
   * @param startRule - The start rule name (string) or index (number).
   * @param inputChars - The input to parse.
   * @param callbackData - Optional user data passed through to all callback functions.
   * @returns Parse result object.
   */
  parse(
    startRule: string | number,
    inputChars: string | number[] | Uint8Array | Uint16Array | Uint32Array,
    callbackData?: unknown,
  ): ParseResult {
    this._clear();
    const { index: start, line } = this._initializeStartRule(startRule);
    this._validateUdts();
    this._initializeInputChars(inputChars);
    if (this._trace?.init) {
      this._trace.init(this._rules, this._udts, this._chars);
    }
    if (this._traceSabnf?.init) {
      this._traceSabnf.init(this._sabnfLines, this._chars);
    }
    if (this._stats?.init) {
      this._stats.init(this._rules, this._udts);
    }
    if (this._ast?.init) {
      this._ast.init(this._chars);
    }
    const sysData: SysData = {
      state: id.ACTIVE,
      phraseLength: 0,
      ruleIndex: 0,
      udtIndex: 0,
      lookAhead: this._lookAhead,
    };
    this._userData = callbackData || undefined;
    /* create a dummy opcode for the start rule */
    this._opcodes = [
      {
        type: id.RNM,
        index: start,
        gl: line,
        go: 0,
      },
    ];
    /* execute the start rule */
    this._opExecute(0, 0, sysData);
    this._opcodes = null;
    /* test and return the sysData */
    let success;
    switch (sysData.state) {
      case id.ACTIVE:
        throw new Error(`${THIS_FILE}final state should never be 'ACTIVE'`);
      case id.NOMATCH:
        success = false;
        break;
      case id.EMPTY:
      case id.MATCH:
        success = sysData.phraseLength === this._chars.length;
        break;
      default:
        throw new Error('unrecognized state');
    }
    return {
      success,
      state: sysData.state,
      length: this._chars.length,
      matched: sysData.phraseLength,
      maxMatched: this._maxMatched,
      maxTreeDepth: this._maxTreeDepth,
      nodeHits: this._nodeHits,
    };
  }

  // The `ALT` operator.
  // Executes its child nodes, from left to right, until it finds a match.
  // Fails if *all* of its child nodes fail.
  _opALT(opIndex: number, phraseIndex: number, sysData: SysData): void {
    const op = this._getOpcode(opIndex);
    const children = op.children ?? [];
    for (let i = 0; i < children.length; i += 1) {
      this._opExecute(children[i], phraseIndex, sysData);
      if (sysData.state !== id.NOMATCH) {
        break;
      }
    }
  }

  // The `CAT` operator.
  // Executes all of its child nodes, from left to right,
  // concatenating the matched phrases.
  // Fails if *any* child nodes fail.
  _opCAT(opIndex: number, phraseIndex: number, sysData: SysData): void {
    let astLength: number | undefined;
    const op = this._getOpcode(opIndex);
    const children = op.children ?? [];
    if (this._ast) {
      astLength = this._ast.getLength();
    }
    let catCharIndex = phraseIndex;
    let catPhrase = 0;
    let success = true;
    for (let i = 0; i < children.length; i += 1) {
      this._opExecute(children[i], catCharIndex, sysData);
      if (sysData.state === id.NOMATCH) {
        success = false;
        break;
      } else {
        catCharIndex += sysData.phraseLength;
        catPhrase += sysData.phraseLength;
      }
    }
    if (success) {
      sysData.state = catPhrase === 0 ? id.EMPTY : id.MATCH;
      sysData.phraseLength = catPhrase;
    } else {
      sysData.state = id.NOMATCH;
      sysData.phraseLength = 0;
      if (this._ast) {
        this._ast.setLength?.(astLength);
      }
    }
  }

  // The `REP` operator.
  // Repeatedly executes its single child node,
  // concatenating each of the matched phrases found.
  // The number of repetitions executed and its final sysData depends
  // on its `min` & `max` repetition values.
  _opREP(opIndex: number, phraseIndex: number, sysData: SysData): void {
    const op = this._getOpcode(opIndex);
    const min = op.min ?? 0;
    const max = op.max ?? 0;
    let repCharIndex = phraseIndex;
    let repPhrase = 0;
    let repCount = 0;
    const astLength = this._ast ? this._ast.getLength() : undefined;
    while (repCharIndex < this._chars.length && repCount !== max) {
      this._opExecute(opIndex + 1, repCharIndex, sysData);
      if (sysData.state === id.NOMATCH || sysData.state === id.EMPTY) {
        break;
      }
      repCount += 1;
      repPhrase += sysData.phraseLength;
      repCharIndex += sysData.phraseLength;
    }
    /* evaluate the match count according to the min, max values */
    if (sysData.state === id.EMPTY || repCount >= min) {
      sysData.state = repPhrase === 0 ? id.EMPTY : id.MATCH;
      sysData.phraseLength = repPhrase;
    } else {
      sysData.state = id.NOMATCH;
      sysData.phraseLength = 0;
      if (this._ast) {
        this._ast.setLength?.(astLength);
      }
    }
  }

  // The `RNM` operator.
  // This operator acts as a root node for a parse tree branch below and
  // returns the matched phrase to its parent.
  // It handles user-defined callback functions and `AST` nodes.
  // Note that the `AST` is a separate object, but `RNM` calls its functions to create its nodes.
  // See [`ast.js`](./ast.html) for usage.
  _opRNM(opIndex: number, phraseIndex: number, sysData: SysData): void {
    let astLength: number | undefined;
    let astDefined = false;
    let savedOpcodes: GrammarOpcode[] | null = null;
    const op = this._getOpcode(opIndex);
    const ruleIndex = op.index ?? -1;
    if (ruleIndex < 0 || ruleIndex >= this._rules.length) {
      throw new Error(`${THIS_FILE}invalid rule reference: ${ruleIndex}`);
    }
    const rule = this._rules[ruleIndex];
    const callback = this._ruleCallbacks[rule.index];
    /* ignore AST in look ahead */
    if (this._lookAhead === 0) {
      astDefined =
        this._ast !== null && typeof this._ast.ruleDefined === 'function' && this._ast.ruleDefined(ruleIndex);
      if (astDefined && this._ast) {
        astLength = this._ast.getLength();
        this._ast.down?.(ruleIndex, rule.name);
      }
    }
    if (callback === null) {
      /* no callback - just execute the rule */
      savedOpcodes = this._opcodes;
      this._opcodes = rule.opcodes ?? [];
      this._opExecute(0, phraseIndex, sysData);
      this._opcodes = savedOpcodes;
    } else {
      /* call user's callback */
      const charsLeft = this._chars.length - phraseIndex;
      sysData.ruleIndex = rule.index;
      callback(sysData, this._chars, phraseIndex, this._userData);
      validateRnmCallbackResult(rule, sysData, charsLeft, true);
      if (sysData.state === id.ACTIVE) {
        savedOpcodes = this._opcodes;
        this._opcodes = rule.opcodes ?? [];
        this._opExecute(0, phraseIndex, sysData);
        this._opcodes = savedOpcodes;
        sysData.ruleIndex = rule.index;
        callback(sysData, this._chars, phraseIndex, this._userData);
        validateRnmCallbackResult(rule, sysData, charsLeft, false);
      } /* implied else clause: just accept the callback sysData - RNM acting as UDT */
    }
    if (this._lookAhead === 0 && astDefined && this._ast) {
      if (sysData.state === id.NOMATCH) {
        this._ast.setLength?.(astLength);
      } else {
        this._ast.up?.(ruleIndex, rule.name, phraseIndex, sysData.phraseLength);
      }
    }
  }

  // The `UDT` operator.
  // Simply calls the user's callback function, but operates like `RNM` with regard to the `AST`.
  // `UDT`s act as terminals for phrase recognition but as named rules for `AST` nodes.
  // See [`ast.js`](./ast.html) for usage.
  _opUDT(opIndex: number, phraseIndex: number, sysData: SysData): void {
    let astLength: number | undefined;
    let astIndex: number | undefined;
    let astDefined = false;
    const op = this._getOpcode(opIndex);
    const udtIndex = op.index ?? -1;
    if (udtIndex < 0 || udtIndex >= this._udts.length) {
      throw new Error(`${THIS_FILE}invalid UDT reference: ${udtIndex}`);
    }
    const udt = this._udts[udtIndex];
    sysData.udtIndex = udt.index;
    /* ignore AST in look ahead */
    if (this._lookAhead === 0) {
      astDefined = this._ast !== null && typeof this._ast.udtDefined === 'function' && this._ast.udtDefined(udtIndex);
      if (astDefined && this._ast) {
        astIndex = this._rules.length + udtIndex;
        astLength = this._ast.getLength();
        this._ast.down?.(astIndex, udt.name);
      }
    }
    /* call the UDT */
    const charsLeft = this._chars.length - phraseIndex;
    const callback = this._udtCallbacks[udtIndex];
    if (!callback) {
      throw new Error(`${THIS_FILE}missing UDT callback for ${udt.name}`);
    }
    callback(sysData, this._chars, phraseIndex, this._userData);
    validateUdtCallbackResult(udt, sysData, charsLeft);
    if (this._lookAhead === 0 && astDefined && this._ast && astIndex !== undefined) {
      if (sysData.state === id.NOMATCH) {
        this._ast.setLength?.(astLength);
      } else {
        this._ast.up?.(astIndex, udt.name, phraseIndex, sysData.phraseLength);
      }
    }
  }

  // The `AND` operator.
  // This is the positive `look ahead` operator.
  // Executes its single child node, returning the EMPTY state
  // if it succeeds and NOMATCH if it fails.
  // *Always* backtracks on any matched phrase and returns EMPTY on success.
  _opAND(opIndex: number, phraseIndex: number, sysData: SysData): void {
    this._opExecute(opIndex + 1, phraseIndex, sysData);
    sysData.phraseLength = 0;
    switch (sysData.state) {
      case id.EMPTY:
      case id.MATCH:
        sysData.state = id.EMPTY;
        break;
      case id.NOMATCH:
        sysData.state = id.NOMATCH;
        break;
      default:
        throw new Error(`opAND: invalid state ${sysData.state}`);
    }
  }

  // The `NOT` operator.
  // This is the negative `look ahead` operator.
  // Executes its single child node, returning the EMPTY state
  // if it *fails* and NOMATCH if it succeeds.
  // *Always* backtracks on any matched phrase and returns EMPTY
  // on success (failure of its child node).
  _opNOT(opIndex: number, phraseIndex: number, sysData: SysData): void {
    this._opExecute(opIndex + 1, phraseIndex, sysData);
    sysData.phraseLength = 0;
    switch (sysData.state) {
      case id.EMPTY:
      case id.MATCH:
        sysData.state = id.NOMATCH;
        break;
      case id.NOMATCH:
        sysData.state = id.EMPTY;
        break;
      default:
        throw new Error(`opNOT: invalid state ${sysData.state}`);
    }
  }

  // The `TRG` operator.
  // Succeeds if the single first character of the phrase is
  // within the `min - max` range.
  _opTRG(opIndex: number, phraseIndex: number, sysData: SysData): void {
    const op = this._getOpcode(opIndex);
    const min = op.min ?? 0;
    const max = op.max ?? 0;
    sysData.state = id.NOMATCH;
    if (phraseIndex < this._chars.length) {
      if (min <= this._chars[phraseIndex] && this._chars[phraseIndex] <= max) {
        sysData.state = id.MATCH;
        sysData.phraseLength = 1;
      }
    }
  }

  // The `TBS` operator.
  // Matches its pre-defined phrase against the input string.
  // All characters must match exactly.
  // Case-sensitive literal strings (`'string'` & `%s"string"`) are translated to `TBS`
  // operators by `apg`.
  // Phrase length of zero is not allowed.
  // Empty phrases can only be defined with `TLS` operators.
  _opTBS(opIndex: number, phraseIndex: number, sysData: SysData): void {
    const op = this._getOpcode(opIndex);
    const literal = op.string ?? [];
    const len = literal.length;
    sysData.state = id.NOMATCH;
    if (phraseIndex + len <= this._chars.length) {
      for (let i = 0; i < len; i += 1) {
        if (this._chars[phraseIndex + i] !== literal[i]) {
          return;
        }
      }
      sysData.state = id.MATCH;
      sysData.phraseLength = len;
    }
  }

  // The `TLS` operator.
  // Matches its pre-defined phrase against the input string.
  // A case-insensitive match is attempted for ASCII alphabetical characters.
  // `TLS` is the only operator that explicitly allows empty phrases.
  // `apg` will fail for empty `TBS`, case-sensitive strings (`''`) or
  // zero repetitions (`0*0RuleName` or `0RuleName`).
  _opTLS(opIndex: number, phraseIndex: number, sysData: SysData): void {
    const op = this._getOpcode(opIndex);
    const literal = op.string ?? [];
    sysData.state = id.NOMATCH;
    const len = literal.length;
    if (len === 0) {
      /* EMPTY match allowed for TLS */
      sysData.state = id.EMPTY;
      return;
    }
    if (phraseIndex + len <= this._chars.length) {
      for (let i = 0; i < len; i += 1) {
        let code = this._chars[phraseIndex + i];
        if (code >= 65 && code <= 90) {
          code += 32;
        }
        if (code !== literal[i]) {
          return;
        }
      }
      sysData.state = id.MATCH;
      sysData.phraseLength = len;
    }
  }

  // Generalized execution function.
  // Having a single, generalized function, allows a single location
  // for tracing and statistics gathering functions to be called.
  // Tracing and statistics are handled in separate objects.
  // However, the parser calls their API to build the object data records.
  // See [`trace.js`](./trace.html) and [`stats.js`](./stats.html) for their usage.
  _opExecute(opIndex: number, phraseIndex: number, sysData: SysData): void {
    const op = this._getOpcode(opIndex);
    this._nodeHits += 1;
    if (this._nodeHits > this._limitNodeHits) {
      throw new Error(`parser: maximum number of node hits exceeded: ${this._limitNodeHits}`);
    }
    this._treeDepth += 1;
    if (this._treeDepth > this._maxTreeDepth) {
      this._maxTreeDepth = this._treeDepth;
      if (this._maxTreeDepth > this._limitTreeDepth) {
        throw new Error(`parser: maximum parse tree depth exceeded: ${this._limitTreeDepth}`);
      }
    }
    sysData.state = id.ACTIVE;
    sysData.phraseLength = 0;
    if (this._trace?.down) {
      this._trace.down(op, phraseIndex, sysData.lookAhead);
    }
    if (this._traceSabnf?.down) {
      this._traceSabnf.down(op);
    }
    switch (op.type) {
      case id.ALT:
        this._opALT(opIndex, phraseIndex, sysData);
        break;
      case id.CAT:
        this._opCAT(opIndex, phraseIndex, sysData);
        break;
      case id.REP:
        this._opREP(opIndex, phraseIndex, sysData);
        break;
      case id.RNM:
        this._opRNM(opIndex, phraseIndex, sysData);
        break;
      case id.UDT:
        this._opUDT(opIndex, phraseIndex, sysData);
        break;
      case id.AND:
        this._lookAhead++;
        sysData.lookAhead = this._lookAhead;
        this._opAND(opIndex, phraseIndex, sysData);
        this._lookAhead--;
        sysData.lookAhead = this._lookAhead;
        break;
      case id.NOT:
        this._lookAhead++;
        sysData.lookAhead = this._lookAhead;
        this._opNOT(opIndex, phraseIndex, sysData);
        this._lookAhead--;
        sysData.lookAhead = this._lookAhead;
        break;
      case id.TRG:
        this._opTRG(opIndex, phraseIndex, sysData);
        break;
      case id.TBS:
        this._opTBS(opIndex, phraseIndex, sysData);
        break;
      case id.TLS:
        this._opTLS(opIndex, phraseIndex, sysData);
        break;
      default:
        throw new Error(`parser: unrecognized opcode type: ${op.type}`);
    }
    if (this._lookAhead === 0 && phraseIndex + sysData.phraseLength > this._maxMatched) {
      this._maxMatched = phraseIndex + sysData.phraseLength;
    }
    if (this._stats !== null && this._stats.collect) {
      this._stats.collect(op, sysData);
    }
    if (this._trace?.up) {
      this._trace.up(op, sysData.state, phraseIndex, sysData.phraseLength, sysData.lookAhead);
    }
    if (this._traceSabnf?.up) {
      this._traceSabnf.up(op, sysData.state, phraseIndex, sysData.phraseLength);
    }
    this._treeDepth -= 1;
  }
}
