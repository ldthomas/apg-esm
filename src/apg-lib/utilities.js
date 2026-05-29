/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
/**
 * @module utilities
 * @description Utility functions shared by `apg-lib`, the parser generator, and generated parsers.
 * Provides conversions between character-code arrays and strings, opcode/state name lookup,
 * and a variety of display format helpers.
 */
import id from './identifiers.js';

const THIS_FILE = 'utilities.js: ';

/* translate (implied) phrase beginning character and length to actual first and last character indexes */
/* used by multiple phrase handling functions */
function getBounds(length, begArg, len) {
  let end;
  let beg = begArg;
  const TRUE = true;
  while (TRUE) {
    if (length <= 0) {
      beg = 0;
      end = 0;
      break;
    }
    if (typeof beg !== 'number') {
      beg = 0;
      end = length;
      break;
    }
    if (beg >= length) {
      beg = length;
      end = length;
      break;
    }
    if (typeof len !== 'number') {
      end = length;
      break;
    }
    end = beg + len;
    if (end > length) {
      end = length;
      break;
    }
    break;
  }
  return {
    beg,
    end,
  };
}
/**
 * @function charsToString
 * @description Translates a sub-array of integer character codes into a JavaScript string.
 * Very useful in callback functions to translate matched phrases.
 * @param {number[]} chars - The full array of integer character codes.
 * @param {number} [phraseIndex] - Start index into `chars`. Defaults to `0`.
 * @param {number} [phraseLength] - Number of characters to translate. Defaults to end of array.
 * @returns {string} The resulting string, or `''` if the range is empty.
 */
export function charsToString(chars, phraseIndex, phraseLength) {
  let beg;
  let end;
  if (typeof phraseIndex === 'number') {
    if (phraseIndex >= chars.length) {
      return '';
    }
    beg = phraseIndex < 0 ? 0 : phraseIndex;
  } else {
    beg = 0;
  }
  if (typeof phraseLength === 'number') {
    if (phraseLength <= 0) {
      return '';
    }
    end = phraseLength > chars.length - beg ? chars.length : beg + phraseLength;
  } else {
    end = chars.length;
  }
  if (beg < end) {
    const slice = chars.slice(beg, end);
    const CHUNK = 0x8000; // safe chunk size for Function.apply
    let out = '';
    for (let i = 0; i < slice.length; i += CHUNK) {
      out += String.fromCodePoint.apply(null, slice.slice(i, i + CHUNK));
    }
    return out;
  }
  return '';
}
/**
 * @function stringToChars
 * @description Translates a JavaScript string into an array of integer Unicode code points.
 * @param {string} string - The input string.
 * @returns {number[]} Array of integer Unicode code-point values.
 */
export function stringToChars(string) {
  return Array.from(string).map((ch) => ch.codePointAt(0));
}
/**
 * @function opcodeToString
 * @description Translates an opcode type identifier into a human-readable string.
 * @param {number} type - An opcode type constant from {@link module:identifiers}.
 * @returns {string} The opcode name (e.g. `'ALT'`, `'CAT'`, `'RNM'`, etc.).
 */
export function opcodeToString(type) {
  let ret = 'unknown';
  switch (type) {
    case id.ALT:
      ret = 'ALT';
      break;
    case id.CAT:
      ret = 'CAT';
      break;
    case id.RNM:
      ret = 'RNM';
      break;
    case id.UDT:
      ret = 'UDT';
      break;
    case id.AND:
      ret = 'AND';
      break;
    case id.NOT:
      ret = 'NOT';
      break;
    case id.REP:
      ret = 'REP';
      break;
    case id.TRG:
      ret = 'TRG';
      break;
    case id.TBS:
      ret = 'TBS';
      break;
    case id.TLS:
      ret = 'TLS';
      break;
    case id.BKR:
      ret = 'BKR';
      break;
    case id.BKA:
      ret = 'BKA';
      break;
    case id.BKN:
      ret = 'BKN';
      break;
    case id.ABG:
      ret = 'ABG';
      break;
    case id.AEN:
      ret = 'AEN';
      break;
    default:
      throw new Error('unrecognized opcode');
  }
  return ret;
}
/**
 * @function stateToString
 * @description Translates a parser state identifier into a human-readable string.
 * @param {number} state - A state constant from {@link module:identifiers} (`ACTIVE`, `MATCH`, `EMPTY`, or `NOMATCH`).
 * @returns {string} The state name.
 */
