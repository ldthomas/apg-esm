import Api from '../src/apg-api/api.js';
import Parser from '../src/apg-lib/parser.js';
import ids from '../src/apg-lib/identifiers.js';

let float = '';
float += 'float    = [sign] decimal [exponent]\n';
float += 'sign     = e_sign\n';
float += 'decimal  = integer [dot [fraction]]\n';
float += '           / dot fraction\n';
float += 'integer  = 1*%d48-57\n';
float += 'dot      = "."\n';
float += 'fraction = 1*%d48-57\n';
float += 'exponent = "e" [esign] exp\n';
float += 'esign    = "+" / "-"\n';
float += 'exp      = u_exp\n';

const u_callback = (sys, chars, phraseIndex, data) => {
  let len = 0;
  for (let i = phraseIndex; i < chars.length; i++) {
    if (chars[i] >= 48 && chars[i] <= 57) {
      len++;
    }
  }
  if (len === 0) {
    sys.state = ids.NOMATCH;
    sys.phraseLength = 0;
  } else {
    sys.state = ids.MATCH;
    sys.phraseLength = len;
  }
};
const e_callback = (sys, chars, phraseIndex, data) => {
  let c = chars[phraseIndex];
  if (c === 43 || c === 45) {
    sys.state = ids.MATCH;
    sys.phraseLength = 1;
  } else {
    sys.state = ids.EMPTY;
    sys.phraseLength = 0;
  }
};
const u_badEmpty = (sys, chars, phraseIndex, data) => {
  sys.state = ids.EMPTY;
  sys.phraseLength = 0;
};
const u_badTooLong = (sys, chars, phraseIndex, data) => {
  sys.state = ids.MATCH;
  sys.phraseLength = 10;
};

const api = new Api(float);
api.generate();
if (api.errors.length) {
  throw new Error(`${thisFileName}grammar has errors`);
}

let result;
const grammar = api.toObject();
const parser = new Parser(grammar);
parser.setCallback('u_exp', u_callback);
parser.setCallback('e_sign', e_callback);
describe('UDT tests', () => {
  test('all ok', () => {
    result = parser.parse(0, '123');
    expect(result.success).toBe(true);
    result = parser.parse(0, '123.0');
    expect(result.success).toBe(true);
    result = parser.parse(0, '123.0e+10');
    expect(result.success).toBe(true);
    result = parser.parse(0, '-123.0');
    expect(result.success).toBe(true);
    result = parser.parse(0, '+123.0E-10');
    expect(result.success).toBe(true);
  });
  test('empty u_exp', () => {
    parser.setCallback('u_exp', u_badEmpty);
    expect(() => {
      parser.parse(0, '123.0e-10');
    }).toThrow();
  });
  test('u_exp return phrase too long', () => {
    parser.setCallback('u_exp', u_badTooLong);
    expect(() => {
      parser.parse(0, '123.0e-10');
    }).toThrow();
  });
  test('throw if no UDT callbacks', () => {
    parser.clearCallbacks();
    expect(() => {
      parser.parse(0, '123.0e-10');
    }).toThrow();
  });
  test('throw if one UDT callback is missing', () => {
    parser.setCallback('u_exp', u_callback);
    parser.clearCallbacks();
    expect(() => {
      parser.parse(0, '123.0e-10');
    }).toThrow();
  });
  test("don't throw throw if all UDT callbacks are good", () => {
    parser.clearCallbacks();
    parser.setCallback('u_exp', u_callback);
    parser.setCallback('e_sign', e_callback);
    expect(() => {
      parser.parse(0, '123.0e-10');
    }).not.toThrow();
  });
});
