/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module identifiers
 * @description Shared named integer identifiers used across the APG parser generator and
 * generated parsers. Defines ABNF/SABNF operator type codes, parser states, AST traversal
 * directions, and rule attribute categories.
 */

export default {
  // Identifies the operator type. Used by the generator
  // to indicate operator types in the grammar object.
  // Used by the [parser](./parser.html) when interpreting the grammar object.
  /* the original ABNF operators */
  ALT: 1 /* alternation */,
  CAT: 2 /* concatenation */,
  REP: 3 /* repetition */,
  RNM: 4 /* rule name */,
  TRG: 5 /* terminal range */,
  TBS: 6 /* terminal binary string, case sensitive */,
  TLS: 7 /* terminal literal string, case insensitive */,
  /* the super set, SABNF operators */
  UDT: 11 /* user-defined terminal */,
  AND: 12 /* positive look ahead */,
  NOT: 13 /* negative look ahead */,
  // Used by the parser and the user's `RNM` and `UDT` callback functions.
  // Identifies the parser state as it traverses the parse tree nodes.
  // - *ACTIVE* - indicates the downward direction through the parse tree node.
  // - *MATCH* - indicates the upward direction and a phrase, of length \> 0, has been successfully matched
  // - *EMPTY* - indicates the upward direction and a phrase, of length = 0, has been successfully matched
  // - *NOMATCH* - indicates the upward direction and the parser failed to match any phrase at all
  ACTIVE: 100,
  MATCH: 101,
  EMPTY: 102,
  NOMATCH: 103,
  // Used by [`AST` translator](./ast.html) (semantic analysis) and the user's callback functions
  // to indicate the direction of flow through the `AST` nodes.
  // - *SEM_PRE* - indicates the downward (pre-branch) direction through the `AST` node.
  // - *SEM_POST* - indicates the upward (post-branch) direction through the `AST` node.
  SEM_PRE: 200,
  SEM_POST: 201,
  // Used by the user's callback functions to indicate to the `AST` translator (semantic analysis) how to proceed.
  // - *SEM_OK* - normal return value
  // - *SEM_SKIP* - if a callback function returns this value from the SEM_PRE state,
  // the translator will skip processing all `AST` nodes in the branch below the current node.
  // Ignored if returned from the SEM_POST state.
  SEM_OK: 300,
  SEM_SKIP: 301,
  // Used in attribute generation to distinguish the necessary attribute categories.
  // - *ATTR_N* - non-recursive
  // - *ATTR_R* - recursive
  // - *ATTR_MR* - belongs to a mutually-recursive set
  ATTR_N: 400,
  ATTR_R: 401,
  ATTR_MR: 402,
};