export function stateToString(state) {
  let ret = 'unknown';
  switch (state) {
    case id.ACTIVE:
      ret = 'ACTIVE';
      break;
    case id.MATCH:
      ret = 'MATCH';
      break;
    case id.EMPTY:
      ret = 'EMPTY';
      break;
    case id.NOMATCH:
      ret = 'NOMATCH';
      break;
    default:
      throw new Error('unrecognized state');
  }
  return ret;
}
/**
 * @constant {string[]} asciiChars
 * @description Array of 128 HTML-safe display strings for the 7-bit ASCII character codes (indices 0–127).
 * Control characters are represented by their abbreviation (e.g. `'NUL'`, `'LF'`);
 * printable characters are their literal HTML-escaped form.
 */
export const asciiChars = [
  'NUL',
  'SOH',
  'STX',
  'ETX',
  'EOT',
  'ENQ',
  'ACK',
  'BEL',
  'BS',
  'TAB',
  'LF',
  'VT',
  'FF',
  'CR',
  'SO',
  'SI',
  'DLE',
  'DC1',
  'DC2',
  'DC3',
  'DC4',
  'NAK',
  'SYN',
  'ETB',
  'CAN',
  'EM',
  'SUB',
  'ESC',
  'FS',
  'GS',
  'RS',
  'US',
  '&nbsp;',
  '!',
  '&#34;',
  '#',
  '$',
  '%',
  '&#38;',
  '&#39;',
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ':',
  ';',
  '&#60;',
  '=',
  '&#62;',
  '?',
  '@',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '[',
  '&#92;',
  ']',
  '^',
  '_',
  '`',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '{',
  '|',
  '}',
  '~',
  'DEL',
];
/**
 * @function charToHex
 * @description Translates a single character code to an uppercase hexadecimal string
 * with leading zeros to produce a 2-, 4-, or 8-digit representation.
 * @param {number} char - Integer character code.
 * @returns {string} Uppercase hex string.
 */
export function charToHex(char) {
  let ch = char.toString(16).toUpperCase();
  switch (ch.length) {
    case 1:
    case 3:
    case 7:
      ch = `0${ch}`;
      break;
    case 2:
    case 6:
      ch = `00${ch}`;
      break;
    case 4:
      break;
    case 5:
      ch = `000${ch}`;
      break;
    default:
      throw new Error('unrecognized option');
  }
  return ch;
}
/**
 * @function charsToDec
 * @description Translates a sub-array of character codes to a comma-separated decimal string.
 * @param {number[]} chars - Array of integer character codes.
 * @param {number} [beg] - Start index. Defaults to `0`.
 * @param {number} [len] - Number of characters. Defaults to end of array.
 * @returns {string} Comma-separated decimal string, e.g. `'65,66,67'`.
 */
export function charsToDec(chars, beg, len) {
  let ret = '';
  if (!Array.isArray(chars)) {
    throw new Error(`${THIS_FILE}charsToDec: input must be an array of integers`);
  }
  const bounds = getBounds(chars.length, beg, len);
  if (bounds.end > bounds.beg) {
    ret += chars[bounds.beg];
    for (let i = bounds.beg + 1; i < bounds.end; i += 1) {
      ret += `,${chars[i]}`;
    }
  }
  return ret;
}
/**
 * @function charsToHex
 * @description Translates a sub-array of character codes to a comma-separated hexadecimal string.
 * @param {number[]} chars - Array of integer character codes.
 * @param {number} [beg] - Start index. Defaults to `0`.
 * @param {number} [len] - Number of characters. Defaults to end of array.
 * @returns {string} Comma-separated hex string, e.g. `'\\x41,\\x42,\\x43'`.
 */
