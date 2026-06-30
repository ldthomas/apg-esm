/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module scanner-callbacks
 * AST translation callback functions used by the scanner
 * to analyze grammar characters and catalog line positions.
 */
import ids from '../apg-lib/identifiers.js';
import { charToHex } from '../apg-lib/utilities.js';

interface Line {
  lineNo: number;
  beginChar: number;
  length: number;
  textLength: number;
  endType: string;
  invalidChars: number;
}
interface Error {
  line: number;
  char: number;
  msg: string;
}

type LineEndType = 'none' | 'LF' | 'CR' | 'CRLF';

interface ScanData {
  lines: Line[];
  errors: Error[];
  textLength: number;
  invalidCount: number;
  endLength: number;
  endType: LineEndType;
  lineNo: number;
  strict: boolean;
}

function semFile(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    if (phraseCount === 0) {
      data.lines.push({
        lineNo: 0,
        beginChar: 0,
        length: 0,
        textLength: 0,
        endType: 'none',
        invalidChars: 0,
      });
      data.errors.push({
        line: 0,
        char: 0,
        msg: 'grammar file cannot be empty',
      });
    }
    data.textLength = 0;
    data.invalidCount = 0;
  }
  return ids.SEM_OK;
}
function semLine(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.endLength = 0;
    data.textLength = 0;
    data.invalidCount = 0;
  } else {
    data.lines.push({
      lineNo: data.lines.length,
      beginChar: phraseIndex,
      length: phraseCount,
      textLength: data.textLength,
      endType: data.endType,
      invalidChars: data.invalidCount,
    });
  }
  return ids.SEM_OK;
}
function semLineText(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.textLength = phraseCount;
  }
  return ids.SEM_OK;
}
function semLastLine(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.endLength = 0;
    data.textLength = 0;
    data.invalidCount = 0;
  } else {
    data.lines.push({
      lineNo: data.lines.length,
      beginChar: phraseIndex,
      length: phraseCount,
      textLength: phraseCount,
      endType: 'none',
      invalidChars: data.invalidCount,
    });
    if (data.strict) {
      data.errors.push({
        line: data.lineNo,
        char: phraseIndex + phraseCount,
        msg: 'no line end on last line - strict requires CRLF(\\r\\n, \\x0D\\x0A)',
      });
    } else {
      data.errors.push({
        line: data.lineNo,
        char: phraseIndex + phraseCount,
        msg: 'no line end on last line - CRLF, LF or CR required',
      });
    }
  }
  return ids.SEM_OK;
}
function semInvalid(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.errors.push({
      line: data.lineNo,
      char: phraseIndex,
      msg: `invalid character found '\\x${charToHex(chars[phraseIndex])}'`,
    });
  }
  return ids.SEM_OK;
}
function semEnd(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_POST) {
    data.lineNo += 1;
  }
  return ids.SEM_OK;
}
function semLF(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.endType = 'LF';
    if (data.strict) {
      data.errors.push({
        line: data.lineNo,
        char: phraseIndex,
        msg: 'line end character LF(\\n, \\x0A) - strict ABNF specifies CRLF(\\r\\n, \\x0D\\x0A)',
      });
    }
  }
  return ids.SEM_OK;
}
function semCR(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.endType = 'CR';
    if (data.strict) {
      data.errors.push({
        line: data.lineNo,
        char: phraseIndex,
        msg: 'line end character CR(\\r, \\x0D) - strict ABNF specifies CRLF(\\r\\n, \\x0D\\x0A)',
      });
    }
  }
  return ids.SEM_OK;
}
function semCRLF(state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData): number {
  if (state === ids.SEM_PRE) {
    data.endType = 'CRLF';
  }
  return ids.SEM_OK;
}
type Callback = (state: number, chars: number[], phraseIndex: number, phraseCount: number, data: ScanData) => number;

interface CallbackMap {
  file: Callback;
  line: Callback;
  'line-text': Callback;
  'last-line': Callback;
  invalid: Callback;
  end: Callback;
  lf: Callback;
  cr: Callback;
  crlf: Callback;
}

const callbacks: CallbackMap = {
  file: semFile,
  line: semLine,
  'line-text': semLineText,
  'last-line': semLastLine,
  invalid: semInvalid,
  end: semEnd,
  lf: semLF,
  cr: semCR,
  crlf: semCRLF,
};
export { callbacks };
