import Grammar from './float.js';
import Parser from '../src/apg-lib/parser.js';
import separate from './separate.js';
import single from './single.js';

test('pre-generated grammar object does not throw and returns success', () => {
  let result;
  const grammar = new Grammar();
  const parser = new Parser(grammar);
  expect(() => {
    result = parser.parse(0, '123.0');
  }).not.toThrow();
  expect(result.success).toBe(true);
});
test('grammar object constructed in separate steps does not throw and returns success', () => {
  let result;
  expect(() => {
    result = separate();
  }).not.toThrow();
  expect(result.success).toBe(true);
});
test('grammar object constructed in a single step does not throw and returns success', () => {
  let result;
  expect(() => {
    result = single();
  }).not.toThrow();
  expect(result.success).toBe(true);
});
