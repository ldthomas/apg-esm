import { charsToXmlString } from '../dist/apg-lib/utilities.js';

describe('charsToXmlString', () => {
  test('escapes XML-sensitive characters', () => {
    expect(charsToXmlString([0x26, 0x3c, 0x3e, 0x22, 0x27, 0x41])).toBe('&amp;&lt;&gt;&quot;&apos;A');
  });

  test('replaces invalid XML code points with U+FFFD', () => {
    const actual = charsToXmlString([0x0000, 0x0009, 0x000b, 0x001f, 0x0020, 0xd800, 0xfffe, 0x20ac]);
    expect(actual).toBe('\uFFFD\t\uFFFD\uFFFD \uFFFD\uFFFD€');
  });

  test('respects beg and len bounds while sanitizing', () => {
    expect(charsToXmlString([0x41, 0x42, 0x00, 0x3c, 0x3e], 1, 3)).toBe('B\uFFFD&lt;');
  });

  test('returns empty string for empty or out of range slices', () => {
    expect(charsToXmlString([0x41, 0x42], 5, 1)).toBe('');
    expect(charsToXmlString([0x41, 0x42], 0, 0)).toBe('');
  });
});