export function charsToHex(chars, beg, len) {
  let ret = '';
  if (!Array.isArray(chars)) {
    throw new Error(`${THIS_FILE}charsToHex: input must be an array of integers`);
  }
  const bounds = getBounds(chars.length, beg, len);
  if (bounds.end > bounds.beg) {
    ret += `\\x${charToHex(chars[bounds.beg])}`;
    for (let i = bounds.beg + 1; i < bounds.end; i += 1) {
      ret += `,\\x${charToHex(chars[i])}`;
    }
  }
  return ret;
}
export function charsToHtmlEntities(chars, beg, len) {
  let ret = '';
  if (!Array.isArray(chars)) {
    throw new Error(`${THIS_FILE}charsToHtmlEntities: input must be an array of integers`);
  }
  const bounds = getBounds(chars.length, beg, len);
  if (bounds.end > bounds.beg) {
    for (let i = bounds.beg; i < bounds.end; i += 1) {
      ret += `&#x${chars[i].toString(16)};`;
    }
  }
  return ret;
}
// Translates a sub-array of character codes to Unicode display format.
function isUnicode(char) {
  if (char >= 0xd800 && char <= 0xdfff) {
    return false;
  }
  if (char > 0x10ffff) {
    return false;
  }
  return true;
}
/**
 * @function charsToUnicode
 * @description Translates a sub-array of character codes to HTML Unicode numeric character references.
 * @param {number[]} chars - Array of integer character codes.
 * @param {number} [beg] - Start index. Defaults to `0`.
 * @param {number} [len] - Number of characters. Defaults to end of array.
 * @returns {string} HTML character reference string, e.g. `'&#65;&#66;'`.
 */
export function charsToUnicode(chars, beg, len) {
  let ret = '';
  if (!Array.isArray(chars)) {
    throw new Error(`${THIS_FILE}charsToUnicode: input must be an array of integers`);
  }
  const bounds = getBounds(chars.length, beg, len);
  if (bounds.end > bounds.beg) {
    for (let i = bounds.beg; i < bounds.end; i += 1) {
      if (isUnicode(chars[i])) {
        ret += `&#${chars[i]};`;
      } else {
        ret += ` U+${charToHex(chars[i])}`;
      }
    }
  }
  return ret;
}
/**
 * @function charsToJsUnicode
 * @description Translates a sub-array of character codes to JavaScript `\uXXXX` Unicode escape sequences.
 * @param {number[]} chars - Array of integer character codes.
 * @param {number} [beg] - Start index. Defaults to `0`.
 * @param {number} [len] - Number of characters. Defaults to end of array.
 * @returns {string} Comma-separated `\uXXXX` escape string.
 */
export function charsToJsUnicode(chars, beg, len) {
  let ret = '';
  if (!Array.isArray(chars)) {
    throw new Error(`${THIS_FILE}charsToJsUnicode: input must be an array of integers`);
  }
  const bounds = getBounds(chars.length, beg, len);
  if (bounds.end > bounds.beg) {
    ret += `\\u${charToHex(chars[bounds.beg])}`;
    for (let i = bounds.beg + 1; i < bounds.end; i += 1) {
      ret += `,\\u${charToHex(chars[i])}`;
    }
  }
  return ret;
}
// Translates a sub-array of character codes to printing ASCII character display format.
export function charsToAscii(chars, beg, len) {
  let ret = '';
  if (!Array.isArray(chars)) {
    throw new Error(`${THIS_FILE}charsToAscii: input must be an array of integers`);
  }
  const bounds = getBounds(chars.length, beg, len);
  for (let i = bounds.beg; i < bounds.end; i += 1) {
    const char = chars[i];
    if (char >= 32 && char <= 126) {
      ret += String.fromCharCode(char);
    } else {
      ret += `\\x${charToHex(char)}`;
    }
  }
  return ret;
}
