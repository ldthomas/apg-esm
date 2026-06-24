/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module types
 * @description Shared TypeScript interfaces for grammar objects, parser callback state,
 * and parser helper integrations used across the APG parser runtime and consumer applications.
 */

export interface GrammarRule {
  name: string;
  lower: string;
  index: number;
  opcodes: GrammarOpcode[];
}

export interface GrammarUdt {
  name: string;
  lower: string;
  index: number;
  empty?: boolean;
}

export interface GrammarOpcode {
  type: number;
  gl: number;
  go: number;
  index?: number;
  children?: number[];
  min?: number;
  max?: number;
  string?: number[];
}

export interface GrammarObject {
  grammarObject: string;
  rules: GrammarRule[];
  udts: GrammarUdt[];
  toString(): string;
}

export interface SysData {
  state: number;
  phraseLength: number;
  ruleIndex: number;
  udtIndex: number;
  lookAhead: number;
}

export interface ParserCallback {
  (sysData: SysData, chars: number[], phraseIndex: number, userData: unknown): void;
}

export type AstCallback = (
  state: number,
  chars: number[],
  phraseIndex: number,
  phraseLength: number,
  data: unknown,
) => number | undefined;

export interface TraceLike {
  traceObject?: string;
  init?(rules: GrammarRule[], udts: GrammarUdt[], chars: number[]): void;
  down?(op: GrammarOpcode, phraseIndex: number, lookAhead: number): void;
  up?(op: GrammarOpcode, state: number, phraseIndex: number, phraseLength: number, lookAhead: number): void;
}

export interface TraceSabnfLike {
  traceSabnfObject?: string;
  init?(sabnfLines: string[], chars: number[]): void;
  down?(op: GrammarOpcode): void;
  up?(op: GrammarOpcode, state: number, phraseIndex: number, phraseLength: number): void;
}

export interface AstLike {
  astObject?: string;
  init?(chars: number[]): void;
  ruleDefined?(index: number): boolean;
  udtDefined?(index: number): boolean;
  getLength(): number;
  down?(index: number, name: string): void;
  up?(index: number, name: string, phraseIndex: number, phraseLength: number): void;
  setLength?(length: number | undefined): void;
}

export interface StatsLike {
  statsObject?: string;
  init?(rules: GrammarRule[], udts: GrammarUdt[]): void;
  collect?(op: GrammarOpcode, sysData: SysData): void;
}

export interface ParseResult {
  success: boolean;
  state: number;
  length: number;
  matched: number;
  maxMatched: number;
  maxTreeDepth: number;
  nodeHits: number;
}
